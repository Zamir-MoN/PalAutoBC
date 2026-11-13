export interface User {
  id: string;
  username: string;
  role: string;
  lastLogin?: string;
}

export interface ServerStatus {
  isRunning: boolean;
  pid: number | null;
  uptimeSeconds: number;
  cpuPercent: number;
  memoryBytes: number;
  memoryMb: number;
  processManager: 'systemd' | 'screen' | 'standalone' | 'none';
  sessionName: string;
  port: number;
  executablePath: string;
  worldSaveDir: string;
  lastChecked: string;
}

export interface SystemMetrics {
  cpuUsagePercent: number;
  cpuCores: number;
  memoryTotalBytes: number;
  memoryUsedBytes: number;
  memoryFreeBytes: number;
  memoryPercent: number;
  diskTotalBytes: number;
  diskUsedBytes: number;
  diskFreeBytes: number;
  diskPercent: number;
  networkRxSec: number;
  networkTxSec: number;
  systemUptimeSeconds: number;
  serverProcessCpu: number;
  serverProcessMemoryMb: number;
  serverProcessRunning: boolean;
  timestamp: string;
}

export interface BackupHistoryItem {
  id: string;
  filename: string;
  filepath?: string;
  size_bytes: number;
  sha256?: string;
  storage_type: string;
  remote_path?: string;
  status: 'pending' | 'creating' | 'uploading' | 'verified' | 'failed';
  error_message?: string;
  created_at: string;
  completed_at?: string;
  duration_seconds?: number;
}

export interface RemoteBackup {
  Path: string;
  Name: string;
  Size: number;
  ModTime: string;
  IsDir: boolean;
}

export interface BackupSchedule {
  id: string;
  name: string;
  enabled: number;
  cron_expression: string;
  backup_time: string;
  timezone: string;
  last_run?: string;
  next_run?: string;
  status: string;
}

export interface Player {
  name: string;
  playerUId: string;
  steamId: string;
}

export interface ConsoleLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
}

export interface FileItem {
  name: string;
  relativePath: string;
  sizeBytes: number;
  isDir: boolean;
  modifiedAt: string;
  isEditable: boolean;
}

export interface ConfigSnapshot {
  id: string;
  filename: string;
  comment?: string;
  created_by?: string;
  created_at: string;
}

