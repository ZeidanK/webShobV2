import mongoose, { Schema, Document } from 'mongoose';
import { ILocation } from './report.model';

/**
 * Event Status Lifecycle
 * State machine for event progression:
 * created → active → assigned → resolved → closed
 */
export enum EventStatus {
  CREATED = 'created',     // Event manually created by operator
  ACTIVE = 'active',       // Event confirmed and active
  ASSIGNED = 'assigned',   // Event assigned to responder (future slice)
  RESOLVED = 'resolved',   // Incident resolved, awaiting closure
  CLOSED = 'closed',       // Event permanently closed
}

/**
 * Event Priority Levels
 */
export enum EventPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Event Interface
 */
export interface IEvent extends Document {
  title: string;
  description: string;
  
  // Multi-tenant isolation
  companyId: mongoose.Types.ObjectId;
  
  // Event metadata
  eventTypeId: mongoose.Types.ObjectId;
  status: EventStatus;
  priority: EventPriority;
  
  // Location (GeoJSON format for MongoDB geospatial queries)
  location: ILocation;
  locationDescription?: string; // Human-readable address/landmark
  
  // Event management
  createdBy: mongoose.Types.ObjectId; // Operator who created the event
  assignedTo?: mongoose.Types.ObjectId; // User assigned to handle (future)
  
  // Linked reports
  reportIds: mongoose.Types.ObjectId[]; // Reports linked to this event
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  
  // Audit trail helpers
  getAuditContext(): any;
}

/**
 * Event Schema
 */
const EventSchema = new Schema<IEvent>({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
    maxlength: [200, 'Event title cannot exceed 200 characters'],
  },
  description: {
    type: String,
    required: [true, 'Event description is required'],
    trim: true,
    maxlength: [2000, 'Event description cannot exceed 2000 characters'],
  },
  
  // Multi-tenant isolation
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    required: [true, 'CompanyId is required'],
    index: true, // Critical for performance on tenant queries
  },
  
  // Event metadata
  eventTypeId: {
    type: Schema.Types.ObjectId,
    ref: 'EventType',
    required: [true, 'Event type is required'],
  },
  status: {
    type: String,
    enum: Object.values(EventStatus),
    default: EventStatus.CREATED,
    required: true,
  },
  priority: {
    type: String,
    enum: Object.values(EventPriority),
    default: EventPriority.MEDIUM,
    required: true,
  },
  
  // Location (GeoJSON for geospatial queries)
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: function(coords: number[]) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 &&  // longitude
                 coords[1] >= -90 && coords[1] <= 90;      // latitude
        },
        message: 'Invalid coordinates. Must be [longitude, latitude] within valid ranges.',
      },
    },
  },
  locationDescription: {
    type: String,
    trim: true,
    maxlength: [500, 'Location description cannot exceed 500 characters'],
  },
  
  // Event management
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'CreatedBy is required'],
  },
  assignedTo: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  
  // Linked reports
  reportIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Report',
  }],
  
  // Timestamps
  resolvedAt: {
    type: Date,
    default: null,
  },
  closedAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  collection: 'events',
});

// Compound index for efficient company-scoped queries
EventSchema.index({ companyId: 1, status: 1 });
EventSchema.index({ companyId: 1, createdAt: -1 });
EventSchema.index({ companyId: 1, priority: 1 });

/**
 * State Machine Validation
 * Ensures valid status transitions
 */
EventSchema.pre('save', function(next) {
  if (!this.isModified('status')) return next();
  
  const validTransitions: Record<EventStatus, EventStatus[]> = {
    [EventStatus.CREATED]: [EventStatus.ACTIVE, EventStatus.CLOSED],
    [EventStatus.ACTIVE]: [EventStatus.ASSIGNED, EventStatus.RESOLVED, EventStatus.CLOSED],
    [EventStatus.ASSIGNED]: [EventStatus.RESOLVED, EventStatus.CLOSED],
    [EventStatus.RESOLVED]: [EventStatus.CLOSED, EventStatus.ACTIVE], // Can reopen
    [EventStatus.CLOSED]: [], // Terminal state
  };
  
  if (this.isNew) return next(); // New documents can start with any initial status
  
  const originalDoc = (this.constructor as any).findById(this._id).exec();
  originalDoc.then((doc: any) => {
    if (!doc) return next();
    
    const oldStatus = doc.status;
    const newStatus = this.status;
    
    if (oldStatus === newStatus) return next();
    
    const allowed = validTransitions[oldStatus as EventStatus] || [];
    if (!allowed.includes(newStatus)) {
      const error = new Error(`Invalid status transition from ${oldStatus} to ${newStatus}`);
      error.name = 'ValidationError';
      return next(error);
    }
    
    // Update timestamp fields based on status
    const now = new Date();
    switch (newStatus) {
      case EventStatus.RESOLVED:
        this.resolvedAt = now;
        break;
      case EventStatus.CLOSED:
        this.closedAt = now;
        break;
      case EventStatus.ACTIVE:
        // If reopening from resolved, clear resolvedAt
        if (oldStatus === EventStatus.RESOLVED) {
          this.resolvedAt = undefined;
        }
        break;
    }
    
    next();
  }).catch(next);
});

/**
 * Instance method: Get audit context for logging
 */
EventSchema.methods.getAuditContext = function(): any {
  return {
    entityType: 'Event',
    entityId: this._id,
    companyId: this.companyId,
    title: this.title,
    status: this.status,
  };
};

// Add geospatial index for location-based queries
EventSchema.index({ location: '2dsphere' });

/**
 * Virtual for linkedReports (alias for reportIds)
 * Used by frontend for consistency
 */
EventSchema.virtual('linkedReports').get(function() {
  return this.reportIds;
});

// Ensure virtuals are included in toJSON
EventSchema.set('toJSON', { virtuals: true });
EventSchema.set('toObject', { virtuals: true });

/**
 * Export the model
 */
export const Event = mongoose.model<IEvent>('Event', EventSchema);