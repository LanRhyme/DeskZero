export interface BackupRecord {
  id: string;
  name: string;
  type: 'manual' | 'auto';
  createdAt: number;
  remark: string;
}

export interface BackupSettings {
  autoBackupEnabled: boolean;
  autoBackupHours: number;
  maxBackups: number;
}

export interface BackupSnapshot {
  version: string;
  settings: Record<string, unknown>;
  desktopLayout: Record<string, unknown>;
  containers: unknown[];
  extra: Record<string, unknown>;
}
