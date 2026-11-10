import assert from "node:assert/strict";
import { recentConnectedDevices } from "../src/devicePresence.ts";
import catalog from "../catalog/visions.json" with { type: "json" };
import { BASELINE_BOX_POINTS, DEFAULT_CHARACTER_ID, VISION_CYCLE_WAIT_STARTED_AT, actionsForCharacter, actionsForTeamSession, activityHistorySummary, applyRemoteCatalog, boxStatistics, buildBreakdown, buildPointRoundBreakdown, computeCountdownTransition, computeCycle, computeGravityWhale, createInitialCharacterTracking, detachCharacterFromActions, formatCompactDuration, gameDayKey, overlayVisionName, parseManualBaseline, pointActionsInRound, resolveTransitionDelayMilliseconds, sharedEventTimingFromSettings, sharedVisionId, shouldShowGravityWhale, splitPlatformCarryover, validateCatalog, type ActivityHistoryRecord, type BoxRecord, type Catalog, type PersistedState, type PointAction, type Settings } from "../src/model.ts";
import { overlayDesignSize, whaleCounterLayoutWithinWindow, whaleCounterScaleWithinWindow, whaleScaleWithinWindow } from "../src/overlayGeometry.ts";
import { completeLocalSyncAddress, isValidLocalSyncAddress, joinLocalSyncAddress, localSyncTargetAddressSpace, splitLocalSyncAddress } from "../src/localSyncAddress.ts";
import { SHINY_MOD_CATALOG, SHINY_MOD_CATALOG_META, SHINY_MOD_GROUPS, matchesModSearch, normalizeModSearch } from "../src/shinyModsCatalog.ts";
import { initialState, mergePersonalSyncPayload, personalDurableHistoryCount, personalSyncPayload, recoverPersonalBackup } from "../src/storage.ts";

const freshState = { ...createInitialCharacterTracking(Date.parse("2026-09-11T00:00:00Z")), actions: [] as PointAction[] };
const presenceAt = Date.parse("2026-10-07T18:00:00Z");
assert.deepEqual(recentConnectedDevices(true, ["pc", "web", "mobile", "unknown", "web"], presenceAt, presenceAt + 29_999), ["pc", "web", "mobile"]);
assert.deepEqual(recentConnectedDevices(true, ["pc", "mobile"], presenceAt, presenceAt + 30_000), [], "La animación debe apagarse si no llega otro aviso de conexión reciente.");
assert.deepEqual(recentConnectedDevices(false, ["pc", "mobile"], presenceAt, presenceAt), [], "No mostrar conexión cuando la sincronización está apagada.");
assert.deepEqual(recentConnectedDevices(true, ["web"], 0, presenceAt), []);
assert.deepEqual(recentConnectedDevices(true, ["web"], presenceAt, presenceAt - 1), [], "Un cambio del reloj no debe conservar una conexión obsoleta.");
assert.deepEqual(recentConnectedDevices(true, ["mobile"], presenceAt, Number.NaN), []);
assert.deepEqual(recentConnectedDevices(true, ["pc", "web"], Date.now()), ["pc", "web"], "Una señal recién recibida debe seguir conectada aunque el reloj del contador aún no haya dado su siguiente tick.");
assert.equal(freshState.trackingMode, "solo", "La aplicación debe iniciar en Solitario.");
assert.equal(freshState.characters.length, 1);
assert.equal(actionsForTeamSession(freshState.actions, freshState.activeTeamSessionId).length, 0, "El conteo inicial de Equipo debe empezar en cero.");

const separatedAddress = splitLocalSyncAddress("192.168.137.24:47186");
assert.deepEqual(separatedAddress, { octets: ["192", "168", "137", "24"], port: "47186" });
assert.equal(joinLocalSyncAddress(separatedAddress), "192.168.137.24:47186");
assert.equal(completeLocalSyncAddress("http://10.0.0.8:47183/")?.address, "10.0.0.8:47183", "Pegar la dirección completa debe llenar todos los bloques.");
assert.equal(isValidLocalSyncAddress("172.20.10.2:47183"), true);
assert.equal(isValidLocalSyncAddress("192.168.1.999:47183"), false);
assert.equal(isValidLocalSyncAddress("192.168.1.20:70000"), false);
assert.equal(localSyncTargetAddressSpace("127.0.0.1:48183"), "loopback", "La página debe declarar explícitamente el acceso al puente del mismo PC.");
assert.equal(localSyncTargetAddressSpace("192.168.1.20:48183"), "local", "Una IP de la red debe solicitar acceso a la red local.");

