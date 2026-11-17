import assert from "node:assert/strict";
import { PUBLISHED_WINDOWS_INSTALLER, windowsInstallerFromRelease } from "../src/windowsInstaller.ts";

const fixture = (version: string) => ({
  tag_name: `v${version}`, draft: false, prerelease: false,
  assets: [{ name: `Caja-Fantasma-${version}-Instalador.exe`, state: "uploaded", size: 16_620_761, browser_download_url: `https://github.com/OscarD0823/auralis-caja-fantasma/releases/download/v${version}/Caja-Fantasma-${version}-Instalador.exe` }],
});
assert.deepEqual(windowsInstallerFromRelease(fixture("1.29.1")), PUBLISHED_WINDOWS_INSTALLER, "A web-only build must link to an installer that has actually been published.");
assert.equal(windowsInstallerFromRelease(fixture("1.30.0"))?.version, "1.30.0", "A later native release must update the download without a hard-coded frontend version.");
const missing = fixture("1.29.2"); missing.assets = [];
assert.equal(windowsInstallerFromRelease(missing), undefined, "Never invent an installer link for a web-only version.");
const wrongRepository = fixture("1.29.1"); wrongRepository.assets[0].browser_download_url = "https://github.com/another-owner/another-app/releases/download/v1.29.1/Caja-Fantasma-1.29.1-Instalador.exe";
assert.equal(windowsInstallerFromRelease(wrongRepository), undefined);
assert.equal(windowsInstallerFromRelease({ ...fixture("1.29.1"), draft: true }), undefined);
assert.equal(windowsInstallerFromRelease({ ...fixture("1.29.1"), prerelease: true }), undefined);
assert.equal(windowsInstallerFromRelease(null), undefined);
console.log("Installer download OK: real published binary, newer native versions, no invented web-version asset, owned repository and published releases only.");
