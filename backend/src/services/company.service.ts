import mongoose from 'mongoose';
import { Company, ICompany, CompanyStatus, CompanyType, ICompanySettings } from '../models/company.model';
import { AuditLog, AuditAction } from '../models';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Company Service
 * Handles company CRUD operations with tenant isolation and audit logging
 */
export class CompanyService {
  /**
   * Create a new company (super_admin only)
   */
  static async createCompany(data: {
    name: string;
    type?: CompanyType;
    contactEmail?: string;
    contactPhone?: string;
    settings?: Partial<ICompanySettings>;
    createdBy: string;
    correlationId: string;
  }): Promise<ICompany> {
    try {
      logger.info({
        action: 'company.create.start',
        context: { name: data.name, type: data.type },
        correlationId: data.correlationId,
      });

      // Create company
      const company = new Company({
        name: data.name,
        type: data.type || CompanyType.STANDARD,
        status: CompanyStatus.ACTIVE,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        settings: {
          ...data.settings,
        },
        createdBy: data.createdBy,
      });

      await company.save();

      // Create audit log
      await AuditLog.create({
        action: AuditAction.COMPANY_CREATED,
        resourceType: 'Company',
        resourceId: company._id,
        companyId: company._id, // For company creation, companyId is the company itself
        performedBy: data.createdBy,
        changes: {
          name: company.name,
          type: company.type,
          status: company.status,
        },
        correlationId: data.correlationId,
      });

      logger.info({
        action: 'company.create.success',
        context: { companyId: company._id.toString(), name: company.name },
        correlationId: data.correlationId,
      });

      return company;
    } catch (error) {
      
      logger.error({
        action: 'company.create.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        correlationId: data.correlationId,
      });

      if (error instanceof Error && error.message.includes('duplicate key')) {
        throw new AppError('COMPANY_EXISTS', 'A company with this name already exists', 400);
      }

      throw error;
    }
  }

  /**
   * Get company by ID
   */
  static async getCompanyById(
    companyId: string,
    options: { includeApiKey?: boolean } = {}
  ): Promise<ICompany> {
    try {
      let query = Company.findById(companyId);

      if (options.includeApiKey) {
        query = query.select('+apiKey');
      }

      const company = await query.exec();

      if (!company) {
        throw new AppError('COMPANY_NOT_FOUND', 'Company not found', 404);
      }

      return company;
    } catch (error) {
      if (error instanceof AppError) throw error;
      
      logger.error({
        action: 'company.get.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { companyId },
      });

      throw new AppError('DATABASE_ERROR', 'Failed to retrieve company', 500);
    }
  }

  /**
   * Get all companies (super_admin only, with pagination)
   */
  static async getAllCompanies(options: {
    page?: number;
    pageSize?: number;
    status?: CompanyStatus;
  } = {}): Promise<{ companies: ICompany[]; total: number; page: number; pageSize: number }> {
    try {
      const page = options.page || 1;
      const pageSize = Math.min(options.pageSize || 20, 100);
      const skip = (page - 1) * pageSize;

      const filter: any = {};
      if (options.status) {
        filter.status = options.status;
      }

      const [companies, total] = await Promise.all([
        Company.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }).exec(),
        Company.countDocuments(filter).exec(),
      ]);

