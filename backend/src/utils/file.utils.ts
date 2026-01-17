import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';

/**
 * Thumbnail configuration
 */
const THUMBNAIL_WIDTH = 300;
const THUMBNAIL_HEIGHT = 300;
const THUMBNAIL_QUALITY = 80;

/**
 * Generate thumbnail for an image file
 * @param filePath - Absolute path to the image file
 * @returns Absolute path to the generated thumbnail, or null if generation failed
 */
export async function generateThumbnail(
  filePath: string,
  correlationId: string
): Promise<string | null> {
  try {
    const ext = path.extname(filePath);
    const thumbnailDir = path.join(path.dirname(filePath), '../thumbnails');
    const thumbnailFilename = `thumb-${path.basename(filePath, ext)}.jpg`;
    const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);

    // Ensure thumbnail directory exists
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    // Generate thumbnail using sharp
    await sharp(filePath)
      .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: THUMBNAIL_QUALITY })
      .toFile(thumbnailPath);

    logger.info({
      action: 'thumbnail.generate.success',
      context: {
        originalFile: path.basename(filePath),
        thumbnailFile: thumbnailFilename,
      },
      correlationId,
    });

    return thumbnailPath;
  } catch (error) {
    logger.error({
      action: 'thumbnail.generate.failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      context: { filePath },
      correlationId,
    });

    return null;
  }
}

/**
 * Check if a file is an image that can be thumbnailed
 */
export function isImageFile(mimeType: string): boolean {
  return ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType);
}

/**
 * Delete a file and its thumbnail (if exists)
 */
export async function deleteFileWithThumbnail(
  filePath: string,
  correlationId: string
): Promise<void> {
  try {
    // Delete main file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info({
        action: 'file.delete.success',
        context: { filePath: path.basename(filePath) },
        correlationId,
      });
    }

    // Delete thumbnail if exists
    const ext = path.extname(filePath);
    const thumbnailDir = path.join(path.dirname(filePath), '../thumbnails');
    const thumbnailFilename = `thumb-${path.basename(filePath, ext)}.jpg`;
    const thumbnailPath = path.join(thumbnailDir, thumbnailFilename);

    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
      logger.info({
        action: 'thumbnail.delete.success',
        context: { thumbnailPath: path.basename(thumbnailPath) },
        correlationId,
      });
    }
  } catch (error) {
    logger.error({
      action: 'file.delete.failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      context: { filePath },
      correlationId,
    });
  }
}

/**
 * Get public URL for uploaded file
 */
export function getFileUrl(storagePath: string): string {
  // For MVP, serve files from /uploads route
  // In production, this would be S3/CDN URL
  return `/uploads/${path.basename(storagePath)}`;
}

/**
 * Get public URL for thumbnail
 */
export function getThumbnailUrl(thumbnailPath: string): string {
  // For MVP, serve thumbnails from /uploads/thumbnails route
  return `/uploads/thumbnails/${path.basename(thumbnailPath)}`;
}
