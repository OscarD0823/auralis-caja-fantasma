use std::{
    io::{Read, Write},
    os::windows::process::CommandExt,
    process::{Command, Stdio},
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

static SPEAKING: AtomicBool = AtomicBool::new(false);

struct SpeechGuard;
impl Drop for SpeechGuard {
    fn drop(&mut self) {
        SPEAKING.store(false, Ordering::Release);
    }
}

pub fn speak(text: &str, language: &str) -> Result<(), String> {
    if text.is_empty()
        || text.chars().count() > 500
        || language.len() > 35
        || language.is_empty()
        || !language
            .chars()
            .all(|character| character.is_ascii_alphabetic() || character == '-')
    {
        return Err("voice-invalid-request".into());
    }
    if SPEAKING.swap(true, Ordering::AcqRel) {
        return Err("voice-busy".into());
    }
    let _guard = SpeechGuard;
    let windows = std::env::var_os("SystemRoot").ok_or("voice-unavailable")?;
    let executable = std::path::PathBuf::from(windows)
        .join("System32")
        .join("WindowsPowerShell")
        .join("v1.0")
        .join("powershell.exe");
    let payload = serde_json::to_vec(&serde_json::json!({ "text": text, "language": language }))
        .map_err(|_| "voice-invalid-request")?;
    let mut child = Command::new(executable)
        .args(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"])
        .arg(include_str!("windows_voice.ps1"))
        .creation_flags(0x08000000)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "voice-unavailable")?;
    if child
        .stdin
        .take()
        .ok_or("voice-unavailable")?
        .write_all(&payload)
        .is_err()
    {
        let _ = child.kill();
        let _ = child.wait();
        return Err("voice-playback-failed".into());
    }
    let started = Instant::now();
    loop {
        if let Some(status) = child.try_wait().map_err(|_| "voice-playback-failed")? {
            if status.success() {
                return Ok(());
            }
            let mut error = String::new();
            if let Some(mut stream) = child.stderr.take() {
                let _ = stream.read_to_string(&mut error);
            }
            return Err(if error.contains("voice-language-missing") {
                "voice-language-missing"
            } else {
                "voice-playback-failed"
            }
            .into());
        }
        if started.elapsed() >= Duration::from_secs(30) {
            let _ = child.kill();
            let _ = child.wait();
            return Err("voice-timeout".into());
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}
