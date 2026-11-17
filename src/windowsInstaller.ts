const REPOSITORY = "https://github.com/OscarD0823/auralis-caja-fantasma";
export const WINDOWS_RELEASE_API = "https://api.github.com/repos/OscarD0823/auralis-caja-fantasma/releases/latest";
export type WindowsInstaller = { version: string; fileName: string; url: string };

// La web puede actualizarse antes que las aplicaciones. Este archivo ya está publicado.
export const PUBLISHED_WINDOWS_INSTALLER: WindowsInstaller = {
  version: "1.29.1",
  fileName: "Caja-Fantasma-1.29.1-Instalador.exe",
  url: `${REPOSITORY}/releases/download/v1.29.1/Caja-Fantasma-1.29.1-Instalador.exe`,
};

export function windowsInstallerFromRelease(value: unknown): WindowsInstaller | undefined {
  if (!value || typeof value !== "object") return undefined;
  const release = value as { draft?: unknown; prerelease?: unknown; tag_name?: unknown; assets?: unknown };
  if (release.draft !== false || release.prerelease !== false || typeof release.tag_name !== "string" || !/^v\d+\.\d+\.\d+$/.test(release.tag_name) || !Array.isArray(release.assets)) return undefined;
  const version = release.tag_name.slice(1);
  const fileName = `Caja-Fantasma-${version}-Instalador.exe`;
  const url = `${REPOSITORY}/releases/download/${release.tag_name}/${fileName}`;
  return release.assets.some(asset => asset && typeof asset === "object" && asset.name === fileName && asset.state === "uploaded" && Number.isFinite(asset.size) && asset.size > 0 && asset.browser_download_url === url) ? { version, fileName, url } : undefined;
}
