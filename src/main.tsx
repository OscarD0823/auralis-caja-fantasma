import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import App from "./App";
import Overlay from "./Overlay";
import PointerOverlay from "./PointerOverlay";
import WhaleVisualHarness from "./WhaleVisualHarness";
import InterfaceVisualHarness from "./InterfaceVisualHarness";
import DirectPeerVisualHarness from "./DirectPeerVisualHarness";
import PhoneBridgeVisualHarness from "./PhoneBridgeVisualHarness";
import "./styles.css";
import "./crateOpening.css";
import "./interface.css";
import "./refinement.css";
import "./chestChoreography.css";
import "./chestPerformance.css";
import "./activityBoard.css";
import "./migration.css";
import { currentChestDetail } from "./chestMotion";

const nativeHost = isTauri();
document.documentElement.dataset.chestDetail = currentChestDetail();
// Stop decorative CSS motion while this surface is hidden, including background Android/web.
const updateMotionVisibility = () => { document.documentElement.dataset.appHidden = String(document.hidden); };
updateMotionVisibility();
document.addEventListener("visibilitychange", updateMotionVisibility);

if (import.meta.env.PROD && !nativeHost && "serviceWorker" in navigator) {
  window.addEventListener("load", () => void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined));
}

if (nativeHost && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))).catch(() => undefined);
    if ("caches" in window) {
      void caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("caja-fantasma-web-")).map((key) => caches.delete(key)))).catch(() => undefined);
    }
  });
}

const label = (() => {
  try {
    return getCurrentWindow().label;
  } catch {
    return "main";
  }
})();

if (label === "pointer") {
  document.documentElement.classList.add("overlay-document");
  document.body.classList.add("overlay-document");
}

const visualWhaleTest = import.meta.env.DEV && new URLSearchParams(window.location.search).has("whale-visual-test");
const visualInterfaceTest = import.meta.env.DEV && new URLSearchParams(window.location.search).has("interface-visual-test");
const directPeerTest = import.meta.env.DEV && new URLSearchParams(window.location.search).has("direct-peer-test");
const phoneBridgeTest = import.meta.env.DEV && new URLSearchParams(window.location.search).has("phone-bridge-test");

createRoot(document.getElementById("root")!).render(
  <StrictMode>{phoneBridgeTest ? <PhoneBridgeVisualHarness /> : directPeerTest ? <DirectPeerVisualHarness /> : visualInterfaceTest ? <InterfaceVisualHarness /> : visualWhaleTest ? <WhaleVisualHarness /> : label === "overlay" ? <Overlay /> : label === "pointer" ? <PointerOverlay /> : <App />}</StrictMode>,
);
