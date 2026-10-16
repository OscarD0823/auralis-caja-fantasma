import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Activity as ActivityIcon,
  BarChart3,
  Box,
  Check,
  CircleHelp,
  ChevronRight,
  Clock3,
  Download,
  ExternalLink,
  Eye,
  FileClock,
  Gem,
  Github,
  History,
  Languages,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  Minus,
  MonitorUp,
  Plus,
  RadioTower,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
  Trash2,
  Undo2,
  Upload,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  Volume2,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import CatalogEditor from "./CatalogEditor";
import LocalSyncAddressFields from "./LocalSyncAddressFields";
import OverlayPreviewLab from "./OverlayPreviewLab";
import AppUpdater from "./Updater";
import WebInstallNotice from "./WebInstallNotice";
import DevicePresence from "./DevicePresenceStrip";
import GameLogoMark from './GameLogoMark';
import { ShinyModuleMark } from "./GameLogoMark";
import ConsoleGlyph from "./ConsoleGlyph";
import { recentConnectedDevices, type DeviceKind } from "./devicePresence";
import { GRAVITY_EVENT_IMAGE_A, GRAVITY_EVENT_IMAGE_B, LUNAR_EVENT_IMAGE, SYMBIOSIS_EVENT_IMAGE, visionVisualImage, visionVisualTheme } from "./assets";
import type { Activity, ActivityHistoryRecord, Catalog, CharacterProfile, OverlayCounterStyle, OverlayNameMode, OverlayShape, PersistedState, PointAction, PointRoundRecord, PointRoundTrigger, Settings, ShinyModRecord, Vision, WhaleCounterStyle } from "./model";
import {
  APP_VERSION,
  ANDROID_APK_URL,
  AUTHOR,
  AUTHOR_PROFILE_URL,
  DEFAULT_CHARACTER_ID,
  REMOTE_CATALOG_URL,
  REPOSITORY_URL,
  WEB_APP_URL,
  WINDOWS_DOWNLOAD_URL,
  actionCharacterIds,
  activityHistorySummary,
  applyRemoteCatalog,
  actionsForCharacter,
  actionsForTeamSession,
  boxStatistics,
  buildBreakdown,
  buildPointRoundBreakdown,
  clampNumber,
  computeCountdownTransition,
  computeCycle,
  computeGravityWhale,
  createId,
  detachCharacterFromActions,
  formatCompactDuration,
  formatDuration,
  gameDayKey,
  overlayVisionName,
  parseManualBaseline,
  pointActionsInRound,
  resolveTransitionDelayMilliseconds,
  sharedEventTimingFromSettings,
  sharedVisionId,
  splitPlatformCarryover,
  validateCatalog,
} from "./model";
import { STORAGE_KEY, applyPersonalSyncPayload, exportState, hasIntentionalActionDeletions, importState, loadPersonalSyncUpdatedAt, loadState, mergePersonalSyncPayload, personalDurableHistoryCount, personalHistoryCount, personalSyncPayload, recoverPersonalBackup, savePersonalSyncUpdatedAt, saveState } from "./storage";
import { isValidLocalSyncAddress, localSyncTargetAddressSpace, splitLocalSyncAddress } from "./localSyncAddress";
import { UI_LANGUAGES, detectUiLanguage, localeForLanguage, translate, type UiLanguage } from "./i18n";
import AppTutorial from "./AppTutorial";
import type { ShinyModCatalogItem } from "./shinyModsCatalog";
import { loadWebPersonalBackup, readWebStorageStatus, requestPersistentWebStorage, saveWebPersonalBackup, type WebStorageStatus } from "./webStorage";
import { usePwaInstall } from "./usePwaInstall";
import StartupOpeningVideo from "./StartupOpeningVideo";
import CounterChestArt from "./CounterChestArt";
import { persistDesktopProgress } from "./desktopProgress";
import PhoneBridgeSyncPanel from "./PhoneBridgeSyncPanel";
import { runtimePlatform } from "./runtimePlatform";
import { usePhoneBridgeSync } from "./usePhoneBridgeSync";
import type { PhoneBridgeSnapshot } from "./phoneBridgeProtocol";
import RewardProgressBar from "./RewardProgressBar";
import ObservedProbability from "./ObservedProbability";
import CrateHistoryCard from "./CrateHistoryCard";

type ShinyCatalogModule = typeof import("./shinyModsCatalog");
const EMPTY_SHINY_CATALOG: ShinyModCatalogItem[] = [];
const EMPTY_SHINY_GROUPS: ShinyCatalogModule["SHINY_MOD_GROUPS"] = [];

function catalogStatusLabel(item: Pick<ShinyModCatalogItem, "levelLabel">, language: UiLanguage = "es") {
  return language !== "es" && item.levelLabel === "Brillante" ? "Shiny" : item.levelLabel;
}

function catalogOriginLabel(item: Pick<ShinyModCatalogItem, "system">, language: UiLanguage = "es") {
  void item;
  return language !== "es" ? "Current system" : "Sistema actual";
}

function normalizeModSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

function matchesModSearch(item: ShinyModCatalogItem, search: string) {
  if (!search) return true;
  const haystack = normalizeModSearch([item.name, item.englishName, item.baseName, item.baseEnglishName, item.variant, item.applyRange, item.modType, item.groupName, item.levelLabel, catalogStatusLabel(item, "en"), catalogOriginLabel(item), catalogOriginLabel(item, "en"), item.itemId].join(" "));
  return search.split(/\s+/).filter(Boolean).every((term) => haystack.includes(term));
}

type TabId = "progress" | "characters" | "vision" | "devices" | "history" | "shiny" | "changes" | "settings";
type CreatorAccess = "checking" | "locked" | "granted";

type LocalSyncInfo = { enabled: boolean; address: string; port: number; webAddress: string; webPort: number; pairingCode: string; revision: number };
type LocalSyncSnapshot = { enabled: boolean; revision: number; updatedAt: string; dataJson: string; lastExchangeAt: number; lastMobileUpdateAt: number; connectedDevices?: string[] };
type LocalSyncAction = "status" | "pull" | "push" | "live";
type LocalSyncExchange = Omit<LocalSyncSnapshot, "enabled" | "lastMobileUpdateAt"> & { ok: boolean; message: string; catalogJson?: string };
type LocalNetworkRequestInit = RequestInit & { targetAddressSpace?: "loopback" | "local" };
type LocalNetworkPermissionName = "loopback-network" | "local-network";
type BackgroundSyncStatus = {
  active: boolean;
  connected: boolean;
  revision: number;
  updatedAt: string;
  dataJson: string;
  catalogJson: string;
  lastExchangeAt: number;
  message: string;
  connectedDevices?: string[];
};

const REMOTE_CATALOG_API_URL = "https://api.github.com/repos/OscarD0823/auralis-caja-fantasma/contents/catalog/visions.json?ref=main";
const PLATFORM = runtimePlatform(isTauri(), navigator.userAgent);
const IS_ANDROID = PLATFORM === "android";
const IS_WEB = PLATFORM === "web";
let catalogApiFallbackAvailableAt = 0;

function createPairingCode() {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
}

async function localNetworkPermissionState(address: string): Promise<PermissionState | undefined> {
  if (!("permissions" in navigator)) return undefined;
  const name: LocalNetworkPermissionName = localSyncTargetAddressSpace(address) === "loopback" ? "loopback-network" : "local-network";
  try {
    return (await navigator.permissions.query({ name } as unknown as PermissionDescriptor)).state;
  } catch {
    return undefined;
  }
}

