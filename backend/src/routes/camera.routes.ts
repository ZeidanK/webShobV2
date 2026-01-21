/**
 * Camera Routes
 * 
 * API endpoints for camera management including VMS integration.
 * All routes require authentication and filter by user's companyId.
 * 
 * Base path: /api/cameras
 */

import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { cameraService, CreateCameraInput, UpdateCameraInput } from '../services/camera.service';
import { vmsService } from '../services/vms.service';
import { rtspStreamService } from '../services/rtsp-stream.service';
import { cameraStatusMonitorService } from '../services/camera-status.service';
import { AuditLog, CameraStatus } from '../models';
import { config } from '../config';
import { successResponse, errorResponse, calculatePagination } from '../utils/response';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { AppError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { UserRole } from '../models';

const router = Router();

// TEST-ONLY: Parse cookie header for stream token fallback.
const parseCookieHeader = (header?: string): Record<string, string> => {
  if (!header) {
    return {};
  }
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split('=');
    if (!key) {
      return acc;
    }
    acc[key] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
};

// TEST-ONLY: Validate and map string IDs to ObjectId instances.
const parseObjectIdList = (values: string[]): mongoose.Types.ObjectId[] => {
  return values.map((value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new ValidationError(`Invalid ObjectId: ${value}`);
    }
    return new mongoose.Types.ObjectId(value);
  });
};

// TEST-ONLY: Extract stream token from HLS URL for cookie fallback.
const extractStreamToken = (hlsUrl: string): string | null => {
  try {
    const parsed = new URL(hlsUrl, 'http://localhost');
    return parsed.searchParams.get('token');
  } catch {
    return null;
  }
};

/**
 * @swagger
 * /cameras:
 *   get:
 *     summary: List all cameras for the company
 *     tags: [Cameras]
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
 *           default: 50
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [online, offline, error, maintenance]
 *       - in: query
 *         name: vmsServerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: hasVms
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of cameras
 */
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Super admins can see all cameras, others see only their company's cameras
      const companyId = req.user!.role === UserRole.SUPER_ADMIN 
        ? null 
        : new mongoose.Types.ObjectId(req.user!.companyId);
      
      logger.info('GET /cameras request', {
        userId: req.user!.id,
        userRole: req.user!.role,
        companyId: companyId?.toString() || 'null (super_admin)',
        correlationId: req.correlationId,
      });
      
      const { page, limit, status, vmsServerId, hasVms, search, sortBy, sortOrder, tags } = req.query;
      // TEST-ONLY: Normalize tag filters from string or query array values.
      const tagList = Array.isArray(tags)
        ? tags
            .filter((tag): tag is string => typeof tag === 'string')
            .map((tag) => tag.trim())
            .filter(Boolean)
        : typeof tags === 'string'
          ? tags.split(',').map((tag) => tag.trim()).filter(Boolean)
          : undefined;

      const result = await cameraService.findAll(
        companyId,
        {
          status: (status && status !== 'undefined') ? status as CameraStatus : undefined,
          vmsServerId: vmsServerId ? new mongoose.Types.ObjectId(vmsServerId as string) : undefined,
          hasVms: hasVms === 'true' ? true : hasVms === 'false' ? false : undefined,
          search: (search && search !== '') ? search as string : undefined,
          tags: tagList,
        },
        {
          page: page ? parseInt(page as string, 10) : 1,
          limit: limit ? parseInt(limit as string, 10) : 50,
          sortBy: sortBy as string | undefined,
          sortOrder: (sortOrder as 'asc' | 'desc') || 'asc',
        }
      );

      const pagination = calculatePagination(result.page, result.limit, result.total);

      logger.info('GET /cameras result', {
        totalCameras: result.total,
        returnedCameras: result.cameras.length,
        page: result.page,
        correlationId: req.correlationId,
      });

      res.json(successResponse(result.cameras, req.correlationId, pagination));
    } catch (error) {
      next(error);
    }
  }
);

// TEST-ONLY: Keep specialized collection routes ahead of /:id to avoid path conflicts.

