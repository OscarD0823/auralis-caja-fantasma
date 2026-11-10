package com.oscard0823.cajafantasma.updater

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import app.tauri.plugin.JSObject
import java.util.concurrent.atomic.AtomicBoolean

private const val VOICE_PREFERENCES = "caja_fantasma_voice_alert"
private const val ALARM_REQUEST = 71_270

internal object VoiceAlerts {
    private fun preferences(context: Context) = context.getSharedPreferences(VOICE_PREFERENCES, Context.MODE_PRIVATE)
    private fun manager(context: Context) = context.getSystemService(AlarmManager::class.java)
    fun exactAllowed(context: Context): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || manager(context).canScheduleExactAlarms()
    fun clearError(context: Context) {
        preferences(context).edit().remove("lastError").apply()
    }

    @Synchronized
    fun configure(context: Context, args: VoiceConfigurationArgs): JSObject {
        if (args.enabled) {
            require(args.nextStartAt > 0 && args.repeatMs in 120_000L..63_072_000_000L && args.leadMs in 1L..3_600_000L)
            require(args.language.matches(Regex("^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$")))
            require(args.message.length in 1..500 && args.message.contains("{minutes}"))
            require(args.singularMessage.length in 1..500)
        }
        preferences(context).edit()
            .putBoolean("enabled", args.enabled)
            .putLong("anchor", args.nextStartAt)
            .putLong("repeatMs", args.repeatMs)
            .putLong("leadMs", args.leadMs)
            .putString("language", args.language)
            .putString("message", args.message)
            .putString("singularMessage", args.singularMessage)
            .apply()
        schedule(context)
        return JSObject().apply {
            put("exact", exactAllowed(context))
            put("enabled", args.enabled)
            put("lastError", preferences(context).getString("lastError", ""))
        }
    }

    @Synchronized
    fun schedule(context: Context) {
        val stored = preferences(context)
        val intent = Intent(context, VoiceAlertReceiver::class.java).setAction("com.oscard0823.cajafantasma.VOICE_ALERT")
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        val alarm = manager(context)
        if (!stored.getBoolean("enabled", false)) {
            alarm.cancel(PendingIntent.getBroadcast(context, ALARM_REQUEST, intent, flags))
            return
        }
        val next = nextVoiceAlarm(
            stored.getLong("anchor", 0), stored.getLong("repeatMs", 0),
            stored.getLong("leadMs", 0), stored.getLong("lastAttemptedStart", 0),
            System.currentTimeMillis(),
        )
        stored.edit().putLong("scheduledStart", next.eventStartsAt).apply()
        intent.putExtra("eventStartsAt", next.eventStartsAt)
        val pending = PendingIntent.getBroadcast(context, ALARM_REQUEST, intent, flags)
        if (exactAllowed(context)) {
            try {
                alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.alarmAt, pending)
                return
            } catch (_: SecurityException) {
                // Permission can be withdrawn between the check and scheduling.
            }
        }
        alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.alarmAt, pending)
    }

    @Synchronized
    fun receive(context: Context, intent: Intent, done: () -> Unit) {
        val stored = preferences(context)
        val eventStart = intent.getLongExtra("eventStartsAt", 0)
        val now = System.currentTimeMillis()
        if (!stored.getBoolean("enabled", false) || eventStart != stored.getLong("scheduledStart", 0)) {
            done()
            return
        }
        if (now >= eventStart || eventStart == stored.getLong("lastAttemptedStart", 0)) {
            schedule(context)
            done()
            return
        }
        if (now < eventStart - stored.getLong("leadMs", 0) - 1_000) {
            schedule(context)
            done()
            return
        }
        val minutes = maxOf(1L, (eventStart - now + 59_999) / 60_000)
        val template = stored.getString(if (minutes == 1L) "singularMessage" else "message", "") ?: ""
        val text = template.replace("{minutes}", minutes.toString())
        stored.edit().putLong("lastAttemptedStart", eventStart).apply()
        schedule(context)
        NativeSpeech.speak(
            context, text, stored.getString("language", "es-CO") ?: "es-CO",
            started = {
                stored.edit().putLong("lastSpokenStart", eventStart).remove("lastError").apply()
            },
            finished = { error ->
                if (error != null) stored.edit().putString("lastError", error).apply()
                done()
            },
        )
    }
}

class VoiceAlertReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val result = goAsync()
        val finished = AtomicBoolean(false)
        val done = { if (finished.compareAndSet(false, true)) result.finish() }
        // Release the broadcast within its time limit even if a speech engine stalls.
        Handler(Looper.getMainLooper()).postDelayed({ done() }, 9_000)
        try { VoiceAlerts.receive(context, intent, done) } catch (_: Exception) { done() }
    }
}

class VoiceAlertRestoreReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action !in setOf(
                Intent.ACTION_BOOT_COMPLETED,
                Intent.ACTION_MY_PACKAGE_REPLACED,
                Intent.ACTION_TIME_CHANGED,
                AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED,
            )) return
        try { VoiceAlerts.schedule(context) } catch (_: Exception) { /* The UI can schedule again on its next launch. */ }
    }
}