assert.equal(validateCatalog(catalog), true, "El catálogo incluido debe ser válido.");
assert.equal(sharedVisionId(catalog), catalog.eventTiming.selectedVisionId, "La rueda pública debe ser la que eligió el administrador.");
assert.equal(catalog.visions.find((vision) => vision.id === sharedVisionId(catalog))?.enabled, true, "La rueda pública no puede estar desactivada.");
const invalidDisabledSelection = structuredClone(catalog);
invalidDisabledSelection.visions.find((vision) => vision.id === "lunar")!.enabled = true;
invalidDisabledSelection.visions.find((vision) => vision.id === invalidDisabledSelection.eventTiming.selectedVisionId)!.enabled = false;
assert.equal(validateCatalog(invalidDisabledSelection), false, "El administrador no puede publicar como actual una rueda desactivada.");
assert.equal(sharedVisionId(invalidDisabledSelection), "lunar", "Si una copia antigua apunta a una rueda desactivada debe usar la primera habilitada.");
for (const id of ["pro-monolith-boss", "pro-silo", "dream-manibus-challenge", "pro-war", "manibus-manibus", "dream-zone-invasion", "dreamer-light", "dreamer-deep", "dreamer-eternal"]) {
  assert.ok(catalog.proActivities.some((item) => item.id === id), `Falta la recompensa editable ${id}.`);
}
const calamityBosses = [
  { id: "calamity-tower", name: "Torre de calamidad", points: 3 },
  { id: "calamity-owl", name: "Búho de Calamidad", points: 1 },
  { id: "calamity-zone", name: "Zona de calamidad", points: 1 },
];
const calamityActions: PointAction[] = calamityBosses.flatMap((boss) => {
  const matches = catalog.proActivities.filter((item) => item.id === boss.id);
  assert.equal(matches.length, 1, `${boss.name} debe aparecer una sola vez en las actividades del mapa.`);
  const activity = matches[0];
  assert.equal(activity.name, boss.name);
  assert.equal(activity.points, boss.points, `${boss.name} debe sumar ${boss.points} puntos por recompensa.`);
  assert.equal(activity.enabled, true, `${boss.name} debe estar disponible para registrar.`);
  return Array.from({ length: 3 }, (_, index) => ({
    id: `${boss.id}-${index}`,
    activityId: activity.id,
    activityName: activity.name,
    points: activity.points,
    occurredAt: "2026-10-29T15:00:00.000Z",
  }));
});
assert.deepEqual(buildBreakdown(calamityActions).map(({ name, count, points }) => ({ name, count, points })), [
  { name: "Torre de calamidad", count: 3, points: 9 },
  { name: "Búho de Calamidad", count: 3, points: 3 },
  { name: "Zona de calamidad", count: 3, points: 3 },
], "Las actividades deben conservar contadores independientes y sumar el valor de cada recompensa.");
const previousBossCatalog = structuredClone(catalog) as Catalog;
previousBossCatalog.catalogVersion -= 1;
previousBossCatalog.proActivities = previousBossCatalog.proActivities.map((activity) => activity.id === "calamity-tower"
  ? { ...activity, name: "Torre de calamidad", points: 1 }
  : activity);
const priorTower = { ...calamityActions[0], activityName: "Torre de calamidad", points: 1 };
const existingBossState = { ...initialState(), catalog: previousBossCatalog, actions: [priorTower] };
const updatedBossState = applyRemoteCatalog(existingBossState, catalog as Catalog);
assert.ok(calamityBosses.every((boss) => updatedBossState.catalog.proActivities.some((activity) => activity.id === boss.id)));
assert.strictEqual(updatedBossState.actions, existingBossState.actions, "Actualizar los jefes no debe reemplazar los puntos existentes.");
assert.equal(updatedBossState.actions[0].points, 1);
assert.strictEqual(updatedBossState.activityHistory, existingBossState.activityHistory);
assert.strictEqual(updatedBossState.boxes, existingBossState.boxes);
for (const visionId of ["lunar", "gravity", "symbiosis"]) {
  assert.ok(catalog.visions.some((vision) => vision.id === visionId), `Falta la rueda editable ${visionId}.`);
}
assert.ok(catalog.boxTargetPoints >= 1 && catalog.boxTargetPoints <= 10_000);
assert.ok(catalog.proActivities.every((item) => item.points >= 0 && item.points <= 1_000));
assert.ok(catalog.visions.flatMap((vision) => vision.activities).every((item) => item.points >= 0 && item.points <= 1_000));

