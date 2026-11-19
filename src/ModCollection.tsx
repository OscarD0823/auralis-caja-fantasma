import { memo, useMemo, useState } from "react";
import { Check, Gem, Minus, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import type { ShinyModRecord } from "./model";
import { createId } from "./model";
import type { UiLanguage } from "./i18n";
import type { ShinyModCatalogItem } from "./shinyModsCatalog";
import { mergeModProgress, modLevel, setModProgress, type ModProgressValue } from "./modProgress";
import "./modCollection.css";

type CatalogModule = typeof import("./shinyModsCatalog");
type Props = {
  catalog: CatalogModule;
  records: ShinyModRecord[];
  language: UiLanguage;
  onChange: (update: (records: ShinyModRecord[]) => ShinyModRecord[]) => void;
};

function ModCollection({ catalog, records, language, onChange }: Props) {
  const en = language !== "es";
  const tx = (es: string, english: string) => en ? english : es;
  const [piece, setPiece] = useState("weapon");
  const [style, setStyle] = useState("weapon-burn");
  const [variant, setVariant] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState("");
  const { SHINY_MOD_CATALOG: items, SHINY_MOD_GROUPS: groups, canonicalModCatalogId: canonical, normalizeModSearch } = catalog;
  const buckets = useMemo(() => {
    const result = new Map<string, ShinyModRecord[]>();
    for (const record of records) {
      const key = canonical(record.catalogId);
      if (key) result.set(key, [...(result.get(key) ?? []), record]);
    }
    return result;
  }, [records, canonical]);
  const progress = (item: ShinyModCatalogItem) => (buckets.get(item.id) ?? []).reduce<ShinyModRecord | undefined>((a, b) => a ? mergeModProgress(a, b) : b, undefined);
  const owned = items.filter(item => (modLevel(progress(item)) ?? 0) > 0);
  const shiny = owned.filter(item => progress(item)?.isShiny);
  const ready = owned.filter(item => modLevel(progress(item)) === 17 && !progress(item)?.isShiny);
  const normalizedSearch = normalizeModSearch(search);
  const visible = items.filter(item => {
    if (piece !== "all" && (piece === "weapon" ? item.groupId !== style : item.groupId !== piece)) return false;
    if (variant !== "all" && item.variant !== variant) return false;
    if (!catalog.matchesModSearch(item, normalizedSearch)) return false;
    const record = progress(item), level = modLevel(record);
    return status === "all" || (status === "owned" && (level ?? 0) > 0) || (status === "missing" && level === 0)
      || (status === "ready" && level === 17 && !record?.isShiny) || (status === "shiny" && record?.isShiny)
      || (status === "abyss" && item.scenarioId === "isles-of-abyss")
      || (status === "resonance" && item.visionId === "resonance");
  });
  const rows = new Map<string, { item: ShinyModCatalogItem; variants: ShinyModCatalogItem[] }>();
  for (const item of visible) {
    const key = `${item.groupId}:${item.baseName}:${item.scenarioId ?? ""}`;
    const row = rows.get(key);
    if (row) row.variants.push(item);
    else rows.set(key, { item, variants: [item] });
  }
  const availableVariants = [...new Set(items.filter(item => piece === "all" || (piece === "weapon" ? item.groupId === style : item.groupId === piece)).map(item => item.variant))].sort(catalog.compareModVariants);
  const catalogIds = new Set(items.map(item => item.id));
  const otherRecords = records.filter(record => !record.catalogId || !catalogIds.has(canonical(record.catalogId)!));

  const setLevel = (item: ShinyModCatalogItem, value: ModProgressValue) => onChange(current => {
    const matching = current.filter(record => canonical(record.catalogId) === item.id);
    if (matching.length) return current.map(record => matching.some(match => match.id === record.id) ? setModProgress(record, value) : record);
    const now = new Date().toISOString();
    const record: ShinyModRecord = {
      id: `mod:${item.id}`, catalogId: item.id, modName: item.baseName, englishName: item.baseEnglishName,
      groupName: item.groupName, variant: item.variant, attempts: 0, isShiny: false, createdAt: now,
    };
    return [setModProgress(record, value, now), ...current];
  });
  const adjustAttempts = (matching: ShinyModRecord[], amount: number) => {
    const target = amount < 0 ? matching.find(record => record.attempts > 0) : matching[0];
    if (target) onChange(current => current.map(record => record.id === target.id ? { ...record, attempts: Math.min(100_000, Math.max(0, record.attempts + amount)) } : record));
  };
  const changePiece = (value: string) => { setPiece(value); setVariant("all"); };

  return <section className="page mod-collection-page">
    <div className="mod-collection-summary panel">
      <div><span className="eyebrow"><Gem size={15} /> {tx("COLECCIÓN DE MÓDULOS", "MOD COLLECTION")}</span><h2>{tx("Tu nivel, en cada variante", "Your level, for every variant")}</h2><p>{tx("Anota el nivel que te salió, súbelo hasta 17 y marca Brillante cuando lo consigas.", "Record the level you obtained, increase it up to 17, and mark Shiny when you get it.")}</p></div>
      <div className="mod-collection-stats"><span><strong>{owned.length}<small> / {items.length}</small></strong>{tx("Con nivel registrado", "With a recorded level")}</span><span><strong>{ready.length}</strong>{tx("En nivel 17", "At level 17")}</span><span><strong>{shiny.length}</strong>Shiny</span></div>
    </div>

    <article className="panel mod-collection-panel">
      <nav className="mod-piece-tabs" aria-label={tx("Pieza del módulo", "Mod slot")}>
        {catalog.MOD_PIECES.map(entry => <button type="button" key={entry.id} className={piece === entry.id ? "active" : ""} aria-pressed={piece === entry.id} onClick={() => changePiece(entry.id)}>{en ? entry.en : entry.es}</button>)}
        <button type="button" className={piece === "all" ? "active" : ""} aria-pressed={piece === "all"} onClick={() => changePiece("all")}>{tx("Todas", "All")}</button>
      </nav>
      {piece === "weapon" && <nav className="mod-style-tabs" aria-label={tx("Estilo del arma", "Weapon build")}>{groups.filter(group => group.category === "weapon").map(group => <button type="button" key={group.id} aria-pressed={style === group.id} className={style === group.id ? "active" : ""} onClick={() => { setStyle(group.id); setVariant("all"); }}>{catalog.modVariantName(group.name.replace("Arma · ", ""), en)}</button>)}</nav>}
      <div className="mod-collection-filters">
        <label className="mod-search"><span>{tx("Buscar módulo", "Find a mod")}</span><div><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={tx("Nombre en español o inglés, variante o ID", "Spanish or English name, variant, or ID")} /></div></label>
        <label>{tx("Variante", "Variant")}<select value={variant} onChange={event => setVariant(event.target.value)}><option value="all">{tx("Todas las variantes", "All variants")}</option>{availableVariants.map(value => <option key={value} value={value}>{catalog.modVariantName(value, en)}</option>)}</select></label>
        <label>{tx("Mostrar", "Show")}
          <select value={status} onChange={event => {
            const value = event.target.value;
            setStatus(value);
            if (value === "abyss" || value === "resonance") changePiece("all");
          }}>
            <option value="all">{tx("Todos", "All")}</option>
            <option value="owned">{tx("Los que tengo", "Owned")}</option>
            <option value="missing">{tx("No los tengo", "Missing")}</option>
            <option value="ready">{tx("Nivel 17", "Level 17")}</option>
            <option value="shiny">Shiny</option>
            <option value="abyss">{tx("Islas del Abismo", "Isles of Abyss")}</option>
            <option value="resonance">{tx("Nuevas · Resonancia discordante", "New · Dissonant Resonance")}</option>
          </select>
        </label>
      </div>
      <div className="mod-collection-result-count"><span>{rows.size} {tx("módulos", "mods")} · {visible.length} {tx("variantes", "variants")}</span><small>{tx("Cada variante guarda su propio nivel e intentos.", "Each variant keeps its own level and attempts.")}</small></div>
      <div className="mod-collection-scroll" tabIndex={0} aria-label={tx("Módulos y variantes", "Mods and variants")}>
        {[...rows.entries()].map(([key, row]) => <section className="mod-family-row" key={key} data-mod-family={row.item.baseEnglishName}>
          <header><span>{row.item.groupName}</span><h3>{en ? row.item.baseEnglishName : row.item.baseName}</h3>{!en && <small>{row.item.baseEnglishName}</small>}{row.item.scenarioId && <b className="mod-abyss-badge">{tx("NUEVO · ISLAS DEL ABISMO", "NEW · ISLES OF ABYSS")}</b>}</header>
          <div className="mod-variant-grid">{row.variants.map(item => {
            const matching = buckets.get(item.id) ?? [], record = progress(item);
            return <ModVariantCard key={item.id} itemId={item.id} name={`${row.item.baseName} · ${item.variant}`} variant={catalog.modVariantName(item.variant, en)} record={record} attempts={matching.reduce((sum, entry) => sum + entry.attempts, 0)} en={en} onLevel={value => setLevel(item, value)} onAttempt={amount => adjustAttempts(matching, amount)} />;
          })}</div>
        </section>)}
        {visible.length === 0 && <div className="empty-card"><Search size={25} /><strong>{tx("No hay módulos con estos filtros", "No mods match these filters")}</strong><button type="button" className="secondary compact" onClick={() => { setPiece("all"); setVariant("all"); setStatus("all"); setSearch(""); }}>{tx("Ver toda la colección", "View the whole collection")}</button></div>}
      </div>
      <p className="mod-collection-note">{tx("Los seguimientos anteriores conservan sus intentos. Si no tenían nivel anotado, aparecen como «Sin nivel» hasta que lo indiques.", "Previous trackers retain their attempts. Those without a recorded level show ‘Level unknown’ until you enter it.")}</p>
      <p className="mod-collection-note"><a href={catalog.SHINY_MOD_CATALOG_META.abyssSourceUrl} target="_blank" rel="noreferrer">{tx("Módulos del mapa acuático · anuncio oficial", "Ocean map mods · official announcement")}</a> · {tx("Los nombres en inglés permiten distinguir Carga de precisión (Precision Load) de Precision Charge.", "English names distinguish Precision Load from Precision Charge.")}</p>
    </article>

    <details className="panel mod-custom-records"><summary>{tx("Otros registros y módulos personalizados", "Other records and custom mods")} ({otherRecords.length})</summary>
      <form className="mod-custom-form" onSubmit={event => { event.preventDefault(); const name = custom.trim(); if (!name) return; onChange(current => [{ id: createId("shiny"), modName: name, groupName: tx("Módulo personalizado", "Custom mod"), variant: tx("Personalizado", "Custom"), attempts: 0, isShiny: false, level: 0, createdAt: new Date().toISOString() }, ...current]); setCustom(""); }}><label>{tx("Nombre del módulo", "Mod name")}<input value={custom} onChange={event => setCustom(event.target.value)} maxLength={120} /></label><button type="submit" className="secondary" disabled={!custom.trim()}><Plus size={16} />{tx("Agregar", "Add")}</button></form>
      <div className="mod-custom-grid">{otherRecords.map(record => <article key={record.id}><header><div><strong>{record.modName}</strong><small>{record.groupName}</small></div><button type="button" className="shiny-delete" aria-label={`${tx("Eliminar", "Delete")} ${record.modName}`} onClick={() => onChange(current => current.filter(item => item.id !== record.id))}><Trash2 size={15} /></button></header><ModVariantCard itemId={record.id} name={record.modName} variant={record.variant} record={record} attempts={record.attempts} en={en} onLevel={value => onChange(current => current.map(item => item.id === record.id ? setModProgress(item, value) : item))} onAttempt={amount => adjustAttempts([record], amount)} /></article>)}</div>
    </details>
  </section>;
}

export default memo(ModCollection);

function ModVariantCard({ itemId, name, variant, record, attempts, en, onLevel, onAttempt }: {
  itemId: string; name: string; variant: string; record?: ShinyModRecord; attempts: number; en: boolean;
  onLevel: (value: ModProgressValue) => void; onAttempt: (amount: number) => void;
}) {
  const level = modLevel(record);
  const value = record?.isShiny ? "shiny" : level === undefined ? "unknown" : String(level);
  return <div className={`mod-variant-card ${record?.isShiny ? "is-shiny" : level ? "is-owned" : ""}`} data-mod-id={itemId}>
    <div className="mod-variant-title"><strong>{variant}</strong><span>{record?.isShiny ? <><Sparkles size={12} /> Shiny</> : level === undefined ? (en ? "Level unknown" : "Sin nivel") : level === 0 ? (en ? "Missing" : "No lo tengo") : `${en ? "Lv." : "Nv."} ${level}`}</span></div>
    <div className="mod-level-controls"><select aria-label={`${en ? "Level of" : "Nivel de"} ${name}`} value={value} onChange={event => onLevel(event.target.value === "shiny" ? "shiny" : Number(event.target.value))}>
      {level === undefined && <option value="unknown" disabled>{en ? "Level unknown" : "Sin nivel"}</option>}
      <option value="0">{en ? "I don't have it" : "No lo tengo"}</option>{Array.from({ length: 17 }, (_, index) => <option key={index + 1} value={index + 1}>{en ? "Level" : "Nivel"} {index + 1}</option>)}<option value="shiny">{en ? "Shiny obtained" : "Brillante (Shiny)"}</option>
    </select><button type="button" disabled={record?.isShiny} aria-label={`${level === 17 ? (en ? "Mark Shiny" : "Marcar Shiny") : (en ? "Increase level" : "Subir nivel")} · ${name}`} onClick={() => onLevel(level === 17 ? "shiny" : (level ?? 0) + 1)}>{record?.isShiny ? <Check size={17} /> : level === 17 ? <Gem size={17} /> : <Plus size={17} />}</button></div>
    {(level === 17 || attempts > 0) && <div className="mod-attempt-controls"><span>{attempts} {en ? "failed +17" : "+17 fallidos"}</span><button type="button" disabled={attempts === 0} aria-label={`${en ? "Subtract attempt" : "Restar intento"} · ${name}`} onClick={() => onAttempt(-1)}><Minus size={13} /></button><button type="button" disabled={level !== 17 || record?.isShiny} aria-label={`${en ? "Another +17 failed" : "Otro +17 no se convirtió"} · ${name}`} onClick={() => onAttempt(1)}><Plus size={13} /></button></div>}
  </div>;
}
