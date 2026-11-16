import { Clock3, ExternalLink, Music2 } from "lucide-react";
import type { Vision } from "./model";
import { formatDuration } from "./model";
import { localeForLanguage, type UiLanguage } from "./i18n";

export function visionChangeDate(vision: Vision, language: UiLanguage) {
  return vision.startsAt ? new Date(vision.startsAt).toLocaleString(localeForLanguage(language), {
    dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota",
  }) : "";
}

export function VisionScheduleNotice({ vision, currentVision, now, language, onDetails }: { vision?: Vision; currentVision?: Vision; now: number; language: UiLanguage; onDetails: () => void }) {
  if (!vision?.startsAt || Date.parse(vision.startsAt) <= now) return null;
  const english = language !== "es";
  const remainingMs = Date.parse(vision.startsAt) - now;
  const endingSoon = !!currentVision && remainingMs <= 7 * 86_400_000;
  const name = currentVision && (english ? currentVision.englishName || currentVision.name : currentVision.name);
  return <aside className={`vision-schedule-notice ${endingSoon ? "ending-soon" : ""} ${remainingMs <= 86_400_000 ? "urgent" : ""}`} aria-label={english ? "Vision season change" : "Fin de la rueda visional"}>
    <Clock3 size={19} aria-hidden="true" />
    <div><strong>{endingSoon ? (english ? `${name} is ending soon` : `${name} está por acabar`) : (english ? vision.englishName || vision.name : vision.name)}</strong><span>{vision.transitionReason === "maintenance-start" ? (english ? "Changes when maintenance begins" : "Cambia al comenzar el mantenimiento") : (english ? "Automatic change" : "Cambio automático")}: {visionChangeDate(vision, language)} · {english ? "Colombia time" : "hora de Colombia"}</span></div>
    <time className="vision-season-countdown" dateTime={vision.startsAt} aria-label={english ? "Time until season change" : "Tiempo para el cambio de rueda"}>{formatDuration(remainingMs)}</time>
    <button type="button" className="link-button" onClick={onDetails}>{english ? "Details" : "Ver detalles"}</button>
  </aside>;
}

export function VisionInformation({ vision, now, language }: { vision: Vision; now: number; language: UiLanguage }) {
  if (!vision.information) return null;
  const english = language !== "es";
  const upcoming = !!vision.startsAt && Date.parse(vision.startsAt) > now;
  return <article className="vision-information panel" data-vision={vision.id}>
    <header><Music2 size={25} aria-hidden="true" /><div><span className="eyebrow">{english ? "VISION INFORMATION" : "INFORMACIÓN DE LA RUEDA"}</span><h2>{english ? vision.englishName || vision.name : vision.name}</h2></div></header>
    {vision.startsAt && <div className="vision-change-date"><Clock3 size={17} aria-hidden="true" /><div><strong>{vision.transitionReason === "maintenance-start" ? (english ? "Changes when maintenance begins" : "Cambia al comenzar el mantenimiento") : (english ? "Automatic change of the tracker" : "Cambio automático del contador")}: {visionChangeDate(vision, language)} ({english ? "Colombia" : "hora de Colombia"})</strong><span>{upcoming ? `${english ? "In" : "Faltan"} ${formatDuration(Date.parse(vision.startsAt) - now)}. ` : ""}{english ? "The tracker changes at the start of maintenance, without waiting for servers to reopen." : "El contador cambia al iniciar el mantenimiento, sin esperar a que los servidores vuelvan a abrir."}</span></div></div>}
    <ul>{(english ? vision.information.en : vision.information.es).map((line) => <li key={line}>{line}</li>)}</ul>
    {vision.cycleConfirmed === false && <p className="vision-unconfirmed">{english ? "Event cycle and reward points await confirmation. Tracking buttons will become available when their values are published." : "Ciclo horario y puntos de recompensa por confirmar. Los botones para anotar se habilitarán cuando se publiquen sus valores."}</p>}
    <a href={vision.information.sourceUrl} target="_blank" rel="noreferrer">{english ? "Official announcement" : "Anuncio oficial"}<ExternalLink size={14} /></a>
  </article>;
}
