import assert from "node:assert/strict";
import { importState, initialState, loadOverlayPosition, loadState, personalSyncPayload, saveOverlayPosition } from "../src/storage.ts";
import type { Settings } from "../src/model.ts";

function checkRemovedSettings(settings: Settings) {
  assert.equal(Object.hasOwn(settings, "notificationsEnabled"), false);
  assert.equal(Object.hasOwn(settings, "lastNotificationPhaseStartedAt"), false);
}

checkRemovedSettings(initialState().settings);

const storageKey = "caja-fantasma.once-human.state.v1";
const backupKey = "caja-fantasma.once-human.safety-backup.v1";
const memory = new Map<string, string>();
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  },
});

try {
  saveOverlayPosition({ x: 10, y: 20 });
  saveOverlayPosition({ x: -120, y: 310 }, "pointer");
  assert.deepEqual(loadOverlayPosition(), { x: 10, y: 20 });
  assert.deepEqual(loadOverlayPosition("pointer"), { x: -120, y: 310 });

  for (const voiceEnabled of [true, false]) {
    const existing = initialState();
    const occurredAt = "2026-10-07T18:00:00.000Z";
    existing.actions = [{ id: "platform-claim", activityId: "gravity-platforms", activityName: "Plataformas", visionId: "gravity", visionName: "Gravedad", points: 4, occurredAt }];
    existing.activityHistory = [{ ...existing.actions[0], count: 1 }];
    existing.boxes = [{ id: "saved-box", points: 955, claims: 500, occurredAt, breakdown: [] }];
    existing.manualBaselinePoints = [704, 955];
    existing.deletedActionIds = ["removed-extra-point"];
    existing.settings.voiceNotificationsEnabled = voiceEnabled;
    existing.settings.voiceLeadMinutes = 8;
    existing.settings.lastVoiceAlertPhaseStartedAt = occurredAt;
    existing.settings.overlayEnabled = true;
    existing.settings.overlayScale = .5;
    existing.settings.pointer = { enabled: true, color: "#f0a002" };
    existing.settings.phoneSyncAddress = "192.168.1.20:47183";
    existing.settings.phoneSyncCode = "123456";
    const legacy = {
      ...existing,
      settings: { ...existing.settings, notificationsEnabled: true, lastNotificationPhaseStartedAt: occurredAt },
    };
    const text = JSON.stringify(legacy);
    memory.clear();
    memory.set(storageKey, text);

    for (const migrated of [loadState(), importState(text)]) {
      checkRemovedSettings(migrated.settings);
      assert.deepEqual(personalSyncPayload(migrated), personalSyncPayload(existing), "Removing Windows notifications must not change personal records.");
      assert.equal(migrated.settings.voiceNotificationsEnabled, voiceEnabled);
      assert.equal(migrated.settings.voiceLeadMinutes, 8);
      assert.equal(migrated.settings.lastVoiceAlertPhaseStartedAt, occurredAt);
      assert.equal(migrated.settings.overlayEnabled, true);
      assert.equal(migrated.settings.overlayScale, .5);
      assert.deepEqual(migrated.settings.pointer, existing.settings.pointer);
      assert.equal(migrated.settings.phoneSyncAddress, "192.168.1.20:47183");
      assert.equal(migrated.settings.phoneSyncCode, "123456");
      assert.equal(Object.hasOwn(personalSyncPayload(migrated), "settings"), false, "Connection details must remain device-local.");
    }

    memory.set(storageKey, "invalid JSON");
    memory.set(backupKey, text);
    const recovered = loadState();
    checkRemovedSettings(recovered.settings);
    assert.deepEqual(personalSyncPayload(recovered), personalSyncPayload(existing));
    assert.equal(recovered.settings.voiceNotificationsEnabled, voiceEnabled);
  }
  const old = initialState();
  delete old.settings.pointer;
  assert.deepEqual(importState(JSON.stringify(old)).settings.pointer, { enabled: false, color: "#54f1b9" });
  old.settings.pointer = { enabled: true, color: "invalid" };
  memory.set(storageKey, JSON.stringify(old));
  memory.delete(backupKey);
  assert.deepEqual(loadState().settings.pointer, { enabled: true, color: "#54f1b9" });
} finally {
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
}

console.log("Settings checks passed: Windows notification option removed; old backups, personal history, voice and overlay preserved.");
