import mongoose, { Schema, Document } from 'mongoose';

/**
 * Audit Log Actions
 */
export enum AuditAction {
  // Auth actions
  USER_REGISTERED = 'user.registered',
  USER_LOGIN = 'user.login',
  USER_LOGIN_FAILED = 'user.login.failed',
  USER_LOGOUT = 'user.logout',
  USER_PASSWORD_CHANGED = 'user.password.changed',
  USER_PASSWORD_RESET_REQUESTED = 'user.password.reset.requested',
  USER_PASSWORD_RESET_COMPLETED = 'user.password.reset.completed',
  USER_ACCOUNT_LOCKED = 'user.account.locked',
  USER_ACCOUNT_UNLOCKED = 'user.account.unlocked',
  USER_ROLE_CHANGED = 'user.role.changed',
  
  // Company actions
  COMPANY_CREATED = 'company.created',
  COMPANY_UPDATED = 'company.updated',
  COMPANY_SETTINGS_CHANGED = 'company.settings.changed',
  COMPANY_API_KEY_REGENERATED = 'company.apikey.regenerated',
  
  // User management actions
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  USER_ACTIVATED = 'user.activated',
  USER_DEACTIVATED = 'user.deactivated',
  
  // Event actions
  EVENT_CREATED = 'event.created',
  EVENT_UPDATED = 'event.updated',
  EVENT_STATUS_CHANGED = 'event.status.changed',
  EVENT_ASSIGNED = 'event.assigned',
  EVENT_RESOLVED = 'event.resolved',
  EVENT_CLOSED = 'event.closed',
  
  // Event type actions
  EVENT_TYPE_CREATED = 'event_type.created',
  EVENT_TYPE_UPDATED = 'event_type.updated',
  EVENT_TYPE_DELETED = 'event_type.deleted',
  
  // Report actions
  REPORT_CREATED = 'report.created',
  REPORT_UPDATED = 'report.updated',
  REPORT_LINKED_TO_EVENT = 'report.linked',
  REPORT_UNLINKED_FROM_EVENT = 'report.unlinked',
  REPORT_VERIFIED = 'report.verified',
  REPORT_REJECTED = 'report.rejected',
  
  // Camera actions
  CAMERA_REGISTERED = 'camera.registered',
  CAMERA_UPDATED = 'camera.updated',
  CAMERA_DEACTIVATED = 'camera.deactivated',
  CAMERA_STATUS_CHANGED = 'camera.status.changed',
}

/**
 * Audit Log Interface
 */
export interface IAuditLog extends Document {
  action: AuditAction;
  companyId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId; // User who performed the action (null for system actions)
  resourceType: string; // 'User', 'Event', 'Report', 'Camera', 'Company'
  resourceId?: mongoose.Types.ObjectId; // ID of the affected resource
  
  // Context data
  changes?: Record<string, any>; // Before/after values for updates
  metadata?: Record<string, any>; // Additional context
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string; // Request tracing
  
  // Timestamp
  timestamp: Date;
}

/**
 * Audit Log Schema
 */
const auditLogSchema = new Schema<IAuditLog>(
  {
    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: [true, 'Action is required'],
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required for multi-tenant isolation'],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    resourceType: {
      type: String,
      required: [true, 'Resource type is required'],
      index: true,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      index: true,
    },
    changes: {
      type: Schema.Types.Mixed,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    correlationId: {
      type: String,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
  },
  {
    timestamps: false, // We use custom timestamp field
  }
);

/**
 * Compound indexes for common queries
 */
auditLogSchema.index({ companyId: 1, timestamp: -1 });
auditLogSchema.index({ companyId: 1, resourceType: 1, resourceId: 1 });
auditLogSchema.index({ companyId: 1, userId: 1, timestamp: -1 });
auditLogSchema.index({ companyId: 1, action: 1, timestamp: -1 });

/**
 * Audit logs are immutable - prevent updates and deletes
 */
auditLogSchema.pre('updateOne', function (next) {
  next(new Error('Audit logs are immutable and cannot be updated'));
});

auditLogSchema.pre('deleteOne', function (next) {
  next(new Error('Audit logs are immutable and cannot be deleted'));
});

auditLogSchema.pre('findOneAndUpdate', function (next) {
  next(new Error('Audit logs are immutable and cannot be updated'));
});

auditLogSchema.pre('findOneAndDelete', function (next) {
  next(new Error('Audit logs are immutable and cannot be deleted'));
});

/**
 * Audit Log Model
 */
export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
