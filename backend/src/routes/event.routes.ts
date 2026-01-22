import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { EventService, CreateEventData, UpdateEventData } from '../services/event.service';
import { cameraService } from '../services/camera.service';
import { vmsService } from '../services/vms.service';
import { EventStatus, EventPriority } from '../models/event.model';
import { VmsServer } from '../models';
import { authenticate, requireAnyRole } from '../middleware';
import { UserRole } from '../models/user.model';
import { AppError } from '../utils/errors';
import { successResponse } from '../utils/response';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Event:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - eventTypeId
 *         - location
 *         - companyId
 *         - createdBy
 *       properties:
 *         _id:
 *           type: string
 *           description: Event ID
 *         title:
 *           type: string
 *           maxLength: 200
 *           description: Event title
 *         description:
 *           type: string
 *           maxLength: 2000
 *           description: Event description
 *         companyId:
 *           type: string
 *           description: Company ID (tenant isolation)
 *         eventTypeId:
 *           type: string
 *           description: Event type ID
 *         status:
 *           type: string
 *           enum: [created, active, assigned, resolved, closed]
 *           description: Event status
 *         priority:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           description: Event priority
 *         location:
 *           type: object
 *           required:
 *             - type
 *             - coordinates
 *           properties:
 *             type:
 *               type: string
 *               enum: [Point]
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *               minItems: 2
 *               maxItems: 2
 *               description: "[longitude, latitude]"
 *         locationDescription:
 *           type: string
 *           maxLength: 500
 *           description: Human-readable location description
 *         createdBy:
 *           type: string
 *           description: User ID who created the event
 *         assignedTo:
 *           type: string
 *           description: User ID assigned to handle the event
 *         reportIds:
 *           type: array
 *           items:
 *             type: string
 *           description: Array of linked report IDs
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         resolvedAt:
 *           type: string
 *           format: date-time
 *         closedAt:
 *           type: string
 *           format: date-time
 *     
 *     CreateEventRequest:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - eventTypeId
 *         - location
 *       properties:
 *         title:
 *           type: string
 *           maxLength: 200
 *         description:
 *           type: string
 *           maxLength: 2000
 *         eventTypeId:
 *           type: string
 *         priority:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           default: medium
 *         location:
 *           type: object
 *           required:
 *             - type
 *             - coordinates
 *           properties:
 *             type:
 *               type: string
 *               enum: [Point]
 *             coordinates:
 *               type: array
 *               items:
 *                 type: number
 *               minItems: 2
 *               maxItems: 2
 *         locationDescription:
 *           type: string
 *           maxLength: 500
 *         reportIds:
 *           type: array
 *           items:
 *             type: string
 * 
 *     UpdateEventStatusRequest:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [created, active, assigned, resolved, closed]
 *     
 *     LinkReportRequest:
 *       type: object
 *       required:
 *         - reportId
 *       properties:
 *         reportId:
 *           type: string
 *           description: ID of the report to link to the event
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Create a new event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateEventRequest'
 *     responses:
 *       201:
 *         description: Event created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
 */
