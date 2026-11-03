# Firmas y transferencia desde versiones anteriores

Las nuevas firmas pertenecen exclusivamente a Caja Fantasma. Solo las claves publicas y la huella del certificado se incluyen en `release/signing-identity.json`. Las claves privadas quedan fuera del repositorio.

Windows mantiene `com.oscard0823.cajafantasma` y su carpeta de datos. El primer paso a 1.25.0 requiere ejecutar manualmente el instalador nuevo; las versiones ya instaladas no confian en la clave nueva. Desde 1.25.0 se usa `latest-v2.json` para las siguientes actualizaciones.

Android usa `com.oscard0823.auralis.cajafantasma`. Se instala junto a la aplicacion anterior, que conserva su almacenamiento privado. El usuario transfiere su respaldo desde Configuracion, o usa la conexion con PC/web en Dispositivos. No se realiza una desinstalacion automatica.

`release/legacy-1.23.1.json` conserva el ultimo paquete firmado con la clave anterior. Cada release nuevo vuelve a publicar esa informacion como `latest.json`: Windows y Android antiguos siguen recibiendo instaladores compatibles. El enlace Android mantiene el alias `Caja-Fantasma` que validan las APK anteriores al cambio de repositorio.

## Compilar y publicar

1. `scripts/build-installer.ps1` genera Windows y su firma con las claves de Caja Fantasma.
2. El workflow Android genera una APK ARM64 sin acceder a claves privadas. `scripts/build-android.ps1 -UnsignedApk RUTA -BuildToolsDirectory RUTA -JavaHome RUTA` valida su identificador/version, la alinea a 16 KB y la firma localmente.
3. `scripts/create-release-manifests.mjs DIRECTORIO INSTALADOR APK` prepara ambos manifiestos, notas y sumas. Se deben publicar juntos los dos instaladores, `.sig`, `latest-v2.json`, `latest.json` y `SHA256SUMS.txt`.

El respaldo privado incluye las claves cifradas y `recuperacion-privada.json` con las contrasenas portables; todo el directorio es confidencial y tiene permisos limitados. Mantener tambien una copia fuera de este PC. No usar unicamente DPAPI como copia: depende del usuario de Windows. Despues de reinstalar Windows, ejecutar `scripts/restore-signing.ps1 -BackupDirectory RUTA_PRIVADA` desde una consola normal de ese usuario. El script vuelve a proteger las contrasenas con DPAPI y se niega a sustituir claves diferentes ya existentes.

Referencias: [Tauri Updater](https://v2.tauri.app/plugin/updater/) y [Android app signing](https://developer.android.com/studio/publish/app-signing).
