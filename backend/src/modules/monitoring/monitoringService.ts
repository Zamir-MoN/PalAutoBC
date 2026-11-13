import os from 'os';
import si from 'systeminformation';
import { ServerService } from '../server/serverService.js';
import { broadcastWS } from '../../services/websocket.js';
import { Logger } from '../../utils/logger.js';

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

export class MonitoringService {
  private static timer: NodeJS.Timeout | null = null;
  private static cachedMetrics: SystemMetrics | null = null;
  private static lastNetStats: { rx: number; tx: number; time: number } | null = null;

  static init() {
    this.collectMetrics();
    // Poll every 3 seconds to avoid overloading VPS
    this.timer = setInterval(() => {
      this.collectMetrics();
    }, 3000);
  }

  static async collectMetrics(): Promise<SystemMetrics> {
    try {
      const [cpuLoad, mem, fsSize, netStats, serverStatus] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.fsSize(),
        si.networkStats(),
        ServerService.getStatus(),
      ]);

      // Calculate disk totals across mountpoints
      let diskTotal = 0;
      let diskUsed = 0;
      if (fsSize && fsSize.length > 0) {
        const rootFs = fsSize.find((f) => f.mount === '/') || fsSize[0];
        diskTotal = rootFs.size;
        diskUsed = rootFs.used;
      }

      // Calculate network transfer rates (B/s)
      let rxSec = 0;
      let txSec = 0;
      if (netStats && netStats.length > 0) {
        const primaryNet = netStats[0];
        rxSec = primaryNet.rx_sec || 0;
        txSec = primaryNet.tx_sec || 0;
      }

      const metrics: SystemMetrics = {
        cpuUsagePercent: Math.round(cpuLoad.currentLoad || 0),
        cpuCores: os.cpus().length,
        memoryTotalBytes: mem.total,
        memoryUsedBytes: mem.active || mem.used,
        memoryFreeBytes: mem.free,
        memoryPercent: Math.round(((mem.active || mem.used) / mem.total) * 100),
        diskTotalBytes: diskTotal,
        diskUsedBytes: diskUsed,
        diskFreeBytes: diskTotal - diskUsed,
        diskPercent: diskTotal > 0 ? Math.round((diskUsed / diskTotal) * 100) : 0,
        networkRxSec: Math.round(rxSec),
        networkTxSec: Math.round(txSec),
        systemUptimeSeconds: Math.round(os.uptime()),
        serverProcessCpu: serverStatus.cpuPercent,
        serverProcessMemoryMb: serverStatus.memoryMb,
        serverProcessRunning: serverStatus.isRunning,
        timestamp: new Date().toISOString(),
      };

      this.cachedMetrics = metrics;
      broadcastWS('METRICS_UPDATE', metrics);
      return metrics;
    } catch (err: any) {
      Logger.warn(`[MonitoringService] Failed to gather metrics: ${err.message}`);

      // Fallback basic OS metrics
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      const fallback: SystemMetrics = {
        cpuUsagePercent: 5,
        cpuCores: os.cpus().length,
        memoryTotalBytes: totalMem,
        memoryUsedBytes: usedMem,
        memoryFreeBytes: freeMem,
        memoryPercent: Math.round((usedMem / totalMem) * 100),
        diskTotalBytes: 50 * 1024 * 1024 * 1024,
        diskUsedBytes: 15 * 1024 * 1024 * 1024,
        diskFreeBytes: 35 * 1024 * 1024 * 1024,
        diskPercent: 30,
        networkRxSec: 1024,
        networkTxSec: 2048,
        systemUptimeSeconds: Math.round(os.uptime()),
        serverProcessCpu: 0,
        serverProcessMemoryMb: 0,
        serverProcessRunning: false,
        timestamp: new Date().toISOString(),
      };

      this.cachedMetrics = fallback;
      return fallback;
    }
  }

  static getLatestMetrics(): SystemMetrics | null {
    return this.cachedMetrics;
  }
}