const settings: Settings = {
  uiLanguage: "es",
  selectedVisionId: "gravity",
  waitMinutes: 30,
  activeMinutes: 30,
  phase: "waiting",
  phaseStartedAt: "2026-09-10T10:00:00.000Z",
  overlayEnabled: true,
  overlayScale: 1,
  overlayAddonScale: 1,
  overlayWhaleEnabled: true,
  overlayWhaleShowTime: true,
  overlayWhaleCounterScale: 1,
  overlayWhaleCounterStyle: "digital",
  overlayShape: "event",
  overlayCounterStyle: "digital",
  overlayNameMode: "spanish",
  overlayCustomName: "",
  transitionDelayMilliseconds: 3_000,
  voiceNotificationsEnabled: true,
  voiceLeadMinutes: 5,
  timingPresetVersion: 4,
  autoStartEnabled: true,
  localSyncEnabled: false,
  localSyncLiveEnabled: false,
  localSyncAddress: "",
  localSyncCode: "",
  dataResetVersion: 1,
  sharedTimingUpdatedAt: "2026-09-10T21:52:30.000Z",
};
assert.deepEqual(computeCycle(settings, Date.parse("2026-09-10T10:15:00.000Z")).phase, "waiting");
assert.deepEqual(computeCycle(settings, Date.parse("2026-09-10T10:40:00.000Z")).phase, "active");
assert.deepEqual(computeCycle(settings, Date.parse("2026-09-10T11:10:00.000Z")).phase, "waiting");
const synchronizedSettings = { ...settings, phaseStartedAt: VISION_CYCLE_WAIT_STARTED_AT };
const synchronizedStart = computeCycle(synchronizedSettings, Date.parse(VISION_CYCLE_WAIT_STARTED_AT));
assert.equal(synchronizedStart.phase, "waiting");
assert.equal(synchronizedStart.remainingMs, 30 * 60_000);
const synchronizedSnapshot = computeCycle(synchronizedSettings, Date.parse(VISION_CYCLE_WAIT_STARTED_AT) + 3 * 60_000);
assert.equal(synchronizedSnapshot.phase, "waiting");
assert.equal(synchronizedSnapshot.remainingMs, 27 * 60_000);
assert.equal(computeCycle(synchronizedSettings, Date.parse(VISION_CYCLE_WAIT_STARTED_AT) + 30 * 60_000).phase, "active");
assert.equal(computeCycle(synchronizedSettings, Date.parse(VISION_CYCLE_WAIT_STARTED_AT) + 60 * 60_000).phase, "waiting");
const transitionStart = computeCountdownTransition(synchronizedSettings, Date.parse(VISION_CYCLE_WAIT_STARTED_AT) + 60 * 60_000);
assert.equal(transitionStart.active, true);
assert.equal(transitionStart.remainingMs, 3_000);
assert.equal(computeCountdownTransition(synchronizedSettings, Date.parse(VISION_CYCLE_WAIT_STARTED_AT) + 60 * 60_000 + 3_001).active, false);
assert.equal(resolveTransitionDelayMilliseconds({ transitionDelayMilliseconds: 2_750 }), 2_750);
assert.equal(resolveTransitionDelayMilliseconds({ transitionDelaySeconds: 2.75 }), 2_750, "Los catálogos anteriores deben migrar su retraso a milisegundos.");
const sharedTiming = sharedEventTimingFromSettings({ ...synchronizedSettings, transitionDelayMilliseconds: 2_750 }, "2026-09-12T12:00:00.000Z", "OscarD0823");
assert.deepEqual({ phase: sharedTiming.phase, phaseStartedAt: sharedTiming.phaseStartedAt, waitMinutes: sharedTiming.waitMinutes, activeMinutes: sharedTiming.activeMinutes, transitionDelayMilliseconds: sharedTiming.transitionDelayMilliseconds, transitionDelaySeconds: sharedTiming.transitionDelaySeconds }, { phase: "waiting", phaseStartedAt: VISION_CYCLE_WAIT_STARTED_AT, waitMinutes: 30, activeMinutes: 30, transitionDelayMilliseconds: 2_750, transitionDelaySeconds: 2.75 }, "La sincronización global debe incluir fase, ancla, duraciones y transición en milisegundos.");
assert.equal(computeCycle(synchronizedSettings, Date.parse(VISION_CYCLE_WAIT_STARTED_AT) + 60 * 60_000 + 3_001).remainingMs, 30 * 60_000 - 3_001, "El retraso visual no debe mover el ciclo real.");
assert.equal(computeCycle(synchronizedSettings, Date.parse(VISION_CYCLE_WAIT_STARTED_AT) + 24 * 60 * 60_000).phase, "waiting", "El ciclo absoluto debe avanzar aunque el PC haya estado apagado.");

