use std::path::Path;

#[tauri::command]
pub fn open_file(path: String) -> Result<(), String> {
    opener::open(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_file(path: String, new_name: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        use std::os::windows::ffi::OsStrExt;
        use windows::Win32::UI::Shell::{SHFileOperationW, SHFILEOPSTRUCTW, FO_RENAME, FOF_ALLOWUNDO};
        use windows::core::PCWSTR;
        use windows::Win32::Foundation::HWND;

        let old_path = std::path::Path::new(&path);
        let parent = old_path.parent().ok_or("无法获取父目录")?;
        let new_path = parent.join(&new_name);

        let mut p_from: Vec<u16> = std::ffi::OsStr::new(&path).encode_wide().collect();
        p_from.push(0);
        p_from.push(0);

        let mut p_to: Vec<u16> = std::ffi::OsStr::new(new_path.as_os_str()).encode_wide().collect();
        p_to.push(0);
        p_to.push(0);

        let mut op = SHFILEOPSTRUCTW {
            hwnd: HWND(std::ptr::null_mut()),
            wFunc: FO_RENAME,
            pFrom: PCWSTR(p_from.as_ptr()),
            pTo: PCWSTR(p_to.as_ptr()),
            fFlags: FOF_ALLOWUNDO.0 as u16,
            fAnyOperationsAborted: Default::default(),
            hNameMappings: std::ptr::null_mut(),
            lpszProgressTitle: PCWSTR(std::ptr::null()),
        };

        let res = unsafe { SHFileOperationW(&mut op) };
        if res != 0 {
            return Err(format!("重命名失败，系统返回代码: {}", res));
        }

        Ok(new_path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 永久删除文件/目录（不经回收站）。
/// 前端仅在 Shift+Delete 时调用此命令，普通删除应使用 `trash_file`。
#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let p = std::path::Path::new(&path);
        if p.is_dir() {
            std::fs::remove_dir_all(p).map_err(|e| e.to_string())
        } else {
            std::fs::remove_file(p).map_err(|e| e.to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn trash_file(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        trash::delete(&path).map_err(|e| format!("Failed to move to trash: {}", e))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn move_file(from: String, to: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        std::fs::rename(&from, &to).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn create_folder(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        std::fs::create_dir_all(path).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn create_empty_file(path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        std::fs::File::create(path)
            .map(|_| ())
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn open_terminal(shell: String, path: String) -> Result<(), String> {
    let mut c = std::process::Command::new("cmd");
    c.arg("/c").arg("start");

    if shell.to_lowercase() == "cmd" {
        c.arg("cmd.exe")
            .arg("/K")
            .arg(format!("cd /d \"{}\"", path));
    } else {
        c.arg("powershell.exe")
            .arg("-NoExit")
            .arg("-Command")
            .arg(format!("Set-Location -LiteralPath '{}'", path));
    }

    c.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn read_shortcut_url(path: String) -> Result<String, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    for line in content.lines() {
        if line.starts_with("URL=") {
            return Ok(line.trim_start_matches("URL=").to_string());
        }
    }
    Err("Not a valid URL shortcut".to_string())
}

#[tauri::command]
pub fn run_as_admin(path: String) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOW;
    use windows::core::PCWSTR;

    let path_wide: Vec<u16> = std::ffi::OsStr::new(&path).encode_wide().chain(std::iter::once(0)).collect();
    let verb_wide: Vec<u16> = std::ffi::OsStr::new("runas").encode_wide().chain(std::iter::once(0)).collect();

    unsafe {
        let h_inst = ShellExecuteW(
            None,
            PCWSTR(verb_wide.as_ptr()),
            PCWSTR(path_wide.as_ptr()),
            PCWSTR(std::ptr::null()),
            PCWSTR(std::ptr::null()),
            SW_SHOW,
        );
        if (h_inst.0 as isize) <= 32 {
            return Err(format!("Failed to run as admin, code: {}", h_inst.0 as isize));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn open_file_location(path: String) -> Result<(), String> {
    std::process::Command::new("explorer.exe")
        .arg(format!("/select,\"{}\"", path))
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn open_with_notepad(path: String) -> Result<(), String> {
    std::process::Command::new("notepad.exe")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn show_open_with_dialog(path: String) -> Result<(), String> {
    std::process::Command::new("rundll32.exe")
        .arg("shell32.dll,OpenAs_RunDLL")
        .arg(path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn pin_to_taskbar(path: String) -> Result<(), String> {
    let script = format!(
        "$path = '{}'; $shell = New-Object -ComObject Shell.Application; $folder = $shell.Namespace((Split-Path $path)); $item = $folder.ParseName((Split-Path $path -Leaf)); $item.InvokeVerb('taskbarpin');",
        path.replace("'", "''")
    );
    std::process::Command::new("powershell.exe")
        .arg("-NoProfile")
        .arg("-WindowStyle")
        .arg("Hidden")
        .arg("-Command")
        .arg(&script)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn create_shortcut_item(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    let stem = p.file_stem().unwrap_or_default().to_string_lossy();
    let desktop_dir = dirs::desktop_dir().ok_or("Cannot find desktop dir")?;
    let mut shortcut_path = desktop_dir.join(format!("{} - Shortcut.lnk", stem));
    
    let mut counter = 2;
    while shortcut_path.exists() {
        shortcut_path = desktop_dir.join(format!("{} - Shortcut ({}).lnk", stem, counter));
        counter += 1;
    }
    
    let script = format!(
        "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('{}'); $Shortcut.TargetPath = '{}'; $Shortcut.Save()",
        shortcut_path.to_string_lossy().replace("'", "''"),
        path.replace("'", "''")
    );
    
    std::process::Command::new("powershell.exe")
        .arg("-NoProfile")
        .arg("-WindowStyle")
        .arg("Hidden")
        .arg("-Command")
        .arg(&script)
        .spawn()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub fn show_properties_dialog(path: String) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::Win32::UI::Shell::{SHELLEXECUTEINFOW, ShellExecuteExW, SEE_MASK_INVOKEIDLIST};
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOW;
    use windows::core::PCWSTR;

    let path_wide: Vec<u16> = std::ffi::OsStr::new(&path).encode_wide().chain(std::iter::once(0)).collect();
    let verb_wide: Vec<u16> = std::ffi::OsStr::new("properties").encode_wide().chain(std::iter::once(0)).collect();

    let mut info: SHELLEXECUTEINFOW = unsafe { std::mem::zeroed() };
    info.cbSize = std::mem::size_of::<SHELLEXECUTEINFOW>() as u32;
    info.fMask = SEE_MASK_INVOKEIDLIST;
    info.lpVerb = PCWSTR(verb_wide.as_ptr());
    info.lpFile = PCWSTR(path_wide.as_ptr());
    info.nShow = SW_SHOW.0 as i32;

    unsafe {
        if ShellExecuteExW(&mut info).is_err() {
            return Err("Failed to open properties dialog".to_string());
        }
    }
    Ok(())
}
