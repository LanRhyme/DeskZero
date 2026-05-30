use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::mpsc::{channel, RecvTimeoutError};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const DEBOUNCE_MS: u64 = 300;

pub fn start_desktop_watcher(app_handle: AppHandle) {
    std::thread::spawn(move || {
        let (tx, rx) = channel();

        let mut watcher = match RecommendedWatcher::new(
            tx,
            Config::default().with_poll_interval(Duration::from_secs(2)),
        ) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("[DeskZero] Failed to create watcher: {:?}", e);
                return;
            }
        };

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

        let debounce = Duration::from_millis(DEBOUNCE_MS);

        loop {
            // Block until first event arrives
            match rx.recv() {
                Ok(Ok(event)) => {
                    if !event.kind.is_modify() && !event.kind.is_create() && !event.kind.is_remove()
                    {
                        continue;
                    }
                }
                Ok(Err(e)) => {
                    eprintln!("[DeskZero] Watch error: {:?}", e);
                    continue;
                }
                Err(_) => break, // Channel closed
            }

            // First relevant event received - now drain any burst events within the debounce window
            let deadline = Instant::now() + debounce;
            loop {
                let remaining = deadline.saturating_duration_since(Instant::now());
                if remaining.is_zero() {
                    break;
                }
                match rx.recv_timeout(remaining) {
                    Ok(_) => {} // Drain and discard - we just want to wait for burst to finish
                    Err(RecvTimeoutError::Timeout) => break,
                    Err(RecvTimeoutError::Disconnected) => return,
                }
            }

            // Debounce window elapsed - emit a single event
            let _ = app_handle.emit("desktop-dir-changed", ());
        }
    });
}
