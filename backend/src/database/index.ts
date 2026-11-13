import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { config } from '../config/index.js';

// Ensure data subdirectories exist
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
if (!fs.existsSync(config.logsDir)) {
  fs.mkdirSync(config.logsDir, { recursive: true });
}
if (!fs.existsSync(config.tempBackupDir)) {
  fs.mkdirSync(config.tempBackupDir, { recursive: true });
}
if (!fs.existsSync(config.stagingDir)) {
  fs.mkdirSync(config.stagingDir, { recursive: true });
}

export const db = new Database(config.dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL,
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS backup_history (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      filepath TEXT,
      size_bytes INTEGER DEFAULT 0,
      sha256 TEXT,
      storage_type TEXT NOT NULL,
      remote_path TEXT,
      status TEXT NOT NULL, -- pending, creating, uploading, verified, failed
      error_message TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      duration_seconds REAL
    );

    CREATE TABLE IF NOT EXISTS restore_history (
      id TEXT PRIMARY KEY,
      backup_id TEXT,
      filename TEXT NOT NULL,
      status TEXT NOT NULL, -- pending, staging, validated, restoring, completed, failed
      error_message TEXT,
      safety_snapshot_path TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      cron_expression TEXT NOT NULL,
      backup_time TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      last_run TEXT,
      next_run TEXT,
      status TEXT DEFAULT 'idle',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS config_snapshots (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      content TEXT NOT NULL,
      comment TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      details TEXT,
      user_id TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Seed default admin if no users exist
  const count = db.prepare('SELECT count(*) as count FROM users').get() as { count: number };
  if (count.count === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(config.defaultAdminPassword, salt);
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, created_at)
      VALUES (?, ?, ?, 'admin', ?)
    `).run('admin-1', config.defaultAdminUsername, hash, new Date().toISOString());
    console.log(`[Database] Initialized default admin user: ${config.defaultAdminUsername}`);
  }

  // Seed default schedule if none exists
  const scheduleCount = db.prepare('SELECT count(*) as count FROM schedules').get() as { count: number };
  if (scheduleCount.count === 0) {
    db.prepare(`
      INSERT INTO schedules (id, name, enabled, cron_expression, backup_time, timezone, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'schedule-daily',
      'Daily Full Backup',
      1,
      config.backupCron,
      '03:00',
      config.backupTimezone,
      new Date().toISOString(),
      new Date().toISOString()
    );
    console.log(`[Database] Initialized default daily backup schedule (03:00 UTC)`);
  }
}

