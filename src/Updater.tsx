import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import UpdateExperience, { type UpdateStatus } from "./UpdateExperience";
import { runtimePlatform } from "./runtimePlatform";
import type { UiLanguage } from "./i18n";
import { APP_VERSION } from "./model";

type Status = UpdateStatus;
type AndroidRelease = { version: string; notes: string; url: string; sha256: string };
type AndroidInstallResult = { status: "permission-required" | "installer-opened" };

const IS_ANDROID = runtimePlatform(isTauri(), navigator.userAgent) === "android";

function isNewerVersion(candidate: string, current: string) {
  const left = candidate.replace(/^v/i, "").split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
  const right = current.replace(/^v/i, "").split(/[.+-]/).map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if ((left[index] ?? 0) !== (right[index] ?? 0)) return (left[index] ?? 0) > (right[index] ?? 0);
  }
  return false;
}

export default function AppUpdater({ beforeInstall, language = "es" }: { beforeInstall?: () => Promise<void>; language?: UiLanguage }) {
  const beforeInstallRef = useRef(beforeInstall);
  beforeInstallRef.current = beforeInstall;
  const desktopUpdateRef = useRef<Update | null>(null);
  const androidReleaseRef = useRef<AndroidRelease | null>(null);
  const snoozedVersionRef = useRef("");
  const running = useRef(false);
  const checking = useRef(false);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<Status>("downloading");
  const [route, setRoute] = useState({ current: "", next: "" });
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");

  const dismiss = useCallback(() => {
    snoozedVersionRef.current = route.next;
    running.current = false;
    setVisible(false);
  }, [route.next]);

  const install = useCallback(async () => {
    if (running.current) return;

    if (IS_ANDROID) {
      const release = androidReleaseRef.current;
      if (!release) return;
      running.current = true;
      setStatus("downloading");
      setError("");
      setProgress(null);
      try {
        const result = await invoke<AndroidInstallResult>("plugin:android-updater|install", {
          version: release.version,
          url: release.url,
          sha256: release.sha256,
        });
        running.current = false;
        if (result.status === "permission-required") {
          setStatus("permission");
        } else {
          setStatus("confirming");
          setProgress(100);
        }
      } catch (reason) {
        running.current = false;
        setStatus("error");
        setError(reason instanceof Error ? reason.message : String(reason || "No se pudo instalar la actualización de Android."));
      }
      return;
    }

    const update = desktopUpdateRef.current;
    if (!update) return;
    running.current = true;
    setStatus("downloading");
    setError("");
    setProgress(null);
    let downloaded = 0;
    let total = 0;
    try {
      await update.download((event?: DownloadEvent) => {
        if (event?.event === "Started") total = event.data.contentLength ?? 0;
        if (event?.event === "Progress") downloaded += event.data.chunkLength;
        setProgress(event?.event === "Finished" ? 100 : total > 0 ? Math.min(100, Math.round(downloaded / total * 100)) : null);
      }, { timeout: 180_000 });
      setStatus("installing");
      setProgress(100);
      await beforeInstallRef.current?.();
      await update.install();
      setStatus("restarting");
      await relaunch();
    } catch (reason) {
      running.current = false;
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "No se pudo instalar la actualización firmada.");
    }
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (!isTauri() || navigator.onLine === false || checking.current || running.current) return;
    checking.current = true;
    try {
      if (IS_ANDROID) {
        const release = await invoke<AndroidRelease>("plugin:android-updater|check");
        if (!isNewerVersion(release.version, APP_VERSION) || snoozedVersionRef.current === release.version) return;
        androidReleaseRef.current = release;
        setRoute({ current: APP_VERSION, next: release.version });
        setNotes(release.notes || "Incluye mejoras y correcciones.");
        setVisible(true);
        void install();
        return;
      }

      const update = await check({ timeout: 8000 });
      if (!update || snoozedVersionRef.current === update.version) return;
      desktopUpdateRef.current = update;
      setRoute({ current: update.currentVersion, next: update.version });
      setNotes(update.body ?? "Incluye mejoras y correcciones.");
      setVisible(true);
      void install();
    } catch (reason) {
      console.info("[Auralis Caja Fantasma] Comprobación automática aplazada.", reason);
    } finally {
      checking.current = false;
    }
  }, [install]);

  useEffect(() => {
    if (!isTauri()) return;
    const firstCheck = window.setTimeout(() => void checkForUpdate(), 900);
    const periodicCheck = window.setInterval(() => void checkForUpdate(), 15 * 60_000);
    const refresh = () => void checkForUpdate();
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(firstCheck);
      window.clearInterval(periodicCheck);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [checkForUpdate]);

  if (!visible) return null;

  return <UpdateExperience status={status} progress={progress} route={route} notes={notes} error={error} android={IS_ANDROID} language={language} dismiss={dismiss} install={() => void install()} />;
}
