import { invoke, isTauri } from "@tauri-apps/api/core";
import { localeForLanguage, type UiLanguage } from "./i18n.ts";
import { clampNumber, computeCycle, sharedVisionId, upcomingVision, type Catalog, type Settings } from "./model.ts";
import { runtimePlatform } from "./runtimePlatform.ts";

export const VOICE_MESSAGES: Record<UiLanguage, { test: string; alert: string; gravity: string }> = {
  es: { test: "Prueba de voz. El aviso de la Rueda Visional está funcionando.", alert: "Atención. {vision} comienza en {minutes} minutos.", gravity: "La Rueda Visional de Gravedad" },
  en: { test: "Voice test. The Visional Wheel alert is working.", alert: "Attention. {vision} starts in {minutes} minutes.", gravity: "The Gravity Visional Wheel" },
  pt: { test: "Teste de voz. O aviso da Roda Visional está funcionando.", alert: "Atenção. {vision} começa em {minutes} minutos.", gravity: "A Roda Visional de Gravidade" },
  fr: { test: "Test vocal. L'alerte de la Roue visionnelle fonctionne.", alert: "Attention. {vision} commence dans {minutes} minutes.", gravity: "La Roue visionnelle de Gravité" },
  de: { test: "Sprachtest. Die Erinnerung für das Visionsrad funktioniert.", alert: "Achtung. {vision} beginnt in {minutes} Minuten.", gravity: "Das Schwerkraft-Visionsrad" },
  it: { test: "Prova vocale. L'avviso della Ruota visionale funziona.", alert: "Attenzione. {vision} inizia tra {minutes} minuti.", gravity: "La Ruota visionale di Gravità" },
  pl: { test: "Test głosu. Alert koła wizji działa.", alert: "Uwaga. {vision} rozpocznie się za {minutes} min.", gravity: "Koło wizji Grawitacji" },
  tr: { test: "Ses testi. Vizyon çarkı bildirimi çalışıyor.", alert: "Dikkat. {vision} {minutes} dakika içinde başlayacak.", gravity: "Yerçekimi Vizyon çarkı" },
  ru: { test: "Проверка голоса. Оповещение Колеса видения работает.", alert: "Внимание. {vision} начнётся через {minutes} мин.", gravity: "Колесо видения Гравитации" },
  ja: { test: "音声テストです。ビジョンの音声通知が有効です。", alert: "{vision}は、あと{minutes}分で始まります。", gravity: "重力イベント" },
  ko: { test: "음성 테스트입니다. 비전 이벤트 알림이 작동하고 있습니다.", alert: "{vision} 이벤트가 {minutes}분 후에 시작됩니다.", gravity: "중력" },
  zh: { test: "语音测试。异象活动提醒已启用。", alert: "请注意，{vision}将在{minutes}分钟后开始。", gravity: "引力活动" },
};

export type VoiceSchedule = {
  enabled: boolean;
  nextStartAt: number;
  repeatMs: number;
  leadMs: number;
  language: string;
  message: string;
  singularMessage: string;
  expiresAt: number;
};

