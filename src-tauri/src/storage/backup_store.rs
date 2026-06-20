use crate::models::backup::{BackupRecord, BackupSettings, BackupSnapshot, BackupType};
use crate::models::container::Position;
use std::collections::HashMap;
use super::db::get_connection;
use std::sync::Mutex;

static BACKUP_LOCK: Mutex<()> = Mutex::new(());

/// 创建备份 — 读取当前全部数据生成快照，存入 backups 元数据表 + backup_data 数据表
pub fn create_backup(name: &str, backup_type: &str) -> Result<BackupRecord, String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    create_backup_internal(name, backup_type)
}

fn create_backup_internal(name: &str, backup_type: &str) -> Result<BackupRecord, String> {
    let mut conn = get_connection().map_err(|e| e.to_string())?;

    // 读取当前全部数据并序列化为 serde_json::Value
    let settings = super::settings_store::load_settings()?;
    let desktop_layout = super::desktop_store::load_layout()?;
    let containers = super::container_store::load_containers()?;
    eprintln!("[create_backup] 备份数据: 设置OK, 布局{}项, 容器{}个", desktop_layout.len(), containers.len());
    for c in &containers {
        eprintln!("[create_backup] 容器: id={}, name={}, type={:?}, items={}", c.id, c.name, c.container_type, c.items.len());
    }

    let settings_json = serde_json::to_value(&settings).map_err(|e| e.to_string())?;
    let layout_json = serde_json::to_value(&desktop_layout).map_err(|e| e.to_string())?;

    let snapshot = BackupSnapshot {
        version: "1".to_string(),
        settings: settings_json,
        desktop_layout: layout_json,
        containers,
        extra: HashMap::new(),
    };

    let data = serde_json::to_string(&snapshot).map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    // 解析 backup_type 字符串为枚举
    let bt: BackupType = serde_json::from_str(&format!("\"{}\"", backup_type))
        .unwrap_or(BackupType::Other(backup_type.to_string()));
    let type_str = serde_json::to_string(&bt).unwrap_or_else(|_| "\"manual\"".to_string()).replace("\"", "");

    // 使用事务保证元数据和快照数据的原子性写入
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 写入元数据
    tx.execute(
        "INSERT INTO backups (id, name, type, remark, created_at) VALUES (?1, ?2, ?3, '', ?4)",
        rusqlite::params![id, name, type_str, now],
    ).map_err(|e| e.to_string())?;

    // 写入快照数据
    tx.execute(
        "INSERT INTO backup_data (backup_id, data) VALUES (?1, ?2)",
        rusqlite::params![id, data],
    ).map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    // 清理超限备份
    let max_count = load_backup_max_count();
    if let Err(e) = purge_old_backups_internal(max_count) {
        eprintln!("清理超限备份失败（不影响本次备份）: {}", e);
    }

    // 解析 RFC 3339 时间戳为毫秒时间戳（兼容前端 u64 字段）
    let created_at = chrono::DateTime::parse_from_rfc3339(&now)
        .map(|dt| dt.timestamp_millis() as u64)
        .unwrap_or(0);

    Ok(BackupRecord {
        id,
        name: name.to_string(),
        remark: String::new(),
        backup_type: bt,
        created_at,
        extra: HashMap::new(),
    })
}

/// 列出所有备份（按时间倒序）
pub fn list_backups() -> Result<Vec<BackupRecord>, String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    list_backups_internal()
}

fn list_backups_internal() -> Result<Vec<BackupRecord>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT id, name, type, remark, created_at FROM backups ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let name: String = row.get(1)?;
        let type_str: String = row.get(2)?;
        let remark: String = row.get(3)?;
        let created_at_str: String = row.get(4)?;

        // 兼容 ISO 8601 和纯毫秒时间戳两种格式
        let created_at = chrono::DateTime::parse_from_rfc3339(&created_at_str)
            .map(|dt| dt.timestamp_millis() as u64)
            .unwrap_or_else(|_| created_at_str.parse::<u64>().unwrap_or(0));

        let backup_type: BackupType = serde_json::from_str(&format!("\"{}\"", type_str))
            .unwrap_or(BackupType::Other(type_str));

        Ok(BackupRecord {
            id,
            name,
            remark,
            backup_type,
            created_at,
            // 当前 backups 表无额外列，预留 extra 字段供未来扩展
            extra: HashMap::new(),
        })
    }).map_err(|e| e.to_string())?;

    let mut backups = Vec::new();
    for row in rows {
        if let Ok(b) = row {
            backups.push(b);
        }
    }

    Ok(backups)
}

/// 获取备份快照数据
pub fn get_backup_data(id: &str) -> Result<BackupSnapshot, String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    get_backup_data_internal(id)
}