const localState: PersistedState = {
  schemaVersion: 1,
  catalog: catalog as Catalog,
  actions: [],
  activityHistory: [],
  boxes: [],
  pointRounds: [],
  pointRoundBoundaries: {},
  manualBaselinePoints: [],
  shinyMods: [],
  ...createInitialCharacterTracking(Date.parse("2026-09-12T00:00:00Z")),
  settings: synchronizedSettings,
};
const newerCatalog = structuredClone(catalog) as Catalog;
newerCatalog.catalogVersion += 1;
newerCatalog.visions.find((vision) => vision.id === "lunar")!.enabled = true;
newerCatalog.eventTiming = {
  ...newerCatalog.eventTiming!,
  selectedVisionId: "lunar",
  waitMinutes: 42,
  activeMinutes: 18,
  transitionDelayMilliseconds: 4_321,
  transitionDelaySeconds: 4.321,
  phase: "active",
  phaseStartedAt: "2026-09-12T12:30:00.000Z",
  updatedAt: "2026-09-12T12:31:00.000Z",
};
const remotelyUpdated = applyRemoteCatalog(localState, newerCatalog);
assert.equal(remotelyUpdated.catalog.catalogVersion, newerCatalog.catalogVersion);
assert.deepEqual({
  selectedVisionId: remotelyUpdated.settings.selectedVisionId,
  waitMinutes: remotelyUpdated.settings.waitMinutes,
  activeMinutes: remotelyUpdated.settings.activeMinutes,
  transitionDelayMilliseconds: remotelyUpdated.settings.transitionDelayMilliseconds,
  phase: remotelyUpdated.settings.phase,
  phaseStartedAt: remotelyUpdated.settings.phaseStartedAt,
}, {
  selectedVisionId: "lunar",
  waitMinutes: 42,
  activeMinutes: 18,
  transitionDelayMilliseconds: 4_321,
  phase: "active",
  phaseStartedAt: "2026-09-12T12:30:00.000Z",
}, "Un cliente debe aplicar en un solo paso la rueda y todos los tiempos publicados por el administrador.");
const timingOnlyCatalog = structuredClone(newerCatalog) as Catalog;
timingOnlyCatalog.updatedAt = "2026-09-12T12:36:00.000Z";
timingOnlyCatalog.eventTiming = {
  ...timingOnlyCatalog.eventTiming!,
  waitMinutes: 55,
  activeMinutes: 25,
  transitionDelayMilliseconds: 850,
  transitionDelaySeconds: .85,
  updatedAt: "2026-09-12T12:36:00.000Z",
};
const timingOnlyUpdated = applyRemoteCatalog(remotelyUpdated, timingOnlyCatalog);
assert.equal(timingOnlyUpdated.settings.waitMinutes, 55);
assert.equal(timingOnlyUpdated.settings.activeMinutes, 25);
assert.equal(timingOnlyUpdated.settings.transitionDelayMilliseconds, 850);
assert.equal(timingOnlyUpdated.catalog.eventTiming?.waitMinutes, 55, "El catálogo visible y el contador deben conservar la misma configuración pública.");
const newerVersionWithOlderClock = structuredClone(timingOnlyCatalog) as Catalog;
newerVersionWithOlderClock.catalogVersion += 1;
newerVersionWithOlderClock.eventTiming = {
  ...newerVersionWithOlderClock.eventTiming!,
  waitMinutes: 61,
  activeMinutes: 29,
  transitionDelayMilliseconds: 1_275,
  transitionDelaySeconds: 1.275,
  updatedAt: "2026-09-12T11:00:00.000Z",
};
const authoritativeVersionUpdate = applyRemoteCatalog(timingOnlyUpdated, newerVersionWithOlderClock);
assert.equal(authoritativeVersionUpdate.settings.waitMinutes, 61);
assert.equal(authoritativeVersionUpdate.settings.activeMinutes, 29);
assert.equal(authoritativeVersionUpdate.settings.transitionDelayMilliseconds, 1_275, "Una versión pública superior debe aplicar los tiempos aunque el reloj del cliente tenga una fecha posterior.");
const staleCatalog = structuredClone(catalog) as Catalog;
staleCatalog.catalogVersion = Math.max(0, catalog.catalogVersion - 1);
assert.strictEqual(applyRemoteCatalog(remotelyUpdated, staleCatalog), remotelyUpdated, "Una respuesta antigua o cacheada no debe devolver el contador a una configuración anterior.");

for (const shape of ["event", "rectangle", "square", "vertical", "round"] as const) {
  for (const style of ["digital", "compact", "ring"] as const) {
    for (const requestedWhaleScale of [.2, .55, 1]) {
      for (const requestedCounterScale of [.2, .85, 1.5]) {
        const whaleScale = whaleScaleWithinWindow(requestedWhaleScale, shape);
        const counterScale = whaleCounterScaleWithinWindow(requestedCounterScale, shape, style);
        const layout = whaleCounterLayoutWithinWindow(whaleScale, counterScale, shape, style);
        const horizontalOverlap = layout.counterBounds.left < layout.bossBounds.right && layout.counterBounds.right > layout.bossBounds.left;
        const verticalOverlap = layout.counterBounds.top < layout.bossBounds.bottom && layout.counterBounds.bottom > layout.bossBounds.top;
        assert.equal(horizontalOverlap && verticalOverlap, false, `El reloj ${style} no debe tapar la Ballena en ${shape} (${requestedWhaleScale}/${requestedCounterScale}).`);
      }
    }
  }
}

