import mongoose from 'mongoose';
import { EventType, IEventType, SYSTEM_EVENT_TYPES, EventTypeSource } from '../models/event-type.model';
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
      throw new AppError('EVENT_TYPE_NOT_FOUND', 'Event type not found', 404);
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
      throw new AppError('VALIDATION_ERROR', `An event type with name "${data.name}" already exists`, 400);
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
      resourceType: 'EventType',
      resourceId: eventType._id,
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
      throw new AppError('EVENT_TYPE_NOT_FOUND', 'Event type not found or cannot be updated', 404);
    }
    
    if (eventType.isSystemDefault) {
      throw new AppError('VALIDATION_ERROR', 'System default event types cannot be updated', 400);
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
        throw new AppError('VALIDATION_ERROR', `An event type with name "${data.name}" already exists`, 400);
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
    Object.keys(data).forEach((key) => {
      if (originalValues.hasOwnProperty(key) && (originalValues as any)[key] !== (data as any)[key]) {
        changedFields[key] = {
          from: (originalValues as any)[key],
          to: (data as any)[key],
        };
      }
    });
    
    await AuditLog.create({
      action: AuditAction.EVENT_TYPE_UPDATED,
      resourceType: 'EventType',
      resourceId: eventType._id,
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
  ): Promise<IEventType> {
    const eventType = await EventType.findOne({
      _id: eventTypeId,
      companyId, // Only company-specific types can be deleted
      isActive: true,
    });
    
    if (!eventType) {
      throw new AppError('EVENT_TYPE_NOT_FOUND', 'Event type not found or cannot be deleted', 404);
    }
    
    if (eventType.isSystemDefault) {
      throw new AppError('VALIDATION_ERROR', 'System default event types cannot be deleted', 400);
    }
    
    // Soft delete
    eventType.isActive = false;
    await eventType.save();
    
    // Create audit log
    await AuditLog.create({
      action: AuditAction.EVENT_TYPE_DELETED,
      resourceType: 'EventType',
      resourceId: eventType._id,
      companyId,
      userId: deletedById,
      details: {
        name: eventType.name,
      },
      correlationId,
    });
    
    return eventType;
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
    
    // First, create parent types
    const parentTypes: Map<string, IEventType> = new Map();
    
    for (const typeData of SYSTEM_EVENT_TYPES) {
      if (!('parentType' in typeData)) {
        // This is a parent type
        const hierarchyPath = [typeData.name.toLowerCase().replace(/\s+/g, '-')];
        const eventType = new EventType({
          name: typeData.name,
          description: typeData.description,
          color: typeData.color,
          icon: typeData.icon,
          isSystemDefault: true,
          isActive: true,
          source: EventTypeSource.SYSTEM,
          parentTypeId: null,
          hierarchyPath,
        });
        await eventType.save();
        parentTypes.set(typeData.name, eventType);
      }
    }
    
    // Then, create child types
    for (const typeData of SYSTEM_EVENT_TYPES) {
      if ('parentType' in typeData) {
        // This is a child type
        const parent = parentTypes.get(typeData.parentType);
        if (parent) {
          const hierarchyPath = [
            ...parent.hierarchyPath,
            `${parent.hierarchyPath[0]}.${typeData.name.toLowerCase().replace(/\s+/g, '-')}`
          ];
          
          const eventType = new EventType({
            name: typeData.name,
            description: typeData.description,
            color: typeData.color,
            icon: typeData.icon,
            isSystemDefault: true,
            isActive: true,
            source: EventTypeSource.SYSTEM,
            parentTypeId: parent._id,
            hierarchyPath,
          });
          await eventType.save();
        }
      }
    }
    
    console.log(`✓ Seeded ${SYSTEM_EVENT_TYPES.length} system default event types with hierarchy`);
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
  
  /**
   * Find or create event type by name with hierarchy support
   * Used for auto-creating types from reports
   * 
   * This method enables flexible event type creation from citizen reports.
   * When a report comes in with a type like "Building Fire", the system will:
   * 1. Parse the type name to identify parent and child (e.g., "Fire" parent, "Building Fire" child)
   * 2. Find or create the parent type if needed
   * 3. Find or create the child type with proper hierarchy
   * 4. Return the event type ID for use in event creation
   * 
   * See /utils/event-type-parser.ts for type parsing logic.
   * 
   * @param typeName - Name of the type (e.g., "Building Fire" or "Fire")
   * @param parentTypeName - Optional parent type name (e.g., "Fire")
   * @param companyId - Company ID for multi-tenant isolation
   * @param source - Source of type creation (default: AUTO_REPORT)
   * @returns Event type ID
   */
  static async findOrCreateType(
    typeName: string,
    parentTypeName: string | null,
    companyId: mongoose.Types.ObjectId,
    source: EventTypeSource = EventTypeSource.AUTO_REPORT
  ): Promise<string> {
    // Normalize names (trim, capitalize first letter)
    const normalizedName = typeName.trim().replace(/\b\w/g, l => l.toUpperCase());
    const normalizedParentName = parentTypeName?.trim().replace(/\b\w/g, l => l.toUpperCase()) || null;
    
    // First, try to find exact match (case-insensitive)
    let eventType = await EventType.findOne({
      name: { $regex: new RegExp(`^${normalizedName}$`, 'i') },
      $or: [
        { isSystemDefault: true },
        { companyId }
      ],
      isActive: true,
    });
    
    if (eventType) {
      return eventType._id.toString();
    }
    
    // If not found and has parent, handle parent-child relationship
    let parentType: IEventType | null = null;
    if (normalizedParentName) {
      // Find or create parent type first
      parentType = await EventType.findOne({
        name: { $regex: new RegExp(`^${normalizedParentName}$`, 'i') },
        parentTypeId: null, // Parent types have no parent
        $or: [
          { isSystemDefault: true },
          { companyId }
        ],
        isActive: true,
      });
      
      // Create parent if doesn't exist
      if (!parentType) {
        const parentColor = this.getColorForCategory(normalizedParentName);
        parentType = new EventType({
          name: normalizedParentName,
          description: `Auto-created parent type: ${normalizedParentName}`,
          color: parentColor,
          icon: this.getIconForCategory(normalizedParentName),
          companyId,
          isSystemDefault: false,
          isActive: true,
          source,
          parentTypeId: null,
          hierarchyPath: [normalizedParentName.toLowerCase().replace(/\s+/g, '-')],
        });
        await parentType.save();
      }
    }
    
    // Create the new type (either standalone or as child)
    const hierarchyPath = parentType
      ? [...parentType.hierarchyPath, `${parentType.hierarchyPath[0]}.${normalizedName.toLowerCase().replace(/\s+/g, '-')}`]
      : [normalizedName.toLowerCase().replace(/\s+/g, '-')];
    
    const color = parentType ? parentType.color : this.getColorForCategory(normalizedName);
    
    eventType = new EventType({
      name: normalizedName,
      description: `Auto-created from report: ${normalizedName}`,
      color,
      icon: this.getIconForCategory(normalizedName),
      companyId,
      isSystemDefault: false,
      isActive: true,
      source,
      parentTypeId: parentType?._id || null,
      hierarchyPath,
    });
    
    await eventType.save();
    
    console.log(`✓ Auto-created event type: ${normalizedName}${parentType ? ` (parent: ${parentType.name})` : ''}`);
    
    return eventType._id.toString();
  }
  
  /**
   * Get color based on category name
   */
  private static getColorForCategory(categoryName: string): string {
    const name = categoryName.toLowerCase();
    
    if (name.includes('fire') || name.includes('explosion')) {
      return '#EA580C'; // orange-600
    } else if (name.includes('medical') || name.includes('health') || name.includes('injury')) {
      return '#DC2626'; // red-600
    } else if (name.includes('security') || name.includes('assault') || name.includes('intrusion')) {
      return '#DC2626'; // red-600
    } else if (name.includes('theft') || name.includes('burglary') || name.includes('vandalism') || name.includes('property')) {
      return '#7C2D12'; // amber-800
    } else if (name.includes('traffic') || name.includes('accident') || name.includes('vehicle')) {
      return '#2563EB'; // blue-600
    } else if (name.includes('suspicious')) {
      return '#D97706'; // amber-600
    } else {
      return '#6B7280'; // gray-500 (default)
    }
  }
  
  /**
   * Get icon based on category name
   */
  private static getIconForCategory(categoryName: string): string {
    const name = categoryName.toLowerCase();
    
    if (name.includes('fire')) return 'fire';
    if (name.includes('medical') || name.includes('health')) return 'heart-pulse';
    if (name.includes('security')) return 'shield-exclamation';
    if (name.includes('theft')) return 'hand-grab';
    if (name.includes('vandalism')) return 'hammer';
    if (name.includes('traffic') || name.includes('vehicle')) return 'car-crash';
    if (name.includes('suspicious')) return 'eye';
    
    return 'exclamation-triangle'; // default
  }
  
  /**
   * Get event types as tree structure with children
   */
  static async getEventTypesTree(
    companyId: mongoose.Types.ObjectId
  ): Promise<any[]> {
    // Get all available types
    const allTypes = await EventType.find({
      $or: [
        { isSystemDefault: true },
        { companyId }
      ],
      isActive: true,
    }).sort({ name: 1 });
    
    // Build tree structure
    const typeMap = new Map<string, any>();
    const rootTypes: any[] = [];
    
    // First pass: create map of all types
    allTypes.forEach(type => {
      typeMap.set(type._id.toString(), {
        _id: type._id,
        name: type.name,
        description: type.description,
        color: type.color,
        icon: type.icon,
        parentTypeId: type.parentTypeId,
        hierarchyPath: type.hierarchyPath,
        isSystemDefault: type.isSystemDefault,
        source: type.source,
        children: [],
      });
    });
    
    // Second pass: build hierarchy
    typeMap.forEach(type => {
      if (type.parentTypeId) {
        const parent = typeMap.get(type.parentTypeId.toString());
        if (parent) {
          parent.children.push(type);
        } else {
          rootTypes.push(type); // Orphaned child becomes root
        }
      } else {
        rootTypes.push(type);
      }
    });
    
    return rootTypes;
  }
}