import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withChestBrowser } from "./isolated-chest-browser.mjs";

// Production smoke test in a fresh private profile, never the user's tabs/data.
const url = new URL(process.argv[2] ?? "http://127.0.0.1:1428/auralis-caja-fantasma/");
assert(["127.0.0.1", "localhost", "oscard0823.github.io"].includes(url.hostname));
if (url.hostname === "oscard0823.github.io") assert.equal(url.pathname, "/auralis-caja-fantasma/");
const output = mkdtempSync(join(tmpdir(), "caja-fantasma-web-release-"));
await withChestBrowser(join(output, "isolated-profile"), 1320, 850, async (call, on) => {
  const exceptions = [];
  await call("Runtime.enable");
  on("Runtime.exceptionThrown", event => exceptions.push(event.exceptionDetails.exception?.description ?? event.exceptionDetails.text));
  await call("Page.addScriptToEvaluateOnNewDocument", { source: "localStorage.setItem('caja-fantasma.tutorial.seen.v1','1')" });
  const evaluate = async expression => {
    const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, timeout = 20000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      try { if (await evaluate(`Boolean(${expression})`)) return; } catch { /* Context may be navigating. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error(`Timed out: ${expression}`);
  };
  await call("Page.navigate", { url: url.href });
  await waitFor("document.querySelector('.intro-video-stage video')?.currentTime > .1");
  const media = await evaluate("(()=>{const v=document.querySelector('video');return {url:v.currentSrc,width:v.videoWidth,height:v.videoHeight,muted:v.muted,inline:v.playsInline,error:v.error?.code??null,models:document.querySelector('.startup-intro').querySelectorAll('.vault-solid').length}})()");
  assert.equal(media.width, 640); assert.equal(media.height, 640);
  assert.equal(media.error, null); assert.equal(media.models, 0);
  assert(media.muted && media.inline && new URL(media.url).pathname.startsWith(url.pathname));
  await waitFor("!document.querySelector('.startup-intro') && document.querySelector('.progress-hero')");
  assert.match(await evaluate("document.querySelector('.hero-copy h2').textContent"), /^0\s*\//);
  await waitFor("navigator.serviceWorker.controller");
  await evaluate("document.querySelector('.progress-hero').scrollIntoView({block:'center'})");
  await waitFor("document.querySelector('.counter-chest').dataset.motionPaused === 'false'");
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.counter-chest .vault-hologram')).animationName"), "vault-spirit-flow");
  await evaluate("document.querySelector('.activity-grid button[aria-label^=Sumar],.activity-grid button[aria-label^=Add]').click()");
  await waitFor("document.querySelector('.hero-copy h2').textContent.trim().startsWith('1')");
  const range = await evaluate(`fetch(${JSON.stringify(media.url)},{headers:{Range:'bytes=0-1023'}}).then(async r=>({status:r.status,type:r.headers.get('content-type'),bytes:(await r.arrayBuffer()).byteLength}))`);
  assert([200, 206].includes(range.status)); assert(range.type?.includes("video/mp4"));
  await call("Page.reload", { ignoreCache: false });
  await waitFor("!document.querySelector('.startup-intro') && document.querySelector('.hero-copy h2')?.textContent.trim().startsWith('1')", 25000);
  const worker = await evaluate("navigator.serviceWorker.ready.then(r=>r.active.scriptURL)");
  assert(worker.startsWith(url.origin + url.pathname));
  assert.deepEqual(exceptions, [], "Production page must not throw runtime errors.");
  const screenshot = await call("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(output, "web-desktop.png"), Buffer.from(screenshot.data, "base64"));
  console.log(JSON.stringify({ productionWeb: "OK", media: "640px muted video", path: url.pathname, range, syntheticPointPreservedOnReload: true, serviceWorker: worker, output }, null, 2));
});