const activityHistory: ActivityHistoryRecord[] = [
  { id: "a1", activityId: "platform", activityName: "Plataformas", points: 4, count: 1, occurredAt: "2026-09-19T12:59:59.000Z" },
  { id: "a2", activityId: "platform", activityName: "Plataformas", points: 12, count: 3, occurredAt: "2026-09-19T13:00:00.000Z" },
  { id: "a3", activityId: "forsaken", activityName: "Desamparado", points: 200, count: 200, occurredAt: "2026-09-19T14:00:00.000Z" },
];
assert.equal(gameDayKey("2026-09-19T12:59:59.000Z"), "2026-09-18", "Antes de las 8:00 a. m. de Colombia todavía debe ser el día de juego anterior.");
assert.equal(gameDayKey("2026-09-19T13:00:00.000Z"), "2026-09-19", "A las 8:00 a. m. de Colombia debe comenzar un nuevo día de juego.");
const dailyActivity = activityHistorySummary(activityHistory, new Date("2026-09-19T15:00:00.000Z"));
assert.equal(dailyActivity.today.count, 203, "El resumen diario debe usar el corte de las 8:00 a. m. de Colombia.");
assert.equal(dailyActivity.today.points, 212);
assert.equal(dailyActivity.totalCount, 204);
assert.equal(dailyActivity.days.find((day) => day.date === "2026-09-18")?.count, 1);
assert.equal(dailyActivity.ranking[0].name, "Desamparado", "El ranking histórico debe ordenar por cantidad completada.");
assert.equal(dailyActivity.ranking.find((item) => item.key === "pro:platform")?.todayCount, 3);

const beamLayout = whaleCounterLayoutWithinWindow(whaleScaleWithinWindow(1, "event"), whaleCounterScaleWithinWindow(1, "event", "beam"), "event", "beam");
assert.equal(beamLayout.stageHeight, Math.ceil((150 - 4) * whaleScaleWithinWindow(1, "event")), "El modo solo rayo no debe reservar un reloj separado.");
assert.ok(overlayDesignSize(true, "event", 1, 1, "digital", false).height < overlayDesignSize(true, "event", 1, 1, "digital", true).height, "Ocultar el tiempo debe retirar su espacio y dejar la Ballena con el rayo.");
assert.equal(shouldShowGravityWhale(synchronizedSettings, Date.parse(VISION_CYCLE_WAIT_STARTED_AT) + 44 * 60_000), false);
assert.equal(shouldShowGravityWhale(synchronizedSettings, Date.parse(VISION_CYCLE_WAIT_STARTED_AT) + 45 * 60_000), true);
assert.equal(shouldShowGravityWhale(synchronizedSettings, Date.parse(VISION_CYCLE_WAIT_STARTED_AT) + 65 * 60_000), true);
assert.equal(shouldShowGravityWhale(synchronizedSettings, Date.parse(VISION_CYCLE_WAIT_STARTED_AT) + 65 * 60_000 + 1), false);
const whaleArrival = computeGravityWhale(synchronizedSettings, Date.parse(VISION_CYCLE_WAIT_STARTED_AT) + 45 * 60_000);
assert.equal(whaleArrival.visible, true);
assert.equal(whaleArrival.remainingMs, 20 * 60_000, "El rayo debe comenzar con los 15 minutos restantes del evento más 5 minutos adicionales.");
assert.equal(computeGravityWhale(synchronizedSettings, Date.parse(VISION_CYCLE_WAIT_STARTED_AT) + 60 * 60_000).remainingMs, 5 * 60_000);
const whaleDeparture = computeGravityWhale(synchronizedSettings, Date.parse(VISION_CYCLE_WAIT_STARTED_AT) + 65 * 60_000);
assert.equal(whaleDeparture.departing, true);
assert.equal(computeGravityWhale(synchronizedSettings, Date.parse(VISION_CYCLE_WAIT_STARTED_AT) + 65 * 60_000 + 4_001).visible, false);
const gravityVision = catalog.visions.find((vision) => vision.id === "gravity");
assert.equal(overlayVisionName(gravityVision, "spanish"), "Abismo de Gravedad");
assert.equal(overlayVisionName(gravityVision, "english"), "Gravity Abyss");
assert.equal(overlayVisionName(gravityVision, "custom", "Mi rueda azul"), "Mi rueda azul");
assert.equal(overlayVisionName(gravityVision, "custom", "  "), "Abismo de Gravedad");
assert.equal(catalog.visions.find((vision) => vision.id === "lunar")?.name, "Lunar");
assert.equal(catalog.visions.find((vision) => vision.id === "lunar")?.englishName, "Lunar Revelry");
assert.equal(catalog.visions.find((vision) => vision.id === "symbiosis")?.englishName, "Aberrant Progeny");
assert.equal(formatCompactDuration(17 * 60_000 + 8_000), "17m 08s");

