import assert from "node:assert/strict";
import { mergeModProgress, modLevel, normalizeModLevel, setModProgress } from "../src/modProgress.ts";
import { importState, initialState, mergePersonalSyncPayload, personalSyncPayload } from "../src/storage.ts";
import { MOD_PIECES, SHINY_MOD_CATALOG, canonicalModCatalogId } from "../src/shinyModsCatalog.ts";
import type { ShinyModRecord } from "../src/model.ts";

const old: ShinyModRecord = { id: "old", catalogId: "new-shiny-19505234-2410234", modName: "Hora punta", groupName: "Zapatos", variant: "Estrella Descendente", attempts: 31, isShiny: false, createdAt: "2026-10-01T10:00:00.000Z" };
const t1 = "2026-11-17T14:00:00.000Z", t2 = "2026-11-17T14:01:00.000Z", t3 = "2026-11-17T14:02:00.000Z";
assert.equal(modLevel(), 0);
assert.equal(modLevel(old), undefined, "No inventar un nivel para un registro antiguo.");
assert.equal(modLevel({ ...old, isShiny: true }), 17);
let record = setModProgress(old, 8, t1);
assert.equal(modLevel(record), 8);
record = setModProgress(record, 9, t2);
assert.equal(modLevel(record), 9);
record = setModProgress(record, 17, t2);
assert.equal(record.isShiny, false);
record = setModProgress(record, "shiny", t2);
assert.equal(record.isShiny, true);
assert.equal(record.level, 17);
assert.equal(record.obtainedAt, t2);
assert.equal(record.attempts, 31);
const corrected = setModProgress(record, 8, t3);
const cleared = setModProgress(record, 0, t3);
for (const [current, stale] of [[corrected, record], [cleared, record], [setModProgress(old, 8, t1), old]] as const) {
  for (const [a, b] of [[current, stale], [stale, current]]) {
    const merged = mergeModProgress(a, b);
    assert.equal(merged.level, current.level);
    assert.equal(merged.isShiny, current.isShiny);
    assert.equal(merged.obtainedAt, current.obtainedAt);
    assert.equal(merged.attempts, 31);
  }
}
assert.equal(mergeModProgress(old, { ...old, isShiny: true }).isShiny, true, "Conservar Brillantes antiguos sin fecha.");
assert.equal(mergeModProgress(setModProgress(old, 8, t1), setModProgress(old, 9, t1)).level, 9);
assert.equal(normalizeModLevel(18), 17);
assert.equal(normalizeModLevel(-5), 0);
assert.equal(normalizeModLevel(NaN), undefined);
assert.equal(normalizeModLevel(Infinity), undefined);

const state = initialState();
state.shinyMods = [old, { ...old, id: "old-shiny", isShiny: true, obtainedAt: t1 }, { ...record, id: "new" }];
const roundTrip = importState(JSON.stringify(state));
assert.deepEqual(JSON.parse(JSON.stringify(roundTrip.shinyMods)), JSON.parse(JSON.stringify(state.shinyMods)));
const updated = { ...state, shinyMods: [setModProgress(old, 8, t3)] };
const stale = { ...state, shinyMods: [{ ...record, attempts: 40 }] };
for (const [a, b] of [[updated, stale], [stale, updated]]) {
  const result = mergePersonalSyncPayload(a, personalSyncPayload(b));
  assert.equal(result.shinyMods[0].level, 8);
  assert.equal(result.shinyMods[0].isShiny, false);
  assert.equal(result.shinyMods[0].attempts, 40);
}
const malformed = importState(JSON.stringify({ ...state, shinyMods: [{ ...old, level: 500, levelUpdatedAt: "invalid" }] }));
assert.equal(malformed.shinyMods[0].level, 17);
assert.equal(malformed.shinyMods[0].levelUpdatedAt, undefined);

assert.deepEqual(MOD_PIECES.map(piece => piece.es), ["Arma", "Casco", "Superior", "Prenda inferior", "Zapatos", "Guantes", "Máscara"]);
const burn = SHINY_MOD_CATALOG.filter(item => item.groupId === "weapon-burn");
assert.equal(burn.length, 20, "Quemadura incluye sus cuatro módulos de la colección del juego.");
assert.deepEqual([...new Set(burn.map(item => item.baseName))], ["Quemadura continua", "Brasas", "Bendición ígnea", "Ira ardiente"]);
for (const [base, slot] of [["Precision Load", "armor-pantalones"], ["Turret Enhancement", "armor-guantes"]]) {
  const newMods = SHINY_MOD_CATALOG.filter(item => item.baseEnglishName === base);
  assert.equal(newMods.length, 11);
  assert.ok(newMods.every(item => item.groupId === slot && item.scenarioId === "isles-of-abyss" && !item.isCatalogShiny));
  assert.equal(new Set(newMods.map(item => item.variant)).size, 11);
}
assert.equal(SHINY_MOD_CATALOG.filter(item => item.scenarioId).length, 22);
assert.equal(SHINY_MOD_CATALOG.some(item => /Rhythm/.test(item.englishName)), false, "No presentar las variantes anunciadas para S5 como módulos ya publicados del mapa.");
assert.equal(canonicalModCatalogId(old.catalogId), "new-normal-19500542-2400542");
console.log("Colección: nivel recibido, 17, Shiny, correcciones, sincronización, respaldos, orden del juego y módulos acuáticos OK.");
