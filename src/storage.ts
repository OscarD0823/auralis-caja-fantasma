import defaultCatalog from "../catalog/visions.json" with { type: "json" };
import type { ActivityHistoryRecord, BoxRecord, Catalog, CharacterProfile, OverlayCounterStyle, OverlayNameMode, OverlayShape, PersistedState, PointAction, PointRoundRecord, PointRoundTrigger, Settings, ShinyModRecord, WhaleCounterStyle } from "./model.ts";
import { VISION_CYCLE_WAIT_STARTED_AT, applyRemoteCatalog, clampNumber, createInitialCharacterTracking, removeBoxCompletedActions, resolveTransitionDelayMilliseconds, sharedVisionId, validateCatalog } from "./model.ts";
import { detectUiLanguage, restoredLanguage } from "./i18n.ts";

export const STORAGE_KEY = "caja-fantasma.once-human.state.v1";
const SAFETY_BACKUP_KEY = "caja-fantasma.once-human.safety-backup.v1";
const OVERLAY_POSITION_KEYS = {
  overlay: "caja-fantasma.once-human.overlay-position.v1",
  pointer: "caja-fantasma.once-human.pointer-position.v1",
};
const PERSONAL_SYNC_UPDATED_AT_KEY = "caja-fantasma.once-human.personal-sync-updated-at.v1";
export const PERSONAL_SYNC_INITIAL_DATE = "1970-01-01T00:00:00.000Z";
const CURRENT_DATA_RESET_VERSION = 2;
const OVERLAY_SHAPES = new Set<OverlayShape>(["event", "rectangle", "square", "vertical", "round"]);
const OVERLAY_COUNTER_STYLES = new Set<OverlayCounterStyle>(["digital", "compact", "ring"]);
const WHALE_COUNTER_STYLES = new Set<WhaleCounterStyle>(["digital", "compact", "ring", "beam"]);
const OVERLAY_NAME_MODES = new Set<OverlayNameMode>(["spanish", "english", "custom"]);
const POINT_ROUND_TRIGGERS = new Set<PointRoundTrigger>(["event-start", "manual", "whale-end"]);
const PERSONAL_HISTORY_ARRAY_FIELDS = ["actions", "activityHistory", "boxes", "pointRounds", "manualBaselinePoints", "shinyMods"] as const;
const PERSONAL_DURABLE_HISTORY_ARRAY_FIELDS = ["activityHistory", "boxes", "pointRounds", "manualBaselinePoints", "shinyMods"] as const;
const MAX_DELETED_ACTION_IDS = 20_000;

function withoutDesktopNotificationSettings<T extends Partial<Settings>>(settings: T): T {
  const cleaned = { ...settings } as T & {
    notificationsEnabled?: unknown;
    lastNotificationPhaseStartedAt?: unknown;
  };
  // Old backups remain compatible, without restoring the removed Windows option.
  delete cleaned.notificationsEnabled;
  delete cleaned.lastNotificationPhaseStartedAt;
  return cleaned;
}

export function personalHistoryCount(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const record = value as Record<string, unknown>;
  return PERSONAL_HISTORY_ARRAY_FIELDS.reduce((sum, field) => sum + (Array.isArray(record[field]) ? record[field].length : 0), 0);
}

export function personalDurableHistoryCount(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const record = value as Record<string, unknown>;
  return PERSONAL_DURABLE_HISTORY_ARRAY_FIELDS.reduce((sum, field) => sum + (Array.isArray(record[field]) ? record[field].length : 0), 0);
}

export function hasIntentionalActionDeletions(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Array.isArray((value as Record<string, unknown>).deletedActionIds)
    && ((value as Record<string, unknown>).deletedActionIds as unknown[]).length > 0;
}

export type OverlayPosition = { x: number; y: number };
export type PositionedOverlay = keyof typeof OVERLAY_POSITION_KEYS;

export function pointerSettings(value?: Settings["pointer"]): NonNullable<Settings["pointer"]> {
  return {
    enabled: value?.enabled === true,
    color: typeof value?.color === "string" && /^#[a-f\d]{6}$/i.test(value.color) ? value.color : "#54f1b9",
  };
}

function parseStoredState(text: string): Partial<PersistedState> | null {
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Partial<PersistedState> : null;
  } catch {
    return null;
  }
}

