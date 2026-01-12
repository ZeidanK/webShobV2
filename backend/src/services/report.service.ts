import mongoose from 'mongoose';
import { 
  Report, 
  IReport, 
  ReportStatus, 
  ReportSource, 
  ReportType,
  IAttachment,
  AttachmentType 
} from '../models/report.model';
import { User } from '../models/user.model';
import { AuditLog, AuditAction } from '../models';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { websocketService } from './websocket.service';

/**
 * Report Service
 * Handles report submission, verification, and management with tenant isolation
 */
export class ReportService {
  /**
   * Create a new report (citizen submission)
   */
  static async createReport(data: {
    title: string;
    description: string;
    type: ReportType;
    location: {
      longitude: number;
      latitude: number;
    };
    locationDescription?: string;
    companyId: string;
    reportedBy: string;
    source?: ReportSource;
    correlationId: string;
  }): Promise<IReport> {
    try {
      logger.info({
        action: 'report.create.start',
        context: { 
          companyId: data.companyId, 
          reportedBy: data.reportedBy,
          type: data.type 
        },
        correlationId: data.correlationId,
      });

      // Validate user exists and belongs to company
      const user = await User.findOne({
        _id: data.reportedBy,
        companyId: data.companyId,
      });

      if (!user) {
        throw new AppError('USER_NOT_FOUND', 'User not found or does not belong to this company', 404);
      }

      // Create report with GeoJSON format
      const report = new Report({
        title: data.title,
        description: data.description,
        type: data.type,
        source: data.source || ReportSource.CITIZEN,
        status: ReportStatus.PENDING,
        companyId: data.companyId,
        location: {
          type: 'Point',
          coordinates: [data.location.longitude, data.location.latitude],
        },
        locationDescription: data.locationDescription,
        reportedBy: data.reportedBy,
        reporterName: `${user.firstName} ${user.lastName}`,
      });

      await report.save();

      // Create audit log
      await AuditLog.create({
        action: AuditAction.REPORT_CREATED,
        resourceType: 'Report',
        resourceId: report._id,
        companyId: data.companyId,
        performedBy: data.reportedBy,
        changes: {
          title: report.title,
          type: report.type,
          status: report.status,
        },
        correlationId: data.correlationId,
      });

      logger.info({
        action: 'report.create.success',
        context: { 
          companyId: data.companyId, 
          reportId: report._id.toString(),
          type: report.type 
        },
        correlationId: data.correlationId,
      });

      // Broadcast report:created to company room
      websocketService.broadcastReportCreated(data.companyId, {
        _id: report._id,
        title: report.title,
        description: report.description,
        type: report.type,
        status: report.status,
        source: report.source,
        location: report.location,
        locationDescription: report.locationDescription,
        reportedBy: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
        },
        reporterName: report.reporterName,
        createdAt: report.createdAt,
        correlationId: data.correlationId,
      });

      return report;
    } catch (error) {
      logger.error({
        action: 'report.create.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { companyId: data.companyId },
        correlationId: data.correlationId,
      });

      throw error;
    }
  }

  /**
   * Get reports with pagination (company-scoped)
   */
  static async getReports(params: {
    companyId: string;
    page?: number;
    pageSize?: number;
    status?: ReportStatus;
    type?: ReportType;
    reportedBy?: string;
    startDate?: Date;
    endDate?: Date;
    correlationId: string;
  }): Promise<{
    reports: IReport[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const page = params.page || 1;
      const pageSize = Math.min(params.pageSize || 20, 100); // Max 100 per page
      const skip = (page - 1) * pageSize;

      logger.info({
        action: 'report.list.start',
        context: { 
          companyId: params.companyId, 
          page, 
          pageSize,
          filters: {
            status: params.status,
            type: params.type,
            reportedBy: params.reportedBy,
          }
        },
        correlationId: params.correlationId,
      });

      // Build query (MUST filter by companyId - tenant isolation)
      const query: any = { companyId: params.companyId };

      if (params.status) {
        query.status = params.status;
      }

      if (params.type) {
        query.type = params.type;
      }

      if (params.reportedBy) {
        query.reportedBy = params.reportedBy;
      }

      // Date range filter
      if (params.startDate || params.endDate) {
        query.createdAt = {};
        if (params.startDate) {
          query.createdAt.$gte = params.startDate;
        }
        if (params.endDate) {
          query.createdAt.$lte = params.endDate;
        }
      }

      // Execute query with pagination
      const [reports, total] = await Promise.all([
        Report.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(pageSize)
          .populate('reportedBy', 'firstName lastName email')
          .populate('verifiedBy', 'firstName lastName'),
        Report.countDocuments(query),
      ]);

      const totalPages = Math.ceil(total / pageSize);

      logger.info({
        action: 'report.list.success',
        context: { 
          companyId: params.companyId, 
          count: reports.length,
          total 
        },
        correlationId: params.correlationId,
      });

      return {
        reports,
        total,
        page,
        pageSize,
        totalPages,
      };
    } catch (error) {
      logger.error({
        action: 'report.list.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { companyId: params.companyId },
        correlationId: params.correlationId,
      });

      throw error;
    }
  }

  /**
   * Get report by ID (company-scoped)
   */
  static async getReportById(
    reportId: string,
    companyId: string,
    correlationId: string
  ): Promise<IReport> {
    try {
      logger.info({
        action: 'report.get.start',
        context: { companyId, reportId },
        correlationId,
      });

      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(reportId)) {
        throw new AppError('INVALID_ID', 'Invalid report ID format', 400);
      }

      // MUST filter by companyId for tenant isolation
      const report = await Report.findOne({
        _id: reportId,
        companyId,
      })
        .populate('reportedBy', 'firstName lastName email')
        .populate('verifiedBy', 'firstName lastName');

      if (!report) {
        throw new AppError('REPORT_NOT_FOUND', 'Report not found', 404);
      }

      logger.info({
        action: 'report.get.success',
        context: { companyId, reportId },
        correlationId,
      });

      return report;
    } catch (error) {
      logger.error({
        action: 'report.get.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { companyId, reportId },
        correlationId,
      });

      throw error;
    }
  }

  /**
   * Add attachment to existing report
   */
  static async addAttachment(
    reportId: string,
    companyId: string,
    attachment: IAttachment,
    performedBy: string,
    correlationId: string
  ): Promise<IReport> {
    try {
      logger.info({
        action: 'report.attachment.add.start',
        context: { companyId, reportId, filename: attachment.filename },
        correlationId,
      });

      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(reportId)) {
        throw new AppError('INVALID_ID', 'Invalid report ID format', 400);
      }

      // Find report (tenant-scoped)
      const report = await Report.findOne({
        _id: reportId,
        companyId,
      });

      if (!report) {
        throw new AppError('REPORT_NOT_FOUND', 'Report not found', 404);
      }

      // Validate attachment limit
      if (report.attachments.length >= 10) {
        throw new AppError(
          'ATTACHMENT_LIMIT_EXCEEDED',
          'Cannot exceed 10 attachments per report',
          400
        );
      }

      // Add attachment
      report.attachments.push(attachment);
      await report.save();

      // Create audit log
      await AuditLog.create({
        action: AuditAction.REPORT_UPDATED,
        resourceType: 'Report',
        resourceId: report._id,
        companyId,
        performedBy,
        changes: {
          attachmentAdded: attachment.filename,
        },
        correlationId,
      });

      logger.info({
        action: 'report.attachment.add.success',
        context: { 
          companyId, 
          reportId, 
          filename: attachment.filename,
          totalAttachments: report.attachments.length 
        },
        correlationId,
      });

      return report;
    } catch (error) {
      logger.error({
        action: 'report.attachment.add.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { companyId, reportId },
        correlationId,
      });

      throw error;
    }
  }

  /**
   * Verify report (operator action)
   */
  static async verifyReport(
    reportId: string,
    companyId: string,
    verifiedBy: string,
    correlationId: string
  ): Promise<IReport> {
    try {
      logger.info({
        action: 'report.verify.start',
        context: { companyId, reportId, verifiedBy },
        correlationId,
      });

      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(reportId)) {
        throw new AppError('INVALID_ID', 'Invalid report ID format', 400);
      }

      // Find report (tenant-scoped)
      const report = await Report.findOne({
        _id: reportId,
        companyId,
      });

      if (!report) {
        throw new AppError('REPORT_NOT_FOUND', 'Report not found', 404);
      }

      // Check if already verified or rejected
      if (report.status !== ReportStatus.PENDING) {
        throw new AppError(
          'REPORT_ALREADY_PROCESSED',
          `Report has already been ${report.status}`,
          400
        );
      }

      // Update status
      report.status = ReportStatus.VERIFIED;
      report.verifiedBy = new mongoose.Types.ObjectId(verifiedBy);
      report.verifiedAt = new Date();
      report.rejectionReason = undefined; // Clear rejection reason if any

      await report.save();

      // Create audit log
      await AuditLog.create({
        action: AuditAction.REPORT_UPDATED,
        resourceType: 'Report',
        resourceId: report._id,
        companyId,
        performedBy: verifiedBy,
        changes: {
          status: { from: ReportStatus.PENDING, to: ReportStatus.VERIFIED },
          verifiedBy,
          verifiedAt: report.verifiedAt,
        },
        correlationId,
      });

      logger.info({
        action: 'report.verify.success',
        context: { companyId, reportId, verifiedBy },
        correlationId,
      });

      return report;
    } catch (error) {
      logger.error({
        action: 'report.verify.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { companyId, reportId },
        correlationId,
      });

      throw error;
    }
  }

  /**
   * Reject report (operator action)
   */
  static async rejectReport(
    reportId: string,
    companyId: string,
    rejectionReason: string,
    performedBy: string,
    correlationId: string
  ): Promise<IReport> {
    try {
      logger.info({
        action: 'report.reject.start',
        context: { companyId, reportId, performedBy },
        correlationId,
      });

      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(reportId)) {
        throw new AppError('INVALID_ID', 'Invalid report ID format', 400);
      }

      // Find report (tenant-scoped)
      const report = await Report.findOne({
        _id: reportId,
        companyId,
      });

      if (!report) {
        throw new AppError('REPORT_NOT_FOUND', 'Report not found', 404);
      }

      // Check if already verified or rejected
      if (report.status !== ReportStatus.PENDING) {
        throw new AppError(
          'REPORT_ALREADY_PROCESSED',
          `Report has already been ${report.status}`,
          400
        );
      }

      // Validate rejection reason
      if (!rejectionReason || rejectionReason.trim().length === 0) {
        throw new AppError('VALIDATION_ERROR', 'Rejection reason is required', 400);
      }

      // Update status
      report.status = ReportStatus.REJECTED;
      report.verifiedBy = new mongoose.Types.ObjectId(performedBy);
      report.verifiedAt = new Date();
      report.rejectionReason = rejectionReason;

      await report.save();

      // Create audit log
      await AuditLog.create({
        action: AuditAction.REPORT_UPDATED,
        resourceType: 'Report',
        resourceId: report._id,
        companyId,
        performedBy,
        changes: {
          status: { from: ReportStatus.PENDING, to: ReportStatus.REJECTED },
          verifiedBy: performedBy,
          verifiedAt: report.verifiedAt,
          rejectionReason,
        },
        correlationId,
      });

      logger.info({
        action: 'report.reject.success',
        context: { companyId, reportId, performedBy },
        correlationId,
      });

      return report;
    } catch (error) {
      logger.error({
        action: 'report.reject.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { companyId, reportId },
        correlationId,
      });

      throw error;
    }
  }

  /**
   * Get reports within a geographic bounding box
   * Supports filtering by status and type
   */
  static async getReportsInBoundingBox(params: {
    companyId: string;
    minLng: number;
    minLat: number;
    maxLng: number;
    maxLat: number;
    status?: ReportStatus | ReportStatus[];
    type?: ReportType | ReportType[];
    correlationId: string;
  }): Promise<IReport[]> {
    try {
      const { companyId, minLng, minLat, maxLng, maxLat, status, type, correlationId } = params;

      logger.info({
        action: 'report.geo.query.start',
        context: { companyId, bounds: { minLng, minLat, maxLng, maxLat }, filters: { status, type } },
        correlationId,
      });

      // Build query
      const query: any = {
        companyId,
        location: {
          $geoWithin: {
            $box: [
              [minLng, minLat], // Southwest corner
              [maxLng, maxLat], // Northeast corner
            ],
          },
        },
      };

      // Apply status filter
      if (status) {
        if (Array.isArray(status)) {
          query.status = { $in: status };
        } else {
          query.status = status;
        }
      }

      // Apply type filter
      if (type) {
        if (Array.isArray(type)) {
          query.type = { $in: type };
        } else {
          query.type = type;
        }
      }

      // Execute query with populated fields
      const reports = await Report.find(query)
        .populate('reportedBy', 'firstName lastName email')
        .select('title description type status source location locationDescription attachments createdAt reportedBy')
        .sort({ createdAt: -1 });

      logger.info({
        action: 'report.geo.query.success',
        context: { companyId, reportCount: reports.length },
        correlationId,
      });

      return reports;
    } catch (error) {
      logger.error({
        action: 'report.geo.query.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { companyId: params.companyId },
        correlationId: params.correlationId,
      });

      throw error;
    }
  }
}
