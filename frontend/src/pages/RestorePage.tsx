import React, { useState, useEffect, useRef } from 'react';
import {
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Database,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../services/api';
import { RemoteBackup } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';
import { animatePageEntrance } from '../animations/gsap';

export function RestorePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { subscribe } = useWebSocket();

  const [remoteBackups, setRemoteBackups] = useState<RemoteBackup[]>([]);
  const [selectedBackup, setSelectedBackup] = useState<string>('');
  const [confirmationInput, setConfirmationInput] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStage, setRestoreStage] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    animatePageEntrance(containerRef.current);
    api.getRemoteBackups().then((res) => {
      const list = (Array.isArray(res) ? res : []).sort((a: any, b: any) => {
        const timeA = new Date(a.ModTime || 0).getTime();
        const timeB = new Date(b.ModTime || 0).getTime();
        if (timeA !== timeB) return timeB - timeA;
        return b.Name.localeCompare(a.Name);
      });
      setRemoteBackups(list);
      if (list.length > 0) {
        setSelectedBackup(list[0].Name);
      }
    }).catch(() => {});

    const unsub = subscribe('RESTORE_PROGRESS', (payload: any) => {
      if (payload.stage === 'INITIATING') {
        setIsRestoring(true);
        setRestoreStage('Initiating disaster recovery pipeline...');
      } else if (payload.stage === 'DOWNLOADING_REMOTE') {
        setRestoreStage('Downloading backup archive from Google Drive...');
      } else if (payload.stage === 'VALIDATING_INTEGRITY') {
        setRestoreStage('Extracting to staging and validating Level.sav save game data...');
      } else if (payload.stage === 'STOPPING_SERVER') {
        setRestoreStage('Gracefully stopping active server...');
      } else if (payload.stage === 'CREATING_SAFETY_SNAPSHOT') {
        setRestoreStage('Creating pre-restore safety snapshot of active server...');
      } else if (payload.stage === 'RESTORING_FILES') {
        setRestoreStage('Deploying verified files and enforcing Linux file permissions...');
      } else if (payload.stage === 'STARTING_SERVER') {
        setRestoreStage('Starting server and verifying port 8211 listener...');
      } else if (payload.stage === 'COMPLETED') {
        setIsRestoring(false);
        setRestoreStage('');
        setStatusMessage(`Restoration of ${payload.filename} completed successfully!`);
      } else if (payload.stage === 'FAILED') {
        setIsRestoring(false);
        setRestoreStage('');
        setErrorMessage(`Restoration failed: ${payload.error}`);
      }
    });

    return unsub;
  }, [subscribe]);

  const handleExecuteRestore = async () => {
    if (!selectedBackup) return;
    if (confirmationInput !== 'RESTORE') {
      alert('Please type RESTORE into the confirmation field to proceed.');
      return;
    }

    setIsRestoring(true);
    setStatusMessage('');
    setErrorMessage('');
    setRestoreStage('Starting restoration...');

    try {
      await api.restoreBackup(selectedBackup);
    } catch (err: any) {
      setErrorMessage(err.message || 'Restoration failed');
      setIsRestoring(false);
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
    <div ref={containerRef} className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-accent" />
          Disaster Recovery & Restoration
        </h1>
        <p className="text-xs text-mutedText mt-0.5">
          Safely restore previous Palworld server states with staged validation and automated pre-restore snapshots.
        </p>
      </div>

      {/* Progress Alert */}
      {isRestoring && (
        <div className="p-4 rounded-xl bg-card border border-accent/40 shadow-md">
          <div className="flex items-center gap-3">
            <RotateCcw className="w-5 h-5 text-accent animate-spin flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-white">Restore Operation In Progress</div>
              <div className="text-xs text-accent mt-0.5 font-mono">{restoreStage}</div>
            </div>
          </div>
        </div>
      )}

      {statusMessage && (
        <div className="p-4 rounded-xl bg-success/10 border border-success/30 text-success text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Restore Safety Checklist Card */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-accent" />
          Zero-Risk Restoration Safeguards
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-secondaryText">
          <div className="p-3 rounded-lg bg-secondary/60 border border-border/50">
            <span className="font-semibold text-white block mb-1">1. Pre-Restore Safety Snapshot</span>
            Your current active world and files are automatically compressed into a local fallback before overwriting.
          </div>
          <div className="p-3 rounded-lg bg-secondary/60 border border-border/50">
            <span className="font-semibold text-white block mb-1">2. Staged Validation</span>
            The archive is downloaded and unpacked in an isolated staging folder to verify Level.sav integrity.
          </div>
          <div className="p-3 rounded-lg bg-secondary/60 border border-border/50">
            <span className="font-semibold text-white block mb-1">3. Automated Startup</span>
            Executables and permissions are strictly enforced before starting the server.
          </div>
        </div>
      </div>

      {/* Restoration Execution Form */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5">
        <div>
          <label className="block text-xs font-semibold text-white mb-2">Select Google Drive Backup Archive</label>
          <select
            value={selectedBackup}
            onChange={(e) => setSelectedBackup(e.target.value)}
            disabled={isRestoring}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-accent font-mono"
          >
            {remoteBackups.map((b) => (
              <option key={b.Name} value={b.Name}>
                {b.Name} — ({formatBytes(b.Size)}) — {new Date(b.ModTime).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>

        <div className="p-4 rounded-lg bg-danger/10 border border-danger/20 text-danger text-xs space-y-2">
          <div className="font-bold flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" />
            Warning: Destructive State Operation
          </div>
          <p>
            Restoring will stop the active Palworld server and roll back all character progressions, world saves, and settings to the selected snapshot.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-secondaryText mb-1.5">
            Type <span className="font-mono text-white font-bold">RESTORE</span> to confirm:
          </label>
          <input
            type="text"
            value={confirmationInput}
            onChange={(e) => setConfirmationInput(e.target.value)}
            placeholder="RESTORE"
            disabled={isRestoring}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-danger font-mono"
          />
        </div>

        <button
          onClick={handleExecuteRestore}
          disabled={isRestoring || confirmationInput !== 'RESTORE'}
          className="w-full bg-danger hover:bg-danger/80 text-white font-semibold text-xs py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span>{isRestoring ? 'Restoring Server State...' : 'Confirm & Restore Palworld Server'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

