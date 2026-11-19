import assert from "node:assert/strict";
import catalogData from "../catalog/visions.json" with { type: "json" };
import { applyRemoteCatalog, applyScheduledVision, computeCycle, echoPortalCountdown, sharedVisionId, upcomingVision, validateCatalog, visionSeasonChange, type Catalog } from "../src/model.ts";
import { initialState, loadState, personalSyncPayload, STORAGE_KEY } from "../src/storage.ts";
import { voiceSchedule } from "../src/voice.ts";

const catalog = catalogData as Catalog;
const changeAt = Date.parse("2026-11-18T23:00:00.000Z");
const observedAt = Date.parse("2026-11-19T00:35:57.734Z");
const minute = 60_000;
const previousCatalog = structuredClone(catalog);
previousCatalog.catalogVersion -= 1;
previousCatalog.eventTiming = {
  ...catalog.eventTiming!,
  selectedVisionId: "gravity",
  phaseStartedAt: "2026-10-05T02:22:26.240Z",
  updatedAt: "2026-10-05T02:23:26.240Z",
};
previousCatalog.visions.find(vision => vision.id === "resonance")!.cycleConfirmed = false;
assert(validateCatalog(catalog));
assert.equal(sharedVisionId(catalog, "gravity", changeAt - 1), "gravity");
assert.equal(sharedVisionId(catalog, "gravity", changeAt), "resonance");
assert.equal(sharedVisionId(catalog, "gravity", changeAt + 30 * 86_400_000), "resonance");
assert.equal(upcomingVision(catalog, changeAt - 1)?.id, "resonance");
assert.equal(upcomingVision(catalog, changeAt), undefined);
const ending = visionSeasonChange(catalog, changeAt - 3 * 86_400_000)!;
assert.equal(ending.current.id, "gravity");
assert.equal(ending.next.id, "resonance");
assert.equal(ending.next.transitionReason, "maintenance-start");
assert.equal(ending.remainingMs, 3 * 86_400_000);
assert.equal(ending.endingSoon, true);
assert.equal(ending.urgent, false);
assert.equal(visionSeasonChange(catalog, changeAt - 86_400_000)?.urgent, true);
assert.equal(visionSeasonChange(catalog, changeAt), undefined, "El aviso de cierre termina al comenzar el mantenimiento.");
const state = initialState();
state.catalog = previousCatalog;
state.settings.selectedVisionId = "gravity";
state.settings.lastVoiceAlertPhaseStartedAt = "2026-11-18T22:50:00Z";
state.actions = [{ id: "kept", activityId: "gravity-whale", activityName: "Ballena", points: 1, occurredAt: "2026-11-15T12:00:00Z" }];
state.activityHistory = [{ ...state.actions[0], count: 1 }];
state.boxes = [{ id: "box", occurredAt: "2026-11-14T12:00:00Z", points: 994, claims: 500, breakdown: [] }];
state.shinyMods = [{ id: "goal", catalogId: "new-shiny-19505234-2410234", modName: "Hora punta", variant: "Estrella Descendente", groupName: "Zapatos", attempts: 37, isShiny: true, createdAt: "2026-11-10T12:00:00Z", obtainedAt: "2026-11-14T12:00:00Z" }];
assert.strictEqual(applyScheduledVision(state, changeAt - 1), state);
const changed = applyScheduledVision(state, changeAt);
assert.equal(changed.settings.selectedVisionId, "resonance");
assert.equal(changed.settings.lastVoiceAlertPhaseStartedAt, undefined);
assert.deepEqual(personalSyncPayload(changed), personalSyncPayload(state), "La transición no puede borrar o reescribir progreso.");
assert.strictEqual(applyScheduledVision(changed, changeAt + 1), changed, "La transición debe ser idempotente.");
assert.equal(applyScheduledVision(JSON.parse(JSON.stringify(state)), changeAt + 10 * 86_400_000).settings.selectedVisionId, "resonance", "Una instalación sin conexión debe cambiar al reabrir después de la fecha.");
const updated = applyRemoteCatalog(state, catalog, observedAt);
assert.equal(updated.settings.selectedVisionId, "resonance");
assert.deepEqual(personalSyncPayload(updated), personalSyncPayload(state));
const offline = initialState().settings;
assert.equal(offline.phaseStartedAt, updated.settings.phaseStartedAt, "Una instalación nueva usa la referencia incluida aunque arranque sin conexión.");
const measuredCycle = computeCycle(offline, observedAt);
assert.equal(measuredCycle.phase, "active");
assert.equal(Math.ceil(measuredCycle.remainingMs / 1000), 9 * 60 + 8, "El reloj coincide con la lectura de tiempo restante en el juego.");
assert.equal(offline.activeMinutes, 30);
assert.equal(offline.waitMinutes, 30);
const activeEnd = Date.parse(measuredCycle.phaseEndsAt);
const activeStart = activeEnd - 30 * minute;
assert.equal(echoPortalCountdown(computeCycle(offline, activeStart), 30), 15 * minute);
assert.equal(echoPortalCountdown(computeCycle(offline, activeStart + 15 * minute), 30), 0);
assert.equal(computeCycle(offline, activeEnd).phase, "waiting");
assert.equal(echoPortalCountdown(computeCycle(offline, activeEnd), 30), 45 * minute);
assert.equal(computeCycle(offline, activeEnd + 30 * minute).phase, "active");
const savedStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
try {
  const savedState = { ...state, settings: { ...state.settings, phaseStartedAt: previousCatalog.eventTiming.phaseStartedAt, sharedTimingUpdatedAt: "2030-01-01T00:00:00.000Z" } };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (key: string) => key === STORAGE_KEY ? JSON.stringify(savedState) : null },
  });
  const restored = loadState();
  assert.equal(restored.catalog.catalogVersion, catalog.catalogVersion);
  assert.equal(restored.settings.phaseStartedAt, offline.phaseStartedAt);
  assert.deepEqual(JSON.parse(JSON.stringify(personalSyncPayload(restored))), JSON.parse(JSON.stringify(personalSyncPayload(state))));
} finally {
  if (savedStorage) Object.defineProperty(globalThis, "localStorage", savedStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
}
const corrected = structuredClone(catalog);
corrected.eventTiming = { ...corrected.eventTiming!, updatedAt: "2026-11-19T01:00:00Z", selectedVisionId: "gravity" };
assert.equal(sharedVisionId(corrected, "gravity", changeAt + 86_400_000), "gravity", "Una corrección publicada después puede reemplazar la programación.");
const noTiming = structuredClone(catalog);
delete noTiming.eventTiming;
assert.equal(sharedVisionId(noTiming, "gravity", changeAt), "resonance");
assert.equal(voiceSchedule(state.settings, changeAt - minute, previousCatalog).expiresAt, changeAt);
assert.equal(voiceSchedule(state.settings, changeAt, previousCatalog).enabled, false, "No debe quedar un aviso de Gravedad al rotar a una rueda sin horario publicado.");
assert.equal(voiceSchedule({ ...state.settings, voiceNotificationsEnabled: true, phase: "waiting", phaseStartedAt: new Date(changeAt - 25 * minute).toISOString(), waitMinutes: 30 }, changeAt - 1, previousCatalog).enabled, false, "Tampoco debe anunciar antes del cambio un evento de Gravedad que empezaría después.");
const newVoice = voiceSchedule({ ...updated.settings, voiceNotificationsEnabled: true, uiLanguage: "es" }, activeEnd, catalog);
assert.equal(newVoice.enabled, true);
assert.equal(newVoice.nextStartAt, activeEnd + 30 * minute);
assert.equal(newVoice.singularMessage, "Atención. Resonancia discordante comienza en 1 minuto.");
const resonance = catalog.visions.find(vision => vision.id === "resonance")!;
assert.equal(resonance.cycleConfirmed, true);
assert.equal(resonance.activities.length, 6);
assert(resonance.activities.every(activity => activity.points === 0 && !activity.enabled), "Los puntos aún no confirmados no pueden sumarse.");
for (const startsAt of ["malformed", "2026-11-18T23:00:00"]) {
  const bad = structuredClone(catalog);
  bad.visions.at(-1)!.startsAt = startsAt;
  assert.equal(validateCatalog(bad), false, "La fecha debe contener una zona horaria explícita.");
}
console.log("Rueda: cambio al mantenimiento, hora del juego, portal del Eco, avisos, carga sin conexión y puntos conservados.");
