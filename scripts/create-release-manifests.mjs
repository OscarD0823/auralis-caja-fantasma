import { createHash } from 'node:crypto';
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { androidUpdateMetadata, validateAndroidUpdate } from './android-update-manifest.mjs';

export function releaseManifests({ version, signature, android, notes, identity, legacy, now = new Date().toISOString() }) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || identity.generation !== 2 || identity.updaterManifest !== 'latest-v2.json') throw new Error('Canal de publicacion no valido.');
  if (!signature.trim() || legacy.version !== identity.legacyVersion || legacy.version === version) throw new Error('La migracion necesita conservar el manifiesto anterior.');
  if (identity.androidApplicationId === 'com.oscard0823.cajafantasma' || !/^[a-f0-9]{64}$/i.test(identity.androidCertificateSha256)) throw new Error('Falta una identidad Android nueva y verificada.');
  validateAndroidUpdate({ version, android }, android);
  const installer = `Caja-Fantasma-${version}-Instalador.exe`;
  const current = {
    version, notes, pub_date: now, signing_generation: 2,
    platforms: { 'windows-x86_64': { signature: signature.trim(), url: `https://github.com/OscarD0823/auralis-caja-fantasma/releases/download/v${version}/${installer}` } },
    android: { ...android, application_id: identity.androidApplicationId, certificate_sha256: identity.androidCertificateSha256 },
  };
  const previous = structuredClone(legacy);
  previous.migration = { version, guide: 'https://oscard0823.github.io/auralis-caja-fantasma/actualizar.html', automatic: false };
  previous.notes += `\nPara pasar a la versión ${version} en Windows, abre Configuración → Windows → Descargar para PC y ejecuta el instalador sobre tu copia actual. Este paso conserva el progreso y se hace una sola vez. Guía: ${previous.migration.guide}\n`;
  return { current, previous };
}

export async function createReleaseManifests(directory, installerPath, apkPath) {
  const root = resolve(import.meta.dirname, '..');
  const info = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const identity = JSON.parse((await readFile(resolve(root, 'release/signing-identity.json'), 'utf8')).replace(/^\uFEFF/, ''));
  const legacy = JSON.parse((await readFile(resolve(root, 'release/legacy-1.23.1.json'), 'utf8')).replace(/^\uFEFF/, ''));
  if (basename(installerPath) !== `Caja-Fantasma-${info.version}-Instalador.exe` || basename(apkPath) !== `Caja-Fantasma-Android-${info.version}.apk`) throw new Error('Los dos instaladores deben corresponder a esta version.');
  const notesPath = resolve(root, `docs/versiones/NOTAS-VERSION-${info.version}.md`);
  const notes = await readFile(notesPath, 'utf8');
  const signature = await readFile(`${installerPath}.sig`, 'utf8');
  const android = await androidUpdateMetadata(apkPath, info.version);
  const { current, previous } = releaseManifests({ version: info.version, signature, android, notes, identity, legacy });
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, 'latest-v2.json'), JSON.stringify(current, null, 2) + '\n');
  await writeFile(resolve(directory, 'latest.json'), JSON.stringify(previous, null, 2) + '\n');
  await copyFile(notesPath, resolve(directory, basename(notesPath)));
  const files = [installerPath, `${installerPath}.sig`, apkPath, resolve(directory, 'latest-v2.json'), resolve(directory, 'latest.json')];
  const sums = await Promise.all(files.map(async file => `${createHash('sha256').update(await readFile(file)).digest('hex').toUpperCase()}  ${basename(file)}`));
  await writeFile(resolve(directory, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
  return { version: info.version, legacyVersion: previous.version, files: files.map(file => basename(file)) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [directory, installer, apk] = process.argv.slice(2);
  if (!directory || !installer || !apk) throw new Error('Uso: create-release-manifests.mjs DIRECTORIO INSTALADOR APK');
  console.log(JSON.stringify(await createReleaseManifests(directory, installer, apk)));
}
