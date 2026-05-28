use notify::{RecommendedWatcher, RecursiveMode, Watcher, Config};
use std::sync::mpsc::channel;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub fn start_desktop_watcher(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let (tx, rx) = channel();

        // Create a watcher with a debounce or simple handling
        let mut watcher = match RecommendedWatcher::new(tx, Config::default().with_poll_interval(Duration::from_secs(2))) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("[DeskZero] Failed to create watcher: {:?}", e);
                return;
            }
        };

        // Add desktop directories
        let mut paths = Vec::new();
        if let Some(desktop) = dirs::desktop_dir() {
            paths.push(desktop);
        }
        let public_desktop = std::path::PathBuf::from(r"C:\Users\Public\Desktop");
        if public_desktop.exists() {
            paths.push(public_desktop);
        }

        for path in &paths {
            if let Err(e) = watcher.watch(path, RecursiveMode::NonRecursive) {
                eprintln!("[DeskZero] Failed to watch {:?}: {:?}", path, e);
            } else {
                eprintln!("[DeskZero] Watching {:?}", path);
            }
        }

        // Event loop
        for res in rx {
            match res {
                Ok(event) => {
                    // Check if event is a modification, create, or remove
                    // Avoid emitting on purely access events
                    if event.kind.is_modify() || event.kind.is_create() || event.kind.is_remove() {
                        // debounce slightly or just emit directly since frontend handles debouncing
                        let _ = app_handle.emit("desktop-dir-changed", ());
                    }
                }
                Err(e) => eprintln!("[DeskZero] Watch error: {:?}", e),
            }
        }
    });
}
