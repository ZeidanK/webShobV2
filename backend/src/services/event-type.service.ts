import mongoose from 'mongoose';
import { EventType, IEventType, SYSTEM_EVENT_TYPES } from '../models/event-type.model';
import { AuditLog, AuditAction } from '../models/audit-log.model';
import { AppError } from '../utils/errors';

/**
 * EventType Creation Data
 */
export interface CreateEventTypeData {
  name: string;
  description?: string;
  color: string;
  icon?: string;
}

/**
 * EventType Update Data
 */
export interface UpdateEventTypeData {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
}

/**
 * EventType Service
 * Handles event type CRUD operations and system defaults
 */
export class EventTypeService {
  
  /**
   * Get available event types for a company
   * Returns both system defaults and company-specific types
   */
  static async getAvailableEventTypes(
    companyId: mongoose.Types.ObjectId
  ): Promise<IEventType[]> {
    return EventType.find({
      $or: [
        { isSystemDefault: true },
        { companyId }
      ],
      isActive: true,
    }).sort({ isSystemDefault: -1, name: 1 }); // System defaults first, then alphabetical
  }
  
  /**
   * Get company-specific event types only
   */
  static async getCompanyEventTypes(
    companyId: mongoose.Types.ObjectId
  ): Promise<IEventType[]> {
    return EventType.find({
      companyId,
      isActive: true,
    }).sort({ name: 1 });
  }
  
  /**
   * Get single event type by ID
   */
  static async getEventTypeById(
    eventTypeId: string,
    companyId: mongoose.Types.ObjectId
  ): Promise<IEventType> {
    const eventType = await EventType.findOne({
      _id: eventTypeId,
      $or: [
        { isSystemDefault: true },
        { companyId }
      ],
      isActive: true,
    });
    
    if (!eventType) {
      throw new NotFoundError('Event type not found');
    }
    
    return eventType;
  }
  
  /**
   * Create company-specific event type
   */
  static async createEventType(
    data: CreateEventTypeData,
    companyId: mongoose.Types.ObjectId,
    createdById: mongoose.Types.ObjectId,
    correlationId: string
  ): Promise<IEventType> {
    // Check for name conflicts within company scope (including system defaults)
    const existing = await EventType.findOne({
      name: { $regex: new RegExp(`^${data.name}$`, 'i') }, // Case-insensitive
      $or: [
        { isSystemDefault: true },
        { companyId }
      ],
      isActive: true,
    });
    
    if (existing) {
      throw new ValidationError('Event type name already exists', {
        name: `An event type with name "${data.name}" already exists`,
      });
    }
    
    // Create event type
    const eventType = new EventType({
      name: data.name,
      description: data.description,
      color: data.color,
      icon: data.icon,
      companyId,
      isSystemDefault: false,
      isActive: true,
    });
    
    await eventType.save();
    
    // Create audit log
    await AuditLog.create({
      action: AuditAction.EVENT_TYPE_CREATED,
      entityType: 'EventType',
      entityId: eventType._id,
      companyId,
      userId: createdById,
      details: {
        name: eventType.name,
        color: eventType.color,
      },
      correlationId,
    });
    
    return eventType;
  }
  
  /**
   * Update company-specific event type
   */
  static async updateEventType(
    eventTypeId: string,
    data: UpdateEventTypeData,
    companyId: mongoose.Types.ObjectId,
    updatedById: mongoose.Types.ObjectId,
    correlationId: string
  ): Promise<IEventType> {
    const eventType = await EventType.findOne({
      _id: eventTypeId,
      companyId, // Only company-specific types can be updated
      isActive: true,
    });
    
    if (!eventType) {
      throw new NotFoundError('Event type not found or cannot be updated');
    }
    
    if (eventType.isSystemDefault) {
      throw new ValidationError('System default event types cannot be updated', {
        eventTypeId: 'Cannot modify system default event types',
      });
    }
    
    // Check for name conflicts if name is being changed
    if (data.name && data.name !== eventType.name) {
      const existing = await EventType.findOne({
        _id: { $ne: eventTypeId },
        name: { $regex: new RegExp(`^${data.name}$`, 'i') },
        $or: [
          { isSystemDefault: true },
          { companyId }
        ],
        isActive: true,
      });
      
      if (existing) {
        throw new ValidationError('Event type name already exists', {
          name: `An event type with name "${data.name}" already exists`,
        });
      }
    }
    
    // Store original values for audit
    const originalValues = {
      name: eventType.name,
      description: eventType.description,
      color: eventType.color,
      icon: eventType.icon,
      isActive: eventType.isActive,
    };
    
    // Update fields
    Object.assign(eventType, data);
    await eventType.save();
    
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
      action: AuditAction.EVENT_TYPE_UPDATED,
      entityType: 'EventType',
      entityId: eventType._id,
      companyId,
      userId: updatedById,
      details: {
        changes: changedFields,
      },
      correlationId,
    });
    
    return eventType;
  }
  
  /**
   * Soft delete company-specific event type
   */
  static async deleteEventType(
    eventTypeId: string,
    companyId: mongoose.Types.ObjectId,
    deletedById: mongoose.Types.ObjectId,
    correlationId: string
  ): Promise<void> {
    const eventType = await EventType.findOne({
      _id: eventTypeId,
      companyId, // Only company-specific types can be deleted
      isActive: true,
    });
    
    if (!eventType) {
      throw new NotFoundError('Event type not found or cannot be deleted');
    }
    
    if (eventType.isSystemDefault) {
      throw new ValidationError('System default event types cannot be deleted', {
        eventTypeId: 'Cannot delete system default event types',
      });
    }
    
    // Soft delete
    eventType.isActive = false;
    await eventType.save();
    
    // Create audit log
    await AuditLog.create({
      action: AuditAction.EVENT_TYPE_DELETED,
      entityType: 'EventType',
      entityId: eventType._id,
      companyId,
      userId: deletedById,
      details: {
        name: eventType.name,
      },
      correlationId,
    });
  }
  
  /**
   * Seed system default event types
   * Should be called during application startup
   */
  static async seedSystemDefaults(): Promise<void> {
    const existingCount = await EventType.countDocuments({ isSystemDefault: true });
    if (existingCount > 0) {
      return; // Already seeded
    }
    
    const systemTypes = SYSTEM_EVENT_TYPES.map(type => ({
      ...type,
      isSystemDefault: true,
      isActive: true,
    }));
    
    await EventType.insertMany(systemTypes);
    console.log(`✓ Seeded ${systemTypes.length} system default event types`);
  }
  
  /**
   * Get system default event types
   */
  static async getSystemDefaults(): Promise<IEventType[]> {
    return EventType.find({
      isSystemDefault: true,
      isActive: true,
    }).sort({ name: 1 });
  }
}