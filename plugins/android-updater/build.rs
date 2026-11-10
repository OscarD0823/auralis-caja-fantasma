const COMMANDS: &[&str] = &[
    "check",
    "install",
    "start_background_sync",
    "update_background_sync",
    "read_background_sync",
    "stop_background_sync",
    "speak",
    "configure_voice",
    "request_voice_alarm_permission",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
