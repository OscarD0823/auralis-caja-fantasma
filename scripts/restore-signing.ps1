[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$BackupDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$destination = Join-Path $env:USERPROFILE '.tauri\caja-fantasma'
$project = Split-Path -Parent $PSScriptRoot
$identity = Get-Content -Raw -LiteralPath (Join-Path $project 'release\signing-identity.json') | ConvertFrom-Json
$publicKey = ([IO.File]::ReadAllText((Join-Path $BackupDirectory 'windows.key.pub'))).Trim()
if ($publicKey -ne $identity.windowsPublicKey) { throw 'El respaldo no corresponde a las firmas de esta version.' }
$recovery = Get-Content -Raw -LiteralPath (Join-Path $BackupDirectory 'recuperacion-privada.json') | ConvertFrom-Json
if (-not $recovery.WindowsPassword -or -not $recovery.AndroidPassword) { throw 'Falta una contrasena de recuperacion.' }
foreach ($file in @('windows.key', 'windows.key.pub', 'android-release.jks')) {
    $source = Join-Path $BackupDirectory $file
    $target = Join-Path $destination $file
    if (-not (Test-Path -LiteralPath $source)) { throw "Falta $file en el respaldo." }
    if ((Test-Path -LiteralPath $target) -and (Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $target).Hash) { throw "Ya existe otra firma en $target; se conserva sin reemplazarla." }
}
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$acl = Get-Acl -LiteralPath $destination
if (-not $acl.AreAccessRulesProtected) {
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value, 'S-1-5-18', 'S-1-5-32-544')) {
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($sid)), 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
    }
    Set-Acl -LiteralPath $destination -AclObject $acl
}
foreach ($file in @('windows.key', 'windows.key.pub', 'android-release.jks')) { Copy-Item -LiteralPath (Join-Path $BackupDirectory $file) -Destination (Join-Path $destination $file) -Force }
foreach ($secret in @(@{Name='windows.password.dpapi';Value=$recovery.WindowsPassword}, @{Name='android-release.pass.dpapi';Value=$recovery.AndroidPassword})) {
    $plain = [Text.Encoding]::Unicode.GetBytes($secret.Value)
    try {
        $protected = [Security.Cryptography.ProtectedData]::Protect($plain, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
        [IO.File]::WriteAllText((Join-Path $destination $secret.Name), ([BitConverter]::ToString($protected)).Replace('-', ''))
    } finally { [Array]::Clear($plain, 0, $plain.Length) }
}
Write-Host 'Firmas restauradas para este usuario de Windows. El respaldo original se conserva.'
