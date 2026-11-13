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
  Cloud,
  Menu,
  X,
  AlertCircle,
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

  useEffect(() => {
    // Initial fetch
    api.getServerStatus().then(setServerStatus).catch(() => {});

    // Listen for real-time status changes
    const unsub = subscribe('SERVER_STATUS_CHANGE', (status: ServerStatus) => {
      setServerStatus(status);
    });

    return unsub;
  }, [subscribe]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await api.startServer();
      const status = await api.getServerStatus();
      setServerStatus(status);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!window.confirm('Are you sure you want to gracefully stop the Palworld server? Active players will be disconnected.')) return;
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

  const navLinks = [
    { to: '/', label: 'Overview', icon: LayoutDashboard },
    { to: '/backups', label: 'Backups & G-Drive', icon: Database },
    { to: '/restore', label: 'Disaster Recovery', icon: RotateCcw },
    { to: '/config', label: 'Configuration', icon: Sliders },
    { to: '/players', label: 'Players', icon: Users },
    { to: '/console', label: 'Live Console', icon: Terminal },
    { to: '/files', label: 'File Manager', icon: FolderTree },
    { to: '/monitoring', label: 'System Telemetry', icon: Activity },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-primaryText">
      {/* Desktop / Tablet Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-secondary flex-shrink-0 select-none">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 gap-3 border-b border-border">
          <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
              PalAutoBC
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-accent/20 text-accent font-bold">
                VPS
              </span>
            </div>
            <div className="text-[11px] text-mutedText truncate">Palworld Management</div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-card text-white border border-border shadow-sm'
                      : 'text-secondaryText hover:text-white hover:bg-card/50'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Live Engine Status Footer */}
        <div className="p-4 border-t border-border bg-background/50">
          <div className="flex items-center justify-between text-xs mb-3">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  serverStatus?.isRunning ? 'bg-success animate-pulse' : 'bg-mutedText'
                }`}
              />
              <span className="font-mono text-[11px] text-secondaryText">
                {serverStatus?.isRunning ? 'ONLINE (8211)' : 'OFFLINE'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-mutedText">
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-success' : 'bg-danger'}`} />
              <span>WS</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] text-mutedText">
            <span className="truncate">Admin: {user?.username}</span>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              title="Sign Out"
              className="hover:text-danger p-1 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border bg-secondary/80 backdrop-blur px-4 md:px-6 flex items-center justify-between flex-shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-secondaryText hover:text-white hover:bg-card border border-border"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <div className="text-sm font-semibold text-white tracking-tight flex items-center gap-2">
              <span className="hidden sm:inline">Palworld Dedicated Server</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono ${
                  serverStatus?.isRunning
                    ? 'bg-success/10 text-success border border-success/20'
                    : 'bg-danger/10 text-danger border border-danger/20'
                }`}
              >
                {serverStatus?.isRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
          </div>

          {/* Quick Server Action Controls */}
          <div className="flex items-center gap-2">
            {serverStatus?.isRunning ? (
              <>
                <button
                  onClick={handleRestart}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-card hover:bg-border text-secondaryText hover:text-white border border-border transition-all disabled:opacity-50"
                  title="Restart Server"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Restart</span>
                </button>
                <button
                  onClick={handleStop}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-danger/10 hover:bg-danger/20 text-danger border border-danger/30 transition-all disabled:opacity-50"
                  title="Gracefully Stop Server"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Stop</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleStart}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-accent text-black hover:bg-accent-hover font-semibold transition-all disabled:opacity-50 shadow-sm"
                title="Start Server"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Start Server</span>
              </button>
            )}
          </div>
        </header>

        {/* Mobile Slideout Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 top-16 z-30 bg-background/95 backdrop-blur-md flex flex-col p-4 border-b border-border animate-in fade-in duration-200">
            <nav className="space-y-1">
              {navLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-card text-white border border-border'
                          : 'text-secondaryText hover:text-white hover:bg-card/50'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-auto pt-4 border-t border-border flex justify-between items-center text-xs text-mutedText">
              <span>Logged in as: {user?.username}</span>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="text-danger flex items-center gap-1 font-medium"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>
        )}

        {/* Route Content Area (with iOS Safe Area insets) */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

