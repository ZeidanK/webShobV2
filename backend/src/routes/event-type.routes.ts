import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { EventTypeService, CreateEventTypeData, UpdateEventTypeData } from '../services/event-type.service';
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
 *     EventType:
 *       type: object
 *       required:
 *         - name
 *         - color
 *       properties:
 *         _id:
 *           type: string
 *           description: Event type ID
 *         name:
 *           type: string
 *           maxLength: 100
 *           description: Event type name
 *         description:
 *           type: string
 *           maxLength: 500
 *           description: Optional description
 *         color:
 *           type: string
 *           pattern: '^#[0-9A-F]{6}$'
 *           description: Hex color code for UI display
 *         icon:
 *           type: string
 *           maxLength: 50
 *           description: Icon name/class for UI display
 *         isSystemDefault:
 *           type: boolean
 *           description: Whether this is a system-provided default
 *         isActive:
 *           type: boolean
 *           description: Whether the event type is active
 *         companyId:
 *           type: string
 *           description: Company ID (null for system defaults)
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     CreateEventTypeRequest:
 *       type: object
 *       required:
 *         - name
 *         - color
 *       properties:
 *         name:
 *           type: string
 *           maxLength: 100
 *         description:
 *           type: string
 *           maxLength: 500
 *         color:
 *           type: string
 *           pattern: '^#[0-9A-F]{6}$'
 *         icon:
 *           type: string
 *           maxLength: 50
 *     
 *     UpdateEventTypeRequest:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           maxLength: 100
 *         description:
 *           type: string
 *           maxLength: 500
 *         color:
 *           type: string
 *           pattern: '^#[0-9A-F]{6}$'
 *         icon:
 *           type: string
 *           maxLength: 50
 *         isActive:
 *           type: boolean
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/event-types:
 *   get:
 *     summary: Get available event types
 *     description: Returns system defaults plus company-specific event types
 *     tags: [Event Types]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Event types retrieved successfully
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
 *                     $ref: '#/components/schemas/EventType'
 *                 correlationId:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.get('/', 
  authenticate, 
  requireAnyRole(UserRole.OPERATOR, UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.VIEWER), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventTypes = await EventTypeService.getAvailableEventTypes(new mongoose.Types.ObjectId(req.user!.companyId));
      res.status(200).json(successResponse(eventTypes, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/event-types/company:
 *   get:
 *     summary: Get company-specific event types only
 *     tags: [Event Types]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Company event types retrieved successfully
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
 *                     $ref: '#/components/schemas/EventType'
 *                 correlationId:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.get('/company', 
  authenticate, 
  requireAnyRole(UserRole.ADMIN, UserRole.COMPANY_ADMIN), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventTypes = await EventTypeService.getCompanyEventTypes(new mongoose.Types.ObjectId(req.user!.companyId));
      res.status(200).json(successResponse(eventTypes, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/event-types/{id}:
 *   get:
 *     summary: Get single event type by ID
 *     tags: [Event Types]
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
 *         description: Event type retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/EventType'
 *                 correlationId:
 *                   type: string
 *       404:
 *         description: Event type not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', 
  authenticate, 
  requireAnyRole(UserRole.OPERATOR, UserRole.ADMIN, UserRole.COMPANY_ADMIN, UserRole.VIEWER), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventType = await EventTypeService.getEventTypeById(req.params.id, new mongoose.Types.ObjectId(req.user!.companyId));
      res.status(200).json(successResponse(eventType, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/event-types:
 *   post:
 *     summary: Create company-specific event type
 *     tags: [Event Types]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateEventTypeRequest'
 *     responses:
 *       201:
 *         description: Event type created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/EventType'
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
  requireAnyRole(UserRole.ADMIN, UserRole.COMPANY_ADMIN), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description, color, icon } = req.body;
      
      // Validate required fields
      if (!name || !color) {
        throw new AppError('VALIDATION_ERROR', 'Missing required fields: name and color are required', 400);
      }
      
      // Validate color format (basic hex check)
      if (!/^#[0-9A-F]{6}$/i.test(color)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid color format: must be a valid hex color (#RRGGBB)', 400);
      }
      
      const eventTypeData: CreateEventTypeData = {
        name,
        description,
        color: color.toUpperCase(),
        icon,
      };
      
      const eventType = await EventTypeService.createEventType(
        eventTypeData,
        new mongoose.Types.ObjectId(req.user!.companyId),
        new mongoose.Types.ObjectId(req.user!.id),
        req.correlationId!
      );
      
      // Log successful creation
      logger.info('Event type created', {
        action: 'event_type.created',
        eventTypeId: eventType._id,
        name: eventType.name,
        createdBy: req.user!.id,
        companyId: req.user!.companyId,
        correlationId: req.correlationId,
      });
      
      res.status(201).json(successResponse(eventType, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/event-types/{id}:
 *   patch:
 *     summary: Update company event type
 *     description: Can only update company-specific event types, not system defaults
 *     tags: [Event Types]
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
 *             $ref: '#/components/schemas/UpdateEventTypeRequest'
 *     responses:
 *       200:
 *         description: Event type updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/EventType'
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Validation error or system default cannot be updated
 *       404:
 *         description: Event type not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
 */
router.patch('/:id', 
  authenticate, 
  requireAnyRole(UserRole.ADMIN, UserRole.COMPANY_ADMIN), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description, color, icon, isActive } = req.body;
      
      // Validate color format if provided
      if (color && !/^#[0-9A-F]{6}$/i.test(color)) {
        throw new AppError('VALIDATION_ERROR', 'Invalid color format: must be a valid hex color (#RRGGBB)', 400);
      }
      
      const updateData: UpdateEventTypeData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (color !== undefined) updateData.color = color.toUpperCase();
      if (icon !== undefined) updateData.icon = icon;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      const eventType = await EventTypeService.updateEventType(
        req.params.id,
        updateData,
        new mongoose.Types.ObjectId(req.user!.companyId),
        new mongoose.Types.ObjectId(req.user!.id),
        req.correlationId!
      );
      
      // Log successful update
      logger.info('Event type updated', {
        action: 'event_type.updated',
        eventTypeId: eventType._id,
        name: eventType.name,
        updatedBy: req.user!.id,
        companyId: req.user!.companyId,
        correlationId: req.correlationId,
      });
      
      res.status(200).json(successResponse(eventType, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/event-types/{id}:
 *   delete:
 *     summary: Delete company event type (soft delete)
 *     description: Can only delete company-specific event types, not system defaults
 *     tags: [Event Types]
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
 *         description: Event type deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/EventType'
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: System default cannot be deleted
 *       404:
 *         description: Event type not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
 */
router.delete('/:id', 
  authenticate, 
  requireAnyRole(UserRole.ADMIN, UserRole.COMPANY_ADMIN), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventType = await EventTypeService.deleteEventType(
        req.params.id,
        new mongoose.Types.ObjectId(req.user!.companyId),
        new mongoose.Types.ObjectId(req.user!.id),
        req.correlationId!
      );
      
      // Log successful deletion
      logger.info('Event type deleted', {
        action: 'event_type.deleted',
        eventTypeId: eventType._id,
        name: eventType.name,
        deletedBy: req.user!.id,
        companyId: req.user!.companyId,
        correlationId: req.correlationId,
      });
      
      res.status(200).json(successResponse(eventType, req.correlationId!));
    } catch (error) {
      next(error);
    }
  }
);

export { router as eventTypeRoutes };