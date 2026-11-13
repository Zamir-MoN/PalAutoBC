import fs from 'fs';
import path from 'path';
import { config } from '../../config/index.js';
import { PlayerService } from '../players/playerService.js';
import { Logger } from '../../utils/logger.js';
import { broadcastWS } from '../../services/websocket.js';

export interface ConsoleLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
}

export class ConsoleService {
  private static recentLogs: ConsoleLogEntry[] = [];
  private static logFilePath: string = path.join(config.palworldDir, 'Pal', 'Saved', 'Logs', 'PalServer.log');
  private static fileWatcher: fs.FSWatcher | null = null;
  private static lastReadPosition: number = 0;

  static init() {
    this.startWatcher();
  }

  /**
   * Watches PalServer.log and streams new lines to WebSocket clients.
   */
  private static startWatcher() {
    if (!fs.existsSync(this.logFilePath)) {
      // Mock seed for development/demo
      this.pushLog('INFO', 'Palworld Dedicated Server Console initialized.');
      this.pushLog('INFO', `Listening on port ${config.palworldPort} with session ${config.screenSessionName}.`);
      return;
    }

    try {
      const stats = fs.statSync(this.logFilePath);
      this.lastReadPosition = Math.max(0, stats.size - 20000); // Read last ~20KB

      this.readNewLines();

      this.fileWatcher = fs.watch(this.logFilePath, (eventType) => {
        if (eventType === 'change') {
          this.readNewLines();
        }
      });
    } catch (err: any) {
      Logger.warn(`[ConsoleService] Could not watch PalServer.log: ${err.message}`);
    }
  }

  private static readNewLines() {
    try {
      const stats = fs.statSync(this.logFilePath);
      if (stats.size < this.lastReadPosition) {
        this.lastReadPosition = 0; // File was rotated
      }

      const stream = fs.createReadStream(this.logFilePath, {
        start: this.lastReadPosition,
        end: stats.size,
        encoding: 'utf-8',
      });

      this.lastReadPosition = stats.size;

      stream.on('data', (chunk: string | Buffer) => {
        const text = chunk.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          let level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' = 'INFO';
          if (/error|failed|crash|exception/i.test(line)) level = 'ERROR';
          else if (/warn|warning/i.test(line)) level = 'WARN';
          else if (/debug/i.test(line)) level = 'DEBUG';

          this.pushLog(level, line.trim());
        }
      });
    } catch {}
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
   * Executes an allowlisted administrative game command.
   * Never exposes system shell.
   */
  static async executeCommand(command: string): Promise<string> {
    const trimmed = command.trim();
    if (!trimmed) return 'Command cannot be empty.';

    const parts = trimmed.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    // Allowlisted Palworld / Admin commands only
    const allowed = ['help', 'info', 'save', 'shutdown', 'broadcast', 'kickplayer', 'banplayer', 'teleporttoplayer', 'showplayers'];
    if (!allowed.includes(cmd)) {
      return `Command "${parts[0]}" is not recognized or not permitted. Type "help" or "showplayers".`;
    }

    this.pushLog('INFO', `> Executing admin command: ${trimmed}`);
    const result = await PlayerService.sendRconCommand(trimmed);
    const output = result || 'Command acknowledged by server.';
    this.pushLog('INFO', output);
    return output;
  }
}

