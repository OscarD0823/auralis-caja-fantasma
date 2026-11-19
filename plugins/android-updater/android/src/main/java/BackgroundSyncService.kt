package com.oscard0823.cajafantasma.updater

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import app.tauri.plugin.JSObject
import org.json.JSONObject
import org.json.JSONArray
import java.io.ByteArrayOutputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.time.Instant
import java.util.concurrent.atomic.AtomicBoolean

private const val SYNC_PREFERENCES = "caja_fantasma_background_sync"
private const val DEFAULT_SYNC_PORT = 47_183
private const val MAX_SYNC_BYTES = 8 * 1024 * 1024
private const val MAX_RESPONSE_BYTES = MAX_SYNC_BYTES + 768 * 1024
private const val EXCHANGE_INTERVAL_MS = 1_500L
private const val RETRY_INTERVAL_MS = 4_000L
private const val CONNECTION_TIMEOUT_MS = 4_000
private const val EPOCH_TIMESTAMP = "1970-01-01T00:00:00.000Z"

internal data class SyncConfiguration(
    val address: String,
    val pairingCode: String,
    val dataJson: String,
    val updatedAt: String,
    val knownRevision: Long,
    val eventTimingJson: String,
)

private data class SocketTarget(val host: String, val port: Int)

object BackgroundSyncRuntime {
    private val monitor = Object()

    fun wake() {
        synchronized(monitor) { monitor.notifyAll() }
    }

    fun waitFor(milliseconds: Long) {
        synchronized(monitor) {
            try {
                monitor.wait(milliseconds.coerceAtLeast(100L))
            } catch (_: InterruptedException) {
                Thread.currentThread().interrupt()
            }
        }
    }
}

internal object BackgroundSyncStore {
    private val lock = Any()

    fun validate(args: BackgroundSyncArgs) {
        require(args.address.trim().length in 3..128) { "Escribe la dirección IP y el puerto del PC." }
        require(args.pairingCode.matches(Regex("^\\d{6}$"))) { "El código de conexión debe tener 6 números." }
        require(args.dataJson.toByteArray(StandardCharsets.UTF_8).size <= MAX_SYNC_BYTES) { "Los datos superan el límite de 8 MB." }
        require(isIsoTimestamp(args.updatedAt)) { "La fecha de sincronización no es válida." }
        require(JSONObject(args.dataJson).length() >= 0) { "Los datos personales no son válidos." }
        require(args.eventTimingJson.length <= 8_192) { "Los tiempos de notificación no son válidos." }
        JSONObject(args.eventTimingJson)
        parseTarget(args.address)
    }

    fun configure(context: Context, args: BackgroundSyncArgs, preserveNewerData: Boolean) {
        synchronized(lock) {
            val preferences = context.getSharedPreferences(SYNC_PREFERENCES, Context.MODE_PRIVATE)
            val existingJson = preferences.getString("dataJson", "{}") ?: "{}"
            val existingUpdatedAt = preferences.getString("updatedAt", EPOCH_TIMESTAMP) ?: EPOCH_TIMESTAMP
            val existingActive = preferences.getBoolean("active", false)
            val preserveExisting = existingActive && preserveNewerData && (
                existingUpdatedAt > args.updatedAt ||
                    wouldLoseDurableHistory(existingJson, args.dataJson)
                )
            preferences.edit()
                .putBoolean("active", true)
                .putString("address", args.address.trim())
                .putString("pairingCode", args.pairingCode)
                .putString("eventTimingJson", args.eventTimingJson)
                .putString("dataJson", if (preserveExisting) existingJson else args.dataJson)
                .putString("updatedAt", if (preserveExisting) existingUpdatedAt else args.updatedAt)
                .putLong("revision", if (preserveExisting) preferences.getLong("revision", 0L) else args.knownRevision.coerceAtLeast(preferences.getLong("revision", 0L)))
                .putString("message", "Sincronización en vivo activa · buscando el PC")
                .apply()
        }
    }

