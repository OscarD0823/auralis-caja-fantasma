import type { UiLanguage } from "./i18n";

export type Activity = {
  id: string;
  name: string;
  points: number;
  enabled: boolean;
  note?: string;
};

export type Vision = {
  id: string;
  name: string;
  englishName?: string;
  visualTheme?: VisionVisualTheme;
  enabled: boolean;
  description: string;
  activities: Activity[];
};

export type VisionVisualTheme = "gravity" | "lunar" | "symbiosis" | "neutral";

export type OverlayShape = "event" | "rectangle" | "square" | "vertical" | "round";
export type OverlayCounterStyle = "digital" | "compact" | "ring";
export type WhaleCounterStyle = OverlayCounterStyle | "beam";
export type OverlayNameMode = "spanish" | "english" | "custom";

export type SharedEventTiming = {
  selectedVisionId: string;
  waitMinutes: number;
  activeMinutes: number;
  transitionDelayMilliseconds?: number;
  /** Compatibilidad con clientes anteriores a 1.13.0. */
  transitionDelaySeconds?: number;
  phaseStartedAt: string;
  phase: "waiting" | "active";
  updatedAt: string;
  updatedBy: string;
};

export type Catalog = {
  schemaVersion: 1;
  catalogVersion: number;
  updatedAt: string;
  updatedBy: string;
  boxTargetPoints: number;
  proActivities: Activity[];
  visions: Vision[];
  eventTiming?: SharedEventTiming;
};

export type PointAction = {
  id: string;
  activityId: string;
  activityName: string;
  visionId?: string;
  visionName?: string;
  points: number;
  occurredAt: string;
  characterIds?: string[];
  trackingMode?: "solo" | "team";
  teamSessionId?: string;
};

export type ActivityHistoryRecord = {
  id: string;
  activityId: string;
  activityName: string;
  visionId?: string;
  visionName?: string;
  points: number;
  count: number;
  occurredAt: string;
};

export type BoxRecord = {
  id: string;
  occurredAt: string;
  points: number;
  claims: number;
  source?: "normal" | "platform-mail";
  carriedPoints?: number;
  characterId?: string;
  characterName?: string;
  /** Rewards consumed by this character's box; keep history, never revive the attempt. */
  actionIds?: string[];
  breakdown: Array<{ name: string; count: number; points: number }>;
};

export type PointRoundTrigger = "event-start" | "manual" | "whale-end";

export type PointRoundRecord = {
  id: string;
  startedAt: string;
  endedAt: string;
  trigger: PointRoundTrigger;
  points: number;
  claims: number;
  actionIds: string[];
  visionId?: string;
  visionName?: string;
  trackingMode: "solo" | "team";
  characterId?: string;
  characterName?: string;
  teamSessionId?: string;
  characterIds?: string[];
  breakdown: Array<{ activityId?: string; visionId?: string; name: string; count: number; points: number }>;
};

export type CharacterProfile = {
  id: string;
  name: string;
  createdAt: string;
};

export type ShinyModRecord = {
  id: string;
  catalogId?: string;
  modName: string;
  englishName?: string;
  groupName: string;
  variant: string;
  attempts: number;
  isShiny: boolean;
  createdAt: string;
  obtainedAt?: string;
};

export type Settings = {
  uiLanguageMode?: "auto" | "manual";
  uiLanguage: UiLanguage;
  selectedVisionId: string;
  waitMinutes: number;
  activeMinutes: number;
  phaseStartedAt: string;
  phase: "waiting" | "active";
  overlayEnabled: boolean;
  overlayScale: number;
  overlayAddonScale: number;
  overlayWhaleEnabled: boolean;
  overlayWhaleShowTime: boolean;
  overlayWhaleCounterScale: number;
  overlayWhaleCounterStyle: WhaleCounterStyle;
  overlayShape: OverlayShape;
  overlayCounterStyle: OverlayCounterStyle;
  overlayNameMode: OverlayNameMode;
  overlayCustomName: string;
  transitionDelayMilliseconds: number;
  /** Valor legado leído al migrar configuraciones de 1.12.0. */
  transitionDelaySeconds?: number;
  voiceNotificationsEnabled: boolean;
  voiceLeadMinutes: number;
  timingPresetVersion: number;
  autoStartEnabled: boolean;
  localSyncEnabled: boolean;
  localSyncLiveEnabled: boolean;
  localSyncAddress: string;
  localSyncCode: string;
  phoneSyncAddress: string;
  phoneSyncCode: string;
  lastVoiceAlertPhaseStartedAt?: string;
  sharedTimingUpdatedAt?: string;
  lastPointRoundEventStartedAt?: string;
  lastWhalePointRoundWaitStartedAt?: string;
  dataResetVersion: number;
};

