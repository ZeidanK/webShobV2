import { Request, Response, NextFunction } from 'express';
import { Event, EventStatus } from '../models/event.model';
import { UserRole } from '../models/user.model';
import { AuditLog, AuditAction } from '../models/audit-log.model';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { websocketService } from '../services/websocket.service';
import mongoose from 'mongoose';

/**
 * Mobile Event Controller
 * Handles event assignments and status updates for first responders
 */

/**
 * Get responder's event assignments
 * GET /api/mobile/events/assignments
 */
export const getAssignments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const companyId = req.user!.companyId;
    const userRole = req.user!.role;

    // Verify user is a first responder
    if (userRole !== UserRole.FIRST_RESPONDER) {
      throw new AppError('ACCESS_DENIED', 'Only first responders can access assignments', 403);
    }

    // Find events assigned to this responder
    const assignments = await Event.find({
      companyId,
      assignedTo: userId,
      status: { $in: [EventStatus.ASSIGNED, EventStatus.IN_PROGRESS] },
    })
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .populate('eventType', 'name color')
      .populate({
        path: 'reports',
        populate: {
          path: 'submittedBy',
          select: 'firstName lastName email',
        },
      })
      .sort({ priority: -1, updatedAt: -1 }) // High priority first, then most recent
      .lean();

    // Enhance assignments with distance if responder has location
    // TODO: Implement distance calculation based on responder's current location

    logger.info({
      action: 'mobile.events.assignments.list',
      context: {
        userId,
        companyId,
        assignmentCount: assignments.length,
      },
      correlationId: req.correlationId,
    });

    res.json({
      success: true,
      data: assignments,
      meta: {
        count: assignments.length,
        timestamp: new Date().toISOString(),
      },
      correlationId: req.correlationId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update event status (for responders)
 * PATCH /api/mobile/events/:id/status
 */
export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: eventId } = req.params;
    const { status, notes } = req.body;
    const userId = req.user!.id;
    const companyId = req.user!.companyId;
    const userRole = req.user!.role;

    // Verify user is a first responder
    if (userRole !== UserRole.FIRST_RESPONDER) {
      throw new AppError('ACCESS_DENIED', 'Only first responders can update event status', 403);
    }

    // Validate event ID
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw new AppError('INVALID_EVENT_ID', 'Invalid event ID format', 400);
    }

    // Validate status
    const allowedStatuses = [EventStatus.ASSIGNED, EventStatus.IN_PROGRESS, EventStatus.RESOLVED];
    if (!allowedStatuses.includes(status)) {
      throw new AppError('INVALID_STATUS', `Status must be one of: ${allowedStatuses.join(', ')}`, 400);
    }

    // Find event and verify assignment
    const event = await Event.findOne({
      _id: eventId,
      companyId,
      assignedTo: userId,
    }).populate('assignedTo', 'firstName lastName email');

    if (!event) {
      throw new AppError('EVENT_NOT_FOUND', 'Event not found or not assigned to you', 404);
    }

    // Validate status transition
    const currentStatus = event.status;
    const validTransitions: Record<EventStatus, EventStatus[]> = {
      [EventStatus.CREATED]: [EventStatus.ACTIVE],
      [EventStatus.ACTIVE]: [EventStatus.ASSIGNED],
      [EventStatus.ASSIGNED]: [EventStatus.IN_PROGRESS, EventStatus.RESOLVED],
      [EventStatus.IN_PROGRESS]: [EventStatus.RESOLVED],
      [EventStatus.RESOLVED]: [EventStatus.CLOSED],
      [EventStatus.CLOSED]: [], // Cannot transition from closed
    };

    if (!validTransitions[currentStatus]?.includes(status)) {
      throw new AppError(
        'INVALID_STATUS_TRANSITION',
        `Cannot transition from ${currentStatus} to ${status}`,
        400
      );
    }

    // Store previous status for audit
    const previousStatus = event.status;

    // Update event
    event.status = status;
    if (notes) {
      // Add notes to event history/comments (simplified for MVP)
      if (!event.notes) {
        event.notes = [];
      }
      event.notes.push({
        message: notes,
        userId: new mongoose.Types.ObjectId(userId),
        timestamp: new Date(),
      });
    }

    // Update timestamps based on status
    if (status === EventStatus.IN_PROGRESS && !event.respondedAt) {
      event.respondedAt = new Date();
    }
    if (status === EventStatus.RESOLVED && !event.resolvedAt) {
      event.resolvedAt = new Date();
    }

    await event.save();

    // Create audit log
    await AuditLog.create({
      action: AuditAction.EVENT_STATUS_UPDATED,
      companyId,
      userId,
      resourceType: 'Event',
      resourceId: event._id,
      changes: {
        previousStatus,
        newStatus: status,
        notes,
        updatedVia: 'mobile',
      },
      correlationId: req.correlationId,
    });

    logger.info({
      action: 'mobile.event.status.update.success',
      context: {
        eventId,
        userId,
        companyId,
        previousStatus,
        newStatus: status,
        hasNotes: !!notes,
      },
      correlationId: req.correlationId,
    });

    // Emit WebSocket event for real-time updates
    websocketService.broadcastEventUpdated(companyId, {
      eventId,
      status,
      previousStatus,
      updatedBy: userId,
      updatedAt: new Date(),
      updatedVia: 'mobile',
    });

    // Return updated event
    const updatedEvent = await Event.findById(eventId)
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .populate('eventType', 'name color')
      .lean();

    res.json({
      success: true,
      data: updatedEvent,
      correlationId: req.correlationId,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single event assignment details
 * GET /api/mobile/events/:id
 */
export const getAssignmentDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: eventId } = req.params;
    const userId = req.user!.id;
    const companyId = req.user!.companyId;
    const userRole = req.user!.role;

    // Verify user is a first responder
    if (userRole !== UserRole.FIRST_RESPONDER) {
      throw new AppError('ACCESS_DENIED', 'Only first responders can access event assignments', 403);
    }

    // Validate event ID
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      throw new AppError('INVALID_EVENT_ID', 'Invalid event ID format', 400);
    }

    // Find event and verify assignment
    const event = await Event.findOne({
      _id: eventId,
      companyId,
      assignedTo: userId,
    })
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .populate('eventType', 'name color priority')
      .populate({
        path: 'reports',
        populate: {
          path: 'submittedBy',
          select: 'firstName lastName email',
        },
      })
      .lean();

    if (!event) {
      throw new AppError('EVENT_NOT_FOUND', 'Event assignment not found', 404);
    }

    logger.info({
      action: 'mobile.event.assignment.details',
      context: {
        eventId,
        userId,
        companyId,
      },
      correlationId: req.correlationId,
    });

    res.json({
      success: true,
      data: event,
      correlationId: req.correlationId,
    });
  } catch (error) {
    next(error);
  }
};