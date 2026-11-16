import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalModCatalog } from "./normal-mod-catalog.mjs";

const SOURCE_URL = "https://wikily.gg/es-la/once-human/mods/";
const EXPECTED_COUNTS = {
  total: 809,
  normal: 809,
  shiny: 0,
};

const RANGE_NAMES = new Map([
  ["all weapons", "Todas las armas"],
  ["todas las armas", "Todas las armas"],
  ["ranged weapon", "Arma a distancia"],
  ["melee weapon", "Arma cuerpo a cuerpo"],
  ["applies to all armor", "Toda la armadura"],
  ["helmet", "Casco"],
  ["casco", "Casco"],
  ["mask", "Máscara"],
  ["máscara", "Máscara"],
  ["top", "Parte superior"],
  ["superior", "Parte superior"],
  ["gloves", "Guantes"],
  ["guantes", "Guantes"],
  ["bottoms", "Pantalones"],
  // La traducción de la fuente usa "Mínimo" para la ranura Bottoms.
  ["mínimo", "Pantalones"],
  ["shoes", "Zapatos"],
  ["zapatos", "Zapatos"],
]);

const STYLE_NAMES = new Map([
  ["Burn", "Quemadura"],
  ["Power Surge", "Sobretensión"],
  ["Frost Vortex", "Vórtice de escarcha"],
  ["The Bull's Eye", "Diana"],
  ["Fortress Warfare", "Guerra de fortalezas"],
  ["Unstable Bomber", "Bombardero inestable"],
  ["Fast Gunner", "Disparo rápido"],
  ["Bounce", "Rebote"],
  ["Shrapnel", "Metralla"],
]);

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function decodeEmbeddedMods(html) {
  const startMarker = 'allMods\\":[';
  const endMarker = '],\\"showAd\\"';
  const markerIndex = html.indexOf(startMarker);
  if (markerIndex < 0) throw new Error("No se encontró allMods en la página fuente.");
  const start = markerIndex + startMarker.length - 1;
  const endIndex = html.indexOf(endMarker, start);
  if (endIndex < 0) throw new Error("No se encontró el final de allMods en la página fuente.");
  const encodedJson = html.slice(start, endIndex + 1);
  return JSON.parse(JSON.parse(`"${encodedJson}"`));
}

function canonicalRange(value) {
  return RANGE_NAMES.get(String(value).trim().toLocaleLowerCase("es")) ?? String(value).trim();
}

function catalogGroup(entry) {
  const range = canonicalRange(entry.apply_range_desc);
  if (["Todas las armas", "Arma a distancia", "Arma cuerpo a cuerpo"].includes(range)) {
    if (entry.mod_type) {
      const styleName = STYLE_NAMES.get(entry.mod_type) ?? entry.mod_type;
      return { category: "weapon", groupId: `weapon-${slugify(entry.mod_type)}`, groupName: `Arma · ${styleName}` };
    }
    return { category: "weapon", groupId: `weapon-${slugify(range)}`, groupName: `Arma · ${range}` };
  }
  return { category: "armor", groupId: `armor-${slugify(range)}`, groupName: `Armadura · ${range}` };
}

function normalizeEntry(entry, index) {
  const group = catalogGroup(entry);
  const system = "new";
  const isCatalogShiny = entry.is_shiny === true;
  const rawId = String(entry.id).replace(/[\[\]]/g, "").replace(/[^a-zA-Z0-9]+/g, "-");
  const baseEnglishName = String(entry.english_name ?? "").replace(/\s*<.*>\s*$/, "").trim();
  return {
    id: `${system}-${isCatalogShiny ? "shiny" : "normal"}-${entry.item_id}-${rawId || index}`,
    itemId: String(entry.item_id),
    name: String(entry.name),
    englishName: String(entry.english_name ?? ""),
    baseName: String(entry.base_name ?? entry.name),
    baseEnglishName,
    variant: entry.family ? String(entry.family) : "Sin variante",
    levelLabel: isCatalogShiny ? "Brillante" : "Nivel 1–17",
    applyRange: canonicalRange(entry.apply_range_desc),
    modType: entry.mod_type ? String(entry.mod_type) : "",
    system,
    isCatalogShiny,
    sourceTier: Number(entry.name_replace) || 1,
    ...group,
  };
}

const response = await fetch(SOURCE_URL);
if (!response.ok) throw new Error(`La fuente respondió HTTP ${response.status}.`);
const rawEntries = decodeEmbeddedMods(await response.text());
// El sistema anterior quedó obsoleto con la renovación de enero de 2026.
// Cada módulo actual aparece una sola vez. Brillante sigue siendo un estado
// del seguimiento personal, y sus ID antiguos se conservan como alias.
const records = normalModCatalog(rawEntries.filter((entry) => entry.system !== "legacy").map(normalizeEntry));

const counts = {
  total: records.length,
  normal: records.filter((entry) => entry.system === "new" && !entry.isCatalogShiny).length,
  shiny: records.filter((entry) => entry.system === "new" && entry.isCatalogShiny).length,
};

for (const [key, expected] of Object.entries(EXPECTED_COUNTS)) {
  if (counts[key] !== expected) throw new Error(`Conteo inesperado en ${key}: ${counts[key]} (esperado ${expected}).`);
}
if (new Set(records.map((entry) => entry.id)).size !== records.length) {
  throw new Error("El catálogo contiene identificadores repetidos.");
}

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(currentDirectory, "../catalog/shiny-mods.json");
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({
  schemaVersion: 2,
  sourceUrl: SOURCE_URL,
  sourceCheckedAt: new Date().toISOString(),
  counts,
  records,
}, null, 2)}\n`, "utf8");

console.log(JSON.stringify({ outputPath, counts }));
