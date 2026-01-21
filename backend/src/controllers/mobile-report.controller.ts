import { Request, Response, NextFunction } from 'express';
import { Report, ReportSource, ReportType, ReportStatus } from '../models/report.model';
import { User, UserRole } from '../models/user.model';
import { AuditLog, AuditAction } from '../models/audit-log.model';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

/**
 * Mobile Report Controller
 * Handles report submission and management for mobile apps
 */

/**
 * Configure multer for file uploads
 */
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'reports');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, audio, and documents
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/quicktime',
      'video/x-msvideo',
      'audio/mpeg',
      'audio/wav',
      'application/pdf',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('INVALID_FILE_TYPE', 'File type not allowed', 400));
    }
  },
});

/**
 * Get user's own reports
 * GET /api/mobile/reports
 */
export const getUserReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, pageSize = 20, status } = req.query;
    const userId = req.user!.id;
    const companyId = req.user!.companyId;

    // Build filter
    const filter: any = {
      reportedBy: userId,
      companyId,
      source: ReportSource.CITIZEN,
    };

    if (status) {
      filter.status = status;
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(pageSize);
    const limit = Number(pageSize);

    // Get reports with pagination
    const [reports, total] = await Promise.all([
      Report.find(filter)
        .populate('reportedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Report.countDocuments(filter),
    ]);

    logger.info({
      action: 'mobile.reports.list.success',
      context: {
        userId,
        companyId,
        count: reports.length,
        total,
        filters: { status },
      },
      correlationId: req.correlationId,
    });

    res.json({
      success: true,
      data: reports,
      meta: {
        page: Number(page),
        pageSize: Number(pageSize),
        total,
        totalPages: Math.ceil(total / Number(pageSize)),
      },
      correlationId: req.correlationId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create new citizen report
 * POST /api/mobile/reports
 */
export const createReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      title,
      description,
      type,
      location,
      priority = 'medium',
      isAnonymous = false,
    } = req.body;
    const userId = req.user!.id;
    const companyId = req.user!.companyId;

    // Validate required fields
    if (!title || !description || !type || !location) {
      throw new AppError('MISSING_REQUIRED_FIELDS', 'Title, description, type, and location are required', 400);
    }

    // Validate report type
    if (!Object.values(ReportType).includes(type)) {
      throw new AppError('INVALID_REPORT_TYPE', 'Invalid report type', 400);
    }

    // Validate location format (GeoJSON Point)
    if (!location.type || location.type !== 'Point' || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
      throw new AppError('INVALID_LOCATION', 'Location must be a valid GeoJSON Point', 400);
    }

    // Validate coordinates (longitude, latitude)
    const [lng, lat] = location.coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number' || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new AppError('INVALID_COORDINATES', 'Invalid longitude or latitude values', 400);
    }

    // Create report
    const report = new Report({
      title: title.trim(),
      description: description.trim(),
      type,
      source: ReportSource.CITIZEN,
      status: ReportStatus.PENDING,
      priority,
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      reportedBy: isAnonymous ? undefined : userId,
      companyId,
      metadata: {
        channel: 'mobile',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        isAnonymous,
      },
    });

    await report.save();

    // Create audit log
    await AuditLog.create({
      action: AuditAction.REPORT_CREATED,
      companyId,
      userId: isAnonymous ? undefined : userId,
      resourceType: 'Report',
      resourceId: report._id,
      changes: {
        title,
        type,
        source: ReportSource.CITIZEN,
        channel: 'mobile',
      },
      correlationId: req.correlationId,
    });

    logger.info({
      action: 'mobile.report.create.success',
      context: {
        reportId: report._id.toString(),
        userId: isAnonymous ? 'anonymous' : userId,
        companyId,
        type,
        isAnonymous,
      },
      correlationId: req.correlationId,
    });

    // Return created report
    const populatedReport = await Report.findById(report._id)
      .populate('reportedBy', 'firstName lastName email')
      .lean();

    res.status(201).json({
      success: true,
      data: populatedReport,
      correlationId: req.correlationId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add attachment to report
 * POST /api/mobile/reports/:id/attachments
 */
export const addAttachment = [
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id: reportId } = req.params;
      const userId = req.user!.id;
      const companyId = req.user!.companyId;
      const file = req.file;

      if (!file) {
        throw new AppError('NO_FILE_UPLOADED', 'No file was uploaded', 400);
      }

      // Validate report ID
      if (!mongoose.Types.ObjectId.isValid(reportId)) {
        throw new AppError('INVALID_REPORT_ID', 'Invalid report ID format', 400);
      }

      // Find report and verify ownership
      const report = await Report.findOne({
        _id: reportId,
        companyId,
        $or: [
          { reportedBy: userId }, // User owns the report
          { reportedBy: { $exists: false } }, // Anonymous report (allow if same company)
        ],
      });

      if (!report) {
        // Clean up uploaded file
        await fs.unlink(file.path).catch(() => {}); // Ignore errors
        throw new AppError('REPORT_NOT_FOUND', 'Report not found or access denied', 404);
      }

      // Determine attachment type
      let attachmentType: string;
      if (file.mimetype.startsWith('image/')) {
        attachmentType = 'image';
      } else if (file.mimetype.startsWith('video/')) {
        attachmentType = 'video';
      } else if (file.mimetype.startsWith('audio/')) {
        attachmentType = 'audio';
      } else {
        attachmentType = 'document';
      }

      // Create attachment object
      const attachment = {
        filename: file.originalname,
        storagePath: file.path,
        url: `/api/reports/${reportId}/attachments/${file.filename}`,
        mimeType: file.mimetype,
        size: file.size,
        type: attachmentType,
        uploadedAt: new Date(),
      };

      // Add attachment to report
      report.attachments.push(attachment as any);
      await report.save();

      // Create audit log
      await AuditLog.create({
        action: AuditAction.REPORT_UPDATED,
        companyId,
        userId,
        resourceType: 'Report',
        resourceId: report._id,
        changes: {
          attachmentAdded: {
            filename: file.originalname,
            type: attachmentType,
            size: file.size,
          },
        },
        correlationId: req.correlationId,
      });

      logger.info({
        action: 'mobile.report.attachment.success',
        context: {
          reportId,
          userId,
          companyId,
          filename: file.originalname,
          type: attachmentType,
          size: file.size,
        },
        correlationId: req.correlationId,
      });

      res.status(201).json({
        success: true,
        data: {
          attachment,
          reportId,
        },
        correlationId: req.correlationId,
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        await fs.unlink(req.file.path).catch(() => {}); // Ignore errors
      }
      next(error);
    }
  },
];