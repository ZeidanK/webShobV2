import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Rate limiting for mobile endpoints
 * More restrictive than web endpoints to prevent abuse
 */
export const rateLimitMobile = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req: Request) => {
    // Different limits based on endpoint
    if (req.path.includes('/auth/login')) {
      return 10; // 10 login attempts per 15 minutes
    }
    if (req.path.includes('/reports') && req.method === 'POST') {
      return 20; // 20 report submissions per 15 minutes
    }
    if (req.path.includes('/location')) {
      return 300; // 300 location updates per 15 minutes (every 3 seconds)
    }
    return 100; // General limit: 100 requests per 15 minutes
  },
  message: (req: Request) => ({
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this API key. Please try again later.',
      details: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 100,
        endpoint: req.path,
      },
    },
    correlationId: req.correlationId,
  }),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Rate limit by API key + IP combination
    const apiKey = req.headers['x-api-key'] as string;
    const ip = req.ip || req.connection.remoteAddress;
    return apiKey ? `${apiKey}:${ip}` : ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    // Log rate limit exceeded
    logger.warn({
      action: 'mobile.rate_limit.exceeded',
      context: {
        apiKey: req.headers['x-api-key'] ? 'present' : 'missing',
        ip: req.ip,
        path: req.path,
        method: req.method,
      },
      correlationId: req.correlationId,
    });

    const error = new AppError(
      'RATE_LIMIT_EXCEEDED',
      'Too many requests from this API key. Please try again later.',
      429
    );

    res.status(429).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: {
          windowMs: 15 * 60 * 1000,
          retryAfter: Math.ceil(15 * 60 * 1000 / 1000), // seconds
        },
      },
      correlationId: req.correlationId,
    });
  },
  skip: (req: Request) => {
    // Skip rate limiting for health checks
    return req.path === '/api/mobile/health';
  },
});

/**
 * Rate limiting for mobile auth endpoints (more restrictive)
 */
export const rateLimitMobileAuth = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 failed login attempts per 15 minutes
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts. Please try again later.',
      details: {
        windowMs: 15 * 60 * 1000,
        maxRequests: 5,
      },
    },
  },
  keyGenerator: (req: Request) => {
    // Rate limit by API key + email combination for login attempts
    const apiKey = req.headers['x-api-key'] as string;
    const email = req.body?.email;
    return apiKey && email ? `${apiKey}:${email}` : req.ip || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    logger.warn({
      action: 'mobile.auth.rate_limit.exceeded',
      context: {
        email: req.body?.email,
        apiKey: req.headers['x-api-key'] ? 'present' : 'missing',
        ip: req.ip,
      },
      correlationId: req.correlationId,
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: 'Too many authentication attempts. Please try again later.',
        details: {
          retryAfter: Math.ceil(15 * 60 * 1000 / 1000), // seconds
        },
      },
      correlationId: req.correlationId,
    });
  },
});