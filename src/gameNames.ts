import type { Activity, ActivityMapId, Catalog, PointAction } from "./model.ts";
import type { UiLanguage } from "./i18n.ts";
import names from "../catalog/game-names.json" with { type: "json" };

export function activityMapName(id: ActivityMapId, language: UiLanguage) {
  const map = names.maps[id] as Partial<Record<UiLanguage, string>>;
  return map[language] ?? map.en ?? id;
}

export function activityName(activity: Activity, language: UiLanguage) {
  return language === "es" ? activity.name : activity.names?.[language] ?? activity.names?.en ?? activity.name;
}

export function activityPhaseNames(activity: Activity, activities: readonly Activity[], language: UiLanguage) {
  if (activity.phaseActivities) {
    return activity.phaseActivities.map((id) => {
      const phase = activities.find((candidate) => candidate.id === id);
      return phase ? activityName(phase, language) : "";
    });
  }
  const phases = names.phases as Partial<Record<string, Partial<Record<UiLanguage, string[]>>>>;
  return phases[activity.id]?.[language] ?? phases[activity.id]?.en;
}

export function localizedActivityRecord(record: Pick<PointAction, "activityId" | "activityName" | "visionId" | "visionName">, catalog: Catalog, language: UiLanguage) {
  const vision = catalog.visions.find((candidate) => candidate.id === record.visionId);
  const activity = (record.visionId ? vision?.activities : catalog.proActivities)?.find((candidate) => candidate.id === record.activityId);
  return {
    activityName: activity ? activityName(activity, language) : record.activityName,
    visionName: vision ? (language === "es" ? vision.name : vision.englishName ?? vision.name) : record.visionName,
  };
}
