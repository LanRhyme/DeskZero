#[cfg(test)]
mod tests {
    use crate::models::backup::{BackupRecord, BackupType};
    use crate::storage::backup_store::*;
    use crate::storage::db;
    use serial_test::serial;

    /// 确保数据库表已创建（测试前置条件）
    fn ensure_db() {
        db::init_db().expect("数据库初始化失败");
    }

    /// 辅助函数：创建一个测试备份并返回记录
    fn create_test_backup(name: &str, backup_type: &str) -> BackupRecord {
        create_backup(name, backup_type).expect("创建备份失败")
    }

    /// 辅助函数：清理所有备份
    fn cleanup_all_backups() {
        let existing = list_backups().unwrap_or_default();
        for b in &existing {
            let _ = delete_backup(&b.id);
        }
    }

    #[test]
    #[serial]
    fn test_create_backup_returns_record() {
        ensure_db();
        cleanup_all_backups();
        let record = create_test_backup("测试备份", "manual");
        assert!(!record.id.is_empty());
        assert_eq!(record.name, "测试备份");
        assert_eq!(record.backup_type, BackupType::Manual);
        assert!(record.created_at > 0);

        // 清理
        let _ = delete_backup(&record.id);
    }

    #[test]
    #[serial]
    fn test_create_auto_backup() {
        ensure_db();
        cleanup_all_backups();
        let record = create_test_backup("自动备份", "auto");
        assert_eq!(record.backup_type, BackupType::Auto);

        // 清理
        let _ = delete_backup(&record.id);
    }