fn get_backup_data_internal(id: &str) -> Result<BackupSnapshot, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT data FROM backup_data WHERE backup_id = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query(rusqlite::params![id]).map_err(|e| e.to_string())?;

    let data = if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        row.get::<_, String>(0).map_err(|e| e.to_string())?
    } else {
        return Err("备份不存在".to_string());
    };

    serde_json::from_str(&data).map_err(|e| format!("备份数据解析失败: {}", e))
}

/// 还原备份 — 全量覆盖当前数据，使用单个事务保证原子性
pub fn restore_backup(id: &str) -> Result<(), String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    restore_backup_internal(id)
}

fn restore_backup_internal(id: &str) -> Result<(), String> {
    eprintln!("[restore_backup] 开始还原, id={}", id);
    let snapshot = match get_backup_data_internal(id) {
        Ok(s) => {
            eprintln!("[restore_backup] 快照版本={}, 容器数量={}", s.version, s.containers.len());
            s
        },
        Err(e) => {
            eprintln!("[restore_backup] 获取备份数据失败: {}", e);
            return Err(e);
        }
    };

    let mut conn = get_connection().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 1. 保存设置
    let settings: crate::models::Settings = serde_json::from_value(snapshot.settings.clone())
        .map_err(|e| format!("设置数据解析失败: {}", e))?;
    let settings_json = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    tx.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        rusqlite::params!["global", settings_json],
    ).map_err(|e| e.to_string())?;

    // 2. 保存桌面布局（差异删除 + UPSERT）
    let layout: HashMap<String, Position> =
        serde_json::from_value(snapshot.desktop_layout.clone())
            .map_err(|e| format!("布局数据解析失败: {}", e))?;
    eprintln!("[restore_backup] 解析到 {} 个布局项", layout.len());

    // 查出现有布局 ID，删除不在快照中的
    let mut existing_layout_ids: Vec<String> = Vec::new();
    {
        let mut stmt = tx.prepare("SELECT item_id FROM desktop_layout")
            .map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        for row in rows {
            if let Ok(id) = row {
                existing_layout_ids.push(id);
            }
        }
    }
    eprintln!("[restore_backup] 现有布局 {} 项", existing_layout_ids.len());
    for lid in &existing_layout_ids {
        if !layout.contains_key(lid) {
            tx.execute("DELETE FROM desktop_layout WHERE item_id = ?1", rusqlite::params![lid])
                .map_err(|e| e.to_string())?;
        }
    }
    for (item_id, pos) in &layout {
        tx.execute(
            "INSERT INTO desktop_layout (item_id, x, y) VALUES (?1, ?2, ?3)
             ON CONFLICT(item_id) DO UPDATE SET x = excluded.x, y = excluded.y",
            rusqlite::params![item_id, pos.x, pos.y],
        ).map_err(|e| e.to_string())?;
    }
    eprintln!("[restore_backup] 布局写入完成");

    // 3. 保存容器（差异策略：删除不在快照中的容器，然后 UPSERT 快照中的容器）
    eprintln!("[restore_backup] 开始还原容器, 快照中有 {} 个容器", snapshot.containers.len());
    let mut existing_container_ids: Vec<String> = Vec::new();
    {
        let mut stmt = tx.prepare("SELECT id FROM containers")
            .map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| row.get(0))
            .map_err(|e| e.to_string())?;
        for row in rows {
            if let Ok(id) = row {
                existing_container_ids.push(id);
            }
        }
    }
    let snapshot_ids: Vec<&str> = snapshot.containers.iter().map(|c| c.id.as_str()).collect();

    for cid in &existing_container_ids {
        if !snapshot_ids.contains(&cid.as_str()) {
            tx.execute("DELETE FROM container_items WHERE container_id = ?1", rusqlite::params![cid])
                .map_err(|e| e.to_string())?;
            tx.execute("DELETE FROM containers WHERE id = ?1", rusqlite::params![cid])
                .map_err(|e| e.to_string())?;
        }
    }

    // UPSERT 容器及其项目
    for container in &snapshot.containers {
        let type_str = serde_json::to_string(&container.container_type)
            .unwrap_or_else(|_| "\"normal\"".to_string())
            .replace("\"", "");
        let style_str = serde_json::to_string(&container.style)
            .unwrap_or_else(|_| "{}".to_string());

        // 差异删除容器项目
        let new_item_ids: Vec<&str> = container.items.iter().map(|i| i.id.as_str()).collect();
        let mut existing_items: Vec<String> = Vec::new();
        {
            let mut stmt = tx.prepare("SELECT id FROM container_items WHERE container_id = ?1")
                .map_err(|e| e.to_string())?;
            let rows = stmt.query_map(rusqlite::params![container.id], |row| row.get(0))
                .map_err(|e| e.to_string())?;
            for row in rows {
                if let Ok(id) = row {
                    existing_items.push(id);
                }
            }
        }
        for eid in &existing_items {
            if !new_item_ids.contains(&eid.as_str()) {
                tx.execute("DELETE FROM container_items WHERE id = ?1", rusqlite::params![eid])
                    .map_err(|e| e.to_string())?;
            }
        }

        tx.execute(
            "INSERT INTO containers (id, name, type, x, y, width, height, style, folder_path, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                type = excluded.type,
                x = excluded.x,
                y = excluded.y,
                width = excluded.width,
                height = excluded.height,
                style = excluded.style,
                folder_path = excluded.folder_path,
                updated_at = excluded.updated_at",
            rusqlite::params![
                container.id,
                container.name,
                type_str,
                container.position.x,
                container.position.y,
                container.size.width,
                container.size.height,
                style_str,
                container.folder_path,
                container.created_at as i64,
                container.updated_at as i64,
            ],
        ).map_err(|e| e.to_string())?;

        // UPSERT 项目
        for (i, item) in container.items.iter().enumerate() {
            let item_type_str = serde_json::to_string(&item.item_type)
                .unwrap_or_else(|_| "\"file\"".to_string())
                .replace("\"", "");
            let pos_x = item.position.as_ref().map(|p| p.x);
            let pos_y = item.position.as_ref().map(|p| p.y);

            tx.execute(
                "INSERT INTO container_items (id, container_id, name, path, icon_path, item_type, target_path, size, modified_at, x, y, order_index)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                 ON CONFLICT(id) DO UPDATE SET
                    container_id = excluded.container_id,
                    name = excluded.name,
                    path = excluded.path,
                    icon_path = excluded.icon_path,
                    item_type = excluded.item_type,
                    target_path = excluded.target_path,
                    size = excluded.size,
                    modified_at = excluded.modified_at,
                    x = excluded.x,
                    y = excluded.y,
                    order_index = excluded.order_index",
                rusqlite::params![
                    item.id,
                    container.id,
                    item.name,
                    item.path,
                    item.icon_path,
                    item_type_str,
                    item.target_path,
                    item.size.map(|s| s as i64),
                    item.modified_at.map(|m| m as i64),
                    pos_x,
                    pos_y,
                    i as i64,
                ],
            ).map_err(|e| e.to_string())?;
        }
    }

    // 4. 处理还原后的新文件：扫描当前桌面，将无位置信息的文件自动排列（在事务内完成）
    if let Ok(current_items) = crate::desktop::icon_scanner::scan_desktop_icons() {
        // 从事务中读取当前布局（已还原的快照布局）
        let mut layout: HashMap<String, Position> = HashMap::new();
        {
            let mut stmt = tx.prepare("SELECT item_id, x, y FROM desktop_layout")
                .map_err(|e| e.to_string())?;
            let rows = stmt.query_map([], |row| {
                let id: String = row.get(0)?;
                let x: f64 = row.get(1)?;
                let y: f64 = row.get(2)?;
                Ok((id, Position { x, y }))
            }).map_err(|e| e.to_string())?;
            for row in rows {
                if let Ok((id, pos)) = row {
                    layout.insert(id, pos);
                }
            }
        }

        let settings = super::settings_store::load_settings().unwrap_or_default();
        let step_x = (settings.grid_width + settings.grid_gap_x) as f64;
        let step_y = (settings.grid_height + settings.grid_gap_y) as f64;

        let mut occupied: std::collections::HashSet<(i32, i32)> = std::collections::HashSet::new();
        for pos in layout.values() {
            let col = (pos.x / step_x).round() as i32;
            let row = (pos.y / step_y).round() as i32;
            occupied.insert((col, row));
        }

        for item in &current_items {
            if layout.contains_key(&item.id) {
                continue;
            }
            let mut placed = false;
            for row in 0..100 {
                for col in 0..50 {
                    if !occupied.contains(&(col, row)) {
                        let x = col as f64 * step_x;
                        let y = row as f64 * step_y;
                        tx.execute(
                            "INSERT INTO desktop_layout (item_id, x, y) VALUES (?1, ?2, ?3)
                             ON CONFLICT(item_id) DO UPDATE SET x = excluded.x, y = excluded.y",
                            rusqlite::params![item.id, x, y],
                        ).map_err(|e| e.to_string())?;
                        occupied.insert((col, row));
                        placed = true;
                        break;
                    }
                }
                if placed {
                    break;
                }
            }
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/// 删除单个备份（元数据 + 数据）
pub fn delete_backup(id: &str) -> Result<(), String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    delete_backup_internal(id)
}

fn delete_backup_internal(id: &str) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    // 先删数据
    conn.execute("DELETE FROM backup_data WHERE backup_id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;

    // 再删元数据
    let affected = conn.execute("DELETE FROM backups WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("备份不存在".to_string());
    }

    Ok(())
}

/// 清理超限备份，保留最新的 max_count 个（事务保护）
pub fn purge_old_backups(max_count: u32) -> Result<(), String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    purge_old_backups_internal(max_count)
}