const actions: PointAction[] = [
  { id: "1", activityId: "gravity-whale", activityName: "Ballena", visionId: "gravity", visionName: "Gravedad", points: 1, occurredAt: "2026-09-10T10:00:00Z" },
  { id: "2", activityId: "gravity-platforms", activityName: "Plataformas", visionId: "gravity", visionName: "Gravedad", points: 4, occurredAt: "2026-09-10T10:05:00Z" },
  { id: "3", activityId: "gravity-platforms", activityName: "Plataformas", visionId: "gravity", visionName: "Gravedad", points: 4, occurredAt: "2026-09-10T10:10:00Z" },
];
assert.deepEqual(buildBreakdown(actions), [
  { name: "Gravedad · Plataformas", count: 2, points: 8 },
  { name: "Gravedad · Ballena", count: 1, points: 1 },
]);
assert.equal(actionsForCharacter(actions, DEFAULT_CHARACTER_ID).length, 3, "Los registros anteriores deben migrar al personaje principal.");
assert.deepEqual(pointActionsInRound(actions, "2026-09-10T10:00:00Z", "2026-09-10T10:05:00Z").map((action) => action.id), ["2"], "Una ronda nueva no debe repetir la acción del límite anterior ni incluir acciones posteriores a su cierre.");

const teamActions: PointAction[] = [
  { id: "team-1", activityId: "pro-silo", activityName: "Silo", points: 1, occurredAt: "2026-09-10T12:00:00Z", characterIds: ["alpha", "beta"], trackingMode: "team", teamSessionId: "session-a" },
  { id: "solo-alpha", activityId: "pro-war", activityName: "Guerra Pro", points: 2, occurredAt: "2026-09-10T12:05:00Z", characterIds: ["alpha"], trackingMode: "solo" },
];
assert.equal(actionsForCharacter(teamActions, "alpha").reduce((sum, action) => sum + action.points, 0), 3);
assert.equal(actionsForCharacter(teamActions, "beta").reduce((sum, action) => sum + action.points, 0), 1);
assert.equal(actionsForTeamSession(teamActions, "session-a").length, 1);
const afterAlphaBox = detachCharacterFromActions(teamActions, "alpha", new Set(["team-1", "solo-alpha"]));
assert.equal(actionsForCharacter(afterAlphaBox, "alpha").length, 0);
assert.equal(actionsForCharacter(afterAlphaBox, "beta").length, 1, "Cerrar la caja de un personaje no debe quitar puntos a sus compañeros.");
assert.equal(actionsForTeamSession(afterAlphaBox, "session-a").length, 1, "El conteo del equipo debe conservarse aunque un integrante cierre su caja.");

const synchronizedAction: PointAction = {
  id: "live-extra-point",
  activityId: "gravity-whale",
  activityName: "Ballena",
  visionId: "gravity",
  visionName: "Gravedad",
  points: 1,
  occurredAt: "2026-10-04T15:00:00.000Z",
  characterIds: [DEFAULT_CHARACTER_ID],
  trackingMode: "solo",
};
const liveBeforeUndo: PersistedState = {
  ...initialState(),
  actions: [synchronizedAction],
  activityHistory: [{
    id: synchronizedAction.id,
    activityId: synchronizedAction.activityId,
    activityName: synchronizedAction.activityName,
    visionId: synchronizedAction.visionId,
    visionName: synchronizedAction.visionName,
    points: synchronizedAction.points,
    count: 1,
    occurredAt: synchronizedAction.occurredAt,
  }],
};
const liveAfterUndo: PersistedState = {
  ...liveBeforeUndo,
  actions: [],
  activityHistory: [],
  deletedActionIds: [synchronizedAction.id],
};
const mergedUndo = mergePersonalSyncPayload(liveBeforeUndo, personalSyncPayload(liveAfterUndo), true);
assert.equal(mergedUndo.actions.length, 0, "Restar un punto en vivo debe quitarlo del intento compartido.");
assert.equal(mergedUndo.activityHistory.length, 0, "Restar un punto en vivo debe quitarlo también del resumen diario.");
const mergedWithStaleDevice = mergePersonalSyncPayload(mergedUndo, personalSyncPayload(liveBeforeUndo), true);
assert.equal(mergedWithStaleDevice.actions.length, 0, "Un dispositivo atrasado no debe restaurar un punto eliminado.");
assert.equal(mergedWithStaleDevice.activityHistory.length, 0, "Un dispositivo atrasado no debe restaurar el registro diario eliminado.");
assert.deepEqual(mergedWithStaleDevice.deletedActionIds, [synchronizedAction.id]);

