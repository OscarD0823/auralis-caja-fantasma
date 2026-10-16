[CmdletBinding()]
param([string]$OutputDirectory = "")

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Security

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$CargoTargetDirectory = if ($env:CARGO_TARGET_DIR) { [IO.Path]::GetFullPath($env:CARGO_TARGET_DIR) } else { Join-Path $ProjectRoot "src-tauri\target" }
$Version = (Get-Content -Raw (Join-Path $ProjectRoot "src-tauri\tauri.conf.json") | ConvertFrom-Json).version
$SigningDirectory = Join-Path $env:LOCALAPPDATA "Caja Fantasma\signing"
$KeyStore = Join-Path $SigningDirectory "android-release.jks"
$PasswordPath = Join-Path $SigningDirectory "android-release.pass.dpapi"
$OutputDirectory = if ($OutputDirectory) { [IO.Path]::GetFullPath($OutputDirectory) } else { Join-Path $ProjectRoot "Programa\Android" }
$OutputApk = Join-Path $OutputDirectory "Caja-Fantasma-Android-$Version.apk"
$Node = (Get-Command node.exe -ErrorAction Stop).Source
$TauriCli = Join-Path $ProjectRoot "node_modules\@tauri-apps\cli\tauri.js"
$BuildTools = Get-ChildItem (Join-Path $env:LOCALAPPDATA "Android\Sdk\build-tools") -Directory |
    Sort-Object { [Version]$_.Name } -Descending |
    Select-Object -First 1

