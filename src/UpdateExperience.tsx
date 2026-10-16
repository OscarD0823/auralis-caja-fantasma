import { useRef } from "react";
import { Check, Download, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import GameLogoMark from "./AuralisLogo";
import { translate, type UiLanguage } from "./i18n";
import useDialogFocus from "./useDialogFocus";

export type UpdateStatus = "downloading" | "installing" | "restarting" | "permission" | "confirming" | "error";
export default function UpdateExperience({ status, progress, route, notes, error, android, language, dismiss, install }: {
  status: UpdateStatus; progress: number | null; route: { current: string; next: string }; notes: string; error: string; android: boolean; language: UiLanguage; dismiss: () => void; install: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const canDismiss = status === "permission" || status === "confirming" || status === "error";
  useDialogFocus(dialog, canDismiss ? dismiss : undefined);
  const tx = (es: string, en: string) => translate(language, es, en);
  const titles = { downloading: ["Actualizando Auralis Caja Fantasma", "Updating Auralis Caja Fantasma"], installing: ["Guardando e instalando", "Saving and installing"], restarting: ["Reiniciando aplicación", "Restarting the app"], permission: ["Permite actualizar la aplicación", "Allow app updates"], confirming: ["Confirma la instalación en Android", "Confirm installation in Android"], error: ["No se pudo actualizar", "Update unsuccessful"] } as const;
  const message = status === "downloading" ? android ? tx("Descargando la APK y comprobando su SHA-256.", "Downloading the APK and checking its SHA-256.") : tx("Descargando el paquete firmado desde GitHub Releases.", "Downloading the signed package from GitHub Releases.") : status === "installing" ? tx("Guardando el progreso antes de aplicar la actualización.", "Saving progress before applying the update.") : status === "restarting" ? tx("La nueva versión volverá a abrirse.", "The new version will reopen.") : status === "permission" ? tx("Activa «Instalar apps desconocidas» para Auralis Caja Fantasma en Android, regresa y pulsa Continuar.", "Allow ‘Install unknown apps’ for Auralis Caja Fantasma in Android, return here and select Continue.") : status === "confirming" ? tx("La descarga está verificada. Confirma la actualización en el instalador de Android; no necesitas desinstalar.", "The download is verified. Confirm the update in Android's installer; no uninstall is needed.") : error;
  const stage = status === "restarting" || status === "confirming" ? 2 : status === "installing" ? 1 : 0;
  const percent = progress !== null && Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : null;
  return <div className="experience-overlay update-overlay"><section className={`update-card update-experience ${status}`} ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="update-title">
    <div className="update-art" aria-hidden="true"><GameLogoMark /><span className="update-art-orbit" />{status === "error" && <TriangleAlert size={26} />}</div>
    <span className="eyebrow">{tx("NUEVA VERSIÓN", "NEW VERSION")}</span><h2 id="update-title">{tx(titles[status][0], titles[status][1])}</h2>
    <div className="update-route"><span>v{route.current}</span><Arrow /><strong>v{route.next}</strong></div>
    <ol className="update-stages" aria-label={tx("Estado de actualización", "Update status")}>{[["Descarga", "Download"], [android ? "Verificación" : "Instalación", android ? "Verification" : "Installation"], [android ? "Confirmar" : "Reinicio", android ? "Confirm" : "Restart"]].map(([es, en], i) => <li key={en} className={status === "error" ? "" : i < stage ? "complete" : i === stage ? "current" : ""}>{i < stage && status !== "error" ? <Check size={14} /> : <span>{i + 1}</span>}{tx(es, en)}</li>)}</ol>
    <p role="status">{message}</p>
    {(status === "downloading" || status === "installing") && <div className="update-meter"><div className={`update-progress ${percent === null ? "indeterminate" : ""}`} role="progressbar" aria-label={tx("Descarga", "Download")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent ?? undefined}><span style={percent === null ? undefined : { width: `${percent}%` }} /></div><strong>{percent === null ? tx("En curso…", "In progress…") : `${percent}%`}</strong></div>}
    {status !== "error" && <div className="update-trust"><ShieldCheck size={16} />{tx("Se comprueba el paquete antes de instalar. Actualiza sin desinstalar.", "The package is checked before installation. Update without uninstalling.")}</div>}
    {notes && status !== "error" && <details><summary>{tx("Ver cambios de la versión", "View release changes")}</summary><pre>{notes}</pre></details>}
    {canDismiss && <div className="experience-actions"><button type="button" className="secondary" onClick={dismiss}>{tx("Más tarde", "Later")}</button><button type="button" className="primary" onClick={install}>{status === "permission" ? <Download size={17} /> : <RefreshCw size={17} />}{status === "error" ? tx("Reintentar", "Retry") : status === "permission" ? tx("Continuar", "Continue") : tx("Abrir instalador", "Open installer")}</button></div>}
  </section></div>;
}
function Arrow() { return <span aria-hidden="true">→</span>; }