fn purge_old_backups_internal(max_count: u32) -> Result<(), String> {
    let mut conn = get_connection().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 只清理超限的自动备份，手动备份永久保留
    let mut ids_to_delete: Vec<String> = Vec::new();
    {
        let mut stmt = tx.prepare(
            "SELECT id FROM backups WHERE type = 'auto' ORDER BY created_at DESC LIMIT -1 OFFSET ?1"
        ).map_err(|e| e.to_string())?;
        let rows = stmt.query_map(rusqlite::params![max_count], |row| {
            row.get::<_, String>(0)
        }).map_err(|e| e.to_string())?;
        for row in rows {
            if let Ok(id) = row {
                ids_to_delete.push(id);
            }
        }
    }

    for id in &ids_to_delete {
        tx.execute("DELETE FROM backup_data WHERE backup_id = ?1", rusqlite::params![id])
            .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM backups WHERE id = ?1", rusqlite::params![id])
            .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

/// 从设置中读取最大备份数
fn load_backup_max_count() -> u32 {
    let settings = super::settings_store::load_settings().unwrap_or_default();
    // 优先从 backup_settings 读取，其次从 extra 读取，默认 20
    if let Some(ref bs) = settings.backup_settings {
        return bs.max_backups;
    }
    settings.extra.get("backupMaxCount")
        .and_then(|v| v.as_u64())
        .unwrap_or(20) as u32
}

/// 读取备份设置
pub fn load_backup_settings() -> BackupSettings {
    let _lock = match BACKUP_LOCK.lock() {
        Ok(l) => l,
        Err(_) => return BackupSettings::default(),
    };
    load_backup_settings_internal()
}

fn load_backup_settings_internal() -> BackupSettings {
    let settings = super::settings_store::load_settings().unwrap_or_default();

    // 优先从 backup_settings 字段读取
    if let Some(bs) = settings.backup_settings {
        return bs;
    }

    // 兼容旧版：从 extra 字段读取
    BackupSettings {
        auto_backup_enabled: settings.extra.get("backupEnabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(true),
        auto_backup_hours: settings.extra.get("backupIntervalHours")
            .and_then(|v| v.as_u64())
            .unwrap_or(6) as u32,
        max_backups: settings.extra.get("backupMaxCount")
            .and_then(|v| v.as_u64())
            .unwrap_or(20) as u32,
        extra: HashMap::new(),
    }
}

/// 保存备份设置 — 使用 update_settings 原子更新，避免竞态窗口
pub fn save_backup_settings(
    enabled: Option<bool>,
    interval_hours: Option<u32>,
    max_count: Option<u32>,
) -> Result<(), String> {
    let _lock = BACKUP_LOCK.lock().map_err(|e| format!("锁获取失败: {}", e))?;
    save_backup_settings_internal(enabled, interval_hours, max_count)
}

fn save_backup_settings_internal(
    enabled: Option<bool>,
    interval_hours: Option<u32>,
    max_count: Option<u32>,
) -> Result<(), String> {
    super::settings_store::update_settings(|settings| {
        let mut bs = settings.backup_settings.take().unwrap_or_default();

        if let Some(v) = enabled {
            bs.auto_backup_enabled = v;
        }
        if let Some(v) = interval_hours {
            bs.auto_backup_hours = v;
        }
        if let Some(v) = max_count {
            bs.max_backups = v;
        }

        settings.backup_settings = Some(bs);
    })
}

/// 获取最后一次自动备份的时间戳
pub fn get_last_auto_backup_time() -> Option<u64> {
    let _lock = BACKUP_LOCK.lock().ok()?;
    get_last_auto_backup_time_internal()
}

fn get_last_auto_backup_time_internal() -> Option<u64> {
    let conn = get_connection().ok()?;

    let mut stmt = conn.prepare(
        "SELECT created_at FROM backups WHERE type = 'auto' ORDER BY created_at DESC LIMIT 1"
    ).ok()?;
    let mut rows = stmt.query([]).ok()?;

    if let Some(row) = rows.next().ok()? {
        let created_at_str: String = row.get(0).ok()?;
        // 兼容 ISO 8601 和纯毫秒时间戳两种格式
        chrono::DateTime::parse_from_rfc3339(&created_at_str)
            .map(|dt| dt.timestamp_millis() as u64)
            .ok()
            .or_else(|| created_at_str.parse::<u64>().ok())
    } else {
        None
    }
}
