import type { CSSProperties } from "react";
import { Box, GripHorizontal, Music2, X, Zap } from "lucide-react";
import { GRAVITY_EVENT_IMAGE_A, GRAVITY_EVENT_IMAGE_B, GRAVITY_WHALE_BOSS_IMAGE, LUNAR_EVENT_IMAGE, SYMBIOSIS_EVENT_IMAGE } from "./assets";
import type { GravityWhaleSnapshot, OverlayCounterStyle, OverlayNameMode, OverlayShape, Vision, WhaleCounterStyle } from "./model";
import { formatCompactDuration, formatDuration, overlayVisionName } from "./model";
import { OVERLAY_SHAPE_SIZES, OVERLAY_WHALE_WIDTH, overlayDesignSize, whaleCounterLayoutWithinWindow, whaleCounterScaleWithinWindow, whaleScaleWithinWindow } from "./overlayGeometry";

export { OVERLAY_WHALE_HEIGHT, OVERLAY_WHALE_WIDTH, overlayDesignSize, whaleCounterLayoutWithinWindow, whaleCounterScaleWithinWindow, whaleScaleWithinWindow } from "./overlayGeometry";

type Props = {
  vision?: Vision;
  phase: "waiting" | "active";
  remainingMs: number;
  progress: number;
  transitionRemainingMs?: number;
  whale: GravityWhaleSnapshot;
  echoPortalMs?: number;
  addonScale: number;
  whaleCounterScale: number;
  whaleCounterStyle: WhaleCounterStyle;
  whaleShowTime: boolean;
  shape: OverlayShape;
  counterStyle: OverlayCounterStyle;
  nameMode: OverlayNameMode;
  customName: string;
  onClose?: () => void;
  preview?: boolean;
  interactive?: boolean;
};