      return {
        companies,
        total,
        page,
        pageSize,
      };
    } catch (error) {
      logger.error({
        action: 'company.list.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new AppError('DATABASE_ERROR', 'Failed to retrieve companies', 500);
    }
  }

  /**
   * Update company settings
   */
  static async updateCompanySettings(
    companyId: string,
    settings: Partial<ICompanySettings>,
    updatedBy: string,
    correlationId: string
  ): Promise<ICompany> {
    try {
      logger.info({
        action: 'company.update.settings.start',
        context: { companyId },
        correlationId,
      });

      const company = await Company.findById(companyId);

      if (!company) {
        throw new AppError('COMPANY_NOT_FOUND', 'Company not found', 404);
      }

      const oldSettings = { ...company.settings };

      // Update settings
      company.settings = {
        ...company.settings,
        ...settings,
      };
      company.updatedBy = new mongoose.Types.ObjectId(updatedBy);

      await company.save();

      // Create audit log
      await AuditLog.create({
        action: AuditAction.COMPANY_SETTINGS_CHANGED,
        resourceType: 'Company',
        resourceId: company._id,
        companyId: company._id,
        performedBy: updatedBy,
        changes: {
          old: oldSettings,
          new: company.settings,
        },
        correlationId,
      });

      logger.info({
        action: 'company.update.settings.success',
        context: { companyId: company._id.toString() },
        correlationId,
      });

      return company;
    } catch (error) {
      if (error instanceof AppError) throw error;

      logger.error({
        action: 'company.update.settings.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { companyId },
        correlationId,
      });

      throw new AppError('DATABASE_ERROR', 'Failed to update company settings', 500);
    }
  }

  /**
   * Regenerate company API key
   */
  static async regenerateApiKey(
    companyId: string,
    updatedBy: string,
    correlationId: string
  ): Promise<{ apiKey: string }> {
    try {
      logger.info({
        action: 'company.regenerate.apikey.start',
        context: { companyId },
        correlationId,
      });

      const company = await Company.findById(companyId).select('+apiKey');

      if (!company) {
        throw new AppError('COMPANY_NOT_FOUND', 'Company not found', 404);
      }

      // Regenerate API key
      const newApiKey = company.regenerateApiKey();
      company.updatedBy = new mongoose.Types.ObjectId(updatedBy);

      await company.save();

      // Create audit log
      await AuditLog.create({
        action: AuditAction.COMPANY_API_KEY_REGENERATED,
        resourceType: 'Company',
        resourceId: company._id,
        companyId: company._id,
        performedBy: updatedBy,
        changes: {
          field: 'apiKey',
          action: 'regenerated',
        },
        correlationId,
      });

      logger.info({
        action: 'company.regenerate.apikey.success',
        context: { companyId: company._id.toString() },
        correlationId,
      });

      return { apiKey: newApiKey };
    } catch (error) {
      if (error instanceof AppError) throw error;

      logger.error({
        action: 'company.regenerate.apikey.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { companyId },
        correlationId,
      });

      throw new AppError('DATABASE_ERROR', 'Failed to regenerate API key', 500);
    }
  }

  /**
   * Update company status (super_admin only)
   */
  static async updateCompanyStatus(
    companyId: string,
    status: CompanyStatus,
    updatedBy: string,
    correlationId: string
  ): Promise<ICompany> {
    try {
      logger.info({
        action: 'company.update.status.start',
        context: { companyId, status },
        correlationId,
      });

      const company = await Company.findById(companyId);

      if (!company) {
        throw new AppError('COMPANY_NOT_FOUND', 'Company not found', 404);
      }

      const oldStatus = company.status;
      company.status = status;
      company.updatedBy = new mongoose.Types.ObjectId(updatedBy);

      await company.save();

      // Create audit log
      await AuditLog.create({
        action: AuditAction.COMPANY_UPDATED,
        resourceType: 'Company',
        resourceId: company._id,
        companyId: company._id,
        performedBy: updatedBy,
        changes: {
          field: 'status',
          old: oldStatus,
          new: status,
        },
        correlationId,
      });

      logger.info({
        action: 'company.update.status.success',
        context: { companyId: company._id.toString(), status },
        correlationId,
      });

      return company;
    } catch (error) {
      if (error instanceof AppError) throw error;

      logger.error({
        action: 'company.update.status.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        context: { companyId, status },
        correlationId,
      });

      throw new AppError('DATABASE_ERROR', 'Failed to update company status', 500);
    }
  }

  /**
   * Validate company API key
   */
  static async validateCompanyApiKey(apiKey: string): Promise<ICompany> {
    try {
      const company = await Company.findOne({ apiKey }).select('+apiKey').exec();

      if (!company) {
        throw new AppError('INVALID_API_KEY', 'Invalid company API key', 401);
      }

      if (company.status !== CompanyStatus.ACTIVE) {
        throw new AppError('COMPANY_INACTIVE', 'Company account is not active', 403);
      }

      return company;
    } catch (error) {
      if (error instanceof AppError) throw error;

      logger.error({
        action: 'company.validate.apikey.failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new AppError('DATABASE_ERROR', 'Failed to validate API key', 500);
    }
  }
}
