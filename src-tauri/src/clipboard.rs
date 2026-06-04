use clipboard_win::formats::FileList;
use clipboard_win::Clipboard;

/// 递归复制目录及其所有内容
fn copy_dir_recursive(src: &std::path::Path, dest: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dest)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let dest_path = dest.join(entry.file_name());
        if entry.path().is_dir() {
            copy_dir_recursive(&entry.path(), &dest_path)?;
        } else {
            std::fs::copy(entry.path(), dest_path)?;
        }
    }
    Ok(())
}

/// 递归删除目录（用于跨盘移动后的源目录清理）
fn remove_dir_recursive_safe(path: &std::path::Path) {
    let _ = std::fs::remove_dir_all(path);
}

#[tauri::command]
pub fn copy_files_to_clipboard(paths: Vec<String>) -> Result<(), String> {
    let _clipboard = Clipboard::new_attempts(10).map_err(|e| e.to_string())?;

    // Set file list to clipboard. FileList Setter expects &[T] where T: AsRef<str>
    clipboard_win::Setter::write_clipboard(&FileList, &paths).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_files_from_clipboard() -> Result<Vec<String>, String> {
    // get_clipboard opens the clipboard, reads the format, and closes it.
    let result: Result<Vec<String>, _> =
        clipboard_win::get_clipboard(clipboard_win::formats::FileList);

    match result {
        Ok(paths) => Ok(paths),
        Err(_) => Ok(vec![]),
    }
}

#[tauri::command]
pub fn check_clipboard_has_files() -> Result<bool, String> {
    let result: Result<Vec<String>, _> =
        clipboard_win::get_clipboard(clipboard_win::formats::FileList);
    match result {
        Ok(paths) => Ok(!paths.is_empty()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn paste_files_to_desktop(
    paths: Vec<String>,
    target_dir: String,
) -> Result<Vec<String>, String> {
    if paths.is_empty() {
        return Ok(vec![]);
    }

    let desktop_dir = std::path::PathBuf::from(target_dir);
    let mut created_names = Vec::new();

    // Spawn blocking to avoid blocking the async runtime
    let result = tokio::task::spawn_blocking(move || -> Result<Vec<String>, String> {
        for path_str in paths {
            let src = std::path::Path::new(&path_str);
            if !src.exists() {
                continue;
            }

            if let Some(file_name) = src.file_name() {
                let mut dest = desktop_dir.join(file_name);

                // Handle name collision
                let mut counter = 1;
                let stem = src.file_stem().and_then(|s| s.to_str()).unwrap_or("");
                let ext = src
                    .extension()
                    .and_then(|s| s.to_str())
                    .map(|s| format!(".{}", s))
                    .unwrap_or("".to_string());

                while dest.exists() {
                    dest = desktop_dir.join(format!("{} ({}){}", stem, counter, ext));
                    counter += 1;
                }

                let name_to_return = dest
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();

                if src.is_dir() {
                    if copy_dir_recursive(src, &dest).is_ok() {
                        created_names.push(name_to_return);
                    }
                } else {
                    if std::fs::copy(src, dest).is_ok() {
                        created_names.push(name_to_return);
                    }
                }
            }
        }
        Ok(created_names)
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}

#[tauri::command]
pub async fn move_files_to_dir(
    paths: Vec<String>,
    target_dir: String,
) -> Result<Vec<String>, String> {
    if paths.is_empty() {
        return Ok(vec![]);
    }

    let desktop_dir = std::path::PathBuf::from(target_dir);
    let mut moved_names = Vec::new();

    let result = tokio::task::spawn_blocking(move || -> Result<Vec<String>, String> {
        for path_str in paths {
            let src = std::path::Path::new(&path_str);
            if !src.exists() {
                continue;
            }

            if let Some(file_name) = src.file_name() {
                let mut dest = desktop_dir.join(file_name);
                
                let mut counter = 1;
                let stem = src.file_stem().and_then(|s| s.to_str()).unwrap_or("");
                let ext = src
                    .extension()
                    .and_then(|s| s.to_str())
                    .map(|s| format!(".{}", s))
                    .unwrap_or("".to_string());

                while dest.exists() {
                    dest = desktop_dir.join(format!("{} ({}){}", stem, counter, ext));
                    counter += 1;
                }

                let name_to_return = dest
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();

                if std::fs::rename(src, &dest).is_ok() {
                    moved_names.push(name_to_return);
                } else if src.is_dir() {
                    // 跨盘移动：先递归复制，再删除源目录
                    if copy_dir_recursive(src, &dest).is_ok() {
                        remove_dir_recursive_safe(src);
                        moved_names.push(name_to_return);
                    }
                } else {
                    // 跨盘移动单个文件：先复制，再删除源文件
                    if std::fs::copy(src, &dest).is_ok() {
                        let _ = std::fs::remove_file(src);
                        moved_names.push(name_to_return);
                    }
                }
            }
        }
        Ok(moved_names)
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(result)
}
