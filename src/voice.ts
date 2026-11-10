import { invoke, isTauri } from "@tauri-apps/api/core";
import { localeForLanguage, type UiLanguage } from "./i18n.ts";
import { clampNumber, computeCycle, type Settings } from "./model.ts";
import { runtimePlatform } from "./runtimePlatform.ts";

export const VOICE_MESSAGES: Record<UiLanguage, { test: string; alert: string }> = {
  es: { test: "Prueba de voz. El aviso de Gravedad está funcionando.", alert: "Atención. La Rueda Visional de Gravedad comienza en {minutes} minutos." },
  en: { test: "Voice test. The Gravity alert is working.", alert: "Attention. The Gravity Visional Wheel starts in {minutes} minutes." },
  pt: { test: "Teste de voz. O aviso de Gravidade está funcionando.", alert: "Atenção. A Roda Visional de Gravidade começa em {minutes} minutos." },
  fr: { test: "Test vocal. L'alerte de Gravité fonctionne.", alert: "Attention. La Roue visionnelle de Gravité commence dans {minutes} minutes." },
  de: { test: "Sprachtest. Die Schwerkraft-Erinnerung funktioniert.", alert: "Achtung. Das Schwerkraft-Visionsrad beginnt in {minutes} Minuten." },
  it: { test: "Prova vocale. L'avviso Gravità funziona.", alert: "Attenzione. La Ruota visionale di Gravità inizia tra {minutes} minuti." },
  pl: { test: "Test głosu. Alert Grawitacji działa.", alert: "Uwaga. Koło wizji Grawitacji rozpocznie się za {minutes} min." },
  tr: { test: "Ses testi. Yerçekimi bildirimi çalışıyor.", alert: "Dikkat. Yerçekimi Vizyon çarkı {minutes} dakika içinde başlayacak." },
  ru: { test: "Проверка голоса. Оповещение о Гравитации работает.", alert: "Внимание. Колесо видения Гравитации начнётся через {minutes} мин." },
  ja: { test: "音声テストです。重力イベントの音声通知が有効です。", alert: "重力イベントは、あと{minutes}分で始まります。" },
  ko: { test: "음성 테스트입니다. 중력 이벤트 알림이 작동하고 있습니다.", alert: "중력 이벤트가 {minutes}분 후에 시작됩니다." },
  zh: { test: "语音测试。引力活动提醒已启用。", alert: "请注意，引力活动将在{minutes}分钟后开始。" },
};

export type VoiceSchedule = {
  enabled: boolean;
  nextStartAt: number;
  repeatMs: number;
  leadMs: number;
  language: string;
  message: string;
  singularMessage: string;
};

export function voiceSchedule(settings: Settings, now = Date.now()): VoiceSchedule {
  const cycle = computeCycle(settings, now);
  const waitMs = clampNumber(settings.waitMinutes, 1, 525_600) * 60_000;
  const activeMs = clampNumber(settings.activeMinutes, 1, 525_600) * 60_000;
  return {
    enabled: settings.voiceNotificationsEnabled && settings.selectedVisionId === "gravity",
    nextStartAt: Date.parse(cycle.phaseEndsAt) + (cycle.phase === "active" ? waitMs : 0),
    repeatMs: waitMs + activeMs,
    leadMs: Math.min(waitMs, clampNumber(settings.voiceLeadMinutes, 1, 60) * 60_000),
    language: localeForLanguage(settings.uiLanguage),
    message: VOICE_MESSAGES[settings.uiLanguage].alert,
    singularMessage: gravityVoiceMessage(settings.uiLanguage, 1),
  };
}

export function gravityVoiceMessage(language: UiLanguage, minutes: number) {
  const count = Math.max(1, Math.ceil(minutes));
  const message = VOICE_MESSAGES[language].alert.replace("{minutes}", String(count));
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
