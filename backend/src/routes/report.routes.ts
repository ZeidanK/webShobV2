import express, { Request, Response, NextFunction } from 'express';
import { ReportService } from '../services';
import { 
  authenticate, 
  requireRole,
  uploadReportAttachments,
  handleMulterError,
  getAttachmentTypeFromMime
} from '../middleware';
import { UserRole } from '../models';
import { ReportType, ReportStatus, AttachmentType } from '../models/report.model';
import { AppError } from '../utils/errors';
import { successResponse } from '../utils/response';
import { 
  generateThumbnail, 
  isImageFile, 
  getFileUrl, 
  getThumbnailUrl 
} from '../utils/file.utils';
import path from 'path';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ReportType:
 *       type: string
 *       enum:
 *         - suspicious_activity
 *         - theft
 *         - vandalism
 *         - violence
 *         - fire
 *         - medical_emergency
 *         - traffic_incident
 *         - other
 *     ReportStatus:
 *       type: string
 *       enum:
 *         - pending
 *         - verified
 *         - rejected
 *     Location:
 *       type: object
 *       required:
 *         - longitude
 *         - latitude
 *       properties:
 *         longitude:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *           example: -122.4194
 *         latitude:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *           example: 37.7749
 *     Attachment:
 *       type: object
 *       properties:
 *         filename:
 *           type: string
 *         url:
 *           type: string
 *         mimeType:
 *           type: string
 *         size:
 *           type: number
 *         type:
 *           type: string
 *           enum: [image, video, audio, document]
 *         thumbnailUrl:
 *           type: string
 *         uploadedAt:
 *           type: string
 *           format: date-time
 *     Report:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         type:
 *           $ref: '#/components/schemas/ReportType'
 *         status:
 *           $ref: '#/components/schemas/ReportStatus'
 *         location:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               example: Point
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *               example: [-122.4194, 37.7749]
 *         locationDescription:
 *           type: string
 *         reportedBy:
 *           type: object
 *         reporterName:
 *           type: string
 *         attachments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Attachment'
 *         verifiedBy:
 *           type: object
 *         verifiedAt:
 *           type: string
 *           format: date-time
 *         rejectionReason:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /reports:
 *   post:
 *     summary: Submit a new report (citizen)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *               - type
 *               - location
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *                 example: Suspicious activity near park
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *                 example: Saw someone loitering near the playground
 *               type:
 *                 $ref: '#/components/schemas/ReportType'
 *               location:
 *                 $ref: '#/components/schemas/Location'
 *               locationDescription:
 *                 type: string
 *                 maxLength: 500
 *                 example: Central Park, near the main entrance
 *     responses:
 *       201:
 *         description: Report created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Report'
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, description, type, location, locationDescription } = req.body;

      // Validation
      if (!title || !description || !type || !location) {
        throw new AppError('VALIDATION_ERROR', 'Title, description, type, and location are required', 400);
      }

      if (!location.longitude || !location.latitude) {
        throw new AppError('VALIDATION_ERROR', 'Location must include longitude and latitude', 400);
      }

      if (!Object.values(ReportType).includes(type)) {
        throw new AppError('VALIDATION_ERROR', `Invalid report type. Must be one of: ${Object.values(ReportType).join(', ')}`, 400);
      }

      const report = await ReportService.createReport({
        title,
        description,
        type,
        location,
        locationDescription,
        companyId: req.user!.companyId,
        reportedBy: req.user!.id,
        correlationId: req.correlationId!,
      });

      res.status(201).json(successResponse(report, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /reports:
 *   get:
 *     summary: Get all reports (paginated, company-scoped)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/ReportStatus'
 *       - in: query
 *         name: type
 *         schema:
 *           $ref: '#/components/schemas/ReportType'
 *       - in: query
 *         name: reportedBy
 *         schema:
 *           type: string
 *         description: Filter by reporter user ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: List of reports
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Report'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                 correlationId:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  authenticate,
  requireRole(UserRole.OPERATOR),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = 1,
        pageSize = 20,
        status,
        type,
        reportedBy,
        startDate,
        endDate,
      } = req.query;

      const result = await ReportService.getReports({
        companyId: req.user!.companyId,
        page: Number(page),
        pageSize: Number(pageSize),
        status: status as ReportStatus,
        type: type as ReportType,
        reportedBy: reportedBy as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        correlationId: req.correlationId!,
      });

      res.json(successResponse(result.reports, req.correlationId!, {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
        hasNextPage: result.page < result.totalPages,
        hasPrevPage: result.page > 1,
      }));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /reports/{id}:
 *   get:
 *     summary: Get report by ID
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Report details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Report'
 *                 correlationId:
 *                   type: string
 *       404:
 *         description: Report not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const report = await ReportService.getReportById(
        id,
        req.user!.companyId,
        req.correlationId!
      );

      res.json(successResponse(report, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /reports/{id}/attachments:
 *   post:
 *     summary: Add attachments to an existing report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               files:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 maxItems: 10
 *     responses:
 *       200:
 *         description: Attachments added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Report'
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Validation error or file limit exceeded
 *       404:
 *         description: Report not found
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/:id/attachments',
  authenticate,
  uploadReportAttachments.array('files', 10),
  handleMulterError,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        throw new AppError('VALIDATION_ERROR', 'No files provided', 400);
      }

      // Get the existing report to check current attachment count
      const existingReport = await ReportService.getReportById(
        id,
        req.user!.companyId,
        req.correlationId!
      );

      // Check if adding these files would exceed the limit
      if (existingReport.attachments.length + files.length > 10) {
        throw new AppError(
          'ATTACHMENT_LIMIT_EXCEEDED',
          `Cannot add ${files.length} files. Report already has ${existingReport.attachments.length} attachments (max 10)`,
          400
        );
      }

      // Process each file and add to report
      let updatedReport = existingReport;

      for (const file of files) {
        // Generate thumbnail for images
        let thumbnailPath: string | null = null;
        if (isImageFile(file.mimetype)) {
          thumbnailPath = await generateThumbnail(file.path, req.correlationId!);
        }

        // Create attachment object
        const attachment = {
          filename: file.originalname,
          storagePath: file.path,
          url: getFileUrl(file.path),
          mimeType: file.mimetype,
          size: file.size,
          type: getAttachmentTypeFromMime(file.mimetype) as AttachmentType,
          thumbnailUrl: thumbnailPath ? getThumbnailUrl(thumbnailPath) : undefined,
          uploadedAt: new Date(),
        };

        // Add attachment to report
        updatedReport = await ReportService.addAttachment(
          id,
          req.user!.companyId,
          attachment,
          req.user!.id,
          req.correlationId!
        );
      }

      res.json(successResponse(updatedReport, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /reports/{id}/verify:
 *   patch:
 *     summary: Verify a report (operator action)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Report verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Report'
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Report already processed
 *       404:
 *         description: Report not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.patch(
  '/:id/verify',
  authenticate,
  requireRole(UserRole.OPERATOR),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const report = await ReportService.verifyReport(
        id,
        req.user!.companyId,
        req.user!.id,
        req.correlationId!
      );

      res.json(successResponse(report, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /reports/{id}/reject:
 *   patch:
 *     summary: Reject a report (operator action)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rejectionReason
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 maxLength: 500
 *                 example: Duplicate report or insufficient information
 *     responses:
 *       200:
 *         description: Report rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Report'
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Validation error or report already processed
 *       404:
 *         description: Report not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
router.patch(
  '/:id/reject',
  authenticate,
  requireRole(UserRole.OPERATOR),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { rejectionReason } = req.body;

      if (!rejectionReason) {
        throw new AppError('VALIDATION_ERROR', 'Rejection reason is required', 400);
      }

      const report = await ReportService.rejectReport(
        id,
        req.user!.companyId,
        rejectionReason,
        req.user!.id,
        req.correlationId!
      );

      res.json(successResponse(report, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

export default router;
