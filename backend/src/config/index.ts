import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  serviceName: process.env.SERVICE_NAME || 'backend-api',

  // Database
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/event_monitoring_dev',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'development-secret-change-me',
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '24h',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '30d',
  },

  // API Key
  apiKeyPrefix: process.env.API_KEY_PREFIX || 'emp',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // CORS
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // File Upload
  upload: {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
    maxFilesPerRequest: parseInt(process.env.MAX_FILES_PER_REQUEST || '5', 10),
    uploadDir: process.env.UPLOAD_DIR || './uploads',
  },

  // Direct RTSP streaming
  streaming: {
    baseDir: process.env.STREAMING_BASE_DIR || './streams',
    tokenTtlSeconds: parseInt(process.env.STREAMING_TOKEN_TTL_SECONDS || '300', 10),
    ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
    idleTimeoutMs: parseInt(process.env.STREAMING_IDLE_TIMEOUT_MS || '300000', 10),
    publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
    transcodeEnabled: process.env.STREAMING_TRANSCODE_ENABLED === 'true',
    transcodePreset: process.env.STREAMING_TRANSCODE_PRESET || 'veryfast',
    maxProcesses: parseInt(process.env.STREAMING_MAX_PROCESSES || '8', 10),
  },

  // AI Service
  aiService: {
    url: process.env.AI_SERVICE_URL || 'http://localhost:8000',
  },
};

// Validate critical config in production
if (config.env === 'production') {
  if (config.jwt.secret === 'development-secret-change-me') {
    throw new Error('JWT_SECRET must be set in production');
  }
}