const replacementAction = { ...synchronizedAction, id: "replacement-point", occurredAt: "2026-10-04T15:05:00.000Z" };
const startupRound = { id: "stale-auto-round", startedAt: synchronizedAction.occurredAt, endedAt: "2026-10-04T16:00:00.000Z", trigger: "event-start" as const, trackingMode: "solo" as const, characterId: DEFAULT_CHARACTER_ID, points: 1, claims: 1, actionIds: [synchronizedAction.id], breakdown: [] };
const staleStartup = { ...liveBeforeUndo, pointRounds: [startupRound] };
const sameSizeBackup = {
  ...liveAfterUndo,
  actions: [replacementAction],
  activityHistory: [{ ...liveBeforeUndo.activityHistory[0], id: replacementAction.id, occurredAt: replacementAction.occurredAt }],
  pointRounds: [{ ...startupRound, id: "saved-manual-round", trigger: "manual" as const, actionIds: [replacementAction.id] }],
};
assert.equal(personalDurableHistoryCount(staleStartup), personalDurableHistoryCount(sameSizeBackup));
const recoveredStartup = recoverPersonalBackup(staleStartup, personalSyncPayload(sameSizeBackup));
assert.deepEqual(recoveredStartup.actions.map((action) => action.id), [replacementAction.id], "Igual cantidad de registros no implica iguales datos: recuperar los IDs y las restas del respaldo.");
assert.deepEqual(recoveredStartup.pointRounds.map((round) => round.id), ["saved-manual-round"], "Conservar el guardado manual y quitar una ronda automática compuesta únicamente por acciones eliminadas.");
assert.deepEqual(recoverPersonalBackup(recoveredStartup, personalSyncPayload(sameSizeBackup)), recoveredStartup, "La recuperación al arrancar debe ser idempotente.");
const historicalDeletedRound = { ...startupRound, id: "saved-before-deletion" };
const backupWithHistoricalRound = { ...sameSizeBackup, pointRounds: [...sameSizeBackup.pointRounds, historicalDeletedRound] };
assert(recoverPersonalBackup(staleStartup, personalSyncPayload(backupWithHistoricalRound)).pointRounds.some((round) => round.id === historicalDeletedRound.id), "Las rondas ya existentes en el respaldo deben conservarse aunque posteriormente se haya restado su acción.");

const boxes: BoxRecord[] = [8, 12, 20].map((points, index) => ({ id: String(index), occurredAt: new Date().toISOString(), points, claims: points, breakdown: [] }));
const closedReward = { ...synchronizedAction, id: "closed-reward", points: 987 };
const currentReward = { ...replacementAction, id: "current-reward", points: 177 };
const attemptHistory = [closedReward, currentReward].map(action => ({ ...action, count: 1 }));
const legacyClosedBox: BoxRecord = { id: "closed-box", occurredAt: "2026-10-04T16:00:00Z", points: 987, claims: 1, breakdown: [] };
const nativeSavedAttempt = { ...initialState(), actions: [currentReward], activityHistory: attemptHistory, boxes: [legacyClosedBox] };
const staleAttemptCache = { ...nativeSavedAttempt, actions: [closedReward, currentReward] };
assert.equal(recoverPersonalBackup(staleAttemptCache, personalSyncPayload(nativeSavedAttempt)).actions.reduce((sum, action) => sum + action.points, 0), 177, "Equal history recovery must prefer the native post-box attempt, not add 987 closed points.");
const newerLocalReward = { ...currentReward, id: "new-local-reward", points: 4 };
const newerLocalAttempt = { ...nativeSavedAttempt, actions: [currentReward, newerLocalReward], activityHistory: [...attemptHistory, { ...newerLocalReward, count: 1 }] };
assert.equal(recoverPersonalBackup(newerLocalAttempt, personalSyncPayload(nativeSavedAttempt)).actions.reduce((sum, action) => sum + action.points, 0), 181, "A genuinely newer local reward must survive startup recovery.");
const closedBox = { ...legacyClosedBox, actionIds: [closedReward.id] };
const currentAttempt = { ...nativeSavedAttempt, boxes: [closedBox] };
const divergentPeer = { ...staleAttemptCache, actions: [closedReward, currentReward, newerLocalReward], activityHistory: [...attemptHistory, { ...newerLocalReward, count: 1 }], boxes: [legacyClosedBox] };
for (const [left, right] of [[currentAttempt, divergentPeer], [divergentPeer, currentAttempt]]) {
  const merged = mergePersonalSyncPayload(left, personalSyncPayload(right), true);
  assert.deepEqual(merged.actions.map(action => action.id).sort(), [currentReward.id, newerLocalReward.id].sort(), "Closed rewards must not revive even when a peer has newer independent history.");
  assert.equal(merged.activityHistory.length, 3);
  assert.deepEqual(merged.boxes[0].actionIds, [closedReward.id], "A legacy peer must not erase closure IDs.");
  assert.deepEqual(mergePersonalSyncPayload(merged, personalSyncPayload(divergentPeer), true), merged, "Repeated live exchanges must be idempotent.");
}
const sharedReward = { ...closedReward, characterIds: [DEFAULT_CHARACTER_ID, "alt"], trackingMode: "team" as const, teamSessionId: "shared" };
const sharedPeer = { ...currentAttempt, actions: [sharedReward], activityHistory: [{ ...sharedReward, count: 1 }], characters: [...currentAttempt.characters, { id: "alt", name: "Alt", createdAt: sharedReward.occurredAt }] };
const sharedMerged = mergePersonalSyncPayload(sharedPeer, personalSyncPayload(sharedPeer));
assert.deepEqual(sharedMerged.actions[0].characterIds, ["alt"], "Closing one character's box must retain another's points.");
const bothBoxes = { ...sharedPeer, boxes: [closedBox, { ...closedBox, id: "alt-box", characterId: "alt" }] };
const teamCompleted = mergePersonalSyncPayload(bothBoxes, personalSyncPayload(sharedPeer), true);
assert.deepEqual(teamCompleted.actions[0].characterIds, [], "Team rewards must remain in the team total after both personal boxes close.");
const statistics = boxStatistics(boxes, 5, []);
assert.equal(statistics.minimum, 8);
assert.equal(statistics.maximum, 20);
assert.equal(Number(statistics.average.toFixed(2)), 13.33);
assert.ok(statistics.perPointPercent > 0 && statistics.currentChancePercent > 0);

