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

        // Read live process working directory from /proc/<pid>/cwd
        try {
          const { stdout: cwdOut } = await execAsync(`readlink -f /proc/${pid}/cwd`).catch(() => ({ stdout: '' }));
          let liveCwd = cwdOut.trim();
          if (liveCwd && fs.existsSync(liveCwd)) {
            if (liveCwd.includes('Pal/Binaries/Linux')) {
              liveCwd = path.resolve(liveCwd, '../../..');
            } else if (liveCwd.includes('Binaries/Linux')) {
              liveCwd = path.resolve(liveCwd, '../..');
            }
            if (fs.existsSync(path.join(liveCwd, 'Pal')) || fs.existsSync(path.join(liveCwd, 'PalServer.sh'))) {
              config.palworldDir = liveCwd;
            }
          }
        } catch {}

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
      try { await execAsync(`chmod +x "${execPath}"`); } catch {}

      // Wipe any dead screen sessions first
      try { await execAsync('screen -wipe 2>/dev/null || true'); } catch {}

      // Launch inside GNU Screen detached session using bash
      const startCmd = `cd "${config.palworldDir}" && screen -dmS "${config.screenSessionName}" bash "${execPath}" -port=${config.palworldPort} -useperfthreads -NoAsyncLoadingThread -UseMultithreadForDS`;
      await execAsync(startCmd);

      // Poll up to 6 seconds to confirm process is active
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const verifyStatus = await this.getStatus();
        if (verifyStatus.isRunning) {
          this.startTime = new Date();
          broadcastWS('SERVER_STATUS_CHANGE', verifyStatus);
          Logger.info(`[ServerService] Palworld server started successfully in screen (PID: ${verifyStatus.pid})`);
          return { success: true, message: 'Palworld server started successfully.', pid: verifyStatus.pid || undefined };
        }
      }

      const checkNow = await this.getStatus();
      if (checkNow.isRunning) {
        return { success: true, message: 'Palworld server started successfully.', pid: checkNow.pid || undefined };
      }
      return { success: false, message: 'Startup command was executed but server process did not remain active. Check logs.' };
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

    Logger.info(`[ServerService] Stopping Palworld server (PID: ${status.pid})...`);

    if (process.platform === 'win32') {
      this.startTime = null;
      broadcastWS('SERVER_STATUS_CHANGE', await this.getStatus());
      return { success: true, message: 'Palworld server stopped gracefully.' };
    }

    // 1. Try RCON Shutdown if available (cleanest for Unreal Engine)
    try {
      const { PlayerService } = await import('../players/playerService.js');
      await PlayerService.saveWorld().catch(() => {});
      await PlayerService.sendRconCommand('Shutdown 1 Server_Backing_Up').catch(() => {});
    } catch {}

    // 2. Try systemctl if managed by systemd
    if (status.processManager === 'systemd') {
      try {
        await execAsync(`sudo systemctl stop ${config.systemdServiceName} 2>/dev/null || systemctl stop ${config.systemdServiceName} 2>/dev/null`);
      } catch (err: any) {
        Logger.warn(`[ServerService] systemctl stop failed: ${err.message}`);
      }
    }

    // 3. Try cleanly exiting screen session
    try {
      await execAsync(`screen -S "${config.screenSessionName}" -X quit 2>/dev/null || screen -S palworld -X quit 2>/dev/null || true`);
    } catch {}

    // 4. Send SIGTERM / SIGINT
    if (status.pid) {
      try {
        process.kill(status.pid, 'SIGINT');
      } catch {}
      try {
        process.kill(status.pid, 'SIGTERM');
      } catch {}
    }
    try {
      await execAsync("pkill -TERM -f 'PalServer' 2>/dev/null || true");
    } catch {}

    // Wait up to 6 seconds for process termination
    let stopped = false;
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const check = await this.getStatus();
      if (!check.isRunning) {
        stopped = true;
        break;
      }
    }

    // 5. Force kill if still running
    if (!stopped) {
      Logger.warn('[ServerService] Process did not terminate cleanly. Issuing SIGKILL...');
      try { await execAsync("pkill -9 -f 'PalServer-Linux-Shipping' 2>/dev/null || true"); } catch {}
      try { await execAsync("pkill -9 -f 'PalServer.sh' 2>/dev/null || true"); } catch {}
      try { await execAsync("pkill -9 -f 'PalServer' 2>/dev/null || true"); } catch {}
      try { await execAsync("screen -wipe 2>/dev/null || true"); } catch {}
      await new Promise((r) => setTimeout(r, 1500));
    }

    this.startTime = null;
    const finalStatus = await this.getStatus();
    broadcastWS('SERVER_STATUS_CHANGE', finalStatus);

    return {
      success: !finalStatus.isRunning,
      message: !finalStatus.isRunning ? 'Palworld server stopped successfully.' : 'Server process is managed by an external loop/service.',
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

