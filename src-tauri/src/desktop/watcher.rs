use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::sync::mpsc::{channel, RecvTimeoutError};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const DEBOUNCE_MS: u64 = 300;
const MAX_RETRIES: u32 = 10;
const RETRY_BASE_DELAY_MS: u64 = 1000;

pub fn start_desktop_watcher(app_handle: AppHandle) {
    std::thread::spawn(move || {
        for attempt in 1..=MAX_RETRIES {
            eprintln!("[DeskZero] Starting desktop watcher (attempt {}/{})", attempt, MAX_RETRIES);
            run_watcher_loop(&app_handle);

            if attempt < MAX_RETRIES {
                // Exponential backoff: 1s, 2s, 4s, ... capped at 30s
                let delay = Duration::from_millis((RETRY_BASE_DELAY_MS * 2u64.pow(attempt - 1)).min(30_000));
                eprintln!("[DeskZero] Watcher restarting in {:?}...", delay);
                std::thread::sleep(delay);
            }
        }
        eprintln!("[DeskZero] Watcher failed {} times, giving up.", MAX_RETRIES);
    });
}

/// Runs the watcher event loop until it fails or the channel disconnects.
/// Returns when the caller should recreate the watcher.
fn run_watcher_loop(app_handle: &AppHandle) {
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

    let mut watched_any = false;
    for path in &paths {
        if let Err(e) = watcher.watch(path, RecursiveMode::NonRecursive) {
            eprintln!("[DeskZero] Failed to watch {:?}: {:?}", path, e);
        } else {
            eprintln!("[DeskZero] Watching {:?}", path);
            watched_any = true;
        }
    }

    if !watched_any {
        eprintln!("[DeskZero] No paths to watch, will retry");
        return;
    }

    let debounce = Duration::from_millis(DEBOUNCE_MS);

    loop {
        match rx.recv() {
            Ok(Ok(event)) => {
                if event.kind.is_access() {
                    continue;
                }
            }
            Ok(Err(e)) => {
                eprintln!("[DeskZero] Watch error: {:?}", e);
                continue;
            }
            Err(_) => return, // Channel closed (notify thread crashed), return to trigger retry
        }

        let deadline = Instant::now() + debounce;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                break;
            }
            match rx.recv_timeout(remaining) {
                Ok(_) => {}
                Err(RecvTimeoutError::Timeout) => break,
                Err(RecvTimeoutError::Disconnected) => return,
            }
        }

        let _ = app_handle.emit("desktop-dir-changed", ());
    }
}
