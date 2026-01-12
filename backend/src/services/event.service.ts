import mongoose from 'mongoose';
import { Event, EventStatus, EventPriority, IEvent } from '../models/event.model';
import { EventType, IEventType } from '../models/event-type.model';
import { Report } from '../models/report.model';
import { AuditLog, AuditAction } from '../models/audit-log.model';
import { AppError } from '../utils/errors';

/**
 * Event Creation Data
 */
export interface CreateEventData {
  title: string;
  description: string;
  eventTypeId: string;
  priority?: EventPriority;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  locationDescription?: string;
  reportIds?: string[]; // Optional initial reports to link
}

/**
 * Event Update Data
 */
export interface UpdateEventData {
  title?: string;
  description?: string;
  eventTypeId?: string;
  priority?: EventPriority;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  locationDescription?: string;
}

/**
 * Event Query Options
 */
export interface EventQueryOptions {
  page?: number;
  pageSize?: number;
  status?: EventStatus | EventStatus[];
  priority?: EventPriority | EventPriority[];
  eventTypeId?: string;
  assignedTo?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'title';
  sortOrder?: 'asc' | 'desc';
  search?: string; // Search in title and description
}

/**
 * Event Service
 * Handles event CRUD operations, lifecycle management, and report linking
 */
export class EventService {
  
  /**
   * Create a new event
   */
  static async createEvent(
    data: CreateEventData,
    companyId: mongoose.Types.ObjectId,
    createdById: mongoose.Types.ObjectId,
    correlationId: string
  ): Promise<IEvent> {
    // Validate event type exists and is available to company
    const eventType = await EventType.findOne({
      _id: data.eventTypeId,
      $or: [
        { isSystemDefault: true },
        { companyId }
      ],
      isActive: true,
    });
    
    if (!eventType) {
      throw new AppError('EVENT_TYPE_NOT_FOUND', 'Invalid event type: Event type not found or not available to company', 400);
    }
    
    // If initial reports provided, validate they exist and belong to company
    if (data.reportIds && data.reportIds.length > 0) {
      const reports = await Report.find({
        _id: { $in: data.reportIds },
        companyId,
      });
      
      if (reports.length !== data.reportIds.length) {
        throw new AppError('REPORT_NOT_FOUND', 'Invalid reports: One or more reports not found or do not belong to company', 400);
      }
    }
    
    // Create event
    const event = new Event({
      title: data.title,
      description: data.description,
      companyId,
      eventTypeId: data.eventTypeId,
      priority: data.priority || EventPriority.MEDIUM,
      location: data.location,
      locationDescription: data.locationDescription,
      createdBy: createdById,
      reportIds: data.reportIds || [],
    });
    
    await event.save();
    
    // Create audit log
    await AuditLog.create({
      action: AuditAction.EVENT_CREATED,
      entityType: 'Event',
      entityId: event._id,
      companyId,
      userId: createdById,
      details: {
        title: event.title,
        eventType: eventType.name,
        priority: event.priority,
        reportCount: event.reportIds.length,
      },
      correlationId,
    });
    
    return event.populate(['eventTypeId', 'createdBy', 'reportIds']);
  }
  
  /**
   * Get events for company with pagination and filtering
   */
  static async getEvents(
    companyId: mongoose.Types.ObjectId,
    options: EventQueryOptions = {}
  ): Promise<{ events: IEvent[]; total: number; page: number; pageSize: number }> {
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
    } = options;
    
    // Build query
    const query: any = { companyId };
    
    if (status) {
      query.status = Array.isArray(status) ? { $in: status } : status;
    }
    
    if (priority) {
      query.priority = Array.isArray(priority) ? { $in: priority } : priority;
    }
    
    if (eventTypeId) {
      query.eventTypeId = eventTypeId;
    }
    
