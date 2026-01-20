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
import { rtspStreamService } from '../services/rtsp-stream.service';
import { CameraStatus } from '../models';
import { config } from '../config';
import { successResponse, errorResponse, calculatePagination } from '../utils/response';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { AppError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { UserRole } from '../models';

const router = Router();

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
      
      const { page, limit, status, vmsServerId, hasVms, search, sortBy, sortOrder } = req.query;

      const result = await cameraService.findAll(
        companyId,
        {
          status: (status && status !== 'undefined') ? status as CameraStatus : undefined,
          vmsServerId: vmsServerId ? new mongoose.Types.ObjectId(vmsServerId as string) : undefined,
          hasVms: hasVms === 'true' ? true : hasVms === 'false' ? false : undefined,
          search: (search && search !== '') ? search as string : undefined,
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

      const { name, description, streamUrl, streamConfig, type, status, location, settings, vms, metadata } = req.body;

      // Validate required fields
      if (!name) {
        throw new ValidationError('name is required');
      }
      if (!location?.coordinates || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
        throw new ValidationError('location.coordinates must be [longitude, latitude]');
      }

      const data: CreateCameraInput = {
        name,
        description,
        streamUrl,
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

      const { name, description, streamUrl, streamConfig, type, status, location, settings, metadata } = req.body;

      const data: UpdateCameraInput = {};
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      if (streamUrl !== undefined) data.streamUrl = streamUrl;
      // TEST-ONLY: Stream config scaffolding for Direct RTSP.
      if (streamConfig !== undefined) data.streamConfig = streamConfig;
      if (type !== undefined) data.type = type;
      if (status !== undefined) data.status = status;
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

      res.json(successResponse(streams, req.correlationId));
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
      const token = typeof req.query.token === 'string' ? req.query.token : '';
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
        res.status(404).json(errorResponse('STREAM_FILE_NOT_FOUND', 'Stream file not found', req.correlationId));
        return;
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

      const camera = await cameraService.connectToVms(
        companyId,
        cameraId,
        new mongoose.Types.ObjectId(serverId),
        monitorId,
        userId
      );

      res.json(successResponse(camera, req.correlationId));
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

      const camera = await cameraService.disconnectFromVms(companyId, cameraId, userId);

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
        userId
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
 * /cameras/nearby:
 *   get:
 *     summary: Find cameras near a location
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
  '/nearby',
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Super admins can see all cameras, others see only their company's cameras
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