    fun setActive(context: Context, active: Boolean) {
        synchronized(lock) {
            context.getSharedPreferences(SYNC_PREFERENCES, Context.MODE_PRIVATE)
                .edit()
                .putBoolean("active", active)
                .putBoolean("connected", false)
                .putString("message", if (active) "Sincronización en vivo activa" else "Sincronización en segundo plano detenida")
                .apply()
        }
    }

    fun isActive(context: Context): Boolean = synchronized(lock) {
        context.getSharedPreferences(SYNC_PREFERENCES, Context.MODE_PRIVATE)
            .getBoolean("active", false)
    }

    fun configuration(context: Context): SyncConfiguration = synchronized(lock) {
        val preferences = context.getSharedPreferences(SYNC_PREFERENCES, Context.MODE_PRIVATE)
        SyncConfiguration(
            address = preferences.getString("address", "") ?: "",
            pairingCode = preferences.getString("pairingCode", "") ?: "",
            dataJson = preferences.getString("dataJson", "{}") ?: "{}",
            updatedAt = preferences.getString("updatedAt", EPOCH_TIMESTAMP) ?: EPOCH_TIMESTAMP,
            knownRevision = preferences.getLong("revision", 0L),
            eventTimingJson = preferences.getString("eventTimingJson", "{}") ?: "{}",
        )
    }

    fun applySuccess(
        context: Context,
        request: SyncConfiguration,
        revision: Long,
        updatedAt: String,
        dataJson: String,
        catalogJson: String,
        lastExchangeAt: Long,
        message: String,
        connectedDevices: String,
    ) {
        synchronized(lock) {
            val preferences = context.getSharedPreferences(SYNC_PREFERENCES, Context.MODE_PRIVATE)
            val dataUnchangedDuringExchange =
                preferences.getString("dataJson", "{}") == request.dataJson &&
                    preferences.getString("updatedAt", EPOCH_TIMESTAMP) == request.updatedAt
            val editor = preferences.edit()
                .putBoolean("connected", true)
                .putLong("revision", revision)
                .putString("catalogJson", catalogJson)
                .putLong("lastExchangeAt", lastExchangeAt)
                .putString("message", message)
                .putString("connectedDevices", connectedDevices)
            if (dataUnchangedDuringExchange && !wouldLoseDurableHistory(request.dataJson, dataJson)) {
                editor.putString("dataJson", dataJson).putString("updatedAt", updatedAt)
            }
            editor.apply()
        }
    }

    fun applyError(context: Context, message: String) {
        synchronized(lock) {
            context.getSharedPreferences(SYNC_PREFERENCES, Context.MODE_PRIVATE)
                .edit()
                .putBoolean("connected", false)
                .putString("message", message)
                .apply()
        }
    }

    fun status(context: Context): JSObject = synchronized(lock) {
        val preferences = context.getSharedPreferences(SYNC_PREFERENCES, Context.MODE_PRIVATE)
        JSObject().apply {
            put("active", preferences.getBoolean("active", false))
            put("connected", preferences.getBoolean("connected", false))
            put("revision", preferences.getLong("revision", 0L))
            put("updatedAt", preferences.getString("updatedAt", EPOCH_TIMESTAMP))
            put("dataJson", preferences.getString("dataJson", "{}"))
            put("catalogJson", preferences.getString("catalogJson", "{}"))
            put("lastExchangeAt", preferences.getLong("lastExchangeAt", 0L))
            put("message", preferences.getString("message", "Sincronización en segundo plano detenida"))
            put("connectedDevices", JSONArray(preferences.getString("connectedDevices", "[]")))
        }
    }

    private fun durableRecordIds(dataJson: String): Set<String> = try {
        val data = JSONObject(dataJson)
        buildSet {
            listOf("activityHistory", "boxes", "pointRounds", "shinyMods", "characters").forEach { field ->
                val records = data.optJSONArray(field) ?: return@forEach
                for (index in 0 until records.length()) {
                    val record = records.optJSONObject(index)
                    val id = record?.optString("id")?.takeIf { it.isNotBlank() }
                        ?: "index-$index:${records.opt(index)}"
                    add("$field:$id")
                }
            }
            val baseline = data.optJSONArray("manualBaselinePoints")
            if (baseline != null) {
                for (index in 0 until baseline.length()) add("manualBaselinePoints:$index:${baseline.opt(index)}")
            }
        }
    } catch (_: Exception) {
        emptySet()
    }

