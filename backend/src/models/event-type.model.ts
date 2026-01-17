import mongoose, { Schema, Document } from 'mongoose';

/**
 * Event Type Interface
 */
export interface IEventType extends Document {
  name: string;
  description?: string;
  color: string; // Hex color for UI display
  icon?: string; // Icon identifier for UI
  
  // Multi-tenant isolation
  companyId?: mongoose.Types.ObjectId; // null for system defaults
  
  // System management
  isSystemDefault: boolean; // true for built-in types, false for company-specific
  isActive: boolean; // soft delete flag
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Audit trail helpers
  getAuditContext(): any;
}

/**
 * System Default Event Types
 * These are created automatically and available to all companies
 */
export const SYSTEM_EVENT_TYPES = [
  {
    name: 'Security Incident',
    description: 'General security-related incidents requiring attention',
    color: '#DC2626', // red-600
    icon: 'shield-exclamation',
  },
  {
    name: 'Medical Emergency',
    description: 'Medical emergencies requiring immediate response',
    color: '#DC2626', // red-600
    icon: 'heart-pulse',
  },
  {
    name: 'Fire Emergency',
    description: 'Fire-related incidents and alarms',
    color: '#EA580C', // orange-600
    icon: 'fire',
  },
  {
    name: 'Theft',
    description: 'Theft and burglary incidents',
    color: '#7C2D12', // amber-800
    icon: 'hand-grab',
  },
  {
    name: 'Vandalism',
    description: 'Property damage and vandalism',
    color: '#7C2D12', // amber-800
    icon: 'hammer',
  },
  {
    name: 'Suspicious Activity',
    description: 'Suspicious behavior requiring investigation',
    color: '#D97706', // amber-600
    icon: 'eye',
  },
  {
    name: 'Traffic Incident',
    description: 'Vehicle accidents and traffic disruptions',
    color: '#2563EB', // blue-600
    icon: 'car-crash',
  },
  {
    name: 'General Incident',
    description: 'Other incidents not covered by specific categories',
    color: '#6B7280', // gray-500
    icon: 'exclamation-triangle',
  },
] as const;

/**
 * EventType Schema
 */
const EventTypeSchema = new Schema<IEventType>({
  name: {
    type: String,
    required: [true, 'Event type name is required'],
    trim: true,
    maxlength: [100, 'Event type name cannot exceed 100 characters'],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Event type description cannot exceed 500 characters'],
  },
  color: {
    type: String,
    required: [true, 'Color is required'],
    match: [/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color (e.g., #FF0000)'],
  },
  icon: {
    type: String,
    trim: true,
    maxlength: [50, 'Icon identifier cannot exceed 50 characters'],
  },
  
  // Multi-tenant isolation
  companyId: {
    type: Schema.Types.ObjectId,
    ref: 'Company',
    default: null, // null for system defaults
    index: true,
  },
  
  // System management
  isSystemDefault: {
    type: Boolean,
    default: false,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    required: true,
  },
}, {
  timestamps: true,
  collection: 'event_types',
});

// Compound index for efficient queries
EventTypeSchema.index({ companyId: 1, isActive: 1 });
EventTypeSchema.index({ isSystemDefault: 1, isActive: 1 });

// Ensure unique names within company scope (including system defaults)
EventTypeSchema.index(
  { companyId: 1, name: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

/**
 * Pre-save validation
 */
EventTypeSchema.pre('save', function(next) {
  // System defaults cannot have companyId
  if (this.isSystemDefault && this.companyId) {
    return next(new Error('System default event types cannot have a companyId'));
  }
  
  // Company-specific types must have companyId
  if (!this.isSystemDefault && !this.companyId) {
    return next(new Error('Company-specific event types must have a companyId'));
  }
  
  next();
});

/**
 * Instance method: Get audit context for logging
 */
EventTypeSchema.methods.getAuditContext = function(): any {
  return {
    entityType: 'EventType',
    entityId: this._id,
    companyId: this.companyId,
    name: this.name,
    isSystemDefault: this.isSystemDefault,
  };
};

/**
 * Static method: Get available event types for a company
 * Returns both system defaults and company-specific types
 */
EventTypeSchema.statics.getAvailableForCompany = async function(companyId: mongoose.Types.ObjectId) {
  return this.find({
    $or: [
      { isSystemDefault: true },
      { companyId }
    ],
    isActive: true,
  }).sort({ isSystemDefault: -1, name: 1 }); // System defaults first, then alphabetical
};

/**
 * Static method: Seed system default event types
 * Called during application startup
 */
EventTypeSchema.statics.seedSystemDefaults = async function() {
  const existingCount = await this.countDocuments({ isSystemDefault: true });
  if (existingCount > 0) {
    return; // Already seeded
  }
  
  const systemTypes = SYSTEM_EVENT_TYPES.map(type => ({
    ...type,
    isSystemDefault: true,
    isActive: true,
  }));
  
  await this.insertMany(systemTypes);
  console.log(`Seeded ${systemTypes.length} system default event types`);
};

/**
 * Export the model
 */
export const EventType = mongoose.model<IEventType>('EventType', EventTypeSchema);