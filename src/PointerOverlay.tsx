import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useOverlayInteraction, useOverlayPosition } from "./floatingOverlay";
import type { PersistedState } from "./model";
import { pointerSettings, STORAGE_KEY } from "./storage";

function readColor(text?: string | null) {
  try {
    if (text === undefined) text = localStorage.getItem(STORAGE_KEY);
    return pointerSettings((JSON.parse(text ?? "null") as Partial<PersistedState> | null)?.settings?.pointer).color;
  } catch {
    return pointerSettings().color;
  }
}

export default function PointerOverlay() {
  const [color, setColor] = useState(() => readColor());
  const interactive = useOverlayInteraction();
  useOverlayPosition("pointer");

  useEffect(() => {
    const updateColor = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setColor(readColor(event.newValue));
    };
    window.addEventListener("storage", updateColor);
    return () => window.removeEventListener("storage", updateColor);
  }, []);

  return <div className={`pointer-surface ${interactive ? "editing" : ""}`} onMouseDown={(event) => {
    if (interactive && event.button === 0) void getCurrentWindow().startDragging().catch(() => undefined);
  }}>
    <span className="pointer-dot" style={{ backgroundColor: color }} aria-hidden="true" />
  </div>;
}
