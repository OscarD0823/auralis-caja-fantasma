// Conserva los ID anteriores como alias de búsqueda, sin duplicar los módulos.
export function normalModCatalog(records) {
  const normal = records.filter((item) => !item.isCatalogShiny).map((item) => ({ ...item, legacyShinyIds: [], legacyShinyItemIds: [] }));
  for (const shiny of records.filter((item) => item.isCatalogShiny)) {
    const matches = normal.filter((item) => item.baseName === shiny.baseName && item.variant === shiny.variant && item.groupId === shiny.groupId);
    if (matches.length !== 1) throw new Error(`Equivalente normal ambiguo o ausente para ${shiny.id}.`);
    matches[0].legacyShinyIds.push(shiny.id);
    matches[0].legacyShinyItemIds.push(shiny.itemId);
  }
  return normal;
}
