import assert from "node:assert/strict";
import { gravityVoiceMessage, preferredVoice, speakMessage, voiceSchedule, VOICE_MESSAGES } from "../src/voice.ts";
import { UI_LANGUAGES } from "../src/i18n.ts";
import { initialState } from "../src/storage.ts";

const now = Date.parse("2026-11-10T12:00:00Z");
const settings = {
  ...initialState().settings, uiLanguage: "es" as const, selectedVisionId: "gravity",
  phase: "waiting" as const, phaseStartedAt: new Date(now).toISOString(),
  waitMinutes: 30, activeMinutes: 30, voiceLeadMinutes: 5, voiceNotificationsEnabled: true,
};
const schedule = voiceSchedule(settings, now);
assert.equal(schedule.nextStartAt, now + 30 * 60_000);
assert.equal(schedule.repeatMs, 60 * 60_000);
assert.equal(schedule.leadMs, 5 * 60_000);
assert.equal(schedule.language, "es-CO");
assert.equal(voiceSchedule({ ...settings, selectedVisionId: "lunar" }, now).enabled, false);
assert.equal(voiceSchedule({ ...settings, voiceNotificationsEnabled: false }, now).enabled, false);
assert.equal(voiceSchedule({ ...settings, voiceLeadMinutes: 60 }, now).leadMs, 30 * 60_000);
assert.equal(voiceSchedule({ ...settings, phase: "active" }, now).nextStartAt, now + 60 * 60_000);
for (const { code, locale } of UI_LANGUAGES) {
  assert(VOICE_MESSAGES[code].test);
  assert(!gravityVoiceMessage(code, 2).includes("{minutes}"));
  assert.equal(voiceSchedule({ ...settings, uiLanguage: code }, now).language, locale);
}
assert(gravityVoiceMessage("es", 1).endsWith("1 minuto."));
const makeVoice = (lang: string, localService: boolean) => ({ lang, localService }) as SpeechSynthesisVoice;
const localSpanish = makeVoice("es-MX", true);
const onlineColombian = makeVoice("es-CO", false);
const english = makeVoice("en-US", true);
assert.strictEqual(preferredVoice([english, onlineColombian, localSpanish], "es-CO"), localSpanish);
assert.strictEqual(preferredVoice([english, onlineColombian], "es-CO"), onlineColombian);
assert.equal(preferredVoice([english], "es-CO"), undefined);

const saved = new Map(["window", "navigator", "SpeechSynthesisUtterance", "isTauri"].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
type TestUtterance = { onstart?: () => void; onend?: () => void; onerror?: (event: { error: string }) => void; lang: string; rate: number };
const spoken: TestUtterance[] = [];
let behavior = "start";
const fakeWindow = {
  setTimeout, clearTimeout,
  speechSynthesis: {
    paused: false,
    cancel: () => undefined,
    resume: () => undefined,
    getVoices: () => [localSpanish],
    speak: (utterance: TestUtterance) => {
      spoken.push(utterance);
      queueMicrotask(() => {
        if (behavior === "blocked") utterance.onerror?.({ error: "not-allowed" });
        else {
          utterance.onstart?.();
          utterance.onend?.();
        }
      });
    },
  },
  __TAURI_INTERNALS__: undefined as { invoke: (command: string, args: unknown) => Promise<unknown> } | undefined,
};
try {
  Object.defineProperty(globalThis, "window", { configurable: true, value: fakeWindow });
  Object.defineProperty(globalThis, "isTauri", { configurable: true, value: false });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { userAgent: "Browser" } });
  Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { configurable: true, value: class {
    text: string;
    constructor(text: string) { this.text = text; }
  } });
  await speakMessage("Prueba", "es");
  assert.equal(spoken[0].lang, "es-CO");
  assert.equal(spoken[0].rate, 0.92);
  behavior = "blocked";
  await assert.rejects(speakMessage("Bloqueada", "es"), /not-allowed/, "A blocked browser must not report successful playback.");
  const calls: Array<{ command: string; args: unknown }> = [];
  fakeWindow.__TAURI_INTERNALS__ = {
    invoke: async (command, args) => { calls.push({ command, args }); },
  };
  Object.defineProperty(globalThis, "isTauri", { configurable: true, value: true });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { userAgent: "Android" } });
  await speakMessage("Voz nativa", "pt");
  assert.deepEqual(calls, [{ command: "plugin:android-updater|speak", args: { text: "Voz nativa", language: "pt-BR" } }]);
  assert.equal(spoken.length, 2, "Native Android speech must work independently of Web Speech support.");
  fakeWindow.__TAURI_INTERNALS__.invoke = async () => { throw new Error("voice-language-missing"); };
  await assert.rejects(speakMessage("Sin paquete", "pt"), /voice-language-missing/);
} finally {
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
}
console.log("Voice OK: localized timing, browser playback confirmation, errors and native Android routing.");
