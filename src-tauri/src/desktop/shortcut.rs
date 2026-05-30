use std::path::Path;

pub fn resolve_shortcut(path: &Path) -> Result<String, String> {
    let shortcut = lnk::ShellLink::open(path, lnk::encoding::WINDOWS_1252)
        .map_err(|e| format!("解析快捷方式失败: {}", e))?;
    Ok(shortcut.link_target().unwrap_or_default())
}

pub fn resolve_shortcut_icon(path: &Path) -> Option<String> {
    let shortcut = lnk::ShellLink::open(path, lnk::encoding::WINDOWS_1252).ok()?;

    // Try icon_location first (custom icon set in shortcut properties)
    if let Some(icon_loc) = shortcut.string_data().icon_location() {
        if !icon_loc.is_empty() {
            // Expand environment variables if present
            let expanded = expand_env_vars(icon_loc);
            return Some(expanded);
        }
    }

    // Fall back to link_target
    shortcut.link_target()
}

fn expand_env_vars(path: &str) -> String {
    let mut result = path.to_string();

    let program_files =
        std::env::var("PROGRAMFILES").unwrap_or_else(|_| "C:\\Program Files".to_string());
    let program_files_x86 = std::env::var("PROGRAMFILES(X86)")
        .unwrap_or_else(|_| "C:\\Program Files (x86)".to_string());
    let appdata = std::env::var("APPDATA").unwrap_or_default();
    let localappdata = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let userprofile = std::env::var("USERPROFILE").unwrap_or_default();
    let systemroot = std::env::var("SYSTEMROOT").unwrap_or_else(|_| "C:\\Windows".to_string());

    result = result.replace("%PROGRAMFILES%", &program_files);
    result = result.replace("%PROGRAMFILES(X86)%", &program_files_x86);
    result = result.replace("%APPDATA%", &appdata);
    result = result.replace("%LOCALAPPDATA%", &localappdata);
    result = result.replace("%USERPROFILE%", &userprofile);
    result = result.replace("%SYSTEMROOT%", &systemroot);

    result
}

pub fn resolve_url_icon(path: &Path) -> Option<String> {
    let content = std::fs::read_to_string(path).ok()?;

    for line in content.lines() {
        if let Some(icon_file) = line.strip_prefix("IconFile=") {
            let icon_path = icon_file.trim();
            if !icon_path.is_empty() {
                return Some(icon_path.to_string());
            }
        }
    }

    None
}