    if (assignedTo) {
      query.assignedTo = assignedTo;
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { locationDescription: { $regex: search, $options: 'i' } },
      ];
    }
    
    // Build sort
    const sort: any = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    // Execute queries
    const [events, total] = await Promise.all([
      Event.find(query)
        .populate('eventTypeId', 'name color icon')
        .populate('createdBy', 'firstName lastName email')
        .populate('assignedTo', 'firstName lastName email')
        .sort(sort)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      Event.countDocuments(query),
    ]);
    
    return {
      events,
      total,
      page,
      pageSize,
    };
  }
  
  /**
   * Get single event by ID
   */
  static async getEventById(
    eventId: string,
    companyId: mongoose.Types.ObjectId
  ): Promise<IEvent> {
    const event = await Event.findOne({
      _id: eventId,
      companyId,
    })
      .populate('eventTypeId', 'name color icon')
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .populate({
        path: 'reportIds',
        select: 'title type status createdAt reportedBy',
        populate: {
          path: 'reportedBy',
          select: 'firstName lastName email',
        },
      });
    
    if (!event) {
      throw new AppError('EVENT_NOT_FOUND', 'Event not found', 404);
    }
    
    return event;
  }
  
  /**
   * Update event
   */
  static async updateEvent(
    eventId: string,
    data: UpdateEventData,
    companyId: mongoose.Types.ObjectId,
    updatedById: mongoose.Types.ObjectId,
    correlationId: string
  ): Promise<IEvent> {
    const event = await Event.findOne({
      _id: eventId,
      companyId,
    });
    
    if (!event) {
      throw new AppError('EVENT_NOT_FOUND', 'Event not found', 404);
    }
    
    // Validate event type if provided
    if (data.eventTypeId) {
      const eventType = await EventType.findOne({
        _id: data.eventTypeId,
        $or: [
          { isSystemDefault: true },
          { companyId }
        ],
        isActive: true,
      });
      
      if (!eventType) {
        throw new AppError('EVENT_TYPE_NOT_FOUND', 'Invalid event type: Event type not found or not available to company', 400);
      }
    }
    
    // Store original values for audit
    const originalValues = {
      title: event.title,
      description: event.description,
      priority: event.priority,
      eventTypeId: event.eventTypeId,
    };
    
    // Update fields
    Object.assign(event, data);
    await event.save();
    
    // Create audit log with changed fields
    const changedFields: any = {};
    Object.keys(data).forEach(key => {
      if (originalValues.hasOwnProperty(key) && originalValues[key] !== data[key]) {
        changedFields[key] = {
          from: originalValues[key],
          to: data[key],
        };
      }
    });
    
    await AuditLog.create({
      action: AuditAction.EVENT_UPDATED,
      entityType: 'Event',
      entityId: event._id,
      companyId,
      userId: updatedById,
      details: {
        changes: changedFields,
      },
      correlationId,
    });
    
    return this.getEventById(eventId, companyId);
  }
  
  /**
   * Update event status (lifecycle management)
   */
  static async updateEventStatus(
    eventId: string,
    newStatus: EventStatus,
    companyId: mongoose.Types.ObjectId,
    updatedById: mongoose.Types.ObjectId,
    correlationId: string
  ): Promise<IEvent> {
    const event = await Event.findOne({
      _id: eventId,
      companyId,
    });
    
    if (!event) {
      throw new AppError('EVENT_NOT_FOUND', 'Event not found', 404);
    }
    
    const oldStatus = event.status;
    
    if (oldStatus === newStatus) {
      return this.getEventById(eventId, companyId); // No change needed
    }
    
    // Update status (pre-save hook will validate state transition)
    event.status = newStatus;
    
    try {
      await event.save();
    } catch (error: any) {
      if (error.name === 'ValidationError' && error.message.includes('Invalid status transition')) {
        throw new AppError('INVALID_STATE_TRANSITION', error.message, 400);
      }
      throw error;
    }
    
    // Create audit log
    await AuditLog.create({
      action: AuditAction.EVENT_STATUS_CHANGED,
      entityType: 'Event',
      entityId: event._id,
      companyId,
      userId: updatedById,
      details: {
        statusTransition: {
          from: oldStatus,
          to: newStatus,
        },
      },
      correlationId,
    });
    
    return this.getEventById(eventId, companyId);
  }
  
  /**
   * Link report to event
   */
  static async linkReport(
    eventId: string,
    reportId: string,
    companyId: mongoose.Types.ObjectId,
    updatedById: mongoose.Types.ObjectId,
    correlationId: string
  ): Promise<IEvent> {
    const [event, report] = await Promise.all([
      Event.findOne({ _id: eventId, companyId }),
      Report.findOne({ _id: reportId, companyId }),
    ]);
    
    if (!event) {
      throw new AppError('EVENT_NOT_FOUND', 'Event not found', 404);
    }
    
    if (!report) {
      throw new AppError('REPORT_NOT_FOUND', 'Report not found', 404);
    }
    
    // Check if already linked
    if (event.reportIds.includes(report._id)) {
      throw new AppError('INVALID_STATE_TRANSITION', 'Report is already linked to this event', 400);
    }
    
    // Add report to event
    event.reportIds.push(report._id);
    await event.save();
    
    // Create audit log
    await AuditLog.create({
      action: AuditAction.REPORT_LINKED_TO_EVENT,
      entityType: 'Event',
      entityId: event._id,
      companyId,
      userId: updatedById,
      details: {
        reportId: report._id,
        reportTitle: report.title,
        linkCount: event.reportIds.length,
      },
      correlationId,
    });
    
    return this.getEventById(eventId, companyId);
  }
  
  /**
   * Unlink report from event
   */
  static async unlinkReport(
    eventId: string,
    reportId: string,
    companyId: mongoose.Types.ObjectId,
    updatedById: mongoose.Types.ObjectId,
    correlationId: string
  ): Promise<IEvent> {
    const [event, report] = await Promise.all([
      Event.findOne({ _id: eventId, companyId }),
      Report.findOne({ _id: reportId, companyId }),
    ]);
    
    if (!event) {
      throw new AppError('EVENT_NOT_FOUND', 'Event not found', 404);
    }
    
    if (!report) {
      throw new AppError('REPORT_NOT_FOUND', 'Report not found', 404);
    }
    
    // Check if linked
    const reportIndex = event.reportIds.indexOf(report._id);
    if (reportIndex === -1) {
      throw new AppError('INVALID_STATE_TRANSITION', 'Report is not linked to this event', 400);
    }
    
    // Remove report from event
    event.reportIds.splice(reportIndex, 1);
    await event.save();
    
    // Create audit log
    await AuditLog.create({
      action: AuditAction.REPORT_UNLINKED_FROM_EVENT,
      entityType: 'Event',
      entityId: event._id,
      companyId,
      userId: updatedById,
      details: {
        reportId: report._id,
        reportTitle: report.title,
        linkCount: event.reportIds.length,
      },
      correlationId,
    });
    
    return this.getEventById(eventId, companyId);
  }
  
  /**
   * Get events near a location (geospatial query)
   * Used for mobile API and map views
   */
  static async getEventsNearLocation(
    companyId: mongoose.Types.ObjectId,
    longitude: number,
    latitude: number,
    maxDistanceMeters: number = 1000,
    limit: number = 50
  ): Promise<IEvent[]> {
    return Event.find({
      companyId,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          $maxDistance: maxDistanceMeters,
        },
      },
    })
      .populate('eventTypeId', 'name color icon')
      .limit(limit)
      .lean();
  }
}
