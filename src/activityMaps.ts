import type { Activity, ActivityMapId } from "./model.ts";

export const ACTIVITY_MAPS: { id: ActivityMapId; name: string; englishName: string; description: string; englishDescription: string }[] = [
  { id: "general", name: "Generales", englishName: "General", description: "Jefes y silos · dificultad Pro", englishDescription: "Bosses and silos · Pro difficulty" },
  { id: "manibus", name: "Manibus", englishName: "Manibus", description: "Guerras, eventos y laboratorio LEA", englishDescription: "Wars, events and LEA Research Lab" },
  { id: "dream", name: "Sueño infinito", englishName: "Endless Dream", description: "Soñadores, invasiones y desafíos", englishDescription: "Dreamers, invasions and challenges" },
  { id: "abyss", name: "Islas del Abismo", englishName: "Isles of Abyss", description: "Señor Hundido y calamidad", englishDescription: "The Sunken Lord and calamity" },
  { id: "winter", name: "El camino del invierno", englishName: "The Way of Winter", description: "Tejedores del Camino del Invierno", englishDescription: "The Way of Winter Chaosweavers" },
  { id: "prism", name: "Choque con el Prismaverso", englishName: "Prismverse's Clash", description: "Eventos de crisis públicos", englishDescription: "Public Crisis Events" },
];

export const PRIME_WAR_DIFFICULTIES = ["normal", "hard", "pro", "nightmare-apocalypse"] as const;
export type PrimeWarDifficulty = typeof PRIME_WAR_DIFFICULTIES[number];
export const PRIME_WAR_CRATES = [1, 2, 3] as const;

export function primeWarCrateId(difficulty: PrimeWarDifficulty, crate: typeof PRIME_WAR_CRATES[number]) {
  return `prime-war-${difficulty}-crate-${crate}`;
}

const PRIME_WAR_CRATE_IDS = new Set(PRIME_WAR_DIFFICULTIES.flatMap((difficulty) => PRIME_WAR_CRATES.map((crate) => primeWarCrateId(difficulty, crate))));

export function isPrimeWarCrate(id: string) {
  return PRIME_WAR_CRATE_IDS.has(id);
}

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
  "prism-crisis-event": "prism",
};

export function activityMapId(activity: Activity): ActivityMapId {
  if (ACTIVITY_MAPS.some((map) => map.id === activity.mapId)) return activity.mapId!;
  if (isPrimeWarCrate(activity.id)) return "manibus";
  if (activity.id.startsWith("dream-") || activity.id.startsWith("dreamer-")) return "dream";
  return LEGACY_MAPS[activity.id] ?? "general";
}

export function activitiesByMap(activities: readonly Activity[]) {
  return ACTIVITY_MAPS.map((map) => ({ ...map, activities: activities.filter((activity) => activityMapId(activity) === map.id) }));
}
