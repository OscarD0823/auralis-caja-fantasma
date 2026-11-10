import type { Activity, ActivityMapId } from "./model.ts";

export const ACTIVITY_MAPS: { id: ActivityMapId; name: string; englishName: string; description: string; englishDescription: string }[] = [
  { id: "general", name: "Generales", englishName: "General", description: "Jefes y silos · dificultad Pro", englishDescription: "Bosses and silos · Pro difficulty" },
  { id: "manibus", name: "Manibus", englishName: "Manibus", description: "Guerras, eventos y laboratorio LEA", englishDescription: "Wars, events and LEA Research Lab" },
  { id: "dream", name: "Dream", englishName: "Dream", description: "Soñadores, invasiones y desafíos", englishDescription: "Dreamers, invasions and challenges" },
  { id: "abyss", name: "Islas del Abismo", englishName: "Isles of Abyss", description: "The Sunken Lord y calamidad", englishDescription: "The Sunken Lord and calamity" },
  { id: "winter", name: "Winter", englishName: "Winter", description: "Tejedores del Camino del Invierno", englishDescription: "The Way of Winter Chaosweavers" },
];

const LEGACY_MAPS: Record<string, ActivityMapId> = {
  "pro-war": "manibus",
  "manibus-manibus": "manibus",
  "manibus-event": "manibus",
  "manibus-war": "manibus",
  "manibus-lea": "manibus",
  "calamity-tower": "abyss",
  "calamity-zone": "abyss",
  "calamity-owl": "abyss",
  "sunken-lord": "abyss",
  "winter-chaosweaver": "winter",
};

export function activityMapId(activity: Activity): ActivityMapId {
  if (ACTIVITY_MAPS.some((map) => map.id === activity.mapId)) return activity.mapId!;
  if (activity.id.startsWith("dream-") || activity.id.startsWith("dreamer-")) return "dream";
  return LEGACY_MAPS[activity.id] ?? "general";
}

export function activitiesByMap(activities: readonly Activity[]) {
  return ACTIVITY_MAPS.map((map) => ({ ...map, activities: activities.filter((activity) => activityMapId(activity) === map.id) }));
}