function sanitizeShinyMods(value: unknown): ShinyModRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Partial<ShinyModRecord>;
    if (typeof candidate.id !== "string" || typeof candidate.modName !== "string" || typeof candidate.groupName !== "string" || typeof candidate.variant !== "string") return [];
    return [{
      id: candidate.id,
      catalogId: typeof candidate.catalogId === "string" ? candidate.catalogId : undefined,
      modName: candidate.modName,
      englishName: typeof candidate.englishName === "string" ? candidate.englishName : undefined,
      groupName: candidate.groupName,
      variant: candidate.variant,
      attempts: Math.min(100_000, Math.max(0, Math.floor(Number(candidate.attempts) || 0))),
      isShiny: candidate.isShiny === true,
      createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString(),
      obtainedAt: typeof candidate.obtainedAt === "string" ? candidate.obtainedAt : undefined,
    }];
  }).slice(0, 5_000);
}

function sanitizeActivityHistory(value: unknown): ActivityHistoryRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Partial<ActivityHistoryRecord>;
    const occurredAt = typeof candidate.occurredAt === "string" && Number.isFinite(Date.parse(candidate.occurredAt)) ? candidate.occurredAt : "";
    if (typeof candidate.id !== "string" || typeof candidate.activityId !== "string" || typeof candidate.activityName !== "string" || !occurredAt) return [];
    return [{
      id: candidate.id.slice(0, 160),
      activityId: candidate.activityId.slice(0, 100),
      activityName: candidate.activityName.slice(0, 120),
      visionId: typeof candidate.visionId === "string" ? candidate.visionId.slice(0, 100) : undefined,
      visionName: typeof candidate.visionName === "string" ? candidate.visionName.slice(0, 120) : undefined,
      points: Math.max(0, Math.min(1_000_000, Math.round(Number(candidate.points) || 0))),
      count: Math.max(1, Math.min(100_000, Math.round(Number(candidate.count) || 1))),
      occurredAt,
    }];
  }).slice(-100_000);
}

function sanitizeDeletedActionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((entry) => {
    if (typeof entry !== "string") return [];
    const id = entry.trim().slice(0, 160);
    return id ? [id] : [];
  }))].slice(-MAX_DELETED_ACTION_IDS);
}

function activityRecordFromAction(action: PointAction): ActivityHistoryRecord {
  return {
    id: action.id,
    activityId: action.activityId,
    activityName: action.activityName,
    visionId: action.visionId,
    visionName: action.visionName,
    points: action.points,
    count: 1,
    occurredAt: action.occurredAt,
  };
}

function legacyActivityHistory(actions: PointAction[], boxes: BoxRecord[], catalog: Catalog) {
  const knownActivities: Array<{ activity: Catalog["proActivities"][number]; vision?: Catalog["visions"][number]; fullName: string }> = [
    ...catalog.proActivities.map((activity) => ({ activity, fullName: activity.name })),
    ...catalog.visions.flatMap((vision) => vision.activities.map((activity) => ({ activity, vision, fullName: `${vision.name} · ${activity.name}` }))),
  ];
  const records: ActivityHistoryRecord[] = actions.map(activityRecordFromAction);
  for (const box of boxes) {
    box.breakdown.forEach((item, index) => {
      const known = knownActivities.find((candidate) => candidate.fullName === item.name);
      const separator = item.name.lastIndexOf(" · ");
      records.push({
        id: `legacy-${box.id}-${index}`,
        activityId: known?.activity.id ?? `legacy-${index}-${item.name.toLocaleLowerCase("es").replace(/[^a-z0-9]+/g, "-").slice(0, 70)}`,
        activityName: known?.activity.name ?? (separator >= 0 ? item.name.slice(separator + 3) : item.name),
        visionId: known?.vision?.id,
        visionName: known?.vision?.name ?? (separator >= 0 ? item.name.slice(0, separator) : undefined),
        points: Math.max(0, Math.round(item.points)),
        count: Math.max(1, Math.round(item.count)),
        occurredAt: box.occurredAt,
      });
    });
  }
  return sanitizeActivityHistory(records);
}

function sanitizeCharacters(value: unknown, fallback: CharacterProfile[]) {
  if (!Array.isArray(value)) return fallback;
  const usedIds = new Set<string>();
  const characters = value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Partial<CharacterProfile>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const name = typeof candidate.name === "string" ? candidate.name.trim().slice(0, 40) : "";
    if (!id || !name || usedIds.has(id)) return [];
    usedIds.add(id);
    return [{ id, name, createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date().toISOString() }];
  }).slice(0, 12);
  return characters.length > 0 ? characters : fallback;
}

