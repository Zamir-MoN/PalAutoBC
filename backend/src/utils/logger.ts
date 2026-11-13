import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';

export class Logger {
  private static logFile = path.join(config.logsDir, 'app.log');

  static info(message: string, context?: any) {
    this.write('INFO', message, context);
  }

  static warn(message: string, context?: any) {
    this.write('WARN', message, context);
  }

  static error(message: string, context?: any) {
    this.write('ERROR', message, context);
  }

  static debug(message: string, context?: any) {
    if (config.env !== 'production') {
      this.write('DEBUG', message, context);
    }
  }

  private static write(level: string, message: string, context?: any) {
    const timestamp = new Date().toISOString();
    const ctx = context ? ` ${JSON.stringify(context)}` : '';
    const line = `[${timestamp}] [${level}] ${message}${ctx}`;

    console.log(line);

    try {
      if (!fs.existsSync(config.logsDir)) {
        fs.mkdirSync(config.logsDir, { recursive: true });
      }
      fs.appendFileSync(this.logFile, line + '\n');
    } catch {
      // Fallback silently if disk write fails
    }
  }
}

