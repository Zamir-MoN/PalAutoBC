import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  Network,
  Clock,
  Layers,
  Server,
  Zap,
} from 'lucide-react';
import { api } from '../services/api';
import { SystemMetrics } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';
import { animatePageEntrance } from '../animations/gsap';

export function MonitoringPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { subscribe } = useWebSocket();
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);

  useEffect(() => {
    animatePageEntrance(containerRef.current);
    api.getMetrics().then(setMetrics).catch(() => {});

    const unsub = subscribe('METRICS_UPDATE', (payload: SystemMetrics) => {
      setMetrics(payload);
    });

    return unsub;
  }, [subscribe]);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return '0s';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  return (
    <div ref={containerRef} className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-accent" />
          VPS Performance & Hardware Telemetry
        </h1>
        <p className="text-xs text-mutedText mt-0.5">Real-time resource utilization, memory limits, and network throughput</p>
      </div>

      {/* Main Gauges Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* CPU Load Gauge */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-accent" />
              CPU Utilization
            </span>
            <span className="text-xs font-mono text-mutedText">{metrics?.cpuCores || 4} Cores</span>
          </div>

          <div className="text-3xl font-extrabold font-mono text-white tracking-tight">
            {metrics?.cpuUsagePercent ?? 0}%
          </div>

          <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-accent h-full rounded-full transition-all duration-300"
              style={{ width: `${metrics?.cpuUsagePercent || 0}%` }}
            />
          </div>

          <div className="text-[11px] text-mutedText flex justify-between pt-1">
            <span>Palworld Server Thread Load:</span>
            <span className="font-mono text-secondaryText">{metrics?.serverProcessCpu || 0}%</span>
          </div>
        </div>

        {/* RAM Usage Gauge */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-accent" />
              System Memory (RAM)
            </span>
            <span className="text-xs font-mono text-mutedText">{metrics?.memoryPercent ?? 0}%</span>
          </div>

          <div className="text-3xl font-extrabold font-mono text-white tracking-tight">
            {metrics ? formatBytes(metrics.memoryUsedBytes) : '0 MB'}
          </div>

          <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-accent h-full rounded-full transition-all duration-300"
              style={{ width: `${metrics?.memoryPercent || 0}%` }}
            />
          </div>

          <div className="text-[11px] text-mutedText flex justify-between pt-1">
            <span>Total Physical RAM:</span>
            <span className="font-mono text-secondaryText">{metrics ? formatBytes(metrics.memoryTotalBytes) : '0 MB'}</span>
          </div>
        </div>

        {/* Disk Space Gauge */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-accent" />
              Disk Storage (Root FS)
            </span>
            <span className="text-xs font-mono text-mutedText">{metrics?.diskPercent ?? 0}%</span>
          </div>

          <div className="text-3xl font-extrabold font-mono text-white tracking-tight">
            {metrics ? formatBytes(metrics.diskUsedBytes) : '0 GB'}
          </div>

          <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-accent h-full rounded-full transition-all duration-300"
              style={{ width: `${metrics?.diskPercent || 0}%` }}
            />
          </div>

          <div className="text-[11px] text-mutedText flex justify-between pt-1">
            <span>Free Disk Space:</span>
            <span className="font-mono text-secondaryText">{metrics ? formatBytes(metrics.diskFreeBytes) : '0 GB'}</span>
          </div>
        </div>
      </div>

      {/* Process & Network Details Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-accent" />
            Palworld Process Memory Usage
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-mutedText">Process State:</span>
              <span className="font-mono text-success font-semibold">
                {metrics?.serverProcessRunning ? 'ACTIVE' : 'OFFLINE'}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-mutedText">Dedicated Server Memory Allocation:</span>
              <span className="font-mono text-white font-semibold">{metrics?.serverProcessMemoryMb || 0} MB</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-mutedText">Linux Process CPU Share:</span>
              <span className="font-mono text-white">{metrics?.serverProcessCpu || 0}%</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Network className="w-4 h-4 text-accent" />
            Network Traffic & Uptime
          </h2>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-mutedText">Inbound Bandwidth (Download):</span>
              <span className="font-mono text-white">{metrics ? formatBytes(metrics.networkRxSec) : '0 B'}/s</span>
            </div>
            <div className="flex justify-between py-2 border-b border-border/50">
              <span className="text-mutedText">Outbound Bandwidth (Upload):</span>
              <span className="font-mono text-white">{metrics ? formatBytes(metrics.networkTxSec) : '0 B'}/s</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-mutedText">VPS System Uptime:</span>
              <span className="font-mono text-secondaryText">{formatUptime(metrics?.systemUptimeSeconds || 0)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