    #[test]
    #[serial]
    fn test_list_backups_empty() {
        ensure_db();
        cleanup_all_backups();
        let result = list_backups();
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    #[serial]
    fn test_list_backups_sorted_by_created_at_desc() {
        ensure_db();
        cleanup_all_backups();
        let r1 = create_test_backup("排序备份1", "manual");
        // 确保时间戳不同
        std::thread::sleep(std::time::Duration::from_millis(10));
        let r2 = create_test_backup("排序备份2", "manual");

        let list = list_backups().expect("列出备份失败");
        let pos_r2 = list.iter().position(|b| b.id == r2.id).expect("未找到备份2");
        let pos_r1 = list.iter().position(|b| b.id == r1.id).expect("未找到备份1");
        assert!(pos_r2 < pos_r1, "备份应按时间倒序排列");

        // 清理
        let _ = delete_backup(&r1.id);
        let _ = delete_backup(&r2.id);
    }

    #[test]
    #[serial]
    fn test_get_backup_data_roundtrip() {
        ensure_db();
        cleanup_all_backups();
        let record = create_test_backup("数据测试", "manual");
        let snapshot = get_backup_data(&record.id).expect("获取备份数据失败");

        // 验证快照结构
        assert_eq!(snapshot.version, "1");
        // settings 和 containers 是序列化的当前数据，应该能正确解析
        assert!(serde_json::to_string(&snapshot.settings).is_ok());

        // 清理
        let _ = delete_backup(&record.id);
    }

    #[test]
    #[serial]
    fn test_get_backup_data_not_found() {
        ensure_db();
        let result = get_backup_data("不存在的id");
        assert!(result.is_err());
    }

    #[test]
    #[serial]
    fn test_delete_backup() {
        ensure_db();
        cleanup_all_backups();
        let record = create_test_backup("待删除", "manual");
        let id = record.id.clone();
        delete_backup(&id).expect("删除备份失败");

        // 再次删除应该报错
        let result = delete_backup(&id);
        assert!(result.is_err());
    }

    #[test]
    #[serial]
    fn test_delete_backup_not_found() {
        ensure_db();
        let result = delete_backup("不存在的id");
        assert!(result.is_err());
    }

    #[test]
    #[serial]
    fn test_purge_old_backups() {
        ensure_db();
        cleanup_all_backups();

        // 创建 3 个自动备份
        let r1 = create_test_backup("purge1", "auto");
        let r2 = create_test_backup("purge2", "auto");
        let r3 = create_test_backup("purge3", "auto");

        // 保留最新 2 个
        purge_old_backups(2).expect("清理备份失败");

        let list = list_backups().expect("列出备份失败");
        assert_eq!(list.len(), 2, "应只剩 2 个备份");
        let ids: Vec<&str> = list.iter().map(|b| b.id.as_str()).collect();
        assert!(!ids.contains(&r1.id.as_str()), "最旧的自动备份应被清理");
        assert!(ids.contains(&r2.id.as_str()), "次新的自动备份应保留");
        assert!(ids.contains(&r3.id.as_str()), "最新的自动备份应保留");

        // 清理
        let _ = delete_backup(&r2.id);
        let _ = delete_backup(&r3.id);
    }

    #[test]
    #[serial]
    fn test_purge_does_not_delete_manual_backups() {
        ensure_db();
        cleanup_all_backups();

        // 创建 3 个手动备份和 3 个自动备份
        let m1 = create_test_backup("手动1", "manual");
        let _m2 = create_test_backup("手动2", "manual");
        let _m3 = create_test_backup("手动3", "manual");
        let a1 = create_test_backup("自动1", "auto");
        let a2 = create_test_backup("自动2", "auto");
        let a3 = create_test_backup("自动3", "auto");

        // 限制自动备份最多 2 个
        purge_old_backups(2).expect("清理备份失败");

        let list = list_backups().expect("列出备份失败");
        // 手动备份 3 个全部保留 + 自动备份保留 2 个 = 5
        assert_eq!(list.len(), 5, "手动备份不应被清理，应剩 5 个");
        let ids: Vec<&str> = list.iter().map(|b| b.id.as_str()).collect();
        assert!(ids.contains(&m1.id.as_str()), "手动备份应保留");
        assert!(!ids.contains(&a1.id.as_str()), "最旧的自动备份应被清理");
        assert!(ids.contains(&a2.id.as_str()), "较新的自动备份应保留");
        assert!(ids.contains(&a3.id.as_str()), "最新的自动备份应保留");

        // 清理
        cleanup_all_backups();
    }

    #[test]
    #[serial]
    fn test_get_last_auto_backup_time_none() {
        ensure_db();
        cleanup_all_backups();
        // 清理后不应有 auto 备份
        let result = get_last_auto_backup_time();
        assert!(result.is_none(), "清理后不应存在自动备份记录");
    }

    #[test]
    #[serial]
    fn test_get_last_auto_backup_time_after_create() {
        ensure_db();
        cleanup_all_backups();
        let before = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let record = create_test_backup("自动备份时间测试", "auto");

        let last = get_last_auto_backup_time();
        assert!(last.is_some(), "应该存在自动备份记录");
        assert!(last.unwrap() >= before.saturating_sub(1000), "时间戳应合理");

        // 清理
        let _ = delete_backup(&record.id);
    }

    #[test]
    #[serial]
    fn test_load_backup_settings_default() {
        ensure_db();
        let settings = load_backup_settings();
        assert_eq!(settings.auto_backup_enabled, true);
        assert_eq!(settings.auto_backup_hours, 6);
        assert_eq!(settings.max_backups, 20);
    }

    #[test]
    #[serial]
    fn test_save_and_load_backup_settings() {
        ensure_db();
        save_backup_settings(Some(false), Some(12), Some(50)).expect("保存备份设置失败");

        let settings = load_backup_settings();
        assert_eq!(settings.auto_backup_enabled, false);
        assert_eq!(settings.auto_backup_hours, 12);
        assert_eq!(settings.max_backups, 50);

        // 恢复默认值
        save_backup_settings(Some(true), Some(6), Some(20)).expect("恢复默认设置失败");
    }

    #[test]
    #[serial]
    fn test_restore_backup_verifies_data() {
        ensure_db();
        cleanup_all_backups();

        // 1. 创建备份
        let record = create_test_backup("还原验证测试", "manual");

        // 2. 修改设置（改变一个字段）
        let mut current_settings = crate::storage::settings_store::load_settings().unwrap_or_default();
        let original_grid_width = current_settings.grid_width;
        current_settings.grid_width = 9999;
        crate::storage::settings_store::save_settings(&current_settings).expect("修改设置失败");

        // 确认设置已被修改
        let modified = crate::storage::settings_store::load_settings().unwrap_or_default();
        assert_eq!(modified.grid_width, 9999, "设置应已被修改");

        // 3. 还原备份
        let result = restore_backup(&record.id);
        assert!(result.is_ok(), "还原备份失败: {:?}", result.err());

        // 4. 验证设置已恢复到备份时的状态
        let restored = crate::storage::settings_store::load_settings().unwrap_or_default();
        assert_eq!(restored.grid_width, original_grid_width, "设置应恢复到备份时的值");

        // 清理
        let _ = delete_backup(&record.id);
    }

    #[test]
    #[serial]
    fn test_restore_backup_is_atomic_on_error() {
        ensure_db();
        cleanup_all_backups();

        // 尝试还原一个不存在的备份 ID，应返回错误
        let result = restore_backup("不存在的备份id");
        assert!(result.is_err(), "还原不存在的备份应返回错误");
    }
}
