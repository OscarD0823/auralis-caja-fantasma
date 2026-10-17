import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// Installed Android releases validate this exact prefix before following GitHub's
// redirect to the renamed repository. Keep the alias while those clients exist.
export const LEGACY_APK_PREFIX = "https://github.com/OscarD0823/Caja-Fantasma/releases/download/";

export async function androidUpdateMetadata(apkPath, version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("Versión Android inválida.");
  const bytes = await readFile(apkPath);
  if (!bytes.length) throw new Error("La APK está vacía.");
  return {
    url: `${LEGACY_APK_PREFIX}v${version}/Caja-Fantasma-Android-${version}.apk`,
    sha256: createHash("sha256").update(bytes).digest("hex").toUpperCase(),
    architecture: "arm64-v8a",
    minimum_android: 8,
  };
}

export function validateAndroidUpdate(manifest, expected) {
  const url = `${LEGACY_APK_PREFIX}v${manifest.version}/Caja-Fantasma-Android-${manifest.version}.apk`;
  if (manifest.android?.url !== url) {
    throw new Error("La actualización debe conservar el enlace compatible con las APK instaladas antes de Auralis.");
  }
  if (!/^[a-f0-9]{64}$/i.test(manifest.android.sha256 ?? "") ||
      manifest.android.sha256.toUpperCase() !== expected.sha256.toUpperCase()) {
    throw new Error("La suma publicada no corresponde a la APK.");
  }
  if (manifest.android.architecture !== expected.architecture ||
      manifest.android.minimum_android !== expected.minimum_android ||
      manifest.android.url !== expected.url) {
    throw new Error("El manifiesto no corresponde a esta versión de Android.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, file, versionOrApk] = process.argv.slice(2);
  if (command === "create") {
    console.log(JSON.stringify(await androidUpdateMetadata(file, versionOrApk)));
  } else if (command === "check") {
    const manifest = JSON.parse(await readFile(file, "utf8"));
    validateAndroidUpdate(manifest, await androidUpdateMetadata(versionOrApk, manifest.version));
    console.log("Android: enlace compatible y SHA-256 verificados.");
  } else {
    throw new Error("Uso: android-update-manifest.mjs create APK VERSION | check MANIFIESTO APK");
  }
}
