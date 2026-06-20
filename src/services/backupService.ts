import { invoke } from "@tauri-apps/api/core";
import type { BackupRecord, BackupSettings, BackupSnapshot } from "@/types/backup";

export async function createBackup(name?: string): Promise<BackupRecord> {
  return invoke("create_backup", { name });
}

export async function listBackups(): Promise<BackupRecord[]> {
  return invoke("list_backups");
}

export async function restoreBackup(id: string): Promise<void> {
  return invoke("restore_backup", { id });
}

export async function deleteBackup(id: string): Promise<void> {
  return invoke("delete_backup", { id });
}

export async function getBackupSettings(): Promise<BackupSettings> {
  return invoke("get_backup_settings");
}

export async function saveBackupSettings(
  settings: Partial<BackupSettings>
): Promise<void> {
  return invoke("save_backup_settings", {
    autoBackupEnabled: settings.autoBackupEnabled,
    autoBackupHours: settings.autoBackupHours,
    maxBackups: settings.maxBackups,
  });
}

export async function getBackupSnapshot(id: string): Promise<BackupSnapshot> {
  return invoke("get_backup_data", { id });
}
