import type { ShinyModRecord } from "./model";

export type ModProgressValue = number | "shiny";

export function normalizeModLevel(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(17, Math.max(0, Math.floor(value))) : undefined;
}

export function modLevel(record?: Pick<ShinyModRecord, "level" | "isShiny">): number | undefined {
  if (!record) return 0;
  return record.isShiny ? 17 : normalizeModLevel(record.level);
}

export function setModProgress(record: ShinyModRecord, value: ModProgressValue, updatedAt = new Date().toISOString()): ShinyModRecord {
  const shiny = value === "shiny";
  return {
    ...record,
    level: shiny ? 17 : normalizeModLevel(value) ?? 0,
    isShiny: shiny,
    levelUpdatedAt: updatedAt,
    obtainedAt: shiny ? record.obtainedAt ?? updatedAt : undefined,
  };
}

function progressTime(record: ShinyModRecord) {
  const date = record.levelUpdatedAt ?? (record.isShiny ? record.obtainedAt : undefined);
  return date && Number.isFinite(Date.parse(date)) ? Date.parse(date) : 0;
}

/** Newer explicit corrections win over stale copies, including a former Shiny mark. */
export function mergeModProgress(existing: ShinyModRecord, candidate: ShinyModRecord): ShinyModRecord {
  const difference = progressTime(candidate) - progressTime(existing);
  const rank = (record: ShinyModRecord) => record.isShiny ? 18 : normalizeModLevel(record.level) ?? -1;
  const winner = difference > 0 || (difference === 0 && rank(candidate) > rank(existing)) ? candidate : existing;
  return {
    ...existing,
    attempts: Math.max(existing.attempts, candidate.attempts),
    isShiny: winner.isShiny,
    level: winner.level,
    levelUpdatedAt: winner.levelUpdatedAt,
    obtainedAt: winner.isShiny ? winner.obtainedAt ?? existing.obtainedAt ?? candidate.obtainedAt : undefined,
  };
}
