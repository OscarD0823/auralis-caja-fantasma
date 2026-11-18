import catalogData from "../catalog/shiny-mods.json" with { type: "json" };
import abyssData from "../catalog/abyss-mods.json" with { type: "json" };
import collectionOrderData from "../catalog/mod-collection-order.json" with { type: "json" };

export type ShinyModSystem = "new";

export type ShinyModCatalogItem = {
  id: string;
  itemId: string;
  name: string;
  englishName: string;
  baseName: string;
  baseEnglishName: string;
  variant: string;
  levelLabel: "Nivel 1–17" | "Brillante";
  applyRange: string;
  modType: string;
  system: ShinyModSystem;
  isCatalogShiny: boolean;
  sourceTier: number;
  category: "weapon" | "armor";
  groupId: string;
  groupName: string;
  legacyShinyIds?: string[];
  legacyShinyItemIds?: string[];
  scenarioId?: string;
  sourceUrl?: string;
  searchAliases?: string[];
};

export type ShinyModCatalogGroup = {
  id: string;
  name: string;
  category: "weapon" | "armor";
  count: number;
};

type ShinyCatalogDocument = {
  schemaVersion: number;
  sourceUrl: string;
  sourceCheckedAt: string;
  counts: {
    total: number;
    normal: number;
    shiny: number;
  };
  records: ShinyModCatalogItem[];
};

const document = catalogData as ShinyCatalogDocument;

const GROUP_ORDER = [
  "weapon-burn",
  "weapon-power-surge",
  "weapon-frost-vortex",
  "weapon-the-bull-s-eye",
  "weapon-fortress-warfare",
  "weapon-unstable-bomber",
  "weapon-fast-gunner",
  "weapon-bounce",
  "weapon-shrapnel",
  "weapon-todas-las-armas",
  "weapon-arma-a-distancia",
  "weapon-arma-cuerpo-a-cuerpo",
  "armor-casco",
  "armor-parte-superior",
  "armor-pantalones",
  "armor-zapatos",
  "armor-guantes",
  "armor-mascara",
  "armor-toda-la-armadura",
] as const;

const groupOrder = new Map<string, number>(GROUP_ORDER.map((id, index) => [id, index]));

export const MOD_PIECES = [
  { id: "weapon", es: "Arma", en: "Weapon" },
  { id: "armor-casco", es: "Casco", en: "Helmet" },
  { id: "armor-parte-superior", es: "Superior", en: "Top" },
  { id: "armor-pantalones", es: "Prenda inferior", en: "Bottoms" },
  { id: "armor-zapatos", es: "Zapatos", en: "Shoes" },
  { id: "armor-guantes", es: "Guantes", en: "Gloves" },
  { id: "armor-mascara", es: "Máscara", en: "Mask" },
] as const;

export const MOD_VARIANT_ORDER = [
  "General", "Violencia", "Precisión", "Energía de aberración", "Supervivencia",
  "Quemadura", "Sobretensión", "Vórtice de escarcha", "Diana", "Guerra de fortalezas", "Bombardero inestable", "Disparo rápido", "Rebote", "Metralla",
  "Resonancia", "Energía de aberración resonante", "Lunar", "Energía de aberración lunar", "Batalla",
  "Espejo", "Energía de aberración de espejo", "Fantasmagórico", "Energía de aberración espectral",
  "Salvaje", "Energía de Aberración Salvaje", "Aero", "Energía de aberración aérea",
  "Creciente", "Energía de aberración creciente", "Estrella Descendente", "Energía de aberración de estrella descendente", "Melee Predeterminado",
];

export function compareModVariants(left: string, right: string) {
  const index = (value: string) => { const found = MOD_VARIANT_ORDER.indexOf(value); return found < 0 ? 999 : found; };
  return index(left) - index(right) || left.localeCompare(right, "es");
}

const ENGLISH_VARIANTS: Record<string, string> = {
  General: "General", Violencia: "Violent", "Precisión": "Precision", "Energía de aberración": "Deviant Energy", Supervivencia: "Survival",
  Quemadura: "Burn", "Sobretensión": "Power Surge", "Vórtice de escarcha": "Frost Vortex", Diana: "The Bull's Eye", "Guerra de fortalezas": "Fortress Warfare", Metralla: "Shrapnel", "Disparo rápido": "Fast Gunner", "Bombardero inestable": "Unstable Bomber", Rebote: "Bounce",
  Resonancia: "Resonance", "Energía de aberración resonante": "Resonant Deviant Energy", Lunar: "Lunar", "Energía de aberración lunar": "Lunar Deviant Energy", Batalla: "Battle",
  Espejo: "Mirror", "Energía de aberración de espejo": "Mirror Deviant Energy", "Fantasmagórico": "Phantasm", "Energía de aberración espectral": "Phantasm Deviant Energy", Salvaje: "Wild", "Energía de Aberración Salvaje": "Wild Deviant Energy",
  Aero: "Aero", "Energía de aberración aérea": "Aero Deviant Energy", Creciente: "Crescent", "Energía de aberración creciente": "Crescent Deviant Energy", "Estrella Descendente": "Downstar", "Energía de aberración de estrella descendente": "Downstar Deviant Energy", "Melee Predeterminado": "Melee Default",
};

export function modVariantName(variant: string, english = false) {
  return english ? ENGLISH_VARIANTS[variant] ?? variant : variant;
}

const verifiedFamilyNames = new Map(collectionOrderData.familyNames.map(item => [`${item.groupId}:${item.baseName}`, item.displayName]));

