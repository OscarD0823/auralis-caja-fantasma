import catalogData from "../catalog/shiny-mods.json" with { type: "json" };

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
  "weapon-fast-gunner",
  "weapon-burn",
  "weapon-power-surge",
  "weapon-frost-vortex",
  "weapon-the-bull-s-eye",
  "weapon-fortress-warfare",
  "weapon-unstable-bomber",
  "weapon-bounce",
  "weapon-shrapnel",
  "weapon-todas-las-armas",
  "weapon-arma-a-distancia",
  "weapon-arma-cuerpo-a-cuerpo",
  "armor-casco",
  "armor-mascara",
  "armor-parte-superior",
  "armor-guantes",
  "armor-pantalones",
  "armor-zapatos",
  "armor-toda-la-armadura",
] as const;

const groupOrder = new Map<string, number>(GROUP_ORDER.map((id, index) => [id, index]));

export function compareModCatalogItems(left: ShinyModCatalogItem, right: ShinyModCatalogItem) {
  const groupDifference = (groupOrder.get(left.groupId) ?? 999) - (groupOrder.get(right.groupId) ?? 999);
  if (groupDifference !== 0) return groupDifference;
  const nameDifference = left.baseName.localeCompare(right.baseName, "es");
  if (nameDifference !== 0) return nameDifference;
  const variantDifference = left.variant.localeCompare(right.variant, "es");
  if (variantDifference !== 0) return variantDifference;
  if (left.isCatalogShiny !== right.isCatalogShiny) return left.isCatalogShiny ? 1 : -1;
  return left.itemId.localeCompare(right.itemId, "es", { numeric: true });
}

export const SHINY_MOD_CATALOG = document.records.filter((item) => !item.isCatalogShiny).sort(compareModCatalogItems);
const catalogAliases = new Map(SHINY_MOD_CATALOG.flatMap((item) => [item.id, ...(item.legacyShinyIds ?? [])].map((id) => [id, item.id] as const)));

export function canonicalModCatalogId(id?: string) {
  return id ? catalogAliases.get(id) ?? id : undefined;
}
export const SHINY_MOD_CATALOG_META = {
  sourceUrl: document.sourceUrl,
  sourceCheckedAt: document.sourceCheckedAt,
  ...document.counts,
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
    item.applyRange,
    item.modType,
    item.groupName,
    catalogStatusLabel(item),
    catalogOriginLabel(item),
    item.itemId,
    ...(item.legacyShinyItemIds ?? []),
  ].join(" "));
  return search.split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
}