export function voiceSchedule(settings: Settings, now = Date.now(), catalog?: Catalog): VoiceSchedule {
  const cycle = computeCycle(settings, now);
  const waitMs = clampNumber(settings.waitMinutes, 1, 525_600) * 60_000;
  const activeMs = clampNumber(settings.activeMinutes, 1, 525_600) * 60_000;
  const nextStartAt = Date.parse(cycle.phaseEndsAt) + (cycle.phase === "active" ? waitMs : 0);
  const expiresAt = catalog ? Date.parse(upcomingVision(catalog, now)?.startsAt ?? "") || 0 : 0;
  const visionId = catalog ? sharedVisionId(catalog, settings.selectedVisionId, now) : settings.selectedVisionId;
  const vision = catalog?.visions.find((entry) => entry.id === visionId);
  const language = settings.uiLanguage;
  const wording = VOICE_MESSAGES[language];
  const visionName = visionId === "resonance"
    ? language === "es" ? vision?.name ?? "Resonancia discordante" : vision?.englishName ?? "Dissonant Resonance"
    : wording.gravity;
  const message = wording.alert.replace("{vision}", visionName);
  return {
    enabled: settings.voiceNotificationsEnabled && (visionId === "gravity" || visionId === "resonance")
      && vision?.cycleConfirmed !== false && (!expiresAt || nextStartAt < expiresAt),
    nextStartAt,
    repeatMs: waitMs + activeMs,
    leadMs: Math.min(waitMs, clampNumber(settings.voiceLeadMinutes, 1, 60) * 60_000),
    language: localeForLanguage(language),
    message,
    singularMessage: formatVoiceMessage(language, message, 1),
    expiresAt,
  };
}

export function formatVoiceMessage(language: UiLanguage, template: string, minutes: number) {
  const count = Math.max(1, Math.ceil(minutes));
  const message = template.replace("{minutes}", String(count));
  if (count !== 1) return message;
  if (language === "es" || language === "pt" || language === "it") return message.replace("minutos", "minuto").replace("minuti", "minuto");
  if (language === "en" || language === "fr") return message.replace("minutes", "minute");
  if (language === "de") return message.replace("Minuten", "Minute");
  return message;
}

export function preferredVoice(voices: readonly SpeechSynthesisVoice[], locale: string) {
  const normalized = locale.toLowerCase().replaceAll("_", "-");
  const primary = normalized.split("-")[0];
  const sameLanguage = voices.filter((voice) => voice.lang.toLowerCase().replaceAll("_", "-").split("-")[0] === primary);
  return sameLanguage.find((voice) => voice.localService && voice.lang.toLowerCase().replaceAll("_", "-") === normalized)
    ?? sameLanguage.find((voice) => voice.localService)
    ?? sameLanguage.find((voice) => voice.lang.toLowerCase().replaceAll("_", "-") === normalized)
    ?? sameLanguage[0];
}

// Retain the utterance until the browser finishes speaking.
let currentUtterance: SpeechSynthesisUtterance | undefined;

export function speakMessage(message: string, language: UiLanguage): Promise<void> {
  const platform = runtimePlatform(isTauri(), navigator.userAgent);
  if (platform === "android") {
    return invoke("plugin:android-updater|speak", { text: message, language: localeForLanguage(language) });
  }
  if (platform === "windows") {
    return invoke("speak_native", { text: message, language: localeForLanguage(language) });
  }
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    return Promise.reject(new Error("voice-unavailable"));
  }
  return new Promise((resolve, reject) => {
    const synthesis = window.speechSynthesis;
    synthesis.cancel();
    if (synthesis.paused) synthesis.resume();
    const utterance = new SpeechSynthesisUtterance(message);
    currentUtterance = utterance;
    utterance.lang = localeForLanguage(language);
    const voice = preferredVoice(synthesis.getVoices(), utterance.lang);
    if (voice) utterance.voice = voice;
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.volume = 1;
    const timer = window.setTimeout(() => {
      if (currentUtterance === utterance) {
        synthesis.cancel();
        currentUtterance = undefined;
      }
      reject(new Error("voice-timeout"));
    }, 10_000);
    utterance.onstart = () => { window.clearTimeout(timer); resolve(); };
    utterance.onend = () => {
      window.clearTimeout(timer);
      if (currentUtterance === utterance) currentUtterance = undefined;
      resolve();
    };
    utterance.onerror = (event) => {
      window.clearTimeout(timer);
      if (currentUtterance === utterance) currentUtterance = undefined;
      reject(new Error(event.error));
    };
    try {
      synthesis.speak(utterance);
    } catch (error) {
      window.clearTimeout(timer);
      if (currentUtterance === utterance) currentUtterance = undefined;
      reject(error);
    }
  });
}
