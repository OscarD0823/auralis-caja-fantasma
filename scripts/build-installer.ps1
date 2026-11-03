[CmdletBinding()]
param([switch]$Publish, [string]$OutputDirectory = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Version = (Get-Content -Raw (Join-Path $ProjectRoot 'src-tauri\tauri.conf.json') | ConvertFrom-Json).version
$SigningDirectory = if ($env:CAJA_FANTASMA_SIGNING_DIRECTORY) { $env:CAJA_FANTASMA_SIGNING_DIRECTORY } else { Join-Path $env:USERPROFILE '.tauri\caja-fantasma' }
$SigningKeyPath = Join-Path $SigningDirectory 'windows.key'
$SigningPasswordPath = Join-Path $SigningDirectory 'windows.password.dpapi'
$CargoTargetDirectory = if ($env:CARGO_TARGET_DIR) { [IO.Path]::GetFullPath($env:CARGO_TARGET_DIR) } else { Join-Path $ProjectRoot 'src-tauri\target' }
$OutputDirectory = if ($OutputDirectory) { [IO.Path]::GetFullPath($OutputDirectory) } else { Join-Path $ProjectRoot "Entrega\$Version" }
$Node = (Get-Command node.exe -ErrorAction Stop).Source
$TauriCli = Join-Path $ProjectRoot 'node_modules\@tauri-apps\cli\tauri.js'
if (-not (Test-Path -LiteralPath $SigningKeyPath) -or -not (Test-Path -LiteralPath $SigningPasswordPath)) { throw 'Restaura las firmas de Caja Fantasma antes de compilar. Consulta scripts/restore-signing.ps1.' }
$encoded = (Get-Content -Raw -LiteralPath $SigningPasswordPath).Trim()
if ($encoded.Length % 2 -ne 0 -or $encoded -notmatch '^[0-9A-Fa-f]+$') { throw 'Contrasena protegida no valida.' }
$encrypted = New-Object byte[] ($encoded.Length / 2)
for ($i = 0; $i -lt $encrypted.Length; $i++) { $encrypted[$i] = [Convert]::ToByte($encoded.Substring($i * 2, 2), 16) }
$plain = [Security.Cryptography.ProtectedData]::Unprotect($encrypted, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
$env:TAURI_SIGNING_PRIVATE_KEY = $SigningKeyPath
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = [Text.Encoding]::Unicode.GetString($plain)
[Array]::Clear($plain, 0, $plain.Length)
try {
    & $Node $TauriCli build --ci --target x86_64-pc-windows-msvc --bundles nsis -- --locked
    if ($LASTEXITCODE -ne 0) { throw 'Tauri no pudo crear el instalador firmado.' }
    $installer = Get-ChildItem -LiteralPath (Join-Path $CargoTargetDirectory 'x86_64-pc-windows-msvc\release\bundle\nsis') -Filter '*-setup.exe' -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $installer -or -not (Test-Path -LiteralPath ($installer.FullName + '.sig'))) { throw 'Falta el instalador o su firma.' }
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
    $delivered = Join-Path $OutputDirectory "Caja-Fantasma-$Version-Instalador.exe"
    Copy-Item -LiteralPath $installer.FullName -Destination $delivered -Force
    Copy-Item -LiteralPath ($installer.FullName + '.sig') -Destination ($delivered + '.sig') -Force
    $apk = Join-Path $ProjectRoot "Programa\Android\Caja-Fantasma-Android-$Version.apk"
    if (Test-Path -LiteralPath $apk) {
        & $Node (Join-Path $PSScriptRoot 'create-release-manifests.mjs') $OutputDirectory $delivered $apk
        if ($LASTEXITCODE -ne 0) { throw 'No se pudieron preparar ambos canales de actualizacion.' }
    }
    if ($Publish) {
        if (-not (Test-Path -LiteralPath $apk)) { throw 'Falta la APK firmada de esta version.' }
        & gh auth status
        if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI necesita una sesion valida para publicar.' }
        & gh release create "v$Version" $delivered ($delivered + '.sig') $apk (Join-Path $OutputDirectory 'latest-v2.json') (Join-Path $OutputDirectory 'latest.json') (Join-Path $OutputDirectory 'SHA256SUMS.txt') --repo OscarD0823/auralis-caja-fantasma --target main --title "Caja Fantasma v$Version" --notes-file (Join-Path $ProjectRoot "docs\versiones\NOTAS-VERSION-$Version.md")
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo publicar el release.' }
    }
    Write-Host "Instalador firmado: $delivered"
} finally {
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue
}
