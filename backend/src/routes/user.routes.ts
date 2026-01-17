import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services';
import {
  authenticate,
  requireRole,
  validateRoleAssignment,
  enforceTenantIsolation,
} from '../middleware';
import { UserRole } from '../models';
import { successResponse, calculatePagination } from '../utils/response';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: User ID
 *         email:
 *           type: string
 *           format: email
 *           description: User email
 *         firstName:
 *           type: string
 *           description: First name
 *         lastName:
 *           type: string
 *           description: Last name
 *         role:
 *           type: string
 *           enum: [citizen, first_responder, operator, admin, company_admin, super_admin]
 *           description: User role
 *         companyId:
 *           type: string
 *           description: Company ID
 *         isActive:
 *           type: boolean
 *           description: Whether user account is active
 *         isEmailVerified:
 *           type: boolean
 *           description: Whether email is verified
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       required:
 *         - email
 *         - firstName
 *         - lastName
 *         - role
 *         - companyId
 */

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     description: Create a new user within the company (admin or higher). Cannot create users with higher or equal role.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [citizen, first_responder, operator, admin]
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Invalid input or user already exists
 *       403:
 *         description: Insufficient permissions or role hierarchy violation
 */
router.post(
  '/',
  authenticate,
  requireRole(UserRole.ADMIN),
  validateRoleAssignment,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, firstName, lastName, role } = req.body;

      const user = await UserService.createUser({
        email,
        password,
        firstName,
        lastName,
        role,
        companyId: req.user!.companyId,
        createdBy: req.user!.id,
        createdByRole: req.user!.role as UserRole,
        correlationId: req.correlationId!,
      });

      res.status(201).json(successResponse(user, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get users (company-scoped)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     description: Get list of users in the company. Results are automatically filtered by company.
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
 *         name: role
 *         schema:
 *           type: string
 *           enum: [citizen, first_responder, operator, admin, company_admin, super_admin]
 *         description: Filter by role
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email, first name, or last name
 *     responses:
 *       200:
 *         description: List of users
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
 *                     $ref: '#/components/schemas/User'
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
 *         description: Insufficient permissions
 */
router.get(
  '/',
  authenticate,
  requireRole(UserRole.OPERATOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const role = req.query.role as UserRole | undefined;
      const isActive = req.query.isActive !== undefined
        ? req.query.isActive === 'true'
        : undefined;
      const search = req.query.search as string | undefined;

      // super_admin can optionally filter by companyId via query param
      // other roles are restricted to their own company
      const companyId = req.user!.role === UserRole.SUPER_ADMIN && req.query.companyId
        ? req.query.companyId as string
        : req.user!.companyId;

      const result = await UserService.getUsers({
        companyId,
        requestingUserRole: req.user!.role as UserRole,
        page,
        pageSize,
        role,
        isActive,
        search,
      });

      res.json(
        successResponse(
          result.users,
          req.correlationId!,
          calculatePagination(result.page, result.pageSize, result.total)
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     description: Get user details. Users can only access users from their own company unless they are super_admin.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *                 correlationId:
 *                   type: string
 *       403:
 *         description: Cannot access user from another company
 *       404:
 *         description: User not found
 */
router.get(
  '/:id',
  authenticate,
  requireRole(UserRole.OPERATOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await UserService.getUserById(
        req.params.id,
        req.user!.companyId,
        req.user!.role as UserRole
      );

      res.json(successResponse(user, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Update user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     description: Update user details (admin or higher). Cannot update users from other companies or assign higher roles.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [citizen, first_responder, operator, admin]
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *                 correlationId:
 *                   type: string
 *       403:
 *         description: Insufficient permissions, tenant mismatch, or role hierarchy violation
 *       404:
 *         description: User not found
 */
router.patch(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN),
  validateRoleAssignment,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { firstName, lastName, role, isActive } = req.body;

      const user = await UserService.updateUser({
        userId: req.params.id,
        updates: {
          firstName,
          lastName,
          role,
          isActive,
        },
        updatedBy: req.user!.id,
        updatedByRole: req.user!.role as UserRole,
        requestingUserCompanyId: req.user!.companyId,
        correlationId: req.correlationId!,
      });

      res.json(successResponse(user, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete user (soft delete)
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     description: Soft delete user by setting isActive to false (admin or higher). Cannot delete users from other companies or yourself.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
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
 *                     message:
 *                       type: string
 *                       example: User deleted successfully
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Cannot delete your own account
 *       403:
 *         description: Insufficient permissions or tenant mismatch
 *       404:
 *         description: User not found
 */
router.delete(
  '/:id',
  authenticate,
  requireRole(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await UserService.deleteUser({
        userId: req.params.id,
        deletedBy: req.user!.id,
        deletedByRole: req.user!.role as UserRole,
        requestingUserCompanyId: req.user!.companyId,
        correlationId: req.correlationId!,
      });

      res.json(
        successResponse(
          { message: 'User deleted successfully' },
          req.correlationId!
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

export default router;
