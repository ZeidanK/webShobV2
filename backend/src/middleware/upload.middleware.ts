import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request } from 'express';
import { AppError } from '../utils/errors';

/**
 * Allowed MIME types for uploads
 */
const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg'],
  document: ['application/pdf'],
};

/**
 * All allowed MIME types (flattened)
 */
const ALL_ALLOWED_MIME_TYPES = [
  ...ALLOWED_MIME_TYPES.image,
  ...ALLOWED_MIME_TYPES.video,
  ...ALLOWED_MIME_TYPES.audio,
  ...ALLOWED_MIME_TYPES.document,
];

/**
 * File size limits (in bytes)
 */
const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024, // 10MB
  video: 100 * 1024 * 1024, // 100MB
  audio: 10 * 1024 * 1024, // 10MB
  document: 5 * 1024 * 1024, // 5MB
  default: 10 * 1024 * 1024, // 10MB
};

/**
 * Get attachment type from MIME type
 */
export function getAttachmentTypeFromMime(mimeType: string): string {
  if (ALLOWED_MIME_TYPES.image.includes(mimeType)) return 'image';
  if (ALLOWED_MIME_TYPES.video.includes(mimeType)) return 'video';
  if (ALLOWED_MIME_TYPES.audio.includes(mimeType)) return 'audio';
  if (ALLOWED_MIME_TYPES.document.includes(mimeType)) return 'document';
  return 'unknown';
}

/**
 * Get file size limit based on MIME type
 */
function getFileSizeLimit(mimeType: string): number {
  const type = getAttachmentTypeFromMime(mimeType);
  return FILE_SIZE_LIMITS[type as keyof typeof FILE_SIZE_LIMITS] || FILE_SIZE_LIMITS.default;
}

/**
 * Ensure upload directories exist
 */
export function ensureUploadDirs(): void {
  const uploadDir = path.join(__dirname, '../../uploads');
  const thumbnailDir = path.join(uploadDir, 'thumbnails');

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  if (!fs.existsSync(thumbnailDir)) {
    fs.mkdirSync(thumbnailDir, { recursive: true });
  }
}

/**
 * Configure multer storage
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    ensureUploadDirs();
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const safeFilename = `${nameWithoutExt}-${uniqueSuffix}${ext}`;
    cb(null, safeFilename);
  },
});

/**
 * File filter to validate MIME types
 */
const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
  // Check if MIME type is allowed
  if (!ALL_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(
      new AppError(
        'INVALID_FILE_TYPE',
        `File type ${file.mimetype} is not supported. Allowed types: images, videos, audio, PDFs`,
        400
      )
    );
  }

  // Check file size based on type
  const sizeLimit = getFileSizeLimit(file.mimetype);
  if (file.size && file.size > sizeLimit) {
    return cb(
      new AppError(
        'FILE_TOO_LARGE',
        `File size exceeds limit of ${sizeLimit / (1024 * 1024)}MB for ${getAttachmentTypeFromMime(file.mimetype)} files`,
        400
      )
    );
  }

  cb(null, true);
};

/**
 * Multer upload configuration for report attachments
 * - Max 10 files per upload
 * - Max 10MB per image/audio/document
 * - Max 100MB per video
 */
export const uploadReportAttachments = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max (for videos)
    files: 10, // Max 10 files per upload
  },
});

/**
 * Middleware to handle multer errors
 */
export function handleMulterError(error: any, req: Request, res: any, next: any): void {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: 'File size exceeds the allowed limit',
        },
        correlationId: req.correlationId,
      });
    }

    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOO_MANY_FILES',
          message: 'Cannot upload more than 10 files at once',
        },
        correlationId: req.correlationId,
      });
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNEXPECTED_FIELD',
          message: 'Unexpected file field in upload',
        },
        correlationId: req.correlationId,
      });
    }
  }

  next(error);
}
