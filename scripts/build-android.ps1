[CmdletBinding()]
param([string]$OutputDirectory = '', [string]$UnsignedApk = '', [string]$BuildToolsDirectory = '', [string]$JavaHome = '')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$Version = (Get-Content -Raw (Join-Path $ProjectRoot 'src-tauri\tauri.conf.json') | ConvertFrom-Json).version
$Identity = Get-Content -Raw (Join-Path $ProjectRoot 'release\signing-identity.json') | ConvertFrom-Json
$SigningDirectory = if ($env:CAJA_FANTASMA_SIGNING_DIRECTORY) { $env:CAJA_FANTASMA_SIGNING_DIRECTORY } else { Join-Path $env:USERPROFILE '.tauri\caja-fantasma' }
$KeyStore = Join-Path $SigningDirectory 'android-release.jks'
$PasswordPath = Join-Path $SigningDirectory 'android-release.pass.dpapi'
$OutputDirectory = if ($OutputDirectory) { [IO.Path]::GetFullPath($OutputDirectory) } else { Join-Path $ProjectRoot 'Programa\Android' }
$OutputApk = Join-Path $OutputDirectory "Caja-Fantasma-Android-$Version.apk"
if ($JavaHome) { $env:JAVA_HOME = $JavaHome }
if ($env:JAVA_HOME) { $env:PATH = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:PATH }
if (-not $BuildToolsDirectory) {
    if ($env:ANDROID_BUILD_TOOLS) { $BuildToolsDirectory = $env:ANDROID_BUILD_TOOLS }
    else {
        $sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
        $BuildToolsDirectory = (Get-ChildItem -LiteralPath (Join-Path $sdk 'build-tools') -Directory | Sort-Object { [Version]$_.Name } -Descending | Select-Object -First 1).FullName
    }
}
$ZipAlign = Join-Path $BuildToolsDirectory 'zipalign.exe'
$ApkSigner = Join-Path $BuildToolsDirectory 'apksigner.bat'
$Aapt = Join-Path $BuildToolsDirectory 'aapt2.exe'
foreach ($required in @($KeyStore, $PasswordPath, $ZipAlign, $ApkSigner, $Aapt)) { if (-not (Test-Path -LiteralPath $required)) { throw "Falta una herramienta o firma requerida: $required" } }
if (-not $UnsignedApk) {
    $Node = (Get-Command node.exe -ErrorAction Stop).Source
    $TauriCli = Join-Path $ProjectRoot 'node_modules\@tauri-apps\cli\tauri.js'
    & $Node $TauriCli android init --ci --skip-targets-install
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el proyecto Android.' }
    & $Node $TauriCli android build --ci --target aarch64 --apk
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo compilar la APK sin firmar. Tambien puedes usar el artefacto del workflow Android con -UnsignedApk.' }
    $UnsignedApk = Join-Path $ProjectRoot 'src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release-unsigned.apk'
}
$UnsignedApk = [IO.Path]::GetFullPath($UnsignedApk)
if (-not (Test-Path -LiteralPath $UnsignedApk)) { throw 'No se encontro la APK sin firma.' }
$badging = (& $Aapt dump badging $UnsignedApk 2>&1) -join "`n"
$packageInfo = [regex]::Match($badging, "(?m)^package: name='([^']+)'[^\r\n]*? versionName='([^']+)'")
if ($LASTEXITCODE -ne 0 -or -not $packageInfo.Success) { throw 'No se pudo leer la identidad de la APK.' }
if ($packageInfo.Groups[1].Value -ne $Identity.androidApplicationId -or $packageInfo.Groups[2].Value -ne $Version) { throw 'La APK no corresponde a la identidad nueva y version esperadas.' }
if ($badging -notmatch "native-code:.*'arm64-v8a'") { throw 'La APK no incluye la arquitectura ARM64 requerida.' }
$encoded = (Get-Content -Raw -LiteralPath $PasswordPath).Trim()
if ($encoded.Length % 2 -ne 0 -or $encoded -notmatch '^[0-9A-Fa-f]+$') { throw 'Contrasena protegida no valida.' }
$encrypted = New-Object byte[] ($encoded.Length / 2)
for ($i = 0; $i -lt $encrypted.Length; $i++) { $encrypted[$i] = [Convert]::ToByte($encoded.Substring($i * 2, 2), 16) }
$plain = [Security.Cryptography.ProtectedData]::Unprotect($encrypted, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
$env:CAJA_FANTASMA_ANDROID_STORE_PASSWORD = [Text.Encoding]::Unicode.GetString($plain)
[Array]::Clear($plain, 0, $plain.Length)
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$AlignedApk = Join-Path $OutputDirectory ".caja-fantasma-$Version-aligned-$PID.apk"
try {
    & $ZipAlign -f -P 16 4 $UnsignedApk $AlignedApk
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo alinear la APK.' }
    & $ApkSigner sign --ks $KeyStore --ks-key-alias caja-fantasma --ks-pass env:CAJA_FANTASMA_ANDROID_STORE_PASSWORD --key-pass env:CAJA_FANTASMA_ANDROID_STORE_PASSWORD --out $OutputApk $AlignedApk
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo firmar la APK.' }
    $verification = (& $ApkSigner verify --verbose --print-certs $OutputApk 2>&1) -join "`n"
    if ($LASTEXITCODE -ne 0 -or $verification -notmatch [regex]::Escape($Identity.androidCertificateSha256)) { throw 'La APK no tiene el certificado nuevo esperado.' }
    & $ZipAlign -c -P 16 4 $OutputApk
    if ($LASTEXITCODE -ne 0) { throw 'La alineacion final de la APK no es valida.' }
    $hash = (Get-FileHash -LiteralPath $OutputApk -Algorithm SHA256).Hash
    [IO.File]::WriteAllText((Join-Path $OutputDirectory 'SHA256SUMS.txt'), "$hash  $([IO.Path]::GetFileName($OutputApk))`n", [Text.UTF8Encoding]::new($false))
    Write-Host "APK firmada y verificada: $OutputApk"
} finally {
    Remove-Item Env:CAJA_FANTASMA_ANDROID_STORE_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $AlignedApk -Force -ErrorAction SilentlyContinue
}
