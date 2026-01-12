import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';
import { config } from './index.js';

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(config.mongodb.uri);
    logger.info('Database connected', {
      action: 'database.connected',
      context: {
        uri: config.mongodb.uri.replace(/\/\/.*@/, '//***@'), // Hide credentials
      },
    });
  } catch (error) {
    logger.error('Database connection failed', {
      action: 'database.connection.failed',
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    logger.info('Database disconnected', {
      action: 'database.disconnected',
    });
  } catch (error) {
    logger.error('Database disconnection failed', {
      action: 'database.disconnection.failed',
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    });
    throw error;
  }
}

// Handle connection events
mongoose.connection.on('error', (error) => {
  logger.error('Database error', {
    action: 'database.error',
    error: { message: error.message },
  });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('Database disconnected', {
    action: 'database.disconnected.unexpected',
  });
});
