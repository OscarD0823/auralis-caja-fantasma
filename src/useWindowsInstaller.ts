import { useEffect, useState } from "react";
import { PUBLISHED_WINDOWS_INSTALLER, WINDOWS_RELEASE_API, windowsInstallerFromRelease } from "./windowsInstaller";

export function useWindowsInstaller(enabled: boolean) {
  const [installer, setInstaller] = useState(PUBLISHED_WINDOWS_INSTALLER);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let active = true;
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    void fetch(WINDOWS_RELEASE_API, { headers: { Accept: "application/vnd.github+json" }, cache: "no-store", signal: controller.signal })
      .then(response => response.ok ? response.json() : undefined)
      .then(value => { const latest = windowsInstallerFromRelease(value); if (active && latest) setInstaller(latest); })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [enabled]);
  return installer;
}
