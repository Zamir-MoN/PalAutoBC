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
   * Executes a native Source RCON command.
   */
  static async sendRconCommand(command: string): Promise<string> {
    const rconCfg = await this.getEffectiveRconConfig();

    if (!rconCfg.password) {
      Logger.debug(`[PlayerService] No AdminPassword configured. RCON skipped.`);
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

      client.on('error', () => {
        clearTimeout(timeout);
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
   * Parses PalServer.log to map player GUIDs / IPs to actual character names.
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
        const readSize = Math.min(stats.size, 200000); // Read last 200KB
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
          const m2 = line.match(/Join succeeded:\s*([^\s,]+)/i);
          if (m2 && m2[1]) {
            nameMap.set(`RECENT_${nameMap.size}`, m2[1].trim());
          }
        }
      } catch {}
    }

    return nameMap;
  }

  /**
   * Checks for open character .sav file handles under /proc/<pid>/fd.
   */
  private static async getOpenFdPlayerGuids(): Promise<Set<string>> {
    const openGuids = new Set<string>();
    if (process.platform === 'win32') return openGuids;

    try {
      const { stdout: pids } = await execAsync("pgrep -f 'PalServer-Linux|PalServer.sh' 2>/dev/null").catch(() => ({ stdout: '' }));
      const pidList = pids.trim().split('\n').filter(Boolean);

      for (const p of pidList) {
        const fdDir = `/proc/${p.trim()}/fd`;
        if (fs.existsSync(fdDir)) {
          try {
            const fds = fs.readdirSync(fdDir);
            for (const fd of fds) {
              try {
                const target = fs.readlinkSync(path.join(fdDir, fd));
                if (target.endsWith('.sav') && target.includes('/Players/')) {
                  const guid = path.basename(target, '.sav');
                  openGuids.add(guid.toUpperCase());
                }
              } catch {}
            }
          } catch {}
        }
      }
    } catch {}

    return openGuids;
  }

  /**
   * Inspects Linux netfilter conntrack and socket statistics for live UDP game clients on port 8211.
   */
  private static async getActiveUdpClients(): Promise<Set<string>> {
    const activeClients = new Set<string>();
    if (process.platform === 'win32') return activeClients;

    // 1. Try reading /proc/net/nf_conntrack directly
    try {
      if (fs.existsSync('/proc/net/nf_conntrack')) {
        const ct = fs.readFileSync('/proc/net/nf_conntrack', 'utf-8');
        for (const line of ct.split('\n')) {
          if (line.includes('dport=8211') || line.includes('sport=8211')) {
            const src = line.match(/src=([0-9.]+)/);
            if (src && src[1] && src[1] !== '127.0.0.1' && !src[1].startsWith('0.')) {
              activeClients.add(src[1]);
            }
          }
        }
      }
    } catch {}

    // 2. Try conntrack command line tool if available
    try {
      const { stdout: ctCli } = await execAsync("conntrack -L -p udp --dport 8211 2>/dev/null || true").catch(() => ({ stdout: '' }));
      if (ctCli) {
        for (const match of ctCli.matchAll(/src=([0-9.]+)/g)) {
          if (match[1] && match[1] !== '127.0.0.1') {
            activeClients.add(match[1]);
          }
        }
      }
    } catch {}

    // 3. Check ss command output
    try {
      const { stdout: ssOut } = await execAsync("ss -uan 2>/dev/null | grep ':8211' || true").catch(() => ({ stdout: '' }));
      if (ssOut) {
        const lines = ssOut.trim().split('\n');
        for (const line of lines) {
          const match = line.match(/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+):[0-9]+\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+):[0-9]+/);
          if (match && match[2] && match[2] !== '0.0.0.0' && match[2] !== '127.0.0.1') {
            activeClients.add(match[2]);
          }
        }
      }
    } catch {}

    return activeClients;
  }

  /**
   * Queries online players across all resilient detection channels:
   * 1. Source RCON 'ShowPlayers'
   * 2. Open process file handles (/proc/<pid>/fd/*.sav)
   * 3. Save Game heartbeats (*.sav modification within 30m OR correlated with Level.sav)
   * 4. Linux Kernel Netfilter Conntrack UDP clients
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
    const openFdGuids = await this.getOpenFdPlayerGuids();
    const activeUdpClients = await this.getActiveUdpClients();

    // 1. RCON ShowPlayers
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
              onlinePlayers.push({
                name: parts[0].trim(),
                playerUId: parts[1].trim(),
                steamId: parts[2].trim(),
                status: 'online',
                lastOnline: 'Active Now (RCON)',
              });
            }
          }
        }
      } catch {}
    }

    // 2. Scan Save Game Profiles & Heartbeats
    const savedPlayers: { steamId: string; lastModified: string; sizeBytes: number; isRecent: boolean }[] = [];
    const playersDirs = this.findPlayersFolders();

    for (const pDir of playersDirs) {
      try {
        // Check Level.sav timestamp in world folder
        let levelSavMtime: number | null = null;
        const levelSavPath = path.join(pDir, '..', 'Level.sav');
        if (fs.existsSync(levelSavPath)) {
          levelSavMtime = fs.statSync(levelSavPath).mtime.getTime();
        }

        const files = fs.readdirSync(pDir);
        for (const f of files) {
          if (!f.endsWith('.sav')) continue;

          const fPath = path.join(pDir, f);
          const fStats = fs.statSync(fPath);
          const guid = f.replace('.sav', '');
          const diffMinutes = (Date.now() - fStats.mtime.getTime()) / (1000 * 60);

          // Heartbeat criteria:
          // A: File modified in the last 30 minutes
          // B: File modified within 5 minutes of Level.sav (Unreal Engine autosave synchronization)
          // C: Server process has open file descriptor to this .sav
          const matchesLevelSav = levelSavMtime !== null && Math.abs((fStats.mtime.getTime() - levelSavMtime) / 1000) <= 300;
          const hasOpenFd = openFdGuids.has(guid.toUpperCase());
          const isRecent = diffMinutes <= 30 || matchesLevelSav || hasOpenFd;

          savedPlayers.push({
            steamId: guid,
            lastModified: fStats.mtime.toISOString(),
            sizeBytes: fStats.size,
            isRecent,
          });

          // If online and not already recorded from RCON
          const alreadyAdded = onlinePlayers.some(
            (p) => p.playerUId.toLowerCase() === guid.toLowerCase() || p.steamId.toLowerCase() === guid.toLowerCase()
          );

          if (isRecent && !alreadyAdded) {
            const knownName = nameMap.get(guid.toUpperCase()) || `Palworld Adventurer (${guid.substring(0, 8)})`;
            onlinePlayers.push({
              name: knownName,
              playerUId: guid,
              steamId: guid,
              status: 'online',
              lastOnline: diffMinutes < 1 ? 'Active Now' : `${Math.round(diffMinutes)}m ago`,
            });
          }
        }
      } catch {}
    }

    // 3. Fallback: If network connection tracking detected more active UDP clients than players
    const targetCount = Math.max(onlinePlayers.length, activeUdpClients.size);
    if (onlinePlayers.length < targetCount) {
      let clientIndex = 1;
      for (const ip of activeUdpClients) {
        if (!onlinePlayers.some((p) => p.steamId.includes(ip))) {
          onlinePlayers.push({
            name: `Active Player #${clientIndex}`,
            playerUId: `UDP_SESSION_${ip.replace(/\./g, '_')}`,
            steamId: `IP: ${ip}`,
            status: 'online',
            lastOnline: 'Active Now (Game Session)',
          });
          clientIndex++;
        }
      }
    }

    const finalCount = onlinePlayers.length;
    Logger.debug(`[PlayerService] Detection summary: ${finalCount} online players, ${savedPlayers.length} total saved profiles.`);

    return {
      count: finalCount,
      rconEnabled: rconCfg.enabled && Boolean(rconCfg.password),
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
