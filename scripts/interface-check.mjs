import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";
import { readFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname, extname } from "node:path";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const root = resolve(import.meta.dirname, "..");
const read = (file) => readFile(resolve(root, file), "utf8");
const loadComponent = async (file, exportName = "default") => {
  const cache = new Map();
  const load = path => {
    if (extname(path) === ".png") return { default: `data:image/png;base64,${readFileSync(path).toString("base64")}` };
    if (extname(path) === ".mp4") return { default: "/assets/chest-opening.mp4" };
    if (cache.has(path)) return cache.get(path).exports;
    const module = { exports: {} }; cache.set(path, module);
    const compiled = ts.transpileModule(readFileSync(path, "utf8").replaceAll("import.meta.env.DEV", "false"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
    const require = name => {
      if (!name.startsWith(".")) return createRequire(path)(name);
      const base = resolve(dirname(path), name);
      const source = extname(base) ? base : [base + ".tsx", base + ".ts"].find(existsSync);
      if (!source) throw new Error(`Missing test module: ${name}`);
      return load(source);
    };
    new Function("require", "module", "exports", compiled)(require, module, module.exports);
    return module.exports;
  };
  return load(resolve(root, file))[exportName];
};
const Presence = await loadComponent("src/DevicePresenceStrip.tsx");
const renderPresence = (online) => renderToStaticMarkup(createElement(Presence, { online, current: "pc" }));
assert.equal((renderPresence(["pc"]).match(/device-node connected/g) ?? []).length, 1);
assert.equal((renderPresence(["pc", "web", "mobile"]).match(/device-node connected/g) ?? []).length, 3);
assert.equal((renderPresence([]).match(/device-node connected/g) ?? []).length, 0);
assert(renderPresence([]).includes("PC: este dispositivo · sin emparejar"));
assert(renderPresence(["pc"]).includes("Móvil: sin conexión reciente"));
const mobilePresence = renderToStaticMarkup(createElement(Presence, { online: ["pc", "web", "mobile"], current: "mobile" }));
assert(mobilePresence.includes('device-node connected current'), "The mobile instance must mark its own real connection.");
assert(mobilePresence.includes("Web: conectado"), "A web heartbeat received by Android must show Web connected, not offline.");
assert.equal((mobilePresence.match(/device-node connected/g) ?? []).length, 3);
const Emblem = await loadComponent("src/GameLogoMark.tsx");
const emblems = renderToStaticMarkup(createElement("div", null, createElement(Emblem), createElement(Emblem)));
const ids = [...emblems.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(ids.length, new Set(ids).size, "Repeated emblems must not share gradient IDs.");
assert(emblems.includes('viewBox="0 0 128 128"'));
assert.equal((emblems.match(/class="emblem-model"/g) ?? []).length, 2);
assert(emblems.includes('preserveAspectRatio="xMidYMid meet"'), "The chest icon must never stretch or flatten the rendered model.");
const iconRender = JSON.parse(await read("src/assets/chest-emblem.render.json"));
const emblemPng = readFileSync(resolve(root, "src/assets/chest-emblem.png"));
assert.equal(emblemPng.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
assert.equal(emblemPng.readUInt32BE(16), 1024); assert.equal(emblemPng.readUInt32BE(20), 1024); assert.equal(emblemPng[25], 6);
assert.equal(emblemPng[24], 8); assert.equal(emblemPng[28], 0);
// Inspect the alpha channel without editing/resampling the generated artwork.
const chunks = [];
for (let offset = 8; offset < emblemPng.length;) {
  const length = emblemPng.readUInt32BE(offset), type = emblemPng.toString("ascii", offset + 4, offset + 8);
  if (type === "IDAT") chunks.push(emblemPng.subarray(offset + 8, offset + 8 + length));
  offset += length + 12;
}
const scanlines = inflateSync(Buffer.concat(chunks), { maxOutputLength: 1024 * 4097 });
assert.equal(scanlines.length, 1024 * 4097);
let previous = new Uint8Array(4096), opaque = 0, minX = 1024, minY = 1024, maxX = -1, maxY = -1;
const cornerAlpha = [];
const paeth = (a, b, c) => { const p = a + b - c, da = Math.abs(p - a), db = Math.abs(p - b), dc = Math.abs(p - c); return da <= db && da <= dc ? a : db <= dc ? b : c; };
for (let y = 0; y < 1024; y++) {
  const offset = y * 4097, filter = scanlines[offset], row = new Uint8Array(4096);
  assert(filter <= 4);
  for (let i = 0; i < row.length; i++) {
    const a = i >= 4 ? row[i - 4] : 0, b = previous[i], c = i >= 4 ? previous[i - 4] : 0;
    const predictor = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter];
    row[i] = (scanlines[offset + i + 1] + predictor) & 255;
  }
  for (let x = 0; x < 1024; x++) {
    const alpha = row[x * 4 + 3];
    if ((x === 0 || x === 1023) && (y === 0 || y === 1023)) cornerAlpha.push(alpha);
    if (alpha >= 220) { opaque++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  previous = row;
}
assert(cornerAlpha.every(alpha => alpha === 0), "The chest master must keep its transparent background.");
assert(opaque > 1024 * 1024 * .3 && opaque < 1024 * 1024 * .8, "A blank or square screenshot is not a usable chest icon.");
assert(minX > 16 && minY > 16 && maxX < 1008 && maxY < 1008, "The same-model icon must keep the chest inside the frame without clipping.");
assert.equal(createHash("sha256").update(emblemPng).digest("hex"), iconRender.sha256);
for (const [source, digest] of Object.entries(iconRender.sources)) {
  assert.equal(createHash("sha256").update((await read(source)).replaceAll("\r\n", "\n")).digest("hex"), digest, `The model changed after rendering the icon: ${source}. Run pnpm icons.`);
}
assert.equal(iconRender.atMs, 3200);
const Ghost = await loadComponent("src/GameLogoMark.tsx", "GhostMark");
const ShinyKey = await loadComponent("src/GameLogoMark.tsx", "ShinyModuleMark");
const ghost = renderToStaticMarkup(createElement(Ghost));
assert(ghost.includes("spirit-carry-arm") && ghost.includes("spirit-tail") && ghost.includes("spirit-head") && ghost.includes("spirit-eyes"));
const Progress = await loadComponent("src/RewardProgressBar.tsx");
for (const [points, expected, state] of [[-5, 0, "empty"], [187, 187, "energized"], [1250, 1000, "charged"]]) {
  const bar = renderToStaticMarkup(createElement(Progress, { value: points, target: 1000, label: "Progreso" }));
  assert(bar.includes(`aria-valuenow="${expected}"`) && bar.includes(state));
  assert.equal(bar.includes("reward-energy-gain"), expected > 0);
}
assert(renderToStaticMarkup(createElement(Progress, { value: NaN, target: Infinity, label: "Progreso" })).includes('aria-valuenow="0"'));
const refinement = await read("src/refinement.css");
assert(refinement.includes(".progress-track .reward-energy-ticks"), "Decorative ticks must override the old span gradient, not visually fill an incomplete bar.");
const Probability = await loadComponent("src/ObservedProbability.tsx");
const estimate = renderToStaticMarkup(createElement(Probability, { count: 16, perPointPercent: .1, currentChancePercent: 18, tx: es => es }));
assert(estimate.includes("Frecuencia por punto") && estimate.includes("Estimación del intento actual"));
const zeroEstimate = renderToStaticMarkup(createElement(Probability, { count: 0, perPointPercent: 0, currentChancePercent: 0, tx: es => es }));
assert(zeroEstimate.includes("0 muestras") && !zeroEstimate.includes("0.000%"));
const Glyph = await loadComponent("src/ConsoleGlyph.tsx");
for (const section of ["progress", "characters", "vision", "devices", "history", "shiny", "changes", "settings"]) {
  const glyph = renderToStaticMarkup(createElement(Glyph, { section }));
  assert(glyph.includes("<path") && glyph.includes('aria-hidden="true"'), `${section} needs its own decorative glyph.`);
}
const styles = await read("src/interface.css");
assert(styles.includes(".device-presence .connected .device-orbit"));
assert(styles.includes("@media (prefers-reduced-motion: reduce)"));
assert(styles.includes("animation: none !important"));
assert(styles.includes(':root[data-app-hidden="true"]'), "Hidden surfaces must pause decorative motion.");
for (const theme of ["lunar", "gravity", "symbiosis"]) assert(styles.includes(`[data-event="${theme}"]`));
assert(styles.includes(".nav-symbol svg { display: block; }"), "Compact navigation must not hide the new symbols.");
const crate = await read("src/CrateOpeningArt.tsx");
assert.equal((crate.match(/className="vault-hologram"/g) ?? []).length, 1);
assert(crate.includes("vault-key-port") && crate.includes("vault-lid-hinge"));
assert(!crate.includes("<img"), "Opening geometry must not slice a reference photo.");
assert(crate.includes("vault-lock-bolts") && crate.includes("vault-ground-radar"));
assert(crate.includes("vault-roof-plate") && crate.includes("vault-spirit-aperture") && crate.includes("ghostMark"));
const Opening = await loadComponent("src/CrateOpeningArt.tsx");
const openingArt = renderToStaticMarkup(createElement("div", null, createElement(Opening, { keyMark: createElement(ShinyKey), ghostMark: createElement(Ghost) }), createElement(Opening, { keyMark: createElement(ShinyKey), ghostMark: createElement(Ghost) })));
const openingIds = [...openingArt.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(openingIds.length, new Set(openingIds).size, "Multiple chests need isolated material/clip IDs.");
assert.equal((openingArt.match(/class="vault-roof-plate"/g) ?? []).length, 16, "Each lid is assembled from eight physical plates.");
const commandArity = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
for (const [, path] of (openingArt + emblems + ghost).matchAll(/\bd="([^"]+)"/g)) {
  for (const [, command, coordinates] of path.matchAll(/([a-df-z])([^a-df-z]*)/gi)) {
    const arity = commandArity[command.toLowerCase()];
    const numbers = coordinates.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) ?? [];
    assert(arity === 0 ? numbers.length === 0 : numbers.length >= arity && numbers.length % arity === 0, `Malformed ${command} coordinates: ${path}`);
  }
}
const openingStyles = await read("src/crateOpening.css");
assert(!crate.includes("moduleMark") && !crate.includes("vault-reward-module"), "The docking module stays with the chest, not the departing ghost.");
assert(openingStyles.includes("89%, 100% { opacity: 0; transform: translate(235px"), "The ghost must leave before the chest fades out.");
assert(openingStyles.includes("0%, 98% { opacity: 1; }"), "Leave the open chest visible alone at the end.");
assert(openingStyles.includes("counter-hinge-cycle") && openingStyles.includes("--vault-duration: 14s") && openingStyles.includes(".counter-chest *::after { animation: none !important"), "The mini chest needs a quiet repeat and reduced-motion support.");
const chestMaterials = await read("src/ChestMaterials.tsx");
const chestRelief = await read("src/ChestRelief.tsx");
const emblemRenderer = await read("scripts/render-chest-emblem.mjs");
assert(crate.includes("ChestMaterialDefs") && emblemRenderer.includes('"src/CrateOpeningArt.tsx"'), "The original chest animation retains its assembled model.");
assert((await read("src/App.tsx")).includes("from './GameLogoMark'"), "Auralis affiliation preserves the original chest logo.");
const brand=readFileSync(resolve(root,'src/assets/auralis-brand.png'));
assert.equal(brand.readUInt32BE(16),512);assert.equal(brand.readUInt32BE(20),512);
assert(chestRelief.includes("vault-corner-armor") && chestRelief.includes("vault-raised-post") && chestRelief.includes("vault-lock-bevel") && chestRelief.includes("vault-lock-groove"), "Keep the reference chest's raised bronze corners, inset steel panels and central crystal bezel.");
assert(chestMaterials.includes("patternTransform") && chestMaterials.includes("chest-countersunk-bolt"), "Surface wear and countersunk bolts must remain static, scalable vector details.");
for (const detail of ["machining-corner", "machining-post", "machining-panel", "machining-rail", "machining-lock", "machining-latch", "chest-hex-socket", "chest-exposed-edge", "vault-roof-machining", "vault-interior-machining"]) {
  assert(openingArt.includes(detail), `The metal chest must preserve its ${detail} detail.`);
}
for (const [, reference] of openingArt.matchAll(/url\(#([^\)]+)\)/g)) assert(openingIds.includes(reference), `Unresolved chest finish: ${reference}`);
const makeWear = await loadComponent("src/ChestMaterials.tsx", "buildEdgeWear");
const wearPoints = [[0, 0], [60, 0], [60, 50], [0, 50]];
const wear = makeWear(wearPoints);
assert.deepEqual(wear, makeWear(wearPoints), "Metal wear must remain fixed between renders and restarts.");
assert(wear.light.includes("M") && wear.dark.includes("M") && !/NaN|Infinity/.test(wear.light + wear.dark));
assert(chestMaterials.includes("-brushed") && chestMaterials.includes("-oxidation"), "Brushed grain and recessed patina must remain shared by the animated chest and logo.");
assert(chestRelief.includes("memo(function ChestRelief") && chestRelief.includes("memo(function LockRelief") && crate.includes("memo(function VaultedLid"), "Static metal hardware must not re-render when the points or unrelated timers change.");
assert(!/feTurbulence|requestAnimationFrame|setInterval/.test(chestMaterials + crate + chestRelief), "Metal detail must not add a noise filter or a per-frame render loop.");
assert(crate.includes("vault-roof-fasteners") && crate.includes("<LidLatchRelief") && openingStyles.includes(".vault-band-wall.wall-left"), "The vaulted lid needs solid hardware, extruded bands and a layered latch.");
assert(crate.includes("inner-back") && crate.includes("inner-front") && crate.includes("inner-left") && crate.includes("inner-right"), "The cavity must have four real internal walls, not a flat painted opening.");
assert(openingStyles.includes("translateZ(36px)") && openingArt.includes("vault-relief-bevel") && openingArt.includes("vault-relief-wall"));
for (const selector of [".vault-relief-piece", ".vault-keystone", ".vault-lid-latch"]) {
  const declarations = openingStyles.match(new RegExp(selector.replaceAll(".", "\\.") + " \\{([^}]+)\\}"))?.[1] ?? "";
  assert(declarations.includes("preserve-3d") && !/clip-path|filter:|opacity:/.test(declarations), `${selector} must not flatten the 3D relief with a grouping effect.`);
}
const buildRelief = await loadComponent("src/ChestRelief.tsx", "buildReliefGeometry");
const reliefBox = buildRelief(60, 50, 14, 4, [[0, 0], [60, 0], [60, 50], [0, 50]]);
assert.equal(reliefBox.walls.length, 4); assert.equal(reliefBox.bevels.length, 4); assert.equal(reliefBox.depth, 14);
for (const plane of [...reliefBox.walls, ...reliefBox.bevels]) {
  const matrix = plane.style.transform.match(/matrix3d\((.+)\)/)[1].split(",").map(Number);
  assert.equal(matrix.length, 16); assert(matrix.every(Number.isFinite));
  assert(Number(plane.style.width) > 0 && Number(plane.style.height) > 0 && plane.light >= 0 && plane.light <= 1);
}
assert(!(await read("src/GameLogoMark.tsx")).includes("EmblemRelief"), "Do not bring back the unrelated flat icon geometry.");
const counter = await read("src/CounterChestArt.tsx");
assert(counter.includes("memo(function CounterChestArt") && counter.includes("<CrateOpeningArt compact") && !counter.includes("<img") && !counter.includes("setInterval"));
const app = await read("src/App.tsx");
assert(app.includes("<StartupOpeningVideo previewAtMs={previewMs}") && app.includes("<CounterChestArt value={currentPoints} target={target}") && !app.includes("PHANTOM_CRATE_IMAGE") && !app.includes("<CrateOpeningArt"));
assert(app.includes('(creatorAccess === "granted" || ownerEntryRequested) && <article className="owner-panel panel">'), "Visitors must not see the owner login panel by default.");
assert(app.includes('event.ctrlKey && event.altKey && event.shiftKey') && !app.includes("Suma lo que reclames"));
assert(openingStyles.includes(".startup-intro *, .startup-intro *::before, .startup-intro *::after { animation: none !important; }"), "Reduced motion must win the opening cascade.");
const readme = await read("README.md");
assert(readme.includes("https://github.com/OscarD0823/auralis-caja-fantasma/releases/latest"));
assert(readme.includes("https://oscard0823.github.io/auralis-caja-fantasma/"));
assert(readme.includes("no un producto oficial") && readme.includes("recursos de terceros"));
assert(readme.includes("GUIA-TECNICA.md"));
const platform = await loadComponent("src/runtimePlatform.ts", "runtimePlatform");
assert.equal(platform(false, "Mozilla Android"), "web");
assert.equal(platform(false, "Windows NT"), "web");
assert.equal(platform(true, "Mozilla Android"), "android");
assert.equal(platform(true, "Windows NT"), "windows");
const Phone = await loadComponent("src/PhoneBridgeSyncPanel.tsx");
const props = { bridge: { enabled: false, busy: false, online: [], message: "", live: true }, language: "es", address: "", code: "", onAddress() {}, onCode() {}, newCode() {} };
for (const mobile of [false, true]) {
  const phoneWeb = renderToStaticMarkup(createElement(Phone, { ...props, mobile, web: true }));
  const buttons = [...phoneWeb.matchAll(/<button\b[^>]*>(.*?)<\/button>/gs)].map(match => match[1].replace(/<[^>]*>/g, ""));
  assert(buttons.includes("Conectar con el celular") && !buttons.includes("Compartir con la web"), "Every web surface, including Android browsers, must show the phone client.");
  assert(phoneWeb.includes("Código del celular"));
}
assert(renderToStaticMarkup(createElement(Phone, { ...props, mobile: true, web: false })).includes("Compartir con la web"));
const Tutorial = await loadComponent("src/AppTutorial.tsx");
const tour = renderToStaticMarkup(createElement(Tutorial, { language: "es", onClose() {}, onVisit() {} }));
assert(tour.includes('role="dialog"') && tour.includes("Registra tus recompensas") && tour.includes("Siguiente"));
const Update = await loadComponent("src/UpdateExperience.tsx");
for (const progress of [null, 72]) {
  const experience = renderToStaticMarkup(createElement(Update, { status: "downloading", progress, route: { current: "1.21.8", next: "1.22.0" }, language: "en", android: true, notes: "", error: "", dismiss() {}, install() {} }));
  assert(experience.includes("Updating Auralis Caja Fantasma") && experience.includes('role="progressbar"'));
  assert.equal(experience.includes("aria-valuenow"), progress !== null, "Unknown download progress must not invent a percentage.");
}
const Counter = await loadComponent("src/CounterChestArt.tsx");
const detail = await loadComponent("src/chestMotion.ts", "chooseChestDetail");
assert.equal(detail({ mobile: false, coarse: false, width: 1280, cores: 8, memory: 8 }), "full");
for (const options of [{ mobile: true, coarse: false, width: 1600 }, { mobile: false, coarse: true, width: 1000 }, { mobile: false, coarse: false, width: 390 }, { mobile: false, coarse: false, width: 1280, cores: 4 }, { mobile: false, coarse: false, width: 1280, memory: 4 }]) assert.equal(detail(options), "light");
const renderChest = (detail, compact = false) => renderToStaticMarkup(createElement(Opening, { detail, compact, keyMark: createElement(ShinyKey), ghostMark: createElement(Ghost) }));
const fullChest = renderChest("full"), lightChest = renderChest("light"), miniChest = renderChest("light", true);
const nodes = html => (html.match(/<[a-z][\w-]*(?:\s|>)/g) ?? []).length;
assert(nodes(lightChest) < nodes(fullChest) * .15, "Mobile artwork must remove at least 85% of the model's live DOM, not merely hide it.");
for (const art of [lightChest, miniChest]) {
  assert(!art.includes("vault-relief-wall") && !art.includes("vault-relief-bevel"));
  for (const moving of ["vault-camera", "vault-lid-hinge", "vault-key-port", "vault-key", "vault-clasp", "vault-hologram", "spectral-courier"]) assert(art.includes(moving), `Lightweight chest must retain ${moving}.`);
  assert.equal((art.match(/class="vault-roof-plate"/g) ?? []).length, 8);
  assert(!art.includes("vault-motes") && !art.includes("vault-anomaly-orbits"), "Hidden mobile ornaments must not be mounted.");
}
const performanceStyles = await read("src/chestPerformance.css");
assert(performanceStyles.includes('data-motion-paused="true"') && performanceStyles.includes('data-app-hidden="true"') && performanceStyles.includes('data-intro-active="true"'));
assert(counter.includes("IntersectionObserver") && counter.includes("observer.disconnect()") && counter.includes("memo(function CounterChestScene"));
assert(!/setInterval|requestAnimationFrame|localStorage|invoke\(/.test(counter + performanceStyles + await read("src/LightweightChestSurface.tsx")), "Art must not run frame loops or access progress/synchronization.");
const surfaces = JSON.parse(await read("src/assets/chest-surfaces.render.json"));
const surfacePng = readFileSync(resolve(root, "src/assets/chest-surfaces.png"));
assert.equal(surfacePng.readUInt32BE(16), 1024); assert.equal(surfacePng.readUInt32BE(20), 1024); assert.equal(surfacePng[25], 6);
assert(surfacePng.length < 800000, "The shared static metalwork must stay small for mobile.");
assert.equal(createHash("sha256").update(surfacePng).digest("hex"), surfaces.sha256);
for (const [source, digest] of Object.entries(surfaces.sources)) assert.equal(createHash("sha256").update((await read(source)).replaceAll("\r\n", "\n")).digest("hex"), digest, `Stale chest surface: ${source}. Run pnpm chest:surfaces.`);
console.log(`Chest performance: ${nodes(fullChest)} → ${nodes(lightChest)} DOM nodes; small counter ${nodes(miniChest)} nodes.`);
const movie = JSON.parse(await read("src/assets/chest-opening.render.json"));
const movieBytes = readFileSync(resolve(root, "src/assets/chest-opening.mp4"));
assert.equal(movieBytes.toString("ascii", 4, 8), "ftyp");
assert(movieBytes.length < 2000000, "A short mobile startup must not become a multi-megabyte download.");
assert.equal(movie.codec, "h264"); assert.equal(movie.profile, "baseline"); assert.equal(movie.audio, false);
assert.equal(movie.fps, 60); assert.equal(movie.frameCount, 456); assert.equal(movie.durationMs, 7600);
const choreography = await read("src/chestChoreography.css");
assert(choreography.includes("animation-name: vault-spirit-flow") && choreography.includes("animation-timing-function: linear"));
const flight = [...choreography.matchAll(/(\d+)% \{ opacity: ([\d.]+); transform: translate\(([-\d.]+)px, ([-\d.]+)px\)/g)].map(([, percent, opacity, x, y]) => ({ percent: Number(percent), opacity: Number(opacity), x: Number(x), y: Number(y) }));
assert(flight.length >= 38, "Keep the ghost's densely sampled continuous flight.");
for (let index = 1; index < flight.length; index++) {
  const a = flight[index - 1], b = flight[index];
  assert(b.y < a.y && Math.hypot(b.x - a.x, b.y - a.y) > 1, "The departing ghost must not stop, bob back or freeze.");
}
assert((await read("src/main.tsx")).includes('import "./chestChoreography.css";'));
assert((await read("scripts/render-opening-video.mjs")).includes("animation.currentTime="), "Recording must seek a deterministic animation clock, not repeatedly restart CSS.");
assert.equal(createHash("sha256").update(movieBytes).digest("hex"), movie.sha256);
assert.equal(createHash("sha256").update(readFileSync(resolve(root, "src/assets/chest-opening-poster.png"))).digest("hex"), movie.posterSha256);
for (const [source, digest] of Object.entries(movie.sources)) assert.equal(createHash("sha256").update((await read(source)).replaceAll("\r\n", "\n")).digest("hex"), digest, `Stale opening video: ${source}. Run pnpm chest:video -- --ffmpeg <path>.`);
const savedWindow = globalThis.window;
try {
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  const Video = await loadComponent("src/StartupOpeningVideo.tsx");
  const motion = renderToStaticMarkup(createElement(Video, { onFinished() {} }));
  assert(motion.includes("<video") && /muted=""/i.test(motion) && /playsinline=""/i.test(motion) && !motion.includes("loop="));
  assert(!motion.includes("vault-solid") && nodes(motion) <= 2, "Startup must not mount the full 3D model behind its video.");
  globalThis.window = { matchMedia: () => ({ matches: true }) };
  const still = renderToStaticMarkup(createElement(Video, { onFinished() {} }));
  assert(still.includes("<img") && !still.includes("<video"), "Reduced motion must not download/autoplay the movie.");
} finally { if (savedWindow === undefined) delete globalThis.window; else globalThis.window = savedWindow; }
const movieSource = await read("src/StartupOpeningVideo.tsx");
assert(movieSource.includes('document.addEventListener("visibilitychange", resume)') && movieSource.includes('document.removeEventListener("visibilitychange", resume)') && movieSource.includes("player.pause()"));
assert(!/requestAnimationFrame|setInterval|localStorage|invoke\(/.test(movieSource), "Playback must not add a frame loop or touch personal data.");
const confirmation = renderToStaticMarkup(createElement(Update, { status: "confirming", progress: 100, route: { current: "1.21.8", next: "1.22.0" }, language: "en", android: true, notes: "", error: "", dismiss() {}, install() {} }));
assert(confirmation.includes("Verification") && !confirmation.includes(">Installation</li>"), "Opening Android's installer confirms verification, not that installation has finished.");
const charged = renderToStaticMarkup(createElement(Counter, { value: 187, target: 1000 }));
assert(charged.includes("chest-charge-ring") && charged.includes('aria-hidden="true"') && !charged.includes("puntos"));
console.log("Interface OK: real-presence states, unique emblems, reduced motion, assembled opening and practical downloads/disclaimer.");
