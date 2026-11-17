import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Download, ExternalLink, MonitorUp, X } from "lucide-react";
import { applyScheduledVision, computeCountdownTransition, computeCycle, computeGravityWhale, formatDuration, overlayVisionName, visionSeasonChange, type PersistedState } from "./model";
import type { UiLanguage } from "./i18n";
import type { PwaInstallState } from "./usePwaInstall";
import WebInstallNotice from "./WebInstallNotice";
import { browserPictureInPicture, browserToolError } from "./browserOverlay";
import type { WindowsInstaller } from "./windowsInstaller";
import pipStyles from "./browserOverlay.css?inline";

export function useBrowserOverlay(state: PersistedState, language: UiLanguage, enabled: boolean) {
  const [target, setTarget] = useState<Window>();
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const targetRef = useRef<Window | undefined>(undefined);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; const current = targetRef.current; targetRef.current = undefined; current?.close(); };
  }, []);
  const supported = enabled && !!browserPictureInPicture();
  const open = useCallback(async () => {
    if (!enabled || busyRef.current) return;
    const api = browserPictureInPicture();
    if (!api) return;
    setError("");
    if (targetRef.current && !targetRef.current.closed) { targetRef.current.focus(); return; }
    busyRef.current = true;
    setOpening(true);
    try {
      // requestWindow stays in the click's user activation; never open it from an effect.
      const pip = await api.requestWindow({ width: 380, height: 270 });
      if (!mounted.current) { pip.close(); return; }
      const style = pip.document.createElement("style");
      style.textContent = pipStyles;
      pip.document.head.append(style);
      pip.document.title = "Auralis · Contador flotante";
      const root = pip.document.createElement("div");
      root.id = "browser-tools-root";
      pip.document.body.append(root);
      targetRef.current = pip;
      setTarget(pip);
      pip.addEventListener("pagehide", () => {
        if (targetRef.current !== pip) return;
        targetRef.current = undefined;
        if (mounted.current) setTarget(undefined);
      }, { once: true });
    } catch (failure) {
      if (mounted.current) setError(browserToolError(failure, language !== "es"));
    } finally { busyRef.current = false; if (mounted.current) setOpening(false); }
  }, [enabled, language]);
  const close = () => { targetRef.current?.close(); };
  const root = target?.document.getElementById("browser-tools-root");
  return {
    supported, opening, error, opened: !!target && !target.closed, open, close,
    portal: root && target ? createPortal(<BrowserToolWindow target={target} state={state} language={language} onClose={close} />, root) : null,
  };
}

type Controller = ReturnType<typeof useBrowserOverlay>;

export function BrowserOverlayControls({ controller, language, pwa, installer }: { controller: Controller; language: UiLanguage; pwa: PwaInstallState; installer: WindowsInstaller }) {
  const [installHelp, setInstallHelp] = useState(false);
  const english = language !== "es";
  const install = async () => { if (!pwa.available || !await pwa.install()) setInstallHelp(true); };
  return <section className="browser-overlay-tools panel" id="browser-overlay-tools" aria-label={english ? "Browser counter" : "Contador del navegador"}>
    <header><MonitorUp size={22} /><div><span className="eyebrow">{english ? "FROM THE BROWSER" : "DESDE EL NAVEGADOR"}</span><h2>{english ? "Floating counter" : "Contador flotante"}</h2></div></header>
    <p>{english ? "Open the counter here or download the Windows app installer." : "Abre el contador aquí o descarga el instalador de la aplicación para Windows."}</p>
    <div className="browser-tool-actions">
      <a className="primary compact windows-installer-download" href={installer.url} download={installer.fileName}><Download size={15} />{english ? "Download Windows installer" : "Descargar instalador de Windows"}</a>
      <button type="button" className="secondary compact" disabled={!controller.supported || controller.opening} onClick={() => void controller.open()}><ExternalLink size={15} />{english ? "Floating counter" : "Contador flotante"}</button>
      {controller.opened && <button type="button" className="secondary compact" onClick={controller.close}><X size={15} />{english ? "Close floating window" : "Cerrar ventana"}</button>}
      {pwa.installed ? <span className="web-installed-badge"><Check size={15} />{english ? "Web app installed" : "Web instalada"}</span> : <button type="button" className="secondary compact" disabled={pwa.installing} onClick={() => void install()}><Download size={15} />{pwa.installing ? (english ? "Installing…" : "Instalando…") : (english ? "Install web app" : "Instalar la web")}</button>}
    </div>
    <small className="windows-installer-version">Windows · v{installer.version}</small>
    {controller.error && <p className="browser-tool-error" role="status">{controller.error}</p>}
    {!controller.supported && <p className="browser-tool-help">{english ? "Floating windows require a compatible desktop browser, such as Chrome or Edge." : "La ventana flotante necesita un navegador de escritorio compatible, como Chrome o Edge."}</p>}
    <small className="browser-tool-help">{english ? "Keep this page or the installed web app open. Drag the floating counter by its title bar." : "Mantén abierta esta página o la web instalada. Arrastra el contador flotante por su barra superior."}</small>
    {installHelp && <WebInstallNotice pwa={pwa} language={language} variant="panel" initialHelpOpen />}
  </section>;
}

function BrowserToolWindow({ target, state, language, onClose }: { target: Window; state: PersistedState; language: UiLanguage; onClose: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = target.setInterval(() => setNow(Date.now()), 1000); return () => target.clearInterval(timer); }, [target]);
  const effective = applyScheduledVision(state, now);
  const selected = effective.catalog.visions.find(vision => vision.id === effective.settings.selectedVisionId);
  const cycle = computeCycle(effective.settings, now);
  const transition = computeCountdownTransition(effective.settings, now);
  const cycleReady = selected?.cycleConfirmed !== false;
  const whale = computeGravityWhale(effective.settings, now);
  const season = visionSeasonChange(effective.catalog, now);
  const english = language !== "es";
  const name = overlayVisionName(selected, state.settings.overlayNameMode, state.settings.overlayCustomName);
  return <main className="browser-tool-window">
    <header><span>AURALIS · {english ? "WEB TOOLS" : "HERRAMIENTAS WEB"}</span><button type="button" aria-label={english ? "Close" : "Cerrar"} onClick={onClose}>×</button></header>
    <section className="pip-counter" aria-label={english ? "Visional Wheel timer" : "Contador de Rueda Visional"}>
      <h1>{name}</h1><span>{!cycleReady ? (english ? "Event timing awaiting confirmation" : "Horario del evento por confirmar") : transition.active ? (english ? "Preparing countdown" : "Preparando contador") : cycle.phase === "active" ? (english ? "Ends in" : "Termina en") : (english ? "Starts in" : "Comienza en")}</span>
      <strong role="timer" aria-live="off">{!cycleReady ? (english ? "Unconfirmed" : "Por confirmar") : formatDuration(transition.active ? transition.remainingMs : cycle.remainingMs)}</strong>
      {cycleReady && <div className="pip-progress"><i style={{ width: `${cycle.progress * 100}%` }} /></div>}
      {selected?.id === "gravity" && state.settings.overlayWhaleEnabled && <small>{english ? "Whale" : "Ballena"}: {whale.visible ? formatDuration(whale.remainingMs) : (english ? "not active" : "sin evento")}</small>}
    </section>
    {season?.endingSoon && <div className="pip-season-warning">{english ? "This wheel ends in" : "Esta rueda acaba en"} {formatDuration(season.remainingMs)}</div>}
  </main>;
}
