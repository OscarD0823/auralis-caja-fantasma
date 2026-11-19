import type { OverlayShape, WhaleCounterStyle } from "./model";

export const OVERLAY_SHAPE_SIZES: Record<OverlayShape, { width: number; height: number }> = {
  event: { width: 430, height: 108 },
  rectangle: { width: 430, height: 108 },
  square: { width: 238, height: 238 },
  vertical: { width: 198, height: 288 },
  round: { width: 238, height: 238 },
};

export const OVERLAY_WHALE_WIDTH = 520;
export const OVERLAY_WHALE_HEIGHT = 150;
const ECHO_CLOCK_HEIGHT = 32;

export const OVERLAY_WHALE_COUNTER_SIZES: Record<WhaleCounterStyle, { width: number; height: number }> = {
  digital: { width: 142, height: 42 },
  compact: { width: 112, height: 38 },
  ring: { width: 72, height: 72 },
  beam: { width: 160, height: 18 },
};

export type WhaleCounterLayout = {
  placement: "side" | "below";
  left: number;
  top: number;
  canvasOffset: number;
  stageHeight: number;
  counterBounds: { left: number; right: number; top: number; bottom: number };
  bossBounds: { left: number; right: number; top: number; bottom: number };
};

function clampAddonScale(value: number) {
  return Math.max(.2, Math.min(1, Number.isFinite(value) ? value : 1));
}

export function whaleScaleWithinWindow(value: number, shape: OverlayShape = "event") {
  const base = OVERLAY_SHAPE_SIZES[shape] ?? OVERLAY_SHAPE_SIZES.event;
  const maximumScale = Math.min(1, (base.width - 8) / (OVERLAY_WHALE_WIDTH - 8));
  return clampAddonScale(value) * maximumScale;
}

export function whaleCounterScaleWithinWindow(value: number, shape: OverlayShape = "event", style: WhaleCounterStyle = "digital") {
  const base = OVERLAY_SHAPE_SIZES[shape] ?? OVERLAY_SHAPE_SIZES.event;
  const size = OVERLAY_WHALE_COUNTER_SIZES[style] ?? OVERLAY_WHALE_COUNTER_SIZES.digital;
  const requestedScale = Math.max(.2, Math.min(1.5, Number.isFinite(value) ? value : 1));
  return Math.min(requestedScale, (base.width - 16) / size.width);
}

/**
 * Places the Riftwalker clock beside the boss when it fits, or below it when
 * the configured sizes would overlap. All bounds use the final overlay design
 * pixels, so the decision remains correct after the independent scale factors
 * are applied.
 */
export function whaleCounterLayoutWithinWindow(addonScale: number, counterScale: number, shape: OverlayShape, style: WhaleCounterStyle): WhaleCounterLayout {
  const base = OVERLAY_SHAPE_SIZES[shape] ?? OVERLAY_SHAPE_SIZES.event;
  const size = OVERLAY_WHALE_COUNTER_SIZES[style] ?? OVERLAY_WHALE_COUNTER_SIZES.digital;
  const availableHalfWidth = (base.width - 8) / 2;
  const gap = 8;
  const counterWidth = size.width * counterScale;
  const counterHeight = size.height * counterScale;
  const bossLeft = (OVERLAY_WHALE_WIDTH * .03 - OVERLAY_WHALE_WIDTH / 2) * addonScale;
  const bossRight = (OVERLAY_WHALE_WIDTH * .79 - OVERLAY_WHALE_WIDTH / 2) * addonScale;
  const bossTop = 5 * addonScale;
  const bossBottom = 130 * addonScale;
  if (style === "beam") {
    const stageHeight = Math.ceil((OVERLAY_WHALE_HEIGHT - 4) * addonScale);
    return {
      placement: "side",
      left: OVERLAY_WHALE_WIDTH * .69,
      top: 87,
      canvasOffset: 0,
      stageHeight,
      counterBounds: { left: 0, right: 0, top: 0, bottom: 0 },
      bossBounds: { left: bossLeft, right: bossRight, top: bossTop, bottom: bossBottom },
    };
  }
  const sideLeft = bossRight + gap;
  const sideFits = sideLeft + counterWidth <= availableHalfWidth - gap;
  const counterLeft = sideFits ? sideLeft : -counterWidth / 2;
  const counterTop = sideFits ? 91 * addonScale - counterHeight / 2 : bossBottom + gap;
  const canvasOffset = Math.max(0, gap - Math.min(bossTop, counterTop));
  const counterBottom = counterTop + counterHeight;
  const stageHeight = Math.ceil(canvasOffset + Math.max((OVERLAY_WHALE_HEIGHT - 4) * addonScale, counterBottom + gap));

  return {
    placement: sideFits ? "side" : "below",
    left: OVERLAY_WHALE_WIDTH / 2 + counterLeft / addonScale,
    top: counterTop / addonScale,
    canvasOffset,
    stageHeight,
    counterBounds: { left: counterLeft, right: counterLeft + counterWidth, top: counterTop, bottom: counterBottom },
    bossBounds: { left: bossLeft, right: bossRight, top: bossTop, bottom: bossBottom },
  };
}

export function overlayDesignSize(showWhale: boolean, shape: OverlayShape = "event", addonScale = 1, whaleCounterScale = 1, whaleCounterStyle: WhaleCounterStyle = "digital", showWhaleTime = true, showEcho = false) {
  const base = OVERLAY_SHAPE_SIZES[shape] ?? OVERLAY_SHAPE_SIZES.event;
  const height = base.height + (showEcho ? ECHO_CLOCK_HEIGHT : 0);
  if (!showWhale) return { width: base.width, height };
  const normalizedAddonScale = whaleScaleWithinWindow(addonScale, shape);
  const normalizedCounterScale = whaleCounterScaleWithinWindow(whaleCounterScale, shape, whaleCounterStyle);
  const layout = whaleCounterLayoutWithinWindow(normalizedAddonScale, normalizedCounterScale, shape, whaleCounterStyle);
  const whaleStageHeight = showWhaleTime && whaleCounterStyle !== "beam" ? layout.stageHeight : Math.ceil((OVERLAY_WHALE_HEIGHT - 4) * normalizedAddonScale);
  return { width: base.width, height: height + whaleStageHeight };
}
