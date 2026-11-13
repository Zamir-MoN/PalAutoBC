import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { db } from '../../database/index.js';
import { Logger } from '../../utils/logger.js';

export class ConfigService {
  /**
   * Resolves the active PalWorldSettings.ini path.
   */
  static getConfigPath(): string {
    const liveConfig = path.join(config.palworldDir, 'Pal', 'Saved', 'Config', 'LinuxServer', 'PalWorldSettings.ini');
    if (fs.existsSync(liveConfig)) {
      return liveConfig;
    }
    const defaultTemplate = path.join(config.palworldDir, 'DefaultPalWorldSettings.ini');
    if (fs.existsSync(defaultTemplate)) {
      return defaultTemplate;
    }
    return liveConfig;
  }

  /**
   * Reads and parses PalWorldSettings.ini.
   */
  static async readSettings(): Promise<{ raw: string; parsed: Record<string, string | number | boolean> }> {
    const filePath = this.getConfigPath();
    let content = '';

    if (fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf-8');
    } else {
      // Default fallback template
      content = `[/Script/Pal.PalGameWorldSettings]
OptionSettings=(ServerName="Palworld Server",ServerDescription="Managed by PalAutoBC",ServerPassword="",AdminPassword="",ServerPlayerMaxNum=32,ServerPort=8211,bIsPvP=False,ExpRate=1.000000,PalCaptureRate=1.000000,PalSpawnNumRate=1.000000,DayTimeSpeedRate=1.000000,NightTimeSpeedRate=1.000000,GuildPlayerMaxNum=20,bEnableInvaderEnemy=True,bEnableFastTravel=True,bIsMultiplay=True,bEnableNonLoginPenalty=False,DeathPenalty=All)`;
    }

    const parsed: Record<string, string | number | boolean> = {};

    // Match OptionSettings=(...)
    const optionMatch = content.match(/OptionSettings=\((.*?)\)/s);
    if (optionMatch && optionMatch[1]) {
      const items = optionMatch[1].split(',');
      for (const item of items) {
        const eqIdx = item.indexOf('=');
        if (eqIdx !== -1) {
          const key = item.substring(0, eqIdx).trim();
          let val: any = item.substring(eqIdx + 1).trim();

          // Strip surrounding quotes
          if (val.startsWith('"') && val.endsWith('"')) {
            val = val.substring(1, val.length - 1);
          } else if (val.toLowerCase() === 'true') {
            val = true;
          } else if (val.toLowerCase() === 'false') {
            val = false;
          } else if (!isNaN(Number(val)) && val !== '') {
            val = Number(val);
          }
          parsed[key] = val;
        }
      }
    }

    return { raw: content, parsed };
  }

  /**
   * Saves updated settings safely with pre-save snapshot.
   */
  static async saveSettings(
    newSettings: Record<string, any>,
    username: string = 'admin'
  ): Promise<{ success: boolean; message: string; requiresRestart: boolean }> {
    const filePath = this.getConfigPath();
    const current = await this.readSettings();

    // 1. Create snapshot before modification
    const snapshotId = uuidv4();
    db.prepare(`
      INSERT INTO config_snapshots (id, filename, content, comment, created_by, created_at)
      VALUES (?, ?, ?, 'Pre-update configuration snapshot', ?, ?)
    `).run(snapshotId, path.basename(filePath), current.raw, username, new Date().toISOString());

    // 2. Merge existing parsed options with new options (preserving unsupported keys)
    const merged = { ...current.parsed, ...newSettings };

    // 3. Serialize back into Unreal Engine INI OptionSettings format
    const serializedPairs = Object.entries(merged).map(([key, value]) => {
      if (typeof value === 'boolean') {
        return `${key}=${value ? 'True' : 'False'}`;
      } else if (typeof value === 'number') {
        return `${key}=${value}`;
      } else {
        return `${key}="${value}"`;
      }
    });

    const newContent = `[/Script/Pal.PalGameWorldSettings]\nOptionSettings=(${serializedPairs.join(',')})\n`;

    // Ensure parent directories exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write file
    fs.writeFileSync(filePath, newContent, 'utf-8');
    Logger.info(`[ConfigService] Saved updated PalWorldSettings.ini (Snapshot: ${snapshotId})`);

    return {
      success: true,
      message: 'Configuration saved successfully. Server restart required for settings to take effect.',
      requiresRestart: true,
    };
  }

  /**
   * Retrieves snapshots history.
   */
  static getSnapshots(): any[] {
    return db.prepare('SELECT id, filename, comment, created_by, created_at FROM config_snapshots ORDER BY created_at DESC').all();
  }

  /**
   * Restores a configuration snapshot.
   */
  static restoreSnapshot(snapshotId: string): { success: boolean; message: string } {
    const row = db.prepare('SELECT content FROM config_snapshots WHERE id = ?').get(snapshotId) as { content: string } | undefined;
    if (!row) {
      throw new Error('Snapshot not found');
    }

    const filePath = this.getConfigPath();
    fs.writeFileSync(filePath, row.content, 'utf-8');
    Logger.info(`[ConfigService] Restored configuration snapshot ${snapshotId}`);

    return {
      success: true,
      message: 'Configuration restored from snapshot. Please restart server to apply.',
    };
  }
}

