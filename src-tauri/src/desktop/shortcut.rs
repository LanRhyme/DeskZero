use std::path::Path;

pub fn resolve_shortcut(path: &Path) -> Result<String, String> {
    let shortcut = lnk::ShellLink::open(path, lnk::encoding::WINDOWS_1252)
        .map_err(|e| format!("解析快捷方式失败: {}", e))?;
    Ok(shortcut
        .link_target()
        .unwrap_or_default())
}
