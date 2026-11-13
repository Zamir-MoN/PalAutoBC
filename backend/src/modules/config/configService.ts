import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config/index.js';
import { db } from '../../database/index.js';
import { Logger } from '../../utils/logger.js';

export class ConfigService {
  /**
   * Resolves the active PalWorldSettings.ini path across known locations.
   */
  static getConfigPath(): string {
    const candidates = [
      path.join(config.palworldDir, 'Pal', 'Saved', 'Config', 'LinuxServer', 'PalWorldSettings.ini'),
      '/home/paladmin/palworld/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini',
      '/home/paladmin/Palserver/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini',
      '/home/steam/palworld/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini',
      '/home/ubuntu/Palserver/Pal/Saved/Config/LinuxServer/PalWorldSettings.ini',
      path.join(config.palworldDir, 'DefaultPalWorldSettings.ini'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // Default target path
    return path.join(config.palworldDir, 'Pal', 'Saved', 'Config', 'LinuxServer', 'PalWorldSettings.ini');
  }

  /**
   * Parses PalWorldSettings OptionSettings while strictly respecting quoted commas like CrossplayPlatforms="(Steam,Xbox,PS5,Mac)"
   */
  private static parseOptionSettings(raw: string): Record<string, string | number | boolean> {
    const result: Record<string, string | number | boolean> = {};
    const match = raw.match(/OptionSettings=\(([\s\S]*?)\)(?:\r?\n|$)/);
    if (!match || !match[1]) return result;

    const inner = match[1];
    const items: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < inner.length; i++) {
      const char = inner[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === ',' && !inQuotes) {
        if (current.trim()) items.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) items.push(current.trim());

    for (const item of items) {
      const eqIdx = item.indexOf('=');
      if (eqIdx !== -1) {
        const key = item.substring(0, eqIdx).trim();
        let val: any = item.substring(eqIdx + 1).trim();

        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        } else if (val.toLowerCase() === 'true') {
          val = true;
        } else if (val.toLowerCase() === 'false') {
          val = false;
        } else if (!isNaN(Number(val)) && val !== '') {
          val = Number(val);
        }
        result[key] = val;
      }
    }
    return result;
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
      content = `[/Script/Pal.PalGameWorldSettings]
OptionSettings=(ServerName="Palulu Gang",ServerDescription="",ServerPlayerMaxNum=32,AdminPassword="zamir015",ServerPassword="palulu2999",PublicPort=8211,PublicIP="",RCONEnabled=True,RCONPort=25575,Difficulty=None,DeathPenalty=None,ExpRate=1.000000,PalCaptureRate=1.000000,WorkSpeedRate=1.000000,DayTimeSpeedRate=1.000000,NightTimeSpeedRate=1.000000,PalSpawnNumRate=1.000000,PalEggDefaultHatchingTime=0.000000,PhysicsActiveDropItemMaxNum=3000,BaseCampWorkerMaxNum=15,GuildPlayerMaxNum=20,bIsPvP=True,bEnablePlayerToPlayerDamage=True,bEnableFriendlyFire=False,PalDamageRateAttack=1.000000,PalDamageRateDefense=1.000000,CrossplayPlatforms="(Steam,Xbox,PS5,Mac)",bAllowClientMod=True,bIsUseBackupSaveData=True,LogFormatType=Text,RESTAPIEnabled=True,RESTAPIPort=8212,ChatPostLimitPerMinute=30,BaseCampMaxNumInGuild=8,MaxBuildingLimitNum=0,ServerReplicatePawnCullDistance=15000.000000,ItemWeightRate=0.200000,ItemCorruptionMultiplier=0.000000,SupplyDropSpan=180,MonsterFarmActionSpeedRate=1.000000,PlayerStaminaDecreaceRate=0.1,PalStaminaDecreaceRate=0.1,bAllowGlobalPalboxExport=True,bAllowGlobalPalboxImport=True,bEnableNonLoginPenalty=False,PalStomachDecreaceRate=0.500000,PalAutoHPRegeneRate=1.000000)`;
    }

    const parsed = this.parseOptionSettings(content);
    return { raw: content, parsed };
  }

  /**
   * Saves updated settings safely with pre-save snapshot.
   * Supports either parsed key-value settings OR direct raw text.
   */
  static async saveSettings(
    newSettings: Record<string, any>,
    rawContent?: string,
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

    let finalContent = '';

    if (rawContent && rawContent.trim().length > 0) {
      // Direct raw INI write
      finalContent = rawContent.trim() + '\n';
    } else {
      // Merge existing parsed options with new options
      const merged = { ...current.parsed, ...newSettings };

      const serializedPairs = Object.entries(merged).map(([key, value]) => {
        if (typeof value === 'boolean') {
          return `${key}=${value ? 'True' : 'False'}`;
        } else if (typeof value === 'number') {
          return `${key}=${value}`;
        } else {
          return `${key}="${value}"`;
        }
      });

      finalContent = `[/Script/Pal.PalGameWorldSettings]\nOptionSettings=(${serializedPairs.join(',')})\n`;
    }

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, finalContent, 'utf-8');
    Logger.info(`[ConfigService] PalWorldSettings.ini updated successfully at ${filePath}`);

    return {
      success: true,
      message: 'PalWorldSettings.ini updated successfully. Restart Palworld server to apply new values.',
      requiresRestart: true,
    };
  }

  /**
   * Retrieves all configuration snapshot revisions.
   */
  static async getSnapshots(): Promise<any[]> {
    return db.prepare('SELECT * FROM config_snapshots ORDER BY created_at DESC').all();
  }

  /**
   * Restores a previously saved configuration snapshot.
   */
  static async restoreSnapshot(snapshotId: string): Promise<boolean> {
    const snapshot = db.prepare('SELECT * FROM config_snapshots WHERE id = ?').get(snapshotId) as any;
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    const filePath = this.getConfigPath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, snapshot.content, 'utf-8');
    Logger.info(`[ConfigService] Restored configuration snapshot ${snapshotId} to ${filePath}`);
    return true;
  }
}
