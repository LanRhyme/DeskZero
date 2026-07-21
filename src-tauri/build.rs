fn main() {
    // 链接 dwmapi.lib（DWM API 用于消除 Windows 11 隐形边框）
    #[cfg(target_os = "windows")]
    {
        println!("cargo:rustc-link-lib=dylib=dwmapi");
    }
    tauri_build::build()
}