export type PersistedState = {
  schemaVersion: 1;
  catalog: Catalog;
  actions: PointAction[];
  /** Identificadores quitados a propósito para que una copia atrasada no los restaure. */
  deletedActionIds: string[];
  activityHistory: ActivityHistoryRecord[];
  boxes: BoxRecord[];
  pointRounds: PointRoundRecord[];
  pointRoundBoundaries: Record<string, string>;
  manualBaselinePoints: number[];
  shinyMods: ShinyModRecord[];
  characters: CharacterProfile[];
  activeCharacterId: string;
  trackingMode: "solo" | "team";
  teamMemberIds: string[];
  activeTeamSessionId: string;
  settings: Settings;
};

export type CycleSnapshot = {
  phase: "waiting" | "active";
  remainingMs: number;
  progress: number;
  phaseEndsAt: string;
};

export type GravityWhaleSnapshot = {
  visible: boolean;
  departing: boolean;
  remainingMs: number;
  progress: number;
};

export type CountdownTransitionSnapshot = {
  active: boolean;
  remainingMs: number;
  progress: number;
};

export const APP_VERSION = "1.23.1";
export const AUTHOR = "OscarD0823";
export const AUTHOR_PROFILE_URL = `https://github.com/${AUTHOR}`;
export const DEFAULT_CHARACTER_ID = "character-main";
export const GAME_DAY_TIME_ZONE = "America/Bogota";
export const GAME_DAY_RESET_HOUR = 8;
export const REPOSITORY_URL = "https://github.com/OscarD0823/auralis-caja-fantasma";
export const RELEASES_DOWNLOAD_URL = `${REPOSITORY_URL}/releases/latest`;
export const WINDOWS_DOWNLOAD_URL = RELEASES_DOWNLOAD_URL;
export const ANDROID_APK_URL = RELEASES_DOWNLOAD_URL;
export const WEB_APP_URL = "https://oscard0823.github.io/auralis-caja-fantasma/";
export const REMOTE_CATALOG_URL = "https://raw.githubusercontent.com/OscarD0823/auralis-caja-fantasma/main/catalog/visions.json";
// Gravedad terminó y comenzó su espera a las 16:52:30 de Colombia del 10/09/2026.
export const VISION_CYCLE_WAIT_STARTED_AT = "2026-09-10T21:52:30.000Z";
// Las instalaciones nuevas aprenden únicamente de los datos añadidos por la persona.
export const BASELINE_BOX_POINTS: readonly number[] = [];

