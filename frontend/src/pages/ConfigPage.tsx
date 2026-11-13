import React, { useState, useEffect, useRef } from 'react';
import { Sliders, Save, History, RotateCcw, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { api } from '../services/api';
import { ConfigSnapshot } from '../types';
import { animatePageEntrance } from '../animations/gsap';

export function ConfigPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [snapshots, setSnapshots] = useState<ConfigSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadConfig = async () => {
    try {
      setLoading(true);
      const [res, snaps] = await Promise.all([
        api.getConfigSettings(),
        api.getConfigSnapshots(),
      ]);
      setSettings(res.parsed || {});
      setSnapshots(snaps || []);
    } catch (err: any) {
      setError(err.message || 'Failed to read PalWorldSettings.ini');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    animatePageEntrance(containerRef.current);
    loadConfig();
  }, []);

  const handleChange = (key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const res = await api.updateConfigSettings(settings);
      setMessage(res.message);
      const snaps = await api.getConfigSnapshots();
      setSnapshots(snaps);
    } catch (err: any) {
      setError(err.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreSnapshot = async (id: string) => {
    if (!window.confirm('Restore this configuration snapshot?')) return;
    try {
      await api.restoreConfigSnapshot(id);
      setMessage('Configuration restored from snapshot.');
      loadConfig();
    } catch (err: any) {
      setError(err.message || 'Snapshot restore failed');
    }
  };

  if (loading) {
    return <div className="text-xs text-mutedText p-6">Loading Palworld server configuration...</div>;
  }

  return (
    <div ref={containerRef} className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-accent" />
            Server Configuration Editor
          </h1>
          <p className="text-xs text-mutedText mt-0.5">
            Modify PalWorldSettings.ini parameters with automated version snapshots
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-accent text-black hover:bg-accent-hover transition-all disabled:opacity-50 shadow-sm"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{saving ? 'Saving Changes...' : 'Save Settings'}</span>
        </button>
      </div>

      {message && (
        <div className="p-3.5 rounded-xl bg-success/10 border border-success/30 text-success text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Server Info */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-white border-b border-border/60 pb-3">
            General & Authentication
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-secondaryText mb-1.5">Server Name</label>
              <input
                type="text"
                value={settings.ServerName ?? ''}
                onChange={(e) => handleChange('ServerName', e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondaryText mb-1.5">Server Description</label>
              <input
                type="text"
                value={settings.ServerDescription ?? ''}
                onChange={(e) => handleChange('ServerDescription', e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondaryText mb-1.5">Server Password (Leave blank for public)</label>
              <input
                type="password"
                value={settings.ServerPassword ?? ''}
                onChange={(e) => handleChange('ServerPassword', e.target.value)}
                placeholder="Optional client password"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondaryText mb-1.5">Admin Password (RCON / In-game Admin)</label>
              <input
                type="password"
                value={settings.AdminPassword ?? ''}
                onChange={(e) => handleChange('AdminPassword', e.target.value)}
                placeholder="Admin password"
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondaryText mb-1.5">Max Players</label>
              <input
                type="number"
                value={settings.ServerPlayerMaxNum ?? 32}
                onChange={(e) => handleChange('ServerPlayerMaxNum', Number(e.target.value))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondaryText mb-1.5">Server Game Port</label>
              <input
                type="number"
                value={settings.ServerPort ?? 8211}
                onChange={(e) => handleChange('ServerPort', Number(e.target.value))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
              />
            </div>
          </div>
        </div>

        {/* Gameplay & World Rates */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-white border-b border-border/60 pb-3">
            Gameplay & Multipliers
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-secondaryText mb-1.5">EXP Rate Multiplier</label>
              <input
                type="number"
                step="0.1"
                value={settings.ExpRate ?? 1.0}
                onChange={(e) => handleChange('ExpRate', Number(e.target.value))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondaryText mb-1.5">Pal Capture Rate</label>
              <input
                type="number"
                step="0.1"
                value={settings.PalCaptureRate ?? 1.0}
                onChange={(e) => handleChange('PalCaptureRate', Number(e.target.value))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondaryText mb-1.5">Pal Spawn Multiplier</label>
              <input
                type="number"
                step="0.1"
                value={settings.PalSpawnNumRate ?? 1.0}
                onChange={(e) => handleChange('PalSpawnNumRate', Number(e.target.value))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondaryText mb-1.5">Day Time Speed Rate</label>
              <input
                type="number"
                step="0.1"
                value={settings.DayTimeSpeedRate ?? 1.0}
                onChange={(e) => handleChange('DayTimeSpeedRate', Number(e.target.value))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondaryText mb-1.5">Night Time Speed Rate</label>
              <input
                type="number"
                step="0.1"
                value={settings.NightTimeSpeedRate ?? 1.0}
                onChange={(e) => handleChange('NightTimeSpeedRate', Number(e.target.value))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-secondaryText mb-1.5">Guild Player Max Count</label>
              <input
                type="number"
                value={settings.GuildPlayerMaxNum ?? 20}
                onChange={(e) => handleChange('GuildPlayerMaxNum', Number(e.target.value))}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
              />
            </div>
          </div>
        </div>
      </form>

      {/* Snapshot Version History */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <History className="w-4 h-4 text-accent" />
          Configuration Version Snapshots
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/80 text-mutedText font-medium">
                <th className="pb-3 pl-2">Created At</th>
                <th className="pb-3">Author</th>
                <th className="pb-3">Description</th>
                <th className="pb-3 pr-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {snapshots.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-mutedText font-sans">
                    No snapshots recorded yet.
                  </td>
                </tr>
              ) : (
                snapshots.map((s) => (
                  <tr key={s.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="py-2.5 pl-2 text-white">{new Date(s.created_at).toLocaleString()}</td>
                    <td className="py-2.5 text-secondaryText">{s.created_by || 'admin'}</td>
                    <td className="py-2.5 text-mutedText font-sans">{s.comment || 'Automatic Snapshot'}</td>
                    <td className="py-2.5 pr-2 text-right font-sans">
                      <button
                        onClick={() => handleRestoreSnapshot(s.id)}
                        className="text-xs text-accent hover:underline inline-flex items-center gap-1 font-medium"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Rollback
                      </button>
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

