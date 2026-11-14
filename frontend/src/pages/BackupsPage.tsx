import React, { useState, useEffect, useRef } from 'react';
import {
  Database,
  CloudUpload,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  RotateCw,
  HardDrive,
  ExternalLink,
  ShieldAlert,
  Download,
} from 'lucide-react';
import { api } from '../services/api';
import { BackupHistoryItem, RemoteBackup, BackupSchedule } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';
import { animatePageEntrance } from '../animations/gsap';

export function BackupsPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { subscribe } = useWebSocket();

  const [history, setHistory] = useState<BackupHistoryItem[]>([]);
  const [remoteBackups, setRemoteBackups] = useState<RemoteBackup[]>([]);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [scheduleTime, setScheduleTime] = useState('03:00');
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleTimezone, setScheduleTimezone] = useState('UTC');
  const [isRunningBackup, setIsRunningBackup] = useState(false);
  const [backupStage, setBackupStage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const loadData = async () => {
    try {
      const [hist, rem, sched] = await Promise.all([
        api.getBackupHistory(),
        api.getRemoteBackups(),
        api.getScheduler(),
      ]);
      setHistory(Array.isArray(hist) ? hist : []);
      const sortedRemote = (Array.isArray(rem) ? rem : []).sort((a: any, b: any) => {
        const timeA = new Date(a.ModTime || 0).getTime();
        const timeB = new Date(b.ModTime || 0).getTime();
        if (timeA !== timeB) return timeB - timeA;
        return b.Name.localeCompare(a.Name);
      });
      setRemoteBackups(sortedRemote);
      if (sched) {
        setSchedule(sched);
        setScheduleTime(sched.backup_time || '03:00');
        setScheduleEnabled(Boolean(sched.enabled));
        setScheduleTimezone(sched.timezone || 'UTC');
      }
    } catch {}
  };

  useEffect(() => {
    animatePageEntrance(containerRef.current);
    loadData();

    const unsub = subscribe('BACKUP_PROGRESS', (payload: any) => {
      if (payload.stage === 'INITIATING') {
        setIsRunningBackup(true);
        setBackupStage('Preparing backup and checking server state...');
      } else if (payload.stage === 'STOPPING_SERVER') {
        setBackupStage('Gracefully stopping Palworld server for data consistency...');
      } else if (payload.stage === 'CREATING_ARCHIVE') {
        setBackupStage('Creating compressed ZIP archive (world data & config)...');
      } else if (payload.stage === 'UPLOADING_GOOGLE_DRIVE') {
        setBackupStage('Streaming archive to Google Drive via rclone...');
      } else if (payload.stage === 'VERIFYING_REMOTE') {
        setBackupStage('Verifying remote archive existence and SHA256 integrity...');
      } else if (payload.stage === 'COMPLETED') {
        setIsRunningBackup(false);
        setBackupStage('');
        setSuccessMsg(`Backup ${payload.filename} completed and stored on Google Drive successfully!`);
        loadData();
      } else if (payload.stage === 'FAILED') {
        setIsRunningBackup(false);
        setBackupStage('');
        setErrorMsg(`Backup failed: ${payload.error}. Guaranteed restart was executed.`);
        loadData();
      }
    });

    return unsub;
  }, [subscribe]);

  const handleRunManualBackup = async () => {
    if (!window.confirm('Trigger full Palworld server backup now? The server will be stopped briefly to guarantee save integrity, then automatically restarted.')) return;

    setErrorMsg('');
    setSuccessMsg('');
    setIsRunningBackup(true);
    setBackupStage('Initiating backup engine...');

    try {
      await api.runBackup();
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Backup failed');
    } finally {
      setIsRunningBackup(false);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await api.updateScheduler({
        time: scheduleTime,
        enabled: scheduleEnabled,
        timezone: scheduleTimezone,
      });
      setSchedule(updated);
      setSuccessMsg('Automated daily backup schedule updated.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update schedule');
    }
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Full Server Backups & Google Drive</h1>
          <p className="text-xs text-mutedText mt-0.5">Automated daily snapshots, rclone cloud storage, and fail-safe recovery</p>
        </div>
        <button
          onClick={handleRunManualBackup}
          disabled={isRunningBackup}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-accent text-black hover:bg-accent-hover transition-all disabled:opacity-50 shadow-sm"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isRunningBackup ? 'Executing Backup...' : 'Create Backup Now'}</span>
        </button>
      </div>

      {/* Progress Alert Banner */}
      {isRunningBackup && (
        <div className="p-4 rounded-xl bg-card border border-accent/40 shadow-md">
          <div className="flex items-center gap-3">
            <RotateCw className="w-5 h-5 text-accent animate-spin flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-white">Backup Engine Active</div>
              <div className="text-xs text-accent mt-0.5 font-mono">{backupStage}</div>
            </div>
          </div>
        </div>
      )}

      {/* Success / Error Banners */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-success/10 border border-success/30 text-success text-xs flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} className="hover:opacity-75">✕</button>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>{errorMsg}</span>
            {(errorMsg.toLowerCase().includes('already active') || errorMsg.toLowerCase().includes('in progress')) && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await api.unlockBackup();
                    setErrorMsg('');
                    setSuccessMsg('Lock reset successfully. You can now click Create Backup Now.');
                  } catch {}
                }}
                className="underline text-white hover:text-accent font-bold ml-2 cursor-pointer bg-white/10 px-2 py-0.5 rounded"
              >
                Reset Lock Now
              </button>
            )}
          </div>
          <button onClick={() => setErrorMsg('')} className="hover:opacity-75">✕</button>
        </div>
      )}

      {/* Scheduler Configuration Card */}
      <div className="glass-panel rounded-2xl p-6 shadow-sm">
        <h2 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-accent" />
          Automated Daily Backup Schedule
        </h2>

        <form onSubmit={handleSaveSchedule} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-secondaryText mb-1.5">Daily Execution Time</label>
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.08] focus:border-accent rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-secondaryText mb-1.5">Timezone</label>
            <select
              value={scheduleTimezone}
              onChange={(e) => setScheduleTimezone(e.target.value)}
              className="w-full bg-black/40 border border-white/[0.08] focus:border-accent rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none font-mono"
            >
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="America/New_York">America/New_York (EST/EDT)</option>
              <option value="Europe/London">Europe/London (GMT/BST)</option>
              <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
              <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
            </select>
          </div>

          <div className="flex items-center gap-2.5 h-10">
            <input
              type="checkbox"
              id="sched-enabled"
              checked={scheduleEnabled}
              onChange={(e) => setScheduleEnabled(e.target.checked)}
              className="w-4 h-4 rounded-md bg-black/40 border-white/[0.15] text-accent focus:ring-accent"
            />
            <label htmlFor="sched-enabled" className="text-xs font-medium text-white cursor-pointer select-none">
              Enable Daily Automated Backup
            </label>
          </div>

          <div>
            <button
              type="submit"
              className="w-full bg-white/[0.05] hover:bg-white/[0.1] text-white border border-white/[0.08] hover:border-accent/40 text-xs font-semibold py-2.5 rounded-xl transition-all shadow-sm"
            >
              Update Schedule
            </button>
          </div>
        </form>
      </div>

      {/* Google Drive Archives Table */}
      <div className="glass-panel rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <CloudUpload className="w-4 h-4 text-accent" />
            Google Drive Backup Archives (Retention: Unlimited)
          </h2>
          <span className="text-xs font-mono text-mutedText bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/[0.06]">
            Total Archives: {remoteBackups.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-mutedText font-medium">
                <th className="pb-3 pl-3">Archive Name</th>
                <th className="pb-3">Size</th>
                <th className="pb-3">Timestamp</th>
                <th className="pb-3 pr-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04] font-mono">
              {remoteBackups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-mutedText font-sans">
                    No remote backups found in Google Drive folder.
                  </td>
                </tr>
              ) : (
                remoteBackups.map((b) => (
                  <tr key={b.Name} className="hover:bg-white/[0.03] transition-colors group">
                    <td className="py-3.5 pl-3 font-semibold text-white flex items-center gap-2.5">
                      <div className="p-1 rounded-md bg-accent/10 border border-accent/20 text-accent">
                        <Database className="w-3.5 h-3.5" />
                      </div>
                      <span className="group-hover:text-accent transition-colors">{b.Name}</span>
                    </td>
                    <td className="py-3.5 text-secondaryText">{formatBytes(b.Size)}</td>
                    <td className="py-3.5 text-mutedText">{new Date(b.ModTime).toLocaleString()}</td>
                    <td className="py-3.5 pr-3 text-right font-sans">
                      <div className="inline-flex items-center gap-2.5">
                        <a
                          href={api.getDownloadBackupUrl(b.Name)}
                          download={b.Name}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-accent hover:text-black text-white text-xs font-semibold transition-all border border-white/[0.08] shadow-sm"
                          title="Download directly to your computer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                        <a
                          href="/restore"
                          className="inline-flex items-center gap-1 text-xs text-accent hover:underline font-semibold"
                        >
                          Restore Options
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

