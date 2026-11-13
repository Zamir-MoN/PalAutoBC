import { exec, spawn } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { config } from '../../config/index.js';
import { Logger } from '../../utils/logger.js';
import { broadcastWS } from '../../services/websocket.js';

const execAsync = util.promisify(exec);

export interface ServerStatus {
  isRunning: boolean;
  pid: number | null;
  uptimeSeconds: number;
  cpuPercent: number;
  memoryBytes: number;
  memoryMb: number;
  processManager: 'systemd' | 'screen' | 'standalone' | 'none';
  sessionName: string;
  port: number;
  executablePath: string;
  worldSaveDir: string;
  lastChecked: string;
}

export class ServerService {
  private static startTime: Date | null = null;

  /**
   * Detects the exact process status of Palworld Server.
   * Checks system processes directly using pgrep / ps.
   */
  static async getStatus(): Promise<ServerStatus> {
    const isWindows = process.platform === 'win32';
    let isRunning = false;
    let pid: number | null = null;
    let cpuPercent = 0;
    let memoryBytes = 0;
    let processManager: 'systemd' | 'screen' | 'standalone' | 'none' = 'none';

    if (isWindows) {
      // Development mock fallback on local Windows workspace
      return {
        isRunning: this.startTime !== null,
        pid: this.startTime !== null ? 8211 : null,
        uptimeSeconds: this.startTime ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0,
        cpuPercent: this.startTime ? 4.2 : 0,
        memoryBytes: this.startTime ? 4294967296 : 0, // 4GB
        memoryMb: this.startTime ? 4096 : 0,
        processManager: 'screen',
        sessionName: config.screenSessionName,
        port: config.palworldPort,
        executablePath: path.join(config.palworldDir, config.palworldExecutable),
        worldSaveDir: path.join(config.palworldDir, 'Pal', 'Saved', 'SaveGames'),
        lastChecked: new Date().toISOString(),
      };
    }

    try {
      // Check for PalServer-Linux-Shipping or PalServer.sh
      const { stdout: pgrepOut } = await execAsync("pgrep -f 'PalServer-Linux|PalServer.sh' | head -n 1").catch(() => ({ stdout: '' }));
      const foundPid = parseInt(pgrepOut.trim(), 10);

      if (!isNaN(foundPid) && foundPid > 0) {
        isRunning = true;
        pid = foundPid;

        // Fetch CPU and Memory usage for PID
        try {
          const { stdout: psOut } = await execAsync(`ps -p ${pid} -o %cpu,rss --no-headers`);
          const parts = psOut.trim().split(/\s+/);
          if (parts.length >= 2) {
            cpuPercent = parseFloat(parts[0]) || 0;
            const rssKb = parseInt(parts[1], 10) || 0;
            memoryBytes = rssKb * 1024;
          }
        } catch {
          // Process might have terminated between checks
        }

        // Determine if managed by systemd or screen
        try {
          const { stdout: systemdOut } = await execAsync(`systemctl is-active ${config.systemdServiceName}`).catch(() => ({ stdout: '' }));
          if (systemdOut.trim() === 'active') {
            processManager = 'systemd';
          } else {
            const { stdout: screenOut } = await execAsync(`screen -ls | grep -i "${config.screenSessionName}"`).catch(() => ({ stdout: '' }));
            if (screenOut.trim().length > 0) {
              processManager = 'screen';
            } else {
              processManager = 'standalone';
            }
          }
        } catch {
          processManager = 'standalone';
        }
      }
    } catch (err: any) {
      Logger.error(`[ServerService] Error checking server status: ${err.message}`);
    }

    if (isRunning && !this.startTime) {
      this.startTime = new Date();
    } else if (!isRunning) {
      this.startTime = null;
    }

    const uptimeSeconds = this.startTime ? Math.floor((Date.now() - this.startTime.getTime()) / 1000) : 0;

    return {
      isRunning,
      pid,
      uptimeSeconds,
      cpuPercent,
      memoryBytes,
      memoryMb: Math.round(memoryBytes / (1024 * 1024)),
      processManager,
      sessionName: config.screenSessionName,
      port: config.palworldPort,
      executablePath: path.join(config.palworldDir, config.palworldExecutable),
      worldSaveDir: path.join(config.palworldDir, 'Pal', 'Saved', 'SaveGames'),
      lastChecked: new Date().toISOString(),
    };
  }

