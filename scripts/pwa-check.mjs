import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

const root = resolve(import.meta.dirname, "..");
const release = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const serviceWorker = await readFile(resolve(root, "public/sw.js"), "utf8");
assert(serviceWorker.includes(`const CACHE = "caja-fantasma-web-v${release.version}";`), "Each release must renew the web interface cache without clearing personal storage.");
const manifest = JSON.parse(await readFile(resolve(root, "public/manifest.webmanifest"), "utf8"));
assert.equal(manifest.display, "standalone");
assert.equal(manifest.start_url, "./");
for (const icon of manifest.icons) {
  const bytes = await readFile(resolve(root, "public", icon.src));
  const size = Number(icon.sizes.split("x")[0]);
  assert.equal(bytes.readUInt32BE(16), size);
  assert.equal(bytes.readUInt32BE(20), size);
}
const scope = "https://example.test/auralis-caja-fantasma/";
const shell = '<script src="/auralis-caja-fantasma/assets/app.js"></script><link href="/auralis-caja-fantasma/assets/app.css">';
const network = new Map([[scope, shell], [scope + "assets/app.js", "app code"], [scope + "assets/app.css", "app styles"], ...["manifest.webmanifest", "icons/app-192.png", "icons/app-512.png"].map((path) => [scope + path, "resource"])]);
const records = new Map();
const events = new Map();
let offline = false;
let partial = false;
const key = (request) => typeof request === "string" ? request : request.url;
const fetchResource = async (request) => {
  if (offline) throw new TypeError("offline");
  if (partial) return new Response("video fragment", { status: 206 });
  const body = network.get(key(request));
  return new Response(body ?? "missing", { status: body === undefined ? 404 : 200 });
};
const cache = {
  put: async (request, response) => records.set(key(request), response.clone()),
  addAll: async (requests) => { for (const request of requests) { const response = await fetchResource(request); assert(response.ok); await cache.put(request, response); } },
};
let claimed = false;
runInNewContext(serviceWorker, {
  URL, Response, fetch: fetchResource,
  caches: { open: async () => cache, keys: async () => [], delete: async () => true, match: async (request) => records.get(key(request))?.clone() },
  self: { registration: { scope }, location: { origin: new URL(scope).origin }, skipWaiting: async () => {}, clients: { claim: async () => { claimed = true; } }, addEventListener: (event, listener) => events.set(event, listener) },
});
const lifetime = async (type) => { let promise; events.get(type)({ waitUntil: (value) => { promise = value; } }); await promise; };
await lifetime("install");
await lifetime("activate");
assert(claimed);
assert(records.has(scope + "assets/app.js"), "The installed app must cache its entry script before going offline");
offline = true;
const request = async (url, mode = "cors") => {
  let response;
  events.get("fetch")({ request: { method: "GET", url, mode }, respondWith: (promise) => { response = promise; } });
  return response;
};
assert.equal(await (await request(scope + "?v=installed", "navigate")).text(), shell);
assert.equal(await (await request(scope + "assets/app.js")).text(), "app code");
assert.equal((await request(scope + "assets/missing.js")).type, "error", "Missing scripts must never receive HTML as fallback");
assert.equal(await request("http://192.168.1.10:47183/sync"), undefined, "The service worker must not intercept the local sync bridge");
offline = false; partial = true;
assert.equal((await request(scope + "assets/opening.mp4")).status, 206, "A video range must be returned without trying to Cache.put a partial response.");
assert(!records.has(scope + "assets/opening.mp4"), "Only complete resources can be cached for offline playback.");
console.log("PWA OK: icons, installable scope, offline shell and local bridge isolation");
