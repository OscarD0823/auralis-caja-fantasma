import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Package the recognizable Caja Fantasma identity for every platform.
const root = resolve(import.meta.dirname, "..");
const source = join(root, "src-tauri/icons/source.svg");
// Preserve the original chest artwork across web, PC and Android.
const cli = join(root, "node_modules/@tauri-apps/cli/tauri.js");
const temporary = mkdtempSync(join(tmpdir(), "caja-fantasma-icons-"));
const run = (args) => execFileSync(process.execPath, [cli, "icon", ...args], { cwd: root, stdio: "inherit" });
run([source]);
run([source, "--output", temporary, "--png", "32,192,512"]);
for (const size of [192, 512]) copyFileSync(join(temporary, `${size}x${size}.png`), join(root, `public/icons/app-${size}.png`));
copyFileSync(join(temporary, "32x32.png"), join(root, "public/favicon.png"));
const svg = readFileSync(source, "utf8");
const artwork = svg.slice(svg.indexOf(">") + 1, svg.lastIndexOf("</svg>"));
const maskable = join(root, "public/icons/maskable.svg");
writeFileSync(maskable, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-64 -64 640 640"><rect x="-64" y="-64" width="640" height="640" fill="#07131e"/>${artwork}</svg>\n`);
run([maskable, "--output", join(temporary, "maskable"), "--png", "512"]);
copyFileSync(join(temporary, "maskable/512x512.png"), join(root, "public/icons/app-maskable-512.png"));
console.log("Icons generated from original source: Windows, Android, web and maskable.");
