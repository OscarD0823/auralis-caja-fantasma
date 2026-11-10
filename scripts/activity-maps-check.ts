import assert from "node:assert/strict";
import catalog from "../catalog/visions.json" with { type: "json" };
import { activitiesByMap, activityMapId } from "../src/activityMaps.ts";
import { activityRewardPoints, applyRemoteCatalog, REWARD_PHASES, type Activity, type Catalog } from "../src/model.ts";
import { initialState } from "../src/storage.ts";

const groups = activitiesByMap(catalog.proActivities as Activity[]);
assert.deepEqual(groups.find((map) => map.id === "general")!.activities.map((activity) => activity.id), ["pro-monolith-boss", "pro-silo"]);
assert.deepEqual(groups.find((map) => map.id === "abyss")!.activities.map((activity) => activity.id), ["calamity-tower", "calamity-owl", "calamity-zone", "sunken-lord"]);
const winter = groups.find((map) => map.id === "winter")!.activities;
assert.deepEqual(winter.map((activity) => activity.id), ["winter-chaosweaver"]);
assert.equal(activityRewardPoints(winter[0]), 1);
for (const [id, mapId] of [["manibus-lea", "manibus"], ["sunken-lord", "abyss"]]) {
  const boss = groups.find((map) => map.id === mapId)!.activities.find((activity) => activity.id === id)!;
  assert.equal(boss.phaseCount, 3);
  assert.deepEqual(REWARD_PHASES.map((phase) => activityRewardPoints(boss, phase)), [1, 2, 3]);
  assert.equal(activityRewardPoints(boss), 0, "A phase must be selected.");
  assert.equal(activityRewardPoints({ ...boss, enabled: false }, 3), 0);
}
assert.equal(activityRewardPoints(groups.find((map) => map.id === "manibus")!.activities.find((activity) => activity.id === "pro-war")!), 2);
assert.equal(groups.flatMap((map) => map.activities).length, catalog.proActivities.length);
assert.equal(new Set(groups.flatMap((map) => map.activities.map((activity) => activity.id))).size, catalog.proActivities.length, "Every reward must have exactly one counter.");
for (const id of ["manibus-event", "manibus-war", "dream-manibus-nightmare"]) {
  const activity = catalog.proActivities.find((activity) => activity.id === id)!;
  assert.equal(activity.points, 1);
  assert.equal(activity.enabled, true);
}
assert.equal(groups.find((map) => map.id === "dream")!.activities.length, 6);
// Catalogs already saved by older clients have no map metadata.
for (const activity of catalog.proActivities) {
  const { mapId: _mapId, ...legacy } = activity;
  assert.equal(activityMapId(legacy), activityMapId(activity));
}
const custom: Activity = { id: "custom-reward", name: "Nueva recompensa", points: 1, enabled: true };
assert.equal(activityMapId(custom), "general", "Unclassified rewards must remain reachable.");
assert.equal(activityMapId({ ...custom, mapId: "abyss" }), "abyss", "An editor-selected map must be honored.");
assert.equal(activityMapId({ ...custom, mapId: "future-map" as Activity["mapId"] }), "general");

const previous = initialState();
previous.catalog = structuredClone(catalog) as Catalog;
previous.catalog.catalogVersion--;
previous.actions = [{ id: "old-war", activityId: "pro-war", activityName: "Guerra Pro", points: 2, occurredAt: "2026-10-27T12:00:00.000Z" }];
previous.activityHistory = previous.actions.map((action) => ({ ...action, count: 1 }));
const personalFields = ["actions", "activityHistory", "boxes", "pointRounds", "shinyMods", "characters"] as const;
const updated = applyRemoteCatalog(previous, catalog as Catalog);
for (const field of personalFields) assert.strictEqual(updated[field], previous[field], `Grouping must not rewrite ${field}.`);
assert.equal(updated.actions[0].points, 2, "Previously claimed points retain their saved value.");
assert.deepEqual(updated.catalog.eventTiming, previous.catalog.eventTiming, "Map selection must not change the public wheel schedule.");
assert.notEqual(catalog.proActivities.find((activity) => activity.id === "manibus-war")!.id, previous.actions[0].activityId);
console.log("Mapas OK: agrupacion compatible, contadores independientes de 1 punto, recompensas sin clasificar accesibles e historial intacto.");