    private fun wouldLoseDurableHistory(currentJson: String, incomingJson: String): Boolean {
        val current = durableRecordIds(currentJson)
        if (current.isEmpty()) return false
        val incoming = durableRecordIds(incomingJson)
        val deletedActionIds = try {
            val deleted = JSONObject(incomingJson).optJSONArray("deletedActionIds")
            buildSet {
                if (deleted != null) {
                    for (index in 0 until deleted.length()) {
                        deleted.optString(index).takeIf { it.isNotBlank() }?.let(::add)
                    }
                }
            }
        } catch (_: Exception) {
            emptySet()
        }
        return current.any { recordId ->
            if (incoming.contains(recordId)) return@any false
            val deletedHistoryId = recordId.removePrefix("activityHistory:")
            !recordId.startsWith("activityHistory:") || deletedHistoryId !in deletedActionIds
        }
    }

    private fun isIsoTimestamp(value: String): Boolean =
        value.matches(Regex("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"))
}

class BackgroundSyncService : Service() {
    private val running = AtomicBoolean(false)
    private var worker: Thread? = null
    private var lastNotificationSignature: String? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            BackgroundSyncStore.setActive(this, false)
            BackgroundSyncRuntime.wake()
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        if (!BackgroundSyncStore.isActive(this)) {
            stopSelf()
            return START_NOT_STICKY
        }

