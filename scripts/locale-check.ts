import assert from "node:assert/strict";
import { detectUiLanguage, restoredLanguage, UI_LANGUAGES } from "../src/i18n.ts";
import catalog from "../catalog/visions.json" with { type: "json" };
import { activityMapName, activityName, activityPhaseNames, localizedActivityRecord } from "../src/gameNames.ts";
import type { Activity, Catalog } from "../src/model.ts";
import { initialState, importState, loadState, personalSyncPayload } from "../src/storage.ts";

assert.equal(detectUiLanguage(["fr-CA", "en-US"]), "fr");
assert.equal(detectUiLanguage(["xx", "pt_BR"]), "pt");
assert.equal(detectUiLanguage(["zh-Hant-TW"]), "zh");
assert.equal(detectUiLanguage(["es-CO"]), "es");
assert.equal(detectUiLanguage(["unsupported"]), "en");
assert.equal(activityMapName("dream", "es"), "Sueño infinito");
assert.equal(activityMapName("dream", "en"), "Endless Dream");
assert.equal(activityMapName("winter", "es"), "El camino del invierno");
assert.equal(activityMapName("winter", "en"), "The Way of Winter");
assert.equal(activityMapName("abyss", "ja"), "禁断の島");
const lord = catalog.proActivities.find((activity) => activity.id === "sunken-lord")! as Activity;
for (const { code } of UI_LANGUAGES) {
  assert(activityName(lord, code));
  assert.equal(activityPhaseNames(lord, catalog.proActivities as Activity[], code)?.length, 3);
}
assert.deepEqual(activityPhaseNames(lord, catalog.proActivities as Activity[], "es"), ["Búho de Calamidad", "Torre de calamidad", "Señor Hundido"]);
assert.equal(activityName(lord, "en"), "The Sunken Lord");
assert.equal(activityName(lord, "de"), "Versunkener Lord");
const oldLabel = { activityId: lord.id, activityName: "The Sunken Lord", visionId: undefined, visionName: undefined };
assert.equal(localizedActivityRecord(oldLabel, catalog as Catalog, "es").activityName, "Señor Hundido");
assert.equal(oldLabel.activityName, "The Sunken Lord", "Display language must not rewrite historical records.");
const custom = { ...oldLabel, activityId: "custom-boss", activityName: "Mi jefe" };
assert.equal(localizedActivityRecord(custom, catalog as Catalog, "de").activityName, "Mi jefe");
const nav = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const memory = new Map<string, string>();
try {
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { languages: ["de-DE"], language: "de-DE" } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) } });
  assert.equal(initialState().settings.uiLanguage, "de");
  assert.equal(initialState().settings.uiLanguageMode, "auto");
  assert.deepEqual(restoredLanguage({ uiLanguage: "es" }), { uiLanguage: "es", uiLanguageMode: "manual" });
  assert.deepEqual(restoredLanguage({ uiLanguage: "es", uiLanguageMode: "auto" }), { uiLanguage: "de", uiLanguageMode: "auto" });
  const existing = initialState();
  existing.settings.uiLanguage = "es";
  delete existing.settings.uiLanguageMode; // Older installations had no explicit mode.
  existing.actions = [{ id: "preserved", activityId: "gravity-platforms", activityName: "Plataformas", points: 4, occurredAt: "2026-10-09T00:00:00Z" }];
  memory.set("caja-fantasma.once-human.state.v1", JSON.stringify(existing));
  for (const state of [loadState(), importState(JSON.stringify(existing))]) {
    assert.equal(state.settings.uiLanguage, "es");
    assert.equal(state.settings.uiLanguageMode, "manual");
    assert.equal(state.actions[0].id, "preserved");
    assert.equal(Object.hasOwn(personalSyncPayload(state), "settings"), false);
  }
} finally {
  if (nav) Object.defineProperty(globalThis, "navigator", nav); else Reflect.deleteProperty(globalThis, "navigator");
  if (storage) Object.defineProperty(globalThis, "localStorage", storage); else Reflect.deleteProperty(globalThis, "localStorage");
}
console.log("Locale OK: ordered device detection, preserved manual/legacy preferences, no progress or cross-device preference changes.");
