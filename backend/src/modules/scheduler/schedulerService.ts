import cron from 'node-cron';
import { db } from '../../database/index.js';
import { BackupService } from '../backup/backupService.js';
import { Logger } from '../../utils/logger.js';

export class SchedulerService {
  private static scheduledTask: cron.ScheduledTask | null = null;

  static init() {
    this.reloadSchedules();
  }

  static reloadSchedules() {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
    }

    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get('schedule-daily') as any;
    if (!schedule || !schedule.enabled) {
      Logger.info('[SchedulerService] Automated daily backups are disabled.');
      return;
    }

    Logger.info(`[SchedulerService] Scheduling automated backup at "${schedule.cron_expression}" (${schedule.timezone || 'UTC'})`);

    try {
      this.scheduledTask = cron.schedule(
        schedule.cron_expression,
        async () => {
          Logger.info('[SchedulerService] Triggering scheduled daily backup...');
          try {
            db.prepare('UPDATE schedules SET status = "running", last_run = ? WHERE id = ?').run(
              new Date().toISOString(),
              schedule.id
            );

            await BackupService.runBackup('scheduled');

            db.prepare('UPDATE schedules SET status = "idle" WHERE id = ?').run(schedule.id);
          } catch (err: any) {
            Logger.error(`[SchedulerService] Scheduled backup error: ${err.message}`);
            db.prepare('UPDATE schedules SET status = "error" WHERE id = ?').run(schedule.id);
          }
        },
        {
          timezone: schedule.timezone || 'UTC',
        }
      );
    } catch (err: any) {
      Logger.error(`[SchedulerService] Failed to initialize cron: ${err.message}`);
    }
  }

  static updateSchedule(time: string, enabled: boolean, timezone: string = 'UTC') {
    // Time format: HH:mm
    const parts = time.split(':');
    const hour = parseInt(parts[0], 10) || 3;
    const minute = parseInt(parts[1], 10) || 0;
    const cronExp = `${minute} ${hour} * * *`;

    db.prepare(`
      UPDATE schedules
      SET enabled = ?,
          backup_time = ?,
          cron_expression = ?,
          timezone = ?,
          updated_at = ?
      WHERE id = 'schedule-daily'
    `).run(enabled ? 1 : 0, time, cronExp, timezone, new Date().toISOString());

    this.reloadSchedules();
    return db.prepare('SELECT * FROM schedules WHERE id = "schedule-daily"').get();
  }

  static getSchedule() {
    return db.prepare('SELECT * FROM schedules WHERE id = "schedule-daily"').get();
  }
}

