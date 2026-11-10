import { useEffect, useState } from "react";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow, Window } from "@tauri-apps/api/window";
import { loadOverlayPosition, saveOverlayPosition, type PositionedOverlay } from "./storage";

export function useOverlayInteraction() {
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    const overlay = getCurrentWindow();
    let stopped = false;
    let editing = false;
    let lastInteractive = false;
    let revision = 0;
    let main: Window | null = null;
    const unlisteners: (() => void)[] = [];

    const refresh = async () => {
      const request = ++revision;
      let nextInteractive = false;
      if (editing && main) {
        try {
          const [visible, minimized, mainFocused, overlayFocused] = await Promise.all([
            main.isVisible(), main.isMinimized(), main.isFocused(), overlay.isFocused(),
          ]);
          nextInteractive = visible && !minimized && (mainFocused || overlayFocused);
        } catch { /* A window that cannot be checked stays click-through. */ }
      }
      if (stopped || request !== revision || nextInteractive === lastInteractive) return;
      lastInteractive = nextInteractive;
      setInteractive(nextInteractive);
      await overlay.setIgnoreCursorEvents(!nextInteractive).catch(() => undefined);
    };
    const subscribe = async (subscription: Promise<() => void>) => {
      const stop = await subscription;
      if (stopped) stop();
      else unlisteners.push(stop);
    };
    void subscribe(listen<{ enabled: boolean }>("caja-fantasma-overlay-edit-mode", ({ payload }) => {
      editing = payload.enabled;
      void refresh();
    })).catch(() => undefined);
    const start = async () => {
      await overlay.setIgnoreCursorEvents(true);
      if (stopped) return;
      main = await Window.getByLabel("main");
      if (stopped || !main) return;
      await Promise.all([subscribe(main.onFocusChanged(() => void refresh())), subscribe(overlay.onFocusChanged(() => void refresh()))]);
      await refresh();
    };
    void start().catch(() => undefined);
    const timer = window.setInterval(() => { if (editing) void refresh(); }, 2_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      unlisteners.forEach((stop) => stop());
      void overlay.setIgnoreCursorEvents(true).catch(() => undefined);
    };
  }, []);

  return interactive;
}

export function useOverlayPosition(kind: PositionedOverlay) {
  useEffect(() => {
    const overlay = getCurrentWindow();
    let stopped = false;
    let unlisten: (() => void) | undefined;
    let pendingSave = 0;
    const saved = loadOverlayPosition(kind);
    const restoreAndWatch = async () => {
      if (saved) await overlay.setPosition(new PhysicalPosition(saved.x, saved.y)).catch(() => undefined);
      if (stopped) return;
      const stop = await overlay.onMoved(({ payload }) => {
        window.clearTimeout(pendingSave);
        pendingSave = window.setTimeout(() => {
          try { saveOverlayPosition({ x: payload.x, y: payload.y }, kind); } catch { /* Position is a local preference. */ }
        }, 180);
      });
      if (stopped) stop();
      else unlisten = stop;
    };
    void restoreAndWatch().catch(() => undefined);
    return () => {
      stopped = true;
      window.clearTimeout(pendingSave);
      unlisten?.();
    };
  }, [kind]);
}
