use tokio::time::{self, Duration};

/// 启动后台自动备份定时器
/// 每小时检查一次，如果满足条件则执行自动备份
pub fn start_backup_timer(_app_handle: tauri::AppHandle) {
    tauri::async_runtime::spawn(async move {
        // 启动后等待 60 秒再执行第一次检查，避免影响启动速度
        time::sleep(Duration::from_secs(60)).await;

        loop {
            // 检查是否需要备份
            if let Err(e) = check_and_backup() {
                eprintln!("[DeskZero] 自动备份检查失败: {}", e);
            }

            // 每小时检查一次
            time::sleep(Duration::from_secs(3600)).await;
        }
    });
}

fn check_and_backup() -> Result<(), String> {
    let settings = crate::storage::backup_store::load_backup_settings();

    if !settings.auto_backup_enabled {
        return Ok(());
    }

    let interval_ms = settings.auto_backup_hours as u64 * 3600 * 1000;
    let now = chrono::Utc::now().timestamp_millis() as u64;

    let should_backup = match crate::storage::backup_store::get_last_auto_backup_time() {
        Some(last_time) => now - last_time >= interval_ms,
        None => true, // 从未自动备份过
    };

    if should_backup {
        // 备份前重新检查设置，防止读取与执行之间用户关闭了自动备份
        let recheck = crate::storage::backup_store::load_backup_settings();
        if !recheck.auto_backup_enabled {
            return Ok(());
        }
        eprintln!("[DeskZero] 执行自动备份...");
        let name = {
            let local_now = chrono::Local::now();
            local_now.format("自动备份 %Y-%m-%d %H:%M").to_string()
        };
        crate::storage::backup_store::create_backup(&name, "auto")?;
        eprintln!("[DeskZero] 自动备份完成");
    }

    Ok(())
}
