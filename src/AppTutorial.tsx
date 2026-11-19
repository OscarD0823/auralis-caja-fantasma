import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Box, Check, Gem, MonitorSmartphone, ShieldCheck, Users, X } from "lucide-react";
import { translate, type UiLanguage } from "./i18n";
import useDialogFocus from "./useDialogFocus";

export const TUTORIAL_STEPS = [
  { icon: Box, tab: "progress", title: ["Registra tus recompensas", "Track your rewards"], body: ["En Caja, usa + solo al reclamar la recompensa. − corrige el registro de la ronda actual. Cada actividad conserva su valor en puntos.", "In Crate, use + only when you claim a reward. − corrects the current round. Each activity keeps its point value."] },
  { icon: Check, tab: "progress", title: ["Rondas y cajas son distintas", "Rounds and crates are different"], body: ["Guardar ronda pone el parcial en 0 y conserva el total del intento. Cuando recibas la caja, pulsa ¡Salió la caja! para registrar fecha, hora y puntos.", "Save round resets the partial count to 0 and preserves the attempt total. When you receive a crate, select Got the crate! to record its date, time and points."] },
  { icon: Users, tab: "characters", title: ["Cada personaje, su progreso", "Each character has their own progress"], body: ["Crea y selecciona tus personajes desde el menú lateral. El modo Equipo suma la actividad a los integrantes seleccionados sin mezclar sus cajas individuales.", "Create and select characters in the side menu. Team mode adds activity to the selected members without mixing their individual crates."] },
  { icon: Gem, tab: "shiny", title: ["Tu colección Brillante", "Your Shiny collection"], body: ["Busca el módulo por nombre, arma o pieza de armadura. Registra sus intentos de conversión y marca los conseguidos. Los módulos van del nivel 1 al 17 y Brillante.", "Search for a mod by name, weapon or armor slot. Track conversion attempts and mark collected Shiny mods. Mods range from level 1 to 17 and Shiny."] },
  { icon: MonitorSmartphone, tab: "devices", title: ["PC, web y celular juntos", "PC, web and phone together"], body: ["En Dispositivos están las descargas y ambas conexiones. Con PC, usa su IP, puerto y código en los otros dispositivos. Sin PC, comparte desde Android y conecta la web con los datos del celular. Usa la misma red y activa En vivo para reflejar los cambios.", "Devices contains downloads and both connections. With a PC, enter its IP, port and code on the other devices. Without a PC, share from Android and connect the website using the phone details. Use the same network and enable Live to mirror changes."] },
  { icon: ShieldCheck, tab: "settings", title: ["Conserva una copia", "Keep a backup"], body: ["Exporta un respaldo en Configuración antes de cambiar de dispositivo o borrar datos. Guardar y salir guarda y cierra Windows; la X lo deja en la bandeja. Los porcentajes son estimaciones del historial, no tasas oficiales ni garantías.", "Export a backup in Settings before switching devices or clearing data. Save and exit saves and closes Windows; X leaves it in the tray. Percentages are history-based estimates, not official rates or guarantees."] },
] as const;

export default function AppTutorial({ language, onClose, onVisit }: { language: UiLanguage; onClose: () => void; onVisit: (tab: typeof TUTORIAL_STEPS[number]["tab"]) => void }) {
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLElement>(null);
  useDialogFocus(dialog, onClose);
  const step = TUTORIAL_STEPS[index];
  const Icon = step.icon;
  const tx = (es: string, en: string) => translate(language, es, en);
  return <div className="experience-overlay"><section className="tutorial-card" ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
    <button type="button" className="experience-close" onClick={onClose} aria-label={tx("Cerrar tutorial", "Close tutorial")}><X size={20} /></button>
    <span className="eyebrow">{tx("GUÍA DE CAMPO", "FIELD GUIDE")} · {index + 1} / {TUTORIAL_STEPS.length}</span>
    <div className="tutorial-illustration" aria-hidden="true"><Icon size={54} /><span /></div>
    <h2 id="tutorial-title">{tx(step.title[0], step.title[1])}</h2><p aria-live="polite">{tx(step.body[0], step.body[1])}</p>
    <div className="tutorial-sequence" aria-label={tx("Pasos del tutorial", "Tutorial steps")}>{TUTORIAL_STEPS.map((item, i) => <button type="button" key={item.tab + i} aria-label={`${i + 1}: ${tx(item.title[0], item.title[1])}`} aria-current={i === index ? "step" : undefined} onClick={() => setIndex(i)}>{i + 1}</button>)}</div>
    <button className="secondary tutorial-visit" type="button" onClick={() => onVisit(step.tab)}>{tx("Ir a este apartado", "Open this section")}<ArrowRight size={16} /></button>
    <footer className="experience-actions"><button type="button" className="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}><ArrowLeft size={16} />{tx("Anterior", "Back")}</button><button type="button" className="primary" onClick={() => index === TUTORIAL_STEPS.length - 1 ? onClose() : setIndex(index + 1)}>{index === TUTORIAL_STEPS.length - 1 ? tx("Listo", "Done") : tx("Siguiente", "Next")}<ArrowRight size={16} /></button></footer>
  </section></div>;
}
