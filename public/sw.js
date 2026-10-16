const CACHE = "caja-fantasma-web-v1.23.1";
const shell = new URL("./", self.registration.scope).href;
self.addEventListener("install", (event) => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  const response = await fetch(shell, { cache: "reload" });
  if (!response.ok) throw new Error("App shell unavailable");
  const html = await response.clone().text();
  await cache.put(shell, response);
  const paths = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => new URL(match[1], shell).href);
  await cache.addAll([...paths, new URL("manifest.webmanifest", shell).href, new URL("icons/app-192.png", shell).href, new URL("icons/app-512.png", shell).href]);
  await self.skipWaiting();
})()));
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith("caja-fantasma-web-") && key !== CACHE).map((key) => caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) { const cache = await caches.open(CACHE); await cache.put(shell, response.clone()); }
      return response;
    }).catch(async () => (await caches.match(shell)) || Response.error()));
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached && url.pathname.includes("/assets/")) return cached;
    try {
      const response = await fetch(request);
      // A video range response (206) cannot be stored with Cache.put.
      if (response.status === 200) { const cache = await caches.open(CACHE); await cache.put(request, response.clone()); }
      return response;
    } catch { return cached || Response.error(); }
  })());
});
