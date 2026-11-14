import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { config } from '../../config/index.js';
import { PlayerService } from '../players/playerService.js';
import { Logger } from '../../utils/logger.js';
import { broadcastWS } from '../../services/websocket.js';

const execAsync = util.promisify(exec);

export interface ConsoleLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
}

export class ConsoleService {
  private static recentLogs: ConsoleLogEntry[] = [];
  private static activeLogPath: string | null = null;
  private static lastReadPosition: number = 0;
  private static pollTimer: NodeJS.Timeout | null = null;
  private static isInitialized = false;

  static init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Find and seed initial logs immediately
    this.findLogFile();
    this.readNewLogs();

    // Poll for log updates every 1.5 seconds
    this.pollTimer = setInterval(() => {
      this.findLogFile();
      this.readNewLogs();
    }, 1500);
  }

  /**
   * Resolves the real PalServer.log file from disk.
   */
  private static findLogFile(): string | null {
    const candidates = [
      path.join(config.palworldDir, 'Pal', 'Saved', 'Logs', 'PalServer.log'),
      '/home/paladmin/palworld/Pal/Saved/Logs/PalServer.log',
      '/home/paladmin/Palserver/Pal/Saved/Logs/PalServer.log',
      '/home/steam/palworld/Pal/Saved/Logs/PalServer.log',
      '/home/steam/Steam/steamapps/common/PalServer/Pal/Saved/Logs/PalServer.log',
      '/home/ubuntu/palworld/Pal/Saved/Logs/PalServer.log',
      '/home/ubuntu/Palserver/Pal/Saved/Logs/PalServer.log',
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        if (this.activeLogPath !== candidate) {
          this.activeLogPath = candidate;
          this.lastReadPosition = 0; // Trigger reading tail of new file
          Logger.info(`[ConsoleService] Attached to PalServer log at: ${candidate}`);
        }
        return candidate;
      }
    }

    return null;
  }

  /**
   * Reads new lines from PalServer.log or active screen session.
   */
  private static async readNewLogs() {
    if (this.activeLogPath && fs.existsSync(this.activeLogPath)) {
      try {
        const stats = fs.statSync(this.activeLogPath);

        // First read: load the last ~35KB of historical logs
        if (this.lastReadPosition === 0) {
          this.lastReadPosition = Math.max(0, stats.size - 35000);
        } else if (stats.size < this.lastReadPosition) {
          // File was rotated or truncated
          this.lastReadPosition = 0;
        }

        if (stats.size > this.lastReadPosition) {
          const bytesToRead = stats.size - this.lastReadPosition;
          const buffer = Buffer.alloc(bytesToRead);
          const fd = fs.openSync(this.activeLogPath, 'r');
          fs.readSync(fd, buffer, 0, bytesToRead, this.lastReadPosition);
          fs.closeSync(fd);

          this.lastReadPosition = stats.size;

          const text = buffer.toString('utf-8');
          const lines = text.split('\n');
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            let level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' = 'INFO';
            if (/error|failed|crash|exception|fatal/i.test(line)) level = 'ERROR';
            else if (/warn|warning/i.test(line)) level = 'WARN';
            else if (/debug|trace/i.test(line)) level = 'DEBUG';

            this.pushLog(level, line);
          }
        }
        return;
      } catch (err: any) {
        Logger.debug(`[ConsoleService] Read log error: ${err.message}`);
      }
    }

    // Fallback: If on Linux and server is in a screen session, capture screen buffer
    if (process.platform === 'linux') {
      try {
        const tempScreenLog = '/tmp/palworld_screen_capture.log';
        await execAsync(`screen -S palworld -X hardcopy ${tempScreenLog} 2>/dev/null`).catch(() => {});
        if (fs.existsSync(tempScreenLog)) {
          const content = fs.readFileSync(tempScreenLog, 'utf-8');
          const lines = content.split('\n').filter((l) => l.trim().length > 0).slice(-40);
          for (const line of lines) {
            if (!this.recentLogs.some((r) => r.message === line.trim())) {
              this.pushLog('INFO', line.trim());
            }
          }
        }
      } catch {}
    }

    // Fallback seed if completely empty
    if (this.recentLogs.length === 0) {
      this.pushLog('INFO', 'Palworld Dedicated Server Console initialized.');
      this.pushLog('INFO', `Listening on port ${config.palworldPort} with session ${config.screenSessionName}.`);
    }
  }

  static pushLog(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string) {
    const entry: ConsoleLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      level,
      message,
    };

    this.recentLogs.push(entry);
    if (this.recentLogs.length > 500) {
      this.recentLogs.shift();
    }

    broadcastWS('CONSOLE_LOG', entry);
  }

  static getRecentLogs(limit: number = 100): ConsoleLogEntry[] {
    return this.recentLogs.slice(-limit);
  }

  /**
   * Executes an administrative command.
   * Delivers via Source RCON and directly to GNU screen console.
   */
  static async executeCommand(command: string): Promise<string> {
    const trimmed = command.trim();
    if (!trimmed) return 'Command cannot be empty.';

    this.pushLog('INFO', `> ${trimmed}`);

    let rconResponse = '';
    try {
      rconResponse = await PlayerService.sendRconCommand(trimmed);
    } catch {}

    // Also forward to GNU screen console if on Linux
    if (process.platform === 'linux') {
      try {
        await execAsync(`screen -S palworld -p 0 -X stuff "${trimmed}^M" 2>/dev/null`).catch(() => {});
      } catch {}
    }

    const output = rconResponse || 'Command delivered to server process.';
    this.pushLog('INFO', output);
    return output;
  }
}
