import React, { useEffect, useState, useRef } from 'react';
import {
  Server,
  Users,
  Cpu,
  HardDrive,
  Activity,
  Cloud,
  Calendar,
  CheckCircle2,
  Clock,
  Shield,
  Layers,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api';
import { ServerStatus, SystemMetrics, BackupHistoryItem, BackupSchedule } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';
import { animatePageEntrance } from '../animations/gsap';

export function OverviewPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { subscribe } = useWebSocket();

  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [lastBackup, setLastBackup] = useState<BackupHistoryItem | null>(null);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [gdrive, setGDrive] = useState<{ connected: boolean; remote?: string } | null>(null);
  const [playerCount, setPlayerCount] = useState<number>(0);

  useEffect(() => {
    animatePageEntrance(containerRef.current);

    // Initial data fetch
    api.getServerStatus().then(setStatus).catch(() => {});
    api.getMetrics().then(setMetrics).catch(() => {});
    api.getScheduler().then(setSchedule).catch(() => {});
    api.getGDriveStatus().then(setGDrive).catch(() => {});
    api.getOnlinePlayers().then((res) => setPlayerCount(res.count)).catch(() => {});
    api.getBackupHistory().then((history) => {
      const verified = history.find((b: BackupHistoryItem) => b.status === 'verified');
      if (verified) setLastBackup(verified);
    }).catch(() => {});

    // WebSocket listeners for live dashboard telemetry
    const unsubStatus = subscribe('SERVER_STATUS_CHANGE', (data: ServerStatus) => setStatus(data));
    const unsubMetrics = subscribe('METRICS_UPDATE', (data: SystemMetrics) => setMetrics(data));

    return () => {
      unsubStatus();
      unsubMetrics();
    };
  }, [subscribe]);

  const formatUptime = (seconds: number) => {
    if (!seconds) return 'Offline';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${seconds % 60}s`;
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div ref={containerRef} className="space-y-6 max-w-7xl mx-auto">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Dedicated Server Overview</h1>
          <p className="text-xs text-mutedText mt-0.5">Real-time status, VPS resource metrics, and backup schedules</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-card border border-border text-secondaryText">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            Port: {status?.port || 8211}
          </span>
        </div>
      </div>

      {/* Top Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status Card */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-secondaryText">Server State</span>
            <span className={`p-1.5 rounded-lg ${status?.isRunning ? 'bg-success/15 text-success' : 'bg-mutedText/15 text-mutedText'}`}>
              <Server className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {status?.isRunning ? 'Online' : 'Stopped'}
            </span>
            <span className="text-xs text-mutedText font-mono">
              {status?.processManager || 'screen'}
            </span>
          </div>
          <div className="text-[11px] text-mutedText mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Uptime: {formatUptime(status?.uptimeSeconds || 0)}</span>
          </div>
        </div>

        {/* Players Card */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-secondaryText">Active Players</span>
            <span className="p-1.5 rounded-lg bg-accent/15 text-accent">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">{playerCount}</span>
            <span className="text-xs text-mutedText font-mono">/ 32 max</span>
          </div>
          <div className="text-[11px] text-mutedText mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-accent" />
            <span>Dedicated instance ready</span>
          </div>
        </div>

        {/* CPU & Memory Card */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-secondaryText">VPS CPU & RAM</span>
            <span className="p-1.5 rounded-lg bg-card border border-border text-white">
              <Cpu className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              {metrics?.cpuUsagePercent ?? 0}%
            </span>
            <span className="text-xs text-mutedText font-mono">
              RAM: {metrics?.memoryPercent ?? 0}%
            </span>
          </div>
          <div className="w-full bg-secondary h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-accent h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, metrics?.memoryPercent || 0)}%` }}
            />
          </div>
        </div>

        {/* Storage & Google Drive */}
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-secondaryText">Google Drive Backup</span>
            <span className={`p-1.5 rounded-lg ${gdrive?.connected ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'}`}>
              <Cloud className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold text-white tracking-tight">
              {gdrive?.connected ? 'Connected' : 'rclone'}
            </span>
            <span className="text-xs text-mutedText truncate font-mono">
              {gdrive?.remote || 'gdrive'}
            </span>
          </div>
          <div className="text-[11px] text-mutedText mt-2 truncate flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>Next: {schedule?.backup_time || '03:00'} UTC Daily</span>
          </div>
        </div>
      </div>

      {/* Main Details Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: VPS Telemetry & Process Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" />
              Live System Telemetry
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-secondary/60 p-3.5 rounded-lg border border-border/70">
                <div className="text-[11px] text-mutedText mb-1">Palworld Process RAM</div>
                <div className="text-lg font-bold font-mono text-white">
                  {status?.memoryMb || 0} MB
                </div>
                <div className="text-[11px] text-secondaryText mt-1">PID: {status?.pid || 'N/A'}</div>
              </div>

              <div className="bg-secondary/60 p-3.5 rounded-lg border border-border/70">
                <div className="text-[11px] text-mutedText mb-1">Disk Usage (VPS Root)</div>
                <div className="text-lg font-bold font-mono text-white">
                  {metrics ? `${formatBytes(metrics.diskUsedBytes)} / ${formatBytes(metrics.diskTotalBytes)}` : 'Loading...'}
                </div>
                <div className="text-[11px] text-secondaryText mt-1">{metrics?.diskPercent || 0}% Allocated</div>
              </div>

              <div className="bg-secondary/60 p-3.5 rounded-lg border border-border/70">
                <div className="text-[11px] text-mutedText mb-1">Network Traffic</div>
                <div className="text-lg font-bold font-mono text-white">
                  {metrics ? `${formatBytes(metrics.networkRxSec)}/s ↓` : '0 B/s'}
                </div>
                <div className="text-[11px] text-secondaryText mt-1">
                  {metrics ? `${formatBytes(metrics.networkTxSec)}/s ↑` : '0 B/s'}
                </div>
              </div>
            </div>

            {/* Server Paths & Executable verification */}
            <div className="mt-5 pt-4 border-t border-border/60 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                <span className="text-mutedText">Server Working Directory:</span>
                <span className="font-mono text-secondaryText bg-secondary px-2 py-0.5 rounded border border-border/50 truncate max-w-sm">
                  {status?.executablePath || '/home/ubuntu/Palserver'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                <span className="text-mutedText">Save Directory:</span>
                <span className="font-mono text-secondaryText bg-secondary px-2 py-0.5 rounded border border-border/50 truncate max-w-sm">
                  {status?.worldSaveDir || '/home/ubuntu/Palserver/Pal/Saved/SaveGames'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Backup & Automation Status */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" />
              Automated Backup Health
            </h2>

            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-secondary/80 border border-border">
                <div className="text-[11px] text-mutedText mb-0.5">Last Verified Backup</div>
                <div className="font-mono text-xs font-semibold text-white truncate">
                  {lastBackup?.filename || 'No backups recorded yet'}
                </div>
                <div className="text-[11px] text-secondaryText mt-1 flex items-center justify-between">
                  <span>Size: {lastBackup ? formatBytes(lastBackup.size_bytes) : '0 MB'}</span>
                  <span className="text-success font-medium">Verified</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-secondary/80 border border-border">
                <div className="text-[11px] text-mutedText mb-0.5">Daily Schedule Execution</div>
                <div className="font-mono text-xs font-semibold text-white">
                  {schedule?.enabled ? `Enabled (${schedule.backup_time} ${schedule.timezone})` : 'Disabled'}
                </div>
                <div className="text-[11px] text-mutedText mt-1">
                  Google Drive Retention: Unlimited
                </div>
              </div>

              <a
                href="/backups"
                className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-card hover:bg-border text-white border border-border transition-colors"
              >
                <span>Manage Backups & Storage</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

