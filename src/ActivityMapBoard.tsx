import { useRef, useState, type ReactNode } from "react";
import { ChevronRight, Gem, Moon, Snowflake, Swords, Waves } from "lucide-react";
import type { Activity, ActivityMapId, Vision } from "./model";
import { activitiesByMap, isPrimeWarCrate, PRIME_WAR_CRATES, PRIME_WAR_DIFFICULTIES, primeWarCrateId, type PrimeWarDifficulty } from "./activityMaps";
import type { UiLanguage } from "./i18n";
import { activityMapName, primeWarCrateName, primeWarDifficultyName } from "./gameNames";

const MAP_PREFERENCE = "caja-fantasma.activity-map.v1";
const PRIME_WAR_PREFERENCE = "caja-fantasma.prime-war-difficulty";
const MAP_ICONS = { manibus: Swords, dream: Moon, abyss: Waves, winter: Snowflake, prism: Gem };
type ScenarioMapId = Exclude<ActivityMapId, "general">;
type RenderActivity = (activity: Activity, vision?: Vision, displayName?: string) => ReactNode;

export default function ActivityMapBoard({ activities, vision, language, renderActivity, onViewVision }: {
  activities: Activity[];
  vision?: Vision;
  language: UiLanguage;
  renderActivity: RenderActivity;
  onViewVision: () => void;
}) {
  const english = language !== "es";
  const groups = activitiesByMap(activities);
  const general = groups[0];
  const scenarios = groups.filter((map) => map.id !== "general");
  const resonanceActive = vision?.id === "resonance";
  const wheelActivities = vision?.activities ?? [];
  const wheelGroups = resonanceActive ? [
    { id: "echo", title: english ? "The Echo" : "El Eco", activities: wheelActivities.filter((activity) => activity.id.startsWith("echo-war-")) },
    { id: "movements", title: english ? "Resonant Movements" : "Movimientos Resonantes", activities: wheelActivities.filter((activity) => activity.id.startsWith("movement-")) },
    { id: "other", title: english ? "Other rewards" : "Otras recompensas", activities: wheelActivities.filter((activity) => !activity.id.startsWith("echo-war-") && !activity.id.startsWith("movement-")) },
  ].filter((group) => group.activities.length > 0) : [];
  const [selected, setSelected] = useState<ScenarioMapId>(() => {
    try {
      const saved = localStorage.getItem(MAP_PREFERENCE);
      if (scenarios.some((map) => map.id === saved)) return saved as ScenarioMapId;
    } catch { /* A blocked preference must not block counters. */ }
    return "manibus";
  });
  const tabs = useRef<HTMLDivElement>(null);
  const active = scenarios.find((map) => map.id === selected)!;
  const primeWarActivities = active.id === "manibus" ? active.activities.filter((activity) => isPrimeWarCrate(activity.id)) : [];
  const mapActivities = primeWarActivities.length > 0
    ? active.activities.filter((activity) => activity.id !== "pro-war" && !isPrimeWarCrate(activity.id))
    : active.activities;
  const select = (id: ScenarioMapId) => {
    setSelected(id);
    try { localStorage.setItem(MAP_PREFERENCE, id); } catch { /* Preference only. */ }
  };

  const generalRewards = (
    <section className="quick-activity-group general-activity-group" aria-label={activityMapName(general.id, language)}>
      <header><h2>{activityMapName(general.id, language)}</h2><small>{english ? general.englishDescription : general.description}</small></header>
      <div className="activity-grid quick-activity-grid">{general.activities.map((activity) => renderActivity(activity))}</div>
    </section>
  );
  const wheelRewards = (
    <section className="quick-activity-group vision-activity-group" aria-label={english ? "Active wheel rewards" : "Recompensas de la visión activa"}>
      <header>
        <div><small>{english ? "ACTIVE WHEEL" : "VISIÓN ACTIVA"}</small><h2>{vision ? (english ? vision.englishName || vision.name : vision.name) : (english ? "No wheel" : "Sin visión")}</h2></div>
        <button type="button" className="link-button" onClick={onViewVision}>{english ? "Countdown" : "Contador"}<ChevronRight size={14} /></button>
      </header>
      {wheelGroups.length > 0 ? (
        <div className="vision-reward-groups">
          {wheelGroups.map((group) => (
            <section key={group.id} className={`vision-reward-block reward-block-${group.id}`} aria-labelledby={`wheel-rewards-${group.id}`}>
              <h3 id={`wheel-rewards-${group.id}`}>{group.title}</h3>
              <div className="activity-grid compact-activity-grid vision-reward-grid">{group.activities.map((activity) => renderActivity(activity, vision))}</div>
            </section>
          ))}
        </div>
      ) : (
        <div className="activity-grid quick-activity-grid">{wheelActivities.length > 0 ? wheelActivities.map((activity) => renderActivity(activity, vision)) : <p className="activity-map-empty">{english ? "No rewards configured for this wheel." : "Esta visión aún no tiene recompensas configuradas."}</p>}</div>
      )}
    </section>
  );

  return <section className="activity-board" aria-label={english ? "Quick reward tracking" : "Registro rápido de recompensas"}>
    <div className={`common-activity-groups ${resonanceActive ? "resonance-activity-layout" : ""}`}>
      {resonanceActive ? <>{wheelRewards}{generalRewards}</> : <>{generalRewards}{wheelRewards}</>}
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
      <div id="activity-map-panel" role="tabpanel" aria-labelledby={`activity-map-tab-${selected}`} tabIndex={0} className="scenario-map-rewards">
        {primeWarActivities.length > 0 && <PrimeWarRewards activities={primeWarActivities} language={language} renderActivity={renderActivity} />}
        {mapActivities.length > 0 && <div className="activity-grid map-activity-grid">{mapActivities.map((activity) => renderActivity(activity))}</div>}
        {active.activities.length === 0 && <p className="activity-map-empty">{english ? "No activities configured for this map yet." : "Aún no hay actividades configuradas para este mapa."}</p>}
      </div>
    </section>
  </section>;
}

