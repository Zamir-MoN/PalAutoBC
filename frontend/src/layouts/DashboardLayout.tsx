import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Database,
  RotateCcw,
  Sliders,
  Users,
  Terminal,
  FolderTree,
  Activity,
  LogOut,
  Power,
  RefreshCw,
  Server,
  CloudUpload,
  Menu,
  X,
  Radio,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';
import { api } from '../services/api';
import { ServerStatus } from '../types';

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { subscribe, isConnected } = useWebSocket();
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickBackupActive, setQuickBackupActive] = useState(false);

  useEffect(() => {
    api.getServerStatus().then(setServerStatus).catch(() => {});

    const unsub = subscribe('SERVER_STATUS_CHANGE', (status: ServerStatus) => {
      setServerStatus(status);
    });

    const unsubBackup = subscribe('BACKUP_PROGRESS', (payload: any) => {
      if (payload.stage === 'INITIATING' || payload.stage === 'CREATING_ARCHIVE' || payload.stage === 'UPLOADING_GOOGLE_DRIVE') {
        setQuickBackupActive(true);
      } else if (payload.stage === 'COMPLETED' || payload.stage === 'FAILED') {
        setQuickBackupActive(false);
      }
    });

    return () => {
      unsub();
      unsubBackup();
    };
  }, [subscribe]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await api.startServer(true);
      const status = await api.getServerStatus();
      setServerStatus(status);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!window.confirm('Gracefully stop the Palworld server? Active players will be safely saved and disconnected.')) return;
    setActionLoading(true);
    try {
      await api.stopServer();
      const status = await api.getServerStatus();
      setServerStatus(status);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestart = async () => {
    if (!window.confirm('Restart Palworld server now?')) return;
    setActionLoading(true);
    try {
      await api.restartServer();
      const status = await api.getServerStatus();
      setServerStatus(status);
    } finally {
      setActionLoading(false);
    }
  };

  const handleQuickBackup = async () => {
    try {
      setQuickBackupActive(true);
      await api.runBackup();
    } catch (err: any) {
      alert(err.message || 'Backup failed to trigger.');
      setQuickBackupActive(false);
    }
  };

  const navLinks = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/backups', label: 'Backups & Cloud', icon: Database },
    { to: '/restore', label: 'Disaster Recovery', icon: RotateCcw },
    { to: '/config', label: 'Configuration', icon: Sliders },
    { to: '/players', label: 'Active Players', icon: Users },
    { to: '/console', label: 'Live Console', icon: Terminal },
    { to: '/files', label: 'File Manager', icon: FolderTree },
    { to: '/monitoring', label: 'System Telemetry', icon: Activity },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-primaryText">
      {/* Premium Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/[0.06] bg-[#0C0E14]/90 backdrop-blur-xl flex-shrink-0 select-none z-30">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 gap-3 border-b border-white/[0.06]">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center text-accent shadow-[0_0_15px_-3px_rgba(163,230,53,0.3)]">
              <Server className="w-4 h-4" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-accent rounded-full border-2 border-[#0C0E14] shadow-sm" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
              <span>PalAutoBC</span>
              <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-accent/15 text-accent font-extrabold border border-accent/25">
                PRO
              </span>
            </div>
            <div className="text-[11px] text-mutedText flex items-center gap-1 font-mono mt-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent/70" />
              <span>Palworld Server</span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-mutedText/70 font-semibold">
            Management
          </div>
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `group relative flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-accent/10 text-white font-semibold border border-accent/25 shadow-[0_0_20px_-5px_rgba(163,230,53,0.15)]'
                      : 'text-secondaryText hover:text-white hover:bg-white/[0.04]'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon
                        className={`w-4 h-4 transition-colors ${
                          isActive ? 'text-accent' : 'text-mutedText group-hover:text-white'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_#A3E635]" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Live Engine Status Footer */}
        <div className="p-3.5 border-t border-white/[0.06] bg-black/30 m-3 rounded-2xl border">
          <div className="flex items-center justify-between text-xs mb-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {serverStatus?.isRunning && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    serverStatus?.isRunning ? 'bg-accent' : 'bg-mutedText'
                  }`}
                />
              </span>
              <span className="font-mono text-[11px] font-semibold text-white">
                {serverStatus?.isRunning ? 'ONLINE' : 'STOPPED'}
              </span>
              <span className="text-[10px] text-mutedText font-mono">(:8211)</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.05]">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-success' : 'bg-danger'}`} />
              <span className="text-secondaryText">WS</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[11px]">
            <div className="flex items-center gap-2 truncate">
              <div className="w-5 h-5 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-[10px] font-bold text-accent">
                {(user?.username || 'A')[0].toUpperCase()}
              </div>
              <span className="text-secondaryText font-medium truncate">{user?.username || 'admin'}</span>
            </div>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              title="Sign Out"
              className="text-mutedText hover:text-danger p-1 rounded-md hover:bg-danger/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-white/[0.06] bg-[#0A0B0E]/80 backdrop-blur-xl px-4 md:px-6 flex items-center justify-between flex-shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-secondaryText hover:text-white bg-card border border-white/[0.08]"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-sm tracking-tight text-white hidden sm:inline">
                Palworld Dedicated Server
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  serverStatus?.isRunning
                    ? 'bg-success/10 text-success border-success/30 shadow-[0_0_12px_-2px_rgba(34,197,94,0.3)]'
                    : 'bg-danger/10 text-danger border-danger/30'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${serverStatus?.isRunning ? 'bg-success animate-pulse' : 'bg-danger'}`} />
                {serverStatus?.isRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleQuickBackup}
              disabled={quickBackupActive}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                quickBackupActive
                  ? 'bg-accent/10 border-accent/40 text-accent animate-pulse'
                  : 'bg-white/[0.04] hover:bg-white/[0.08] text-white border-white/[0.08] hover:border-accent/40 shadow-sm'
              }`}
            >
              <CloudUpload className="w-3.5 h-3.5 text-accent" />
              <span>{quickBackupActive ? 'Backing Up...' : 'Quick Backup'}</span>
            </button>

            {serverStatus?.isRunning ? (
              <>
                <button
                  onClick={handleRestart}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-warning/10 text-secondaryText hover:text-warning border border-white/[0.08] hover:border-warning/30 transition-all disabled:opacity-50"
                  title="Restart Palworld server"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Restart</span>
                </button>
                <button
                  onClick={handleStop}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 hover:border-danger/50 transition-all disabled:opacity-50"
                  title="Gracefully stop Palworld server"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Stop</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleStart}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-accent text-black hover:bg-accent-hover transition-all shadow-[0_0_20px_-3px_rgba(163,230,53,0.4)] disabled:opacity-50"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Start Server</span>
              </button>
            )}
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/[0.08] bg-[#0C0E14] px-4 py-3 space-y-1 z-30">
            {navLinks.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium ${
                      isActive
                        ? 'bg-accent/10 text-accent font-semibold border border-accent/25'
                        : 'text-secondaryText hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        )}

        {/* Main Routed Page Container */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
