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
   * Validates that the process is actually alive, not a zombie/defunct,
   * and genuinely consuming game memory (> 10MB RAM).
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
      // 1. Primary search: actual PalServer binary
      let foundPid = 0;
      const { stdout: binOut } = await execAsync("pgrep -f 'PalServer-Linux-Shipping' | head -n 1").catch(() => ({ stdout: '' }));
      foundPid = parseInt(binOut.trim(), 10);

      // 2. Secondary search: PalServer-Linux
      if (isNaN(foundPid) || foundPid <= 0) {
        const { stdout: binOut2 } = await execAsync("pgrep -f 'PalServer-Linux' | head -n 1").catch(() => ({ stdout: '' }));
        foundPid = parseInt(binOut2.trim(), 10);
      }

      // 3. Fallback search: screen session PalServer.sh ONLY if screen is active
      if (isNaN(foundPid) || foundPid <= 0) {
        const { stdout: screenCheck } = await execAsync(`screen -ls | grep -i "${config.screenSessionName}"`).catch(() => ({ stdout: '' }));
        if (screenCheck.trim().length > 0) {
          const { stdout: shOut } = await execAsync("pgrep -f 'PalServer.sh' | head -n 1").catch(() => ({ stdout: '' }));
          foundPid = parseInt(shOut.trim(), 10);
        }
      }

      // 4. Rigorous verification: Ensure process is ALIVE, NOT A ZOMBIE, and genuinely consuming game RAM (> 10MB)
      if (!isNaN(foundPid) && foundPid > 0) {
        try {
          const { stdout: psOut } = await execAsync(`ps -p ${foundPid} -o %cpu,rss,stat --no-headers`);
          const parts = psOut.trim().split(/\s+/);
          if (parts.length >= 3) {
            const cpu = parseFloat(parts[0]) || 0;
            const rssKb = parseInt(parts[1], 10) || 0;
            const stat = parts[2] || '';

            // Palworld server process CANNOT be a zombie ('Z'), stopped ('T'), or consume 0 KB RAM
            if (!stat.startsWith('Z') && !stat.startsWith('T') && rssKb > 10000) {
              isRunning = true;
              pid = foundPid;
              cpuPercent = cpu;
              memoryBytes = rssKb * 1024;
            } else {
              // Ghost, defunct, zombie or dead process
              isRunning = false;
              pid = null;
              memoryBytes = 0;
            }
          }
        } catch {
          isRunning = false;
          pid = null;
          memoryBytes = 0;
        }

        if (isRunning && pid) {
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
   * Auto-cleans dead zombie/ghost processes.
   */
  static async start(force: boolean = false): Promise<{ success: boolean; message: string; pid?: number }> {
    const status = await this.getStatus();
    if (status.isRunning && !force) {
      return { success: false, message: `Palworld server is already running (PID: ${status.pid}). Duplicate startup prevented.` };
    }

    Logger.info('[ServerService] Starting Palworld dedicated server...');

    if (process.platform === 'win32') {
      this.startTime = new Date();
      broadcastWS('SERVER_STATUS_CHANGE', await this.getStatus());
      return { success: true, message: 'Palworld server started successfully (development environment).' };
    }

    // Clean up any stale or zombie processes
    try {
      await execAsync("pkill -9 -f 'PalServer-Linux' 2>/dev/null || true");
      await execAsync("pkill -9 -f 'PalServer.sh' 2>/dev/null || true");
      await execAsync('screen -wipe 2>/dev/null || true');
    } catch {}

    // Screen startup
    try {
      const execPath = path.join(config.palworldDir, config.palworldExecutable);
      const binaryPath = path.join(config.palworldDir, 'Pal', 'Binaries', 'Linux', 'PalServer-Linux-Shipping');

      // Ensure execute permissions on both shell script and shipping binary
      try { await execAsync(`chmod +x "${execPath}" 2>/dev/null || true`); } catch {}
      try { await execAsync(`chmod +x "${binaryPath}" 2>/dev/null || true`); } catch {}

      // Wipe dead screen sessions first
      try { await execAsync('screen -wipe 2>/dev/null || true'); } catch {}

      // Launch inside GNU Screen detached session
      const startCmd = `cd "${config.palworldDir}" && screen -dmS "${config.screenSessionName}" ./PalServer.sh -port=${config.palworldPort} -useperfthreads -NoAsyncLoadingThread -UseMultithreadForDS`;
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
      return { success: false, message: 'Startup command was executed but server process did not remain active. Check live console.' };
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
    Logger.info('[ServerService] Stopping Palworld server...');

    if (process.platform === 'win32') {
      this.startTime = null;
      broadcastWS('SERVER_STATUS_CHANGE', await this.getStatus());
      return { success: true, message: 'Palworld server stopped gracefully.' };
    }

    // 1. Try RCON Shutdown if available (cleanest for Unreal Engine)
    try {
      const { PlayerService } = await import('../players/playerService.js');
      await PlayerService.saveWorld().catch(() => {});
      await PlayerService.sendRconCommand('Shutdown 1 Server_Stopping').catch(() => {});
    } catch {}

    // 2. Try cleanly exiting screen session
    try {
      await execAsync(`screen -S "${config.screenSessionName}" -X quit 2>/dev/null || screen -S palworld -X quit 2>/dev/null || true`);
    } catch {}

    // 3. Send SIGTERM / SIGINT
    try {
      await execAsync("pkill -TERM -f 'PalServer-Linux' 2>/dev/null || true");
      await execAsync("pkill -TERM -f 'PalServer.sh' 2>/dev/null || true");
    } catch {}

    // Wait up to 5 seconds for process termination
    let stopped = false;
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const check = await this.getStatus();
      if (!check.isRunning) {
        stopped = true;
        break;
      }
    }

    // 4. Force kill if still running
    if (!stopped) {
      Logger.warn('[ServerService] Process did not terminate cleanly. Issuing SIGKILL...');
      try { await execAsync("pkill -9 -f 'PalServer-Linux-Shipping' 2>/dev/null || true"); } catch {}
      try { await execAsync("pkill -9 -f 'PalServer.sh' 2>/dev/null || true"); } catch {}
      try { await execAsync("pkill -9 -f 'PalServer' 2>/dev/null || true"); } catch {}
      try { await execAsync('screen -wipe 2>/dev/null || true'); } catch {}
      await new Promise((r) => setTimeout(r, 1500));
    }

    this.startTime = null;
    const finalStatus = await this.getStatus();
    broadcastWS('SERVER_STATUS_CHANGE', finalStatus);

    return {
      success: true,
      message: 'Palworld server stopped successfully.',
    };
  }

  /**
   * Graceful Restart.
   */
  static async restart(): Promise<{ success: boolean; message: string }> {
    Logger.info('[ServerService] Restarting Palworld server...');
    await this.stop();
    // Force cleanup before start
    try {
      await execAsync("pkill -9 -f 'PalServer' 2>/dev/null || true");
      await execAsync('screen -wipe 2>/dev/null || true');
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
    return await this.start(true);
  }
}
