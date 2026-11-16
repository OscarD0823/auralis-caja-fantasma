export type BrowserToolMode = "counter" | "pointer" | "both";
export type DocumentPip = { window: Window | null; requestWindow: (options: { width: number; height: number; disallowReturnToOpener?: boolean }) => Promise<Window> };

export function browserPictureInPicture(host: Window = window): DocumentPip | undefined {
  const api = (host as Window & { documentPictureInPicture?: DocumentPip }).documentPictureInPicture;
  return host.isSecureContext && typeof api?.requestWindow === "function" ? api : undefined;
}

export function browserToolSize(mode: BrowserToolMode) {
  return mode === "pointer" ? { width: 280, height: 240 } : { width: 380, height: mode === "both" ? 360 : 270 };
}

export function browserToolError(error: unknown, english: boolean) {
  if (error instanceof Error && error.name === "NotAllowedError") return english ? "Click the button again to allow the floating window." : "Pulsa el botón de nuevo para permitir la ventana flotante.";
  return english ? "The browser could not open the floating window. Keep this page open and try again." : "El navegador no pudo abrir la ventana flotante. Mantén esta página abierta e inténtalo otra vez.";
}
