/**
 * VMS Routes
 * 
 * API endpoints for VMS (Video Management System) server management.
 * All routes require authentication and filter by user's companyId.
 * 
 * Base path: /api/vms
 */

import { Router, Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { vmsService, CreateVmsServerInput, UpdateVmsServerInput } from '../services/vms.service';
import { VmsProvider } from '../models';
import { successResponse, errorResponse, calculatePagination } from '../utils/response';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { UserRole } from '../models';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * /vms:
 *   get:
 *     summary: List all VMS servers for the company
 *     tags: [VMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [shinobi, zoneminder, agentdvr, other]
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of VMS servers
 */
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const { page, limit, provider, isActive, search, sortBy, sortOrder } = req.query;

      const result = await vmsService.findAll(
        companyId,
        {
          provider: provider as VmsProvider | undefined,
          isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
          search: search as string | undefined,
        },
        {
          page: page ? parseInt(page as string, 10) : 1,
          limit: limit ? parseInt(limit as string, 10) : 20,
          sortBy: sortBy as string | undefined,
          sortOrder: (sortOrder as 'asc' | 'desc') || 'asc',
        }
      );

      const pagination = calculatePagination(result.page, result.limit, result.total);

      res.json(
        successResponse(result.servers, req.correlationId, pagination)
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /vms/{id}:
 *   get:
 *     summary: Get a VMS server by ID
 *     tags: [VMS]
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
 *         description: VMS server details
 *       404:
 *         description: VMS server not found
 */
router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const serverId = new mongoose.Types.ObjectId(req.params.id);

      const server = await vmsService.findById(companyId, serverId);

      if (!server) {
        return res.status(404).json(
          errorResponse('NOT_FOUND', 'VMS server not found', req.correlationId)
        );
      }

      res.json(successResponse(server, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /vms:
 *   post:
 *     summary: Create a new VMS server
 *     tags: [VMS]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - provider
 *               - baseUrl
 *             properties:
 *               name:
 *                 type: string
 *               provider:
 *                 type: string
 *                 enum: [shinobi, zoneminder, agentdvr, other]
 *               baseUrl:
 *                 type: string
 *               auth:
 *                 type: object
 *                 properties:
 *                   apiKey:
 *                     type: string
 *                   groupKey:
 *                     type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: VMS server created
 */
router.post(
  '/',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const userId = new mongoose.Types.ObjectId(req.user!.id);

      const { name, provider, baseUrl, auth, isActive } = req.body;

      // Validate required fields
      if (!name || !provider || !baseUrl) {
        throw new ValidationError('name, provider, and baseUrl are required');
      }

      const data: CreateVmsServerInput = {
        name,
        provider,
        baseUrl,
        auth,
        isActive,
      };

      const server = await vmsService.create(companyId, data, userId);

      logger.info('VMS server created via API', { 
        serverId: server._id, 
        correlationId: req.correlationId 
      });

      res.status(201).json(successResponse(server, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /vms/{id}:
 *   put:
 *     summary: Update a VMS server
 *     tags: [VMS]
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
 *         description: VMS server updated
 */
router.put(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const serverId = new mongoose.Types.ObjectId(req.params.id);

      const { name, baseUrl, auth, isActive } = req.body;

      const data: UpdateVmsServerInput = {};
      if (name !== undefined) data.name = name;
      if (baseUrl !== undefined) data.baseUrl = baseUrl;
      if (auth !== undefined) data.auth = auth;
      if (isActive !== undefined) data.isActive = isActive;

      const server = await vmsService.update(companyId, serverId, data, userId);

      res.json(successResponse(server, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /vms/{id}:
 *   delete:
 *     summary: Delete a VMS server
 *     tags: [VMS]
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
 *         description: VMS server deleted
 */
router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const serverId = new mongoose.Types.ObjectId(req.params.id);

      await vmsService.delete(companyId, serverId);

      res.json(
        successResponse({ message: 'VMS server deleted successfully' }, req.correlationId)
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /vms/{id}/test:
 *   post:
 *     summary: Test connection to a VMS server
 *     tags: [VMS]
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
 *         description: Connection test result
 */
router.post(
  '/:id/test',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const serverId = new mongoose.Types.ObjectId(req.params.id);

      const result = await vmsService.testConnection(companyId, serverId);

      res.json(successResponse(result, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /vms/{id}/monitors:
 *   get:
 *     summary: Discover monitors (cameras) from a VMS server
 *     tags: [VMS]
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
 *         description: List of monitors from VMS
 */
router.get(
  '/:id/monitors',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const serverId = new mongoose.Types.ObjectId(req.params.id);

      const monitors = await vmsService.discoverMonitors(companyId, serverId);

      res.json(successResponse(monitors, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /vms/{id}/monitors/import:
 *   post:
 *     summary: Batch import monitors from VMS as cameras
 *     tags: [VMS]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               monitorIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional array of monitor IDs to import (imports all if empty)
 *               defaultLocation:
 *                 type: object
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                     minItems: 2
 *                     maxItems: 2
 *                   address:
 *                     type: string
 *               source:
 *                 type: string
 *                 description: Metadata source tag for bulk cleanup (e.g., 'vms-import', 'shinobi-demo')
 *     responses:
 *       201:
 *         description: Monitors imported successfully
 *       400:
 *         description: Invalid request or unsupported provider
 */
router.post(
  '/:id/monitors/import',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const serverId = new mongoose.Types.ObjectId(req.params.id);
      const { monitorIds, defaultLocation, source } = req.body;

      const cameras = await vmsService.importMonitors(
        serverId,
        monitorIds,
        defaultLocation,
        source,
        companyId,
        userId
      );

      res.status(201).json(
        successResponse(
          cameras,
          req.correlationId
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

export default router;