export default function OverlayVisual({ vision, phase, remainingMs, progress, transitionRemainingMs = 0, whale, echoPortalMs, addonScale, whaleCounterScale, whaleCounterStyle, whaleShowTime, shape, counterStyle, nameMode, customName, onClose, preview = false, interactive = true }: Props) {
  const remainingWhalePercent = Math.max(0, Math.min(100, Math.round((1 - whale.progress) * 100)));
  const beamCounter = whaleCounterStyle === "beam";
  const normalizedAddonScale = whaleScaleWithinWindow(addonScale, shape);
  const normalizedWhaleCounterScale = whaleCounterScaleWithinWindow(whaleCounterScale, shape, whaleCounterStyle);
  const counterCompensation = normalizedWhaleCounterScale / normalizedAddonScale;
  const whaleTimer = whaleCounterStyle === "digital" ? formatDuration(whale.remainingMs) : formatCompactDuration(whale.remainingMs);
  const whaleLayout = whaleCounterLayoutWithinWindow(normalizedAddonScale, normalizedWhaleCounterScale, shape, whaleCounterStyle);
  const eventName = overlayVisionName(vision, nameMode, customName);
  const designSize = OVERLAY_SHAPE_SIZES[shape] ?? OVERLAY_SHAPE_SIZES.event;
  const transitionActive = vision?.cycleConfirmed !== false && transitionRemainingMs > 0;
  const displayedMs = transitionActive ? transitionRemainingMs : remainingMs;
  const cycleReady = vision?.cycleConfirmed !== false;
  const timer = !cycleReady ? "Por confirmar" : counterStyle === "compact" ? formatCompactDuration(displayedMs) : formatDuration(displayedMs);
  const english = nameMode === "english";
  const visualStyle = {
    "--overlay-main-width": `${designSize.width - 8}px`,
    "--overlay-main-height": `${designSize.height - 8}px`,
    "--overlay-progress": `${cycleReady ? Math.round(Math.max(0, Math.min(1, progress)) * 360) : 0}deg`,
  } as CSSProperties;

  return <div style={visualStyle} className={`overlay-visual ${phase} vision-${vision?.id ?? "none"} shape-${shape} counter-${counterStyle} ${transitionActive ? "transitioning" : ""} ${whale.visible ? "with-whale" : ""} ${preview ? "preview" : ""}`}>
    <section className="overlay-main-shell" aria-label="Contador de Rueda Visional">
      <div className="overlay-event-scene" aria-hidden="true">
        {vision?.id === "lunar" && <img className="overlay-scene-image lunar" src={LUNAR_EVENT_IMAGE} alt="" />}
        {vision?.id === "symbiosis" && <img className="overlay-scene-image symbiosis" src={SYMBIOSIS_EVENT_IMAGE} alt="" />}
        {vision?.id === "gravity" && <><img className="overlay-scene-image gravity scene-a" src={GRAVITY_EVENT_IMAGE_A} alt="" /><img className="overlay-scene-image gravity scene-b" src={GRAVITY_EVENT_IMAGE_B} alt="" /></>}
      </div>
      <span className="overlay-event-vignette" aria-hidden="true" />
      <div className="overlay-content">
        <div className="overlay-icon">{phase === "active" ? <Zap size={23} /> : <Box size={23} />}</div>
        <div className="overlay-copy"><span>{!cycleReady ? eventName : transitionActive ? "Preparando próximo contador" : phase === "active" ? `${eventName} activa` : `Próxima ${eventName}`}</span>{counterStyle === "ring" ? <div className="overlay-timer-ring"><strong>{timer}</strong></div> : <strong>{timer}</strong>}</div>
        {interactive && <GripHorizontal className="overlay-grip" size={18} />}
        {interactive && <button type="button" aria-label={preview ? "Vista previa del botón cerrar" : "Cerrar y desactivar contador"} onClick={onClose}><X size={15} /></button>}
      </div>
    </section>

    {echoPortalMs !== undefined && (
      <section className="overlay-echo-stage" aria-label={english ? "Echo portal" : "Portal del Eco"}>
        <Music2 size={14} aria-hidden="true" />
        <span>{english ? "The Echo" : "El Eco"}</span>
        <strong>{echoPortalMs === 0 ? (english ? "Has appeared" : "Ya apareció") : formatDuration(echoPortalMs)}</strong>
      </section>
    )}

    {whale.visible && <section style={{ width: (OVERLAY_WHALE_WIDTH - 8) * normalizedAddonScale, height: whaleShowTime && !beamCounter ? whaleLayout.stageHeight : Math.ceil((150 - 4) * normalizedAddonScale) } as CSSProperties} className={`overlay-whale-stage whale-counter-${whaleCounterStyle} counter-placement-${whaleLayout.placement} ${whaleShowTime ? "with-time" : "beam-only"} ${whale.departing ? "departing" : "engaged"}`} aria-label={whale.departing ? "El Riftwalker se retira" : whaleShowTime ? `Riftwalker activo durante ${formatDuration(whale.remainingMs)}` : "Riftwalker activo con rayo de progreso"}>
      <div className="overlay-whale-canvas" style={{ top: whaleLayout.canvasOffset, transform: `translateX(-50%) scale(${normalizedAddonScale})` }}>
        <div className="overlay-whale-motion">
          <div className="overlay-whale-swimmer">
            <div className="overlay-whale-boss" aria-hidden="true">
              <span className="boss-segment tail"><img src={GRAVITY_WHALE_BOSS_IMAGE} alt="" /></span>
              <span className="boss-segment body"><img src={GRAVITY_WHALE_BOSS_IMAGE} alt="" /></span>
              <span className="boss-segment head"><img src={GRAVITY_WHALE_BOSS_IMAGE} alt="" /></span>
              <span className="boss-energy"><i /><i /><i /></span>
            </div>
            <div className="overlay-whale-beam">
              <span className="overlay-whale-beam-progress" style={{ width: `${remainingWhalePercent}%`, opacity: Math.max(.12, remainingWhalePercent / 100), filter: `brightness(${.45 + remainingWhalePercent / 100})` }} />
              {beamCounter && whaleShowTime && !whale.departing && <strong className="overlay-whale-beam-time">{whaleTimer}</strong>}
            </div>
          </div>
        </div>
        {whaleShowTime && !beamCounter && !whale.departing && <div className={`overlay-whale-countdown ${whaleCounterStyle} placement-${whaleLayout.placement}`} style={{ "--whale-counter-compensation": counterCompensation, "--whale-counter-progress": `${remainingWhalePercent * 3.6}deg`, "--whale-counter-left": `${whaleLayout.left}px`, "--whale-counter-top": `${whaleLayout.top}px` } as CSSProperties}>
          <small>RIFTWALKER</small>
          <strong>{whaleTimer}</strong>
        </div>}
      </div>
    </section>}
  </div>;
}
