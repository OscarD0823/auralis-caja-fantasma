import { useRef, useState, type ReactNode } from "react";
import { ChevronRight, Moon, Snowflake, Swords, Waves } from "lucide-react";
import type { Activity, ActivityMapId, Vision } from "./model";
import { activitiesByMap } from "./activityMaps";
import type { UiLanguage } from "./i18n";
import { activityMapName } from "./gameNames";

const MAP_PREFERENCE = "caja-fantasma.activity-map.v1";
const MAP_ICONS = { manibus: Swords, dream: Moon, abyss: Waves, winter: Snowflake };
type ScenarioMapId = Exclude<ActivityMapId, "general">;

export default function ActivityMapBoard({ activities, vision, language, renderActivity, onViewVision }: {
  activities: Activity[];
  vision?: Vision;
  language: UiLanguage;
  renderActivity: (activity: Activity, vision?: Vision) => ReactNode;
  onViewVision: () => void;
}) {
  const english = language !== "es";
  const groups = activitiesByMap(activities);
  const general = groups[0];
  const scenarios = groups.filter((map) => map.id !== "general");
  const [selected, setSelected] = useState<ScenarioMapId>(() => {
    try {
      const saved = localStorage.getItem(MAP_PREFERENCE);
      if (scenarios.some((map) => map.id === saved)) return saved as ScenarioMapId;
    } catch { /* A blocked preference must not block counters. */ }
    return "manibus";
  });
  const tabs = useRef<HTMLDivElement>(null);
  const active = scenarios.find((map) => map.id === selected)!;
  const select = (id: ScenarioMapId) => {
    setSelected(id);
    try { localStorage.setItem(MAP_PREFERENCE, id); } catch { /* Preference only. */ }
  };

  return <section className="activity-board" aria-label={english ? "Quick reward tracking" : "Registro rápido de recompensas"}>
    <div className="common-activity-groups">
      <section className="quick-activity-group" aria-label={activityMapName(general.id, language)}>
        <header><h2>{activityMapName(general.id, language)}</h2><small>{english ? general.englishDescription : general.description}</small></header>
        <div className="activity-grid quick-activity-grid">{general.activities.map((activity) => renderActivity(activity))}</div>
      </section>
      <section className="quick-activity-group vision-activity-group" aria-label={english ? "Active wheel rewards" : "Recompensas de la visión activa"}>
        <header><div><small>{english ? "ACTIVE WHEEL" : "VISIÓN ACTIVA"}</small><h2>{vision ? (english ? vision.englishName || vision.name : vision.name) : (english ? "No wheel" : "Sin visión")}</h2></div><button type="button" className="link-button" onClick={onViewVision}>{english ? "Countdown" : "Contador"}<ChevronRight size={14} /></button></header>
        <div className="activity-grid quick-activity-grid">{vision?.activities.length ? vision.activities.map((activity) => renderActivity(activity, vision)) : <p className="activity-map-empty">{english ? "No rewards configured for this wheel." : "Esta visión aún no tiene recompensas configuradas."}</p>}</div>
      </section>
    </div>
    <section className={`scenario-activity-panel map-${active.id}`}>
      <div className="scenario-activity-heading">
        <div><span className="eyebrow">{english ? "MAP ACTIVITIES" : "ACTIVIDADES POR MAPA"}</span><p>{english ? active.englishDescription : active.description}</p></div>
        <div ref={tabs} className="activity-map-tabs" role="tablist" aria-label={english ? "Select map" : "Seleccionar mapa"} onKeyDown={(event) => {
          const index = scenarios.findIndex((map) => map.id === selected);
          const next = event.key === "ArrowRight" ? (index + 1) % scenarios.length : event.key === "ArrowLeft" ? (index + scenarios.length - 1) % scenarios.length : event.key === "Home" ? 0 : event.key === "End" ? scenarios.length - 1 : undefined;
          if (next === undefined) return;
          event.preventDefault();
          select(scenarios[next].id as ScenarioMapId);
          tabs.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
        }}>
          {scenarios.map((map) => {
            const Icon = MAP_ICONS[map.id as ScenarioMapId];
            return <button key={map.id} id={`activity-map-tab-${map.id}`} type="button" role="tab" title={map.englishName} aria-selected={selected === map.id} aria-controls="activity-map-panel" tabIndex={selected === map.id ? 0 : -1} className={selected === map.id ? "selected" : ""} onClick={() => select(map.id as ScenarioMapId)}><Icon size={17} aria-hidden="true" /><span>{activityMapName(map.id, language)}</span><small>{map.activities.length}</small></button>;
          })}
        </div>
      </div>
      <div id="activity-map-panel" role="tabpanel" aria-labelledby={`activity-map-tab-${selected}`} tabIndex={0} className="activity-grid map-activity-grid">{active.activities.length ? active.activities.map((activity) => renderActivity(activity)) : <p className="activity-map-empty">{english ? "No activities configured for this map yet." : "Aún no hay actividades configuradas para este mapa."}</p>}</div>
    </section>
  </section>;
}