function PrimeWarRewards({ activities, language, renderActivity }: { activities: Activity[]; language: UiLanguage; renderActivity: RenderActivity }) {
  const english = language !== "es";
  const [preferredDifficulty, setPreferredDifficulty] = useState<PrimeWarDifficulty>(() => {
    try {
      const saved = localStorage.getItem(PRIME_WAR_PREFERENCE);
      return PRIME_WAR_DIFFICULTIES.find((difficulty) => difficulty === saved) ?? "pro";
    } catch {
      return "pro";
    }
  });
  const groups = PRIME_WAR_DIFFICULTIES.map((difficulty) => ({
    difficulty,
    crates: PRIME_WAR_CRATES.flatMap((number) => {
      const activity = activities.find((crate) => crate.id === primeWarCrateId(difficulty, number));
      return activity ? [{ number, activity }] : [];
    }),
  })).filter((group) => group.crates.length > 0);
  const selected = groups.find((group) => group.difficulty === preferredDifficulty) ?? groups[0];
  if (!selected) return null;

  return <section className="prime-war-rewards" aria-labelledby="prime-war-rewards-title">
    <header>
      <h3 id="prime-war-rewards-title">{english ? "The Prime War" : "Guerras primigenias"}</h3>
      <div className="prime-war-difficulties" role="group" aria-label={english ? "War difficulty" : "Dificultad de la guerra"}>
        {groups.map(({ difficulty }) => <button key={difficulty} type="button" aria-pressed={selected.difficulty === difficulty} onClick={() => {
          setPreferredDifficulty(difficulty);
          try { localStorage.setItem(PRIME_WAR_PREFERENCE, difficulty); } catch { /* Preference only. */ }
        }}>{primeWarDifficultyName(difficulty, language)}</button>)}
      </div>
    </header>
    <div className="activity-grid compact-activity-grid prime-war-crates">{selected.crates.map(({ number, activity }) => renderActivity(activity, undefined, primeWarCrateName(number, language)))}</div>
  </section>;
}