export function createId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0].toString(36)}`;
}

export function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function actionCharacterIds(action: PointAction) {
  return Array.isArray(action.characterIds) ? action.characterIds : [DEFAULT_CHARACTER_ID];
}

export function actionBelongsToCharacter(action: PointAction, characterId: string) {
  return actionCharacterIds(action).includes(characterId);
}

export function actionsForCharacter(actions: PointAction[], characterId: string) {
  return actions.filter((action) => actionBelongsToCharacter(action, characterId));
}

export function actionsForTeamSession(actions: PointAction[], teamSessionId: string) {
  return actions.filter((action) => action.trackingMode === "team" && action.teamSessionId === teamSessionId);
}

export function detachCharacterFromActions(actions: PointAction[], characterId: string, actionIds?: ReadonlySet<string>) {
  return actions.flatMap((action) => {
    if ((actionIds && !actionIds.has(action.id)) || !actionBelongsToCharacter(action, characterId)) return [action];
    const characterIds = actionCharacterIds(action).filter((id) => id !== characterId);
    if (characterIds.length === 0 && action.trackingMode !== "team") return [];
    return [{ ...action, characterIds }];
  });
}

export function removeBoxCompletedActions(actions: PointAction[], boxes: BoxRecord[]) {
  const completed = new Map<string, Set<string>>();
  for (const box of boxes) {
    const characterId = box.characterId || DEFAULT_CHARACTER_ID;
    if (!Array.isArray(box.actionIds)) continue; // Legacy boxes have no reliable reward IDs.
    for (const id of box.actionIds) {
      if (typeof id !== "string") continue;
      const characters = completed.get(id) ?? new Set<string>();
      characters.add(characterId);
      completed.set(id, characters);
    }
  }
  return actions.flatMap((action) => {
    const consumedBy = completed.get(action.id);
    if (!consumedBy) return [action];
    const characterIds = actionCharacterIds(action).filter((id) => !consumedBy.has(id));
    if (characterIds.length === 0 && action.trackingMode !== "team") return [];
    return [{ ...action, characterIds }];
  });
}

export function createInitialCharacterTracking(now = Date.now()) {
  const createdAt = new Date(now).toISOString();
  return {
    characters: [{ id: DEFAULT_CHARACTER_ID, name: "Personaje principal", createdAt }] as CharacterProfile[],
    activeCharacterId: DEFAULT_CHARACTER_ID,
    trackingMode: "solo" as const,
    teamMemberIds: [DEFAULT_CHARACTER_ID],
    activeTeamSessionId: `team-${now.toString(36)}`,
  };
}

export function computeCycle(settings: Settings, now = Date.now()): CycleSnapshot {
  const waitMs = clampNumber(settings.waitMinutes, 1, 525_600) * 60_000;
  const activeMs = clampNumber(settings.activeMinutes, 1, 525_600) * 60_000;
  let startedAt = new Date(settings.phaseStartedAt).getTime();
  if (!Number.isFinite(startedAt)) startedAt = now;
  const fullCycleMs = waitMs + activeMs;
  const elapsedFromAnchor = Math.max(0, now - startedAt);
  const completedCycles = Math.floor(elapsedFromAnchor / fullCycleMs);
  const remainder = elapsedFromAnchor - completedCycles * fullCycleMs;
  startedAt += completedCycles * fullCycleMs;

  let phase = settings.phase;
  let duration = phase === "active" ? activeMs : waitMs;
  if (remainder >= duration) {
    startedAt += duration;
    phase = phase === "active" ? "waiting" : "active";
    duration = phase === "active" ? activeMs : waitMs;
  }

  const elapsed = Math.max(0, now - startedAt);
  return {
    phase,
    remainingMs: Math.max(0, duration - elapsed),
    progress: Math.min(1, elapsed / duration),
    phaseEndsAt: new Date(startedAt + duration).toISOString(),
  };
}

export function computeCountdownTransition(settings: Settings, now = Date.now()): CountdownTransitionSnapshot {
  const cycle = computeCycle(settings, now);
  const delayMs = resolveTransitionDelayMilliseconds(settings);
  if (cycle.phase !== "waiting" || delayMs <= 0) return { active: false, remainingMs: 0, progress: 1 };
  const waitMs = clampNumber(settings.waitMinutes, 1, 525_600) * 60_000;
  const elapsedWaitingMs = Math.max(0, waitMs - cycle.remainingMs);
  const remainingMs = Math.max(0, delayMs - elapsedWaitingMs);
  return { active: remainingMs > 0, remainingMs, progress: Math.min(1, elapsedWaitingMs / delayMs) };
}

export function resolveTransitionDelayMilliseconds(
  source: { transitionDelayMilliseconds?: number; transitionDelaySeconds?: number } | undefined,
  fallback = 3_000,
) {
  if (Number.isFinite(source?.transitionDelayMilliseconds)) {
    return clampNumber(Math.round(source!.transitionDelayMilliseconds!), 0, 300_000);
  }
  if (Number.isFinite(source?.transitionDelaySeconds)) {
    return clampNumber(Math.round(source!.transitionDelaySeconds! * 1_000), 0, 300_000);
  }
  return clampNumber(Math.round(fallback), 0, 300_000);
}

export function sharedEventTimingFromSettings(settings: Settings, updatedAt: string, updatedBy: string): SharedEventTiming {
  const transitionDelayMilliseconds = resolveTransitionDelayMilliseconds(settings);
  return {
    selectedVisionId: settings.selectedVisionId,
    waitMinutes: clampNumber(Math.round(settings.waitMinutes), 1, 525_600),
    activeMinutes: clampNumber(Math.round(settings.activeMinutes), 1, 525_600),
    transitionDelayMilliseconds,
    transitionDelaySeconds: transitionDelayMilliseconds / 1_000,
    phaseStartedAt: settings.phaseStartedAt,
    phase: settings.phase,
    updatedAt,
    updatedBy,
  };
}

export function applyRemoteCatalog(current: PersistedState, catalog: Catalog): PersistedState {
  if (catalog.catalogVersion < current.catalog.catalogVersion) return current;
  const hasNewCatalog = catalog.catalogVersion > current.catalog.catalogVersion;
  const timing = catalog.eventTiming;
  if (!timing) return hasNewCatalog ? { ...current, catalog } : current;

  const appliedTiming = Date.parse(current.settings.sharedTimingUpdatedAt ?? "");
  const remoteTiming = Date.parse(timing.updatedAt);
  const selectedVisionId = sharedVisionId(catalog, current.settings.selectedVisionId);
  // A higher catalog version is the administrator's authoritative publication.
  // Do not let a client clock or a previously stored future timestamp keep the
  // new durations/transition delay from reaching Windows or Android.
  const hasNewTiming = hasNewCatalog || !Number.isFinite(appliedTiming) || remoteTiming > appliedTiming;
  if (!hasNewCatalog && !hasNewTiming && current.settings.selectedVisionId === selectedVisionId) return current;

  return {
    ...current,
    catalog: hasNewCatalog || hasNewTiming ? catalog : current.catalog,
    settings: {
      ...current.settings,
      selectedVisionId,
      ...(hasNewTiming ? {
        waitMinutes: timing.waitMinutes,
        activeMinutes: timing.activeMinutes,
        transitionDelayMilliseconds: resolveTransitionDelayMilliseconds(timing, current.settings.transitionDelayMilliseconds),
        phaseStartedAt: timing.phaseStartedAt,
        phase: timing.phase,
        lastVoiceAlertPhaseStartedAt: undefined,
        sharedTimingUpdatedAt: timing.updatedAt,
      } : {}),
    },
  };
}

export function shouldShowGravityWhale(settings: Settings, now = Date.now()) {
  if (settings.selectedVisionId !== "gravity") return false;
  const cycle = computeCycle(settings, now);
  if (cycle.phase === "active") {
    const elapsedMs = clampNumber(settings.activeMinutes, 1, 525_600) * 60_000 - cycle.remainingMs;
    return elapsedMs >= 15 * 60_000;
  }
  const elapsedWaitingMs = clampNumber(settings.waitMinutes, 1, 525_600) * 60_000 - cycle.remainingMs;
  return elapsedWaitingMs <= 5 * 60_000;
}

export function sharedVisionId(catalog: Catalog, fallback = "gravity") {
  const selectedId = catalog.eventTiming?.selectedVisionId;
  if (selectedId && catalog.visions.some((vision) => vision.id === selectedId && vision.enabled)) return selectedId;
  return catalog.visions.find((vision) => vision.enabled)?.id ?? fallback;
}

export function computeGravityWhale(settings: Settings, now = Date.now()): GravityWhaleSnapshot {
  const hidden = { visible: false, departing: false, remainingMs: 0, progress: 0 };
  if (settings.selectedVisionId !== "gravity") return hidden;
  const activeMinutes = clampNumber(settings.activeMinutes, 1, 525_600);
  if (activeMinutes <= 15) return hidden;
  const cycle = computeCycle(settings, now);
  const afterEventMs = 5 * 60_000;
  const departureMs = 4_000;
  const totalMs = (activeMinutes - 15) * 60_000 + afterEventMs;

  if (cycle.phase === "active") {
    const elapsedActiveMs = activeMinutes * 60_000 - cycle.remainingMs;
    if (elapsedActiveMs < 15 * 60_000) return hidden;
    const remainingMs = cycle.remainingMs + afterEventMs;
    return { visible: true, departing: false, remainingMs, progress: Math.min(1, Math.max(0, 1 - remainingMs / totalMs)) };
  }

  const waitMs = clampNumber(settings.waitMinutes, 1, 525_600) * 60_000;
  const elapsedWaitingMs = waitMs - cycle.remainingMs;
  if (elapsedWaitingMs > afterEventMs + departureMs) return hidden;
  const remainingMs = Math.max(0, afterEventMs - elapsedWaitingMs);
  return { visible: true, departing: remainingMs <= 0, remainingMs, progress: Math.min(1, Math.max(0, 1 - remainingMs / totalMs)) };
}

export function formatDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const rest = seconds % 60;
  if (days > 0) return `${days}d ${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m`;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
}

export function formatCompactDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const rest = seconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
  return `${minutes}m ${rest.toString().padStart(2, "0")}s`;
}

export function overlayVisionName(vision: Vision | undefined, mode: OverlayNameMode, customName = "") {
  const fallback = vision?.name?.trim() || "Rueda Visional";
  if (mode === "custom" && customName.trim()) return customName.trim().slice(0, 40);
  if (mode === "english") return vision?.englishName?.trim() || fallback;
  return fallback;
}

export function boxStatistics(boxes: BoxRecord[], currentPoints: number, baseline: readonly number[] = BASELINE_BOX_POINTS) {
  const referenceSamples = baseline.filter((value) => Number.isFinite(value) && value > 0);
  const personalSamples = boxes.map((box) => box.points).filter((value) => value > 0);
  const samples = [...referenceSamples, ...personalSamples];
  if (samples.length === 0) {
    return { count: 0, baselineCount: 0, personalCount: 0, minimum: 0, maximum: 0, average: 0, median: 0, lowerAverage: 0, upperAverage: 0, perPointPercent: 0, currentChancePercent: 0 };
  }
  const total = samples.reduce((sum, value) => sum + value, 0);
  const probability = samples.length / total;
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  const lower = sorted.length === 1 ? sorted : sorted.slice(0, middle);
  const upper = sorted.length === 1 ? sorted : sorted.slice(Math.ceil(sorted.length / 2));
  const averageOf = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    count: samples.length,
    baselineCount: referenceSamples.length,
    personalCount: personalSamples.length,
    minimum: Math.min(...samples),
    maximum: Math.max(...samples),
    average: total / samples.length,
    median,
    lowerAverage: averageOf(lower),
    upperAverage: averageOf(upper),
    perPointPercent: probability * 100,
    currentChancePercent: (1 - Math.pow(1 - probability, Math.max(0, currentPoints))) * 100,
  };
}

export function parseManualBaseline(text: string, limit = 500) {
  return text
    .split(/[\s,;]+/)
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 10_000)
    .map((value) => Math.round(value))
    .slice(0, Math.max(0, limit));
}

export function buildBreakdown(actions: PointAction[]) {
  const groups = new Map<string, { name: string; count: number; points: number }>();
  for (const action of actions) {
    const key = `${action.visionId ?? "pro"}:${action.activityId}`;
    const current = groups.get(key) ?? { name: action.visionName ? `${action.visionName} · ${action.activityName}` : action.activityName, count: 0, points: 0 };
    current.count += 1;
    current.points += action.points;
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

export function localDateKey(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function gameDayKey(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const shifted = new Date(date.getTime() - GAME_DAY_RESET_HOUR * 60 * 60_000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: GAME_DAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(shifted);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const year = part("year");
  const month = part("month");
  const day = part("day");
  return year && month && day ? `${year}-${month}-${day}` : "";
}

export function activityHistorySummary(records: ActivityHistoryRecord[], today = new Date()) {
  const todayKey = gameDayKey(today);
  const daily = new Map<string, { date: string; count: number; points: number }>();
  const ranking = new Map<string, { key: string; name: string; count: number; todayCount: number; points: number }>();
  for (const record of records) {
    const date = gameDayKey(record.occurredAt);
    if (!date) continue;
    const count = Math.max(0, Math.round(Number(record.count) || 0));
    const points = Math.max(0, Math.round(Number(record.points) || 0));
    const day = daily.get(date) ?? { date, count: 0, points: 0 };
    day.count += count;
    day.points += points;
    daily.set(date, day);
    const key = `${record.visionId ?? "pro"}:${record.activityId}`;
    const name = record.visionName ? `${record.visionName} · ${record.activityName}` : record.activityName;
    const item = ranking.get(key) ?? { key, name, count: 0, todayCount: 0, points: 0 };
    item.count += count;
    item.points += points;
    if (date === todayKey) item.todayCount += count;
    ranking.set(key, item);
  }
  const days = [...daily.values()].sort((a, b) => b.date.localeCompare(a.date));
  const ranked = [...ranking.values()].sort((a, b) => b.count - a.count || b.points - a.points || a.name.localeCompare(b.name));
  const todayStats = daily.get(todayKey) ?? { date: todayKey, count: 0, points: 0 };
  return {
    today: todayStats,
    totalCount: records.reduce((sum, record) => sum + Math.max(0, Math.round(Number(record.count) || 0)), 0),
    totalPoints: records.reduce((sum, record) => sum + Math.max(0, Math.round(Number(record.points) || 0)), 0),
    days,
    ranking: ranked,
  };
}

export function buildPointRoundBreakdown(actions: PointAction[]) {
  const groups = new Map<string, { activityId: string; visionId?: string; name: string; count: number; points: number }>();
  for (const action of actions) {
    const key = `${action.visionId ?? "pro"}:${action.activityId}`;
    const current = groups.get(key) ?? {
      activityId: action.activityId,
      visionId: action.visionId,
      name: action.visionName ? `${action.visionName} · ${action.activityName}` : action.activityName,
      count: 0,
      points: 0,
    };
    current.count += 1;
    current.points += action.points;
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
}

export function pointActionsInRound(actions: PointAction[], startedAt?: string, endedAt?: string) {
  const startedAtMs = startedAt ? Date.parse(startedAt) : Number.NEGATIVE_INFINITY;
  const endedAtMs = endedAt ? Date.parse(endedAt) : Number.POSITIVE_INFINITY;
  return actions.filter((action) => {
    const occurredAtMs = Date.parse(action.occurredAt);
    return Number.isFinite(occurredAtMs) && occurredAtMs > startedAtMs && occurredAtMs <= endedAtMs;
  });
}

export function splitPlatformCarryover(actions: PointAction[], now = Date.now(), delayMinutes = 60) {
  const cutoff = now - clampNumber(delayMinutes, 1, 1_440) * 60_000;
  const completedAttempt: PointAction[] = [];
  const carryOver: PointAction[] = [];
  for (const action of actions) {
    const occurredAt = new Date(action.occurredAt).getTime();
    if (Number.isFinite(occurredAt) && occurredAt > cutoff) carryOver.push(action);
    else completedAttempt.push(action);
  }
  return { completedAttempt, carryOver, cutoff: new Date(cutoff).toISOString() };
}

export function validateCatalog(value: unknown): value is Catalog {
  if (!value || typeof value !== "object") return false;
  const catalog = value as Partial<Catalog>;
  const validActivity = (activity: Activity) => Boolean(activity && typeof activity.id === "string" && typeof activity.name === "string" && Number.isFinite(activity.points) && typeof activity.enabled === "boolean");
  const timing = catalog.eventTiming;
  const validTiming = timing === undefined || (typeof timing.selectedVisionId === "string"
    && Number.isFinite(timing.waitMinutes) && timing.waitMinutes >= 1 && timing.waitMinutes <= 525_600
    && Number.isFinite(timing.activeMinutes) && timing.activeMinutes >= 1 && timing.activeMinutes <= 525_600
    && (timing.transitionDelayMilliseconds === undefined || (Number.isFinite(timing.transitionDelayMilliseconds) && timing.transitionDelayMilliseconds >= 0 && timing.transitionDelayMilliseconds <= 300_000))
    && (timing.transitionDelaySeconds === undefined || (Number.isFinite(timing.transitionDelaySeconds) && timing.transitionDelaySeconds >= 0 && timing.transitionDelaySeconds <= 300))
    && typeof timing.phaseStartedAt === "string"
    && Number.isFinite(Date.parse(timing.phaseStartedAt))
    && (timing.phase === "waiting" || timing.phase === "active")
    && typeof timing.updatedAt === "string"
    && Number.isFinite(Date.parse(timing.updatedAt))
    && typeof timing.updatedBy === "string");
  return catalog.schemaVersion === 1
    && Number.isInteger(catalog.catalogVersion)
    && typeof catalog.updatedAt === "string"
    && typeof catalog.updatedBy === "string"
    && Number.isFinite(catalog.boxTargetPoints)
    && Array.isArray(catalog.proActivities)
    && catalog.proActivities.every(validActivity)
    && Array.isArray(catalog.visions)
    && catalog.visions.every((vision) => vision && typeof vision.id === "string" && typeof vision.name === "string" && (vision.englishName === undefined || typeof vision.englishName === "string") && (vision.visualTheme === undefined || ["gravity", "lunar", "symbiosis", "neutral"].includes(vision.visualTheme)) && typeof vision.enabled === "boolean" && typeof vision.description === "string" && Array.isArray(vision.activities) && vision.activities.every(validActivity))
    && (timing === undefined || catalog.visions.some((vision) => vision.id === timing.selectedVisionId && vision.enabled))
    && validTiming;
}
