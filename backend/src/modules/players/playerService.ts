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
   * Executes a native Source RCON command.
   */
  static async sendRconCommand(command: string): Promise<string> {
    const rconCfg = await this.getEffectiveRconConfig();

    if (!rconCfg.password) {
      Logger.debug(`[PlayerService] No AdminPassword found in PalWorldSettings.ini. RCON skipped.`);
      return '';
    }

    return new Promise((resolve) => {
      const client = new net.Socket();
      let response = '';

      const timeout = setTimeout(() => {
        client.destroy();
        resolve('');
      }, 3500);

      client.connect(rconCfg.port, '127.0.0.1', () => {
        const authPacket = PlayerService.buildRconPacket(1, 3, rconCfg.password);
        client.write(authPacket);
      });

      client.on('data', (data) => {
        if (data.length >= 14) {
          const type = data.readInt32LE(8);
          if (type === 2) {
            // Auth OK, send command
            const cmdPacket = PlayerService.buildRconPacket(2, 2, command);
            client.write(cmdPacket);
          } else {
            const body = data.subarray(12, data.length - 2).toString('utf-8');
            response += body;
            clearTimeout(timeout);
            client.end();
            resolve(response.trim());
          }
        }
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        Logger.debug(`[PlayerService] RCON socket error: ${err.message}`);
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
   * Queries online players using multiple resilient fallback mechanisms:
   * 1. RCON 'ShowPlayers'
   * 2. Built-in Palworld REST API (/v1/api/players)
   * 3. Network socket telemetry on UDP port 8211
   * 4. Save game player profiles (*.sav)
   */
  static async getOnlinePlayers(): Promise<{
    count: number;
    rconEnabled: boolean;
    players: PlayerInfo[];
    savedPlayers: { steamId: string; lastModified: string; sizeBytes: number }[];
  }> {
    const rconCfg = await this.getEffectiveRconConfig();
    const players: PlayerInfo[] = [];

    // 1. Try RCON ShowPlayers
    if (rconCfg.password) {
      try {
        const raw = await this.sendRconCommand('ShowPlayers');
        if (raw) {
          const lines = raw.split('\n');
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',');
            if (parts.length >= 3) {
              players.push({
                name: parts[0].trim(),
                playerUId: parts[1].trim(),
                steamId: parts[2].trim(),
              });
            }
          }
        }
      } catch {}
    }

    // 2. Try Palworld v0.2.0+ REST API fallback
    if (players.length === 0 && rconCfg.password) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`admin:${rconCfg.password}`).toString('base64');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);

        const res = await fetch('http://127.0.0.1:8212/v1/api/players', {
          headers: { Authorization: authHeader },
          signal: controller.signal,
        }).catch(() => null);

        clearTimeout(timeout);
        if (res && res.ok) {
          const data: any = await res.json().catch(() => null);
          if (data && Array.isArray(data.players)) {
            for (const p of data.players) {
              players.push({
                name: p.name || 'Palworld Player',
                playerUId: p.playerId || '',
                steamId: p.userId || '',
                ping: p.ping,
                level: p.level,
              });
            }
          }
        }
      } catch {}
    }

    // 3. Fallback: Socket connection inspection (counts active game clients)
    let socketCount = players.length;
    if (players.length === 0 && process.platform !== 'win32') {
      try {
        // Inspect active UDP sockets on port 8211
        const { stdout } = await execAsync("ss -uan 'sport = :8211' 2>/dev/null || netstat -un | grep 8211 || true");
        const lines = stdout.trim().split('\n').filter((l) => l.includes(':8211') && !l.includes('0.0.0.0:*') && !l.includes('*.*'));
        if (lines.length > 0) {
          socketCount = lines.length;
          // Generate placeholder entries for active connected client connections
          for (let i = 0; i < lines.length; i++) {
            players.push({
              name: `Connected Client #${i + 1}`,
              playerUId: `ACTIVE_UDP_CLIENT_${i + 1}`,
              steamId: `Connection Active (Port 8211)`,
            });
          }
        }
      } catch {}
    }

    // 4. Inspect saved player character profiles from save folder
    const savedPlayers: { steamId: string; lastModified: string; sizeBytes: number }[] = [];
    try {
      const saveDir = path.join(config.palworldDir, 'Pal', 'Saved', 'SaveGames');
      if (fs.existsSync(saveDir)) {
        const worlds = fs.readdirSync(saveDir, { withFileTypes: true });
        for (const w of worlds) {
          if (w.isDirectory()) {
            const worldPath = path.join(saveDir, w.name);
            const sub = fs.readdirSync(worldPath, { withFileTypes: true });
            for (const s of sub) {
              if (s.isDirectory()) {
                const playersDir = path.join(worldPath, s.name, 'Players');
                if (fs.existsSync(playersDir)) {
                  const saveFiles = fs.readdirSync(playersDir);
                  for (const sf of saveFiles) {
                    if (sf.endsWith('.sav')) {
                      const fileStats = fs.statSync(path.join(playersDir, sf));
                      savedPlayers.push({
                        steamId: sf.replace('.sav', ''),
                        lastModified: fileStats.mtime.toISOString(),
                        sizeBytes: fileStats.size,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch {}

    return {
      count: Math.max(players.length, socketCount),
      rconEnabled: rconCfg.enabled && Boolean(rconCfg.password),
      players,
      savedPlayers,
    };
  }

  /**
   * One-click helper to automatically enable RCON and set an AdminPassword in PalWorldSettings.ini.
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
      message: `RCON has been enabled on port 25575 with AdminPassword. Please restart the Palworld server to apply.`,
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
