import { Download, Upload, Link2 } from 'lucide-react';
import type { UiLanguage } from './i18n';

export default function MigrationGuide({ language, android = false, onImport, onDevices }: {
  language: UiLanguage; android?: boolean; onImport: () => void; onDevices: () => void;
}) {
  const tx = (es: string, en: string) => language === 'es' ? es : en;
  return <details className="migration-guide panel" open={android || undefined}>
    <summary>{tx('¿Ya usabas Caja Fantasma? Conserva tu progreso', 'Already using Caja Fantasma? Keep your progress')}</summary>
    {!android && <p><strong>Windows: </strong>{tx('Descarga el instalador nuevo y ejecútalo sobre la aplicación actual. Después de esta instalación, las próximas actualizaciones volverán a llegar dentro del programa.', 'Download the new installer and run it over your existing app. Future updates will arrive inside the app after this installation.')}</p>}
    <p><strong>Android: </strong>{tx('La nueva aplicación se instala junto a la anterior. Pasa tus datos antes de retirar la aplicación antigua.', 'The new app installs alongside the previous one. Transfer your data before removing the old app.')}</p>
    <ol>
      <li>{tx('En la aplicación anterior, abre Configuración → Respaldo local → Exportar.', 'In the previous app, open Settings → Local backup → Export.')}</li>
      <li>{tx('En la aplicación nueva, pulsa Importar respaldo y selecciona ese archivo.', 'In the new app, select Import backup and choose that file.')}</li>
      <li>{tx('Comprueba tus personajes, puntos, cajas e historial. Conserva el respaldo.', 'Check your characters, points, crates and history. Keep your backup file.')}</li>
    </ol>
    <p>{tx('También puedes pasar el progreso usando Dispositivos y la conexión con el PC o la web.', 'You can also transfer progress through Devices using the PC or website connection.')}</p>
    <div className="migration-actions"><button type="button" className="primary" onClick={onImport}><Upload size={16} />{tx('Importar respaldo', 'Import backup')}</button><button type="button" className="secondary" onClick={onDevices}><Link2 size={16} />{tx('Abrir Dispositivos', 'Open Devices')}</button></div>
    <small><Download size={14} />{tx('La aplicación anterior conserva sus datos mientras siga instalada.', 'The previous app keeps its data while it remains installed.')}</small>
  </details>;
}