function sanitizePointRounds(value: unknown): PointRoundRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Partial<PointRoundRecord>;
    const startedAt = typeof candidate.startedAt === "string" && Number.isFinite(Date.parse(candidate.startedAt)) ? candidate.startedAt : "";
    const endedAt = typeof candidate.endedAt === "string" && Number.isFinite(Date.parse(candidate.endedAt)) ? candidate.endedAt : "";
    if (typeof candidate.id !== "string" || !startedAt || !endedAt || !POINT_ROUND_TRIGGERS.has(candidate.trigger as PointRoundTrigger) || (candidate.trackingMode !== "solo" && candidate.trackingMode !== "team")) return [];
    const points = Math.max(0, Math.min(1_000_000, Math.round(Number(candidate.points) || 0)));
    const claims = Math.max(0, Math.min(100_000, Math.round(Number(candidate.claims) || 0)));
    return [{
      id: candidate.id,
      startedAt,
      endedAt,
      trigger: candidate.trigger as PointRoundTrigger,
      points,
      claims,
      actionIds: Array.isArray(candidate.actionIds) ? candidate.actionIds.filter((id): id is string => typeof id === "string").slice(0, 100_000) : [],
      visionId: typeof candidate.visionId === "string" ? candidate.visionId : undefined,
      visionName: typeof candidate.visionName === "string" ? candidate.visionName.slice(0, 80) : undefined,
      trackingMode: candidate.trackingMode,
      characterId: typeof candidate.characterId === "string" ? candidate.characterId : undefined,
      characterName: typeof candidate.characterName === "string" ? candidate.characterName.slice(0, 40) : undefined,
      teamSessionId: typeof candidate.teamSessionId === "string" ? candidate.teamSessionId : undefined,
      characterIds: Array.isArray(candidate.characterIds) ? candidate.characterIds.filter((id): id is string => typeof id === "string").slice(0, 12) : undefined,
      breakdown: Array.isArray(candidate.breakdown) ? candidate.breakdown.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const detail = item as { name?: unknown; count?: unknown; points?: unknown };
        if (typeof detail.name !== "string") return [];
        return [{
          activityId: typeof (detail as { activityId?: unknown }).activityId === "string" ? (detail as { activityId: string }).activityId.slice(0, 100) : undefined,
          visionId: typeof (detail as { visionId?: unknown }).visionId === "string" ? (detail as { visionId: string }).visionId.slice(0, 100) : undefined,
          name: detail.name.slice(0, 120),
          count: Math.max(0, Math.round(Number(detail.count) || 0)),
          points: Math.max(0, Math.round(Number(detail.points) || 0)),
        }];
      }).slice(0, 200) : [],
    }];
  }).slice(0, 2_000);
}

function sanitizePointRoundBoundaries(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, boundary]) => {
    if (!key.slice(0, 80) || typeof boundary !== "string" || !Number.isFinite(Date.parse(boundary))) return [];
    return [[key.slice(0, 80), boundary]];
  }).slice(0, 100));
}

function characterState(parsed: Partial<PersistedState>, fallback: PersistedState) {
  const characters = sanitizeCharacters(parsed.characters, fallback.characters);
  const characterIds = new Set(characters.map((character) => character.id));
  const activeCharacterId = typeof parsed.activeCharacterId === "string" && characterIds.has(parsed.activeCharacterId) ? parsed.activeCharacterId : characters[0].id;
  const teamMemberIds = Array.isArray(parsed.teamMemberIds)
    ? [...new Set(parsed.teamMemberIds.filter((id): id is string => typeof id === "string" && characterIds.has(id)))]
    : characters.map((character) => character.id);
  return {
    characters,
    activeCharacterId,
    teamMemberIds,
    trackingMode: "solo" as const,
    activeTeamSessionId: typeof parsed.activeTeamSessionId === "string" && parsed.activeTeamSessionId ? parsed.activeTeamSessionId : `team-${Date.now().toString(36)}`,
  };
}

