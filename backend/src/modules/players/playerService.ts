import net from 'net';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import { config } from '../../config/index.js';
import { ConfigService } from '../config/configService.js';
import { Logger } from '../../utils/logger.js';

const execAsync = util.promisify(exec);

export interface PlayerInfo {
  name: string;
  playerUId: string;
  steamId: string;
  ping?: number;
  location?: string;
  level?: number;
  lastOnline?: string;
  status?: 'online' | 'offline';
}

export class PlayerService {
  /**
   * Resolves the actual AdminPassword and RCON settings from PalWorldSettings.ini.
   */
  static async getEffectiveRconConfig(): Promise<{
    enabled: boolean;
    port: number;
    password: string;
  }> {
    let password = config.rconPassword;
    let port = config.rconPort || 25575;
    let enabled = true;

    try {
      const { parsed } = await ConfigService.readSettings();
      if (parsed.AdminPassword && typeof parsed.AdminPassword === 'string') {
        password = parsed.AdminPassword;
      }
      if (parsed.RCONPort && typeof parsed.RCONPort === 'number') {
        port = parsed.RCONPort;
      }
      if (parsed.RCONEnabled !== undefined) {
        enabled = Boolean(parsed.RCONEnabled);
      }
    } catch {}

    return { enabled, port, password };
  }

