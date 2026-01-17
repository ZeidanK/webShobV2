import winston from 'winston';
import { config } from '../config/index';

const { combine, timestamp, json, colorize, printf } = winston.format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
  return `${timestamp} [${level}]: ${message} ${metaStr}`;
});

// Create the logger instance
export const logger = winston.createLogger({
  level: config.logLevel,
  defaultMeta: {
    service: config.serviceName,
  },
  format: combine(timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), json()),
  transports: [
    new winston.transports.Console({
      format:
        config.env === 'development' ? combine(colorize(), timestamp(), devFormat) : undefined,
    }),
  ],
});

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown> = {}) {
  return logger.child(context);
}

/**
 * Request-scoped logger that includes correlationId
 */
export function createRequestLogger(correlationId: string, additionalContext: Record<string, unknown> = {}) {
  return logger.child({
    correlationId,
    ...additionalContext,
  });
}