export function initialState(): PersistedState {
  return {
    schemaVersion: 1,
    catalog: defaultCatalog as Catalog,
    actions: [],
    deletedActionIds: [],
    activityHistory: [],
    boxes: [],
    pointRounds: [],
    pointRoundBoundaries: {},
    manualBaselinePoints: [],
    shinyMods: [],
    ...createInitialCharacterTracking(),
    settings: {
      uiLanguage: detectUiLanguage(),
      uiLanguageMode: "auto",
      selectedVisionId: sharedVisionId(defaultCatalog as Catalog),
      waitMinutes: 30,
      activeMinutes: 30,
      phaseStartedAt: VISION_CYCLE_WAIT_STARTED_AT,
      phase: "waiting",
      overlayEnabled: false,
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
      pointer: pointerSettings(),
      transitionDelayMilliseconds: 3_000,
      voiceNotificationsEnabled: true,
      voiceLeadMinutes: 5,
      timingPresetVersion: 4,
      autoStartEnabled: true,
      localSyncEnabled: false,
      localSyncLiveEnabled: false,
      localSyncAddress: "",
      localSyncCode: "",
      phoneSyncAddress: "",
      phoneSyncCode: "",
      sharedTimingUpdatedAt: (defaultCatalog as Catalog).eventTiming?.updatedAt,
      dataResetVersion: CURRENT_DATA_RESET_VERSION,
    },
  };
}

export function loadState(): PersistedState {
  try {
    const storedText = localStorage.getItem(STORAGE_KEY) ?? "null";
    const backupText = localStorage.getItem(SAFETY_BACKUP_KEY) ?? "null";
    let parsed = parseStoredState(storedText);
    const backup = parseStoredState(backupText);
    const parsedIsValid = parsed?.schemaVersion === 1 && validateCatalog(parsed.catalog);
    const backupIsValid = backup?.schemaVersion === 1 && validateCatalog(backup.catalog);
    const shouldRecoverEmptyState = parsedIsValid
      && backupIsValid
      && personalHistoryCount(parsed) === 0
      && !hasIntentionalActionDeletions(parsed)
      && personalHistoryCount(backup) > 0;
    if ((!parsedIsValid || shouldRecoverEmptyState) && backupIsValid) {
      parsed = backup;
      localStorage.setItem(STORAGE_KEY, backupText);
    }
    if (!parsed || parsed.schemaVersion !== 1 || !validateCatalog(parsed.catalog)) return initialState();
    const fresh = initialState();
    const settings = withoutDesktopNotificationSettings({ ...fresh.settings, ...(parsed.settings ?? {}) });
    Object.assign(settings, restoredLanguage(parsed.settings));
    if ((parsed.settings?.timingPresetVersion ?? 0) < 4) {
      const timing = fresh.catalog.eventTiming;
      settings.selectedVisionId = timing?.selectedVisionId ?? "gravity";
      settings.waitMinutes = timing?.waitMinutes ?? 30;
      settings.activeMinutes = timing?.activeMinutes ?? 30;
      settings.phase = timing?.phase ?? "waiting";
      settings.phaseStartedAt = timing?.phaseStartedAt ?? VISION_CYCLE_WAIT_STARTED_AT;
      settings.lastVoiceAlertPhaseStartedAt = undefined;
      settings.sharedTimingUpdatedAt = timing?.updatedAt;
      settings.timingPresetVersion = 4;
    }
    const previousResetVersion = parsed.settings?.dataResetVersion ?? 0;
    const mustClearPreviousRecords = previousResetVersion < 1;
    const mustClearBoxHistory = previousResetVersion < CURRENT_DATA_RESET_VERSION;
    settings.dataResetVersion = CURRENT_DATA_RESET_VERSION;
    const catalog = parsed.catalog.catalogVersion >= fresh.catalog.catalogVersion ? parsed.catalog : fresh.catalog;
    settings.selectedVisionId = sharedVisionId(catalog, settings.selectedVisionId);
    settings.overlayScale = clampNumber(Number(settings.overlayScale) || 1, .2, 1.5);
    settings.overlayAddonScale = clampNumber(Number(settings.overlayAddonScale) || 1, .2, 1);
    settings.overlayWhaleEnabled = settings.overlayWhaleEnabled !== false;
    settings.overlayWhaleShowTime = settings.overlayWhaleShowTime !== false;
    settings.overlayWhaleCounterScale = clampNumber(Number(settings.overlayWhaleCounterScale) || 1, .2, 1.5);
    settings.overlayWhaleCounterStyle = WHALE_COUNTER_STYLES.has(settings.overlayWhaleCounterStyle) ? settings.overlayWhaleCounterStyle : "digital";
    settings.overlayShape = OVERLAY_SHAPES.has(settings.overlayShape) ? settings.overlayShape : "event";
    settings.overlayCounterStyle = OVERLAY_COUNTER_STYLES.has(settings.overlayCounterStyle) ? settings.overlayCounterStyle : "digital";
    settings.overlayNameMode = OVERLAY_NAME_MODES.has(settings.overlayNameMode) ? settings.overlayNameMode : "spanish";
    settings.overlayCustomName = typeof settings.overlayCustomName === "string" ? settings.overlayCustomName.trim().slice(0, 40) : "";
    settings.pointer = pointerSettings(parsed.settings?.pointer);
    settings.localSyncEnabled = settings.localSyncEnabled === true;
    settings.localSyncLiveEnabled = settings.localSyncLiveEnabled === true;
    settings.localSyncAddress = typeof settings.localSyncAddress === "string" ? settings.localSyncAddress.trim().slice(0, 80) : "";
    settings.localSyncCode = typeof settings.localSyncCode === "string" && /^\d{6}$/.test(settings.localSyncCode) ? settings.localSyncCode : "";
    settings.phoneSyncAddress = typeof settings.phoneSyncAddress === "string" ? settings.phoneSyncAddress.trim().slice(0, 80) : "";
    settings.phoneSyncCode = typeof settings.phoneSyncCode === "string" && /^\d{6}$/.test(settings.phoneSyncCode) ? settings.phoneSyncCode : "";
    settings.transitionDelayMilliseconds = resolveTransitionDelayMilliseconds(parsed.settings, fresh.settings.transitionDelayMilliseconds);
    const characters = characterState(parsed, fresh);
    const deletedActionIds = mustClearPreviousRecords ? [] : sanitizeDeletedActionIds(parsed.deletedActionIds);
    const deletedActionIdSet = new Set(deletedActionIds);
    const actions = (mustClearPreviousRecords ? [] : Array.isArray(parsed.actions) ? parsed.actions : [])
      .filter((action) => !deletedActionIdSet.has(action.id));
    const boxes = mustClearBoxHistory ? [] : Array.isArray(parsed.boxes) ? parsed.boxes : [];
    const loadedState: PersistedState = {
      ...fresh,
      ...parsed,
      catalog,
      actions: removeBoxCompletedActions(actions, boxes),
      deletedActionIds,
      activityHistory: (mustClearPreviousRecords ? [] : Array.isArray(parsed.activityHistory) ? sanitizeActivityHistory(parsed.activityHistory) : legacyActivityHistory(actions, boxes, catalog))
        .filter((record) => !deletedActionIdSet.has(record.id)),
      boxes,
      pointRounds: mustClearPreviousRecords ? [] : sanitizePointRounds(parsed.pointRounds),
      pointRoundBoundaries: mustClearPreviousRecords ? {} : sanitizePointRoundBoundaries(parsed.pointRoundBoundaries),
      manualBaselinePoints: mustClearPreviousRecords ? [] : Array.isArray(parsed.manualBaselinePoints)
        ? parsed.manualBaselinePoints.filter((value) => Number.isFinite(value) && value > 0 && value <= 10_000).map(Math.round).slice(0, 500)
        : [],
      shinyMods: mustClearPreviousRecords ? [] : sanitizeShinyMods(parsed.shinyMods),
      ...characters,
      settings,
    };
    return applyRemoteCatalog(loadedState, catalog);
  } catch {
    return initialState();
  }
}