  /**
   * Executes a native Source RCON command with full handshake state machine.
   */
  static async sendRconCommand(command: string): Promise<string> {
    const rconCfg = await this.getEffectiveRconConfig();

    if (!rconCfg.password) {
      Logger.debug(`[PlayerService] No AdminPassword configured in settings. RCON skipped.`);
      return '';
    }

    return new Promise((resolve) => {
      const client = new net.Socket();
      let response = '';
      let authed = false;
      let buffer = Buffer.alloc(0);

      const timeout = setTimeout(() => {
        client.destroy();
        resolve(response.trim());
      }, 4000);

      client.connect(rconCfg.port, '127.0.0.1', () => {
        const authPacket = PlayerService.buildRconPacket(1, 3, rconCfg.password);
        client.write(authPacket);
      });

      client.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        while (buffer.length >= 14) {
          const size = buffer.readInt32LE(0);
          const totalPacketSize = size + 4;
          if (buffer.length < totalPacketSize) {
            break;
          }

          const id = buffer.readInt32LE(4);
          const type = buffer.readInt32LE(8);
          const body = buffer.subarray(12, totalPacketSize - 2).toString('utf-8');
          buffer = buffer.subarray(totalPacketSize);

          if (!authed) {
            if (type === 2 && id !== -1) {
              // Successfully authenticated with Source RCON
              authed = true;
              const cmdPacket = PlayerService.buildRconPacket(2, 2, command);
              client.write(cmdPacket);
            } else if (id === -1) {
              // Authentication rejected
              clearTimeout(timeout);
              client.destroy();
              resolve('');
              return;
            }
            // Skip non-auth packets during handshake
          } else {
            // Execution response
            response += body;
            clearTimeout(timeout);
            client.destroy();
            resolve(response.trim());
            return;
          }
        }
      });

      client.on('error', () => {
        clearTimeout(timeout);
        client.destroy();
        resolve('');
      });
    });
  }

  private static buildRconPacket(id: number, type: number, body: string): Buffer {
    const bodyBuf = Buffer.from(body, 'utf-8');
    const size = bodyBuf.length + 10;
    const packet = Buffer.alloc(size + 4);

    packet.writeInt32LE(size, 0);
    packet.writeInt32LE(id, 4);
    packet.writeInt32LE(type, 8);
    bodyBuf.copy(packet, 12);
    packet.writeInt8(0, 12 + bodyBuf.length);
    packet.writeInt8(0, 13 + bodyBuf.length);

    return packet;
  }

  /**
   * Discovers all 'Players' directories across known Palworld server locations.
   */
  private static findPlayersFolders(): string[] {
    const candidateRoots = [
      path.join(config.palworldDir, 'Pal', 'Saved', 'SaveGames'),
      path.join(config.palworldDir, 'Pal', 'Saved'),
      '/home/paladmin/palworld/Pal/Saved/SaveGames',
      '/home/paladmin/Palserver/Pal/Saved/SaveGames',
      '/home/steam/palworld/Pal/Saved/SaveGames',
      '/home/steam/Steam/steamapps/common/PalServer/Pal/Saved/SaveGames',
      '/home/ubuntu/palworld/Pal/Saved/SaveGames',
      '/home/ubuntu/Palserver/Pal/Saved/SaveGames',
    ];

    const results = new Set<string>();

    for (const root of candidateRoots) {
      if (!fs.existsSync(root)) continue;

      function walk(current: string, depth: number) {
        if (depth > 6) return;
        try {
          const items = fs.readdirSync(current, { withFileTypes: true });
          for (const item of items) {
            if (item.isDirectory()) {
              const full = path.join(current, item.name);
              if (item.name === 'Players') {
                results.add(full);
              } else {
                walk(full, depth + 1);
              }
            }
          }
        } catch {}
      }

      walk(root, 0);
    }

    return Array.from(results);
  }

  /**
   * Parses PalServer.log to map player GUIDs to actual character names.
   */
  private static parsePlayerNamesFromLog(): Map<string, string> {
    const nameMap = new Map<string, string>();
    const logCandidates = [
      path.join(config.palworldDir, 'Pal', 'Saved', 'Logs', 'PalServer.log'),
      '/home/paladmin/palworld/Pal/Saved/Logs/PalServer.log',
      '/home/paladmin/Palserver/Pal/Saved/Logs/PalServer.log',
    ];

    for (const logPath of logCandidates) {
      if (!fs.existsSync(logPath)) continue;

      try {
        const stats = fs.statSync(logPath);
        const readSize = Math.min(stats.size, 200000);
        const start = stats.size - readSize;
        const fd = fs.openSync(logPath, 'r');
        const buf = Buffer.alloc(readSize);
        fs.readSync(fd, buf, 0, buf.length, start);
        fs.closeSync(fd);

        const content = buf.toString('utf-8');
        const lines = content.split('\n');

        for (const line of lines) {
          const m1 = line.match(/Login request:\s*([^\s,]+).*?([a-fA-F0-9]{32})/i);
          if (m1 && m1[1] && m1[2]) {
            nameMap.set(m1[2].toUpperCase(), m1[1].trim());
          }
        }
      } catch {}
    }

    return nameMap;
  }

  /**
   * Queries online players with pinpoint accuracy:
   * 1. Primary: Source RCON 'ShowPlayers' (reports exact currently connected players)
   * 2. Fallback: Save Game synchronization with Level.sav (identifies only players saved in the active autosave tick)
   */
  static async getOnlinePlayers(): Promise<{
    count: number;
    rconEnabled: boolean;
    players: PlayerInfo[];
    savedPlayers: { steamId: string; lastModified: string; sizeBytes: number }[];
  }> {
    const rconCfg = await this.getEffectiveRconConfig();
    const onlinePlayers: PlayerInfo[] = [];
    const nameMap = this.parsePlayerNamesFromLog();

    // Collect all registered player save profiles on disk
    const savedPlayers: { steamId: string; lastModified: string; sizeBytes: number; isRecent: boolean }[] = [];
    const playersDirs = this.findPlayersFolders();

    // Map to hold Level.sav timestamps for each world
    const worldLevelTimes = new Map<string, number>();

    for (const pDir of playersDirs) {
      try {
        const levelSavPath = path.join(pDir, '..', 'Level.sav');
        if (fs.existsSync(levelSavPath)) {
          worldLevelTimes.set(pDir, fs.statSync(levelSavPath).mtime.getTime());
        }

        const files = fs.readdirSync(pDir);
        for (const f of files) {
          if (!f.endsWith('.sav')) continue;

          const fPath = path.join(pDir, f);
          const fStats = fs.statSync(fPath);
          const guid = f.replace('.sav', '');

          savedPlayers.push({
            steamId: guid,
            lastModified: fStats.mtime.toISOString(),
            sizeBytes: fStats.size,
            isRecent: false,
          });
        }
      } catch {}
    }

    // 1. Authoritative Tier: Source RCON ShowPlayers
    let rconWorking = false;
    if (rconCfg.enabled && rconCfg.password) {
      try {
        const raw = await this.sendRconCommand('ShowPlayers');
        if (raw) {
          rconWorking = true;
          const lines = raw.split('\n');
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length >= 3 && parts[0].trim() && parts[1].trim()) {
              onlinePlayers.push({
                name: parts[0].trim(),
                playerUId: parts[1].trim(),
                steamId: parts[2].trim(),
                status: 'online',
                lastOnline: 'Active Now (RCON)',
              });
            }
          }

          Logger.info(`[PlayerService] RCON ShowPlayers returned ${onlinePlayers.length} active players.`);
          return {
            count: onlinePlayers.length,
            rconEnabled: true,
            players: onlinePlayers,
            savedPlayers: savedPlayers.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()),
          };
        }
      } catch (err: any) {
        Logger.debug(`[PlayerService] RCON query failed: ${err.message}`);
      }
    }

    // 2. High-Precision Fallback: Unreal Engine Autosave Synchronization
    // In Palworld, when the server autosaves, Level.sav and all online players' .sav files
    // are modified within 15 seconds of each other. Offline players are NOT modified.
    for (const pDir of playersDirs) {
      try {
        const levelMtime = worldLevelTimes.get(pDir);
        const levelDiffFromNowSec = levelMtime ? (Date.now() - levelMtime) / 1000 : 999999;
        const files = fs.readdirSync(pDir);

        for (const f of files) {
          if (!f.endsWith('.sav')) continue;

          const fPath = path.join(pDir, f);
          const fStats = fs.statSync(fPath);
          const guid = f.replace('.sav', '');
          const diffSecondsFromNow = (Date.now() - fStats.mtime.getTime()) / 1000;

          // Player is online ONLY IF:
          // A: Server saved Level.sav recently (< 300s) AND this player was saved within 15s of Level.sav
          // OR B: Player's file was modified in the last 90 seconds (active gameplay auto-tick)
          const matchesLevelSav = levelMtime !== undefined && levelDiffFromNowSec <= 300 && Math.abs(fStats.mtime.getTime() - levelMtime) <= 15000;
          const isActivelyModified = diffSecondsFromNow <= 90;

          if (matchesLevelSav || isActivelyModified) {
            const alreadyAdded = onlinePlayers.some(
              (p) => p.playerUId.toLowerCase() === guid.toLowerCase() || p.steamId.toLowerCase() === guid.toLowerCase()
            );

            if (!alreadyAdded) {
              const knownName = nameMap.get(guid.toUpperCase()) || `Palworld Adventurer (${guid.substring(0, 8)})`;
              onlinePlayers.push({
                name: knownName,
                playerUId: guid,
                steamId: guid,
                status: 'online',
                lastOnline: diffSecondsFromNow < 60 ? 'Active Now' : `${Math.round(diffSecondsFromNow / 60)}m ago`,
              });
            }
          }
        }
      } catch {}
    }

    Logger.info(`[PlayerService] Live detection complete: ${onlinePlayers.length} online, ${savedPlayers.length} registered character profiles.`);

    return {
      count: onlinePlayers.length,
      rconEnabled: rconWorking || (rconCfg.enabled && Boolean(rconCfg.password)),
      players: onlinePlayers,
      savedPlayers: savedPlayers.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()),
    };
  }

  /**
   * One-click helper to automatically enable RCON in PalWorldSettings.ini.
   */
  static async enableRcon(password?: string): Promise<{ success: boolean; message: string }> {
    const adminPass = password || 'PalAutoAdmin2026!';
    await ConfigService.saveSettings({
      RCONEnabled: true,
      RCONPort: 25575,
      AdminPassword: adminPass,
    });

    return {
      success: true,
      message: `RCON enabled on port 25575. Please restart the Palworld server to apply.`,
    };
  }

  static async kickPlayer(steamId: string): Promise<string> {
    return await this.sendRconCommand(`KickPlayer ${steamId}`);
  }

  static async banPlayer(steamId: string): Promise<string> {
    return await this.sendRconCommand(`BanPlayer ${steamId}`);
  }

  static async broadcastMessage(message: string): Promise<string> {
    const formatted = message.replace(/\s+/g, '_');
    return await this.sendRconCommand(`Broadcast ${formatted}`);
  }

  static async saveWorld(): Promise<string> {
    return await this.sendRconCommand('Save');
  }
}