router.post('/', 
  authenticate, 
  requireAnyRole(UserRole.OPERATOR, UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, description, eventTypeId, priority, location, locationDescription, reportIds } = req.body;
      
      // Validate required fields
      if (!title || !description || !eventTypeId || !location) {
        throw new AppError('VALIDATION_ERROR', 'Missing required fields', 400);
      }
      
      // Validate location format
      if (!location.type || location.type !== 'Point' || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
        throw new AppError('VALIDATION_ERROR', 'Invalid location format: Location must be a GeoJSON Point with coordinates array [longitude, latitude]', 400);
      }
      
      const eventData: CreateEventData = {
        title,
        description,
        eventTypeId,
        priority: priority || EventPriority.MEDIUM,
        location,
        locationDescription,
        reportIds,
      };
      
      const event = await EventService.createEvent(
        eventData,
        new mongoose.Types.ObjectId(req.user!.companyId),
        new mongoose.Types.ObjectId(req.user!.id),
        req.correlationId!
      );
      
      logger.info('Event created', {
        action: 'event.create',
        eventId: event._id,
        title: event.title,
        createdBy: req.user!.id,
        companyId: req.user!.companyId,
        correlationId: req.correlationId,
      });
      
      res.status(201).json(successResponse(event, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Get events for company with pagination and filtering
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [created, active, assigned, resolved, closed]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *       - in: query
 *         name: eventTypeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: string
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, priority, title]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title, description, and location description
 *     responses:
 *       200:
 *         description: Events retrieved successfully
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
 *                     $ref: '#/components/schemas/Event'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                 correlationId:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.get('/', 
  authenticate, 
  requireAnyRole(UserRole.OPERATOR, UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.VIEWER, UserRole.SUPER_ADMIN), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        page = 1,
        pageSize = 20,
        status,
        priority,
        eventTypeId,
        assignedTo,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search,
      } = req.query;
      
      const result = await EventService.getEvents(new mongoose.Types.ObjectId(req.user!.companyId), {
        page: Number(page),
        pageSize: Math.min(Number(pageSize), 100),
        status: status as EventStatus,
        priority: priority as EventPriority,
        eventTypeId: eventTypeId as string,
        assignedTo: assignedTo as string,
        sortBy: sortBy as any,
        sortOrder: sortOrder as any,
        search: search as string,
      });
      
      const meta = {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: Math.ceil(result.total / result.pageSize),
        hasNextPage: result.page < Math.ceil(result.total / result.pageSize),
        hasPrevPage: result.page > 1,
      };
      
      res.status(200).json(successResponse(result.events, req.correlationId!, meta));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/events/geo:
 *   get:
 *     summary: Get events within a geographic bounding box
 *     description: Returns events within the specified map bounding box for map visualization
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: minLng
 *         required: true
 *         schema:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *         description: Minimum longitude (west boundary)
 *       - in: query
 *         name: minLat
 *         required: true
 *         schema:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *         description: Minimum latitude (south boundary)
 *       - in: query
 *         name: maxLng
 *         required: true
 *         schema:
 *           type: number
 *           minimum: -180
 *           maximum: 180
 *         description: Maximum longitude (east boundary)
 *       - in: query
 *         name: maxLat
 *         required: true
 *         schema:
 *           type: number
 *           minimum: -90
 *           maximum: 90
 *         description: Maximum latitude (north boundary)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [created, active, assigned, resolved, closed]
 *         description: Filter by event status (can be repeated for multiple statuses)
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by event priority (can be repeated for multiple priorities)
 *       - in: query
 *         name: eventTypeId
 *         schema:
 *           type: string
 *         description: Filter by event type ID
 *     responses:
 *       200:
 *         description: Events retrieved successfully
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
 *                     $ref: '#/components/schemas/Event'
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Invalid bounding box parameters
 *       401:
 *         description: Unauthorized
 */
router.get('/geo', 
  authenticate, 
  requireAnyRole(UserRole.OPERATOR, UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.VIEWER, UserRole.SUPER_ADMIN), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { minLng, minLat, maxLng, maxLat, status, priority, eventTypeId } = req.query;
      
      // Validate required parameters
      if (!minLng || !minLat || !maxLng || !maxLat) {
        throw new AppError('VALIDATION_ERROR', 'Missing required bounding box parameters: minLng, minLat, maxLng, maxLat', 400);
      }
      
      // Parse and validate coordinates
      const bounds = {
        minLng: parseFloat(minLng as string),
        minLat: parseFloat(minLat as string),
        maxLng: parseFloat(maxLng as string),
        maxLat: parseFloat(maxLat as string),
      };
      
      // Validate coordinate ranges
      if (bounds.minLng < -180 || bounds.minLng > 180 || bounds.maxLng < -180 || bounds.maxLng > 180) {
        throw new AppError('VALIDATION_ERROR', 'Longitude must be between -180 and 180', 400);
      }
      
      if (bounds.minLat < -90 || bounds.minLat > 90 || bounds.maxLat < -90 || bounds.maxLat > 90) {
        throw new AppError('VALIDATION_ERROR', 'Latitude must be between -90 and 90', 400);
      }
      
      if (bounds.minLng >= bounds.maxLng || bounds.minLat >= bounds.maxLat) {
        throw new AppError('VALIDATION_ERROR', 'Invalid bounding box: min values must be less than max values', 400);
      }
      
      // Build filters
      const filters: any = {};
      
      if (status) {
        filters.status = Array.isArray(status) ? status : [status];
      }
      
      if (priority) {
        filters.priority = Array.isArray(priority) ? priority : [priority];
      }
      
      if (eventTypeId) {
        filters.eventTypeId = eventTypeId;
      }
      
      const events = await EventService.getEventsInBoundingBox(
        new mongoose.Types.ObjectId(req.user!.companyId),
        bounds,
        filters
      );
      
      logger.info('Events retrieved for map view', {
        action: 'event.geo.query',
        eventCount: events.length,
        bounds,
        companyId: req.user!.companyId,
        correlationId: req.correlationId,
      });
      
      res.status(200).json(successResponse(events, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Get event by ID
 *     tags: [Events]
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
 *         description: Event retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *                 correlationId:
 *                   type: string
 *       404:
 *         description: Event not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', 
  authenticate, 
  requireAnyRole(UserRole.OPERATOR, UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.VIEWER, UserRole.SUPER_ADMIN), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await EventService.getEventById(req.params.id, new mongoose.Types.ObjectId(req.user!.companyId));
      res.status(200).json(successResponse(event, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/events/{id}:
 *   patch:
 *     summary: Update event
 *     tags: [Events]
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
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *               eventTypeId:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               location:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [Point]
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *               locationDescription:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Event updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Validation error
 *       404:
 *         description: Event not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
 */
router.patch('/:id', 
  authenticate, 
  requireAnyRole(UserRole.OPERATOR, UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, description, eventTypeId, priority, location, locationDescription } = req.body;
      
      // Validate location format if provided
      if (location) {
        if (!location.type || location.type !== 'Point' || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
          throw new AppError('VALIDATION_ERROR', 'Invalid location format: Location must be a GeoJSON Point with coordinates array [longitude, latitude]', 400);
        }
      }
      
      const updateData: UpdateEventData = {};
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (eventTypeId !== undefined) updateData.eventTypeId = eventTypeId;
      if (priority !== undefined) updateData.priority = priority;
      if (location !== undefined) updateData.location = location;
      if (locationDescription !== undefined) updateData.locationDescription = locationDescription;
      
      const event = await EventService.updateEvent(
        req.params.id,
        updateData,
        new mongoose.Types.ObjectId(req.user!.companyId),
        new mongoose.Types.ObjectId(req.user!.id),
        req.correlationId!
      );
      
      logger.info('Event updated', {
        action: 'event.update',
        eventId: event._id,
        updatedBy: req.user!.id,
        companyId: req.user!.companyId,
        correlationId: req.correlationId,
      });
      
      res.status(200).json(successResponse(event, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/events/{id}/status:
 *   patch:
 *     summary: Update event status (lifecycle management)
 *     tags: [Events]
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
 *             $ref: '#/components/schemas/UpdateEventStatusRequest'
 *     responses:
 *       200:
 *         description: Event status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Invalid status transition
 *       404:
 *         description: Event not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
 */
router.patch('/:id/status', 
  authenticate, 
  requireAnyRole(UserRole.OPERATOR, UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { status } = req.body;
      
      if (!status) {
        throw new AppError('VALIDATION_ERROR', 'Status is required', 400);
      }
      
      if (!Object.values(EventStatus).includes(status)) {
        throw new AppError('VALIDATION_ERROR', `Invalid status: must be one of ${Object.values(EventStatus).join(', ')}`, 400);
      }
      
      const event = await EventService.updateEventStatus(
        req.params.id,
        status,
        new mongoose.Types.ObjectId(req.user!.companyId),
        new mongoose.Types.ObjectId(req.user!.id),
        req.correlationId!
      );
      
      logger.info('Event status updated', {
        action: 'event.status_update',
        eventId: event._id,
        newStatus: status,
        updatedBy: req.user!.id,
        companyId: req.user!.companyId,
        correlationId: req.correlationId,
      });
      
      res.status(200).json(successResponse(event, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/events/{id}/reports:
 *   post:
 *     summary: Link report to event
 *     tags: [Events]
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
 *             $ref: '#/components/schemas/LinkReportRequest'
 *     responses:
 *       200:
 *         description: Report linked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Report already linked or validation error
 *       404:
 *         description: Event or report not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
 */
router.post('/:id/reports', 
  authenticate, 
  requireAnyRole(UserRole.OPERATOR, UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reportId } = req.body;
      
      if (!reportId) {
        throw new AppError('VALIDATION_ERROR', 'Report ID is required', 400);
      }
      
      const event = await EventService.linkReport(
        req.params.id,
        reportId,
        new mongoose.Types.ObjectId(req.user!.companyId),
        new mongoose.Types.ObjectId(req.user!.id),
        req.correlationId!
      );
      
      logger.info('Report linked to event', {
        action: 'report.link_to_event',
        eventId: event._id,
        reportId,
        linkedBy: req.user!.id,
        companyId: req.user!.companyId,
        correlationId: req.correlationId,
      });
      
      res.status(200).json(successResponse(event, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/events/{id}/reports/{reportId}:
 *   delete:
 *     summary: Unlink report from event
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema:
 *           type: string
 *         description: Report ID to unlink
 *     responses:
 *       200:
 *         description: Report unlinked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Report not linked to event
 *       404:
 *         description: Event or report not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
 */
router.delete('/:id/reports/:reportId', 
  authenticate, 
  requireAnyRole(UserRole.OPERATOR, UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await EventService.unlinkReport(
        req.params.id,
        req.params.reportId,
        new mongoose.Types.ObjectId(req.user!.companyId),
        new mongoose.Types.ObjectId(req.user!.id),
        req.correlationId!
      );
      
      logger.info('Report unlinked from event', {
        action: 'report.unlink_from_event',
        eventId: event._id,
        reportId: req.params.reportId,
        unlinkedBy: req.user!.id,
        companyId: req.user!.companyId,
        correlationId: req.correlationId,
      });
      
      res.status(200).json(successResponse(event, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/events/{id}/video-playback:
 *   get:
 *     summary: Get cameras for event video playback
 *     tags: [Events]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 500
 *         description: Search radius in meters
 *     responses:
 *       200:
 *         description: Cameras with playback information
 */
router.get(
  '/:id/video-playback',
  authenticate,
  requireAnyRole(UserRole.OPERATOR, UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { radius = 500 } = req.query;
      const companyId = new mongoose.Types.ObjectId(req.user!.companyId);

      // Get the event
      const event = await EventService.getEventById(id, companyId);
      
      if (!event) {
        throw new AppError('EVENT_NOT_FOUND', 'Event not found', 404);
      }

      // Find nearby cameras (super admins can see all companies' cameras)
      const searchCompanyId = req.user!.role === UserRole.SUPER_ADMIN 
        ? null 
        : companyId;

      const nearbyCameras = await cameraService.findNearby(
        searchCompanyId,
        event.location.coordinates,
        parseInt(radius as string, 10),
        16 // Max 16 cameras for 4x4 grid
      );

      const playbackTimestamp = event.createdAt;
      const serverIds = Array.from(
        new Set(
          nearbyCameras
            .map((camera: any) => camera.vms?.serverId?.toString())
            .filter(Boolean)
        )
      );
      const serverQuery: Record<string, unknown> = { _id: { $in: serverIds } };
      if (searchCompanyId) {
        serverQuery.companyId = searchCompanyId;
      }
      const servers = serverIds.length > 0 ? await VmsServer.find(serverQuery) : [];
      const serverById = new Map(servers.map((server) => [server._id.toString(), server]));

      // TEST-ONLY: Build playback metadata per camera for event playback responses.
      const playbackCameras = await Promise.all(
        nearbyCameras.map(async (camera: any) => {
          const recordingEnabled =
            camera.recording?.enabled ?? camera.settings?.recordingEnabled ?? false;
          const hasVms = !!camera.vms?.serverId;
          let playbackUrl: string | undefined;
          let available = false;
          let playbackReason: string | undefined;

          if (hasVms && camera.vms?.monitorId && recordingEnabled) {
            const server = serverById.get(camera.vms.serverId.toString());
            if (!server) {
              playbackReason = 'VMS server not found';
            } else {
              try {
                const url = await vmsService.getPlaybackUrl(
                  server,
                  camera.vms.monitorId,
                  playbackTimestamp
                );
                if (url) {
                  playbackUrl = url;
                  available = true;
                } else {
                  playbackReason = 'Playback URL not available';
                }
              } catch (err) {
                playbackReason = err instanceof Error ? err.message : 'Playback unavailable';
              }
            }
          } else if (camera.streamConfig?.type === 'direct-rtsp') {
            // TEST-ONLY: Direct RTSP cameras do not have recording in MVP.
            playbackReason = 'Direct RTSP recording not available';
          } else if (!recordingEnabled) {
            playbackReason = 'Recording not enabled';
          } else if (!hasVms) {
            playbackReason = 'No VMS server linked';
          } else if (!camera.vms?.monitorId) {
            playbackReason = 'No VMS monitor linked';
          }

          // TEST-ONLY: Include playback metadata fields expected by the UI.
          return {
            cameraId: camera._id,
            cameraName: camera.name,
            name: camera.name,
            streamUrl: camera.streamUrl,
            hasRecording: recordingEnabled,
            playbackUrl,
            available,
            playbackReason,
            location: camera.location,
            status: camera.status,
          };
        })
      );

      logger.info('event.video_playback', {
        eventId: id,
        camerasFound: playbackCameras.length,
        radius: parseInt(radius as string, 10),
        correlationId: req.correlationId,
      });

      res.json(
        successResponse(
          {
            event: {
              id: event._id,
              title: event.title,
              timestamp: event.createdAt,
              location: event.location,
            },
            cameras: playbackCameras,
          },
          req.correlationId!
        )
      );
    } catch (error) {
      next(error);
    }
  }
);

export { router as eventRoutes };