  /**
   * Starts the Palworld Dedicated Server.
   * Prevents duplicate instances.
   */
  static async start(): Promise<{ success: boolean; message: string; pid?: number }> {
    const status = await this.getStatus();
    if (status.isRunning) {
      return { success: false, message: `Palworld server is already running (PID: ${status.pid}). Duplicate startup prevented.` };
    }

    Logger.info('[ServerService] Starting Palworld dedicated server...');

    if (process.platform === 'win32') {
      this.startTime = new Date();
      broadcastWS('SERVER_STATUS_CHANGE', await this.getStatus());
      return { success: true, message: 'Palworld server started successfully (development environment).' };
    }

    // Check systemd first
    try {
      const { stdout: hasService } = await execAsync(`systemctl list-unit-files ${config.systemdServiceName} 2>&1`).catch(() => ({ stdout: '' }));
      if (hasService.includes(config.systemdServiceName)) {
        await execAsync(`sudo systemctl start ${config.systemdServiceName}`);
        this.startTime = new Date();
        const newStatus = await this.getStatus();
        broadcastWS('SERVER_STATUS_CHANGE', newStatus);
        return { success: true, message: 'Palworld server started via systemd.', pid: newStatus.pid || undefined };
      }
    } catch {
      // Fallback to screen session
    }

    // Screen startup fallback
    try {
      const execPath = path.join(config.palworldDir, config.palworldExecutable);
      if (!fs.existsSync(execPath)) {
        return { success: false, message: `Executable not found at ${execPath}. Please verify installation path.` };
      }

      // Ensure execute permissions
      await execAsync(`chmod +x "${execPath}"`);

      // Launch inside GNU Screen detached session
      const startCmd = `cd "${config.palworldDir}" && screen -dmS ${config.screenSessionName} ${config.palworldExecutable} -port=${config.palworldPort} -useperfthreads -NoAsyncLoadingThread -UseMultithreadForDS`;
      await execAsync(startCmd);

      // Wait 3 seconds and verify
      await new Promise((r) => setTimeout(r, 3000));
      const verifyStatus = await this.getStatus();

      if (verifyStatus.isRunning) {
        this.startTime = new Date();
        broadcastWS('SERVER_STATUS_CHANGE', verifyStatus);
        Logger.info(`[ServerService] Palworld server started successfully in screen (PID: ${verifyStatus.pid})`);
        return { success: true, message: 'Palworld server started successfully.', pid: verifyStatus.pid || undefined };
      } else {
        return { success: false, message: 'Startup command was executed but server process did not remain active. Inspect server logs.' };
      }
    } catch (err: any) {
      Logger.error(`[ServerService] Startup failure: ${err.message}`);
      return { success: false, message: `Failed to start server: ${err.message}` };
    }
  }

  /**
   * Stops the Palworld Dedicated Server gracefully.
   * Waits and verifies full process termination.
   */
  static async stop(): Promise<{ success: boolean; message: string }> {
    const status = await this.getStatus();
    if (!status.isRunning) {
      return { success: true, message: 'Palworld server is already offline.' };
    }

    Logger.info(`[ServerService] Gracefully stopping Palworld server (PID: ${status.pid})...`);

    if (process.platform === 'win32') {
      this.startTime = null;
      broadcastWS('SERVER_STATUS_CHANGE', await this.getStatus());
      return { success: true, message: 'Palworld server stopped gracefully.' };
    }

    // Try systemd stop if active
    if (status.processManager === 'systemd') {
      try {
        await execAsync(`sudo systemctl stop ${config.systemdServiceName}`);
      } catch (err: any) {
        Logger.warn(`[ServerService] systemctl stop failed: ${err.message}`);
      }
    } else {
      // Send shutdown or SIGTERM
      if (status.pid) {
        try {
          // Graceful SIGTERM
          process.kill(status.pid, 'SIGTERM');
        } catch {
          // Fallback to pkill
          await execAsync(`pkill -TERM -f 'PalServer'`).catch(() => {});
        }
      }
    }

    // Wait up to 15 seconds for process termination
    let stopped = false;
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const check = await this.getStatus();
      if (!check.isRunning) {
        stopped = true;
        break;
      }
    }

    // Force SIGKILL if still running
    if (!stopped) {
      Logger.warn('[ServerService] Process did not terminate after 15s. Issuing SIGKILL...');
      await execAsync(`pkill -9 -f 'PalServer'`).catch(() => {});
      await new Promise((r) => setTimeout(r, 2000));
    }

    this.startTime = null;
    const finalStatus = await this.getStatus();
    broadcastWS('SERVER_STATUS_CHANGE', finalStatus);

    return {
      success: !finalStatus.isRunning,
      message: !finalStatus.isRunning ? 'Palworld server stopped successfully.' : 'Failed to terminate server process.',
    };
  }

  /**
   * Graceful Restart.
   */
  static async restart(): Promise<{ success: boolean; message: string }> {
    Logger.info('[ServerService] Restarting Palworld server...');
    const stopResult = await this.stop();
    if (!stopResult.success) {
      return { success: false, message: `Restart failed during shutdown: ${stopResult.message}` };
    }

    // Brief cooldown
    await new Promise((r) => setTimeout(r, 2000));

    return await this.start();
  }
}

