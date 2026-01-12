import { Router, Request, Response, NextFunction } from 'express';
import { CompanyService } from '../services';
import { authenticate, requireRole, enforceTenantIsolation } from '../middleware';
import { UserRole, CompanyStatus, ICompanySettings } from '../models';
import { successResponse, calculatePagination } from '../utils/response';
import { AppError } from '../utils/errors';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Company:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Company ID
 *         name:
 *           type: string
 *           description: Company name
 *         type:
 *           type: string
 *           enum: [standard, mobile_partner, enterprise]
 *           description: Company type
 *         status:
 *           type: string
 *           enum: [active, suspended, inactive]
 *           description: Company status
 *         settings:
 *           type: object
 *           properties:
 *             allowCitizenReports:
 *               type: boolean
 *             autoLinkReportsToEvents:
 *               type: boolean
 *             maxUsers:
 *               type: number
 *             features:
 *               type: array
 *               items:
 *                 type: string
 *         contactEmail:
 *           type: string
 *           format: email
 *         contactPhone:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - name
 */

/**
 * @swagger
 * /companies:
 *   post:
 *     summary: Create a new company
 *     tags: [Companies]
 *     security:
 *       - BearerAuth: []
 *     description: Create a new company (super_admin only)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Company name
 *               type:
 *                 type: string
 *                 enum: [standard, mobile_partner, enterprise]
 *                 default: standard
 *               contactEmail:
 *                 type: string
 *                 format: email
 *               contactPhone:
 *                 type: string
 *               settings:
 *                 type: object
 *     responses:
 *       201:
 *         description: Company created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Company'
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Invalid input or company already exists
 *       403:
 *         description: Insufficient permissions (not super_admin)
 */
router.post(
  '/',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, type, contactEmail, contactPhone, settings } = req.body;

      const company = await CompanyService.createCompany({
        name,
        type,
        contactEmail,
        contactPhone,
        settings,
        createdBy: req.user!.id,
        correlationId: req.correlationId!,
      });

      res.status(201).json(successResponse(company, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /companies/{id}:
 *   get:
 *     summary: Get company by ID
 *     tags: [Companies]
 *     security:
 *       - BearerAuth: []
 *     description: Get company details. Users can only access their own company unless they are super_admin.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     responses:
 *       200:
 *         description: Company details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Company'
 *                 correlationId:
 *                   type: string
 *       403:
 *         description: Cannot access another company's data
 *       404:
 *         description: Company not found
 */
router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const company = await CompanyService.getCompanyById(req.params.id);

      // Tenant isolation: users can only access their own company (except super_admin)
      if (req.user!.role !== UserRole.SUPER_ADMIN && company._id.toString() !== req.user!.companyId) {
        throw new AppError('TENANT_MISMATCH', 'Cannot access another company', 403);
      }

      res.json(successResponse(company, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /companies/{id}/settings:
 *   patch:
 *     summary: Update company settings
 *     tags: [Companies]
 *     security:
 *       - BearerAuth: []
 *     description: Update company settings (admin or higher)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               allowCitizenReports:
 *                 type: boolean
 *               autoLinkReportsToEvents:
 *                 type: boolean
 *               maxUsers:
 *                 type: number
 *               features:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Company'
 *                 correlationId:
 *                   type: string
 *       403:
 *         description: Insufficient permissions or tenant mismatch
 *       404:
 *         description: Company not found
 */
router.patch(
  '/:id/settings',
  authenticate,
  requireRole(UserRole.ADMIN),
  enforceTenantIsolation('params'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const settings: Partial<ICompanySettings> = req.body;

      const company = await CompanyService.updateCompanySettings(
        req.params.id,
        settings,
        req.user!.id,
        req.correlationId!
      );

      res.json(successResponse(company, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /companies/{id}/regenerate-api-key:
 *   post:
 *     summary: Regenerate company API key
 *     tags: [Companies]
 *     security:
 *       - BearerAuth: []
 *     description: Generate a new API key for the company (admin or higher). Previous API key will be invalidated.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Company ID
 *     responses:
 *       200:
 *         description: API key regenerated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     apiKey:
 *                       type: string
 *                       description: New API key (store securely - won't be shown again)
 *                 correlationId:
 *                   type: string
 *       403:
 *         description: Insufficient permissions or tenant mismatch
 *       404:
 *         description: Company not found
 */
router.post(
  '/:id/regenerate-api-key',
  authenticate,
  requireRole(UserRole.ADMIN),
  enforceTenantIsolation('params'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await CompanyService.regenerateApiKey(
        req.params.id,
        req.user!.id,
        req.correlationId!
      );

      res.json(successResponse(result, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /companies:
 *   get:
 *     summary: Get all companies
 *     tags: [Companies]
 *     security:
 *       - BearerAuth: []
 *     description: Get list of all companies (super_admin only)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, suspended, inactive]
 *         description: Filter by company status
 *     responses:
 *       200:
 *         description: List of companies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Company'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                 correlationId:
 *                   type: string
 *       403:
 *         description: Insufficient permissions (not super_admin)
 */
router.get(
  '/',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const status = req.query.status as CompanyStatus | undefined;

      const result = await CompanyService.getAllCompanies({
        page,
        pageSize,
        status,
      });

      res.json(
        successResponse(
          result.companies,
          req.correlationId!,
          calculatePagination(result.page, result.pageSize, result.total)
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

export default router;
