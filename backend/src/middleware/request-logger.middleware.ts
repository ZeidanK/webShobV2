import { Request, Response, NextFunction } from 'express';
import { createRequestLogger } from '../utils/logger';

/**
 * Middleware to log all incoming requests and their responses
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const logger = createRequestLogger(req.correlationId);

  // Log request start (DEBUG level)
  logger.debug('Request started', {
    action: 'http.request.started',
    context: {
      method: req.method,
      path: req.path,
      query: req.query,
      userAgent: req.headers['user-agent'],
    },
  });

  // Capture response finish
  res.on('finish', () => {
    const duration_ms = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

    logger.log(logLevel, 'Request completed', {
      action: 'http.request.completed',
      context: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
      },
      duration_ms,
    });
  });

  next();
}
