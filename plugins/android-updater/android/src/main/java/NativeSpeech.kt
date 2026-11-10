package com.oscard0823.cajafantasma.updater

import android.content.Context
import android.media.AudioAttributes
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale
import java.util.UUID

internal object NativeSpeech {
    fun speak(
        context: Context,
        text: String,
        language: String,
        started: () -> Unit = {},
        finished: (String?) -> Unit,
    ) {
        val handler = Handler(Looper.getMainLooper())
        handler.post {
            var engine: TextToSpeech? = null
            var completed = false
            lateinit var timeout: Runnable
            fun finish(error: String?) {
                if (completed) return
                completed = true
                handler.removeCallbacks(timeout)
                engine?.shutdown()
                finished(error)
            }
            timeout = Runnable { finish("voice-timeout") }
            handler.postDelayed(timeout, 20_000)
            try {
                engine = TextToSpeech(context.applicationContext) { status ->
                    // Some engines invoke this callback before their constructor returns.
                    handler.post initialize@{
                        if (completed) return@initialize
                        val speech = engine
                        if (status != TextToSpeech.SUCCESS || speech == null) {
                            finish("voice-unavailable")
                            return@initialize
                        }
                        val supported = speech.setLanguage(Locale.forLanguageTag(language))
                        if (supported == TextToSpeech.LANG_MISSING_DATA || supported == TextToSpeech.LANG_NOT_SUPPORTED) {
                            finish("voice-language-missing")
                            return@initialize
                        }
                        speech.setSpeechRate(0.92f)
                        speech.setPitch(1f)
                        speech.setAudioAttributes(AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build())
                        speech.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                            override fun onStart(id: String?) {
                                handler.post { if (!completed) started() }
                            }
                            override fun onDone(id: String?) {
                                handler.post { finish(null) }
                            }
                            @Deprecated("Required by the TTS engine callback")
                            override fun onError(id: String?) {
                                handler.post { finish("voice-playback-failed") }
                            }
                            override fun onError(id: String?, code: Int) {
                                handler.post { finish(if (code == TextToSpeech.ERROR_NOT_INSTALLED_YET) "voice-language-missing" else "voice-playback-failed") }
                            }
                        })
                        if (speech.speak(text, TextToSpeech.QUEUE_FLUSH, null, UUID.randomUUID().toString()) == TextToSpeech.ERROR) {
                            finish("voice-playback-failed")
                        }
                    }
                }
            } catch (_: Exception) {
                finish("voice-unavailable")
            }
        }
    }
}
