import assert from "node:assert/strict";
import { mergeModProgress, modLevel, normalizeModLevel, setModProgress } from "../src/modProgress.ts";
import { importState, initialState, mergePersonalSyncPayload, personalSyncPayload } from "../src/storage.ts";
import { MOD_PIECES, SHINY_MOD_CATALOG, SHINY_MOD_GROUPS, canonicalModCatalogId, matchesModSearch, modVariantName, normalizeModSearch } from "../src/shinyModsCatalog.ts";
import collectionReference from "../catalog/mod-collection-order.json" with { type: "json" };
import resonanceReference from "../catalog/resonance-mod-variants.json" with { type: "json" };
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
assert.deepEqual(SHINY_MOD_GROUPS.map(group => group.id), Object.keys(collectionReference.groups), "La referencia observada cubre todas las piezas y estilos.");
const oldVariants = SHINY_MOD_CATALOG.filter(item => !item.visionId);
for (const [groupId, families] of Object.entries(collectionReference.groups)) {
  const observed = new Map<string, { baseName: string; scenarioId?: string; variantCount: number }>();
  for (const item of oldVariants.filter(entry => entry.groupId === groupId)) {
    const key = `${item.baseName}:${item.scenarioId ?? ""}`;
    const previous = observed.get(key);
    if (previous) previous.variantCount += 1;
    else observed.set(key, { baseName: item.baseName, ...(item.scenarioId ? { scenarioId: item.scenarioId } : {}), variantCount: 1 });
  }
  assert.deepEqual([...observed.values()], families, `Nombres, orden y variantes contrastados en el juego: ${groupId}`);
}
assert.equal(Object.values(collectionReference.groups).flat().length, collectionReference.counts.modules);
assert.equal(oldVariants.length, collectionReference.counts.variants);
assert.deepEqual(SHINY_MOD_GROUPS.filter(group => group.category === "weapon").map(group => group.id), ["weapon-burn", "weapon-power-surge", "weapon-frost-vortex", "weapon-the-bull-s-eye", "weapon-fortress-warfare", "weapon-unstable-bomber", "weapon-fast-gunner", "weapon-bounce", "weapon-shrapnel"], "Orden de los nueve tipos observado en la colección del juego.");
const burn = SHINY_MOD_CATALOG.filter(item => item.groupId === "weapon-burn");
assert.equal(burn.length, 20, "Quemadura incluye sus cuatro módulos de la colección del juego.");
assert.deepEqual([...new Set(burn.map(item => item.baseName))], ["Quemadura continua", "Brasas", "Bendición ígnea", "Ira ardiente"]);
assert.equal(modVariantName("Violencia"), "Violencia", "La ficha actual del juego usa Violencia, no Violento.");
const weaponAmplifier = SHINY_MOD_CATALOG.filter(item => item.groupId === "armor-guantes" && item.baseName === "Amplificación de arma");
assert.equal(weaponAmplifier.length, 11, "Nombre actual de la fila de guantes verificado en el juego.");
assert.ok(weaponAmplifier.every(item => item.searchAliases?.includes("Amplificador de municiones")), "El nombre anterior sigue siendo un alias de búsqueda.");
assert.ok(weaponAmplifier.every(item => matchesModSearch(item, normalizeModSearch("Amplificador de municiones"))));
assert.deepEqual([...new Set(SHINY_MOD_CATALOG.filter(item => item.groupId === "armor-parte-superior").map(item => item.baseName))], ["Fortificación de curación", "Regreso rápido", "Rejuvenecimiento", "Rescate crítico", "Conflicto frontal", "Líder de guardia", "Ventaja de resistencia", "Escudo duradero", "Inmune a estado", "Escudo ardiente"], "Escudo duradero ocupa la octava fila en la colección del juego.");
assert.deepEqual(new Set(burn.filter(item => item.baseName === "Quemadura continua").map(item => item.variant)), new Set(["Supervivencia", "General", "Violencia", "Energía de aberración", "Quemadura"]));
for (const [base, slot] of [["Precision Load", "armor-pantalones"], ["Turret Enhancement", "armor-guantes"]]) {
  const newMods = SHINY_MOD_CATALOG.filter(item => item.baseEnglishName === base);
  assert.equal(newMods.length, 11);
  assert.ok(newMods.every(item => item.groupId === slot && item.scenarioId === "isles-of-abyss" && !item.isCatalogShiny));
  assert.equal(new Set(newMods.map(item => item.variant)).size, 11);
}
assert.equal(SHINY_MOD_CATALOG.filter(item => item.scenarioId).length, 22);
assert.equal(SHINY_MOD_CATALOG.filter(item => matchesModSearch(item, normalizeModSearch("Precision Load Downstar Deviant Energy"))).length, 1, "La búsqueda reconoce también la variante inglesa del módulo nuevo.");
const rhythm = SHINY_MOD_CATALOG.filter(item => item.visionId === "resonance");
assert.equal(rhythm.length, 40);
assert.deepEqual([...new Set(rhythm.map(item => item.groupId))], ["armor-casco", "armor-parte-superior"]);
assert.ok(rhythm.every(item => !item.isCatalogShiny && !item.legacyShinyIds?.length && !item.scenarioId));
for (const group of resonanceReference.groups) {
  const entries = SHINY_MOD_CATALOG.filter(item => item.groupId === group.id);
  assert.equal(entries.length, group.variantTotal);
  for (const family of new Set(entries.map(item => item.baseName))) {
    const variants = entries.filter(item => item.baseName === family && item.visionId === "resonance");
    assert.deepEqual(variants.map(item => item.variant), ["Ritmo", "Energía de aberración de Ritmo"]);
  }
}
assert.equal(rhythm.filter(item => matchesModSearch(item, normalizeModSearch("Healing Fortification Rhythm Deviant Energy"))).length, 1);
assert.equal(canonicalModCatalogId(old.catalogId), "new-normal-19500542-2400542");
console.log("Colección: progreso, respaldos, orden del juego, módulos acuáticos y 40 variantes de S5 OK.");