export function saveState(state: PersistedState) {
  const nextText = JSON.stringify(state);
  try {
    const previousText = localStorage.getItem(STORAGE_KEY);
    const backupText = localStorage.getItem(SAFETY_BACKUP_KEY);
    const previous = previousText ? JSON.parse(previousText) as unknown : null;
    const backup = backupText ? JSON.parse(backupText) as unknown : null;
    const previousCount = personalDurableHistoryCount(previous);
    const nextCount = personalDurableHistoryCount(state);
    const backupCount = personalDurableHistoryCount(backup);
    if (previousText && previousCount > nextCount && previousCount >= backupCount) {
      localStorage.setItem(SAFETY_BACKUP_KEY, previousText);
    } else if (nextCount > 0 && nextCount >= backupCount) {
      localStorage.setItem(SAFETY_BACKUP_KEY, nextText);
    }
  } catch {
    // Un respaldo anterior dañado nunca debe impedir que se guarde el estado actual.
  }
  localStorage.setItem(STORAGE_KEY, nextText);
  window.dispatchEvent(new CustomEvent("caja-fantasma-state", { detail: state }));
}

export function loadOverlayPosition(overlay: PositionedOverlay = "overlay"): OverlayPosition | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(OVERLAY_POSITION_KEYS[overlay]) ?? "null") as Partial<OverlayPosition> | null;
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return undefined;
    if (Math.abs(value.x!) > 100_000 || Math.abs(value.y!) > 100_000) return undefined;
    return { x: Math.round(value.x!), y: Math.round(value.y!) };
  } catch {
    return undefined;
  }
}

