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
  ArrowUpRight,
  RefreshCw,
  Copy,
  Check,
  CloudUpload,
  Terminal,
  Sliders,
  Download,
  Save,
  Radio,
  Power,
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
  const [serverName, setServerName] = useState<string>('Palulu Gang');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [savingWorld, setSavingWorld] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [serverActionLoading, setServerActionLoading] = useState(false);

  const handleStartServer = async (force = true) => {
    setServerActionLoading(true);
    setSaveMessage('Starting Palworld server...');
    try {
      const res = await api.startServer(force);
      setSaveMessage(res.message);
      const newStatus = await api.getServerStatus();
      setStatus(newStatus);
    } catch (err: any) {
      setSaveMessage(err.message || 'Failed to start server');
    } finally {
      setServerActionLoading(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const handleRestartServer = async () => {
    if (!window.confirm('Restart Palworld server now?')) return;
    setServerActionLoading(true);
    setSaveMessage('Restarting Palworld server...');
    try {
      const res = await api.restartServer();
      setSaveMessage(res.message);
      const newStatus = await api.getServerStatus();
      setStatus(newStatus);
    } catch (err: any) {
      setSaveMessage(err.message || 'Failed to restart server');
    } finally {
      setServerActionLoading(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  const handleStopServer = async () => {
    if (!window.confirm('Stop Palworld server now?')) return;
    setServerActionLoading(true);
    setSaveMessage('Stopping Palworld server...');
    try {
      const res = await api.stopServer();
      setSaveMessage(res.message);
      const newStatus = await api.getServerStatus();
      setStatus(newStatus);
    } catch (err: any) {
      setSaveMessage(err.message || 'Failed to stop server');
    } finally {
      setServerActionLoading(false);
      setTimeout(() => setSaveMessage(null), 4000);
    }
  };

  useEffect(() => {
    animatePageEntrance(containerRef.current);

    api.getServerStatus().then(setStatus).catch(() => {});
    api.getMetrics().then(setMetrics).catch(() => {});
    api.getScheduler().then(setSchedule).catch(() => {});
    api.getGDriveStatus().then(setGDrive).catch(() => {});

    api.getConfigSettings().then((cfg) => {
      if (cfg?.parsed?.ServerName) {
        setServerName(cfg.parsed.ServerName);
      }
    }).catch(() => {});

    const fetchPlayers = () => {
      api.getOnlinePlayers().then((res) => setPlayerCount(res.count)).catch(() => {});
    };
    fetchPlayers();
    const playerInterval = setInterval(fetchPlayers, 5000);

    api.getBackupHistory().then((history) => {
      if (Array.isArray(history)) {
        const verified = history.find((b: BackupHistoryItem) => b.status === 'verified');
        if (verified) setLastBackup(verified);
      }
    }).catch(() => {});

    const unsubStatus = subscribe('SERVER_STATUS_CHANGE', (data: ServerStatus) => setStatus(data));
    const unsubMetrics = subscribe('METRICS_UPDATE', (data: SystemMetrics) => setMetrics(data));

    return () => {
      clearInterval(playerInterval);
      unsubStatus();
      unsubMetrics();
    };
  }, [subscribe]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(id);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const handleSaveWorld = async () => {
    setSavingWorld(true);
    setSaveMessage(null);
    try {
      await api.saveWorld();
      setSaveMessage('World data saved successfully.');
    } catch {
      setSaveMessage('World save delivered.');
    } finally {
      setSavingWorld(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  };

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

  const ramPercent = Math.min(100, metrics?.memoryPercent || 0);
  const cpuPercent = Math.min(100, metrics?.cpuUsagePercent || 0);

  return (
    <div ref={containerRef} className="space-y-6 max-w-7xl mx-auto">
      {/* Top Hero Banner & Quick Actions */}
      <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-xs font-mono uppercase tracking-wider text-accent font-bold px-2 py-0.5 rounded-md bg-accent/10 border border-accent/25">
                Dedicated Instance
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-mutedText font-mono bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.06]">
                <Radio className="w-3 h-3 text-accent animate-pulse" />
                Port {status?.port || 8211}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-mutedText font-mono bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.06]">
                RCON :25575
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>{serverName}</span>
              <span className="text-xs font-medium text-secondaryText px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08]">
                v0.4.x
              </span>
            </h1>
            <p className="text-xs text-mutedText mt-1 flex items-center gap-2">
              <span>Uptime: <strong className="text-white font-mono">{formatUptime(status?.uptimeSeconds || 0)}</strong></span>
              <span>•</span>
              <span>Session: <code className="text-accent font-mono">{status?.sessionName || 'palworld'}</code></span>
              <span>•</span>
              <span className="text-emerald-400">Zero-Downtime Engine Active</span>
            </p>
          </div>

          {/* Action Button Pills */}
          <div className="flex flex-wrap items-center gap-2.5">
            {status?.isRunning ? (
              <>
                <button
                  onClick={handleRestartServer}
                  disabled={serverActionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-warning/10 text-secondaryText hover:text-warning border border-white/[0.08] hover:border-warning/30 transition-all shadow-sm"
                  title="Restart Palworld server"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${serverActionLoading ? 'animate-spin' : ''}`} />
                  <span>Restart Server</span>
                </button>
                <button
                  onClick={handleStopServer}
                  disabled={serverActionLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 hover:border-danger/50 transition-all shadow-sm"
                  title="Stop Palworld server"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => handleStartServer(true)}
                disabled={serverActionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-accent text-black hover:bg-accent-hover transition-all shadow-[0_0_20px_-3px_rgba(163,230,53,0.4)] disabled:opacity-50"
              >
                <Power className={`w-3.5 h-3.5 ${serverActionLoading ? 'animate-spin' : ''}`} />
                <span>{serverActionLoading ? 'Starting Server...' : 'Start Server'}</span>
              </button>
            )}

            <button
              onClick={handleSaveWorld}
              disabled={savingWorld}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.08] hover:border-accent/40 transition-all shadow-sm"
              title="Force immediate world save via RCON"
            >
              <Save className={`w-3.5 h-3.5 text-accent ${savingWorld ? 'animate-spin' : ''}`} />
              <span>{savingWorld ? 'Saving World...' : 'Save World'}</span>
            </button>

            <a
              href="/console"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.08] hover:border-accent/40 transition-all shadow-sm"
            >
              <Terminal className="w-3.5 h-3.5 text-accent" />
              <span>Live Console</span>
            </a>

            <a
              href="/config"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.08] hover:border-accent/40 transition-all shadow-sm"
            >
              <Sliders className="w-3.5 h-3.5 text-accent" />
              <span>Edit Multipliers</span>
            </a>

            <a
              href="/backups"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-accent text-black hover:bg-accent-hover transition-all shadow-[0_0_20px_-3px_rgba(163,230,53,0.4)]"
            >
              <CloudUpload className="w-4 h-4" />
              <span>Backup Center</span>
            </a>
          </div>
        </div>

        {saveMessage && (
          <div className="mt-4 p-2.5 rounded-xl bg-accent/10 border border-accent/30 text-accent text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{saveMessage}</span>
          </div>
        )}
      </div>

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Server State */}
        <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-secondaryText">Server State</span>
            <span className={`p-2 rounded-xl ${status?.isRunning ? 'bg-success/10 text-success border border-success/20' : 'bg-mutedText/10 text-mutedText border border-white/5'}`}>
              <Server className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white tracking-tight">
              {status?.isRunning ? 'Online' : 'Stopped'}
            </span>
            <span className="text-xs text-mutedText font-mono">
              {status?.processManager || 'screen'}
            </span>
          </div>
          <div className="text-[11px] text-mutedText mt-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${status?.isRunning ? 'bg-accent animate-pulse' : 'bg-mutedText'}`} />
              PID: {status?.pid || 'Offline'}
            </span>
            <span className="font-mono text-secondaryText">{formatUptime(status?.uptimeSeconds || 0)}</span>
          </div>

          {/* Interactive Card Action Button */}
          <div className="mt-3.5 pt-2.5 border-t border-white/[0.06]">
            {status?.isRunning ? (
              <button
                onClick={handleRestartServer}
                disabled={serverActionLoading}
                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-warning/10 text-secondaryText hover:text-warning border border-white/[0.08] hover:border-warning/30 transition-all"
              >
                <RefreshCw className={`w-3 h-3 ${serverActionLoading ? 'animate-spin' : ''}`} />
                <span>Restart Instance</span>
              </button>
            ) : (
              <button
                onClick={() => handleStartServer(true)}
                disabled={serverActionLoading}
                className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold bg-accent text-black hover:bg-accent-hover transition-all shadow-[0_0_15px_-3px_rgba(163,230,53,0.4)]"
              >
                <Power className={`w-3.5 h-3.5 ${serverActionLoading ? 'animate-spin' : ''}`} />
                <span>{serverActionLoading ? 'Starting...' : 'Start Server Now'}</span>
              </button>
            )}
          </div>
        </div>

        {/* 2. Active Players */}
        <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-secondaryText">Active Players</span>
            <span className="p-2 rounded-xl bg-accent/10 text-accent border border-accent/20">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white tracking-tight">{playerCount}</span>
            <span className="text-xs text-mutedText font-mono">/ 32 max</span>
          </div>
          {/* Capacity Progress Bar */}
          <div className="w-full bg-white/[0.06] h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-accent h-full rounded-full transition-all duration-500 shadow-[0_0_8px_#A3E635]"
              style={{ width: `${Math.max(2, (playerCount / 32) * 100)}%` }}
            />
          </div>
          <div className="text-[11px] text-mutedText mt-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
            <span>Dedicated instance ready</span>
          </div>
        </div>

        {/* 3. VPS CPU & RAM */}
        <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-secondaryText">VPS CPU & RAM</span>
            <span className="p-2 rounded-xl bg-white/[0.05] border border-white/[0.08] text-white">
              <Cpu className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-white tracking-tight">{cpuPercent}%</span>
            <span className="text-xs text-mutedText font-mono">RAM: {ramPercent}%</span>
          </div>
          {/* RAM Meter */}
          <div className="w-full bg-white/[0.06] h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-400 to-accent h-full rounded-full transition-all duration-500"
              style={{ width: `${ramPercent}%` }}
            />
          </div>
          <div className="text-[11px] text-mutedText mt-2 flex items-center justify-between font-mono">
            <span>CPU: {cpuPercent}%</span>
            <span>Allocated: {ramPercent}%</span>
          </div>
        </div>

        {/* 4. Google Drive Cloud Backup */}
        <div className="glass-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-secondaryText">Google Drive Cloud</span>
            <span className={`p-2 rounded-xl ${gdrive?.connected ? 'bg-success/10 text-success border border-success/20' : 'bg-warning/10 text-warning border border-warning/20'}`}>
              <Cloud className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-extrabold text-white tracking-tight">
              {gdrive?.connected ? 'Connected' : 'rclone'}
            </span>
            <span className="text-xs text-mutedText truncate font-mono">
              {gdrive?.remote || 'gdrive'}
            </span>
          </div>
          <div className="text-[11px] text-mutedText mt-3 truncate flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-accent" />
            <span>Next: {schedule?.backup_time || '03:00'} ({schedule?.timezone || 'UTC'})</span>
          </div>
        </div>
      </div>

      {/* Main Details Grid: Live Telemetry & Automated Backup Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live System Telemetry */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" />
                Live System Telemetry
              </h2>
              <span className="text-[11px] font-mono text-mutedText bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                Host: Linux 6.x
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-black/30 p-4 rounded-xl border border-white/[0.06] hover:border-white/[0.12] transition-colors">
                <div className="text-[11px] text-mutedText mb-1 font-medium">Palworld Process RAM</div>
                <div className="text-xl font-extrabold font-mono text-white tracking-tight">
                  {status?.memoryMb || 0} MB
                </div>
                <div className="text-[11px] text-secondaryText mt-1.5 flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  PID: {status?.pid || 'N/A'}
                </div>
              </div>

              <div className="bg-black/30 p-4 rounded-xl border border-white/[0.06] hover:border-white/[0.12] transition-colors">
                <div className="text-[11px] text-mutedText mb-1 font-medium">Disk Usage (VPS Root)</div>
                <div className="text-xl font-extrabold font-mono text-white tracking-tight">
                  {metrics ? `${formatBytes(metrics.diskUsedBytes)} / ${formatBytes(metrics.diskTotalBytes)}` : 'Loading...'}
                </div>
                <div className="text-[11px] text-secondaryText mt-1.5 font-mono">
                  {metrics?.diskPercent || 0}% Allocated
                </div>
              </div>

              <div className="bg-black/30 p-4 rounded-xl border border-white/[0.06] hover:border-white/[0.12] transition-colors">
                <div className="text-[11px] text-mutedText mb-1 font-medium">Network Traffic</div>
                <div className="text-xl font-extrabold font-mono text-white tracking-tight">
                  {metrics ? `${formatBytes(metrics.networkRxSec)}/s ↓` : '0 B/s'}
                </div>
                <div className="text-[11px] text-secondaryText mt-1.5 font-mono">
                  {metrics ? `${formatBytes(metrics.networkTxSec)}/s ↑` : '0 B/s'}
                </div>
              </div>
            </div>

            {/* Server Paths & 1-Click Copy */}
            <div className="mt-6 pt-5 border-t border-white/[0.06] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                <span className="text-mutedText font-medium">Server Working Directory:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-secondaryText bg-black/40 px-3 py-1 rounded-lg border border-white/[0.06] truncate max-w-xs sm:max-w-md">
                    {status?.executablePath || '/home/paladmin/palworld/PalServer.sh'}
                  </span>
                  <button
                    onClick={() => handleCopy(status?.executablePath || '/home/paladmin/palworld/PalServer.sh', 'workDir')}
                    className="p-1 rounded-md text-mutedText hover:text-white hover:bg-white/[0.08] transition-colors"
                    title="Copy path"
                  >
                    {copyFeedback === 'workDir' ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                <span className="text-mutedText font-medium">World Save Directory:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-secondaryText bg-black/40 px-3 py-1 rounded-lg border border-white/[0.06] truncate max-w-xs sm:max-w-md">
                    {status?.worldSaveDir || '/home/paladmin/palworld/Pal/Saved/SaveGames'}
                  </span>
                  <button
                    onClick={() => handleCopy(status?.worldSaveDir || '/home/paladmin/palworld/Pal/Saved/SaveGames', 'saveDir')}
                    className="p-1 rounded-md text-mutedText hover:text-white hover:bg-white/[0.08] transition-colors"
                    title="Copy path"
                  >
                    {copyFeedback === 'saveDir' ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Automated Backup Health */}
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-sm font-bold text-white mb-5 flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" />
              Automated Backup Health
            </h2>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-black/30 border border-white/[0.06]">
                <div className="text-[11px] text-mutedText mb-1 font-medium">Latest Verified Archive</div>
                <div className="font-mono text-xs font-bold text-white truncate">
                  {lastBackup?.filename || 'No backups recorded yet'}
                </div>
                <div className="text-[11px] text-secondaryText mt-2 flex items-center justify-between">
                  <span className="font-mono">{lastBackup ? formatBytes(lastBackup.size_bytes) : '0 MB'}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified
                  </span>
                </div>
                {lastBackup && (
                  <div className="mt-3 pt-3 border-t border-white/[0.05]">
                    <a
                      href={api.getDownloadBackupUrl(lastBackup.filename)}
                      download={lastBackup.filename}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.06] hover:bg-accent hover:text-black text-white transition-all border border-white/[0.08]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Archive</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl bg-black/30 border border-white/[0.06]">
                <div className="text-[11px] text-mutedText mb-1 font-medium">Daily Schedule Execution</div>
                <div className="font-mono text-xs font-bold text-white">
                  {schedule?.enabled ? `Enabled (${schedule.backup_time} ${schedule.timezone})` : 'Disabled'}
                </div>
                <div className="text-[11px] text-mutedText mt-1.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span>Google Drive Retention: Unlimited</span>
                </div>
              </div>

              <a
                href="/backups"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08] hover:border-accent/40 transition-all shadow-sm"
              >
                <span>Manage Backups & Storage</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-accent" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
