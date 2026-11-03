package com.oscard0823.cajafantasma.updater

import android.app.Activity
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale

private const val RELEASE_MANIFEST =
    "https://github.com/OscarD0823/Caja-Fantasma/releases/latest/download/latest-v2.json"
private const val APK_MIME = "application/vnd.android.package-archive"
private const val MAX_MANIFEST_BYTES = 1_048_576
private const val MAX_APK_BYTES = 150L * 1_048_576L

@InvokeArg
class InstallArgs {
    lateinit var version: String
    lateinit var url: String
    lateinit var sha256: String
}

@InvokeArg
class BackgroundSyncArgs {
    lateinit var address: String
    lateinit var pairingCode: String
    lateinit var dataJson: String
    lateinit var updatedAt: String
    var knownRevision: Long = 0
    var eventTimingJson: String = "{}"
}

@TauriPlugin
class AndroidUpdaterPlugin(private val activity: Activity) : Plugin(activity) {
    @Command
    fun startBackgroundSync(invoke: Invoke) {
        val args = parseBackgroundSyncArgs(invoke) ?: return
        try {
            BackgroundSyncStore.configure(activity, args, preserveNewerData = true)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
            ) {
                activity.runOnUiThread {
                    ActivityCompat.requestPermissions(
                        activity,
                        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                        BACKGROUND_SYNC_NOTIFICATION_PERMISSION_REQUEST,
                    )
                }
            }
            ContextCompat.startForegroundService(
                activity,
                Intent(activity, BackgroundSyncService::class.java)
                    .setAction(BackgroundSyncService.ACTION_START),
            )
            invoke.resolve(BackgroundSyncStore.status(activity))
        } catch (error: Exception) {
            invoke.reject(error.message ?: "No se pudo iniciar la sincronización en segundo plano.")
        }
    }

    @Command
    fun updateBackgroundSync(invoke: Invoke) {
        val args = parseBackgroundSyncArgs(invoke) ?: return
        try {
            BackgroundSyncStore.configure(activity, args, preserveNewerData = true)
            BackgroundSyncRuntime.wake()
            invoke.resolve(BackgroundSyncStore.status(activity))
        } catch (error: Exception) {
            invoke.reject(error.message ?: "No se pudo actualizar la sincronización en segundo plano.")
        }
    }

    @Command
    fun readBackgroundSync(invoke: Invoke) {
        invoke.resolve(BackgroundSyncStore.status(activity))
    }

    @Command
    fun stopBackgroundSync(invoke: Invoke) {
        BackgroundSyncStore.setActive(activity, false)
        BackgroundSyncRuntime.wake()
        activity.stopService(Intent(activity, BackgroundSyncService::class.java))
        invoke.resolve(BackgroundSyncStore.status(activity))
    }

    @Command
    fun check(invoke: Invoke) {
        Thread {
            try {
                val manifestUrl = "$RELEASE_MANIFEST?ts=${System.currentTimeMillis()}"
                val connection = openVerifiedConnection(manifestUrl, "application/json")
                val body = try {
                    val announcedSize = connection.contentLengthLong
                    if (announcedSize > MAX_MANIFEST_BYTES) {
                        throw IllegalStateException("El manifiesto de actualización es demasiado grande.")
                    }
                    connection.inputStream.buffered().use { input ->
                        readLimited(input, MAX_MANIFEST_BYTES).toString(Charsets.UTF_8)
                    }
                } finally {
                    connection.disconnect()
                }

                val manifest = JSONObject(body)
                val android = manifest.optJSONObject("android")
                    ?: throw IllegalStateException("Esta publicación todavía no contiene una APK actualizable.")
                val result = JSObject().apply {
                    put("version", manifest.getString("version"))
                    put("notes", manifest.optString("notes", "Incluye mejoras y correcciones."))
                    put("url", android.getString("url"))
                    put("sha256", android.getString("sha256").uppercase(Locale.ROOT))
                }
                invoke.resolve(result)
            } catch (error: Exception) {
                invoke.reject(error.message ?: "No se pudo comprobar la actualización de Android.")
            }
        }.apply { name = "caja-fantasma-update-check" }.start()
    }

    @Command
    fun install(invoke: Invoke) {
        val args = try {
            invoke.parseArgs(InstallArgs::class.java)
        } catch (error: Exception) {
            invoke.reject("La información de la actualización no es válida.")
            return
        }

        if (!args.url.startsWith("https://github.com/OscarD0823/Caja-Fantasma/releases/download/")) {
            invoke.reject("La APK no pertenece al repositorio oficial.")
            return
        }
        if (!args.sha256.matches(Regex("^[A-Fa-f0-9]{64}$"))) {
            invoke.reject("La suma SHA-256 publicada no es válida.")
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
            !activity.packageManager.canRequestPackageInstalls()
        ) {
            val settingsIntent = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:${activity.packageName}"),
            )
            activity.runOnUiThread { activity.startActivity(settingsIntent) }
            invoke.resolve(JSObject().apply { put("status", "permission-required") })
            return
        }

        Thread {
            try {
                val updateDirectory = File(activity.cacheDir, "updates").apply { mkdirs() }
                val safeVersion = args.version.replace(Regex("[^0-9A-Za-z._-]"), "-")
                val target = File(updateDirectory, "caja-fantasma-$safeVersion.apk")
                val temporary = File(updateDirectory, "${target.name}.part")
                temporary.delete()

                val digest = MessageDigest.getInstance("SHA-256")
                val connection = openVerifiedConnection(args.url, APK_MIME)
                try {
                    val announcedSize = connection.contentLengthLong
                    if (announcedSize > MAX_APK_BYTES) {
                        throw IllegalStateException("El tamaño anunciado de la APK no es válido.")
                    }
                    connection.inputStream.buffered().use { input ->
                        FileOutputStream(temporary).buffered().use { output ->
                            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                            var total = 0L
                            while (true) {
                                val count = input.read(buffer)
                                if (count < 0) break
                                total += count
                                if (total > MAX_APK_BYTES) {
                                    throw IllegalStateException("La APK supera el límite permitido.")
                                }
                                digest.update(buffer, 0, count)
                                output.write(buffer, 0, count)
                            }
                            if (announcedSize > 0 && total != announcedSize) {
                                throw IllegalStateException("La descarga de la APK quedó incompleta.")
                            }
                        }
                    }
                } finally {
                    connection.disconnect()
                }

                val actualHash = digest.digest().joinToString("") { "%02X".format(it) }
                if (!actualHash.equals(args.sha256, ignoreCase = true)) {
                    temporary.delete()
                    throw SecurityException("La APK descargada no coincide con la suma SHA-256 publicada.")
                }
                if (target.exists() && !target.delete()) {
                    throw IllegalStateException("No se pudo reemplazar la descarga anterior.")
                }
                if (!temporary.renameTo(target)) {
                    throw IllegalStateException("No se pudo preparar la APK verificada.")
                }

                val uri = FileProvider.getUriForFile(
                    activity,
                    "${activity.packageName}.updater.fileprovider",
                    target,
                )
                val installIntent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, APK_MIME)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    putExtra(Intent.EXTRA_NOT_UNKNOWN_SOURCE, true)
                    putExtra(Intent.EXTRA_RETURN_RESULT, false)
                }
                activity.runOnUiThread { activity.startActivity(installIntent) }
                invoke.resolve(JSObject().apply { put("status", "installer-opened") })
            } catch (error: Exception) {
                invoke.reject(error.message ?: "No se pudo descargar e instalar la actualización.")
            }
        }.apply { name = "caja-fantasma-update-download" }.start()
    }

    private fun openVerifiedConnection(source: String, accept: String): HttpURLConnection {
        var current = URL(source)
        repeat(6) {
            if (current.protocol != "https") {
                throw SecurityException("La actualización debe usar una conexión HTTPS.")
            }
            val connection = current.openConnection() as HttpURLConnection
            connection.instanceFollowRedirects = false
            connection.connectTimeout = 12_000
            connection.readTimeout = 180_000
            connection.setRequestProperty("Accept", accept)
            connection.setRequestProperty("Cache-Control", "no-cache")
            connection.setRequestProperty("User-Agent", "Caja-Fantasma-Android-Updater")
            val status = connection.responseCode
            if (status in 300..399) {
                val location = connection.getHeaderField("Location")
                    ?: throw IllegalStateException("GitHub devolvió una redirección incompleta.")
                val next = URL(current, location)
                connection.disconnect()
                current = next
            } else {
                if (status !in 200..299) {
                    connection.disconnect()
                    throw IllegalStateException("GitHub respondió con el código $status.")
                }
                return connection
            }
        }
        throw IllegalStateException("La descarga superó el límite de redirecciones.")
    }

    private fun readLimited(input: InputStream, maximumBytes: Int): ByteArray {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
        var total = 0
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            total += count
            if (total > maximumBytes) {
                throw IllegalStateException("El manifiesto de actualización supera el límite permitido.")
            }
            output.write(buffer, 0, count)
        }
        return output.toByteArray()
    }

    private fun parseBackgroundSyncArgs(invoke: Invoke): BackgroundSyncArgs? {
        val args = try {
            invoke.parseArgs(BackgroundSyncArgs::class.java)
        } catch (_: Exception) {
            invoke.reject("La configuración de sincronización no es válida.")
            return null
        }
        return try {
            BackgroundSyncStore.validate(args)
            args
        } catch (error: Exception) {
            invoke.reject(error.message ?: "La configuración de sincronización no es válida.")
            null
        }
    }

    companion object {
        private const val BACKGROUND_SYNC_NOTIFICATION_PERMISSION_REQUEST = 47183
    }
}

class UpdaterFileProvider : FileProvider()
