import { createApp } from './app';
import { config } from './config/index';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';

async function bootstrap() {
  try {
    // Connect to database
    await connectDatabase();

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(config.port, () => {
      logger.info('Server started', {
        action: 'server.started',
        context: {
          port: config.port,
          env: config.env,
          nodeVersion: process.version,
        },
      });
      logger.info(`API docs available at http://localhost:${config.port}/api/docs`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully`, {
        action: 'server.shutdown.initiated',
        context: { signal },
      });

      server.close(async () => {
        logger.info('HTTP server closed', {
          action: 'server.shutdown.complete',
        });
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout', {
          action: 'server.shutdown.forced',
        });
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', {
        action: 'error.uncaught',
        error: {
          message: error.message,
          stack: error.stack,
        },
      });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', {
        action: 'error.unhandled_rejection',
        error: { reason: String(reason) },
      });
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server', {
      action: 'server.start.failed',
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    process.exit(1);
  }
}

bootstrap();