// TEST-ONLY: Manual status refresh trigger.
router.post(
  '/status/refresh',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetCompanyId = req.user!.role === UserRole.SUPER_ADMIN && req.body.companyId
        ? req.body.companyId
        : req.user!.companyId;

      // TEST-ONLY: Validate companyId override for super admins.
      if (targetCompanyId && !mongoose.Types.ObjectId.isValid(targetCompanyId)) {
        throw new ValidationError('companyId must be a valid ObjectId');
      }

      await cameraStatusMonitorService.runOnce({
        companyId: targetCompanyId,
        reason: 'manual',
        requestedBy: req.user!.id,
        correlationId: req.correlationId,
      });

      res.json(successResponse({ message: 'Status refresh triggered' }, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/status/{status}:
 *   get:
 *     summary: List cameras by status
 *     tags: [Cameras]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [online, offline, error, maintenance]
 *     responses:
 *       200:
 *         description: List of cameras with the requested status
 */
router.get(
  '/status/:status',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.user!.role === UserRole.SUPER_ADMIN
        ? null
        : new mongoose.Types.ObjectId(req.user!.companyId);
      const status = req.params.status as CameraStatus;

      // Validate status values before hitting the database.
      if (!['online', 'offline', 'error', 'maintenance'].includes(status)) {
        throw new ValidationError('status must be one of: online, offline, error, maintenance');
      }

      const cameras = await cameraService.findByStatus(companyId, status);
      res.json(successResponse(cameras, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/tags/{tag}:
 *   get:
 *     summary: List cameras by tag
 *     tags: [Cameras]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tag
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of cameras with the requested tag
 */
router.get(
  '/tags/:tag',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.user!.role === UserRole.SUPER_ADMIN
        ? null
        : new mongoose.Types.ObjectId(req.user!.companyId);
      const tag = req.params.tag;

      if (!tag || tag.trim().length === 0) {
        throw new ValidationError('tag is required');
      }

      const cameras = await cameraService.findByTag(companyId, tag);
      res.json(successResponse(cameras, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/near:
 *   get:
 *     summary: Find cameras near a location (alias for /nearby)
 *     tags: [Cameras]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: lng
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: lat
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: maxDistance
 *         schema:
 *           type: number
 *           default: 5000
 *     responses:
 *       200:
 *         description: List of nearby cameras
 */
router.get(
  '/near',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.user!.role === UserRole.SUPER_ADMIN
        ? null
        : new mongoose.Types.ObjectId(req.user!.companyId);
      const { lng, lat, maxDistance, limit } = req.query;

      if (!lng || !lat) {
        throw new ValidationError('lng and lat query parameters are required');
      }

      const cameras = await cameraService.findNearby(
        companyId,
        [parseFloat(lng as string), parseFloat(lat as string)],
        maxDistance ? parseInt(maxDistance as string, 10) : 5000,
        limit ? parseInt(limit as string, 10) : 10
      );

      res.json(successResponse(cameras, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

// TEST-ONLY: Legacy alias for /near to preserve existing clients.
router.get(
  '/nearby',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.user!.role === UserRole.SUPER_ADMIN
        ? null
        : new mongoose.Types.ObjectId(req.user!.companyId);
      const { lng, lat, maxDistance, limit } = req.query;

      if (!lng || !lat) {
        throw new ValidationError('lng and lat query parameters are required');
      }

      const cameras = await cameraService.findNearby(
        companyId,
        [parseFloat(lng as string), parseFloat(lat as string)],
        maxDistance ? parseInt(maxDistance as string, 10) : 5000,
        limit ? parseInt(limit as string, 10) : 10
      );

      res.json(successResponse(cameras, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/{id}:
 *   get:
 *     summary: Get a camera by ID
 *     tags: [Cameras]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: includeStreams
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Camera details
 *       404:
 *         description: Camera not found
 */
router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const cameraId = new mongoose.Types.ObjectId(req.params.id);
      const includeStreams = req.query.includeStreams === 'true';

      const camera = includeStreams
        ? await cameraService.findByIdWithStreams(companyId, cameraId)
        : await cameraService.findById(companyId, cameraId);

      if (!camera) {
        return res.status(404).json(
          errorResponse('NOT_FOUND', 'Camera not found', req.correlationId)
        );
      }

      res.json(successResponse(camera, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras:
 *   post:
 *     summary: Create a new camera
 *     tags: [Cameras]
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
 *               - location
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               streamUrl:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [ip, analog, usb]
 *               location:
 *                 type: object
 *                 properties:
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                   address:
 *                     type: string
 *     responses:
 *       201:
 *         description: Camera created
 */
router.post(
  '/',
  authenticate,
  authorize(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Super admins can specify companyId, operators and admins use their own
      const targetCompanyId = req.user!.role === UserRole.SUPER_ADMIN && req.body.companyId 
        ? req.body.companyId 
        : req.user!.companyId;
      const companyId = new mongoose.Types.ObjectId(targetCompanyId);
      const userId = new mongoose.Types.ObjectId(req.user!.id);

      const {
        name,
        description,
        streamUrl,
        streamConfig,
        type,
        status,
        capabilities,
        maintenanceSchedule,
        tags,
        location,
        settings,
        vms,
        metadata,
      } = req.body;

      // Validate required fields
      if (!name) {
        throw new ValidationError('name is required');
      }
      if (!location?.coordinates || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
        throw new ValidationError('location.coordinates must be [longitude, latitude]');
      }
      // Validate optional tag inputs.
      if (tags !== undefined && !Array.isArray(tags)) {
        throw new ValidationError('tags must be an array of strings');
      }

      const data: CreateCameraInput = {
        name,
        description,
        streamUrl,
        capabilities,
        maintenanceSchedule,
        tags,
        // TEST-ONLY: Stream config scaffolding for Direct RTSP.
        streamConfig,
        type,
        status,
        location: {
          coordinates: location.coordinates,
          address: location.address,
        },
        settings,
        vms: vms ? {
          ...vms,
          serverId: vms.serverId ? new mongoose.Types.ObjectId(vms.serverId) : undefined,
        } : undefined,
        metadata,
      };

      const camera = await cameraService.create(companyId, data, userId);

      logger.info('Camera created via API', { 
        cameraId: camera._id, 
        correlationId: req.correlationId 
      });

      res.status(201).json(successResponse(camera, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/{id}:
 *   put:
 *     summary: Update a camera
 *     tags: [Cameras]
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
 *         description: Camera updated
 */
router.put(
  '/:id',
  authenticate,
  authorize(UserRole.OPERATOR, UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const cameraId = new mongoose.Types.ObjectId(req.params.id);

      const {
        name,
        description,
        streamUrl,
        streamConfig,
        type,
        status,
        capabilities,
        maintenanceSchedule,
        tags,
        location,
        settings,
        metadata,
      } = req.body;

      const data: UpdateCameraInput = {};
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      if (streamUrl !== undefined) data.streamUrl = streamUrl;
      // TEST-ONLY: Stream config scaffolding for Direct RTSP.
      if (streamConfig !== undefined) data.streamConfig = streamConfig;
      if (type !== undefined) data.type = type;
      if (status !== undefined) data.status = status;
      if (capabilities !== undefined) data.capabilities = capabilities;
      if (maintenanceSchedule !== undefined) data.maintenanceSchedule = maintenanceSchedule;
      if (tags !== undefined) data.tags = tags;
      if (location !== undefined) data.location = location;
      if (settings !== undefined) data.settings = settings;
      if (metadata !== undefined) data.metadata = metadata;

      const camera = await cameraService.update(companyId, cameraId, data, userId);

      res.json(successResponse(camera, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/{id}:
 *   delete:
 *     summary: Delete a camera (soft delete)
 *     tags: [Cameras]
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
 *         description: Camera deleted
 */
router.delete(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const cameraId = new mongoose.Types.ObjectId(req.params.id);

      await cameraService.delete(companyId, cameraId, userId);

      res.json(
        successResponse({ message: 'Camera deleted successfully' }, req.correlationId)
      );
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/{id}/logs:
 *   get:
 *     summary: Get audit logs for a camera
 *     tags: [Cameras]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 25
 *     responses:
 *       200:
 *         description: Camera audit logs
 */
router.get(
  '/:id/logs',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const cameraId = new mongoose.Types.ObjectId(req.params.id);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;

      // TEST-ONLY: Query audit logs for this camera by company scope.
      const logs = await AuditLog.find({
        companyId,
        resourceType: 'Camera',
        resourceId: cameraId,
      })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();

      res.json(successResponse(logs, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/bulk/update:
 *   post:
 *     summary: Bulk update camera status
 *     tags: [Cameras]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cameraIds
 *               - status
 *             properties:
 *               cameraIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               status:
 *                 type: string
 *                 enum: [online, offline, error, maintenance]
 *     responses:
 *       200:
 *         description: Bulk update result
 */
router.post(
  '/bulk/update',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetCompanyId = req.user!.role === UserRole.SUPER_ADMIN && req.body.companyId
        ? req.body.companyId
        : req.user!.companyId;
      const companyId = new mongoose.Types.ObjectId(targetCompanyId);
      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const { cameraIds, status } = req.body;

      if (!Array.isArray(cameraIds) || cameraIds.length === 0) {
        throw new ValidationError('cameraIds must be a non-empty array');
      }
      if (!status) {
        throw new ValidationError('status is required');
      }

      const ids = parseObjectIdList(cameraIds);
      const updated = await cameraService.bulkUpdateStatus(companyId, ids, status, userId);
      res.json(successResponse({ updated }, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/bulk/delete:
 *   post:
 *     summary: Bulk delete cameras by ID
 *     tags: [Cameras]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cameraIds
 *             properties:
 *               cameraIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Bulk delete result
 */
router.post(
  '/bulk/delete',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetCompanyId = req.user!.role === UserRole.SUPER_ADMIN && req.body.companyId
        ? req.body.companyId
        : req.user!.companyId;
      const companyId = new mongoose.Types.ObjectId(targetCompanyId);
      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const { cameraIds } = req.body;

      if (!Array.isArray(cameraIds) || cameraIds.length === 0) {
        throw new ValidationError('cameraIds must be a non-empty array');
      }

      const ids = parseObjectIdList(cameraIds);
      const deleted = await cameraService.bulkDelete(companyId, ids, userId);
      res.json(successResponse({ deleted }, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/bulk/tag:
 *   post:
 *     summary: Bulk tag cameras
 *     tags: [Cameras]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cameraIds
 *               - tags
 *               - mode
 *             properties:
 *               cameraIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               mode:
 *                 type: string
 *                 enum: [add, remove, set]
 *     responses:
 *       200:
 *         description: Bulk tag result
 */
router.post(
  '/bulk/tag',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const targetCompanyId = req.user!.role === UserRole.SUPER_ADMIN && req.body.companyId
        ? req.body.companyId
        : req.user!.companyId;
      const companyId = new mongoose.Types.ObjectId(targetCompanyId);
      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const { cameraIds, tags, mode } = req.body;

      if (!Array.isArray(cameraIds) || cameraIds.length === 0) {
        throw new ValidationError('cameraIds must be a non-empty array');
      }
      if (!Array.isArray(tags) || tags.length === 0) {
        throw new ValidationError('tags must be a non-empty array');
      }
      if (!mode || !['add', 'remove', 'set'].includes(mode)) {
        throw new ValidationError('mode must be one of: add, remove, set');
      }

      const ids = parseObjectIdList(cameraIds);
      const updated = await cameraService.bulkTag(companyId, ids, tags, mode, userId);
      res.json(successResponse({ updated }, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/test-connection:
 *   post:
 *     summary: Test RTSP or VMS connectivity
 *     tags: [Cameras]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mode:
 *                 type: string
 *                 enum: [rtsp, vms]
 *               rtspUrl:
 *                 type: string
 *               transport:
 *                 type: string
 *                 enum: [tcp, udp]
 *               serverId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connection test result
 */
router.post(
  '/test-connection',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const { mode, serverId, rtspUrl, transport } = req.body || {};

      const resolvedMode = mode || (serverId ? 'vms' : 'rtsp');

      if (resolvedMode === 'vms') {
        if (!serverId) {
          throw new ValidationError('serverId is required for VMS tests');
        }
        // TEST-ONLY: Track VMS connection tests with audit metadata.
        const result = await vmsService.testConnection(
          companyId,
          new mongoose.Types.ObjectId(serverId),
          {
            userId,
            correlationId: req.correlationId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          }
        );
        res.json(successResponse(result, req.correlationId));
        return;
      }

      if (!rtspUrl) {
        throw new ValidationError('rtspUrl is required for RTSP tests');
      }

      // TEST-ONLY: Run a short RTSP probe to validate connectivity.
      const result = await rtspStreamService.testRtspConnection(rtspUrl, transport);
      res.json(successResponse(result, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/{id}/streams:
 *   get:
 *     summary: Get stream URLs for a camera
 *     tags: [Cameras]
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
 *         description: Stream URLs (HLS, embed, snapshot)
 */
router.get(
  '/:id/streams',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const cameraId = new mongoose.Types.ObjectId(req.params.id);

      // TEST-ONLY: Build a public-facing base URL for direct-rtsp streams.
      const streamBaseUrl =
        config.streaming.publicBaseUrl || `${req.protocol}://${req.get('host')}`;
      const streams = await cameraService.getStreamUrls(companyId, cameraId, streamBaseUrl);

      // TEST-ONLY: Set stream token cookie for native HLS players that drop query params.
      if (streams.hls && streams.hls.includes('/streams/hls/')) {
        const token = extractStreamToken(streams.hls);
        if (token) {
          const forwardedProto = req.headers['x-forwarded-proto'];
          const isSecure = req.secure || forwardedProto === 'https';
          res.cookie('stream_token', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: isSecure,
            path: `/api/cameras/${cameraId.toString()}/streams/hls`,
            maxAge: config.streaming.tokenTtlSeconds * 1000,
          });
        }
      }

      res.json(successResponse(streams, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

// TEST-ONLY: Issue stream tokens for direct-rtsp cameras.
router.post(
  '/:id/stream/token',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const cameraId = new mongoose.Types.ObjectId(req.params.id);
      const camera = await cameraService.findById(companyId, cameraId);
      if (!camera) {
        return res.status(404).json(
          errorResponse('RESOURCE_NOT_FOUND', 'Camera not found', req.correlationId)
        );
      }
      if (camera.streamConfig?.type !== 'direct-rtsp') {
        throw new ValidationError('streamConfig.type must be direct-rtsp for stream tokens');
      }

      const token = rtspStreamService.createStreamToken(cameraId.toString(), companyId.toString());
      res.json(
        successResponse(
          { token, expiresIn: config.streaming.tokenTtlSeconds },
          req.correlationId
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

// TEST-ONLY: Keep direct-rtsp streams alive while viewing.
router.post(
  '/:id/stream/heartbeat',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const cameraId = new mongoose.Types.ObjectId(req.params.id);
      const camera = await cameraService.findById(companyId, cameraId);
      if (!camera) {
        return res.status(404).json(
          errorResponse('RESOURCE_NOT_FOUND', 'Camera not found', req.correlationId)
        );
      }
      if (camera.streamConfig?.type !== 'direct-rtsp') {
        throw new ValidationError('streamConfig.type must be direct-rtsp for stream heartbeat');
      }

      const result = await rtspStreamService.keepAlive(camera);
      res.json(successResponse(result, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/{id}/streams/hls/{file}:
 *   get:
 *     summary: Get HLS playlist/segments for direct-rtsp cameras
 *     tags: [Cameras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: file
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: HLS asset
 */
router.get(
  '/:id/streams/hls/:file',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
      const cookies = parseCookieHeader(req.headers.cookie);
      // TEST-ONLY: Prefer query token but allow cookie fallback for native players.
      const token = queryToken || cookies.stream_token || '';
      if (!token) {
        throw new AppError('MISSING_AUTH_TOKEN', 'Stream token is required', 401);
      }

      // TEST-ONLY: Validate stream token and enforce camera/company match.
      const payload = rtspStreamService.verifyStreamToken(token);
      if (payload.cameraId !== req.params.id) {
        throw new AppError('FORBIDDEN', 'Stream token does not match camera', 403);
      }

      const companyId = new mongoose.Types.ObjectId(payload.companyId);
      const cameraId = new mongoose.Types.ObjectId(payload.cameraId);
      const camera = await cameraService.findById(companyId, cameraId);
      if (!camera) {
        throw new AppError('RESOURCE_NOT_FOUND', 'Camera not found', 404);
      }

      // TEST-ONLY: Ensure the RTSP pipeline is active for this camera.
      await rtspStreamService.ensureStream(camera);
      rtspStreamService.cleanupIdleStreams();

      const filePath = rtspStreamService.resolveStreamFilePath(req.params.id, req.params.file);
      if (!fs.existsSync(filePath)) {
        // TEST-ONLY: Wait briefly for playlist generation before returning 404.
        const maxAttempts = 10;
        const delayMs = 200;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          if (fs.existsSync(filePath)) {
            break;
          }
        }
        if (!fs.existsSync(filePath)) {
          res.status(404).json(
            errorResponse('STREAM_PLAYLIST_NOT_READY', 'Stream playlist not ready', req.correlationId)
          );
          return;
        }
      }

      // TEST-ONLY: Prevent caching of live stream assets.
      res.setHeader('Cache-Control', 'no-store');
      if (path.extname(filePath) === '.m3u8') {
        // TEST-ONLY: Inject stream token into segment URLs for secure playback.
        const playlist = fs.readFileSync(filePath, 'utf8');
        const tokenParam = `token=${encodeURIComponent(token)}`;
        const rewritten = playlist
          .split('\n')
          .map((line) => {
            if (!line || line.startsWith('#')) {
              return line;
            }
            if (line.includes('token=')) {
              return line;
            }
            return line.includes('?') ? `${line}&${tokenParam}` : `${line}?${tokenParam}`;
          })
          .join('\n');
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(rewritten);
        return;
      }
      if (path.extname(filePath) === '.ts') {
        res.setHeader('Content-Type', 'video/MP2T');
      }

      res.sendFile(filePath);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/{id}/vms/connect:
 *   post:
 *     summary: Connect a camera to a VMS server
 *     tags: [Cameras]
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
 *               - serverId
 *               - monitorId
 *             properties:
 *               serverId:
 *                 type: string
 *               monitorId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Camera connected to VMS
 */
router.post(
  '/:id/vms/connect',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const cameraId = new mongoose.Types.ObjectId(req.params.id);

      const { serverId, monitorId } = req.body;

      if (!serverId || !monitorId) {
        throw new ValidationError('serverId and monitorId are required');
      }

      const { camera, capabilities } = await cameraService.connectToVms(
        companyId,
        cameraId,
        new mongoose.Types.ObjectId(serverId),
        monitorId,
        userId,
        {
          userId,
          correlationId: req.correlationId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      const cameraData = typeof (camera as any).toObject === 'function' ? (camera as any).toObject() : camera;
      res.json(successResponse({ ...cameraData, vmsCapabilities: capabilities }, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/{id}/vms/disconnect:
 *   post:
 *     summary: Disconnect a camera from VMS
 *     tags: [Cameras]
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
 *         description: Camera disconnected from VMS
 */
router.post(
  '/:id/vms/disconnect',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const userId = new mongoose.Types.ObjectId(req.user!.id);
      const cameraId = new mongoose.Types.ObjectId(req.params.id);

      const camera = await cameraService.disconnectFromVms(companyId, cameraId, userId, {
        userId,
        correlationId: req.correlationId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json(successResponse(camera, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/vms/import:
 *   post:
 *     summary: Batch import cameras from VMS monitors
 *     tags: [Cameras]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - serverId
 *               - monitors
 *             properties:
 *               serverId:
 *                 type: string
 *               monitors:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     monitorId:
 *                       type: string
 *                     name:
 *                       type: string
 *                     location:
 *                       type: object
 *     responses:
 *       201:
 *         description: Import results
 */
router.post(
  '/vms/import',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const userId = new mongoose.Types.ObjectId(req.user!.id);

      const { serverId, monitors } = req.body;

      if (!serverId || !Array.isArray(monitors) || monitors.length === 0) {
        throw new ValidationError('serverId and monitors array are required');
      }

      // Validate monitor data
      for (const monitor of monitors) {
        if (!monitor.monitorId || !monitor.name || !monitor.location?.coordinates) {
          throw new ValidationError('Each monitor must have monitorId, name, and location.coordinates');
        }
      }

      const result = await cameraService.batchImportFromVms(
        companyId,
        new mongoose.Types.ObjectId(serverId),
        monitors,
        userId,
        {
          userId,
          correlationId: req.correlationId,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        }
      );

      logger.info('Batch import from VMS completed via API', { 
        serverId, 
        created: result.created, 
        skipped: result.skipped, 
        correlationId: req.correlationId 
      });

      res.status(201).json(successResponse(result, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /cameras/vms/available:
 *   get:
 *     summary: Get available (not yet imported) monitors from VMS
 *     tags: [Cameras]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: serverId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of available monitors
 */
router.get(
  '/vms/available',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const { serverId } = req.query;

      if (!serverId) {
        throw new ValidationError('serverId query parameter is required');
      }

      const monitors = await cameraService.getAvailableMonitors(
        companyId,
        new mongoose.Types.ObjectId(serverId as string)
      );

      res.json(successResponse(monitors, req.correlationId));
    } catch (error) {
      next(error);
    }
  }
);


/**
 * @swagger
 * /cameras/source/{source}:
 *   delete:
 *     summary: Bulk delete cameras by metadata.source (soft delete)
 *     description: Used for cleaning up demo/test cameras that were imported from VMS
 *     tags: [Cameras]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: source
 *         required: true
 *         schema:
 *           type: string
 *         description: Metadata source tag (e.g., 'vms-import', 'shinobi-demo')
 *     responses:
 *       200:
 *         description: Cameras deleted successfully
 */
router.delete(
  '/source/:source',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);
      const { source } = req.params;

      const deletedCount = await cameraService.deleteCamerasBySource(source, companyId);

      res.json(
        successResponse(
          { deletedCount },
          req.correlationId
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

export default router;
