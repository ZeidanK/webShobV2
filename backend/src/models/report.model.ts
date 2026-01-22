import mongoose, { Schema, Document } from 'mongoose';

/**
 * Report Source Types
 * - citizen: User-submitted report via web/mobile
 * - camera: AI detection from camera (future)
 * - responder: First responder field submission (future)
 */
export enum ReportSource {
  CITIZEN = 'citizen',
  CAMERA = 'camera',
  RESPONDER = 'responder',
}

/**
 * Report Types
 */
export enum ReportType {
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  THEFT = 'theft',
  VANDALISM = 'vandalism',
  VIOLENCE = 'violence',
  FIRE = 'fire',
  MEDICAL_EMERGENCY = 'medical_emergency',
  TRAFFIC_INCIDENT = 'traffic_incident',
  OTHER = 'other',
}

/**
 * Report Status Lifecycle
 * - pending: Initial submission, awaiting operator review
 * - verified: Operator confirmed validity
 * - rejected: Operator rejected (false report, duplicate, etc.)
 */
export enum ReportStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

/**
 * Attachment Type
 */
export enum AttachmentType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
}

/**
 * Attachment Subdocument Interface
 */
export interface IAttachment {
  filename: string; // Original filename
  storagePath: string; // Relative path to stored file
  url: string; // Public URL to access the file
  mimeType: string; // e.g., 'image/jpeg', 'video/mp4'
  size: number; // File size in bytes
  type: AttachmentType; // Attachment category
  thumbnailUrl?: string; // For images/videos
  uploadedAt: Date;
}

/**
 * Location GeoJSON
 */
export interface ILocation {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

/**
 * Report Interface
 */
export interface IReport extends Document {
  title: string;
  description: string;
  type: string; // Allow any string for flexible report types (can match ReportType enum or custom types)
  source: ReportSource;
  status: ReportStatus;
  
  // Multi-tenant isolation
  companyId: mongoose.Types.ObjectId;
  
  // Location (GeoJSON format for MongoDB geospatial queries)
  location: ILocation;
  locationDescription?: string; // Human-readable address/landmark
  
  // Reporter information
  reportedBy: mongoose.Types.ObjectId; // User who submitted
  reporterName?: string; // Display name (for anonymity later)
  
  // Attachments
  attachments: IAttachment[];
  
  // Verification workflow
  verifiedBy?: mongoose.Types.ObjectId; // Operator who verified/rejected
  verifiedAt?: Date;
  rejectionReason?: string;
  
  // Event linkage (future slices)
  eventId?: mongoose.Types.ObjectId;
  
  // Audit fields
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Attachment Subdocument Schema
 */
const attachmentSchema = new Schema<IAttachment>(
  {
    filename: {
      type: String,
      required: true,
    },
    storagePath: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      enum: Object.values(AttachmentType),
      required: true,
    },
    thumbnailUrl: {
      type: String,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true } // Generate _id for each attachment
);

/**
 * Report Schema
 */
const reportSchema = new Schema<IReport>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    type: {
      type: String,
      required: [true, 'Report type is required'],
      trim: true,
      index: true,
    },
    source: {
      type: String,
      enum: Object.values(ReportSource),
      required: [true, 'Report source is required'],
      default: ReportSource.CITIZEN,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ReportStatus),
      default: ReportStatus.PENDING,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required'],
      index: true, // Critical for tenant isolation queries
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function (coords: number[]) {
            return (
              coords.length === 2 &&
              coords[0] >= -180 &&
              coords[0] <= 180 && // Longitude
              coords[1] >= -90 &&
              coords[1] <= 90 // Latitude
            );
          },
          message: 'Invalid coordinates. Format: [longitude, latitude]',
        },
      },
    },
    locationDescription: {
      type: String,
      trim: true,
      maxlength: [500, 'Location description cannot exceed 500 characters'],
    },
    reportedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter is required'],
      index: true,
    },
    reporterName: {
      type: String,
      trim: true,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
      validate: {
        validator: function (attachments: IAttachment[]) {
          return attachments.length <= 10; // Max 10 attachments per report
        },
        message: 'Cannot exceed 10 attachments per report',
      },
    },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    verifiedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
    },
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'Event',
      index: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/**
 * Indexes for query performance
 */
// Geospatial index for location-based queries
reportSchema.index({ location: '2dsphere' });

// Compound index for tenant-scoped queries
reportSchema.index({ companyId: 1, createdAt: -1 });
reportSchema.index({ companyId: 1, status: 1, createdAt: -1 });
reportSchema.index({ companyId: 1, type: 1, createdAt: -1 });
reportSchema.index({ companyId: 1, reportedBy: 1, createdAt: -1 });

/**
 * Virtual: Full reporter info (populated)
 */
reportSchema.virtual('reporter', {
  ref: 'User',
  localField: 'reportedBy',
  foreignField: '_id',
  justOne: true,
});

/**
 * Middleware: Prevent modification after verification/rejection (immutability)
 * Note: Reports should be immutable after verification/rejection, 
 * but we'll enforce this at the service layer for now.
 */

/**
 * Export Report Model
 */
export const Report = mongoose.model<IReport>('Report', reportSchema);
