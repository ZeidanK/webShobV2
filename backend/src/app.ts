import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import path from 'path';

import { config } from './config/index';
import { swaggerSpec } from './config/swagger';
import { apiRoutes } from './routes/index';
import {
  correlationIdMiddleware,
  requestLoggerMiddleware,
  errorHandlerMiddleware,
  notFoundHandler,
  ensureUploadDirs,
} from './middleware/index';

export function createApp(): Express {
  const app = express();

  // Ensure upload directories exist
  ensureUploadDirs();

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    })
  );

  // CORS
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Correlation-ID'],
      exposedHeaders: ['X-Correlation-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    })
  );

  // Compression
  app.use(compression());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
      },
    },
  });
  app.use('/api', limiter);

  // Correlation ID (must be before request logger)
  app.use(correlationIdMiddleware);

  // Request logging
  app.use(requestLoggerMiddleware);

  // Swagger documentation
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      explorer: true,
      customSiteTitle: 'Event Monitoring API Docs',
    })
  );

  // OpenAPI spec endpoint
  app.get('/api/docs/spec', (_req, res) => {
    res.json(swaggerSpec);
  });

  // Static file serving for uploads (MVP - local storage)
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  // API routes
  app.use('/api', apiRoutes);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandlerMiddleware);

  return app;
}

// Export app instance for testing
export const app = createApp();
