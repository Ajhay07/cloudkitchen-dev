import prisma from './prisma';

export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug',
}

export interface LogMetadata {
  [key: string]: unknown;
}

class Logger {
  async info(category: string, message: string, metadata?: LogMetadata) {
    console.log(`[INFO] [${category}] ${message}`, metadata || '');
    await this.saveLog(LogLevel.INFO, category, message, metadata);
  }

  async warn(category: string, message: string, metadata?: LogMetadata) {
    console.warn(`[WARN] [${category}] ${message}`, metadata || '');
    await this.saveLog(LogLevel.WARN, category, message, metadata);
  }

  async error(category: string, message: string, metadata?: LogMetadata) {
    console.error(`[ERROR] [${category}] ${message}`, metadata || '');
    await this.saveLog(LogLevel.ERROR, category, message, metadata);
  }

  async debug(category: string, message: string, metadata?: LogMetadata) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] [${category}] ${message}`, metadata || '');
    }
    await this.saveLog(LogLevel.DEBUG, category, message, metadata);
  }

  private async saveLog(
    level: LogLevel,
    category: string,
    message: string,
    metadata?: LogMetadata
  ) {
    try {
      await prisma.log.create({
        data: {
          level,
          category,
          message,
          metadata: metadata as any,
        },
      });
    } catch (error) {
      console.error('Failed to save log to database:', error);
    }
  }
}

export const logger = new Logger();