function collectionGroup(entry: ShinyModCatalogItem): ShinyModCatalogItem {
  const displayName = verifiedFamilyNames.get(`${entry.groupId}:${entry.baseName}`);
  const item = displayName ? { ...entry, baseName: displayName, searchAliases: [...(entry.searchAliases ?? []), entry.baseName] } : entry;
  if (item.category !== "weapon" || item.groupId !== "weapon-todas-las-armas") return item;
  const group = item.baseEnglishName === "Flame Resonance" ? ["weapon-burn", "Quemadura"]
    : item.baseEnglishName === "Cryo Catalyst" ? ["weapon-frost-vortex", "Vórtice de escarcha"]
    : ["Boomerang Bullet", "Multi-Bounce"].includes(item.baseEnglishName) ? ["weapon-bounce", "Rebote"] : undefined;
  return group ? { ...item, groupId: group[0], groupName: `Arma · ${group[1]}` } : item;
}

const slug = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
const abyssItems: ShinyModCatalogItem[] = abyssData.mods.flatMap((mod) => mod.variants.map((variant) => ({
  id: `abyss-${mod.id}-${slug(variant)}`, itemId: "", name: `${mod.name} <${variant}>`,
  englishName: `${mod.englishName} <${modVariantName(variant, true)}>`, baseName: mod.name, baseEnglishName: mod.englishName,
  variant, levelLabel: "Nivel 1–17", applyRange: mod.applyRange, modType: "", system: "new",
  isCatalogShiny: false, sourceTier: 1, category: "armor", groupId: mod.groupId,
  groupName: `Armadura · ${mod.applyRange}`, scenarioId: abyssData.scenarioId, sourceUrl: mod.sourceUrl,
})));

export function compareModCatalogItems(left: ShinyModCatalogItem, right: ShinyModCatalogItem) {
  const groupDifference = (groupOrder.get(left.groupId) ?? 999) - (groupOrder.get(right.groupId) ?? 999);
  if (groupDifference !== 0) return groupDifference;
  const nameDifference = (baseOrder.get(`${left.groupId}:${left.baseName}:${left.scenarioId ?? ""}`) ?? Number.MAX_SAFE_INTEGER) - (baseOrder.get(`${right.groupId}:${right.baseName}:${right.scenarioId ?? ""}`) ?? Number.MAX_SAFE_INTEGER);
  if (nameDifference !== 0) return nameDifference;
  const variantDifference = compareModVariants(left.variant, right.variant);
  if (variantDifference !== 0) return variantDifference;
  if (left.isCatalogShiny !== right.isCatalogShiny) return left.isCatalogShiny ? 1 : -1;
  return left.itemId.localeCompare(right.itemId, "es", { numeric: true });
}

const items = [...document.records.filter((item) => !item.isCatalogShiny).map(collectionGroup), ...abyssItems];
const collectionOrders = collectionOrderData.groups as Record<string, { baseName: string; scenarioId?: string }[]>;
const verifiedFamilyOrder = new Map<string, number>(Object.entries(collectionOrders).flatMap(([groupId, families]) => families.map((family, index) => [`${groupId}:${family.baseName}:${family.scenarioId ?? ""}`, index] as const)));
const baseOrder = new Map<string, number>();
for (const [index, item] of items.entries()) {
  const key = `${item.groupId}:${item.baseName}:${item.scenarioId ?? ""}`;
  baseOrder.set(key, verifiedFamilyOrder.get(key) ?? Math.min(baseOrder.get(key) ?? Infinity, Number(item.itemId) || 99_000_000 + index));
}
export const SHINY_MOD_CATALOG = items.sort(compareModCatalogItems);
const catalogAliases = new Map(SHINY_MOD_CATALOG.flatMap((item) => [item.id, ...(item.legacyShinyIds ?? [])].map((id) => [id, item.id] as const)));

export function canonicalModCatalogId(id?: string) {
  return id ? catalogAliases.get(id) ?? id : undefined;
}
export const SHINY_MOD_CATALOG_META = {
  sourceUrl: document.sourceUrl,
  sourceCheckedAt: document.sourceCheckedAt,
  total: SHINY_MOD_CATALOG.length,
  normal: SHINY_MOD_CATALOG.length,
  shiny: 0,
  abyssCheckedAt: abyssData.checkedAt,
  abyssSourceUrl: abyssData.officialSourceUrl,
  abyssCount: abyssItems.length,
};

const groups = new Map<string, ShinyModCatalogGroup>();
for (const item of SHINY_MOD_CATALOG) {
  const current = groups.get(item.groupId);
  if (current) current.count += 1;
  else groups.set(item.groupId, { id: item.groupId, name: item.groupName, category: item.category, count: 1 });
}

export const SHINY_MOD_GROUPS = [...groups.values()].sort((left, right) => {
  const orderDifference = (groupOrder.get(left.id) ?? 999) - (groupOrder.get(right.id) ?? 999);
  if (orderDifference !== 0) return orderDifference;
  return left.name.localeCompare(right.name, "es");
});

export function catalogStatusLabel(item: Pick<ShinyModCatalogItem, "levelLabel">) {
  return item.levelLabel;
}

export function catalogOriginLabel(_item: Pick<ShinyModCatalogItem, "system">) {
  return "Sistema actual";
}

export function normalizeModSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

export function matchesModSearch(item: ShinyModCatalogItem, search: string) {
  if (!search) return true;
  const haystack = normalizeModSearch([
    item.name,
    item.englishName,
    item.baseName,
    item.baseEnglishName,
    item.variant,
    modVariantName(item.variant, true),
    item.applyRange,
    item.modType,
    item.groupName,
    catalogStatusLabel(item),
    catalogOriginLabel(item),
    item.itemId,
    ...(item.legacyShinyItemIds ?? []),
    ...(item.searchAliases ?? []),
  ].join(" "));
  return search.split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
}
