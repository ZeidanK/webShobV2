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
 *           description: Event type description
 *         color:
 *           type: string
 *           pattern: "^#[0-9A-F]{6}$"
 *           description: Hex color for UI display
 *         icon:
 *           type: string
 *           maxLength: 50
 *           description: Icon identifier for UI
 *         companyId:
 *           type: string
 *           description: Company ID (null for system defaults)
 *         isSystemDefault:
 *           type: boolean
 *           description: Whether this is a system default type
 *         isActive:
 *           type: boolean
 *           description: Whether this type is active
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
 *           pattern: "^#[0-9A-F]{6}$"
 *           example: "#FF0000"
 *         icon:
 *           type: string
 *           maxLength: 50
 *           example: "shield-exclamation"
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
 *           pattern: "^#[0-9A-F]{6}$"
 *         icon:
 *           type: string
 *           maxLength: 50
 *         isActive:
 *           type: boolean
 */

/**
 * @swagger
 * /api/event-types:
 *   get:
 *     summary: Get available event types for company
 *     description: Returns both system default and company-specific event types
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
  authMiddleware, 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventTypes = await EventTypeService.getAvailableEventTypes(req.user!.companyId);
      responseWrapper(res, 200, eventTypes);
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
 *     description: Returns only event types created by the company (excludes system defaults)
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
  authMiddleware, 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventTypes = await EventTypeService.getCompanyEventTypes(req.user!.companyId);
      responseWrapper(res, 200, eventTypes);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/event-types/{id}:
 *   get:
 *     summary: Get event type by ID
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
  authMiddleware, 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventType = await EventTypeService.getEventTypeById(req.params.id, req.user!.companyId);
      responseWrapper(res, 200, eventType);
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
 *         description: Validation error or name already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
 */
router.post('/', 
  authMiddleware, 
  rbacMiddleware([UserRole.ADMIN, UserRole.COMPANY_ADMIN]), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description, color, icon } = req.body;
      
      // Validate required fields
      if (!name || !color) {
        throw new ValidationError('Missing required fields', {
          name: !name ? 'Name is required' : undefined,
          color: !color ? 'Color is required' : undefined,
        });
      }
      
      // Validate color format
      const colorRegex = /^#[0-9A-F]{6}$/i;
      if (!colorRegex.test(color)) {
        throw new ValidationError('Invalid color format', {
          color: 'Color must be a valid hex color (e.g., #FF0000)',
        });
      }
      
      const eventTypeData: CreateEventTypeData = {
        name: name.trim(),
        description: description?.trim(),
        color: color.toUpperCase(),
        icon: icon?.trim(),
      };
      
      const eventType = await EventTypeService.createEventType(
        eventTypeData,
        req.user!.companyId,
        req.user!._id,
        req.correlationId!
      );
      
      logger.info('Event type created', {
        action: 'event_type.create',
        eventTypeId: eventType._id,
        name: eventType.name,
        createdBy: req.user!._id,
        companyId: req.user!.companyId,
        correlationId: req.correlationId,
      });
      
      responseWrapper(res, 201, eventType);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/event-types/{id}:
 *   patch:
 *     summary: Update company-specific event type
 *     description: Only company-specific event types can be updated, not system defaults
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
 *         description: Validation error or cannot update system default
 *       404:
 *         description: Event type not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
 */
router.patch('/:id', 
  authMiddleware, 
  rbacMiddleware([UserRole.ADMIN, UserRole.COMPANY_ADMIN]), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description, color, icon, isActive } = req.body;
      
      const updateData: UpdateEventTypeData = {};
      
      if (name !== undefined) {
        updateData.name = name.trim();
      }
      
      if (description !== undefined) {
        updateData.description = description?.trim();
      }
      
      if (color !== undefined) {
        // Validate color format
        const colorRegex = /^#[0-9A-F]{6}$/i;
        if (!colorRegex.test(color)) {
          throw new ValidationError('Invalid color format', {
            color: 'Color must be a valid hex color (e.g., #FF0000)',
          });
        }
        updateData.color = color.toUpperCase();
      }
      
      if (icon !== undefined) {
        updateData.icon = icon?.trim();
      }
      
      if (isActive !== undefined) {
        updateData.isActive = isActive;
      }
      
      const eventType = await EventTypeService.updateEventType(
        req.params.id,
        updateData,
        req.user!.companyId,
        req.user!._id,
        req.correlationId!
      );
      
      logger.info('Event type updated', {
        action: 'event_type.update',
        eventTypeId: eventType._id,
        updatedBy: req.user!._id,
        companyId: req.user!.companyId,
        correlationId: req.correlationId,
      });
      
      responseWrapper(res, 200, eventType);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/event-types/{id}:
 *   delete:
 *     summary: Delete (soft delete) company-specific event type
 *     description: Only company-specific event types can be deleted, not system defaults
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
 *       204:
 *         description: Event type deleted successfully
 *       400:
 *         description: Cannot delete system default event type
 *       404:
 *         description: Event type not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (insufficient permissions)
 */
router.delete('/:id', 
  authMiddleware, 
  rbacMiddleware([UserRole.ADMIN, UserRole.COMPANY_ADMIN]), 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await EventTypeService.deleteEventType(
        req.params.id,
        req.user!.companyId,
        req.user!._id,
        req.correlationId!
      );
      
      logger.info('Event type deleted', {
        action: 'event_type.delete',
        eventTypeId: req.params.id,
        deletedBy: req.user!._id,
        companyId: req.user!.companyId,
        correlationId: req.correlationId,
      });
      
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export { router as eventTypeRoutes };