const baseline = boxStatistics([], 0);
assert.deepEqual(BASELINE_BOX_POINTS, []);
assert.equal(baseline.count, 0, "Una instalación nueva debe iniciar sin salidas precargadas.");
assert.equal(baseline.currentChancePercent, 0);

assert.deepEqual(parseManualBaseline("762, 966\n1143; no-valido 0 -4 10001"), [762, 966, 1_143]);
const extendedBaseline = boxStatistics([], 0, [...BASELINE_BOX_POINTS, 500]);
assert.equal(extendedBaseline.count, 1);
assert.equal(extendedBaseline.baselineCount, 1);

assert.deepEqual(buildPointRoundBreakdown(actions), [
  { activityId: "gravity-platforms", visionId: "gravity", name: "Gravedad · Plataformas", count: 2, points: 8 },
  { activityId: "gravity-whale", visionId: "gravity", name: "Gravedad · Ballena", count: 1, points: 1 },
]);

const platformActions: PointAction[] = [
  { id: "old", activityId: "pro-silo", activityName: "Silo", points: 1, occurredAt: "2026-09-10T10:00:00.000Z" },
  { id: "new-1", activityId: "gravity-platforms", activityName: "Plataformas", visionId: "gravity", visionName: "Gravedad", points: 4, occurredAt: "2026-09-10T10:10:00.000Z" },
  { id: "new-2", activityId: "gravity-whale", activityName: "Ballena", visionId: "gravity", visionName: "Gravedad", points: 1, occurredAt: "2026-09-10T10:30:00.000Z" },
];
const platformSplit = splitPlatformCarryover(platformActions, Date.parse("2026-09-10T11:05:00.000Z"), 60);
assert.deepEqual(platformSplit.completedAttempt.map((action) => action.id), ["old"]);
assert.deepEqual(platformSplit.carryOver.map((action) => action.id), ["new-1", "new-2"]);

assert.equal(SHINY_MOD_CATALOG.length, 1_618, "El catálogo debe contener los 1.618 registros del sistema actual.");
assert.deepEqual(SHINY_MOD_CATALOG_META, {
  sourceUrl: "https://wikily.gg/es-la/once-human/mods/",
  sourceCheckedAt: SHINY_MOD_CATALOG_META.sourceCheckedAt,
  total: 1_618,
  normal: 809,
  shiny: 809,
});
assert.equal(SHINY_MOD_CATALOG.filter((item) => item.system === "new" && !item.isCatalogShiny).length, 809);
assert.equal(SHINY_MOD_CATALOG.filter((item) => item.system === "new" && item.isCatalogShiny).length, 809);
assert.equal(new Set(SHINY_MOD_CATALOG.map((item) => item.id)).size, SHINY_MOD_CATALOG.length);
assert.ok(SHINY_MOD_GROUPS.filter((item) => item.category === "weapon").length >= 9);
const rushHourNormal = SHINY_MOD_CATALOG.find((item) => item.englishName === "Rush Hour <Downstar>" && !item.isCatalogShiny);
const rushHourShiny = SHINY_MOD_CATALOG.find((item) => item.englishName === "Rush Hour <Downstar>" && item.isCatalogShiny);
assert.equal(rushHourNormal?.name, "Hora punta <Estrella descendente>");
assert.equal(rushHourNormal?.variant, "Estrella Descendente");
assert.equal(rushHourNormal?.levelLabel, "Nivel 1–17");
assert.equal(rushHourShiny?.name, "Hora punta <Estrella descendente>");
assert.equal(rushHourShiny?.levelLabel, "Brillante");
assert.equal(SHINY_MOD_CATALOG.every((item) => item.levelLabel === (item.isCatalogShiny ? "Brillante" : "Nivel 1–17")), true);
assert.equal(matchesModSearch(rushHourNormal!, normalizeModSearch("19500542")), true);
assert.equal(matchesModSearch(rushHourNormal!, normalizeModSearch("hora punta estrella descendente")), true);
assert.equal(normalizeModSearch("Vórtice de escarcha"), "vortice de escarcha");

console.log(JSON.stringify({ catalog: "OK", sharedSync: "OK", overlayGeometry: "OK", cycle: "OK", points: "OK", statistics: "OK", baseline: "OK", platformCarryover: "OK", shinyMods: "OK" }));
