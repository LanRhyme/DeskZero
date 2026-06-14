use std::collections::HashMap;

use windows::core::{Interface, GUID};
use windows::Win32::System::Variant::VARIANT;
use windows::Win32::System::Com::{CoInitializeEx, COINIT_APARTMENTTHREADED, CoCreateInstance, CLSCTX_ALL};
use windows::Win32::UI::Shell::{
    IShellWindows, ShellWindows, SWC_DESKTOP, IFolderView,
    SWFO_NEEDDISPATCH, SVGIO_ALLVIEW,
    IShellBrowser, IShellView, IShellFolder, StrRetToBufW, SHGDN_FORPARSING, SHGDN_NORMAL
};
use windows::Win32::UI::Shell::Common::STRRET;
use windows::Win32::System::Com::IServiceProvider;
use windows::Win32::UI::Shell::Common::ITEMIDLIST;
use windows::Win32::UI::WindowsAndMessaging::{
    SystemParametersInfoW, SPI_GETICONMETRICS, ICONMETRICSW, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS
};

pub fn get_desktop_folder_view() -> windows::core::Result<IFolderView> {
    unsafe {
        // 由于 sync_windows_layout 是在 Tauri 的 IPC 线程池中运行的（可能由不同的工作线程执行），
        // 为了保证 COM 调用的线程安全性，必须确保当前线程已初始化 COM 套间。
        // 在同一个线程中重复调用 CoInitializeEx 是安全且廉价的（仅返回 S_FALSE），因此这里在每次调用时都进行初始化。
        let _ = CoInitializeEx(Some(std::ptr::null()), COINIT_APARTMENTTHREADED);

        let shell_windows: IShellWindows = CoCreateInstance(&ShellWindows, None, CLSCTX_ALL)?;
        let mut hwnd = 0;
        let dispatch = shell_windows.FindWindowSW(
            &VARIANT::default(),
            &VARIANT::default(),
            SWC_DESKTOP,
            &mut hwnd,
            SWFO_NEEDDISPATCH,
        )?;

        let service_provider: IServiceProvider = dispatch.cast()?;
        
        let sid_stoplevelbrowser = GUID::from_values(0x000214E2, 0x0000, 0x0000, [0xC0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x46]);
        
        let shell_browser: IShellBrowser = service_provider.QueryService(&sid_stoplevelbrowser)?;
        let shell_view: IShellView = shell_browser.QueryActiveShellView()?;
        let folder_view: IFolderView = shell_view.cast()?;

        Ok(folder_view)
    }
}

pub fn get_windows_desktop_layout() -> Result<HashMap<String, crate::models::container::Position>, String> {
    let folder_view = get_desktop_folder_view().map_err(|e| format!("Failed to get desktop folder view: {}", e))?;
    
    let mut layout = HashMap::new();
    
    unsafe {
        let shell_folder: IShellFolder = folder_view.GetFolder().map_err(|e| format!("Failed to get IShellFolder: {}", e))?;
        let count = folder_view.ItemCount(SVGIO_ALLVIEW).unwrap_or(0);
        for i in 0..count {
            if let Ok(pidl) = folder_view.Item(i) {
                // 获取图标位置
                if let Ok(pt) = folder_view.GetItemPosition(pidl as *const ITEMIDLIST) {
                    let pos = crate::models::container::Position {
                        x: pt.x as f64,
                        y: pt.y as f64,
                    };

                    let mut strret_parsing = STRRET::default();
                    if shell_folder.GetDisplayNameOf(pidl as *const _, SHGDN_FORPARSING, &mut strret_parsing).is_ok() {
                        // 缓冲区从 260 扩大到 1024 以处理超长路径，降低截断匹配失败的风险
                        let mut buf = [0u16; 1024];
                        if StrRetToBufW(&mut strret_parsing, Some(pidl as *const _), &mut buf).is_ok() {
                            let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
                            let path_str = String::from_utf16_lossy(&buf[..len]);
                            
                            // 映射 base64 id
                            use base64::{engine::general_purpose::STANDARD, Engine as _};
                            let id = STANDARD.encode(path_str.as_bytes());
                            layout.insert(id, pos);
                            
                            // 映射文件名
                            let path = std::path::Path::new(&path_str);
                            let is_shortcut = path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("lnk") || ext.eq_ignore_ascii_case("url"));
                            let name = if is_shortcut {
                                path.file_stem().unwrap_or_default().to_string_lossy().to_string()
                            } else {
                                path.file_name().unwrap_or_default().to_string_lossy().to_string()
                            };
                            if !name.is_empty() {
                                layout.insert(name, pos);
                            }
                            
                            // 映射系统图标解析名称
                            if path_str == "::{20D04FE0-3AEA-1069-A2D8-08002B30309D}" {
                                layout.insert("system-this-pc".to_string(), pos);
                            } else if path_str == "::{645FF040-5081-101B-9F08-00AA002F954E}" {
                                layout.insert("system-recycle-bin".to_string(), pos);
                            }
                        }
                    }

                    let mut strret_normal = STRRET::default();
                    if shell_folder.GetDisplayNameOf(pidl as *const _, SHGDN_NORMAL, &mut strret_normal).is_ok() {
                        // 缓冲区从 260 扩大到 1024
                        let mut buf = [0u16; 1024];
                        if StrRetToBufW(&mut strret_normal, Some(pidl as *const _), &mut buf).is_ok() {
                            let len = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
                            let name_str = String::from_utf16_lossy(&buf[..len]);
                            layout.insert(name_str, pos);
                        }
                    }
                }
            }
        }
    }
    
    Ok(layout)
}

pub fn get_windows_grid_metrics() -> Result<(u32, u32), String> {
    unsafe {
        let mut metrics = ICONMETRICSW::default();
        metrics.cbSize = std::mem::size_of::<ICONMETRICSW>() as u32;
        
        let res = SystemParametersInfoW(
            SPI_GETICONMETRICS,
            metrics.cbSize,
            Some(&mut metrics as *mut _ as *mut std::ffi::c_void),
            SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0)
        );
        
        if res.is_ok() {
            // Windows icon metrics gives spacing including the icon itself.
            Ok((metrics.iHorzSpacing.max(1) as u32, metrics.iVertSpacing.max(1) as u32))
        } else {
            Err("Failed to get icon metrics".to_string())
        }
    }
}