function Unprotect-Password([string]$encoded) {
    if (-not $encoded -or $encoded.Length % 2 -ne 0 -or $encoded -notmatch '^[0-9A-Fa-f]+$') {
        throw "El archivo de contraseña protegida tiene un formato inválido."
    }
    $encrypted = New-Object byte[] ($encoded.Length / 2)
    for ($index = 0; $index -lt $encrypted.Length; $index++) {
        $encrypted[$index] = [Convert]::ToByte($encoded.Substring($index * 2, 2), 16)
    }
    $plain = [Security.Cryptography.ProtectedData]::Unprotect($encrypted, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    try { return [Text.Encoding]::Unicode.GetString($plain) }
    finally { [Array]::Clear($plain, 0, $plain.Length) }
}

function Get-Sha256Hex([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace("-", "") }
    finally {
        $algorithm.Dispose()
        $stream.Dispose()
    }
}

if (-not (Test-Path -LiteralPath $KeyStore) -or -not (Test-Path -LiteralPath $PasswordPath)) {
    throw "No se encontró la firma privada de Android en $SigningDirectory."
}
if (-not $BuildTools) { throw "No se encontraron Android Build Tools." }

$ZipAlign = Join-Path $BuildTools.FullName "zipalign.exe"
$ApkSigner = Join-Path $BuildTools.FullName "apksigner.bat"
if (-not (Test-Path -LiteralPath $ZipAlign) -or -not (Test-Path -LiteralPath $ApkSigner)) {
    throw "La versión instalada de Android Build Tools no contiene zipalign y apksigner."
}

$BuildStarted = Get-Date
$AndroidStrings = Join-Path $ProjectRoot "src-tauri\gen\android\app\src\main\res\values\strings.xml"
$AndroidProductName = ((Get-Content -Raw (Join-Path $ProjectRoot "src-tauri\tauri.conf.json") | ConvertFrom-Json).productName)
$AndroidProductName = [Security.SecurityElement]::Escape($AndroidProductName)
[IO.File]::WriteAllText($AndroidStrings, "<resources><string name=`"app_name`">$AndroidProductName</string><string name=`"main_activity_title`">$AndroidProductName</string></resources>`n", (New-Object Text.UTF8Encoding($false)))
& $Node $TauriCli icon (Join-Path $ProjectRoot "src-tauri\icons\source.svg")
if ($LASTEXITCODE -ne 0) { throw "No se pudieron generar los iconos de la aplicación." }
# Tauri writes directly to the initialized Android project's resources.
$AndroidIcon = Join-Path $ProjectRoot "src-tauri\gen\android\app\src\main\res\mipmap-xxxhdpi\ic_launcher.png"
if (-not (Test-Path -LiteralPath $AndroidIcon)) { throw "No se generó el icono de Android." }
$PreviousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    $CapturedBuildOutput = & $Node $TauriCli android build --target aarch64 --apk 2>&1
    $BuildExitCode = $LASTEXITCODE
}
finally {
    $ErrorActionPreference = $PreviousErrorActionPreference
}
$CapturedBuildOutput | ForEach-Object { Write-Host $_ }
if ($BuildExitCode -ne 0 -and ($CapturedBuildOutput -join "`n") -notmatch "Creation symbolic link is not allowed") {
    throw "Tauri no pudo compilar la biblioteca Android."
}

$NativeLibrary = Join-Path $CargoTargetDirectory "aarch64-linux-android\release\libcaja_fantasma_once_human_lib.so"
if (-not (Test-Path -LiteralPath $NativeLibrary)) {
    throw "No se encontró la biblioteca ARM64 compilada."
}
if ((Get-Item -LiteralPath $NativeLibrary).LastWriteTime -lt $BuildStarted.AddMinutes(-2)) {
    throw "La biblioteca ARM64 no parece corresponder a esta compilación."
}

$JniDirectory = Join-Path $ProjectRoot "src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a"
New-Item -ItemType Directory -Force -Path $JniDirectory | Out-Null
Copy-Item -LiteralPath $NativeLibrary -Destination (Join-Path $JniDirectory "libcaja_fantasma_once_human_lib.so") -Force

Push-Location (Join-Path $ProjectRoot "src-tauri\gen\android")
try {
    & .\gradlew.bat :app:assembleArm64Release -x :app:rustBuildArm64Release --no-daemon
    if ($LASTEXITCODE -ne 0) { throw "Gradle no pudo crear la APK ARM64." }
}
finally {
    Pop-Location
}

$UnsignedApk = Join-Path $ProjectRoot "src-tauri\gen\android\app\build\outputs\apk\arm64\release\app-arm64-release-unsigned.apk"
if (-not (Test-Path -LiteralPath $UnsignedApk)) { throw "No se encontró la APK sin firmar." }

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$AlignedApk = Join-Path $env:TEMP "caja-fantasma-$Version-aligned-$PID.apk"
$Password = Unprotect-Password (Get-Content -Raw -LiteralPath $PasswordPath).Trim()
$env:CAJA_FANTASMA_ANDROID_STORE_PASSWORD = $Password
try {
    & $ZipAlign -f -p 4 $UnsignedApk $AlignedApk
    if ($LASTEXITCODE -ne 0) { throw "zipalign no pudo alinear la APK." }

    & $ApkSigner sign --ks $KeyStore --ks-key-alias caja-fantasma --ks-pass env:CAJA_FANTASMA_ANDROID_STORE_PASSWORD --key-pass env:CAJA_FANTASMA_ANDROID_STORE_PASSWORD --out $OutputApk $AlignedApk
    if ($LASTEXITCODE -ne 0) { throw "apksigner no pudo firmar la APK." }

    $Verification = & $ApkSigner verify --verbose --print-certs $OutputApk
    if ($LASTEXITCODE -ne 0) { throw "La verificación final de la APK falló." }
    if (($Verification -join "`n") -notmatch "e1f0b63b256b897e0248199a8dfbcc7000df33d3cebc008cf7457365706cfaed") {
        throw "La APK no tiene el certificado de actualización esperado."
    }
}
finally {
    Remove-Item Env:CAJA_FANTASMA_ANDROID_STORE_PASSWORD -ErrorAction SilentlyContinue
    $Password = $null
    if (Test-Path -LiteralPath $AlignedApk) { Remove-Item -LiteralPath $AlignedApk -Force }
}

$Hash = Get-Sha256Hex $OutputApk
[IO.File]::WriteAllText(
    (Join-Path $OutputDirectory "SHA256SUMS.txt"),
    "$Hash  $(Split-Path -Leaf $OutputApk)`r`n",
    (New-Object Text.UTF8Encoding($false))
)
Write-Host "APK firmada y verificada: $OutputApk" -ForegroundColor Green
Write-Host "SHA-256: $Hash" -ForegroundColor Green
