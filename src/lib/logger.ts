/**
 * Structured logging utility for containerized environments
 * Provides JSON-formatted logs with proper log levels and metadata
 */

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  environment: string;
  requestId?: string;
  userId?: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private serviceName: string;
  private environment: string;
  private minLevel: LogLevel;

  constructor() {
    this.serviceName = process.env.SERVICE_NAME || 'weekly-content-management';
    this.environment = process.env.NODE_ENV || 'development';
    this.minLevel = this.getMinLogLevel();
  }

  private getMinLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toLowerCase() || 
                  (this.environment === 'production' ? 'info' : 'debug');
    
    switch (level) {
      case 'error': return LogLevel.ERROR;
      case 'warn': return LogLevel.WARN;
      case 'info': return LogLevel.INFO;
      case 'debug': return LogLevel.DEBUG;
      default: 
        // 如果提供了无效的LOG_LEVEL，记录警告并使用默认值
        console.warn(`Invalid LOG_LEVEL: ${process.env.LOG_LEVEL}, using default: ${level}`);
        return this.environment === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    return levels.indexOf(level) <= levels.indexOf(this.minLevel);
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext, error?: Error): LogEntry {
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      environment: this.environment,
    };

    if (context) {
      logEntry.context = context;
      if (context.requestId) logEntry.requestId = context.requestId;
      if (context.userId) logEntry.userId = context.userId;
    }

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    return logEntry;
  }

  private output(logEntry: LogEntry): void {
    if (this.environment === 'production') {
      // In production, output structured JSON logs
      console.log(JSON.stringify(logEntry));
    } else {
      // In development, output human-readable logs
      const timestamp = logEntry.timestamp;
      const level = logEntry.level.toUpperCase().padEnd(5);
      const context = logEntry.context ? ` ${JSON.stringify(logEntry.context)}` : '';
      const error = logEntry.error ? `\n${logEntry.error.stack}` : '';
      console.log(`[${timestamp}] ${level} ${logEntry.message}${context}${error}`);
    }
  }

  error(message: string, context?: LogContext, error?: Error): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.output(this.formatLog(LogLevel.ERROR, message, context, error));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.output(this.formatLog(LogLevel.WARN, message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.output(this.formatLog(LogLevel.INFO, message, context));
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.output(this.formatLog(LogLevel.DEBUG, message, context));
    }
  }

  // Convenience methods for common logging scenarios
  request(method: string, url: string, statusCode: number, duration: number, context?: LogContext): void {
    this.info(`${method} ${url} ${statusCode}`, {
      ...context,
      method,
      url,
      statusCode,
      duration,
      type: 'request'
    });
  }

  database(operation: string, table: string, duration: number, context?: LogContext): void {
    this.debug(`Database ${operation} on ${table}`, {
      ...context,
      operation,
      table,
      duration,
      type: 'database'
    });
  }

  performance(operation: string, duration: number, context?: LogContext): void {
    const level = duration > 1000 ? LogLevel.WARN : LogLevel.DEBUG;
    const message = `Performance: ${operation} took ${duration}ms`;
    
    if (level === LogLevel.WARN) {
      this.warn(message, { ...context, operation, duration, type: 'performance' });
    } else {
      this.debug(message, { ...context, operation, duration, type: 'performance' });
    }
  }
}

// Export singleton instance
export const logger = new Logger();