        promoteToForeground(false)
        if (running.compareAndSet(false, true)) {
            worker = Thread({ synchronizationLoop() }, "caja-fantasma-background-sync").apply {
                isDaemon = true
                start()
            }
        } else {
            BackgroundSyncRuntime.wake()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        running.set(false)
        BackgroundSyncRuntime.wake()
        worker?.interrupt()
        worker = null
        if (!BackgroundSyncStore.isActive(this)) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun synchronizationLoop() {
        while (running.get() && BackgroundSyncStore.isActive(this)) {
            val startedAt = SystemClock.elapsedRealtime()
            var connected = false
            try {
                val request = BackgroundSyncStore.configuration(this)
                validateConfiguration(request)
                exchange(request)
                connected = true
            } catch (error: Exception) {
                BackgroundSyncStore.applyError(
                    this,
                    error.message ?: "No se encontró el PC; se volverá a intentar automáticamente.",
                )
            }
            updateNotificationIfNeeded(connected)
            val elapsed = SystemClock.elapsedRealtime() - startedAt
            val interval = if (connected) EXCHANGE_INTERVAL_MS else RETRY_INTERVAL_MS
            BackgroundSyncRuntime.waitFor((interval - elapsed).coerceAtLeast(250L))
        }
        running.set(false)
        if (!BackgroundSyncStore.isActive(this)) {
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
        }
    }

    private fun exchange(request: SyncConfiguration) {
        val target = parseTarget(request.address)
        val address = InetAddress.getByName(target.host)
        require(address.isSiteLocalAddress || address.isLoopbackAddress || address.isLinkLocalAddress) {
            "La sincronización solo acepta direcciones de la red local."
        }
        val payload = JSONObject().apply {
            put("protocol", 2)
            put("clientKind", "mobile")
            put("pairingCode", request.pairingCode)
            put("action", "live")
            put("knownRevision", request.knownRevision)
            put("updatedAt", request.updatedAt)
            put("dataJson", request.dataJson)
        }.toString().toByteArray(StandardCharsets.UTF_8)
        require(payload.size <= MAX_RESPONSE_BYTES) { "La solicitud de sincronización es demasiado grande." }

        Socket().use { socket ->
            socket.connect(InetSocketAddress(address, target.port), CONNECTION_TIMEOUT_MS)
            socket.soTimeout = CONNECTION_TIMEOUT_MS
            val output = socket.getOutputStream().buffered()
            output.write(payload)
            output.write('\n'.code)
            output.flush()
            val responseText = readJsonLine(socket)
            val response = JSONObject(responseText)
            if (!response.optBoolean("ok", false)) {
                throw IllegalStateException(response.optString("message", "El PC rechazó la sincronización."))
            }
            val dataJson = response.getString("dataJson")
            val updatedAt = response.getString("updatedAt")
            val catalogJson = response.optString("catalogJson", "{}")
            require(dataJson.toByteArray(StandardCharsets.UTF_8).size <= MAX_SYNC_BYTES) { "El PC devolvió demasiados datos." }
            require(JSONObject(dataJson).length() >= 0) { "El PC devolvió datos personales inválidos." }
            require(updatedAt.matches(Regex("^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$"))) { "El PC devolvió una fecha inválida." }
            if (catalogJson != "{}") JSONObject(catalogJson)
            BackgroundSyncStore.applySuccess(
                this,
                request,
                response.optLong("revision", request.knownRevision),
                updatedAt,
                dataJson,
                catalogJson,
                response.optLong("lastExchangeAt", System.currentTimeMillis()),
                "PC conectado · datos en vivo al día",
                response.optJSONArray("connectedDevices")?.toString() ?: "[\"pc\",\"mobile\"]",
            )
        }
    }

    private fun readJsonLine(socket: Socket): String {
        val input = socket.getInputStream().buffered()
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8_192)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            var newline = -1
            for (index in 0 until count) {
                if (buffer[index] == '\n'.code.toByte()) {
                    newline = index
                    break
                }
            }
            val accepted = if (newline >= 0) newline else count
            if (output.size() + accepted > MAX_RESPONSE_BYTES) {
                throw IllegalStateException("La respuesta del PC supera el límite permitido.")
            }
            output.write(buffer, 0, accepted)
            if (newline >= 0) break
        }
        require(output.size() > 0) { "El PC cerró la conexión sin responder." }
        return output.toString(StandardCharsets.UTF_8.name())
    }

    private fun validateConfiguration(configuration: SyncConfiguration) {
        require(configuration.pairingCode.matches(Regex("^\\d{6}$"))) { "Abre la app y completa el código de conexión." }
        require(configuration.dataJson.toByteArray(StandardCharsets.UTF_8).size <= MAX_SYNC_BYTES) { "Los datos superan el límite permitido." }
        require(JSONObject(configuration.dataJson).length() >= 0) { "Los datos guardados no son válidos." }
    }

    private fun promoteToForeground(connected: Boolean) {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
        } else {
            0
        }
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(connected),
            type,
        )
        lastNotificationSignature = notificationSignature(connected)
    }

    private fun updateNotificationIfNeeded(connected: Boolean) {
        val signature = notificationSignature(connected)
        if (lastNotificationSignature == signature) return
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, buildNotification(connected))
        lastNotificationSignature = signature
    }

    private fun eventClocks(): EventNotificationClocks? = try {
        val configuration = BackgroundSyncStore.configuration(this)
        val settings = JSONObject(configuration.eventTimingJson)
        val catalog = BackgroundSyncStore.status(this).optString("catalogJson", "{}")
        val published = JSONObject(catalog).optJSONObject("eventTiming")
        // The service also receives administrator timing changes while the UI sleeps.
        val timing = if (published != null && published.optString("updatedAt") >= settings.optString("sharedTimingUpdatedAt")) published else settings
        val selected = timing.optString("selectedVisionId", "gravity")
        val english = settings.optString("uiLanguage", "es") != "es"
        val defaultName = when (selected) {
            "gravity" -> if (english) "Gravity" else "Gravedad"
            "resonance" -> if (english) "Dissonant Resonance" else "Resonancia discordante"
            "lunar" -> "Lunar"
            "symbiosis" -> if (english) "Symbiosis" else "Simbiosis"
            else -> if (english) "Vision" else "Visión"
        }
        notificationClocks(EventTiming(
            selectedVisionId = selected,
            name = defaultName,
            phase = timing.optString("phase", "waiting"),
            startedAt = Instant.parse(timing.getString("phaseStartedAt")).toEpochMilli(),
            waitMs = timing.optLong("waitMinutes", 30).coerceIn(1, 525_600) * 60_000,
            activeMs = timing.optLong("activeMinutes", 30).coerceIn(1, 525_600) * 60_000,
            delayMs = timing.optLong("transitionDelayMilliseconds", 3_000).coerceIn(0, 300_000),
            english = english,
        ), System.currentTimeMillis())
    } catch (_: Exception) { null }

    private fun notificationSignature(connected: Boolean): String = "$connected:${eventClocks()}"

    private fun timerViews(clocks: EventNotificationClocks): RemoteViews {
        val views = RemoteViews(packageName, R.layout.caja_fantasma_event_timers)
        val now = System.currentTimeMillis()
        val elapsedNow = SystemClock.elapsedRealtime()
        fun setClock(labelId: Int, timerId: Int, clock: NotificationClock) {
            views.setTextViewText(labelId, clock.label)
            views.setViewVisibility(timerId, if (clock.endsAt == null) View.GONE else View.VISIBLE)
            views.setBoolean(timerId, "setCountDown", true)
            views.setChronometer(timerId, elapsedNow + ((clock.endsAt ?: now) - now).coerceAtLeast(0), null, clock.endsAt != null)
        }
        setClock(R.id.vision_timer_label, R.id.vision_timer, clocks.vision)
        setClock(R.id.whale_timer_label, R.id.whale_timer, clocks.secondary)
        return views
    }

    private fun buildNotification(connected: Boolean): Notification {
        val openIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentIntent = openIntent?.let {
            PendingIntent.getActivity(
                this,
                0,
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }
        val stopIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, BackgroundSyncService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val builder = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_sync)
            .setContentTitle("Caja Fantasma · Datos en vivo")
            .setContentText(if (connected) "PC conectado; sincronizando en segundo plano" else "Buscando el PC en la red local")
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .addAction(0, "Pausar", stopIntent)
        eventClocks()?.let { clocks ->
            builder.setStyle(NotificationCompat.DecoratedCustomViewStyle())
                .setCustomContentView(timerViews(clocks))
                .setCustomBigContentView(timerViews(clocks))
                .setSubText(if (connected) "Datos en vivo · conectado" else "Datos en vivo · reconectando")
        }
        return builder.build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel(
            NOTIFICATION_CHANNEL_ID,
            "Sincronización con el PC",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Mantiene los datos de Caja Fantasma sincronizados con el PC."
            setSound(null, null)
            enableVibration(false)
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    companion object {
        const val ACTION_START = "com.oscard0823.cajafantasma.action.START_BACKGROUND_SYNC"
        const val ACTION_STOP = "com.oscard0823.cajafantasma.action.STOP_BACKGROUND_SYNC"
        private const val NOTIFICATION_CHANNEL_ID = "caja_fantasma_live_sync"
        private const val NOTIFICATION_ID = 47_183
    }
}

private fun parseTarget(rawAddress: String): SocketTarget {
    val cleaned = rawAddress.trim()
        .removePrefix("http://")
        .removePrefix("https://")
        .trimEnd('/')
    require(cleaned.isNotBlank()) { "Escribe la dirección IP del PC." }
    var host = cleaned
    var port = DEFAULT_SYNC_PORT
    if (cleaned.startsWith("[")) {
        val end = cleaned.indexOf(']')
        require(end > 1) { "La dirección IPv6 no es válida." }
        host = cleaned.substring(1, end)
        if (end + 1 < cleaned.length) {
            require(cleaned[end + 1] == ':') { "El puerto de conexión no es válido." }
            port = cleaned.substring(end + 2).toIntOrNull() ?: throw IllegalArgumentException("El puerto de conexión no es válido.")
        }
    } else if (cleaned.count { it == ':' } == 1) {
        val separator = cleaned.lastIndexOf(':')
        host = cleaned.substring(0, separator)
        port = cleaned.substring(separator + 1).toIntOrNull() ?: throw IllegalArgumentException("El puerto de conexión no es válido.")
    }
    require(port in 1..65_535) { "El puerto de conexión no es válido." }
    val address = InetAddress.getByName(host)
    require(address.isSiteLocalAddress || address.isLoopbackAddress || address.isLinkLocalAddress) {
        "La sincronización solo acepta direcciones de la red local."
    }
    return SocketTarget(host, port)
}
