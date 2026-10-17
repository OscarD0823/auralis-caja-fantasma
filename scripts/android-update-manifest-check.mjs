import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { androidUpdateMetadata, LEGACY_APK_PREFIX, validateAndroidUpdate } from "./android-update-manifest.mjs";

const directory = await mkdtemp(join(tmpdir(), "caja-update-test-"));
try {
  const apk = join(directory, "fixture.apk");
  await writeFile(apk, "APK fixture for release metadata regression");
  const expected = await androidUpdateMetadata(apk, "1.23.1");
  const manifest = { version: "1.23.1", android: expected };
  validateAndroidUpdate(manifest, expected);
  // Reproduce the exact installed native guard; a source-only fix would leave
  // old installations unable to reach their Android installer.
  const kotlin = await readFile(new URL("../plugins/android-updater/android/src/main/java/AndroidUpdaterPlugin.kt", import.meta.url), "utf8");
  const installedPrefix = kotlin.match(/!args\.url\.startsWith\("([^"]+)"\)/)?.[1];
  assert.equal(installedPrefix, LEGACY_APK_PREFIX);
  assert(expected.url.startsWith(installedPrefix));
  assert(!expected.url.replace("Caja-Fantasma/", "auralis-caja-fantasma/").startsWith(installedPrefix));
  for (const url of [
    expected.url.replace("Caja-Fantasma/", "auralis-caja-fantasma/"),
    expected.url.replace("github.com/", "github.com.ejemplo.invalid/"),
    expected.url.replace("OscarD0823/", "otro-autor/"),
    expected.url.replace("https:", "http:"),
    `${expected.url}?download=otro`,
  ]) assert.throws(() => validateAndroidUpdate({ ...manifest, android: { ...expected, url } }, expected));
  assert.throws(() => validateAndroidUpdate({ ...manifest, version: "1.23.2" }, expected));
  assert.throws(() => validateAndroidUpdate({ ...manifest, android: { ...expected, sha256: "0".repeat(64) } }, expected));
  assert.throws(() => validateAndroidUpdate({ ...manifest, android: { ...expected, sha256: "invalid" } }, expected));
  await assert.rejects(androidUpdateMetadata(apk, "../../otra"));
  await writeFile(apk, "");
  await assert.rejects(androidUpdateMetadata(apk, "1.23.1"));
  const builder = await readFile(new URL("./build-installer.ps1", import.meta.url), "utf8");
  assert(builder.includes('android-update-manifest.mjs"'));
  assert(builder.includes('& $Node $AndroidManifestTool check $ManifestPath $AndroidApk'));
  console.log("Android update regression OK: legacy clients, repository migration, version and APK integrity.");
} finally {
  await rm(directory, { recursive: true, force: true });
}
