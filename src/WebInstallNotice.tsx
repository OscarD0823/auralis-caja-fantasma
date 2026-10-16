import { memo, useId, useMemo, useState } from "react";
import { Check, Download, HelpCircle, X } from "lucide-react";
import { translate, type UiLanguage } from "./i18n";
import { pwaInstallGuide } from "./pwaInstall";
import type { PwaInstallState } from "./usePwaInstall";

const DISMISS_KEY = "caja-fantasma.web-install-notice.dismissed";

function WebInstallNotice({ pwa, language, variant = "notice" }: { pwa: PwaInstallState; language: UiLanguage; variant?: "notice" | "panel" }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === "true"; } catch { return false; }
  });
  const [helpOpen, setHelpOpen] = useState(false);
  const helpId = useId();
  const guide = useMemo(() => pwaInstallGuide(navigator.userAgent, navigator.platform, navigator.maxTouchPoints), []);
  const tx = (es: string, en: string) => translate(language, es, en);
  if (variant === "notice" && (dismissed || pwa.installed)) return null;
  const showHelp = helpOpen;
  const dismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem(DISMISS_KEY, "true"); } catch { /* Dismissal still works without storage. */ }
  };
  const install = async () => {
    if (!await pwa.install()) setHelpOpen(true);
  };

  return <aside className={`web-install-notice panel variant-${variant}`} aria-label={tx("Instalación de la aplicación web", "Web app installation")}>
    <img className="web-install-logo" src={`${import.meta.env.BASE_URL}icons/app-192.png`} width={42} height={42} alt="" aria-hidden="true" />
    <div className="web-install-copy">
      <span className="eyebrow">{tx("VERSIÓN WEB INSTALABLE", "INSTALLABLE WEB APP")}</span>
      <h2>{pwa.installed ? tx("Página instalada", "Web app installed") : tx("Instala Auralis Caja Fantasma", "Install Auralis Caja Fantasma")}</h2>
      <p>{pwa.installed ? tx("Ábrela desde su icono y usa tus datos guardados sin conexión.", "Open it from its icon and use saved data offline.") : tx("Ten su icono en tu PC o celular y ábrela como una app. Es gratis.", "Put its icon on your PC or phone and open it as an app. It's free.")}</p>
    </div>
    <div className="web-install-actions">
      {pwa.installed ? <span className="web-installed-badge"><Check size={15} />{tx("Instalada", "Installed")}</span> : <>
        {(pwa.available || pwa.installing) && <button type="button" className="primary compact" disabled={pwa.installing} onClick={() => void install()}><Download size={16} />{pwa.installing ? tx("Instalando…", "Installing…") : tx("Instalar aplicación", "Install app")}</button>}
        <button type="button" className={`${pwa.available || pwa.installing ? "secondary" : "primary"} compact`} aria-expanded={showHelp} aria-controls={helpId} onClick={() => setHelpOpen(!showHelp)}><HelpCircle size={16} />{tx("Cómo instalar", "How to install")}</button>
      </>}
    </div>
    {variant === "notice" && <button type="button" className="web-install-dismiss" onClick={dismiss} aria-label={tx("Ocultar aviso de instalación", "Hide installation notice")} title={tx("Ahora no", "Not now")}><X size={17} /></button>}
    {!pwa.installed && showHelp && <div id={helpId} className="web-install-help">
      {pwa.failed && <p role="status">{tx("No se pudo abrir la instalación automática. Puedes usar el menú de tu navegador.", "Automatic installation could not open. You can use your browser's menu.")}</p>}
      <ol>{guide.steps.map((step, index) => <li key={index}>{tx(step.es, step.en)}</li>)}</ol>
      <small>{tx("Si no aparece la opción, abre la página en Chrome, Edge o Safari. El aviso también está en Dispositivos.", "If the option is missing, open the page in Chrome, Edge, or Safari. These instructions are also under Devices.")}</small>
    </div>}
  </aside>;
}

export default memo(WebInstallNotice);
