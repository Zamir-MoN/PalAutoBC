import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Save,
  History,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Shield,
  Eye,
  EyeOff,
  Zap,
  Clock,
} from 'lucide-react';
import { api } from '../services/api';
import { ConfigSnapshot } from '../types';
import { animatePageEntrance } from '../animations/gsap';

export function ConfigPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [rawIni, setRawIni] = useState<string>('');
  const [snapshots, setSnapshots] = useState<ConfigSnapshot[]>([]);
  const [activeTab, setActiveTab] = useState<'visual' | 'raw'>('visual');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const [res, snaps] = await Promise.all([
        api.getConfigSettings().catch(() => ({ raw: '', parsed: {} })),
        api.getConfigSnapshots().catch(() => []),
      ]);
      setSettings(res?.parsed || {});
      setRawIni(res?.raw || '');
      setSnapshots(Array.isArray(snaps) ? snaps : []);
    } catch (err: any) {
      setError(err.message || 'Failed to read PalWorldSettings.ini');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (!loading && containerRef.current) {
      try {
        animatePageEntrance(containerRef.current);
      } catch {}
    }
  }, [loading]);

  const handleChange = (key: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      let res;
      if (activeTab === 'raw') {
        res = await api.updateConfigSettings({ rawContent: rawIni });
      } else {
        res = await api.updateConfigSettings({ settings });
      }
      setMessage(res.message);
      // Reload both parsed and raw to sync
      const [newConfig, snaps] = await Promise.all([
        api.getConfigSettings().catch(() => ({ raw: '', parsed: {} })),
        api.getConfigSnapshots().catch(() => []),
      ]);
      setSettings(newConfig?.parsed || {});
      setRawIni(newConfig?.raw || '');
      setSnapshots(Array.isArray(snaps) ? snaps : []);
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
            PalWorldSettings.ini parameters, stamina/weight multipliers, and version snapshot history
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="flex bg-secondary p-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('visual')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === 'visual' ? 'bg-card text-white shadow-sm' : 'text-mutedText hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Visual Form</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('raw')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                activeTab === 'raw' ? 'bg-card text-white shadow-sm' : 'text-mutedText hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Raw INI Text</span>
            </button>
          </div>

          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-accent text-black hover:bg-accent-hover transition-all disabled:opacity-50 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving Changes...' : 'Save Settings'}</span>
          </button>
        </div>
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

      {activeTab === 'raw' ? (
        /* Raw INI Text Editor */
        <div className="glass-panel rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-accent" />
              Direct PalWorldSettings.ini Editor
            </h2>
            <span className="text-[11px] text-mutedText font-mono">LinuxServer/PalWorldSettings.ini</span>
          </div>
          <textarea
            value={rawIni}
            onChange={(e) => setRawIni(e.target.value)}
            rows={12}
            className="w-full bg-secondary border border-border rounded-lg p-3 text-xs text-white font-mono focus:outline-none focus:border-accent leading-relaxed resize-y"
            placeholder="[/Script/Pal.PalGameWorldSettings]&#10;OptionSettings=(...)"
          />
          <p className="text-[11px] text-mutedText">
            You can paste your complete <code className="text-accent">OptionSettings=(...)</code> line here directly. When saved, an automated backup snapshot will be recorded.
          </p>
        </div>
      ) : (
        /* Visual Form Sections */
        <div className="space-y-6">
          {/* 1. General & Security */}
          <div className="glass-panel rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent" />
                General & Authentication
              </h2>
              <button
                type="button"
                onClick={() => setShowPasswords(!showPasswords)}
                className="text-xs text-mutedText hover:text-white flex items-center gap-1"
              >
                {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showPasswords ? 'Hide Passwords' : 'Show Passwords'}</span>
              </button>
            </div>

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
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Server Password (Join Password)</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={settings.ServerPassword ?? ''}
                  onChange={(e) => handleChange('ServerPassword', e.target.value)}
                  placeholder="Optional join password"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Admin Password (RCON / Admin)</label>
                <input
                  type={showPasswords ? 'text' : 'password'}
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
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Public Game Port</label>
                <input
                  type="number"
                  value={settings.PublicPort ?? 8211}
                  onChange={(e) => handleChange('PublicPort', Number(e.target.value))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Crossplay Platforms</label>
                <input
                  type="text"
                  value={settings.CrossplayPlatforms ?? '(Steam,Xbox,PS5,Mac)'}
                  onChange={(e) => handleChange('CrossplayPlatforms', e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
                />
              </div>

              <div className="flex items-center gap-6 pt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.RCONEnabled)}
                    onChange={(e) => handleChange('RCONEnabled', e.target.checked)}
                    className="w-4 h-4 rounded bg-secondary border-border text-accent focus:ring-0"
                  />
                  <span className="text-xs font-medium text-white">Enable RCON</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.bAllowClientMod)}
                    onChange={(e) => handleChange('bAllowClientMod', e.target.checked)}
                    className="w-4 h-4 rounded bg-secondary border-border text-accent focus:ring-0"
                  />
                  <span className="text-xs font-medium text-white">Allow Client Mods</span>
                </label>
              </div>
            </div>
          </div>

          {/* 2. Survival, Stamina & Item Rates */}
          <div className="glass-panel rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-white border-b border-border/60 pb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
              Survival, Stamina & Weight Rates
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Item Weight Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  value={settings.ItemWeightRate ?? 0.2}
                  onChange={(e) => handleChange('ItemWeightRate', Number(e.target.value))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
                />
                <span className="text-[10px] text-mutedText">0.2 = items weigh 80% less</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Player Stamina Decrease Rate</label>
                <input
                  type="number"
                  step="0.05"
                  value={settings.PlayerStaminaDecreaceRate ?? 0.1}
                  onChange={(e) => handleChange('PlayerStaminaDecreaceRate', Number(e.target.value))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
                />
                <span className="text-[10px] text-mutedText">0.1 = stamina lasts 10x longer</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Pal Stamina Decrease Rate</label>
                <input
                  type="number"
                  step="0.05"
                  value={settings.PalStaminaDecreaceRate ?? 0.1}
                  onChange={(e) => handleChange('PalStaminaDecreaceRate', Number(e.target.value))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
                />
                <span className="text-[10px] text-mutedText">0.1 = mounts sprint 10x longer</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Pal Hunger / Stomach Drain</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.PalStomachDecreaceRate ?? 0.5}
                  onChange={(e) => handleChange('PalStomachDecreaceRate', Number(e.target.value))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Egg Hatching Time (Hours)</label>
                <input
                  type="number"
                  step="0.5"
                  value={settings.PalEggDefaultHatchingTime ?? 0.0}
                  onChange={(e) => handleChange('PalEggDefaultHatchingTime', Number(e.target.value))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
                />
                <span className="text-[10px] text-mutedText">0.0 = instant egg incubation</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Food Spoil Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.ItemCorruptionMultiplier ?? 0.0}
                  onChange={(e) => handleChange('ItemCorruptionMultiplier', Number(e.target.value))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
                />
                <span className="text-[10px] text-mutedText">0.0 = food never spoils</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Death Penalty</label>
                <select
                  value={settings.DeathPenalty ?? 'None'}
                  onChange={(e) => handleChange('DeathPenalty', e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                >
                  <option value="None">None (Keep all items & equipment)</option>
                  <option value="Item">Item (Drop only inventory items)</option>
                  <option value="ItemAndEquipment">ItemAndEquipment (Drop items + gear)</option>
                  <option value="All">All (Drop items, gear, and Pals)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Supply Drop Interval (Min)</label>
                <input
                  type="number"
                  value={settings.SupplyDropSpan ?? 180}
                  onChange={(e) => handleChange('SupplyDropSpan', Number(e.target.value))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Pal Auto HP Regeneration</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.PalAutoHPRegeneRate ?? 1.0}
                  onChange={(e) => handleChange('PalAutoHPRegeneRate', Number(e.target.value))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
                />
              </div>
            </div>
          </div>

          {/* 3. Multipliers & Spawns */}
          <div className="glass-panel rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-white border-b border-border/60 pb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" />
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
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Work Speed Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.WorkSpeedRate ?? 1.0}
                  onChange={(e) => handleChange('WorkSpeedRate', Number(e.target.value))}
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
            </div>
          </div>

          {/* 4. Bases, Guilds & PvP */}
          <div className="glass-panel rounded-2xl p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-white border-b border-border/60 pb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" />
              Bases, Guilds & PvP Combat
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Base Camp Worker Max</label>
                <input
                  type="number"
                  value={settings.BaseCampWorkerMaxNum ?? 15}
                  onChange={(e) => handleChange('BaseCampWorkerMaxNum', Number(e.target.value))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Base Camp Max In Guild</label>
                <input
                  type="number"
                  value={settings.BaseCampMaxNumInGuild ?? 8}
                  onChange={(e) => handleChange('BaseCampMaxNumInGuild', Number(e.target.value))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-secondaryText mb-1.5">Guild Player Max Num</label>
                <input
                  type="number"
                  value={settings.GuildPlayerMaxNum ?? 20}
                  onChange={(e) => handleChange('GuildPlayerMaxNum', Number(e.target.value))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent font-mono"
                />
              </div>

              <div className="col-span-full flex flex-wrap items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.bIsPvP)}
                    onChange={(e) => handleChange('bIsPvP', e.target.checked)}
                    className="w-4 h-4 rounded bg-secondary border-border text-accent focus:ring-0"
                  />
                  <span className="text-xs font-medium text-white">Enable PvP</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.bEnablePlayerToPlayerDamage)}
                    onChange={(e) => handleChange('bEnablePlayerToPlayerDamage', e.target.checked)}
                    className="w-4 h-4 rounded bg-secondary border-border text-accent focus:ring-0"
                  />
                  <span className="text-xs font-medium text-white">Player to Player Damage</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.bEnableFriendlyFire)}
                    onChange={(e) => handleChange('bEnableFriendlyFire', e.target.checked)}
                    className="w-4 h-4 rounded bg-secondary border-border text-accent focus:ring-0"
                  />
                  <span className="text-xs font-medium text-white">Friendly Fire</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.bAllowGlobalPalboxExport)}
                    onChange={(e) => handleChange('bAllowGlobalPalboxExport', e.target.checked)}
                    className="w-4 h-4 rounded bg-secondary border-border text-accent focus:ring-0"
                  />
                  <span className="text-xs font-medium text-white">Allow Palbox Export</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.bAllowGlobalPalboxImport)}
                    onChange={(e) => handleChange('bAllowGlobalPalboxImport', e.target.checked)}
                    className="w-4 h-4 rounded bg-secondary border-border text-accent focus:ring-0"
                  />
                  <span className="text-xs font-medium text-white">Allow Palbox Import</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Snapshot Version History */}
      <div className="glass-panel rounded-2xl p-6 shadow-sm">
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
              {!Array.isArray(snapshots) || snapshots.length === 0 ? (
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
