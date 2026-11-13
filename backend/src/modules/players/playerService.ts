import net from 'net';
import { config } from '../../config/index.js';
import { Logger } from '../../utils/logger.js';

export interface PlayerInfo {
  name: string;
  playerUId: string;
  steamId: string;
  ping?: number;
  location?: string;
}

export class PlayerService {
  /**
   * Executes a native RCON command against the Palworld Server.
   * Palworld uses standard Source RCON protocol over TCP.
   */
  static async sendRconCommand(command: string): Promise<string> {
    if (!config.rconPassword) {
      Logger.debug(`[PlayerService] RCON password not configured, skipping command "${command}"`);
      return '';
    }

    return new Promise((resolve, reject) => {
      const client = new net.Socket();
      let response = '';

      const timeout = setTimeout(() => {
        client.destroy();
        resolve('RCON connection timed out');
      }, 5000);

      client.connect(config.rconPort, '127.0.0.1', () => {
        // Source RCON auth packet (type 3: SERVERDATA_AUTH)
        const authPacket = PlayerService.buildRconPacket(1, 3, config.rconPassword);
        client.write(authPacket);
      });

      client.on('data', (data) => {
        // Parse RCON response
        if (data.length >= 14) {
          const type = data.readInt32LE(8);
          // If auth succeeded, send command
          if (type === 2) {
            const cmdPacket = PlayerService.buildRconPacket(2, 2, command);
            client.write(cmdPacket);
          } else {
            // Data packet
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
        Logger.warn(`[PlayerService] RCON error: ${err.message}`);
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
   * Queries online players using RCON 'ShowPlayers'.
   */
  static async getOnlinePlayers(): Promise<PlayerInfo[]> {
    const raw = await this.sendRconCommand('ShowPlayers');
    if (!raw) return [];

    const players: PlayerInfo[] = [];
    const lines = raw.split('\n');

    // Expected format: name,playeruid,steamid
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

    return players;
  }

  /**
   * Kicks a player by Steam ID.
   */
  static async kickPlayer(steamId: string): Promise<string> {
    return await this.sendRconCommand(`KickPlayer ${steamId}`);
  }

  /**
   * Bans a player by Steam ID.
   */
  static async banPlayer(steamId: string): Promise<string> {
    return await this.sendRconCommand(`BanPlayer ${steamId}`);
  }

  /**
   * Broadcasts a server-wide message.
   */
  static async broadcastMessage(message: string): Promise<string> {
    // Sanitize message spaces
    const formatted = message.replace(/\s+/g, '_');
    return await this.sendRconCommand(`Broadcast ${formatted}`);
  }

  /**
   * Saves the world to disk immediately.
   */
  static async saveWorld(): Promise<string> {
    return await this.sendRconCommand('Save');
  }
}

