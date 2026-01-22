import mongoose, { Schema, Document } from 'mongoose';

/**
 * Event Type Source
 * Tracks how the event type was created
 */
export enum EventTypeSource {
  SYSTEM = 'system',           // Built-in system defaults
  MANUAL = 'manual',           // Manually created by admin
  AUTO_REPORT = 'auto-report', // Auto-created from report
}

/**
 * Event Type Interface
 */
export interface IEventType extends Document {
  name: string;
  description?: string;
  color: string; // Hex color for UI display
  icon?: string; // Icon identifier for UI
  
  // Hierarchy support
  parentTypeId?: mongoose.Types.ObjectId; // Reference to parent type (null for top-level)
  hierarchyPath: string[]; // Array of ancestor IDs for efficient querying (e.g., ['fire', 'fire.building'])
  
  // Multi-tenant isolation
  companyId?: mongoose.Types.ObjectId; // null for system defaults
  
  // System management
  isSystemDefault: boolean; // true for built-in types, false for company-specific
  isActive: boolean; // soft delete flag
  source: EventTypeSource; // How this type was created
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Audit trail helpers
  getAuditContext(): any;
}

/**
 * System Default Event Types with Hierarchy
 * These are created automatically and available to all companies
 */
export const SYSTEM_EVENT_TYPES = [
  // Security parent type
  {
    name: 'Security',
    description: 'Security-related incidents',
    color: '#DC2626', // red-600
    icon: 'shield-exclamation',
    parentTypeId: null,
  },
  {
    name: 'Intrusion',
    description: 'Unauthorized entry or access',
    color: '#DC2626',
    icon: 'door-open',
    parentType: 'Security',
  },
  {
    name: 'Assault',
    description: 'Physical assault or violence',
    color: '#DC2626',
    icon: 'hand-fist',
    parentType: 'Security',
  },
  
  // Medical parent type
  {
    name: 'Medical',
    description: 'Medical emergencies',
    color: '#DC2626', // red-600
    icon: 'heart-pulse',
    parentTypeId: null,
  },
  {
    name: 'Cardiac Emergency',
    description: 'Heart-related medical emergency',
    color: '#DC2626',
    icon: 'heart-pulse',
    parentType: 'Medical',
  },
  {
    name: 'Injury',
    description: 'Physical injury requiring medical attention',
    color: '#DC2626',
    icon: 'bandage',
    parentType: 'Medical',
  },
  
  // Fire parent type
  {
    name: 'Fire',
    description: 'Fire-related incidents',
    color: '#EA580C', // orange-600
    icon: 'fire',
    parentTypeId: null,
  },
  {
    name: 'Building Fire',
    description: 'Fire in a building structure',
    color: '#EA580C',
    icon: 'building',
    parentType: 'Fire',
  },
  {
    name: 'Vehicle Fire',
    description: 'Vehicle on fire',
    color: '#EA580C',
    icon: 'car',
    parentType: 'Fire',
  },
  {
    name: 'Forest Fire',
    description: 'Wildfire or forest fire',
    color: '#EA580C',
    icon: 'tree',
    parentType: 'Fire',
  },
  
  // Property Crime parent type
  {
    name: 'Property Crime',
    description: 'Theft, burglary, and property damage',
    color: '#7C2D12', // amber-800
    icon: 'hand-grab',
    parentTypeId: null,
  },
  {
    name: 'Theft',
    description: 'Theft and burglary incidents',
    color: '#7C2D12',
    icon: 'hand-grab',
    parentType: 'Property Crime',
  },
  {
    name: 'Vandalism',
    description: 'Property damage and vandalism',
    color: '#7C2D12',
    icon: 'hammer',
    parentType: 'Property Crime',
  },
  {
    name: 'Burglary',
    description: 'Break-in and burglary',
    color: '#7C2D12',
    icon: 'door-closed',
    parentType: 'Property Crime',
  },
  
  // Traffic parent type
  {
    name: 'Traffic',
    description: 'Vehicle accidents and traffic incidents',
    color: '#2563EB', // blue-600
    icon: 'car-crash',
    parentTypeId: null,
  },
  {
    name: 'Vehicle Accident',
    description: 'Motor vehicle collision',
    color: '#2563EB',
    icon: 'car-crash',
    parentType: 'Traffic',
  },
  {
    name: 'Traffic Obstruction',
    description: 'Road blockage or traffic disruption',
    color: '#2563EB',
    icon: 'road-barrier',
    parentType: 'Traffic',
  },
  
  // Suspicious Activity parent type
  {
    name: 'Suspicious Activity',
    description: 'Suspicious behavior requiring investigation',
    color: '#D97706', // amber-600
    icon: 'eye',
    parentTypeId: null,
  },
  {
    name: 'Loitering',
    description: 'Suspicious loitering or lingering',
    color: '#D97706',
    icon: 'person-walking',
    parentType: 'Suspicious Activity',
  },
  
  // General parent type
  {
    name: 'General',
    description: 'Other incidents',
    color: '#6B7280', // gray-500
    icon: 'exclamation-triangle',
    parentTypeId: null,
  },
  {
    name: 'Other',
    description: 'Incident not covered by other categories',
    color: '#6B7280',
    icon: 'question',
    parentType: 'General',
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
  
  // Hierarchy support
  parentTypeId: {
    type: Schema.Types.ObjectId,
    ref: 'EventType',
    default: null,
    index: true,
  },
  hierarchyPath: {
    type: [String],
    default: [],
    index: true,
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
  source: {
    type: String,
    enum: Object.values(EventTypeSource),
    default: EventTypeSource.MANUAL,
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