use std::ffi::c_void;
use std::sync::Mutex;
use std::time::Duration;
use windows::core::{w, PCWSTR, PWSTR};
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::RemoteDesktop::{WTSGetActiveConsoleSessionId, WTSQueryUserToken};
use windows::Win32::Security::{DuplicateTokenEx, SecurityIdentification, TokenPrimary, TOKEN_ALL_ACCESS};
use windows::Win32::System::Environment::{CreateEnvironmentBlock, DestroyEnvironmentBlock};
use windows::Win32::System::Threading::{
    CreateProcessAsUserW, GetExitCodeProcess, TerminateProcess, PROCESS_INFORMATION,
    STARTUPINFOW, CREATE_UNICODE_ENVIRONMENT, CREATE_NO_WINDOW,
};
use windows_service::{
    define_windows_service,
    service::{
        ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
        ServiceType, SessionChangeReason,
    },
    service_control_handler::{self, ServiceControlHandlerResult},
    service_dispatcher,
};

pub const SERVICE_NAME: &str = "DeskZeroService";

define_windows_service!(ffi_service_main, service_main);

struct RawHandle(HANDLE);
unsafe impl Send for RawHandle {}
static USER_PROCESS_HANDLE: Mutex<Option<RawHandle>> = Mutex::new(None);

pub fn run_service_main() -> Result<(), String> {
    service_dispatcher::start(SERVICE_NAME, ffi_service_main)
        .map_err(|e| format!("启动服务分发器失败: {}", e))
}

fn service_main(arguments: Vec<std::ffi::OsString>) {
    if let Err(e) = service_main_impl(arguments) {
        eprintln!("[DeskZeroService] 服务运行错误: {}", e);
    }
}

fn service_main_impl(_arguments: Vec<std::ffi::OsString>) -> Result<(), String> {
    let status_handle = service_control_handler::register(SERVICE_NAME, move |control_event| {
        match control_event {
            ServiceControl::Stop | ServiceControl::Shutdown => {
                kill_user_process();
                std::process::exit(0);
            }
            ServiceControl::SessionChange(event_details) => {
                if event_details.reason == SessionChangeReason::SessionLogon
                    || event_details.reason == SessionChangeReason::ConsoleConnect
                {
                    kill_user_process();
                    let _ = spawn_user_process();
                }
                ServiceControlHandlerResult::NoError
            }
            _ => ServiceControlHandlerResult::NotImplemented,
        }
    })
    .map_err(|e| format!("注册服务控制器失败: {}", e))?;

    let running_status = ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Running,
        controls_accepted: ServiceControlAccept::STOP
            | ServiceControlAccept::SHUTDOWN
            | ServiceControlAccept::SESSION_CHANGE,
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    };
    status_handle
        .set_service_status(running_status)
        .map_err(|e| format!("更新服务状态失败: {}", e))?;

    // 初次尝试拉起用户进程
    let _ = spawn_user_process();

    // 主循环：定期检查用户进程是否存活，如果退出了就重新拉起
    loop {
        std::thread::sleep(Duration::from_secs(5));
        if !is_user_process_alive() {
            let _ = spawn_user_process();
        }
    }
}

/// 检查用户进程是否仍在运行
fn is_user_process_alive() -> bool {
    if let Ok(guard) = USER_PROCESS_HANDLE.lock() {
        if let Some(ref raw) = *guard {
            unsafe {
                let mut exit_code: u32 = 0;
                if GetExitCodeProcess(raw.0, &mut exit_code).is_ok() {
                    return exit_code == 259; // STILL_ACTIVE
                }
            }
        }
    }
    false
}

fn kill_user_process() {
    if let Ok(mut guard) = USER_PROCESS_HANDLE.lock() {
        if let Some(raw) = guard.take() {
            unsafe {
                let _ = TerminateProcess(raw.0, 0);
                let _ = CloseHandle(raw.0);
            }
        }
    }
}

fn spawn_user_process() -> Result<(), String> {
    unsafe {
        let session_id = WTSGetActiveConsoleSessionId();
        if session_id == 0xFFFFFFFF {
            return Err("未找到活动控制台 Session".to_string());
        }

        let mut user_token = HANDLE::default();
        if WTSQueryUserToken(session_id, &mut user_token).is_err() {
            return Err("WTSQueryUserToken 失败，服务可能没有 SeTcbPrivilege 权限".to_string());
        }

        let mut primary_token = HANDLE::default();
        let dup_ok = DuplicateTokenEx(
            user_token,
            TOKEN_ALL_ACCESS,
            None,
            SecurityIdentification,
            TokenPrimary,
            &mut primary_token,
        );
        let _ = CloseHandle(user_token);
        if dup_ok.is_err() {
            return Err("DuplicateTokenEx 复制 Token 失败".to_string());
        }

        let mut env_block: *mut c_void = std::ptr::null_mut();
        let env_ok = CreateEnvironmentBlock(&mut env_block, Some(primary_token), false);
        if env_ok.is_err() {
            let _ = CloseHandle(primary_token);
            return Err("CreateEnvironmentBlock 创建用户环境变量失败".to_string());
        }

        let exe_path = std::env::current_exe()
            .map_err(|e| format!("获取当前可执行文件路径失败: {}", e))?;
        let path_str = format!("\"{}\"", exe_path.to_string_lossy());
        let mut path_wide: Vec<u16> = path_str.encode_utf16().chain(std::iter::once(0)).collect();

        let work_dir = exe_path
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let work_dir_wide: Vec<u16> = work_dir.encode_utf16().chain(std::iter::once(0)).collect();

        let mut si = STARTUPINFOW::default();
        si.cb = std::mem::size_of::<STARTUPINFOW>() as u32;
        si.lpDesktop = PWSTR(w!("winsta0\\default").0 as *mut u16);

        let mut pi = PROCESS_INFORMATION::default();

        let ok = CreateProcessAsUserW(
            Some(primary_token),
            PCWSTR::null(),
            Some(PWSTR(path_wide.as_mut_ptr())),
            None,
            None,
            false,
            CREATE_UNICODE_ENVIRONMENT | CREATE_NO_WINDOW,
            Some(env_block),
            PCWSTR(work_dir_wide.as_ptr()),
            &si,
            &mut pi,
        );

        let _ = DestroyEnvironmentBlock(env_block);
        let _ = CloseHandle(primary_token);

        if ok.is_ok() {
            let _ = CloseHandle(pi.hThread);
            if let Ok(mut guard) = USER_PROCESS_HANDLE.lock() {
                *guard = Some(RawHandle(pi.hProcess));
            } else {
                let _ = CloseHandle(pi.hProcess);
            }
            Ok(())
        } else {
            Err("CreateProcessAsUserW 启动进程失败".to_string())
        }
    }
}
