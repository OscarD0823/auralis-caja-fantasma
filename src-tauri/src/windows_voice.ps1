$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
$speaker = $null
try {
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    Add-Type -AssemblyName System.Speech
    $speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $culture = [Globalization.CultureInfo]::GetCultureInfo([string]$request.language)
    $voices = @($speaker.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq $culture.TwoLetterISOLanguageName })
    $selected = $voices | Where-Object { $_.VoiceInfo.Culture.Name -eq $culture.Name } | Select-Object -First 1
    if (-not $selected) { $selected = $voices | Select-Object -First 1 }
    if (-not $selected) {
        [Console]::Error.Write('voice-language-missing')
        exit 2
    }
    $speaker.SelectVoice($selected.VoiceInfo.Name)
    $speaker.Rate = -1
    $speaker.Volume = 100
    $speaker.Speak([string]$request.text)
} catch {
    [Console]::Error.Write('voice-playback-failed')
    exit 3
} finally {
    if ($speaker) { $speaker.Dispose() }
}