async function fetchPublicCatalog(): Promise<unknown> {
  try {
    const response = await fetch(`${REMOTE_CATALOG_URL}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`GitHub Raw HTTP ${response.status}`);
    return await response.json() as unknown;
  } catch (rawError) {
    if (Date.now() < catalogApiFallbackAvailableAt) throw rawError;
    catalogApiFallbackAvailableAt = Date.now() + 120_000;
    const response = await fetch(REMOTE_CATALOG_API_URL, {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
    const payload = await response.json() as { content?: string; encoding?: string };
    if (payload.encoding !== "base64" || typeof payload.content !== "string") throw new Error("GitHub API no devolvió el catálogo esperado");
    const bytes = Uint8Array.from(atob(payload.content.replace(/\s/g, "")), (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  }
}

const TABS: Array<{ id: TabId; es: string; en: string; icon: typeof Box }> = [
  { id: "progress", es: "Caja", en: "Crate", icon: Box },
  { id: "characters", es: "Personajes", en: "Characters", icon: Users },
  { id: "vision", es: "Visión", en: "Visional Wheel", icon: Eye },
  { id: "devices", es: "Dispositivos", en: "Devices", icon: Smartphone },
  { id: "history", es: "Historial", en: "History", icon: History },
  { id: "shiny", es: "Mods Brillantes", en: "Shiny Mods", icon: Gem },
  { id: "changes", es: "Cambios", en: "Changes", icon: FileClock },
  { id: "settings", es: "Configuración", en: "Settings", icon: Settings2 },
];

const CHANGELOG = [
  { version: "1.22.2", date: "10 de octubre de 2026", title: "Cofre fluido y animaciones ligeras", items: ["Apertura del cofre en vídeo local a 60 FPS, sin cargar el modelo 3D pesado durante el inicio.", "El fantasma emerge y se aleja de forma continua, sin las pausas de la trayectoria anterior.", "El cofre junto a los puntos conserva su tapa y fantasma con cerca de un 95 % menos de elementos; se pausa fuera de pantalla y en segundo plano.", "Reproducción adaptada a Windows, Android y web, con alternativa estática si falla el vídeo o se prefiere reducir movimiento.", "Conserva los puntos, las cajas, los personajes, los módulos y la sincronización existente."] },
  { version: "1.22.1", date: "9 de octubre de 2026", title: "Cofre con profundidad e iconos fieles", items: ["Cofre con herrajes en relieve, tapa curva, cerradura profunda y paredes interiores; conserva la apertura del módulo y el fantasma.", "Acabado de metal envejecido con tornillos, ranuras y desgaste sutil, sin el aspecto plástico anterior.", "El logo y los iconos de Windows, Android y web se generan desde el mismo cofre tridimensional, con proporciones y márgenes seguros.", "Piezas estáticas reutilizadas y animaciones que respetan movimiento reducido; no cambia el progreso, el historial ni la sincronización."] },
  { version: "1.22.0", date: "9 de octubre de 2026", title: "Conexiones juntas y consola de progreso", items: ["La web en Android y las PWA muestran Conectar con el celular; ya no se confunden con la APK.", "Dispositivos reúne PC, web, Android y ambos enlaces en el mismo lugar.", "Progreso con energía segmentada, cofre que refleja su carga, botones de metal e indicadores de conexión con circuitos animados.", "Apertura más fluida, icono con márgenes seguros para móvil, tutorial de seis pasos y nueva vista de actualización.", "Detección automática del idioma en instalaciones nuevas; las elecciones anteriores se conservan."] },
  {
    version: "1.21.8",
    date: "8 de octubre de 2026",
    title: "Cofre custodio y conexión por IP",
    items: [
      "Web y Android se enlazan sin PC con IP, puerto y seis números; ambas aplicaciones deben estar abiertas en la misma Wi-Fi.",
      "El puente móvil guarda los cambios antes de confirmarlos, conserva cierres de caja y propaga las restas intencionales.",
      "El módulo Brillante activa la cerradura y el fantasma emerge, saluda y se retira dejando el cofre visible; esa apertura también anima el cofre junto a los puntos.",
      "Barra de progreso animada con movimiento reducido y pausa al ocultarse; historial móvil y medidas de probabilidad reorganizados.",
      "Acceso al editor oculto para visitantes, manteniendo la verificación de la cuenta propietaria al publicar.",
    ],
  },
  {
    version: "1.21.6",
    date: "8 de octubre de 2026",
    title: "Cofre espectral, cronómetros Android y conexión directa local",
    items: [
      "Cofre de tapa curva con piezas metálicas, llave en la cerradura, fantasma y módulo Brillante 17 al abrir; nueva identidad original en PC, Android y web.",
      "La notificación del servicio Android con PC muestra el tiempo del evento y de la Ballena mediante cronómetros nativos.",
      "Web y celular pueden combinar sus historiales directamente en la misma Wi-Fi mediante invitación y respuesta, manteniendo ambas apps abiertas.",
      "Las transferencias se verifican completas antes de aplicarse y conservan las restas intencionales; una copia vacía no reemplaza tu progreso.",
      "Se conserva el puente anterior con PC y su servicio en segundo plano. Sin Cloudflare, Firebase ni servicios de pago.",
    ],
  },
  {
    version: "1.21.5",
    date: "8 de octubre de 2026",
    title: "Intentos protegidos e indicativos de los tres dispositivos",
    items: [
      "La recuperación y Guardar y salir respetan el intento guardado tras recibir una caja, sin sumar de nuevo recompensas ya consumidas.",
      "Cada caja nueva conserva los identificadores de sus recompensas por personaje; una copia atrasada no las devuelve al intento actual.",
      "La ventana flotante deja de escribir copias completas del progreso al cerrarse; el arranque espera a recuperar los respaldos antes de guardar.",
      "Android recibe los tres indicativos PC, Web y Móvil del servicio en segundo plano, incluida la animación de Web conectado.",
      "Se conservan el historial, los puntos de otros personajes y el total de equipo. No cambia el cálculo del correo de Plataformas.",
    ],
  },
  {
    version: "1.21.4",
    date: "7 de octubre de 2026",
    title: "Consola de anomalías · nueva identidad visual",
    items: [
      "Iconos y logo originales unificados para Windows, Android y la página, con símbolos propios para cada sección.",
      "Consola industrial, materiales metálicos y acentos Lunar, Gravedad y Simbiosis durante su activación.",
      "Apertura con escaneo de la caja, llave espectral, cierres mecánicos, tapa articulada y liberación del núcleo.",
      "Señales conectadas más claras y animaciones ligeras, con movimiento reducido y pausa al ocultar la página.",
      "Incluye las correcciones de enlaces de Android, instalación web, firma del desarrollador e instancia única en Windows.",
      "Conserva puntos, personajes, módulos, historial y sincronización. Herramienta comunitaria no oficial.",
    ],
  },
  {
    version: "1.21.2",
    date: "7 de octubre de 2026",
    title: "Firma visible y enlaces de Android reparados",
    items: [
      "OscarD0823 aparece en la cabecera y en Dispositivos de Windows, Android y la web, incluso en pantallas pequeñas.",
      "Android registra el componente que abre la página, GitHub y las descargas en el navegador del teléfono.",
      "La web muestra un aviso de instalación que se puede cerrar, con botón directo cuando el navegador lo admite e instrucciones disponibles también en Dispositivos.",
      "Los indicadores de dispositivos conectados emiten una señal animada y se apagan al perder la conexión reciente.",
      "Windows mantiene una sola instancia y restaura la ventana existente al abrirlo desde Inicio, búsqueda o un acceso directo.",
      "Se retira el apartado de notificaciones de Windows, conservando la voz, la ventana flotante y los datos personales.",
    ],
  },
  {
    version: "1.21.1",
    date: "7 de octubre de 2026",
    title: "Cierre seguro y apertura tridimensional",
    items: [
      "Windows: Guardar y salir desde el menú o la bandeja; la X guarda antes de pasar a segundo plano.",
      "Guardado nativo al apagar, reiniciar o cerrar sesión, y antes de instalar una actualización.",
      "El cierre incluye los últimos datos recibidos del celular y permanece abierto si falla el respaldo.",
      "Caja tridimensional con laterales, llave, cierres, bisagras e interior de la tapa; sin motor de animación adicional.",
    ],
  },
  {
    version: "1.21.0",
    date: "6 de octubre de 2026",
    title: "Contadores en todos tus dispositivos",
    items: [
      "Contador del Riftwalker en PC, web y móvil, con tiempo restante o rayo de progreso.",
      "Indicadores de conexión para PC, web y móvil; controles de ventana más compactos.",
      "Rondas y desglose debajo de las recompensas, y Guardar ronda junto a la llegada de la caja.",
      "La página se puede instalar y conserva la interfaz para abrir sin conexión.",
      "Nuevo icono y apertura con llave, cierres y tapa animados.",
      "El arranque recupera también respaldos con igual cantidad de registros y espera antes de sincronizar o archivar rondas.",
    ],
  },
  {
    version: "1.20.5",
    date: "5 de octubre de 2026",
    title: "La resta llega a todos los dispositivos",
    items: [
      "Windows, Android y la página usan el mismo protocolo de eliminación para reflejar inmediatamente un punto restado.",
      "Un dispositivo desactualizado deja de fallar en silencio y solicita instalar la versión compatible.",
      "La caché de la página cambia de versión para retirar el código anterior al volver a cargar.",
    ],
  },
  {
    version: "1.20.4",
    date: "4 de octubre de 2026",
    title: "Restar puntos también funciona en vivo",
    items: [
      "Deshacer o restar una recompensa se transmite a Windows, Android y la página sin que otro dispositivo vuelva a agregarla.",
      "La eliminación también corrige la actividad del día y el ranking histórico asociados a ese registro.",
      "Los puntos compartidos con otros personajes se conservan mientras todavía pertenezcan a uno de ellos.",
      "Android acepta estas eliminaciones intencionales durante la sincronización en segundo plano sin confundirlas con una pérdida accidental de historial.",
    ],
  },
  {
    version: "1.20.3",
    date: "4 de octubre de 2026",
    title: "Una sola conexión para PC, página y Android",
    items: [
      "La página y Android usan simultáneamente la misma IP, el mismo puerto y el mismo código mostrados por Windows.",
      "El puerto principal acepta tanto la conexión directa de Android como la conexión HTTP protegida del navegador.",
      "El puente anterior de la página continúa disponible durante la transición para no interrumpir conexiones guardadas.",
    ],
  },
  {
    version: "1.20.2",
    date: "4 de octubre de 2026",
    title: "Arranque de Windows reparado",
    items: [
      "Windows ya no registra el caché sin conexión de la página web dentro de la aplicación instalada.",
      "La actualización elimina únicamente los cachés web antiguos, sin tocar puntos, cajas, personajes ni módulos.",
      "La animación inicial tiene una salida de seguridad para que nunca pueda dejar la interfaz oculta.",
      "El enlace a la página y el puente local PC ↔ Página se mantienen disponibles después de actualizar.",
      "La página distingue un puente apagado de un permiso realmente bloqueado y permite volver a intentar la conexión.",
    ],
  },
  {
    version: "1.20.1",
    date: "4 de octubre de 2026",
    title: "Página visible y puente web recuperado",
    items: [
      "Abrir página web lleva el navegador al frente al minimizar la aplicación de Windows y ahora informa cualquier fallo real del sistema.",
      "La página solicita correctamente el permiso de red local que requieren los navegadores actuales para comunicarse con el puente del PC.",
      "Una conexión bloqueada deja de esperar indefinidamente y muestra cómo habilitar el permiso sin borrar ni reemplazar datos personales.",
      "Dispositivos explica el recorrido Celular ↔ PC ↔ Página y recuerda que la aplicación de Windows debe permanecer abierta.",
    ],
  },
  {
    version: "1.20.0",
    date: "3 de octubre de 2026",
    title: "Web gratuita, 12 idiomas y puente local",
    items: [
      "La interfaz permite elegir Español, English, Português, Français, Deutsch, Italiano, Polski, Türkçe, Русский, 日本語, 한국어 y 简体中文.",
      "La versión web mantiene una copia doble en localStorage e IndexedDB y almacena la aplicación en caché para abrir sin conexión.",
      "Windows puede actuar como puente local entre la página y Android: los datos personales no se suben a GitHub ni a una nube.",
      "La página se publica gratuitamente en GitHub Pages y no requiere Firebase, suscripción ni base de datos de pago.",
    ],
  },
  {
    version: "1.19.0",
    date: "3 de octubre de 2026",
    title: "Catálogo moderno y nueva identidad visual",
    items: [
      "Mods Brillantes conserva exclusivamente los 1.618 registros del sistema actual: 809 normales de nivel 1 a 17 y sus 809 versiones Brillantes.",
      "La apertura incorpora una secuencia cinematográfica de verificación, ruta de energía, impacto de la cerradura y apertura holográfica sin partir la imagen de la caja.",
      "El emblema de Auralis Caja Fantasma y los iconos de Windows se rediseñaron alrededor de la caja, la cerradura espectral y el nivel 17.",
      "La configuración de la ventana flotante aparece junto al seguimiento; la actividad diaria y el ranking quedaron debajo de todas las recompensas.",
      "El selector Español / English está disponible directamente en la barra del contador.",
      "El proyecto queda preparado para una publicación web gratuita en GitHub Pages, con guardado local por navegador y una ruta documentada para nube opcional sin Firebase.",
    ],
  },
  {
    version: "1.18.2",
    date: "28 de septiembre de 2026",
    title: "Sincronización en vivo sin pérdida de registros",
    items: [
      "Una copia atrasada del PC o del celular ya no puede reemplazar un historial más completo aunque contenga algunos registros.",
      "Los cambios independientes se combinan por identificador y el cierre de una caja conserva correctamente el reinicio del intento activo.",
      "El respaldo nativo y el servicio en segundo plano de Android aplican la misma protección al historial duradero.",
    ],
  },
  {
    version: "1.18.1",
    date: "27 de septiembre de 2026",
    title: "Día del juego desde las 8:00 a. m. de Colombia",
    items: [
      "Los puntos, actividades y contadores diarios cambian de día a las 8:00 a. m. según la hora de Colombia.",
      "Todo lo registrado antes de las 8:00 a. m. permanece dentro del día de juego anterior.",
      "El mismo corte se aplica en Windows y Android sin depender de la zona horaria configurada en cada dispositivo.",
    ],
  },
  {
    version: "1.18.0",
    date: "21 de septiembre de 2026",
    title: "Datos en vivo en segundo plano en Android",
    items: [
      "Android mantiene la conexión local con el PC aunque cambies de aplicación y la interfaz deje de estar visible.",
      "Un servicio nativo de dispositivo conectado continúa intercambiando cambios sin Firebase, nube ni la interfaz abierta.",
      "La notificación silenciosa indica si el PC está conectado o si el teléfono está esperando para reconectarse.",
      "El servicio conserva la copia con historial, evita reemplazos vacíos y entrega los cambios acumulados cuando vuelves a abrir la aplicación.",
    ],
  },
  {
    version: "1.17.3",
    date: "21 de septiembre de 2026",
    title: "Recuperación automática y sincronización sin pérdidas",
    items: [
      "La aplicación conserva un respaldo nativo independiente del almacenamiento visual tanto en Windows como en Android.",
      "Si el estado local aparece vacío por un fallo, el historial se recupera automáticamente desde la copia más completa disponible.",
      "Los cambios simultáneos o atrasados del PC y el celular se combinan por registro en vez de reemplazar un historial completo.",
      "La revisión de sincronización impide que una copia desactualizada gane por error durante el modo en vivo.",
    ],
  },
  {
    version: "1.17.2",
    date: "20 de septiembre de 2026",
    title: "Protección del historial entre PC y celular",
    items: [
      "La sincronización en vivo ya no permite que un estado vacío borre automáticamente un historial existente en el otro dispositivo.",
      "Al conectar por primera vez, si solo uno de los equipos conserva registros, esa copia se adopta y se devuelve al equipo vacío.",
      "Se guarda una copia local de seguridad antes de cualquier reducción importante del historial y los botones manuales conservan su confirmación explícita.",
    ],
  },
  {
    version: "1.17.1",
    date: "20 de septiembre de 2026",
    title: "Conexión en vivo estable en Windows",
    items: [
      "Corregido el error de socket 10035 que podía aparecer al sincronizar con frecuencia entre el PC y Android.",
      "Cada conexión del celular espera correctamente la llegada de los datos sin bloquear indefinidamente el servidor.",
      "Los botones PC → Celular y Celular → PC conservan su funcionamiento junto al modo en vivo.",
    ],
  },
  {
    version: "1.17.0",
    date: "19 de septiembre de 2026",
    title: "Datos en vivo, resumen diario y ranking",
    items: [
      "La sincronización en vivo opcional refleja cambios personales entre PC y Android mientras ambas aplicaciones estén abiertas, sin quitar los botones manuales.",
      "Caja separa los puntos y actividades de hoy de los acumulados históricos.",
      "Un ranking ordena los jefes y recompensas por la cantidad realizada desde que comenzó a usarse el programa.",
      "Cada recompensa muestra su contador de hoy y su contador histórico.",
      "La Ballena incorpora el estilo Solo rayo: el haz funciona como contador y pierde intensidad al acercarse al final.",
    ],
  },
  {
    version: "1.16.3",
    date: "19 de septiembre de 2026",
    title: "Sincronización dirigida e interfaz bilingüe",
    items: [
      "Android permite elegir explícitamente PC → Celular o Celular → PC, sin decidir por la hora de los dispositivos.",
      "El sondeo automático comprueba la conexión y recibe el catálogo público, pero no reemplaza datos personales.",
      "Los tiempos, la fase y la transición publicados por el administrador también llegan al celular a través del PC conectado.",
      "Los módulos se muestran desde Nivel 1 hasta Nivel 17 y después como Brillante.",
      "Nuevo selector Español / English para la interfaz principal.",
    ],
  },
  {
    version: "1.16.2",
    date: "13 de septiembre de 2026",
    title: "Conexión móvil guiada y tiempos públicos comprobados",
    items: [
      "En Android, la IP del PC se escribe en cuatro bloques numéricos y el puerto en un bloque independiente.",
      "Es posible pegar la dirección completa; la aplicación separa y valida automáticamente cada dato.",
      "Windows muestra IP, puerto y código en tarjetas independientes para copiarlos sin confusión.",
      "La sincronización local se verificó en ambas direcciones, con control de código y límite exclusivo a redes privadas.",
      "Los tiempos publicados por el administrador se aplican en Windows y Android junto con la rueda, la fase y la transición.",
    ],
  },
  {
    version: "1.16.1",
    date: "13 de septiembre de 2026",
    title: "Dispositivos y versión siempre visibles",
    items: [
      "La versión instalada aparece en la identidad del programa y en una ficha pública disponible para todas las personas.",
      "Sincronización PC–Android y descarga de la APK se trasladaron a la nueva sección lateral Dispositivos.",
      "La sección muestra la versión del catálogo, la rueda pública y la última publicación del administrador.",
      "Windows y Android comprueban automáticamente los cambios públicos del administrador cada 30 segundos y al recuperar conexión o foco.",
      "Las nuevas versiones del programa llegan a ambos sistemas: Windows se reinicia después de validar su firma y Android descarga la APK, comprueba SHA-256 y abre la confirmación segura del sistema.",
    ],
  },
  {
    version: "1.16.0",
    date: "13 de septiembre de 2026",
    title: "Sincronización directa entre PC y Android",
    items: [
      "El historial, puntos, personajes, rondas y módulos Brillantes se sincronizan directamente entre el PC y la APK mediante la red local, sin Firebase ni nube personal.",
      "La configuración completa de la ventana flotante se concentra ahora en Caja para mantener limpia la pestaña Visión.",
      "El Riftwalker puede conservar el rayo de progreso ocultando únicamente el texto y reloj del tiempo.",
      "La aplicación de Windows incluye un botón directo para descargar la APK firmada correspondiente a esta versión.",
    ],
  },
  {
    version: "1.15.0",
    date: "12 de septiembre de 2026",
    title: "Aplicación Android y ruedas visuales",
    items: [
      "Primera APK instalable para teléfonos Android con el progreso, personajes, historial, módulos y rueda pública.",
      "La vista pública de Visión ya no permite cambiar ni corregir el ciclo; esos controles ahora son exclusivos del administrador.",
      "Todas las ruedas muestran una ficha con imagen, descripción y estado, incluida la configuración de futuras ruedas.",
      "El propietario puede crear ruedas nuevas y modificar su nombre, descripción, imagen, estado, tiempos y recompensas antes de publicarlas.",
    ],
  },
  {
    version: "1.14.1",
    date: "12 de septiembre de 2026",
    title: "Conteos por recompensa desde cero",
    items: [
      "Cada tarjeta muestra únicamente lo realizado en la ronda actual y vuelve visualmente a cero al guardarla.",
      "Debajo del control aparece el acumulado guardado de esa recompensa: por ejemplo, 4 Plataformas y luego 3 muestran Lleva 7.",
      "Las instalaciones nuevas ya no incluyen las 16 salidas de la hoja como historial ni como base estadística.",
      "La estimación comienza en cero y aprende solo de valores manuales o cajas realmente registradas por cada persona.",
    ],
  },
  {
    version: "1.14.0",
    date: "12 de septiembre de 2026",
    title: "Historial de rondas de puntos",
    items: [
      "El cuadro principal muestra los puntos de la ronda actual sin alterar el progreso total de la Auralis Caja Fantasma.",
      "Al comenzar una rueda, la ronda anterior se guarda con fecha, recompensas y desglose, y el conteo parcial vuelve a cero.",
      "El botón Guardar ronda permite cerrar el conteo actual manualmente y consultar debajo cuántas rondas y puntos se llevan.",
      "En Gravedad, la ronda se guarda automáticamente un minuto después de que termina y desaparece la Ballena.",
      "Se eliminaron las sombras grises exteriores del contador flotante y de la Ballena.",
    ],
  },
  {
    version: "1.13.0",
    date: "12 de septiembre de 2026",
    title: "Guardado general del administrador",
    items: [
      "La rueda, los puntos, el objetivo y los tiempos se editan como un único borrador local.",
      "El envío automático por campo fue eliminado para evitar bloqueos mientras el administrador escribe.",
      "Un solo botón Guardar todo publica la configuración general completa para los demás equipos.",
      "La espera y duración activa se configuran en minutos; el retraso previo al próximo contador se configura en milisegundos.",
      "Cuando el programa principal está oculto o minimizado, el contador deja pasar el ratón y oculta sus controles para no interferir con el juego.",
      "El reloj del Riftwalker cambia de tamaño y estilo sin depender del tamaño de la Ballena, para conservar una lectura clara.",
      "Sincronizar con todos publica la fase, la hora absoluta, la espera, la duración activa y la transición al cierre en milisegundos.",
    ],
  },
  {
    version: "1.12.0",
    date: "11 de septiembre de 2026",
    title: "Ballena sin marco y módulos por niveles",
    items: [
      "Lunar vuelve a mostrarse como Lunar en español; el nombre inglés permanece como Lunar Revelry.",
      "Todos los módulos normales muestran Nivel 1–17 y el estado especial se presenta como Brillante.",
      "La Ballena nada desde que entra, continúa moviéndose mientras dispara y conserva el movimiento al retirarse.",
      "El área transparente de la Ballena cambia de tamaño de forma independiente, nunca supera el ancho de la ventana y puede desactivarse.",
      "Inicio incluye un botón que abre los controles de tamaño de la ventana y del área de la Ballena.",
    ],
  },
  {
    version: "1.11.0",
    date: "11 de septiembre de 2026",
    title: "Riftwalker animado y controles más ligeros",
    items: [
      "La Ballena usa un recorte transparente optimizado y mueve cola, cuerpo, cabeza, energía y rayo como capas independientes.",
      "El tamaño de la ventana baja hasta 20 % y la Ballena o futuros adicionales tienen un ajuste propio de 20 % a 100 %.",
      "Personajes tiene su propio menú y los apartados Cambios y Desarrollador solo se muestran al propietario verificado.",
      "Puede añadirse un retraso visual corto al terminar el evento sin alterar el ciclo real ni perder tiempo al apagar el PC.",
      "Los temporizadores, sondeos y sincronizaciones reducen su actividad cuando la interfaz está oculta.",
    ],
  },
  {
    version: "1.10.0",
    date: "11 de septiembre de 2026",
    title: "Contador flotante a tu estilo",
    items: [
      "La ventana flotante puede conservar la forma automática del evento o usar un diseño rectangular, cuadrado, vertical o redondo.",
      "El reloj ofrece estilos digital, compacto y circular con anillo de progreso.",
      "El nombre de la rueda puede mostrarse en español, inglés o con un texto personalizado guardado únicamente en este PC.",
      "El laboratorio visual del desarrollador usa la misma combinación elegida y permite comprobarla antes de abrir la ventana real.",
    ],
  },
  {
    version: "1.9.0",
    date: "11 de septiembre de 2026",
    title: "Rueda pública y laboratorio de interfaz",
    items: [
      "OscarD0823 selecciona la única rueda pública desde el editor protegido y el cambio se sincroniza con todos.",
      "Los demás usuarios ya no pueden cambiar la rueda ni ven las ruedas desactivadas.",
      "El modo desarrollador incluye un laboratorio para probar cada evento, fase, Ballena y tamaño sin modificar el contador público.",
      "La ventana flotante se ajusta entre 70 % y 150 %; su X la desactiva y el inicio incluye un botón para volver a agregarla.",
      "La apertura de la caja incorpora partículas, escaneo, órbitas, energía, chispas y una reacción más marcada de la cerradura.",
    ],
  },
  {
    version: "1.8.0",
    date: "11 de septiembre de 2026",
    title: "Ventana flotante viva para cada evento",
    items: [
      "La ventana flotante muestra la imagen del evento seleccionado y adopta una silueta propia para Lunar, Gravedad y Simbiosis.",
      "La Ballena ahora vive únicamente en la ventana flotante: llega desde la izquierda en el minuto 15 de Gravedad y se coloca debajo del contador.",
      "Su rayo funciona como barra y reloj independiente durante los 15 minutos restantes más 5 minutos adicionales; luego se apaga y la Ballena sale por la derecha.",
      "El instalador fue auditado para incluir solo Auralis Caja Fantasma, su desinstalador y la dependencia oficial WebView2 cuando haga falta.",
    ],
  },
  {
    version: "1.7.0",
    date: "11 de septiembre de 2026",
    title: "Conteo por personaje y modo Equipo",
    items: [
      "Cada personaje conserva por separado sus puntos, porcentaje estimado e historial de cajas.",
      "El modo Equipo comienza en cero y suma cada recompensa a todos los personajes seleccionados.",
      "Al tener dos o más personajes aparece una barra comparativa para revisar su progreso individual.",
    ],
  },
  {
    version: "1.6.4",
    date: "10 de septiembre de 2026",
    title: "La Ballena convierte su rayo en contador",
    items: [
      "Desde el minuto 15 de Gravedad, la Ballena cruza el contador principal y se coloca debajo.",
      "Al disparar, el rayo azul muestra el tiempo restante y se acorta hasta el cierre del evento.",
      "Cuando Gravedad termina, el rayo se apaga y la Ballena abandona el panel antes de desaparecer.",
    ],
  },
  {
    version: "1.6.3",
    date: "10 de septiembre de 2026",
    title: "Escenas propias para Gravedad",
    items: [
      "Las dos nuevas referencias de la ciudad y los objetos suspendidos alternan exclusivamente durante Gravedad activa.",
      "La transición entre escenas es suave y mantiene legible el contador de la barra.",
      "La Ballena continúa apareciendo encima desde el minuto 15 del evento hasta cinco minutos después de terminar.",
    ],
  },
  {
    version: "1.6.2",
    date: "10 de septiembre de 2026",
    title: "Ambiente propio para Simbiosis",
    items: [
      "La nueva referencia de criaturas transformadas se muestra exclusivamente durante la fase activa de Simbiosis.",
      "La barra y el contador flotante adoptan tonos violeta para distinguir este evento.",
      "Las imágenes de Lunar y Gravedad permanecen separadas de Simbiosis.",
    ],
  },
  {
    version: "1.6.1",
    date: "10 de septiembre de 2026",
    title: "Imagen propia para Lunar",
    items: [
      "La referencia de la luna roja, los jugadores con ojos rojos y la iglesia se usa exclusivamente cuando Lunar está activa.",
      "La imagen de la Ballena continúa reservada únicamente para Gravedad.",
      "Al terminar Lunar, la barra vuelve a su apariencia neutral.",
    ],
  },
  {
    version: "1.6.0",
    date: "10 de septiembre de 2026",
    title: "Módulos organizados por equipo y nivel",
    items: [
      "Las armas aparecen agrupadas por estilo y las armaduras por casco, máscara, parte superior, guantes, pantalones y zapatos.",
      "Cada grupo tiene su propio encabezado y el selector separa claramente ARMAS de ARMADURA.",
      "Los módulos normales muestran Nivel 1–17 y las versiones especiales se muestran como Brillante.",
      "El nivel antiguo de la fuente dejó de mostrarse como si fuera el nivel actual del módulo.",
      "El objetivo global cambió a 1.000 puntos y el Desafío de Manibus de Endless Dream ahora suma 1 punto.",
      "El propietario puede publicar el tiempo exacto de la rueda para que todos los equipos adopten el mismo ciclo absoluto, incluso tras apagar el PC.",
      "Se desactivaron por completo las notificaciones de escritorio; el aviso hablado de Gravedad permanece disponible.",
      "La ventana flotante recuerda su última posición y la barra cambia de ambiente para Lunar y Gravedad, incluida la aparición temporal de la Ballena.",
      "La actualización limpia una sola vez los registros personales anteriores y corrige la validación de GitHub para aceptar valores editados por el propietario.",
      "La apertura usa la caja completa: el emblema se desplaza hasta la ranura de una esquina antes de revelar el programa.",
    ],
  },
  {
    version: "1.5.0",
    date: "10 de septiembre de 2026",
    title: "Catálogo completo de módulos",
    items: [
      "El buscador ahora cubre los 1.825 registros exactos: 207 del sistema anterior, 809 normales 2.0 y 809 Brillantes 2.0.",
      "Cada combinación de nombre, variante, ranura, estilo e ID se puede buscar y añadir al seguimiento.",
      "Todos los registros se pueden controlar como objetivo Brillante, sin restricciones por su clasificación de origen.",
      "Nuevo buscador para localizar objetivos activos y módulos Brillantes ya conseguidos dentro del historial personal.",
    ],
  },
  {
    version: "1.4.0",
    date: "10 de septiembre de 2026",
    title: "Control de módulos Brillantes",
    items: [
      "Nuevo seguimiento de intentos fallidos con duplicados nivel 17 para cada módulo y variante.",
      "Colección separada para marcar los módulos que ya se convirtieron en Brillantes y conservar su fecha.",
      "Catálogo bilingüe con 100 módulos base actuales: 36 de arma y 64 de armadura.",
      "Hora punta · Estrella descendente está disponible como combinación del catálogo.",
    ],
  },
  {
    version: "1.3.0",
    date: "10 de septiembre de 2026",
    title: "Contador exacto e historial aproximado",
    items: [
      "Gravedad quedó sincronizada con el cierre indicado a las 4:52:30 p. m. de Colombia.",
      "La sección Visión permite escribir el tiempo exacto restante y elegir si falta para empezar o terminar.",
      "Se pueden cargar valores históricos aproximados manualmente para ampliar la base de estimación.",
      "Los valores aproximados permanecen separados de las cajas confirmadas y se guardan en el respaldo local.",
    ],
  },
  {
    version: "1.2.0",
    date: "10 de septiembre de 2026",
    title: "Editor protegido y apertura animada",
    items: [
      "Un único instalador sirve para todos los usuarios.",
      "El modo desarrollador se desbloquea únicamente al verificar la cuenta propietaria OscarD0823 mediante GitHub CLI.",
      "Nueva animación de inicio: el emblema actúa como cerradura y abre la caja.",
      "La cantidad mostrada en la imagen de referencia cambió de 1 a 17.",
    ],
  },
  {
    version: "1.1.1",
    date: "10 de septiembre de 2026",
    title: "Ciclo sincronizado",
    items: [
      "La imagen de la caja ya no muestra el símbolo azul de enlace.",
      "El ciclo se sincronizó cuando faltaban 27 minutos para comenzar y continuará alternando 30 minutos activo y 30 minutos en espera.",
    ],
  },
  {
    version: "1.1.0",
    date: "10 de septiembre de 2026",
    title: "Promedio real y alertas por voz",
    items: [
      "La columna A de la hoja aporta 16 salidas iniciales: promedio 955,5; mínima 320; máxima 1.447.",
      "Rangos observados: zona baja 704,875, centro 955,5 y zona alta 1.206,125.",
      "Las cajas recibidas por correo de Plataformas conservan en el intento nuevo lo reclamado durante la última hora.",
      "Invasión de Zona Onírica y los tres tipos de Soñador se añadieron con 1 punto cada uno.",
      "El ciclo inicial de la Rueda Visional ahora es de 30 minutos de espera y 30 minutos activa.",
      "Gravedad avisa por voz antes de comenzar, con anticipación configurable y botón de prueba.",
      "La caja de referencia ahora muestra la marca de Once Human en lugar de la tarjeta del arma.",
      "El catálogo del propietario se publica automáticamente y los demás equipos lo revisan cada minuto.",
      "El actualizador comprueba nuevas versiones también mientras la aplicación permanece abierta.",
    ],
  },
  {
    version: "1.0.0",
    date: "10 de septiembre de 2026",
    title: "Primera versión completa",
    items: [
      "Seguimiento ponderado de recompensas Pro y de la Rueda Visional.",
      "Lunar, Gravedad y Simbiosis incluidas; Ballena vale 1 y Plataformas vale 4.",
      "Simbiosis queda desactivada con Araña, Antena y Grandulón sin puntos.",
      "Historial automático de cajas con fecha, hora, mínimo, máximo, promedio y porcentajes.",
      "Temporizador cíclico, avisos, inicio con Windows y ventana flotante ajustable.",
      "Catálogo remoto público y publicación desde el equipo del propietario mediante GitHub CLI.",
      "Actualizaciones firmadas desde GitHub Releases siguiendo el patrón de Fortuna Real.",
    ],
  },
];

function formatDate(value: string, language: UiLanguage = "es") {
  return new Intl.DateTimeFormat(localeForLanguage(language), { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function pointsLabel(points: number, language: UiLanguage = "es") {
  return `${points} ${language === "es" ? (points === 1 ? "punto" : "puntos") : (points === 1 ? "point" : "points")}`;
}

function speakMessage(message: string) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = "es-CO";
  utterance.rate = 0.92;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
  return true;
}

function normalizeCycleState(state: PersistedState, now: number): PersistedState {
  const cycle = computeCycle(state.settings, now);
  const durationMinutes = cycle.phase === "active" ? state.settings.activeMinutes : state.settings.waitMinutes;
  const phaseStartedAt = new Date(new Date(cycle.phaseEndsAt).getTime() - durationMinutes * 60_000).toISOString();
  if (state.settings.phase === cycle.phase && state.settings.phaseStartedAt === phaseStartedAt) return state;
  return { ...state, settings: { ...state.settings, phase: cycle.phase, phaseStartedAt } };
}

type PointRoundContext = {
  key: string;
  trackingMode: "solo" | "team";
  actions: PointAction[];
  characterId?: string;
  characterName?: string;
  teamSessionId?: string;
  characterIds?: string[];
};

function pointRoundContexts(state: PersistedState): PointRoundContext[] {
  const solo = state.characters.map((character) => ({
    key: `solo:${character.id}`,
    trackingMode: "solo" as const,
    actions: actionsForCharacter(state.actions, character.id),
    characterId: character.id,
    characterName: character.name,
  }));
  const teamSessionIds = new Set(state.actions.flatMap((action) => action.trackingMode === "team" && action.teamSessionId ? [action.teamSessionId] : []));
  teamSessionIds.add(state.activeTeamSessionId);
  const teams = [...teamSessionIds].map((teamSessionId) => {
    const actions = actionsForTeamSession(state.actions, teamSessionId);
    return {
      key: `team:${teamSessionId}`,
      trackingMode: "team" as const,
      actions,
      teamSessionId,
      characterIds: [...new Set(actions.flatMap(actionCharacterIds))],
    };
  });
  return [...solo, ...teams];
}

function archivePointRounds(state: PersistedState, trigger: PointRoundTrigger, endedAt: string, vision?: Vision, onlyContextKey?: string) {
  const endedAtMs = Date.parse(endedAt);
  if (!Number.isFinite(endedAtMs)) return state;
  const boundaries = { ...state.pointRoundBoundaries };
  const records: PointRoundRecord[] = [];
  for (const context of pointRoundContexts(state)) {
    if (onlyContextKey && context.key !== onlyContextKey) continue;
    const startedAt = boundaries[context.key];
    const startedAtMs = startedAt ? Date.parse(startedAt) : Number.NEGATIVE_INFINITY;
    if (Number.isFinite(startedAtMs) && endedAtMs <= startedAtMs) continue;
    const actions = pointActionsInRound(context.actions, startedAt, endedAt);
    boundaries[context.key] = endedAt;
    if (actions.length === 0) continue;
    records.push({
      id: createId("round"),
      startedAt: startedAt ?? actions[0].occurredAt,
      endedAt,
      trigger,
      points: actions.reduce((sum, action) => sum + action.points, 0),
      claims: actions.length,
      actionIds: actions.map((action) => action.id),
      visionId: vision?.id,
      visionName: vision?.name,
      trackingMode: context.trackingMode,
      characterId: context.characterId,
      characterName: context.characterName,
      teamSessionId: context.teamSessionId,
      characterIds: context.characterIds,
      breakdown: buildPointRoundBreakdown(actions),
    });
  }
  return { ...state, pointRounds: [...records, ...state.pointRounds].slice(0, 2_000), pointRoundBoundaries: boundaries };
}

function pointRoundTriggerLabel(trigger: PointRoundTrigger, language: UiLanguage = "es") {
  if (trigger === "event-start") return language !== "es" ? "Event start" : "Inicio de evento";
  if (trigger === "whale-end") return language !== "es" ? "Whale end +1 min" : "Fin de Ballena +1 min";
  return language !== "es" ? "Manual save" : "Guardado manual";
}

async function showOverlay(show: boolean) {
  if (!isTauri() || IS_ANDROID) return;
  const overlay = await WebviewWindow.getByLabel("overlay");
  if (!overlay) return;
  if (show) await overlay.show();
  else await overlay.hide();
}

export default function App() {
  const [state, setState] = useState<PersistedState>(() => loadState());
  const currentStateRef = useRef(state);
  currentStateRef.current = state;
  const [closeBusy, setCloseBusy] = useState(false);
  const closeInFlightRef = useRef(false);
  const closeRequestedRef = useRef<boolean | null>(null);
  const language = state.settings.uiLanguage;
  const english = language !== "es";
  const tx = useCallback((spanish: string, englishText: string) => translate(language, spanish, englishText), [language]);
  const [tab, setTab] = useState<TabId>("progress");
  const [now, setNow] = useState(Date.now());
  const [syncStatus, setSyncStatus] = useState("Catálogo local listo");
  const [toast, setToast] = useState("");
  const [introVisible, setIntroVisible] = useState(true);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialNotice, setTutorialNotice] = useState(() => {
    try { return !localStorage.getItem(STORAGE_KEY) && !localStorage.getItem("caja-fantasma.tutorial.seen.v1"); } catch { return false; }
  });
  const finishTutorial = useCallback(() => {
    setTutorialOpen(false);
    setTutorialNotice(false);
    try { localStorage.setItem("caja-fantasma.tutorial.seen.v1", "1"); } catch { /* Tutorial preference must not block progress saving. */ }
  }, []);
  const [homeOverlayConfigOpen, setHomeOverlayConfigOpen] = useState(false);
  const [localSyncInfo, setLocalSyncInfo] = useState<LocalSyncInfo>();
  const [localSyncStatus, setLocalSyncStatus] = useState("Sin conexión local");
  const [localSyncBusy, setLocalSyncBusy] = useState(false);
  const [connectedDevices, setConnectedDevices] = useState<string[]>([]);
  const [presenceReceivedAt, setPresenceReceivedAt] = useState(0);
  const pwa = usePwaInstall(IS_WEB);
  const [nativeBackupReady, setNativeBackupReady] = useState(!isTauri());
  const [webBackupReady, setWebBackupReady] = useState(!IS_WEB);
  const personalRestoreReady = nativeBackupReady && webBackupReady;
  const restoreReadyRef = useRef(personalRestoreReady);
  restoreReadyRef.current = personalRestoreReady;
  const [webStorageStatus, setWebStorageStatus] = useState<WebStorageStatus>();
  const [creatorAccess, setCreatorAccess] = useState<CreatorAccess>("checking");
  const [ownerEntryRequested, setOwnerEntryRequested] = useState(false);
  const [creatorMessage, setCreatorMessage] = useState("Comprobando la cuenta de GitHub…");
  const initialCycle = useRef(computeCycle(state.settings));
  const initialCycleSeconds = Math.ceil(initialCycle.current.remainingMs / 1000);
  const [counterPhase, setCounterPhase] = useState<"waiting" | "active">(initialCycle.current.phase);
  const [counterMinutes, setCounterMinutes] = useState(() => String(Math.floor(initialCycleSeconds / 60)));
  const [counterSeconds, setCounterSeconds] = useState(() => String(initialCycleSeconds % 60));
  const [manualHistoryText, setManualHistoryText] = useState("");
  const [newCharacterName, setNewCharacterName] = useState("");
  const [shinyCatalogModule, setShinyCatalogModule] = useState<ShinyCatalogModule>();
  const [shinyCatalogError, setShinyCatalogError] = useState("");
  const [shinyCatalogAttempt, setShinyCatalogAttempt] = useState(0);
  const [shinySearch, setShinySearch] = useState("");
  const [shinyGroupFilter, setShinyGroupFilter] = useState("all");
  const [shinySystemFilter, setShinySystemFilter] = useState("all");
  const [shinyRecordSearch, setShinyRecordSearch] = useState("");
  const [selectedShinyModId, setSelectedShinyModId] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const voiceAlertRef = useRef("");
  const personalSyncUpdatedAtRef = useRef(loadPersonalSyncUpdatedAt());
  const personalSyncJsonRef = useRef(JSON.stringify(personalSyncPayload(state)));
  const localSyncInFlightRef = useRef(false);
  const liveRevisionRef = useRef(0);
  const desktopRevisionRef = useRef(0);
  const lastLocalExchangeRef = useRef(0);
  const lastMobileUpdateRef = useRef(0);
  const localSyncEnabledRef = useRef(state.settings.localSyncEnabled);
  localSyncEnabledRef.current = state.settings.localSyncEnabled;

  const setHomeOverlayEditing = useCallback((enabled: boolean) => {
    setHomeOverlayConfigOpen(enabled);
    if (isTauri() && !IS_ANDROID) void emit("caja-fantasma-overlay-edit-mode", { enabled });
  }, []);

  const SHINY_MOD_CATALOG = shinyCatalogModule?.SHINY_MOD_CATALOG ?? EMPTY_SHINY_CATALOG;
  const SHINY_MOD_GROUPS = shinyCatalogModule?.SHINY_MOD_GROUPS ?? EMPTY_SHINY_GROUPS;
  const SHINY_MOD_CATALOG_META = shinyCatalogModule?.SHINY_MOD_CATALOG_META ?? { sourceUrl: "", sourceCheckedAt: "", total: 0, normal: 0, shiny: 0 };
  const defaultShinyMod = SHINY_MOD_CATALOG.find((item) => item.englishName === "Rush Hour <Downstar>" && !item.isCatalogShiny) ?? SHINY_MOD_CATALOG[0];

  const referencePoints = useMemo(() => [...state.manualBaselinePoints], [state.manualBaselinePoints]);
  const personalSyncJson = useMemo(() => JSON.stringify(personalSyncPayload(state)), [state.actions, state.deletedActionIds, state.activityHistory, state.boxes, state.pointRounds, state.pointRoundBoundaries, state.manualBaselinePoints, state.shinyMods, state.characters, state.activeCharacterId, state.trackingMode, state.teamMemberIds, state.activeTeamSessionId]);
  const sharedCatalogJson = useMemo(() => JSON.stringify(state.catalog), [state.catalog]);
  const eventNotificationJson = useMemo(() => JSON.stringify({
    selectedVisionId: state.settings.selectedVisionId, phase: state.settings.phase,
    phaseStartedAt: state.settings.phaseStartedAt, waitMinutes: state.settings.waitMinutes,
    activeMinutes: state.settings.activeMinutes, transitionDelayMilliseconds: state.settings.transitionDelayMilliseconds,
    sharedTimingUpdatedAt: state.settings.sharedTimingUpdatedAt, uiLanguage: state.settings.uiLanguage,
  }), [state.settings.selectedVisionId, state.settings.phase, state.settings.phaseStartedAt, state.settings.waitMinutes, state.settings.activeMinutes, state.settings.transitionDelayMilliseconds, state.settings.sharedTimingUpdatedAt, state.settings.uiLanguage]);
  const target = clampNumber(state.catalog.boxTargetPoints, 1, 10_000);
  const activeCharacter = state.characters.find((character) => character.id === state.activeCharacterId) ?? state.characters[0];
  const isTeamMode = state.trackingMode === "team" && state.characters.length > 1;
  const activeCharacterActions = useMemo(() => actionsForCharacter(state.actions, activeCharacter.id), [state.actions, activeCharacter.id]);
  const activeTeamActions = useMemo(() => actionsForTeamSession(state.actions, state.activeTeamSessionId), [state.actions, state.activeTeamSessionId]);
  const currentActions = isTeamMode ? activeTeamActions : activeCharacterActions;
  const currentPoints = useMemo(() => currentActions.reduce((sum, action) => sum + action.points, 0), [currentActions]);
  const currentClaims = currentActions.length;
  const currentPointRoundKey = isTeamMode ? `team:${state.activeTeamSessionId}` : `solo:${activeCharacter.id}`;
  const currentPointRoundActions = useMemo(() => pointActionsInRound(currentActions, state.pointRoundBoundaries[currentPointRoundKey]), [currentActions, currentPointRoundKey, state.pointRoundBoundaries]);
  const currentPointRoundPoints = useMemo(() => currentPointRoundActions.reduce((sum, action) => sum + action.points, 0), [currentPointRoundActions]);
  const visiblePointRounds = useMemo(() => state.pointRounds.filter((record) => isTeamMode ? record.trackingMode === "team" : record.trackingMode === "solo" && record.characterId === activeCharacter.id), [activeCharacter.id, isTeamMode, state.pointRounds]);
  const savedPointRoundTotal = useMemo(() => visiblePointRounds.reduce((sum, record) => sum + record.points, 0), [visiblePointRounds]);
  const todayKey = gameDayKey(now);
  const activitySummary = useMemo(() => activityHistorySummary(state.activityHistory, new Date(`${todayKey}T12:00:00`)), [state.activityHistory, todayKey]);
  const activityCount = (activity: Activity, vision?: Vision) => activitySummary.ranking.find((item) => item.key === `${vision?.id ?? "pro"}:${activity.id}`) ?? { todayCount: 0, count: 0 };
  const breakdown = useMemo(() => buildBreakdown(currentActions), [currentActions]);
  const activeCharacterBoxes = useMemo(() => state.boxes.filter((box) => (box.characterId ?? DEFAULT_CHARACTER_ID) === activeCharacter.id), [state.boxes, activeCharacter.id]);
  const activeCharacterPoints = useMemo(() => activeCharacterActions.reduce((sum, action) => sum + action.points, 0), [activeCharacterActions]);
  const stats = useMemo(() => boxStatistics(activeCharacterBoxes, activeCharacterPoints, referencePoints), [activeCharacterBoxes, activeCharacterPoints, referencePoints]);
  const characterSummaries = useMemo(() => state.characters.map((character) => {
    const actions = actionsForCharacter(state.actions, character.id);
    const points = actions.reduce((sum, action) => sum + action.points, 0);
    const boxes = state.boxes.filter((box) => (box.characterId ?? DEFAULT_CHARACTER_ID) === character.id);
    return { character, points, chance: boxStatistics(boxes, points, referencePoints).currentChancePercent };
  }), [state.characters, state.actions, state.boxes, referencePoints]);
  const selectedTeamSummaries = characterSummaries.filter((summary) => state.teamMemberIds.includes(summary.character.id));
  const displayedChance = isTeamMode && selectedTeamSummaries.length > 0
    ? selectedTeamSummaries.reduce((sum, summary) => sum + summary.chance, 0) / selectedTeamSummaries.length
    : stats.currentChancePercent;
  const teamReady = !isTeamMode || state.teamMemberIds.length >= 2;
  const publicVisionId = sharedVisionId(state.catalog, state.settings.selectedVisionId);
  const selectedVision = state.catalog.visions.find((vision) => vision.id === publicVisionId) ?? state.catalog.visions.find((vision) => vision.enabled) ?? state.catalog.visions[0];
  const localSyncAddressReady = isValidLocalSyncAddress(state.settings.localSyncAddress);
  const desktopLocalAddress = splitLocalSyncAddress(localSyncInfo?.address ?? "");
  const cycle = computeCycle(state.settings, now);
  const cycleDurationMinutes = cycle.phase === "active" ? state.settings.activeMinutes : state.settings.waitMinutes;
  const cyclePhaseStartedAt = new Date(Date.parse(cycle.phaseEndsAt) - cycleDurationMinutes * 60_000).toISOString();
  const transition = computeCountdownTransition(state.settings, now);
  const overlayDisplayName = overlayVisionName(selectedVision, state.settings.overlayNameMode, state.settings.overlayCustomName);
  const overlayDisplayMs = transition.active ? transition.remainingMs : cycle.remainingMs;
  const overlayDisplayTimer = state.settings.overlayCounterStyle === "compact" ? formatCompactDuration(overlayDisplayMs) : formatDuration(overlayDisplayMs);
  const whale = computeGravityWhale(state.settings, now);
  const whaleAvailable = selectedVision?.id === "gravity" && state.settings.activeMinutes > 15;
  const whaleNextMs = cycle.phase === "active" ? Math.max(0, 15 * 60_000 - (state.settings.activeMinutes * 60_000 - cycle.remainingMs)) : cycle.remainingMs + 15 * 60_000;
  const currentDevice: DeviceKind = IS_WEB ? "web" : IS_ANDROID ? "mobile" : "pc";
  const visibleTabs = TABS.filter((item) => item.id !== "changes" || creatorAccess === "granted");
  const selectedShinyMod = SHINY_MOD_CATALOG.find((item) => item.id === selectedShinyModId) ?? defaultShinyMod;
  const normalizedShinySearch = normalizeModSearch(shinySearch);
  const filteredShinyCatalog = useMemo(() => SHINY_MOD_CATALOG.filter((item) => {
    if (shinyGroupFilter !== "all" && item.groupId !== shinyGroupFilter) return false;
    if (shinySystemFilter === "normal" && (item.system !== "new" || item.isCatalogShiny)) return false;
    if (shinySystemFilter === "shiny" && (item.system !== "new" || !item.isCatalogShiny)) return false;
    return matchesModSearch(item, normalizedShinySearch);
  }), [SHINY_MOD_CATALOG, normalizedShinySearch, shinyGroupFilter, shinySystemFilter]);
  const visibleItemsPerGroup = shinyGroupFilter !== "all" || normalizedShinySearch ? 150 : 12;
  const groupedVisibleShinyCatalog = useMemo(() => SHINY_MOD_GROUPS.map((group) => ({
    ...group,
    items: filteredShinyCatalog.filter((item) => item.groupId === group.id).slice(0, visibleItemsPerGroup),
  })).filter((group) => group.items.length > 0), [SHINY_MOD_GROUPS, filteredShinyCatalog, visibleItemsPerGroup]);
  const visibleShinyCatalogCount = groupedVisibleShinyCatalog.reduce((sum, group) => sum + group.items.length, 0);
  const normalizedRecordSearch = normalizeModSearch(shinyRecordSearch);
  const matchesRecordSearch = (item: ShinyModRecord) => !normalizedRecordSearch || normalizeModSearch(`${item.modName} ${item.englishName ?? ""} ${item.groupName} ${item.variant}`).includes(normalizedRecordSearch);
  const allActiveShinyGoals = state.shinyMods.filter((item) => !item.isShiny);
  const allObtainedShinyMods = state.shinyMods.filter((item) => item.isShiny);
  const activeShinyGoals = allActiveShinyGoals.filter(matchesRecordSearch);
  const obtainedShinyMods = allObtainedShinyMods.filter(matchesRecordSearch);
  const totalShinyAttempts = state.shinyMods.reduce((sum, item) => sum + item.attempts, 0);
  const catalogShinyOwned = new Set(allObtainedShinyMods.flatMap((item) => item.catalogId ? [item.catalogId] : [])).size;
  const shinyCollectionPercent = (catalogShinyOwned / SHINY_MOD_CATALOG.length) * 100;

  const commitState = useCallback((update: PersistedState | ((current: PersistedState) => PersistedState)) => {
    setState((current) => typeof update === "function" ? update(current) : update);
  }, []);

  useEffect(() => { document.documentElement.lang = localeForLanguage(language); }, [language]);
  useEffect(() => {
    const refreshLanguage = () => commitState(current => current.settings.uiLanguageMode === "auto" ? { ...current, settings: { ...current.settings, uiLanguage: detectUiLanguage() } } : current);
    window.addEventListener("languagechange", refreshLanguage);
    return () => window.removeEventListener("languagechange", refreshLanguage);
  }, [commitState]);

  const saveAndClose = useCallback(async (exitApp: boolean) => {
    if (IS_ANDROID || !isTauri()) return;
    closeRequestedRef.current = closeRequestedRef.current === true || exitApp;
    setCloseBusy(true);
    if (!restoreReadyRef.current || closeInFlightRef.current) return;
    closeInFlightRef.current = true;
    try {
      const exitRequested = closeRequestedRef.current;
      let saved = await persistDesktopProgress(currentStateRef.current, invoke, exitRequested);
      if (!exitRequested && closeRequestedRef.current === true) saved = await persistDesktopProgress(saved, invoke, true);
      currentStateRef.current = saved;
      setState(saved);
      await invoke("finish_desktop_close", { exitApp: closeRequestedRef.current });
      closeRequestedRef.current = null;
    } catch (reason) {
      closeRequestedRef.current = null;
      setToast(tx("No se cerró: no se pudo guardar el progreso. ", "Not closed: progress could not be saved. ") + String(reason));
      void getCurrentWindow().show();
    } finally {
      closeInFlightRef.current = false;
      setCloseBusy(false);
    }
  }, [tx]);

  useEffect(() => {
    if (personalRestoreReady && closeRequestedRef.current !== null) void saveAndClose(closeRequestedRef.current);
  }, [personalRestoreReady, saveAndClose]);

  useEffect(() => {
    if (IS_ANDROID || !isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void listen<{ exitApp: boolean }>("caja-fantasma-save-request", (event) => void saveAndClose(event.payload.exitApp))
      .then((stop) => { if (disposed) stop(); else unlisten = stop; });
    const persistOnUnload = () => { try { saveState(currentStateRef.current); } catch { /* Native backup remains available. */ } };
    window.addEventListener("pagehide", persistOnUnload);
    window.addEventListener("beforeunload", persistOnUnload);
    return () => {
      disposed = true;
      unlisten?.();
      window.removeEventListener("pagehide", persistOnUnload);
      window.removeEventListener("beforeunload", persistOnUnload);
    };
  }, [saveAndClose]);

  useEffect(() => {
    const flush=()=>{if(!personalRestoreReady)return;try{saveState(currentStateRef.current);}catch{setToast(tx('No se pudo guardar: exporta una copia antes de cerrar.','Could not save: export a backup before closing.'));}};
    const hidden=()=>{if(document.visibilityState==='hidden')flush();};
    window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',hidden);
    return()=>{window.removeEventListener('pagehide',flush);document.removeEventListener('visibilitychange',hidden);};
  },[personalRestoreReady,tx]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const acceptLocalSyncSnapshot = useCallback((snapshot: Pick<LocalSyncSnapshot, "updatedAt" | "dataJson">, force = false, mode: "merge" | "replace" = "merge") => {
    const remoteUpdatedAt = Date.parse(snapshot.updatedAt);
    const localUpdatedAt = Date.parse(personalSyncUpdatedAtRef.current);
    if (!Number.isFinite(remoteUpdatedAt) || (!force && Number.isFinite(localUpdatedAt) && remoteUpdatedAt <= localUpdatedAt)) return false;
    if (personalSyncJsonRef.current === snapshot.dataJson) {
      if (remoteUpdatedAt > localUpdatedAt) {
        personalSyncUpdatedAtRef.current = snapshot.updatedAt;
        savePersonalSyncUpdatedAt(snapshot.updatedAt);
      }
      return false;
    }
    const value = JSON.parse(snapshot.dataJson) as unknown;
    setState((current) => {
      if (mode === "merge" && personalHistoryCount(current) > 0 && personalHistoryCount(value) === 0 && !hasIntentionalActionDeletions(value)) return current;
      const synchronized = mode === "replace"
        ? applyPersonalSyncPayload(current, value)
        : mergePersonalSyncPayload(current, value, true);
      personalSyncJsonRef.current = JSON.stringify(personalSyncPayload(synchronized));
      personalSyncUpdatedAtRef.current = snapshot.updatedAt;
      savePersonalSyncUpdatedAt(snapshot.updatedAt);
      return synchronized;
    });
    return true;
  }, []);

  const acceptLocalSyncCatalog = useCallback((catalogJson?: string) => {
    if (!catalogJson) return;
    const catalog = JSON.parse(catalogJson) as unknown;
    if (!validateCatalog(catalog)) throw new Error(tx("El dispositivo devolvió un catálogo público inválido.", "The device returned an invalid public catalog."));
    setState((current) => applyRemoteCatalog(current, catalog));
  }, [tx]);

  const getPhoneSnapshot = useCallback(() => ({ dataJson: personalSyncJsonRef.current, updatedAt: personalSyncUpdatedAtRef.current }), []);
  const acceptPhoneSnapshot = useCallback((snapshot: PhoneBridgeSnapshot) => { acceptLocalSyncSnapshot(snapshot, true); }, [acceptLocalSyncSnapshot]);
  const phoneBridge = usePhoneBridgeSync({ ready: personalRestoreReady, mobile: IS_ANDROID, web: IS_WEB, code: state.settings.phoneSyncCode, address: state.settings.phoneSyncAddress, dataJson: personalSyncJson, catalogJson: sharedCatalogJson, english, getSnapshot: getPhoneSnapshot, onSnapshot: acceptPhoneSnapshot, onCatalog: acceptLocalSyncCatalog });
  const onlineDevices = [...new Set([
    ...recentConnectedDevices(state.settings.localSyncEnabled, connectedDevices, presenceReceivedAt),
    ...phoneBridge.online,
  ])];

  const acceptBackgroundSyncStatus = useCallback((background: BackgroundSyncStatus) => {
    if (background.connected) { setConnectedDevices(background.connectedDevices?.length ? background.connectedDevices : ["pc", "mobile"]); setPresenceReceivedAt(Date.now()); }
    else setConnectedDevices([]);
    liveRevisionRef.current = Math.max(liveRevisionRef.current, background.revision);
    if (background.catalogJson && background.catalogJson !== "{}") {
      try {
        acceptLocalSyncCatalog(background.catalogJson);
      } catch {
        // El servicio conserva el último catálogo válido y volverá a solicitarlo al PC.
      }
    }
    if (background.dataJson && background.dataJson !== "{}") {
      try {
        const receivedChanges = acceptLocalSyncSnapshot(background, true);
        if (receivedChanges) {
          setLocalSyncStatus(tx("Cambios del PC recibidos en segundo plano", "PC changes received in the background"));
          return;
        }
      } catch {
        // Una respuesta incompleta nunca debe reemplazar el estado local.
      }
    }
    setLocalSyncStatus(background.message || (background.connected
      ? tx("PC conectado · datos en vivo al día", "PC connected · live data up to date")
      : tx("Buscando el PC en la red local", "Looking for the PC on the local network")));
  }, [acceptLocalSyncCatalog, acceptLocalSyncSnapshot, tx]);

  const exchangeWithComputer = useCallback(async (action: LocalSyncAction, showBusy = true) => {
    if ((!IS_ANDROID && !IS_WEB) || localSyncInFlightRef.current) return;
    const address = state.settings.localSyncAddress.trim();
    const pairingCode = state.settings.localSyncCode.trim();
    if (!isValidLocalSyncAddress(address) || !/^\d{6}$/.test(pairingCode)) {
      setLocalSyncStatus(tx("Completa la IP, el puerto y el código de 6 números que muestra el PC", "Enter the PC IP, port, and six-digit code"));
      return;
    }
    localSyncInFlightRef.current = true;
    if (showBusy) setLocalSyncBusy(true);
    if (action === "status") setLocalSyncStatus(tx("Conectando con el puente local del PC…", "Connecting to the PC local bridge…"));
    const resumeBackgroundSync = IS_ANDROID && state.settings.localSyncLiveEnabled && (action === "pull" || action === "push");
    let backgroundDataJson = personalSyncJsonRef.current;
    let backgroundUpdatedAt = personalSyncUpdatedAtRef.current;
    let backgroundRevision = liveRevisionRef.current;
    try {
      if (resumeBackgroundSync) {
        await invoke<BackgroundSyncStatus>("plugin:android-updater|stop_background_sync").catch(() => undefined);
      }
      const request = {
        protocol: 2,
        clientKind: IS_WEB ? "web" : "mobile",
        pairingCode,
        action,
        knownRevision: action === "live" ? liveRevisionRef.current : 0,
        dataJson: action === "push" || action === "live" ? personalSyncJsonRef.current : "{}",
        updatedAt: action === "push" || action === "live" ? personalSyncUpdatedAtRef.current : "1970-01-01T00:00:00.000Z",
      };
      const exchange = IS_WEB
        ? await (async () => {
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 8_000);
            const init: LocalNetworkRequestInit = {
              method: "POST",
              mode: "cors",
              cache: "no-store",
              credentials: "omit",
              headers: { "Content-Type": "text/plain;charset=UTF-8" },
              body: JSON.stringify(request),
              signal: controller.signal,
              // Chromium necesita conocer de antemano que una página HTTPS va a hablar
              // con el puente privado del PC. Los navegadores antiguos ignoran esta opción.
              targetAddressSpace: localSyncTargetAddressSpace(address),
            };
            try {
              const response = await fetch(`http://${address}/sync`, init);
              const result = await response.json() as LocalSyncExchange;
              if (!response.ok || !result.ok) throw new Error(result.message || `HTTP ${response.status}`);
              return result;
            } catch (error) {
              if (error instanceof Error && error.name === "AbortError") {
                throw new Error(tx("El navegador no pudo entrar al puente del PC. Mantén Auralis Caja Fantasma abierta y permite el acceso a la red local cuando lo solicite.", "The browser could not reach the PC bridge. Keep Auralis Caja Fantasma open and allow local network access when prompted."));
              }
              if (error instanceof TypeError) {
                const permissionState = await localNetworkPermissionState(address);
                if (permissionState === "denied") {
                  throw new Error(tx("Edge bloqueó el permiso de red local para esta página. Habilítalo desde el icono junto a la dirección y pulsa Volver a conectar.", "Edge blocked local network permission for this page. Enable it from the icon next to the address and select Reconnect."));
                }
                throw new Error(tx("No se encontró el puente del PC. Abre Auralis Caja Fantasma en Windows, ve a Dispositivos, pulsa Compartir con el celular y luego Volver a conectar aquí.", "The PC bridge was not found. Open Auralis Caja Fantasma on Windows, go to Devices, select Share with phone, then select Reconnect here."));
              }
              throw error;
            } finally {
              window.clearTimeout(timeout);
            }
          })()
        : await invoke<LocalSyncExchange>("mobile_sync_exchange", {
            address,
            pairingCode,
            action,
            knownRevision: request.knownRevision,
            dataJson: request.dataJson,
            updatedAt: request.updatedAt,
          });
      if (action !== "status") liveRevisionRef.current = exchange.revision;
      setConnectedDevices(exchange.connectedDevices ?? ["pc", IS_WEB ? "web" : "mobile"]);
      setPresenceReceivedAt(Date.now());
      if (resumeBackgroundSync) {
        backgroundDataJson = exchange.dataJson;
        backgroundUpdatedAt = exchange.updatedAt;
        backgroundRevision = exchange.revision;
      }
      acceptLocalSyncCatalog(exchange.catalogJson);
      if (action === "pull") {
        const receivedChanges = acceptLocalSyncSnapshot(exchange, true, "replace");
        setLocalSyncStatus(receivedChanges ? tx("Datos del PC copiados al celular", "PC data copied to this phone") : tx("El celular ya tenía los mismos datos del PC", "The phone already had the same PC data"));
      } else if (action === "push") {
        setLocalSyncStatus(tx("Datos del celular copiados al PC", "Phone data copied to the PC"));
      } else if (action === "live") {
        const receivedChanges = acceptLocalSyncSnapshot(exchange, true);
        setLocalSyncStatus(receivedChanges ? tx("Cambios del PC recibidos en vivo", "PC changes received live") : tx("Sincronización en vivo · datos al día", "Live sync · data up to date"));
      } else {
        setLocalSyncStatus(tx("PC conectado · catálogo público al día", "PC connected · public catalog up to date"));
      }
    } catch (error) {
      setConnectedDevices([]);
      setLocalSyncStatus(error instanceof Error ? error.message : String(error));
    } finally {
      if (resumeBackgroundSync) {
        void invoke<BackgroundSyncStatus>("plugin:android-updater|start_background_sync", {
          address,
          pairingCode,
          dataJson: backgroundDataJson,
          updatedAt: backgroundUpdatedAt,
          knownRevision: backgroundRevision,
          eventTimingJson: eventNotificationJson,
        }).then(acceptBackgroundSyncStatus).catch(() => undefined);
      }
      localSyncInFlightRef.current = false;
      if (showBusy) setLocalSyncBusy(false);
    }
  }, [acceptBackgroundSyncStatus, acceptLocalSyncCatalog, acceptLocalSyncSnapshot, eventNotificationJson, state.settings.localSyncAddress, state.settings.localSyncCode, state.settings.localSyncLiveEnabled, tx]);

  useEffect(() => {
    if (personalSyncJsonRef.current !== personalSyncJson) {
      personalSyncJsonRef.current = personalSyncJson;
      const updatedAt = new Date().toISOString();
      personalSyncUpdatedAtRef.current = updatedAt;
      savePersonalSyncUpdatedAt(updatedAt);
    }
    if (personalRestoreReady && !IS_ANDROID && isTauri() && state.settings.localSyncEnabled) {
      void invoke<number>("update_local_sync_state", {
        dataJson: personalSyncJsonRef.current,
        updatedAt: personalSyncUpdatedAtRef.current,
        catalogJson: sharedCatalogJson,
        liveEnabled: state.settings.localSyncLiveEnabled,
        knownRevision: desktopRevisionRef.current,
      }).then((revision) => {
        desktopRevisionRef.current = Math.max(desktopRevisionRef.current, revision);
      }).catch(() => undefined);
    }
  }, [personalRestoreReady, personalSyncJson, sharedCatalogJson, state.settings.localSyncEnabled, state.settings.localSyncLiveEnabled]);

  useEffect(() => {
    if (!personalRestoreReady || IS_ANDROID || !isTauri() || !state.settings.localSyncEnabled) {
      setLocalSyncInfo(undefined);
      return;
    }
    let active = true;
    const pairingCode = state.settings.localSyncCode;
    if (!/^\d{6}$/.test(pairingCode)) {
      setLocalSyncStatus(tx("No se pudo iniciar: el código de conexión no es válido", "Could not start: the connection code is invalid"));
      return;
    }
    const start = async () => {
      try {
        const info = await invoke<LocalSyncInfo>("start_local_sync", {
          pairingCode,
          dataJson: personalSyncJsonRef.current,
          updatedAt: personalSyncUpdatedAtRef.current,
          catalogJson: sharedCatalogJson,
          liveEnabled: state.settings.localSyncLiveEnabled,
        });
        if (!active) {
          if (!localSyncEnabledRef.current) void invoke("stop_local_sync").catch(() => undefined);
          return;
        }
        desktopRevisionRef.current = info.revision;
        setLocalSyncInfo(info);
        setLocalSyncStatus(tx(`Esperando web y móvil en ${info.address}`, `Waiting for web and mobile at ${info.address}`));
      } catch (error) {
        if (active) setLocalSyncStatus(error instanceof Error ? error.message : String(error));
      }
    };
    void start();
    const timer = window.setInterval(() => {
      if (!active) return;
      void invoke<LocalSyncSnapshot>("read_local_sync_state")
        .then((snapshot) => {
          if (!active) return;
          setConnectedDevices(snapshot.connectedDevices ?? []);
          setPresenceReceivedAt(Date.now());
          desktopRevisionRef.current = Math.max(desktopRevisionRef.current, snapshot.revision);
          const hasMobileUpdate = snapshot.lastMobileUpdateAt > lastMobileUpdateRef.current;
          if (hasMobileUpdate) lastMobileUpdateRef.current = snapshot.lastMobileUpdateAt;
          const receivedChanges = hasMobileUpdate ? acceptLocalSyncSnapshot(snapshot, true) : false;
          if (receivedChanges) setLocalSyncStatus(tx("Datos nuevos recibidos del celular", "New data received from the phone"));
          else if (snapshot.lastExchangeAt > lastLocalExchangeRef.current) setLocalSyncStatus(tx("Dispositivos conectados · datos al día", "Devices connected · data up to date"));
          lastLocalExchangeRef.current = Math.max(lastLocalExchangeRef.current, snapshot.lastExchangeAt);
        })
        .catch(() => undefined);
    }, 1_500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [acceptLocalSyncSnapshot, personalRestoreReady, sharedCatalogJson, state.settings.localSyncCode, state.settings.localSyncEnabled, state.settings.localSyncLiveEnabled, tx]);

  useEffect(() => {
    if (IS_ANDROID || !isTauri() || state.settings.localSyncEnabled) return;
    setLocalSyncInfo(undefined);
    desktopRevisionRef.current = 0;
    void invoke("stop_local_sync").catch(() => undefined);
  }, [state.settings.localSyncEnabled]);

  useEffect(() => {
    if (!personalRestoreReady || (!IS_ANDROID && !IS_WEB) || !state.settings.localSyncEnabled || state.settings.localSyncLiveEnabled) return;
    liveRevisionRef.current = 0;
    void exchangeWithComputer("status", false);
    const timer = window.setInterval(() => void exchangeWithComputer("status", false), 5_000);
    return () => window.clearInterval(timer);
  }, [exchangeWithComputer, personalRestoreReady, state.settings.localSyncEnabled, state.settings.localSyncLiveEnabled]);

  useEffect(() => {
    if (!personalRestoreReady || !IS_WEB || !state.settings.localSyncEnabled || !state.settings.localSyncLiveEnabled) return;
    liveRevisionRef.current = 0;
    const synchronize = () => void exchangeWithComputer("live", false);
    synchronize();
    const timer = window.setInterval(synchronize, 2_000);
    window.addEventListener("focus", synchronize);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", synchronize); };
  }, [exchangeWithComputer, personalRestoreReady, state.settings.localSyncEnabled, state.settings.localSyncLiveEnabled]);

  useEffect(() => {
    if (!personalRestoreReady || !IS_ANDROID || !isTauri()) return;
    if (!state.settings.localSyncEnabled || !state.settings.localSyncLiveEnabled) {
      void invoke<BackgroundSyncStatus>("plugin:android-updater|stop_background_sync").catch(() => undefined);
      return;
    }
    const address = state.settings.localSyncAddress.trim();
    const pairingCode = state.settings.localSyncCode.trim();
    if (!isValidLocalSyncAddress(address) || !/^\d{6}$/.test(pairingCode)) {
      void invoke<BackgroundSyncStatus>("plugin:android-updater|stop_background_sync").catch(() => undefined);
      return;
    }
    let active = true;
    const applyStatus = (background: BackgroundSyncStatus) => {
      if (active) acceptBackgroundSyncStatus(background);
    };
    const readStatus = () => {
      void invoke<BackgroundSyncStatus>("plugin:android-updater|read_background_sync")
        .then(applyStatus)
        .catch(() => undefined);
    };
    void invoke<BackgroundSyncStatus>("plugin:android-updater|start_background_sync", {
      address,
      pairingCode,
      dataJson: personalSyncJsonRef.current,
      updatedAt: personalSyncUpdatedAtRef.current,
      knownRevision: liveRevisionRef.current,
      eventTimingJson: eventNotificationJson,
    }).then(applyStatus).catch((error) => {
      if (active) setLocalSyncStatus(error instanceof Error ? error.message : String(error));
    });
    const timer = window.setInterval(readStatus, 1_500);
    window.addEventListener("focus", readStatus);
    document.addEventListener("visibilitychange", readStatus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", readStatus);
      document.removeEventListener("visibilitychange", readStatus);
    };
  }, [acceptBackgroundSyncStatus, eventNotificationJson, personalRestoreReady, state.settings.localSyncAddress, state.settings.localSyncCode, state.settings.localSyncEnabled, state.settings.localSyncLiveEnabled]);

  useEffect(() => {
    if (!personalRestoreReady || !IS_ANDROID || !isTauri() || !state.settings.localSyncEnabled || !state.settings.localSyncLiveEnabled) return;
    const address = state.settings.localSyncAddress.trim();
    const pairingCode = state.settings.localSyncCode.trim();
    if (!isValidLocalSyncAddress(address) || !/^\d{6}$/.test(pairingCode)) return;
    void invoke<BackgroundSyncStatus>("plugin:android-updater|update_background_sync", {
      address,
      pairingCode,
      dataJson: personalSyncJsonRef.current,
      updatedAt: personalSyncUpdatedAtRef.current,
      knownRevision: liveRevisionRef.current,
      eventTimingJson: eventNotificationJson,
    }).then(acceptBackgroundSyncStatus).catch(() => undefined);
  }, [acceptBackgroundSyncStatus, eventNotificationJson, personalRestoreReady, personalSyncJson, state.settings.localSyncAddress, state.settings.localSyncCode, state.settings.localSyncEnabled, state.settings.localSyncLiveEnabled]);

  const checkCreatorAccess = useCallback(async () => {
    if (IS_ANDROID) {
      setCreatorAccess("locked");
      setCreatorMessage("La edición y publicación del catálogo se realizan desde el instalador de Windows del propietario.");
      return;
    }
    if (!isTauri()) {
      if (import.meta.env.DEV) {
        setCreatorAccess("granted");
        setCreatorMessage("Laboratorio local de desarrollo; la publicación está deshabilitada en el navegador.");
        return;
      }
      setCreatorAccess("locked");
      setCreatorMessage("La verificación solo funciona en el instalador Creador de Windows.");
      return;
    }
    setCreatorAccess("checking");
    setCreatorMessage("Comprobando la cuenta de GitHub…");
    try {
      const login = await invoke<string>("verify_github_owner");
      setCreatorAccess("granted");
      setCreatorMessage(`Acceso verificado como ${login}.`);
    } catch (error) {
      setCreatorAccess("locked");
      setCreatorMessage(error instanceof Error ? error.message : String(error));
    }
  }, []);

  const startCreatorLogin = async () => {
    try {
      const message = await invoke<string>("start_github_login");
      setCreatorAccess("locked");
      setCreatorMessage(message);
    } catch (error) {
      setCreatorAccess("locked");
      setCreatorMessage(error instanceof Error ? error.message : String(error));
    }
  };

  useEffect(() => {
    void checkCreatorAccess();
  }, [checkCreatorAccess]);

  useEffect(() => {
    if (IS_ANDROID || (!isTauri() && !import.meta.env.DEV)) return;
    const openOwnerEntry = (event: KeyboardEvent) => {
      if (!event.repeat && event.ctrlKey && event.altKey && event.shiftKey && event.code === "KeyO") {
        event.preventDefault();
        setOwnerEntryRequested(true);
        setTab("settings");
        void checkCreatorAccess();
      }
    };
    window.addEventListener("keydown", openOwnerEntry);
    return () => window.removeEventListener("keydown", openOwnerEntry);
  }, [checkCreatorAccess]);

  useEffect(() => {
    if (tab !== "shiny" || shinyCatalogModule) return;
    let cancelled = false;
    setShinyCatalogError("");
    void import("./shinyModsCatalog")
      .then((catalogModule) => {
        if (cancelled) return;
        setShinyCatalogModule(catalogModule);
        const initial = catalogModule.SHINY_MOD_CATALOG.find((item) => item.englishName === "Rush Hour <Downstar>" && !item.isCatalogShiny) ?? catalogModule.SHINY_MOD_CATALOG[0];
        if (initial) setSelectedShinyModId((current) => current || initial.id);
      })
      .catch(() => {
        if (!cancelled) setShinyCatalogError("No se pudo cargar el catálogo local de módulos.");
      });
    return () => { cancelled = true; };
  }, [shinyCatalogAttempt, shinyCatalogModule, tab]);

  useEffect(() => {
    if (personalRestoreReady) saveState(state);
  }, [personalRestoreReady, state]);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    void invoke<string | null>("load_native_personal_backup")
      .then((backupText) => {
        if (!active || !backupText) return;
        const backup = JSON.parse(backupText) as unknown;
        setState((current) => {
          const recovered = recoverPersonalBackup(current, backup);
          const recoveredJson = JSON.stringify(personalSyncPayload(recovered));
          if (recoveredJson === JSON.stringify(personalSyncPayload(current))) return current;
          const updatedAt = new Date().toISOString();
          personalSyncJsonRef.current = recoveredJson;
          personalSyncUpdatedAtRef.current = updatedAt;
          savePersonalSyncUpdatedAt(updatedAt);
          return recovered;
        });
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setNativeBackupReady(true);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isTauri() || !nativeBackupReady || personalHistoryCount(JSON.parse(personalSyncJson)) === 0) return;
    if (!IS_ANDROID) void invoke("cache_desktop_progress", { dataJson: personalSyncJson }).catch(() => undefined);
    const timer = window.setTimeout(() => {
      if (closeInFlightRef.current) return;
      void invoke("save_native_personal_backup", { dataJson: personalSyncJson }).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [nativeBackupReady, personalSyncJson]);

  useEffect(() => {
    if (!IS_WEB) return;
    let active = true;
    void Promise.all([loadWebPersonalBackup(), readWebStorageStatus()])
      .then(([backupText, status]) => {
        if (!active) return;
        setWebStorageStatus(status);
        if (!backupText) return;
        const backup = JSON.parse(backupText) as unknown;
        setState((current) => {
          const recovered = recoverPersonalBackup(current, backup);
          if (JSON.stringify(personalSyncPayload(recovered)) === JSON.stringify(personalSyncPayload(current))) return current;
          personalSyncJsonRef.current = JSON.stringify(personalSyncPayload(recovered));
          const updatedAt = new Date().toISOString();
          personalSyncUpdatedAtRef.current = updatedAt;
          savePersonalSyncUpdatedAt(updatedAt);
          return recovered;
        });
      })
      .catch(() => undefined)
      .finally(() => { if (active) setWebBackupReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!IS_WEB || !webBackupReady || personalHistoryCount(JSON.parse(personalSyncJson)) === 0) return;
    const timer = window.setTimeout(() => void saveWebPersonalBackup(personalSyncJson).catch(() => undefined), 300);
    return () => window.clearTimeout(timer);
  }, [personalSyncJson, webBackupReady]);

  useEffect(() => {
    const receiveOverlayChange = () => setState((current) => ({ ...current, settings: { ...current.settings, overlayEnabled: false } }));
    const receiveStorageChange = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const incoming = loadState();
      setState((current) => {
        const merged = { ...incoming, ...personalSyncPayload(mergePersonalSyncPayload(current, personalSyncPayload(incoming), true)) };
        return JSON.stringify(merged) === JSON.stringify(current) ? current : merged;
      });
    };
    window.addEventListener("storage", receiveStorageChange);
    let stopListening: (() => void) | undefined;
    if (isTauri() && !IS_ANDROID) void listen("caja-fantasma-overlay-disabled", receiveOverlayChange).then((stop) => { stopListening = stop; });
    return () => {
      window.removeEventListener("storage", receiveStorageChange);
      stopListening?.();
    };
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    const tick = () => {
      if (stopped) return;
      const timestamp = Date.now();
      setNow(timestamp);
      setState((current) => normalizeCycleState(current, timestamp));
      timer = window.setTimeout(tick, document.visibilityState === "visible" ? 1_000 : 5_000);
    };
    timer = window.setTimeout(tick, 1_000);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (creatorAccess !== "granted" && tab === "changes") setTab("progress");
  }, [creatorAccess, tab]);

  useEffect(() => {
    if (tab !== "progress" && homeOverlayConfigOpen) setHomeOverlayEditing(false);
  }, [homeOverlayConfigOpen, setHomeOverlayEditing, tab]);

  useEffect(() => () => {
    if (isTauri() && !IS_ANDROID) void emit("caja-fantasma-overlay-edit-mode", { enabled: false });
  }, []);

  useEffect(() => {
    void showOverlay(state.settings.overlayEnabled);
  }, [state.settings.overlayEnabled]);

  useEffect(() => {
    if (!personalRestoreReady || cycle.phase !== "active" || state.settings.lastPointRoundEventStartedAt === cyclePhaseStartedAt) return;
    commitState((current) => {
      if (current.settings.lastPointRoundEventStartedAt === cyclePhaseStartedAt) return current;
      const archived = archivePointRounds(current, "event-start", cyclePhaseStartedAt, selectedVision);
      return { ...archived, settings: { ...archived.settings, lastPointRoundEventStartedAt: cyclePhaseStartedAt } };
    });
  }, [commitState, cycle.phase, cyclePhaseStartedAt, personalRestoreReady, selectedVision, state.settings.lastPointRoundEventStartedAt]);

  useEffect(() => {
    if (!personalRestoreReady || cycle.phase !== "waiting" || selectedVision?.id !== "gravity" || state.settings.lastWhalePointRoundWaitStartedAt === cyclePhaseStartedAt) return;
    const saveAtMs = Date.parse(cyclePhaseStartedAt) + 6 * 60_000;
    if (now < saveAtMs) return;
    const saveAt = new Date(saveAtMs).toISOString();
    commitState((current) => {
      if (current.settings.lastWhalePointRoundWaitStartedAt === cyclePhaseStartedAt) return current;
      const archived = archivePointRounds(current, "whale-end", saveAt, selectedVision);
      return { ...archived, settings: { ...archived.settings, lastWhalePointRoundWaitStartedAt: cyclePhaseStartedAt } };
    });
  }, [commitState, cycle.phase, cyclePhaseStartedAt, now, personalRestoreReady, selectedVision, state.settings.lastWhalePointRoundWaitStartedAt]);

  useEffect(() => {
    const leadMinutes = clampNumber(state.settings.voiceLeadMinutes, 1, 60);
    const phaseKey = state.settings.phaseStartedAt;
    if (cycle.phase !== "waiting" || selectedVision?.id !== "gravity" || !state.settings.voiceNotificationsEnabled) return;
    if (cycle.remainingMs > leadMinutes * 60_000 || state.settings.lastVoiceAlertPhaseStartedAt === phaseKey || voiceAlertRef.current === phaseKey) return;

    voiceAlertRef.current = phaseKey;
    const remainingMinutes = Math.max(1, Math.ceil(cycle.remainingMs / 60_000));
    const message = `Atención. La Rueda Visional de Gravedad comienza en ${remainingMinutes} ${remainingMinutes === 1 ? "minuto" : "minutos"}.`;
    speakMessage(message);
    commitState((current) => ({
      ...current,
      settings: { ...current.settings, lastVoiceAlertPhaseStartedAt: phaseKey },
    }));

  }, [commitState, cycle.phase, cycle.remainingMs, selectedVision?.id, state.settings.lastVoiceAlertPhaseStartedAt, state.settings.phaseStartedAt, state.settings.voiceLeadMinutes, state.settings.voiceNotificationsEnabled]);

  const syncCatalog = useCallback(async (silent = false) => {
    if (!silent) setSyncStatus(tx("Buscando catálogo público…", "Checking the public catalog…"));
    try {
      const catalog = await fetchPublicCatalog();
      if (!validateCatalog(catalog)) throw new Error(tx("formato no válido", "invalid format"));
      setState((current) => applyRemoteCatalog(current, catalog));
      setSyncStatus(tx(
        `Catálogo v${catalog.catalogVersion} comprobado · ${catalog.eventTiming?.waitMinutes ?? "—"}/${catalog.eventTiming?.activeMinutes ?? "—"} min · ${resolveTransitionDelayMilliseconds(catalog.eventTiming)} ms`,
        `Catalog v${catalog.catalogVersion} checked · ${catalog.eventTiming?.waitMinutes ?? "—"}/${catalog.eventTiming?.activeMinutes ?? "—"} min · ${resolveTransitionDelayMilliseconds(catalog.eventTiming)} ms`,
      ));
    } catch (error) {
      setSyncStatus(tx("Sin conexión · usando catálogo local", "Offline · using local catalog"));
      if (!silent) console.info("No se pudo sincronizar el catálogo", error);
    }
  }, [tx]);

  useEffect(() => {
    void syncCatalog(true);
    const timer = window.setInterval(() => {
      void syncCatalog(true);
    }, 30_000);
    const refresh = () => void syncCatalog(true);
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [syncCatalog]);

  useEffect(() => {
    if (!isTauri() || IS_ANDROID) return;
    void isEnabled().then((enabled) => {
      if (state.settings.autoStartEnabled && !enabled) void enable().catch(() => undefined);
      if (!state.settings.autoStartEnabled && enabled) void disable().catch(() => undefined);
    });
  }, [state.settings.autoStartEnabled]);

  const addActivity = (activity: Activity, vision?: Vision) => {
    if (!activity.enabled || activity.points <= 0 || (vision && !vision.enabled)) return;
    if (isTeamMode && !teamReady) {
      setToast("Selecciona al menos dos personajes para registrar en Equipo");
      window.setTimeout(() => setToast(""), 2600);
      return;
    }
    const action: PointAction = {
      id: createId("claim"),
      activityId: activity.id,
      activityName: activity.name,
      visionId: vision?.id,
      visionName: vision?.name,
      points: activity.points,
      occurredAt: new Date().toISOString(),
      characterIds: isTeamMode ? [...state.teamMemberIds] : [activeCharacter.id],
      trackingMode: isTeamMode ? "team" : "solo",
      teamSessionId: isTeamMode ? state.activeTeamSessionId : undefined,
    };
    const historyRecord: ActivityHistoryRecord = {
      id: action.id,
      activityId: action.activityId,
      activityName: action.activityName,
      visionId: action.visionId,
      visionName: action.visionName,
      points: action.points,
      count: 1,
      occurredAt: action.occurredAt,
    };
    commitState((current) => ({ ...current, actions: [...current.actions, action], activityHistory: [...current.activityHistory, historyRecord].slice(-100_000) }));
    setToast(isTeamMode ? `+${activity.points} para ${state.teamMemberIds.length} personajes · ${activity.name}` : `+${activity.points} · ${activity.name}`);
    window.setTimeout(() => setToast(""), 1800);
  };

  const removeActionFromCurrentTracking = (actionId: string) => {
    commitState((current) => {
      const actions = isTeamMode
        ? current.actions.filter((action) => action.id !== actionId)
        : detachCharacterFromActions(current.actions, activeCharacter.id, new Set([actionId]));
      const removedGlobally = !actions.some((action) => action.id === actionId);
      const activityHistory = removedGlobally ? current.activityHistory.filter((record) => record.id !== actionId) : current.activityHistory;
      const deletedActionIds = removedGlobally
        ? [...current.deletedActionIds.filter((id) => id !== actionId), actionId].slice(-20_000)
        : current.deletedActionIds;
      return { ...current, actions, deletedActionIds, activityHistory };
    });
  };

  const removeLastActivity = (activityId: string, visionId?: string) => {
    const action = [...currentActions].reverse().find((item) => `${item.visionId ?? "pro"}:${item.activityId}` === `${visionId ?? "pro"}:${activityId}`);
    if (action) removeActionFromCurrentTracking(action.id);
  };

  const undoLastAction = () => {
    const action = currentActions.at(-1);
    if (action) removeActionFromCurrentTracking(action.id);
  };

  const saveCurrentPointRound = () => {
    if (currentPointRoundActions.length === 0) return;
    const endedAt = new Date().toISOString();
    commitState((current) => archivePointRounds(current, "manual", endedAt, selectedVision, currentPointRoundKey));
    setToast(`Ronda guardada con ${currentPointRoundPoints} ${currentPointRoundPoints === 1 ? "punto" : "puntos"}; el conteo parcial vuelve a 0`);
    window.setTimeout(() => setToast(""), 2800);
  };

  const markBox = (source: "normal" | "platform-mail" = "normal") => {
    if (isTeamMode) {
      setToast("Cambia a Solitario para indicar a qué personaje le salió la caja");
      window.setTimeout(() => setToast(""), 2800);
      return;
    }
    if (activeCharacterActions.length === 0) return;
    const split = source === "platform-mail" ? splitPlatformCarryover(activeCharacterActions) : { completedAttempt: activeCharacterActions, carryOver: [] as PointAction[] };
    if (split.completedAttempt.length === 0) {
      setToast("Todavía no hay recompensas con una hora de antigüedad para cerrar esta caja");
      window.setTimeout(() => setToast(""), 3200);
      return;
    }
    const recordedPoints = split.completedAttempt.reduce((sum, action) => sum + action.points, 0);
    const carriedPoints = split.carryOver.reduce((sum, action) => sum + action.points, 0);
    const record = {
      id: createId("box"),
      occurredAt: new Date().toISOString(),
      points: recordedPoints,
      claims: split.completedAttempt.length,
      source,
      carriedPoints,
      characterId: activeCharacter.id,
      characterName: activeCharacter.name,
      actionIds: split.completedAttempt.map((action) => action.id),
      breakdown: buildBreakdown(split.completedAttempt),
    };
    const completedIds = new Set(split.completedAttempt.map((action) => action.id));
    commitState((current) => ({ ...current, actions: detachCharacterFromActions(current.actions, activeCharacter.id, completedIds), boxes: [record, ...current.boxes] }));
    setToast(source === "platform-mail" ? `Caja de ${activeCharacter.name} registrada; ${carriedPoints} puntos pasan al nuevo intento` : `Caja de ${activeCharacter.name} registrada con ${recordedPoints} puntos`);
    window.setTimeout(() => setToast(""), 2400);
  };

  const resetAttempt = () => {
    if (currentActions.length === 0) return;
    if (isTeamMode) {
      commitState((current) => ({
        ...current,
        actions: current.actions.filter((action) => !(action.trackingMode === "team" && action.teamSessionId === current.activeTeamSessionId && actionCharacterIds(action).length === 0)),
        activeTeamSessionId: createId("team"),
      }));
      return;
    }
    commitState((current) => ({ ...current, actions: detachCharacterFromActions(current.actions, activeCharacter.id) }));
  };

  const setTrackingMode = (mode: "solo" | "team") => {
    if (mode === "team" && state.characters.length < 2) return;
    commitState((current) => ({ ...current, trackingMode: mode }));
  };

  const selectCharacter = (characterId: string) => {
    commitState((current) => ({ ...current, activeCharacterId: characterId, trackingMode: "solo" }));
  };

  const toggleTeamMember = (characterId: string) => {
    commitState((current) => ({
      ...current,
      teamMemberIds: current.teamMemberIds.includes(characterId)
        ? current.teamMemberIds.filter((id) => id !== characterId)
        : [...current.teamMemberIds, characterId],
    }));
  };

  const startNewTeamCount = () => {
    commitState((current) => ({
      ...current,
      actions: current.actions.filter((action) => !(action.trackingMode === "team" && action.teamSessionId === current.activeTeamSessionId && actionCharacterIds(action).length === 0)),
      activeTeamSessionId: createId("team"),
      trackingMode: "team",
    }));
    setToast("Nuevo conteo de Equipo iniciado en 0; los puntos personales se conservan");
    window.setTimeout(() => setToast(""), 3000);
  };

  const addCharacter = () => {
    const name = newCharacterName.trim().slice(0, 40);
    if (!name || state.characters.length >= 12) {
      setToast(state.characters.length >= 12 ? "Puedes registrar hasta 12 personajes" : "Escribe el nombre del personaje");
      window.setTimeout(() => setToast(""), 2400);
      return;
    }
    const character: CharacterProfile = { id: createId("character"), name, createdAt: new Date().toISOString() };
    commitState((current) => ({ ...current, characters: [...current.characters, character], teamMemberIds: [...current.teamMemberIds, character.id] }));
    setNewCharacterName("");
    setToast(`${name} agregado`);
    window.setTimeout(() => setToast(""), 1800);
  };

  const renameCharacter = (characterId: string, name: string) => {
    const cleanName = name.trim().slice(0, 40);
    if (!cleanName) return;
    commitState((current) => ({
      ...current,
      characters: current.characters.map((character) => character.id === characterId ? { ...character, name: cleanName } : character),
      boxes: current.boxes.map((box) => box.characterId === characterId ? { ...box, characterName: cleanName.trim() || box.characterName } : box),
    }));
  };

  const removeCharacter = (characterId: string) => {
    const character = state.characters.find((item) => item.id === characterId);
    if (!character || state.characters.length <= 1 || !window.confirm(`¿Eliminar a ${character.name}? Su historial de cajas se conservará, pero se quitará su intento actual.`)) return;
    commitState((current) => {
      const characters = current.characters.filter((item) => item.id !== characterId);
      return {
        ...current,
        characters,
        actions: detachCharacterFromActions(current.actions, characterId),
        activeCharacterId: current.activeCharacterId === characterId ? characters[0].id : current.activeCharacterId,
        teamMemberIds: current.teamMemberIds.filter((id) => id !== characterId),
        trackingMode: characters.length > 1 ? current.trackingMode : "solo",
      };
    });
  };

  const setCyclePhase = (phase: "waiting" | "active") => {
    commitState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        phase,
        phaseStartedAt: new Date().toISOString(),
      },
    }));
    setNow(Date.now());
  };

  const synchronizeCountdown = () => {
    const minutes = Math.max(0, Math.floor(Number(counterMinutes) || 0));
    const seconds = clampNumber(Math.floor(Number(counterSeconds) || 0), 0, 59);
    const durationMinutes = counterPhase === "active" ? state.settings.activeMinutes : state.settings.waitMinutes;
    const durationMs = durationMinutes * 60_000;
    const requestedMs = (minutes * 60 + seconds) * 1000;
    if (requestedMs < 1000 || requestedMs > durationMs) {
      setToast(`El tiempo debe estar entre 00:01 y ${formatDuration(durationMs)}`);
      window.setTimeout(() => setToast(""), 3000);
      return;
    }
    const timestamp = Date.now();
    const phaseStartedAt = new Date(timestamp - (durationMs - requestedMs)).toISOString();
    commitState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        phase: counterPhase,
        phaseStartedAt,
        lastVoiceAlertPhaseStartedAt: undefined,
      },
    }));
    setCounterMinutes(String(minutes));
    setCounterSeconds(String(seconds));
    setNow(timestamp);
    setToast(counterPhase === "waiting" ? "Contador ajustado: falta para empezar" : "Contador ajustado: falta para terminar");
    window.setTimeout(() => setToast(""), 2400);
  };

  const loadCurrentCountdown = () => {
    const remainingSeconds = Math.ceil(cycle.remainingMs / 1000);
    setCounterPhase(cycle.phase);
    setCounterMinutes(String(Math.floor(remainingSeconds / 60)));
    setCounterSeconds(String(remainingSeconds % 60));
  };

  const addManualHistory = () => {
    const available = Math.max(0, 500 - state.manualBaselinePoints.length);
    const values = parseManualBaseline(manualHistoryText, available);
    if (values.length === 0) {
      setToast(available === 0 ? "Alcanzaste el máximo de 500 valores aproximados" : "Escribe al menos un valor válido entre 1 y 10.000");
      window.setTimeout(() => setToast(""), 3000);
      return;
    }
    commitState((current) => ({ ...current, manualBaselinePoints: [...current.manualBaselinePoints, ...values] }));
    setManualHistoryText("");
    setToast(`${values.length} ${values.length === 1 ? "valor aproximado agregado" : "valores aproximados agregados"}`);
    window.setTimeout(() => setToast(""), 2400);
  };

  const chooseShinyMod = (item: ShinyModCatalogItem) => {
    setSelectedShinyModId(item.id);
  };

  const addShinyTracker = (customName?: string) => {
    if (!selectedShinyMod) {
      setToast("El catálogo de módulos todavía se está cargando");
      window.setTimeout(() => setToast(""), 2200);
      return;
    }
    const custom = customName?.trim();
    const modName = custom || selectedShinyMod.baseName;
    const catalogId = custom ? undefined : selectedShinyMod.id;
    const groupName = custom ? "Módulo personalizado" : `${selectedShinyMod.groupName} · ${catalogStatusLabel(selectedShinyMod)}`;
    const englishName = custom ? undefined : selectedShinyMod.baseEnglishName;
    const variant = custom ? "Personalizado" : selectedShinyMod.variant;
    const duplicate = state.shinyMods.some((item) => (catalogId ? item.catalogId === catalogId : normalizeModSearch(item.modName) === normalizeModSearch(modName)) && normalizeModSearch(item.variant) === normalizeModSearch(variant));
    if (duplicate) {
      setToast("Ese módulo y variante ya están en tu seguimiento");
      window.setTimeout(() => setToast(""), 2600);
      return;
    }
    const record: ShinyModRecord = {
      id: createId("shiny"),
      catalogId,
      modName,
      englishName,
      groupName,
      variant,
      attempts: 0,
      isShiny: false,
      createdAt: new Date().toISOString(),
    };
    commitState((current) => ({ ...current, shinyMods: [record, ...current.shinyMods] }));
    setToast(`${modName} agregado con 0 intentos`);
    window.setTimeout(() => setToast(""), 2200);
  };

  const updateShinyRecord = (id: string, update: (record: ShinyModRecord) => ShinyModRecord) => {
    commitState((current) => ({ ...current, shinyMods: current.shinyMods.map((record) => record.id === id ? update(record) : record) }));
  };

  const adjustShinyAttempts = (id: string, amount: number) => {
    updateShinyRecord(id, (record) => ({ ...record, attempts: clampNumber(record.attempts + amount, 0, 100_000) }));
  };

  const setShinyObtained = (id: string, obtained: boolean) => {
    updateShinyRecord(id, (record) => ({ ...record, isShiny: obtained, obtainedAt: obtained ? new Date().toISOString() : undefined }));
    setToast(obtained ? "Módulo marcado como Brillante" : "Módulo devuelto a la lista de búsqueda");
    window.setTimeout(() => setToast(""), 2200);
  };

  const saveCatalog = useCallback((catalog: Catalog) => {
    const timing = catalog.eventTiming;
    commitState((current) => ({
      ...current,
      catalog,
      settings: {
        ...current.settings,
        selectedVisionId: sharedVisionId(catalog, current.settings.selectedVisionId),
        ...(timing ? {
          waitMinutes: timing.waitMinutes,
          activeMinutes: timing.activeMinutes,
          transitionDelayMilliseconds: resolveTransitionDelayMilliseconds(timing, current.settings.transitionDelayMilliseconds),
          phaseStartedAt: timing.phaseStartedAt,
          phase: timing.phase,
          sharedTimingUpdatedAt: timing.updatedAt,
          lastVoiceAlertPhaseStartedAt: undefined,
        } : {}),
      },
    }));
    setSyncStatus(`Configuración general v${catalog.catalogVersion} publicada`);
  }, [commitState]);

  const publishCatalog = useCallback(async (catalog: Catalog) => {
    if (!isTauri() || IS_ANDROID) throw new Error("La publicación solo está disponible en la aplicación de escritorio del propietario.");
    const message = await invoke<string>("publish_catalog", { catalogJson: JSON.stringify(catalog, null, 2) });
    setSyncStatus(message);
    return message;
  }, []);

  const buildCountdownSettings = (): { settings: Settings; timestamp: number } | undefined => {
    const minutes = Math.max(0, Math.floor(Number(counterMinutes) || 0));
    const seconds = clampNumber(Math.floor(Number(counterSeconds) || 0), 0, 59);
    const durationMinutes = counterPhase === "active" ? state.settings.activeMinutes : state.settings.waitMinutes;
    const durationMs = durationMinutes * 60_000;
    const requestedMs = (minutes * 60 + seconds) * 1000;
    if (requestedMs < 1000 || requestedMs > durationMs) {
      setToast(`El tiempo debe estar entre 00:01 y ${formatDuration(durationMs)}`);
      window.setTimeout(() => setToast(""), 3000);
      return undefined;
    }
    const timestamp = Date.now();
    return {
      timestamp,
      settings: {
        ...state.settings,
        phase: counterPhase,
        phaseStartedAt: new Date(timestamp - (durationMs - requestedMs)).toISOString(),
        lastVoiceAlertPhaseStartedAt: undefined,
      },
    };
  };

  const publishSharedCountdown = async () => {
    if (creatorAccess !== "granted") {
      setToast("Solo la cuenta propietaria puede sincronizar el contador para todos");
      window.setTimeout(() => setToast(""), 3000);
      return;
    }
    const synchronized = buildCountdownSettings();
    if (!synchronized) return;
    const updatedAt = new Date(synchronized.timestamp).toISOString();
    const sharedSettings = { ...synchronized.settings, sharedTimingUpdatedAt: updatedAt };
    const catalog: Catalog = {
      ...state.catalog,
      catalogVersion: state.catalog.catalogVersion + 1,
      updatedAt,
      updatedBy: AUTHOR,
      eventTiming: sharedEventTimingFromSettings(sharedSettings, updatedAt, AUTHOR),
    };
    try {
      setToast("Publicando fase, tiempos y transición para todos…");
      const message = await publishCatalog(catalog);
      commitState((current) => ({ ...current, catalog, settings: sharedSettings }));
      setNow(synchronized.timestamp);
      setToast(message);
    } catch (error) {
      setToast(error instanceof Error ? error.message : String(error));
    }
    window.setTimeout(() => setToast(""), 3600);
  };

  const toggleAutostart = async (enabled: boolean) => {
    if (!isTauri() || IS_ANDROID) return;
    if (enabled) await enable();
    else await disable();
  };

  const openExternalAddress = async (url: string) => {
    try {
      if (isTauri()) {
        await openUrl(url);
      } else {
        // A noopener popup can return null even when it opened successfully.
        // Use a normal external link without navigating away from the tracker.
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.click();
      }
      return true;
    } catch (error) {
      setToast(tx(`No se pudo abrir el enlace: ${error instanceof Error ? error.message : String(error)}`, `Could not open the link: ${error instanceof Error ? error.message : String(error)}`));
      window.setTimeout(() => setToast(""), 4_000);
      return false;
    }
  };

  const openRepository = () => void openExternalAddress(REPOSITORY_URL);

  const openCreatorProfile = () => void openExternalAddress(AUTHOR_PROFILE_URL);

  const openAndroidDownload = () => void openExternalAddress(ANDROID_APK_URL);

  const openWindowsDownload = () => void openExternalAddress(WINDOWS_DOWNLOAD_URL);

  const openWebApp = () => {
    void openExternalAddress(WEB_APP_URL).then((opened) => {
      if (!opened || !isTauri() || IS_ANDROID) return;
      setToast(tx("Página abierta en tu navegador", "Web app opened in your browser"));
      window.setTimeout(() => setToast(""), 2_400);
      window.setTimeout(() => void getCurrentWindow().minimize().catch(() => undefined), 180);
    });
  };

  const onImport = async (file?: File) => {
    if (!file) return;
    try {
      commitState(importState(await file.text()));
      setToast("Respaldo importado correctamente");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "No se pudo importar el respaldo.");
    } finally {
      if (importRef.current) importRef.current.value = "";
      window.setTimeout(() => setToast(""), 3000);
    }
  };

  return (
    <div className="app-shell" data-event={cycle.phase === "active" ? visionVisualTheme(selectedVision) : "neutral"}>
      <AppUpdater language={language} beforeInstall={async () => {
        if (!IS_ANDROID && isTauri()) {
          if (!restoreReadyRef.current) throw new Error("El respaldo inicial todavía se está recuperando. Intenta actualizar de nuevo.");
          const saved = await persistDesktopProgress(currentStateRef.current, invoke, false);
          currentStateRef.current = saved;
          setState(saved);
        }
      }} />
      {closeBusy && <div className="progress-saving" role="status" aria-live="polite"><Save size={25} /><strong>{tx("Guardando tu progreso…", "Saving your progress…")}</strong><span>{tx("Preparando un cierre seguro", "Preparing a safe close")}</span></div>}
      {introVisible && <StartupIntro language={language} onSkip={() => setIntroVisible(false)} />}
      {tutorialOpen && !introVisible && <AppTutorial language={language} onClose={finishTutorial} onVisit={targetTab => { setTab(targetTab); finishTutorial(); }} />}
      {toast && <div className="toast" role="status"><Check size={17} />{toast}</div>}

      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><GameLogoMark /></div>
          <div><strong>Auralis Caja Fantasma</strong><span>Once Human · v{APP_VERSION}</span></div>
        </div>

        <nav aria-label={tx("Navegación principal", "Main navigation")}>
          {visibleTabs.map(({ id, es, en }) => (
            <button key={id} type="button" className={tab === id ? "active" : ""} aria-label={tx(es, en)} title={tx(es, en)} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
              <span className="nav-symbol"><ConsoleGlyph section={id} /></span><span>{tx(es, en)}</span>{tab === id && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <span className={syncStatus.startsWith("Sin") ? "offline" : "online"}>
            {syncStatus.startsWith("Sin") ? <WifiOff size={14} /> : <Wifi size={14} />}
            {syncStatus}
          </span>
          <button type="button" onClick={() => void syncCatalog()}><RefreshCw size={14} /> {tx("Sincronizar", "Sync")}</button>
        </div>

        {!IS_WEB && !IS_ANDROID && isTauri() && <button type="button" className="save-exit-button" disabled={closeBusy} onClick={() => void saveAndClose(true)} title={tx("Guarda todo y cierra el programa", "Save everything and quit the app")}><LogOut size={18} /><span>{tx("Guardar y salir", "Save and exit")}</span></button>}
        <button type="button" className="author-card" onClick={openRepository}>
          <Github size={21} />
          <span><small>{tx("Creado por", "Created by")}</small><strong>{AUTHOR}</strong></span>
          <ExternalLink size={14} />
        </button>
      </aside>

      <main>
        <header className={`topbar vision-${selectedVision?.id ?? "none"} ${cycle.phase}`}>
          <VisionAtmosphere visionId={selectedVision?.id} active={cycle.phase === "active"} />
          <div className="topbar-copy">
            <span className="eyebrow">{tab === "progress" ? tx("SEGUIMIENTO ACTUAL", "CURRENT TRACKING") : tab === "characters" ? tx("PERFILES DE JUEGO", "GAME PROFILES") : tab === "vision" ? tx("RUEDA VISIONAL", "VISIONAL WHEEL") : tab === "devices" ? tx("PC, WEB Y MÓVIL", "PC, WEB AND MOBILE") : tab === "history" ? tx("REGISTRO PERSONAL", "PERSONAL RECORD") : tab === "shiny" ? tx("COLECCIÓN DE MÓDULOS", "MOD COLLECTION") : tab === "changes" ? tx("NOVEDADES", "WHAT'S NEW") : tx("PREFERENCIAS", "PREFERENCES")}</span>
            <h1><ConsoleGlyph section={tab} size={30} />{(() => { const item = TABS.find((entry) => entry.id === tab); return item ? tx(item.es, item.en) : ""; })()}</h1>
            <div className="topbar-meta">
              <button type="button" className="creator-credit" onClick={openCreatorProfile}><Github size={12} aria-hidden="true" /><span>{tx("Creado por", "Created by")}</span><strong>{AUTHOR}</strong><ExternalLink size={10} aria-hidden="true" /></button>
              <DevicePresence online={onlineDevices} current={currentDevice} english={language !== "es"} />
            </div>
          </div>
          <div className="topbar-actions">
            <div className={`phase-chip counter-${state.settings.overlayCounterStyle} ${cycle.phase} ${transition.active ? "transitioning" : ""}`} style={{ "--card-progress": `${Math.round(cycle.progress * 360)}deg` } as import("react").CSSProperties}>
              <span className="pulse" />
              <div><small>{transition.active ? tx("Preparando próximo contador", "Preparing next countdown") : cycle.phase === "active" ? `${overlayDisplayName} ${tx("activa", "active")}` : `${tx("Próxima", "Next")} ${overlayDisplayName}`}</small><strong>{overlayDisplayTimer}</strong></div>
            </div>
            <div className={`phase-chip whale-phase-chip counter-${state.settings.overlayWhaleCounterStyle} ${whale.visible && !whale.departing ? "active" : "waiting"}`} style={{ "--card-progress": `${Math.round((1 - whale.progress) * 360)}deg` } as import("react").CSSProperties}>
              <Zap size={15} />
              <div><small>{!whaleAvailable ? tx("Ballena · sin evento", "Whale · no event") : whale.departing ? tx("Ballena retirándose", "Whale departing") : whale.visible ? tx("Ballena · termina en", "Whale · ends in") : tx("Próxima ballena", "Next whale")}</small>{whaleAvailable && whale.visible && (state.settings.overlayWhaleCounterStyle === "beam" || !state.settings.overlayWhaleShowTime) ? <span className="whale-chip-beam" role="progressbar" aria-label={tx("Tiempo restante de Ballena", "Whale remaining time")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((1 - whale.progress) * 100)}><i style={{ width: `${(1 - whale.progress) * 100}%` }} /></span> : <strong>{whaleAvailable ? state.settings.overlayWhaleCounterStyle === "compact" ? formatCompactDuration(whale.visible ? whale.remainingMs : whaleNextMs) : formatDuration(whale.visible ? whale.remainingMs : whaleNextMs) : "—"}</strong>}</div>
            </div>
            <label className="topbar-language" aria-label={tx("Idioma de la aplicación", "Application language")}>
              <Languages size={15} aria-hidden="true" />
              <select value={state.settings.uiLanguageMode === "auto" ? "auto" : language} onChange={(event) => { const automatic = event.target.value === "auto"; commitState(current => ({ ...current, settings: { ...current.settings, uiLanguageMode: automatic ? "auto" : "manual", uiLanguage: automatic ? detectUiLanguage() : event.target.value as UiLanguage } })); }}><option value="auto">Auto · {language.toUpperCase()}</option>{UI_LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.short}</option>)}</select>
            </label>
            <button type="button" className="secondary tutorial-open" onClick={() => setTutorialOpen(true)} aria-label={tx("Abrir tutorial", "Open tutorial")}><CircleHelp size={18} /><span>{tx("Tutorial", "Tutorial")}</span></button>
          </div>
        </header>

        {IS_WEB && <WebInstallNotice pwa={pwa} language={language} />}
        {tutorialNotice && !introVisible && <div className="tutorial-welcome"><CircleHelp size={20} /><span>{tx("¿Primera vez? Conoce Auralis Caja Fantasma en seis pasos.", "First time? Learn Auralis Caja Fantasma in six steps.")}</span><button type="button" className="primary compact" onClick={() => setTutorialOpen(true)}>{tx("Ver tutorial", "View tutorial")}</button><button type="button" className="experience-close" aria-label={tx("Ocultar aviso", "Hide notice")} onClick={finishTutorial}><X size={16} /></button></div>}

        {tab === "progress" && (
          <section className="page progress-page">
            {state.characters.length > 1 && <article className="character-dashboard panel">
              <div className="character-dashboard-top">
                <div><span className="eyebrow"><Users size={15} /> {tx("PERSONAJES", "CHARACTERS")}</span><h2>{isTeamMode ? tx("Registro compartido del equipo", "Shared team tracking") : `${tx("Jugando con", "Playing as")} ${activeCharacter.name}`}</h2></div>
                <div className="tracking-mode-switch" aria-label={tx("Modo de registro", "Tracking mode")}>
                  <button type="button" className={!isTeamMode ? "selected" : ""} onClick={() => setTrackingMode("solo")}><UserRound size={16} /> {tx("Solitario", "Solo")}</button>
                  <button type="button" className={isTeamMode ? "selected team" : ""} onClick={() => setTrackingMode("team")}><Users size={16} /> {tx("Equipo", "Team")}</button>
                </div>
              </div>
              <div className="character-progress-list">
                {characterSummaries.map((summary) => {
                  const selected = isTeamMode ? state.teamMemberIds.includes(summary.character.id) : summary.character.id === activeCharacter.id;
                  return <button type="button" key={summary.character.id} className={selected ? "selected" : ""} onClick={() => isTeamMode ? toggleTeamMember(summary.character.id) : selectCharacter(summary.character.id)}>
                    <span className="character-avatar"><UserRound size={17} /></span>
                    <span className="character-progress-copy"><strong>{summary.character.name}</strong><small>{summary.points} {tx("puntos", "points")} · {summary.chance.toFixed(1)}% {tx("estimado", "estimated")}</small><span className="character-progress-track"><i style={{ width: `${Math.min(100, Math.round((summary.points / target) * 100))}%` }} /></span></span>
                    {isTeamMode && <span className={`team-member-check ${selected ? "selected" : ""}`}>{selected ? <Check size={14} /> : <Plus size={14} />}</span>}
                  </button>;
                })}
              </div>
              {isTeamMode && <div className={`team-guidance ${teamReady ? "ready" : "warning"}`}><Users size={17} /><span><strong>{state.teamMemberIds.length} {tx("personajes en este equipo.", "characters on this team.")}</strong>{teamReady ? tx(" Cada recompensa se suma una vez a todos los seleccionados.", " Each reward is added once to every selected character.") : tx(" Selecciona al menos dos para comenzar.", " Select at least two to begin.")}</span><button type="button" className="secondary compact" onClick={startNewTeamCount}><RotateCcw size={15} /> {tx("Nuevo conteo en 0", "New count at 0")}</button></div>}
            </article>}

            <article className={`home-overlay-controls panel ${homeOverlayConfigOpen ? "expanded" : ""}`}>
              <div><span className="eyebrow"><MonitorUp size={13} /> {tx(IS_WEB || IS_ANDROID ? "CONTADORES" : "VENTANA FLOTANTE", IS_WEB || IS_ANDROID ? "COUNTDOWNS" : "FLOATING OVERLAY")}</span><h2>{tx(IS_WEB || IS_ANDROID ? "Configurar contadores" : "Configurar ventana", IS_WEB || IS_ANDROID ? "Configure countdowns" : "Configure overlay")}</h2></div>
              <div className="home-overlay-actions">
                <button type="button" className="secondary" aria-expanded={homeOverlayConfigOpen} aria-controls="home-overlay-size-panel" onClick={() => setHomeOverlayEditing(!homeOverlayConfigOpen)}><Settings2 size={17} /> {homeOverlayConfigOpen ? tx("Terminar ajuste", "Finish editing") : tx("Abrir configuración", "Open settings")}</button>
                {!IS_WEB && !IS_ANDROID && <button type="button" className={`secondary overlay-home-button ${state.settings.overlayEnabled ? "enabled" : ""}`} onClick={() => commitState((current) => ({ ...current, settings: { ...current.settings, overlayEnabled: !current.settings.overlayEnabled } }))}><Eye size={16} /> {state.settings.overlayEnabled ? tx("Quitar ventana", "Remove overlay") : tx("Agregar ventana", "Add overlay")}</button>}
              </div>
              {homeOverlayConfigOpen && <div id="home-overlay-size-panel" className={`home-overlay-size-panel ${IS_WEB || IS_ANDROID ? "in-app" : ""}`}>
                <div className={`mock-overlay ${cycle.phase} vision-${selectedVision?.id ?? "none"} shape-${state.settings.overlayShape} counter-${state.settings.overlayCounterStyle}`}><span>{transition.active ? tx("Preparando próximo contador", "Preparing next countdown") : cycle.phase === "active" ? `${overlayDisplayName} ${tx("activa", "active")}` : `${tx("Próxima", "Next")} ${overlayDisplayName}`}</span><strong>{overlayDisplayTimer}</strong></div>
                <div className="overlay-style-config">
                  <label>{tx("Forma", "Shape")}<select value={state.settings.overlayShape} onChange={(event) => commitState((current) => ({ ...current, settings: { ...current.settings, overlayShape: event.target.value as OverlayShape } }))}><option value="event">{tx("Automática por evento", "Automatic by event")}</option><option value="rectangle">{tx("Rectangular", "Rectangle")}</option><option value="square">{tx("Cuadrada", "Square")}</option><option value="vertical">{tx("Vertical", "Vertical")}</option><option value="round">{tx("Redonda", "Round")}</option></select></label>
                  <label>{tx("Estilo del contador", "Countdown style")}<select value={state.settings.overlayCounterStyle} onChange={(event) => commitState((current) => ({ ...current, settings: { ...current.settings, overlayCounterStyle: event.target.value as OverlayCounterStyle } }))}><option value="digital">Digital</option><option value="compact">{tx("Compacto", "Compact")}</option><option value="ring">{tx("Anillo de progreso", "Progress ring")}</option></select></label>
                  <label>{tx("Nombre del evento", "Event name")}<select value={state.settings.overlayNameMode} onChange={(event) => commitState((current) => ({ ...current, settings: { ...current.settings, overlayNameMode: event.target.value as OverlayNameMode } }))}><option value="spanish">Español</option><option value="english">English</option><option value="custom">{tx("Personalizado", "Custom")}</option></select></label>
                  {state.settings.overlayNameMode === "custom" && <label>{tx("Tu nombre", "Custom name")}<input maxLength={40} value={state.settings.overlayCustomName} placeholder={tx("Ej. Gravedad azul", "E.g. Blue Gravity")} onChange={(event) => commitState((current) => ({ ...current, settings: { ...current.settings, overlayCustomName: event.target.value.slice(0, 40) } }))} /></label>}
                </div>
                <label className="overlay-size-control"><span>{tx("Ventana", "Overlay")} <strong>{Math.round(state.settings.overlayScale * 100)}%</strong></span><input type="range" min={20} max={150} step={5} value={Math.round(state.settings.overlayScale * 100)} onChange={(event) => commitState((current) => ({ ...current, settings: { ...current.settings, overlayScale: clampNumber(Number(event.target.value) / 100, .2, 1.5) } }))} /></label>
                <label className="overlay-size-control"><span>{tx("Área de Ballena", "Whale area")} <strong>{Math.round(state.settings.overlayAddonScale * 100)}%</strong></span><input type="range" min={20} max={100} step={5} value={Math.round(state.settings.overlayAddonScale * 100)} onChange={(event) => commitState((current) => ({ ...current, settings: { ...current.settings, overlayAddonScale: clampNumber(Number(event.target.value) / 100, .2, 1) } }))} /></label>
                {state.settings.overlayWhaleShowTime && <>{state.settings.overlayWhaleCounterStyle !== "beam" && <label className="overlay-size-control"><span>{tx("Tiempo sobre el rayo", "Time over the beam")} <strong>{Math.round(state.settings.overlayWhaleCounterScale * 100)}%</strong></span><input type="range" min={20} max={150} step={5} value={Math.round(state.settings.overlayWhaleCounterScale * 100)} onChange={(event) => commitState((current) => ({ ...current, settings: { ...current.settings, overlayWhaleCounterScale: clampNumber(Number(event.target.value) / 100, .2, 1.5) } }))} /></label>}
                <label className="overlay-size-control"><span>{tx("Estilo del tiempo", "Time style")}</span><select value={state.settings.overlayWhaleCounterStyle} onChange={(event) => commitState((current) => ({ ...current, settings: { ...current.settings, overlayWhaleCounterStyle: event.target.value as WhaleCounterStyle } }))}><option value="digital">Digital</option><option value="compact">{tx("Compacto", "Compact")}</option><option value="ring">{tx("Anillo", "Ring")}</option><option value="beam">{tx("Solo rayo", "Beam only")}</option></select></label></>}
                <div className="overlay-addon-option"><span><strong>{tx("Mostrar tiempo de Ballena", "Show Whale time")}</strong><small>{tx(IS_WEB || IS_ANDROID ? "Durante la ballena activa puedes ver solo el rayo de progreso." : "Si lo desactivas, permanece solamente el Riftwalker con su rayo de progreso.", IS_WEB || IS_ANDROID ? "While the whale is active, you can show only its progress beam." : "When disabled, only the Riftwalker and its progress beam remain.")}</small></span><button type="button" className={`switch ${state.settings.overlayWhaleShowTime ? "on" : ""}`} aria-label={tx("Mostrar tiempo sobre el rayo de Ballena", "Show time over the Whale beam")} aria-pressed={state.settings.overlayWhaleShowTime} onClick={() => commitState((current) => ({ ...current, settings: { ...current.settings, overlayWhaleShowTime: !current.settings.overlayWhaleShowTime } }))}><span /></button></div>
                <div className="overlay-addon-option"><span><strong>{tx("Ballena y rayo", "Whale and beam")}</strong><small>{tx("Puede ocultarse por completo sin desactivar el contador principal.", "It can be hidden completely without disabling the main countdown.")}</small></span><button type="button" className={`switch ${state.settings.overlayWhaleEnabled ? "on" : ""}`} aria-label={tx("Mostrar Ballena y rayo", "Show Whale and beam")} aria-pressed={state.settings.overlayWhaleEnabled} onClick={() => commitState((current) => ({ ...current, settings: { ...current.settings, overlayWhaleEnabled: !current.settings.overlayWhaleEnabled } }))}><span /></button></div>
              </div>}
            </article>

            <div className="hero-grid">
              <article className="progress-hero panel">
                <div className="hero-copy">
                  <span className="eyebrow"><Sparkles size={14} /> {isTeamMode ? tx("CONTEO DE EQUIPO", "TEAM COUNT") : `${tx("INTENTO", "ATTEMPT")} · ${activeCharacter.name}`}</span>
                  <h2>{currentPoints}<small> / {target} {tx("puntos", "points")}</small></h2>
                  <p>{isTeamMode ? `${currentClaims} ${english ? (currentClaims === 1 ? "shared reward" : "shared rewards") : (currentClaims === 1 ? "recompensa compartida" : "recompensas compartidas")}. ${tx("Se suman al intento individual de cada integrante.", "They are added to every member's individual attempt.")}` : `${currentClaims} ${english ? (currentClaims === 1 ? "claimed reward" : "claimed rewards") : (currentClaims === 1 ? "recompensa reclamada" : "recompensas reclamadas")}. ${tx("La caja puede salir antes: regístrala cuando aparezca.", "The crate may drop early: record it when it appears.")}`}</p>
                  <RewardProgressBar value={currentPoints} target={target} label={tx("Progreso del intento", "Attempt progress")} />
                  <div className="hero-actions">
                    {!isTeamMode && <button type="button" className="primary" disabled={currentActions.length === 0} onClick={() => markBox("normal")}><Box size={19} /> {tx("¡Salió la caja!", "The crate dropped!")}</button>}
                    {!isTeamMode && <button type="button" className="secondary platform-mail-button" disabled={currentActions.length === 0} onClick={() => markBox("platform-mail")}><Mail size={18} /> {tx("Llegó por Plataformas", "Platforms mail arrived")}</button>}
                    {isTeamMode && <button type="button" className="primary" onClick={startNewTeamCount}><Users size={18} /> {tx("Nuevo conteo de Equipo", "New Team count")}</button>}
                    <button type="button" className="secondary" disabled={currentActions.length === 0} onClick={undoLastAction}><Undo2 size={18} /> {tx("Deshacer último", "Undo last")}</button>
                    <button type="button" className="secondary" disabled={currentPointRoundActions.length === 0} onClick={saveCurrentPointRound}><Save size={18} /> {tx("Guardar ronda", "Save round")}</button>
                  </div>
                </div>
                <CounterChestArt value={currentPoints} target={target} />
              </article>

              <article className="chance-card panel">
                <span className="eyebrow"><BarChart3 size={14} /> {tx("ESTIMACIÓN OBSERVADA", "OBSERVED ESTIMATE")}</span>
                <strong className="chance-value">{displayedChance.toFixed(1)}%</strong>
                <p>{isTeamMode ? tx("Promedio del porcentaje individual de los personajes seleccionados. Cada uno conserva su propio intento.", "Average individual percentage of the selected characters. Each keeps a separate attempt.") : tx("Probabilidad acumulada estimada únicamente con tus valores manuales y las cajas de este personaje.", "Estimated cumulative probability based only on your manual values and this character's crates.")}</p>
                    <div className="mini-stats"><span><small>{tx("Promedio", "Average")}</small><strong>{stats.count ? stats.average.toFixed(1) : "—"}</strong></span><span><small>{tx("Muestras", "Samples")}</small><strong>{stats.count}</strong></span></div>
              </article>
            </div>

            <div className="section-heading"><div><span className="eyebrow">{tx("ACTIVIDADES DEL MAPA", "MAP ACTIVITIES")}</span><h2>{tx("Registra tus recorridos", "Track your runs")}</h2></div><span>{tx("Jefes, silos y desafíos · cuenta al reclamar", "Bosses, silos and challenges · count on claim")}</span></div>
            <div className="activity-grid">
              {state.catalog.proActivities.map((activity) => <ActivityCard
                key={activity.id}
                language={language}
                activity={activity}
                disabled={!teamReady}
                currentCount={currentPointRoundActions.filter((action) => !action.visionId && action.activityId === activity.id).length}
                dailyCount={activityCount(activity).todayCount}
                totalCount={activityCount(activity).count}
                onAdd={() => addActivity(activity)}
                onRemove={() => removeLastActivity(activity.id)}
              />)}
            </div>

            <div className="section-heading"><div><span className="eyebrow">{tx("VISIÓN SELECCIONADA POR EL ADMINISTRADOR", "ADMINISTRATOR-SELECTED WHEEL")}</span><h2>{selectedVision ? (english ? selectedVision.englishName || selectedVision.name : selectedVision.name) : tx("Sin visión", "No wheel")}</h2></div><button type="button" className="link-button" onClick={() => setTab("vision")}>{tx("Ver contador", "View countdown")} <ChevronRight size={15} /></button></div>
            <div className="activity-grid">
              {selectedVision?.activities.length ? selectedVision.activities.map((activity) => <ActivityCard
                key={activity.id}
                language={language}
                activity={activity}
                disabled={!selectedVision.enabled || !teamReady}
                currentCount={currentPointRoundActions.filter((action) => action.visionId === selectedVision.id && action.activityId === activity.id).length}
                dailyCount={activityCount(activity, selectedVision).todayCount}
                totalCount={activityCount(activity, selectedVision).count}
                onAdd={() => addActivity(activity, selectedVision)}
                onRemove={() => removeLastActivity(activity.id, selectedVision.id)}
              />) : <div className="empty-card"><Sparkles size={28} /><strong>Aún no hay recompensas para {selectedVision?.name}</strong><span>Puedes añadirlas en Configuración y publicarlas para todos.</span></div>}
            </div>

            <section className="point-round-history panel" aria-label={tx("Historial de rondas de puntos", "Point round history")}>
              <header><div><span>{tx("RONDA ACTUAL", "CURRENT ROUND")}</span><strong>{pointsLabel(currentPointRoundPoints, language)}</strong><small>{currentPointRoundActions.length} {tx("recompensas desde el último guardado", "rewards since the last save")}</small></div><div className="point-round-totals"><span><strong>{visiblePointRounds.length}</strong> {tx("rondas guardadas", "saved rounds")}</span><span><strong>{savedPointRoundTotal}</strong> {tx("puntos registrados", "recorded points")}</span></div></header>
              {visiblePointRounds.length > 0 && <div className="point-round-list">
                {visiblePointRounds.slice(0, 5).map((record, index) => <article key={record.id}><span>#{visiblePointRounds.length - index}</span><strong>{record.points} pts</strong><small>{record.claims} {tx("recompensas", "rewards")} · {pointRoundTriggerLabel(record.trigger, language)} · {new Date(record.endedAt).toLocaleString(localeForLanguage(language), { dateStyle: "short", timeStyle: "short" })}</small></article>)}
              </div>}
            </section>

            {breakdown.length > 0 && <article className="attempt-log panel">
              <div className="panel-title"><div><span className="eyebrow">{tx("DESGLOSE", "BREAKDOWN")}</span><h3>{isTeamMode ? tx("Conteo actual del equipo", "Current team count") : `${tx("Intento de", "Attempt for")} ${activeCharacter.name}`}</h3></div><button type="button" className="danger-quiet" onClick={resetAttempt}><RotateCcw size={16} /> {tx(isTeamMode ? "Nuevo conteo" : "Reiniciar", isTeamMode ? "New count" : "Reset")}</button></div>
              {breakdown.map((item) => <div className="log-row" key={item.name}><span>{item.name}<small>{item.count}× {tx("reclamado", "claimed")}</small></span><strong>{pointsLabel(item.points, language)}</strong></div>)}
            </article>}

            <section className="activity-insights-grid" aria-label={tx("Estadísticas de recompensas", "Reward statistics")}>
              <article className="daily-points-panel panel">
                <div className="panel-title"><div><span className="eyebrow"><Clock3 size={14} /> {tx("PUNTUACIÓN POR DÍA", "POINTS BY DAY")}</span><h2>{tx("Actividad de hoy", "Today's activity")}</h2><small>{tx("El día del juego cambia a las 8:00 a. m. (hora de Colombia).", "The game day changes at 8:00 a.m. Colombia time.")}</small></div><span className="daily-date-badge">{new Date(`${todayKey}T12:00:00`).toLocaleDateString(english ? "en-US" : "es-CO", { day: "2-digit", month: "short" })}</span></div>
                <div className="daily-score-cards"><span><small>{tx("Puntos de hoy", "Points today")}</small><strong>{activitySummary.today.points}</strong></span><span><small>{tx("Jefes y recompensas", "Bosses and rewards")}</small><strong>{activitySummary.today.count}</strong></span><span><small>{tx("Puntos históricos", "All-time points")}</small><strong>{activitySummary.totalPoints}</strong></span><span><small>{tx("Registros históricos", "All-time records")}</small><strong>{activitySummary.totalCount}</strong></span></div>
                {activitySummary.days.length > 0 ? <div className="daily-history-list">{activitySummary.days.slice(0, 7).map((day) => <div key={day.date}><span>{new Date(`${day.date}T12:00:00`).toLocaleDateString(english ? "en-US" : "es-CO", { weekday: "short", day: "2-digit", month: "short" })}</span><strong>{day.points} pts</strong><small>{day.count} {tx("actividades", "activities")}</small></div>)}</div> : <p className="empty-inline">{tx("El primer registro de actividad creará el resumen diario.", "Your first activity will create the daily summary.")}</p>}
              </article>
              <article className="activity-ranking-panel panel">
                <div className="panel-title"><div><span className="eyebrow"><Trophy size={14} /> {tx("RANKING HISTÓRICO", "ALL-TIME RANKING")}</span><h2>{tx("Lo que más has realizado", "Your most completed activities")}</h2></div><span>{activitySummary.ranking.length}</span></div>
                {activitySummary.ranking.length > 0 ? <div className="activity-ranking-list">{activitySummary.ranking.slice(0, 12).map((item, index) => <div key={item.key}><span className="ranking-position">#{index + 1}</span><span className="ranking-name"><strong>{item.name}</strong><small>{tx("Hoy", "Today")} {item.todayCount} · {item.points} pts</small></span><strong className="ranking-count">{item.count}×</strong></div>)}</div> : <p className="empty-inline">{tx("Todavía no hay jefes ni recompensas para ordenar.", "There are no bosses or rewards to rank yet.")}</p>}
              </article>
            </section>

          </section>
        )}

        {tab === "vision" && (
          <section className="page vision-page">
            <div className="section-heading public-wheels-heading"><div><span className="eyebrow"><RadioTower size={15} /> {tx("RUEDAS PUBLICADAS", "PUBLISHED WHEELS")}</span><h2>{tx("Ruedas Visionales", "Visional Wheels")}</h2><p>{tx("OscarD0823 selecciona la rueda y sincroniza su estado para todos.", "OscarD0823 selects the wheel and synchronizes its status for everyone.")}</p></div></div>
            <div className="public-vision-grid">
              {state.catalog.visions.map((vision) => {
                const selected = vision.id === selectedVision?.id;
                const publicState = selected ? transition.active ? tx("CAMBIO DE FASE", "PHASE CHANGE") : cycle.phase === "active" ? tx("EVENTO ACTIVO", "ACTIVE EVENT") : tx("PRÓXIMA RUEDA", "NEXT WHEEL") : tx("OTRA RUEDA", "OTHER WHEEL");
                return <article key={vision.id} className={`public-wheel-card panel theme-${visionVisualTheme(vision)} ${selected ? "selected" : ""}`}>
                  <img src={visionVisualImage(vision)} alt={`${tx("Referencia visual de", "Visual reference for")} ${vision.name}`} />
                  <span className="public-wheel-shade" />
                  <span className={`public-wheel-state ${selected ? cycle.phase : "idle"}`}>{publicState}</span>
                  <div><span className="eyebrow">{vision.englishName || "Visional Wheel"}</span><h2>{english ? vision.englishName || vision.name : vision.name}</h2><p>{vision.description || tx("Sin descripción publicada.", "No published description.")}</p>{selected && <strong>{transition.active ? formatDuration(overlayDisplayMs) : cycle.phase === "active" ? `${tx("Termina en", "Ends in")} ${formatDuration(cycle.remainingMs)}` : `${tx("Comienza en", "Starts in")} ${formatDuration(cycle.remainingMs)}`}</strong>}</div>
                  {selected && <UserCheck size={22} />}
                </article>;
              })}
            </div>
          </section>
        )}

        {tab === "characters" && (
          <section className="page characters-page">
            <article className="character-manager panel">
              <div className="panel-title"><div><span className="eyebrow"><Users size={15} /> {tx("PERSONAJES", "CHARACTERS")}</span><h2>{tx("Perfiles de juego", "Game profiles")}</h2></div><span className="character-limit">{state.characters.length} / 12</span></div>
              <p>{tx("La aplicación siempre abre en Solitario. Cada personaje conserva sus puntos, porcentaje e historial; en Equipo, una recompensa se suma a todos los integrantes seleccionados.", "The app always opens in Solo mode. Each character keeps their own points, percentage, and history; in Team mode, one reward is added to every selected member.")}</p>
              <form className="character-add" onSubmit={(event) => { event.preventDefault(); addCharacter(); }}>
                <label>{tx("Nuevo personaje", "New character")}<input value={newCharacterName} maxLength={40} placeholder={tx("Nombre dentro del juego", "In-game name")} onChange={(event) => setNewCharacterName(event.target.value)} /></label>
                <button type="submit" className="primary" disabled={state.characters.length >= 12}><UserPlus size={17} /> {tx("Agregar personaje", "Add character")}</button>
              </form>
              <div className="character-manager-list">
                {state.characters.map((character, index) => {
                  const summary = characterSummaries.find((item) => item.character.id === character.id);
                  return <div className="character-manager-row" key={character.id}>
                    <span className="character-avatar"><UserRound size={18} /></span>
                    <label>{tx("Nombre", "Name")}<input defaultValue={character.name} maxLength={40} onBlur={(event) => renameCharacter(character.id, event.target.value.trim() || character.name)} /></label>
                    <span className="character-manager-stats"><strong>{summary?.points ?? 0} {tx("puntos", "points")}</strong><small>{(summary?.chance ?? 0).toFixed(1)}% {tx("estimado", "estimated")}</small></span>
                    {index === 0 && <span className="main-character-badge">{tx("PRINCIPAL", "MAIN")}</span>}
                    <button type="button" className="character-delete" disabled={state.characters.length <= 1} aria-label={`Eliminar ${character.name}`} onClick={() => removeCharacter(character.id)}><Trash2 size={16} /></button>
                  </div>;
                })}
              </div>
            </article>

            {state.characters.length > 1 && <article className="character-dashboard panel">
              <div className="character-dashboard-top"><div><span className="eyebrow"><Users size={15} /> REGISTRO ACTUAL</span><h2>{isTeamMode ? "Equipo" : `Solitario · ${activeCharacter.name}`}</h2></div><div className="tracking-mode-switch"><button type="button" className={!isTeamMode ? "selected" : ""} onClick={() => setTrackingMode("solo")}><UserRound size={16} /> Solitario</button><button type="button" className={isTeamMode ? "selected team" : ""} onClick={() => setTrackingMode("team")}><Users size={16} /> Equipo</button></div></div>
              <div className="character-progress-list">{characterSummaries.map((summary) => { const selected = isTeamMode ? state.teamMemberIds.includes(summary.character.id) : summary.character.id === activeCharacter.id; return <button type="button" key={summary.character.id} className={selected ? "selected" : ""} onClick={() => isTeamMode ? toggleTeamMember(summary.character.id) : selectCharacter(summary.character.id)}><span className="character-avatar"><UserRound size={17} /></span><span className="character-progress-copy"><strong>{summary.character.name}</strong><small>{summary.points} puntos · {summary.chance.toFixed(1)}% estimado</small><span className="character-progress-track"><i style={{ width: `${Math.min(100, Math.round((summary.points / target) * 100))}%` }} /></span></span>{isTeamMode && <span className={`team-member-check ${selected ? "selected" : ""}`}>{selected ? <Check size={14} /> : <Plus size={14} />}</span>}</button>; })}</div>
              {isTeamMode && <div className={`team-guidance ${teamReady ? "ready" : "warning"}`}><Users size={17} /><span><strong>{state.teamMemberIds.length} personajes seleccionados.</strong>{teamReady ? " Cada recompensa se suma a todos." : " Elige al menos dos."}</span><button type="button" className="secondary compact" onClick={startNewTeamCount}><RotateCcw size={15} /> Nuevo conteo en 0</button></div>}
            </article>}
          </section>
        )}

        {tab === "history" && (
          <section className="page history-page">
            <div className="stats-grid">
              <StatCard icon={Box} label={`${tx("Muestras", "Samples")} · ${activeCharacter.name}`} value={String(stats.count)} />
              <StatCard icon={Minus} label={tx("Más baja", "Lowest")} value={stats.count ? pointsLabel(stats.minimum, language) : "—"} />
              <StatCard icon={MonitorUp} label={tx("Más alta", "Highest")} value={stats.count ? pointsLabel(stats.maximum, language) : "—"} />
              <StatCard icon={BarChart3} label={tx("Promedio", "Average")} value={stats.count ? pointsLabel(Number(stats.average.toFixed(1)), language) : "—"} />
            </div>
            <ObservedProbability count={stats.count} perPointPercent={stats.perPointPercent} currentChancePercent={stats.currentChancePercent} tx={tx} />

            <article className="manual-history-panel panel">
              <div className="panel-title"><div><span className="eyebrow"><Plus size={15} /> {tx("HISTORIAL APROXIMADO", "APPROXIMATE HISTORY")}</span><h2>{tx("Cargar valores manualmente", "Add values manually")}</h2></div>{state.manualBaselinePoints.length > 0 && <button type="button" className="danger-quiet compact" onClick={() => commitState((current) => ({ ...current, manualBaselinePoints: [] }))}><Trash2 size={15} /> {tx("Borrar manuales", "Clear manual values")}</button>}</div>
              <p>{tx("Pega puntos separados por espacios, comas o líneas. Se usarán solo como referencia estadística; no aparecerán como cajas confirmadas ni tendrán fecha inventada.", "Paste points separated by spaces, commas, or lines. They are used only as statistical reference and will not appear as confirmed crates or receive an invented date.")}</p>
              <div className="manual-history-entry">
                <textarea value={manualHistoryText} onChange={(event) => setManualHistoryText(event.target.value)} placeholder={"Ejemplo:\n762, 966, 1143, 909"} aria-label="Valores históricos aproximados" />
                <button type="button" className="primary" onClick={addManualHistory}><Plus size={17} /> {tx("Agregar a la estimación", "Add to estimate")}</button>
              </div>
              {state.manualBaselinePoints.length > 0 && <div className="manual-values" aria-label="Valores aproximados guardados">{state.manualBaselinePoints.map((value, index) => <button type="button" key={`${value}-${index}`} title="Quitar este valor" onClick={() => commitState((current) => ({ ...current, manualBaselinePoints: current.manualBaselinePoints.filter((_, itemIndex) => itemIndex !== index) }))}><span>{value}</span><X size={12} /></button>)}</div>}
              <small>{state.manualBaselinePoints.length} {tx("de 500 valores manuales guardados en este equipo.", "of 500 manual values saved on this device.")}</small>
            </article>

            <div className="panel-title history-title"><div><span className="eyebrow">{tx("CAJAS SACADAS", "DROPPED CRATES")}</span><h2>{tx("Historial con fecha y hora", "Dated history")}</h2></div><button type="button" className="secondary compact" onClick={() => exportState(state)}><Download size={16} /> {tx("Exportar", "Export")}</button></div>
            {state.boxes.length === 0 ? <div className="empty-card history-empty"><History size={32} /><strong>{tx("Todavía no hay cajas registradas", "No crates recorded yet")}</strong><span>{tx("Cuando pulses “¡Salió la caja!”, aparecerá aquí con todos los datos del intento.", "When you press ‘The crate dropped!’, it will appear here with all attempt details.")}</span></div> : (
              <div className="history-list">
                {state.boxes.map((box, index) => (
                  <CrateHistoryCard key={box.id} box={box} number={state.boxes.length - index} characterName={box.characterName ?? state.characters.find((character) => character.id === (box.characterId ?? DEFAULT_CHARACTER_ID))?.name ?? tx("Personaje principal", "Main character")} formattedDate={formatDate(box.occurredAt, language)} pointsText={pointsLabel(box.points, language)} tx={tx} />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "shiny" && (!shinyCatalogModule || !selectedShinyMod ? (
          <section className="page shiny-page"><div className="empty-card shiny-catalog-loading"><RefreshCw size={28} /><strong>{shinyCatalogError || tx("Cargando los 1.618 módulos actuales…", "Loading the 1,618 current mods…")}</strong><span>{tx("El catálogo se abre solo al entrar aquí para que el inicio use menos memoria.", "The catalog opens only when you enter this page to reduce startup memory use.")}</span>{shinyCatalogError && <button type="button" className="secondary compact" onClick={() => { setShinyCatalogError(""); setShinyCatalogAttempt((current) => current + 1); }}>{tx("Reintentar", "Retry")}</button>}</div></section>
        ) : (
          <section className="page shiny-page">
            <div className="stats-grid shiny-stats">
              <StatCard icon={Search} label={tx("Buscando convertir", "Conversion goals")} value={String(allActiveShinyGoals.length)} />
              <StatCard icon={Gem} label={tx("Brillantes conseguidos", "Shiny obtained")} value={String(allObtainedShinyMods.length)} />
              <StatCard icon={RotateCcw} label={tx("Duplicados +17 fallidos", "Failed +17 duplicates")} value={String(totalShinyAttempts)} />
              <StatCard icon={Trophy} label={tx("Colección del catálogo", "Catalog collection")} value={`${shinyCollectionPercent.toFixed(1)}%`} />
            </div>

            <article className="shiny-rule panel">
              <div className="shiny-rule-icon"><ShinyModuleMark /></div>
              <div><span className="eyebrow">{tx("CÓMO FUNCIONA", "HOW IT WORKS")}</span><h2>{tx("Del nivel 1 al 17, después Brillante", "From level 1 to 17, then Shiny")}</h2><p>{tx("Todos los módulos progresan del nivel 1 al 17. Cuando ya tienes uno en nivel 17, otro igual puede convertirse en Brillante. Pulsa “Otro +17 no se convirtió” después de cada fallo; cuando salga, márcalo como conseguido.", "All mods progress from level 1 to 17. Once you have one at level 17, another copy can become Shiny. Press ‘Another +17 failed’ after each failed conversion, then mark it as obtained when it succeeds.")}</p></div>
            </article>

            <article className="shiny-catalog-panel panel">
              <div className="panel-title"><div><span className="eyebrow"><Search size={15} /> {tx("CATÁLOGO DE MÓDULOS", "MOD CATALOG")}</span><h2>{tx("Buscar y agregar un objetivo exacto", "Find and add an exact goal")}</h2></div><span className="catalog-count">{SHINY_MOD_CATALOG.length.toLocaleString(english ? "en-US" : "es-CO")} {tx("registros", "records")}</span></div>
              <div className="shiny-search-controls">
                <label className="shiny-search-field">{tx("Buscar nombre, variante, estilo o ID", "Search name, variant, style, or ID")}<div><Search size={16} /><input value={shinySearch} onChange={(event) => setShinySearch(event.target.value)} placeholder={tx("Ejemplo: Hora punta, Downstar o 19500542", "Example: Rush Hour, Downstar, or 19500542")} /></div></label>
                <label>{tx("Estilo o pieza", "Style or slot")}<select value={shinyGroupFilter} onChange={(event) => setShinyGroupFilter(event.target.value)}><option value="all">{tx("Todas las armas y armaduras", "All weapons and armor")}</option><optgroup label={tx("ARMAS", "WEAPONS")}>{SHINY_MOD_GROUPS.filter((entry) => entry.category === "weapon").map((entry) => <option key={entry.id} value={entry.id}>{entry.name.replace("Arma · ", "")} ({entry.count})</option>)}</optgroup><optgroup label={tx("ARMADURA", "ARMOR")}>{SHINY_MOD_GROUPS.filter((entry) => entry.category === "armor").map((entry) => <option key={entry.id} value={entry.id}>{entry.name.replace("Armadura · ", "")} ({entry.count})</option>)}</optgroup></select></label>
                <label>{tx("Nivel", "Level")}<select value={shinySystemFilter} onChange={(event) => setShinySystemFilter(event.target.value)}><option value="all">{tx("Todos los actuales", "All current mods")} ({SHINY_MOD_CATALOG_META.total.toLocaleString(english ? "en-US" : "es-CO")})</option><option value="normal">{tx("Nivel 1–17", "Level 1–17")} ({SHINY_MOD_CATALOG_META.normal})</option><option value="shiny">{tx("Brillante", "Shiny")} ({SHINY_MOD_CATALOG_META.shiny})</option></select></label>
              </div>
              <div className="shiny-result-summary"><span>{filteredShinyCatalog.length.toLocaleString(english ? "en-US" : "es-CO")} {tx("coincidencias en", "matches in")} {groupedVisibleShinyCatalog.length} {tx("grupos", "groups")}</span>{filteredShinyCatalog.length > visibleShinyCatalogCount && <small>{tx(`Se muestran ${visibleShinyCatalogCount}. Elige una pieza, estilo o escribe una búsqueda para ver más.`, `${visibleShinyCatalogCount} shown. Choose a slot or style, or enter a search to see more.`)}</small>}</div>
              <div className="shiny-catalog-results">
                {groupedVisibleShinyCatalog.map((group) => <section className="shiny-result-group" key={group.id}><header><strong>{group.name}</strong><small>{group.items.length} {tx("mostrados de", "shown of")} {filteredShinyCatalog.filter((item) => item.groupId === group.id).length}</small></header><div className="shiny-result-group-grid">{group.items.map((item) => <button type="button" key={item.id} className={selectedShinyMod.id === item.id ? "selected" : ""} onClick={() => chooseShinyMod(item)}><span>{catalogStatusLabel(item, language)}</span><strong>{english ? item.englishName || item.name : item.name}</strong><small>{catalogOriginLabel(item, language)} · ID {item.itemId}</small>{selectedShinyMod.id === item.id && <Check size={16} />}</button>)}</div></section>)}
                {filteredShinyCatalog.length === 0 && <div className="shiny-no-results"><Search size={23} /><span>{tx("No aparece en el catálogo. Puedes agregar el nombre escrito como personalizado.", "It is not in the catalog. You can add the typed name as a custom entry.")}</span></div>}
              </div>
              <div className="shiny-selection">
                <div><span>{tx("MÓDULO SELECCIONADO", "SELECTED MOD")}</span><strong>{english ? selectedShinyMod.englishName || selectedShinyMod.name : selectedShinyMod.name}</strong><small>{selectedShinyMod.groupName} · {catalogOriginLabel(selectedShinyMod, language)} · ID {selectedShinyMod.itemId}</small></div>
                <div className={`shiny-selected-variant ${selectedShinyMod.isCatalogShiny ? "bright" : ""}`}><span>{catalogStatusLabel(selectedShinyMod, language)}</span><strong>{selectedShinyMod.variant}</strong><small>{selectedShinyMod.englishName}</small></div>
                <button type="button" className="primary" onClick={() => addShinyTracker()}><Plus size={17} /> {tx("Empezar en 0", "Start at 0")}</button>
                <button type="button" className="secondary" disabled={!shinySearch.trim()} onClick={() => addShinyTracker(shinySearch)}><Plus size={17} /> {tx("Agregar nombre escrito", "Add typed name")}</button>
              </div>
              <p className="catalog-source-note">{tx(`Los ${SHINY_MOD_CATALOG_META.total.toLocaleString("es-CO")} registros están ordenados por tipo de arma o pieza de armadura. Todos progresan de nivel 1 a 17; los ${SHINY_MOD_CATALOG_META.shiny} registros especiales representan el estado Brillante.`, `The ${SHINY_MOD_CATALOG_META.total.toLocaleString("en-US")} records are grouped by weapon style or armor slot. All progress from level 1 to 17; the ${SHINY_MOD_CATALOG_META.shiny} special records represent the Shiny state.`)}</p>
            </article>

            <label className="shiny-search-field shiny-record-search">{tx("Buscar en mi registro", "Search my records")}<div><Search size={16} /><input value={shinyRecordSearch} onChange={(event) => setShinyRecordSearch(event.target.value)} placeholder={tx("Buscar entre objetivos e historial Brillante", "Search goals and Shiny history")} /></div></label>

            <div className="section-heading shiny-heading"><div><span className="eyebrow">{tx("EN PROCESO", "IN PROGRESS")}</span><h2>{tx("Intentos de conversión", "Conversion attempts")}</h2></div><span>{activeShinyGoals.length}{normalizedRecordSearch ? ` ${tx("de", "of")} ${allActiveShinyGoals.length}` : ""} {tx("activos", "active")}</span></div>
            {activeShinyGoals.length === 0 ? <div className="empty-card shiny-empty"><Gem size={30} /><strong>{normalizedRecordSearch ? tx("No hay coincidencias en los objetivos", "No matching goals") : tx("No estás siguiendo ningún módulo", "You are not tracking any mods")}</strong><span>{normalizedRecordSearch ? tx("Prueba con otro nombre, variante o estilo.", "Try another name, variant, or style.") : tx("Busca uno arriba, elige el registro exacto y pulsa “Empezar en 0”.", "Search above, choose the exact record, and press ‘Start at 0’.")}</span></div> : <div className="shiny-tracker-grid">{activeShinyGoals.map((record) => <ShinyTrackerCard language={language} key={record.id} record={record} onDecrease={() => adjustShinyAttempts(record.id, -1)} onIncrease={() => adjustShinyAttempts(record.id, 1)} onToggle={() => setShinyObtained(record.id, true)} onDelete={() => commitState((current) => ({ ...current, shinyMods: current.shinyMods.filter((item) => item.id !== record.id) }))} />)}</div>}

            <div className="section-heading shiny-heading"><div><span className="eyebrow">{tx("COLECCIÓN BRILLANTE", "SHINY COLLECTION")}</span><h2>{tx("Módulos conseguidos", "Obtained mods")}</h2></div><span>{obtainedShinyMods.length}{normalizedRecordSearch ? ` ${tx("de", "of")} ${allObtainedShinyMods.length}` : ""} {tx("marcados", "marked")}</span></div>
            {obtainedShinyMods.length === 0 ? <div className="empty-card shiny-empty obtained"><Trophy size={30} /><strong>{normalizedRecordSearch ? tx("No hay coincidencias en los conseguidos", "No matching obtained mods") : tx("Aún no has marcado ningún Brillante", "No Shiny mods marked yet")}</strong><span>{normalizedRecordSearch ? tx("La búsqueda también revisa nombre, variante y estilo.", "Search also checks name, variant, and style.") : tx("También puedes agregar un módulo y marcarlo directamente si ya lo tenías.", "You can also add a mod and mark it immediately if you already had it.")}</span></div> : <div className="shiny-tracker-grid">{obtainedShinyMods.map((record) => <ShinyTrackerCard language={language} key={record.id} record={record} onDecrease={() => adjustShinyAttempts(record.id, -1)} onIncrease={() => adjustShinyAttempts(record.id, 1)} onToggle={() => setShinyObtained(record.id, false)} onDelete={() => commitState((current) => ({ ...current, shinyMods: current.shinyMods.filter((item) => item.id !== record.id) }))} />)}</div>}
          </section>
        ))}

        {tab === "changes" && creatorAccess === "granted" && (
          <section className="page changes-page">
            <article className="release-hero panel"><div><span className="eyebrow"><ShieldCheck size={15} /> VERSIÓN INSTALADA</span><h2>Versión {APP_VERSION}</h2><p>Las actualizaciones se comprueban al abrir y llegan firmadas desde GitHub Releases.</p></div><button type="button" className="secondary" onClick={openRepository}><Github size={18} /> Ver repositorio</button></article>
            <div className="timeline">
              {CHANGELOG.map((release) => <article key={release.version} className="release-entry"><span className="timeline-dot" /><div className="panel"><div className="release-heading"><div><span>v{release.version}</span><h3>{release.title}</h3></div><time>{release.date}</time></div><ul>{release.items.map((item) => <li key={item}>{item}</li>)}</ul></div></article>)}
            </div>
          </section>
        )}

        {tab === "devices" && (
          <section className="page devices-page">
            <article className="platform-access-panel panel"><span className="eyebrow">{tx("PC, WEB Y CELULAR", "PC, WEB AND PHONE")}</span><h2>{tx("Tu caja, en cualquier pantalla", "Your crate, on every screen")}</h2><div className="platform-download-actions"><button type="button" className="secondary" onClick={openWindowsDownload}><MonitorUp size={21} /><span><strong>Windows</strong><small>{tx("Descargar para PC", "Download for PC")}</small></span></button><button type="button" className="secondary" onClick={openWebApp}><ExternalLink size={21} /><span><strong>Web</strong><small>{tx("Abrir página web", "Open web app")}</small></span></button><button type="button" className="secondary" onClick={openAndroidDownload}><Smartphone size={21} /><span><strong>Android</strong><small>{tx("Descargar APK", "Download APK")}</small></span></button></div><div className="connection-shortcuts"><a href="#pc-connection">{tx("Conectar con PC", "Connect with PC")}</a><a href="#phone-connection">{tx("Web ↔ Celular sin PC", "Web ↔ Phone without PC")}</a></div></article>
            <article className="device-version-panel panel">
              <div className="device-version-icon"><ShieldCheck size={27} /></div>
              <div><span className="eyebrow">{tx("VERSIÓN INSTALADA", "INSTALLED VERSION")}</span><h2>Auralis Caja Fantasma v{APP_VERSION}</h2><p>{IS_WEB ? tx("Versión web gratuita con guardado local y funcionamiento sin conexión.", "Free web version with local storage and offline support.") : IS_ANDROID ? tx("Aplicación Android ARM64 con actualizaciones verificadas dentro de la app.", "ARM64 Android app with verified in-app updates.") : tx("Aplicación de Windows con actualizaciones firmadas desde GitHub Releases.", "Windows app with signed updates from GitHub Releases.")}</p><small className="version-developer"><Github size={12} aria-hidden="true" /> {tx("Creado por", "Created by")} <strong>{AUTHOR}</strong></small></div>
              <span className="version-current-badge">{tx("ACTUAL", "CURRENT")}</span>
            </article>

            <article className="public-catalog-sync panel">
              <div className="public-catalog-heading"><div><span className="eyebrow"><RadioTower size={15} /> {tx("CAMBIOS DEL ADMINISTRADOR", "ADMINISTRATOR CHANGES")}</span><h2>{tx("Actualización pública para PC, web y Android", "Public updates for PC, web, and Android")}</h2><p>{tx("La rueda, sus recompensas, puntos y tiempos se comprueban automáticamente en los tres sistemas.", "The wheel, rewards, points, and timing are checked automatically on all three platforms.")}</p></div><span className="catalog-version-badge">{tx("CATÁLOGO", "CATALOG")} v{state.catalog.catalogVersion}</span></div>
              <div className="public-catalog-facts"><span><small>{tx("Rueda publicada", "Published wheel")}</small><strong>{selectedVision ? (english ? selectedVision.englishName || selectedVision.name : selectedVision.name) : tx("Sin rueda", "No wheel")}</strong></span><span><small>{tx("Falta para volver", "Wait time")}</small><strong>{state.settings.waitMinutes} min</strong></span><span><small>{tx("Duración activa", "Active duration")}</small><strong>{state.settings.activeMinutes} min</strong></span><span><small>{tx("Transición", "Transition")}</small><strong>{state.settings.transitionDelayMilliseconds} ms</strong></span><span><small>{tx("Publicado por", "Published by")}</small><strong>{state.catalog.updatedBy || AUTHOR}</strong></span><span><small>{tx("Último cambio", "Last change")}</small><strong>{formatDate(state.catalog.updatedAt, language)}</strong></span></div>
              <div className="public-catalog-actions"><button type="button" className="secondary" onClick={() => void syncCatalog()}><RefreshCw size={16} /> {tx("Comprobar ahora", "Check now")}</button><small>{syncStatus}. {tx("Se revisa al abrir, cada 30 segundos, al volver Internet y al regresar a la aplicación.", "Checked at startup, every 30 seconds, when Internet returns, and when the app regains focus.")}</small></div>
            </article>

            {IS_WEB && <WebInstallNotice pwa={pwa} language={language} variant="panel" />}
            <div className="connection-hub"><div className="connection-hub-heading"><span className="eyebrow"><Wifi size={15} /> {tx("CONECTA TUS DISPOSITIVOS", "CONNECT YOUR DEVICES")}</span><h2>{tx("Elige el dispositivo que comparte", "Choose the sharing device")}</h2><p>{tx("Con PC: usa los datos de Windows. Sin PC: comparte desde Android y conecta la web abajo.", "With a PC: use the Windows details. Without a PC: share from Android and connect the web below.")}</p></div>
            <article id="pc-connection" className={`local-device-sync panel ${state.settings.localSyncEnabled ? "enabled" : ""}`}>
              <div className="local-sync-heading"><div><span className="eyebrow"><Wifi size={15} /> {tx("SIN NUBE NI FIREBASE", "NO CLOUD OR FIREBASE")}</span><h2>{tx("Sincronizar PC ↔ Web ↔ Android", "Sync PC ↔ Web ↔ Android")}</h2><p>{tx("El PC actúa como puente local: combina los historiales sin enviar datos personales a Internet.", "The PC acts as a local bridge, merging history without uploading personal data to the Internet.")}</p></div><span className={`local-sync-state ${state.settings.localSyncEnabled ? "online" : "offline"}`}>{state.settings.localSyncEnabled ? tx("ACTIVA", "ON") : tx("APAGADA", "OFF")}</span></div>
              {!IS_ANDROID && !IS_WEB ? <>
                <div className="local-sync-desktop-grid">
                  <div><small>{tx("IP DEL PC", "PC IP")}</small><strong>{localSyncInfo ? desktopLocalAddress.octets.join(".") : tx("Se mostrará al activar", "Shown after enabling")}</strong></div>
                  <div><small>{tx("PUERTO WEB Y ANDROID", "WEB AND ANDROID PORT")}</small><strong>{localSyncInfo?.port ?? "—"}</strong></div>
                  <div><small>{tx("CÓDIGO DE CONEXIÓN", "PAIRING CODE")}</small><strong className="pairing-code">{state.settings.localSyncCode || "—— —— ——"}</strong></div>
                </div>
                <div className="local-sync-actions"><button type="button" className={state.settings.localSyncEnabled ? "secondary" : "primary"} onClick={() => commitState((current) => { const enabling = !current.settings.localSyncEnabled; return { ...current, settings: { ...current.settings, localSyncEnabled: enabling, localSyncCode: enabling && !/^\d{6}$/.test(current.settings.localSyncCode) ? createPairingCode() : current.settings.localSyncCode } }; })}>{state.settings.localSyncEnabled ? <WifiOff size={17} /> : <Wifi size={17} />}{state.settings.localSyncEnabled ? tx("Detener conexión", "Stop connection") : tx("Compartir con el celular", "Share with phone")}</button>{state.settings.localSyncEnabled && <button type="button" className="secondary" onClick={() => commitState((current) => ({ ...current, settings: { ...current.settings, localSyncCode: createPairingCode() } }))}><RefreshCw size={16} /> {tx("Cambiar código", "Change code")}</button>}</div>
              </> : <>
                <div className="local-sync-mobile-fields">
                  <LocalSyncAddressFields language={language} value={state.settings.localSyncAddress} onChange={(address) => commitState((current) => ({ ...current, settings: { ...current.settings, localSyncAddress: address.slice(0, 80) } }))} />
                  <label className="local-pairing-field">{tx("Código de 6 números", "Six-digit code")}<input inputMode="numeric" maxLength={6} value={state.settings.localSyncCode} placeholder="000000" onChange={(event) => commitState((current) => ({ ...current, settings: { ...current.settings, localSyncCode: event.target.value.replace(/\D/g, "").slice(0, 6) } }))} /></label>
                </div>
                <div className="local-sync-actions"><button type="button" disabled={localSyncBusy} className={state.settings.localSyncEnabled ? "secondary" : "primary"} onClick={() => { const enabling = !state.settings.localSyncEnabled; if (enabling && (!localSyncAddressReady || !/^\d{6}$/.test(state.settings.localSyncCode))) { setLocalSyncStatus(tx("Completa los cuatro bloques de la IP, el puerto y el código del PC", "Enter all four IP blocks, the port, and the PC code")); return; } commitState((current) => ({ ...current, settings: { ...current.settings, localSyncEnabled: enabling } })); if (enabling) window.setTimeout(() => void exchangeWithComputer("status"), 0); }}>{state.settings.localSyncEnabled ? <WifiOff size={17} /> : <Wifi size={17} />}{state.settings.localSyncEnabled ? tx("Desconectar", "Disconnect") : tx("Conectar con el PC", "Connect to PC")}</button>{IS_WEB && state.settings.localSyncEnabled && <button type="button" disabled={localSyncBusy} className="secondary" onClick={() => void exchangeWithComputer("status")}><RefreshCw size={16} /> {tx("Volver a conectar", "Reconnect")}</button>}</div>
                {state.settings.localSyncEnabled && <div className="local-sync-direction-grid">
                  <button type="button" className="secondary" disabled={localSyncBusy} onClick={() => { if (window.confirm(tx("Los datos personales de este dispositivo se reemplazarán por los datos actuales del PC. ¿Continuar?", "This device's personal data will be replaced with the current PC data. Continue?"))) void exchangeWithComputer("pull"); }}><Download size={18} /><span><strong>{tx(IS_WEB ? "PC → Página" : "PC → Celular", IS_WEB ? "PC → Web" : "PC → Phone")}</strong><small>{tx("Traer los datos del PC", "Get data from the PC")}</small></span></button>
                  <button type="button" className="secondary" disabled={localSyncBusy} onClick={() => { if (window.confirm(tx("Los datos personales del PC recibirán los datos actuales de este dispositivo. ¿Continuar?", "The PC will receive this device's current personal data. Continue?"))) void exchangeWithComputer("push"); }}><Upload size={18} /><span><strong>{tx(IS_WEB ? "Página → PC" : "Celular → PC", IS_WEB ? "Web → PC" : "Phone → PC")}</strong><small>{tx("Enviar los datos al PC", "Send data to the PC")}</small></span></button>
                </div>}
              </>}
              <div className={`local-live-sync-option ${state.settings.localSyncLiveEnabled ? "enabled" : ""}`}>
                <span className="local-live-sync-icon"><Zap size={19} /></span>
                <span><strong>{tx("Sincronización en vivo", "Live synchronization")}</strong><small>{tx(IS_ANDROID ? "Sigue conectada al PC en segundo plano aunque uses otra aplicación." : "Refleja automáticamente los cambios de puntos, cajas, personajes y módulos mientras el PC esté encendido.", IS_ANDROID ? "Stays connected to the PC in the background while you use another app." : "Automatically mirrors points, crates, characters, and mods while the PC is running.")}</small></span>
                <button type="button" className={`switch ${state.settings.localSyncLiveEnabled ? "on" : ""}`} disabled={!state.settings.localSyncEnabled} aria-label={tx("Activar sincronización en vivo", "Enable live synchronization")} aria-pressed={state.settings.localSyncLiveEnabled} onClick={() => { liveRevisionRef.current = 0; commitState((current) => ({ ...current, settings: { ...current.settings, localSyncLiveEnabled: !current.settings.localSyncLiveEnabled } })); }}><span /></button>
              </div>
              {state.settings.localSyncLiveEnabled && <p className="local-live-sync-note"><RadioTower size={15} /> {tx(IS_ANDROID ? "Android mostrará una notificación silenciosa mientras trabaja en segundo plano. Si un dispositivo aparece vacío, se conserva la copia que tenga historial." : "Debe estar activada en ambos dispositivos. Si uno aparece vacío, se conserva automáticamente la copia que tenga historial.", IS_ANDROID ? "Android shows a silent notification while working in the background. If a device appears empty, the copy containing history is preserved." : "Enable it on both devices. If one appears empty, the copy containing history is preserved automatically.")}</p>}
              <p className="local-sync-message" role="status">{localSyncStatus}</p>
              {IS_WEB && <p className="local-live-sync-note"><RadioTower size={15} /> {tx("Usa aquí la misma IP, puerto y código que muestra Windows para Android. Auralis Caja Fantasma debe permanecer abierta y el navegador debe tener permiso de red local.", "Use the same IP, port, and code shown by Windows for Android. Auralis Caja Fantasma must stay open and the browser must have local network permission.")}</p>}
              <small>{tx("Usa una red Wi‑Fi de confianza o el anclaje USB del teléfono. Los cambios públicos del administrador también viajan del PC al celular mientras estén conectados.", "Use a trusted Wi-Fi network or USB tethering. Public administrator changes also travel from the PC to the phone while connected.")}</small>
            </article>

            <PhoneBridgeSyncPanel bridge={phoneBridge} mobile={IS_ANDROID} web={IS_WEB} language={language} address={state.settings.phoneSyncAddress} code={state.settings.phoneSyncCode} newCode={createPairingCode} onAddress={address => { phoneBridge.setEnabled(false); commitState(current => ({ ...current, settings: { ...current.settings, phoneSyncAddress: address } })); }} onCode={code => { if (IS_WEB) phoneBridge.setEnabled(false); commitState(current => ({ ...current, settings: { ...current.settings, phoneSyncCode: code } })); }} />
            </div>
            {IS_WEB && <article className="backup-panel panel"><div><span className="eyebrow">{tx("ALMACENAMIENTO WEB", "WEB STORAGE")}</span><h2>{tx("Copia local recuperable", "Recoverable local copy")}</h2><p>{tx("Se guarda en localStorage e IndexedDB y la aplicación queda en caché para abrir sin conexión. No se sube a ningún servidor.", "Data is stored in localStorage and IndexedDB, and the app shell is cached for offline use. Nothing is uploaded to a server.")}</p></div><div><span className="version-current-badge">{webStorageStatus?.persisted ? tx("PROTEGIDO", "PERSISTENT") : tx("LOCAL", "LOCAL")}</span><button type="button" className="secondary" onClick={() => void requestPersistentWebStorage().then(setWebStorageStatus)}><ShieldCheck size={17} /> {tx("Proteger almacenamiento", "Protect storage")}</button></div></article>}

            <article className="community-notice">
              <ShieldCheck size={22} aria-hidden="true" />
              <div><strong>{tx("Herramienta comunitaria · no oficial", "Community tool · unofficial")}</strong><p>{tx("Creada por OscarD0823 para ayudar a los jugadores. El registro es manual: no lee ni modifica archivos, memoria o procesos del juego y no automatiza partidas. No está afiliada, patrocinada ni aprobada por los responsables de Once Human. La marca y las imágenes de referencia pertenecen a sus titulares; no reclamamos derechos sobre ellas.", "Created by OscarD0823 to help players. Tracking is manual: it does not read or modify game files, memory or processes, or automate gameplay. It is not affiliated with, sponsored or approved by Once Human's owners. Trademarks and reference images belong to their respective owners; we claim no rights to them.")}</p></div>
            </article>
          </section>
        )}

        {tab === "settings" && (
          <section className="page settings-page">
            <div className="settings-grid">
              <article className="settings-card language-settings panel">
                <div className="settings-icon"><Languages /></div><div><h3>{tx("Idioma de la aplicación", "App language")}</h3><p>{tx("Detecta el idioma del dispositivo o elige uno de los 12 disponibles. Tu elección manual se conserva. Los textos aún no traducidos aparecen en inglés.", "Detect the device language or choose one of the 12 supported languages. Your manual choice is preserved. Text not yet translated appears in English.")}</p><div className="language-choice" role="group" aria-label={tx("Idioma", "Language")}><button type="button" className={state.settings.uiLanguageMode === "auto" ? "selected" : ""} onClick={() => commitState(current => ({ ...current, settings: { ...current.settings, uiLanguageMode: "auto", uiLanguage: detectUiLanguage() } }))}>Auto · {language.toUpperCase()}</button>{UI_LANGUAGES.map((item) => <button key={item.code} type="button" className={state.settings.uiLanguageMode !== "auto" && language === item.code ? "selected" : ""} onClick={() => commitState((current) => ({ ...current, settings: { ...current.settings, uiLanguageMode: "manual", uiLanguage: item.code } }))}>{item.name}</button>)}</div></div>
              </article>
              <article className="settings-card panel public-timing-summary">
                <div className="settings-icon"><Clock3 /></div><div><h3>{tx("Duración pública del ciclo", "Public cycle duration")}</h3><p>{tx("Estos valores los define el administrador y se sincronizan junto con la rueda y sus puntos.", "These values are set by the administrator and synced with the wheel and its points.")}</p><div className="timing-summary-values"><span><small>{tx("Espera", "Waiting")}</small><strong>{state.settings.waitMinutes} min</strong></span><span><small>{tx("Activa", "Active")}</small><strong>{state.settings.activeMinutes} min</strong></span><span><small>{tx("Transición al cierre", "End transition")}</small><strong>{state.settings.transitionDelayMilliseconds} ms</strong></span></div><small>{tx("El propietario puede modificarlos en el editor general inferior y enviarlos todos con un solo botón.", "The owner can edit them below and publish everything with one button.")}</small></div>
              </article>
              <article className="settings-card voice-settings panel">
                <div className="settings-icon"><Volume2 /></div><div><h3>{tx("Aviso por voz · Gravedad", "Voice alert · Gravity")}</h3><p>{tx("Habla antes de que empiece el evento aunque la aplicación esté minimizada.", "Speaks before the event starts even when the app is minimized.")}</p><div className="voice-controls"><label>{tx("Anticipación (minutos)", "Lead time (minutes)")}<input type="number" min={1} max={60} value={state.settings.voiceLeadMinutes} onChange={(event) => commitState((current) => ({ ...current, settings: { ...current.settings, voiceLeadMinutes: clampNumber(Number(event.target.value), 1, 60), lastVoiceAlertPhaseStartedAt: undefined } }))} /></label><button type="button" className="secondary compact" onClick={() => { speakMessage(tx("Prueba de voz. El aviso de Gravedad está funcionando.", "Voice test. The Gravity alert is working.")); setToast(tx("Prueba de voz reproducida", "Voice test played")); window.setTimeout(() => setToast(""), 1800); }}><Volume2 size={15} /> {tx("Probar voz", "Test voice")}</button></div></div><button type="button" className={`switch ${state.settings.voiceNotificationsEnabled ? "on" : ""}`} aria-pressed={state.settings.voiceNotificationsEnabled} onClick={() => commitState((current) => ({ ...current, settings: { ...current.settings, voiceNotificationsEnabled: !current.settings.voiceNotificationsEnabled } }))}><span /></button>
              </article>
              {!IS_ANDROID && <><SettingToggle icon={MonitorUp} title={tx("Iniciar con Windows", "Start with Windows")} description={tx("Arranca en segundo plano; la ventana principal no interrumpe al encender el PC.", "Starts in the background without interrupting you when the PC boots.")} enabled={state.settings.autoStartEnabled} onToggle={(enabled) => { commitState((current) => ({ ...current, settings: { ...current.settings, autoStartEnabled: enabled } })); void toggleAutostart(enabled); }} /><SettingToggle icon={Eye} title={tx("Ventana flotante", "Floating overlay")} description={tx("Contador pequeño, movible y siempre encima del juego.", "A small movable countdown that stays above the game.")} enabled={state.settings.overlayEnabled} onToggle={() => commitState((current) => ({ ...current, settings: { ...current.settings, overlayEnabled: !current.settings.overlayEnabled } }))} /><SettingToggle icon={Zap} title={tx("Contador de Ballena", "Whale countdown")} description={tx("Muestra la Ballena y su rayo durante Gravedad; puede ocultarse sin quitar la ventana flotante.", "Shows the Whale and its beam during Gravity; it can be hidden without disabling the main overlay.")} enabled={state.settings.overlayWhaleEnabled} onToggle={() => commitState((current) => ({ ...current, settings: { ...current.settings, overlayWhaleEnabled: !current.settings.overlayWhaleEnabled } }))} /></>}
            </div>

            <article className="backup-panel panel"><div><span className="eyebrow">{tx("DATOS PERSONALES", "PERSONAL DATA")}</span><h2>{tx("Respaldo local", "Local backup")}</h2><p>{tx("El historial permanece en este equipo y no se sube al repositorio público.", "Your history stays on this device and is not uploaded to the public repository.")}</p></div><div><button type="button" className="secondary" onClick={() => exportState(state)}><Download size={17} /> {tx("Exportar", "Export")}</button><button type="button" className="secondary" onClick={() => importRef.current?.click()}><Upload size={17} /> {tx("Importar", "Import")}</button><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => void onImport(event.target.files?.[0])} /></div></article>

            {(creatorAccess === "granted" || ownerEntryRequested) && <article className="owner-panel panel">
              <div className="panel-title"><div><span className="eyebrow">{creatorAccess === "granted" ? "MODO DESARROLLADOR" : "CUENTA PROPIETARIA"}</span><h2>{creatorAccess === "granted" ? "Editor de OscarD0823" : "Acceso privado"}</h2></div><span className={`creator-access-badge ${creatorAccess}`}>{creatorAccess === "granted" ? <UserCheck size={15} /> : <LockKeyhole size={15} />}{creatorAccess === "granted" ? "Propietario verificado" : creatorAccess === "checking" ? "Comprobando" : "Bloqueado"}</span></div>
              {creatorAccess === "granted" ? <>
                <p>Las herramientas privadas, el control del contador y la publicación completa solo aparecen al propietario verificado.</p>
                <section className="admin-cycle-console">
                  <div className="admin-cycle-heading"><div><span className="eyebrow"><Clock3 size={15} /> CONTROL PRIVADO DEL CICLO</span><h3>Rueda pública y contador sincronizado</h3></div><span className={`live-dot ${cycle.phase}`}>{transition.active ? "TRANSICIÓN" : cycle.phase === "active" ? "EN CURSO" : "EN ESPERA"}</span></div>
                  <div className="admin-cycle-grid">
                    <div className={`admin-cycle-live ${cycle.phase}`}><span>{transition.active ? "Preparando el próximo contador" : cycle.phase === "active" ? `${selectedVision?.name ?? "Rueda"} activa` : `${selectedVision?.name ?? "Rueda"} comenzará en`}</span><strong>{formatDuration(overlayDisplayMs)}</strong><div className="cycle-track"><i style={{ width: `${Math.round(cycle.progress * 100)}%` }} /></div><small>{cycle.phase === "active" ? `Termina el ${formatDate(cycle.phaseEndsAt)}.` : `Comienza el ${formatDate(cycle.phaseEndsAt)}.`}</small><div className="hero-actions"><button type="button" className="primary" onClick={() => setCyclePhase(cycle.phase === "active" ? "waiting" : "active")}>{cycle.phase === "active" ? <X size={17} /> : <Zap size={17} />}{cycle.phase === "active" ? "Terminar ahora" : "Activar ahora"}</button><button type="button" className="secondary" onClick={() => setCyclePhase(cycle.phase)}><RotateCcw size={16} /> Reiniciar</button></div></div>
                    <div className="admin-counter-editor"><div className="panel-title"><div><span className="eyebrow">AJUSTE EXACTO</span><h3>Modificar el contador</h3></div><button type="button" className="secondary compact" onClick={loadCurrentCountdown}><RefreshCw size={15} /> Copiar actual</button></div><p>Introduce el tiempo exacto que muestra el juego y decide si solo se aplica aquí o se envía a todos.</p><div className="counter-phase-buttons" aria-label="Fase que se está contando"><button type="button" className={counterPhase === "waiting" ? "selected" : ""} aria-pressed={counterPhase === "waiting"} onClick={() => setCounterPhase("waiting")}>Falta para empezar</button><button type="button" className={counterPhase === "active" ? "selected active" : ""} aria-pressed={counterPhase === "active"} onClick={() => setCounterPhase("active")}>Falta para terminar</button></div><div className="counter-time-fields"><label>Minutos<input type="number" min={0} max={counterPhase === "active" ? state.settings.activeMinutes : state.settings.waitMinutes} value={counterMinutes} onChange={(event) => setCounterMinutes(event.target.value)} /></label><span>:</span><label>Segundos<input type="number" min={0} max={59} value={counterSeconds} onChange={(event) => setCounterSeconds(event.target.value)} /></label></div><div className="admin-counter-actions"><button type="button" className="secondary" onClick={synchronizeCountdown}><Save size={16} /> Aplicar en este PC</button><button type="button" className="primary" onClick={() => void publishSharedCountdown()}><Upload size={16} /> Sincronizar con todos</button></div></div>
                  </div>
                  <small className="counter-anchor-note">La sincronización pública envía fase, hora absoluta, espera, duración activa y transición al cierre en milisegundos.</small>
                </section>
                <OverlayPreviewLab catalog={state.catalog} scale={state.settings.overlayScale} addonScale={state.settings.overlayAddonScale} whaleCounterScale={state.settings.overlayWhaleCounterScale} whaleCounterStyle={state.settings.overlayWhaleCounterStyle} whaleShowTime={state.settings.overlayWhaleShowTime} shape={state.settings.overlayShape} counterStyle={state.settings.overlayCounterStyle} nameMode={state.settings.overlayNameMode} customName={state.settings.overlayCustomName} onScaleChange={(scale) => commitState((current) => ({ ...current, settings: { ...current.settings, overlayScale: clampNumber(scale, .2, 1.5) } }))} onAddonScaleChange={(scale) => commitState((current) => ({ ...current, settings: { ...current.settings, overlayAddonScale: clampNumber(scale, .2, 1) } }))} onWhaleCounterScaleChange={(scale) => commitState((current) => ({ ...current, settings: { ...current.settings, overlayWhaleCounterScale: clampNumber(scale, .2, 1.5) } }))} onWhaleCounterStyleChange={(style) => commitState((current) => ({ ...current, settings: { ...current.settings, overlayWhaleCounterStyle: style } }))} onAppearanceChange={(patch) => commitState((current) => ({ ...current, settings: { ...current.settings, ...(patch.shape ? { overlayShape: patch.shape } : {}), ...(patch.counterStyle ? { overlayCounterStyle: patch.counterStyle } : {}), ...(patch.nameMode ? { overlayNameMode: patch.nameMode } : {}), ...(patch.customName !== undefined ? { overlayCustomName: patch.customName.slice(0, 40) } : {}) } }))} onOpenRealOverlay={() => commitState((current) => ({ ...current, settings: { ...current.settings, overlayEnabled: true } }))} />
                <CatalogEditor catalog={state.catalog} onSave={saveCatalog} onPublish={publishCatalog} />
              </> : <div className="creator-login-card"><div className="creator-lock"><LockKeyhole size={25} /></div><div><strong>Acceso privado del propietario</strong><span>{creatorMessage}</span>{!IS_ANDROID && <div className="creator-login-actions"><button type="button" className="primary compact" onClick={() => void startCreatorLogin()}><LogIn size={15} /> Iniciar sesión con GitHub</button><button type="button" className="secondary compact" disabled={creatorAccess === "checking"} onClick={() => void checkCreatorAccess()}><RefreshCw size={15} /> Comprobar cuenta</button></div>}</div></div>}
            </article>}
          </section>
        )}
      </main>
    </div>
  );
}

function ShinyTrackerCard({ record, language, onDecrease, onIncrease, onToggle, onDelete }: { record: ShinyModRecord; language: UiLanguage; onDecrease: () => void; onIncrease: () => void; onToggle: () => void; onDelete: () => void }) {
  const english = language !== "es";
  return <article className={`shiny-tracker-card panel ${record.isShiny ? "obtained" : ""}`}>
    <div className="shiny-tracker-top">
      <span className={`shiny-mod-icon ${record.isShiny ? "module-brillante" : ""}`}><ShinyModuleMark /></span>
      <div><small>{record.groupName}</small><h3>{record.modName}</h3>{record.englishName && <em>{record.englishName}</em>}</div>
      <button type="button" className="shiny-delete" aria-label={`${english ? "Delete" : "Eliminar"} ${record.modName}`} onClick={onDelete}><Trash2 size={15} /></button>
    </div>
    <div className="shiny-variant"><span>{english ? "VARIANT" : "VARIANTE"}</span><strong>{record.variant}</strong></div>
    <div className="shiny-attempt-count"><span>{english ? "Duplicate +17 mods that did not convert" : "Duplicados +17 que no se convirtieron"}</span><strong>{record.attempts}</strong></div>
    {!record.isShiny && <div className="shiny-attempt-actions"><button type="button" aria-label={english ? "Subtract one attempt" : "Restar un intento"} disabled={record.attempts === 0} onClick={onDecrease}><Minus size={17} /></button><button type="button" className="primary" onClick={onIncrease}><Plus size={17} /> {english ? "Another +17 failed" : "Otro +17 no se convirtió"}</button></div>}
    <button type="button" className={`shiny-obtained-button ${record.isShiny ? "active" : ""}`} onClick={onToggle}>{record.isShiny ? <><Check size={17} /> {english ? "Shiny obtained" : "Brillante conseguido"} · {record.obtainedAt ? formatDate(record.obtainedAt, language) : english ? "no date" : "sin fecha"}</> : <><Sparkles size={17} /> {english ? "Mark as Shiny" : "Marcar como Brillante"}</>}</button>
  </article>;
}

export function StartupIntro({ language, onSkip }: { language: UiLanguage; onSkip: () => void }) {
  const english = language !== "es";
  const previewMs = import.meta.env.DEV ? Number(new URLSearchParams(window.location.search).get("intro-preview")) : 0;
  const onSkipRef = useRef(onSkip);
  const [finishing, setFinishing] = useState(false);
  const finish = useCallback(() => setFinishing(true), []);
  onSkipRef.current = onSkip;
  useEffect(() => {
    // Only one chest animates while the full-screen opening hides the dashboard.
    document.documentElement.dataset.introActive = "true";
    return () => { delete document.documentElement.dataset.introActive; };
  }, []);
  useEffect(() => {
    if (previewMs > 0) return;
    const timeout = window.setTimeout(finish, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1_200 : 10_000);
    return () => window.clearTimeout(timeout);
  }, []);
  useEffect(() => {
    if (!finishing || previewMs > 0) return;
    const timer = window.setTimeout(() => onSkipRef.current(), 180);
    return () => window.clearTimeout(timer);
  }, [finishing, previewMs]);
  return <button type="button" className={`startup-intro intro-video-mode ${finishing ? "intro-video-finished" : ""} ${previewMs > 0 ? "intro-preview" : ""}`} style={previewMs > 0 ? { "--intro-preview-time": Math.min(7400, previewMs) } as import("react").CSSProperties : undefined} onClick={onSkip} aria-label={english ? "Skip opening animation" : "Omitir animación de apertura"}>
    <span className="intro-letterbox" aria-hidden="true" />
    <span className="intro-hud" aria-hidden="true"><i /><i /><i /><i /><b>CF–17</b><em>{english ? "PHANTOM ACCESS" : "ACCESO FANTASMA"}</em></span>
    <StartupOpeningVideo previewAtMs={previewMs} onFinished={finish} />
    <span className="intro-title"><small>{english ? "BRILLIANT MODULE · VAULT UNSEALED" : "MÓDULO BRILLANTE · COFRE ABIERTO"}</small><strong>CAJA FANTASMA</strong><em>ONCE HUMAN · TRACKER 17</em></span>
    <span className="intro-progress" aria-hidden="true"><i /></span>
    <span className="intro-hint">{english ? "Tap to continue" : "Pulsa para continuar"}</span>
  </button>;
}

function VisionAtmosphere({ visionId, active }: { visionId?: string; active: boolean }) {
  return <div className="vision-atmosphere" aria-hidden="true">
    <span className="vision-moon" />
    {visionId === "lunar" && active && <img className="lunar-scene-image" src={LUNAR_EVENT_IMAGE} alt="" />}
    {visionId === "symbiosis" && active && <img className="symbiosis-scene-image" src={SYMBIOSIS_EVENT_IMAGE} alt="" />}
    {visionId === "gravity" && active && <span className="gravity-scenes"><img className="gravity-scene-image scene-a" src={GRAVITY_EVENT_IMAGE_A} alt="" /><img className="gravity-scene-image scene-b" src={GRAVITY_EVENT_IMAGE_B} alt="" /></span>}
    {visionId === "gravity" && active && <span className="gravity-floaters"><i /><i /><i /><i /></span>}
  </div>;
}

function ActivityCard({ activity, currentCount, dailyCount, totalCount, language, disabled = false, onAdd, onRemove }: { activity: Activity; currentCount: number; dailyCount: number; totalCount: number; language: UiLanguage; disabled?: boolean; onAdd: () => void; onRemove: () => void }) {
  const english = language !== "es";
  const inactive = disabled || !activity.enabled || activity.points <= 0;
  return (
    <article className={`activity-card ${inactive ? "disabled" : ""}`}>
      <div className="activity-points"><strong>{activity.points}</strong><small>PTS</small></div>
      <div className="activity-copy"><strong>{activity.name}</strong><span>{activity.note ?? (english ? "Claimed reward" : "Recompensa reclamada")}</span></div>
      <div className="activity-counts">
        <div className="activity-counter">
          {currentCount > 0 && <button type="button" aria-label={`${english ? "Remove one" : "Quitar una de"} ${activity.name}`} onClick={onRemove}><Minus size={15} /></button>}
          <span aria-label={`${currentCount} ${english ? "in the current round" : "en la ronda actual"}`}>{currentCount}</span>
          <button type="button" aria-label={`${english ? "Add" : "Sumar"} ${activity.name}`} disabled={inactive} onClick={onAdd}><Plus size={19} /></button>
        </div>
        <small>{english ? "Today" : "Hoy"} {dailyCount} · {english ? "All time" : "Histórico"} {totalCount}</small>
      </div>
    </article>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Box; label: string; value: string }) {
  return <article className="stat-card panel"><Icon size={21} /><span><small>{label}</small><strong>{value}</strong></span></article>;
}

function SettingToggle({ icon: Icon, title, description, enabled, onToggle }: { icon: typeof Box; title: string; description: string; enabled: boolean; onToggle: (enabled: boolean) => void }) {
  const [actual, setActual] = useState(enabled);
  useEffect(() => setActual(enabled), [enabled]);
  return <article className="settings-card panel"><div className="settings-icon"><Icon /></div><div><h3>{title}</h3><p>{description}</p></div><button type="button" className={`switch ${actual ? "on" : ""}`} aria-pressed={actual} onClick={() => { const next = !actual; setActual(next); onToggle(next); }}><span /></button></article>;
}