export function saveOverlayPosition(position: OverlayPosition, overlay: PositionedOverlay = "overlay") {
  if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) return;
  localStorage.setItem(OVERLAY_POSITION_KEYS[overlay], JSON.stringify({ x: Math.round(position.x), y: Math.round(position.y) }));
}

export function exportState(state: PersistedState) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `caja-fantasma-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function importState(text: string): PersistedState {
  const parsed = JSON.parse(text) as Partial<PersistedState>;
  if (parsed.schemaVersion !== 1 || !validateCatalog(parsed.catalog) || !Array.isArray(parsed.actions) || !Array.isArray(parsed.boxes)) {
    throw new Error("El archivo no es un respaldo válido de Caja Fantasma.");
  }
  const fresh = initialState();
  const characters = characterState(parsed, fresh);
  const catalog = parsed.catalog as Catalog;
  const deletedActionIds = sanitizeDeletedActionIds(parsed.deletedActionIds);
  const deletedActionIdSet = new Set(deletedActionIds);
  return {
    ...fresh,
    ...parsed,
    actions: removeBoxCompletedActions(parsed.actions.filter((action) => !deletedActionIdSet.has(action.id)), parsed.boxes),
    deletedActionIds,
    activityHistory: (Array.isArray(parsed.activityHistory) ? sanitizeActivityHistory(parsed.activityHistory) : legacyActivityHistory(parsed.actions, parsed.boxes, catalog))
      .filter((record) => !deletedActionIdSet.has(record.id)),
    boxes: parsed.boxes,
    pointRounds: sanitizePointRounds(parsed.pointRounds),
    pointRoundBoundaries: sanitizePointRoundBoundaries(parsed.pointRoundBoundaries),
    manualBaselinePoints: Array.isArray(parsed.manualBaselinePoints)
      ? parsed.manualBaselinePoints.filter((value) => Number.isFinite(value) && value > 0 && value <= 10_000).map(Math.round).slice(0, 500)
      : [],
    shinyMods: sanitizeShinyMods(parsed.shinyMods),
    ...characters,
    settings: {
      ...fresh.settings,
      ...withoutDesktopNotificationSettings(parsed.settings ?? {}),
      ...restoredLanguage(parsed.settings),
      selectedVisionId: sharedVisionId(catalog),
      overlayScale: clampNumber(Number(parsed.settings?.overlayScale) || 1, .2, 1.5),
      overlayAddonScale: clampNumber(Number(parsed.settings?.overlayAddonScale) || 1, .2, 1),
      overlayWhaleEnabled: parsed.settings?.overlayWhaleEnabled !== false,
      overlayWhaleShowTime: parsed.settings?.overlayWhaleShowTime !== false,
      overlayWhaleCounterScale: clampNumber(Number(parsed.settings?.overlayWhaleCounterScale) || 1, .2, 1.5),
      overlayWhaleCounterStyle: WHALE_COUNTER_STYLES.has(parsed.settings?.overlayWhaleCounterStyle as WhaleCounterStyle) ? parsed.settings!.overlayWhaleCounterStyle! : "digital",
      overlayShape: OVERLAY_SHAPES.has(parsed.settings?.overlayShape as OverlayShape) ? parsed.settings!.overlayShape! : "event",
      overlayCounterStyle: OVERLAY_COUNTER_STYLES.has(parsed.settings?.overlayCounterStyle as OverlayCounterStyle) ? parsed.settings!.overlayCounterStyle! : "digital",
      overlayNameMode: OVERLAY_NAME_MODES.has(parsed.settings?.overlayNameMode as OverlayNameMode) ? parsed.settings!.overlayNameMode! : "spanish",
      overlayCustomName: typeof parsed.settings?.overlayCustomName === "string" ? parsed.settings.overlayCustomName.trim().slice(0, 40) : "",
      pointer: pointerSettings(parsed.settings?.pointer),
      localSyncEnabled: parsed.settings?.localSyncEnabled === true,
      localSyncLiveEnabled: parsed.settings?.localSyncLiveEnabled === true,
      localSyncAddress: typeof parsed.settings?.localSyncAddress === "string" ? parsed.settings.localSyncAddress.trim().slice(0, 80) : "",
      localSyncCode: typeof parsed.settings?.localSyncCode === "string" && /^\d{6}$/.test(parsed.settings.localSyncCode) ? parsed.settings.localSyncCode : "",
      phoneSyncAddress: typeof parsed.settings?.phoneSyncAddress === "string" ? parsed.settings.phoneSyncAddress.trim().slice(0, 80) : "",
      phoneSyncCode: typeof parsed.settings?.phoneSyncCode === "string" && /^\d{6}$/.test(parsed.settings.phoneSyncCode) ? parsed.settings.phoneSyncCode : "",
      transitionDelayMilliseconds: resolveTransitionDelayMilliseconds(parsed.settings, fresh.settings.transitionDelayMilliseconds),
      dataResetVersion: CURRENT_DATA_RESET_VERSION,
    },
  };
}

export type PersonalSyncPayload = Pick<PersistedState,
  | "actions"
  | "deletedActionIds"
  | "activityHistory"
  | "boxes"
  | "pointRounds"
  | "pointRoundBoundaries"
  | "manualBaselinePoints"
  | "shinyMods"
  | "characters"
  | "activeCharacterId"
  | "trackingMode"
  | "teamMemberIds"
  | "activeTeamSessionId"
>;

export function personalSyncPayload(state: PersistedState): PersonalSyncPayload {
  return {
    actions: state.actions,
    deletedActionIds: state.deletedActionIds,
    activityHistory: state.activityHistory,
    boxes: state.boxes,
    pointRounds: state.pointRounds,
    pointRoundBoundaries: state.pointRoundBoundaries,
    manualBaselinePoints: state.manualBaselinePoints,
    shinyMods: state.shinyMods,
    characters: state.characters,
    activeCharacterId: state.activeCharacterId,
    trackingMode: state.trackingMode,
    teamMemberIds: state.teamMemberIds,
    activeTeamSessionId: state.activeTeamSessionId,
  };
}

export function applyPersonalSyncPayload(current: PersistedState, value: unknown): PersistedState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("El PC devolvió datos personales inválidos.");
  const imported = importState(JSON.stringify({
    ...current,
    ...(value as Partial<PersonalSyncPayload>),
    schemaVersion: 1,
    catalog: current.catalog,
    settings: current.settings,
  }));
  return {
    ...current,
    ...personalSyncPayload(imported),
  };
}

function mergeRecordsById<T extends { id: string }>(current: T[], incoming: T[], merge?: (existing: T, candidate: T) => T) {
  const records = current.map((record) => ({ ...record }));
  const indexes = new Map(records.map((record, index) => [record.id, index]));
  for (const candidate of incoming) {
    const index = indexes.get(candidate.id);
    if (index === undefined) {
      indexes.set(candidate.id, records.length);
      records.push({ ...candidate });
    } else if (merge) {
      records[index] = merge(records[index], candidate);
    }
  }
  return records;
}

function durableRecordIds(value: PersonalSyncPayload) {
  const ids = new Set<string>();
  for (const [field, records] of [
    ["activityHistory", value.activityHistory],
    ["boxes", value.boxes],
    ["pointRounds", value.pointRounds],
  ] as const) {
    records.forEach((record, index) => ids.add(`${field}:${record.id || `index-${index}:${JSON.stringify(record)}`}`));
  }
  return ids;
}

function isSubset(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  for (const value of left) if (!right.has(value)) return false;
  return true;
}

export function mergePersonalSyncPayload(current: PersistedState, value: unknown, preferIncomingOnEqual = false): PersistedState {
  const imported = applyPersonalSyncPayload(current, value);
  const currentPayload = personalSyncPayload(current);
  const incomingPayload = personalSyncPayload(imported);
  const currentDurableIds = durableRecordIds(currentPayload);
  const incomingDurableIds = durableRecordIds(incomingPayload);
  const currentContainsIncoming = isSubset(incomingDurableIds, currentDurableIds);
  const incomingContainsCurrent = isSubset(currentDurableIds, incomingDurableIds);
  const currentDominates = currentContainsIncoming && !incomingContainsCurrent;
  const incomingDominates = incomingContainsCurrent && !currentContainsIncoming;
  const useIncomingContext = incomingDominates || (!currentDominates && !incomingDominates && preferIncomingOnEqual);
  const deletedActionIds = sanitizeDeletedActionIds([
    ...currentPayload.deletedActionIds,
    ...incomingPayload.deletedActionIds,
  ]);
  const deletedActionIdSet = new Set(deletedActionIds);
  const candidateActions = currentDominates
    ? currentPayload.actions
    : incomingDominates || (currentContainsIncoming && preferIncomingOnEqual)
      ? incomingPayload.actions
      : mergeRecordsById(currentPayload.actions, incomingPayload.actions);
  const boxes = mergeRecordsById(currentPayload.boxes, incomingPayload.boxes, (existing, candidate) => {
    if (!Array.isArray(existing.actionIds) && !Array.isArray(candidate.actionIds)) return existing;
    const existingIds = Array.isArray(existing.actionIds) ? existing.actionIds : [];
    const candidateIds = Array.isArray(candidate.actionIds) ? candidate.actionIds : [];
    return { ...existing, actionIds: [...new Set([...existingIds, ...candidateIds].filter((id) => typeof id === "string"))] };
  });
  const actions = removeBoxCompletedActions(candidateActions.filter((action) => !deletedActionIdSet.has(action.id)), boxes);
  const boundaries = { ...currentPayload.pointRoundBoundaries };
  for (const [key, candidate] of Object.entries(incomingPayload.pointRoundBoundaries)) {
    if (!boundaries[key] || candidate > boundaries[key]) boundaries[key] = candidate;
  }
  const shinyMods = mergeRecordsById(currentPayload.shinyMods, incomingPayload.shinyMods, (existing, candidate) => ({
    ...existing,
    attempts: Math.max(existing.attempts, candidate.attempts),
    isShiny: existing.isShiny || candidate.isShiny,
    obtainedAt: existing.obtainedAt ?? candidate.obtainedAt,
  }));
  return {
    ...current,
    actions,
    deletedActionIds,
    activityHistory: mergeRecordsById(currentPayload.activityHistory, incomingPayload.activityHistory)
      .filter((record) => !deletedActionIdSet.has(record.id)),
    boxes,
    pointRounds: mergeRecordsById(currentPayload.pointRounds, incomingPayload.pointRounds),
    pointRoundBoundaries: boundaries,
    manualBaselinePoints: incomingPayload.manualBaselinePoints.length > currentPayload.manualBaselinePoints.length
      ? incomingPayload.manualBaselinePoints
      : currentPayload.manualBaselinePoints,
    shinyMods,
    characters: mergeRecordsById(currentPayload.characters, incomingPayload.characters, (existing, candidate) => useIncomingContext ? candidate : existing),
    activeCharacterId: useIncomingContext ? incomingPayload.activeCharacterId : currentPayload.activeCharacterId,
    trackingMode: useIncomingContext ? incomingPayload.trackingMode : currentPayload.trackingMode,
    teamMemberIds: [...new Set([...currentPayload.teamMemberIds, ...incomingPayload.teamMemberIds])],
    activeTeamSessionId: useIncomingContext ? incomingPayload.activeTeamSessionId : currentPayload.activeTeamSessionId,
  };
}

export function loadPersonalSyncUpdatedAt() {
  const saved = localStorage.getItem(PERSONAL_SYNC_UPDATED_AT_KEY) ?? "";
  if (Number.isFinite(Date.parse(saved))) return saved;
  return PERSONAL_SYNC_INITIAL_DATE;
}

/** Reconcile IDs and deletion markers even when both copies have the same size. */
export function recoverPersonalBackup(current: PersistedState, value: unknown): PersistedState {
  const imported = applyPersonalSyncPayload(current, value);
  // The durable save wins an equal-history tie, including legacy boxes without action IDs.
  const recovered = mergePersonalSyncPayload(current, personalSyncPayload(imported), true);
  const deletedIds = new Set(recovered.deletedActionIds);
  const savedRoundIds = new Set(imported.pointRounds.map((record) => record.id));
  return {
    ...recovered,
    // A stale startup may have automatically archived an already-deleted action.
    // Keep manual snapshots, but do not retain automatic rounds made only of deletions.
    pointRounds: recovered.pointRounds.filter((record) => savedRoundIds.has(record.id)
      || record.trigger === "manual"
      || record.actionIds.length === 0
      || !record.actionIds.every((id) => deletedIds.has(id))),
  };
}

export function savePersonalSyncUpdatedAt(updatedAt: string) {
  if (!Number.isFinite(Date.parse(updatedAt))) return;
  localStorage.setItem(PERSONAL_SYNC_UPDATED_AT_KEY, updatedAt);
}
