/**
 * Camera Model
 * 
 * Represents a video source (IP camera, analog, USB, etc.) with optional VMS integration.
 * Cameras can be connected to a VMS server for live streaming and playback.
 * 
 * Multi-tenant: All queries MUST filter by companyId.
 */

import mongoose, { Document, Schema } from 'mongoose';
import { VmsProvider } from './vms-server.model';

/** Camera type options */
export type CameraType = 'ip' | 'analog' | 'usb';

/** Camera status options */
export type CameraStatus = 'online' | 'offline' | 'error' | 'maintenance';

/** TEST-ONLY: Stream configuration types for Phase 2 scaffolding. */
export type StreamConfigType = 'vms' | 'direct-rtsp';

/** Camera capability flags */
export interface CameraCapabilities {
  ptz?: boolean;
  audio?: boolean;
  motionDetection?: boolean;
}

/** Maintenance schedule metadata */
export interface CameraMaintenanceSchedule {
  intervalDays?: number;
  lastServiceAt?: Date;
  nextServiceAt?: Date;
  notes?: string;
}

/** Camera document interface */
export interface ICamera extends Document {
  /** Multi-tenant isolation */
  companyId: mongoose.Types.ObjectId;
  
  /** Camera name */
  name: string;
  
  /** Description of camera purpose/coverage */
  description?: string;
  
  /** Direct stream URL (RTSP, HTTP, etc.) */
  streamUrl?: string;

  /** Stream configuration (Phase 2) */
  streamConfig?: {
    type: StreamConfigType;
    rtspUrl?: string;
    transport?: 'tcp' | 'udp';
    auth?: {
      username?: string;
      password?: string;
    };
  };
  
  /** Camera type */
  type: CameraType;
  
  /** Camera status */
  status: CameraStatus;

  /** Optional capability flags */
  capabilities?: CameraCapabilities;

  /** Maintenance schedule tracking */
  maintenanceSchedule?: CameraMaintenanceSchedule;

  /** Tag list for categorization */
  tags?: string[];
  
  /** Physical location */
  location: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
    address?: string;
  };
  
  /** Camera settings */
  settings: {
    resolution?: string;
    fps?: number;
    recordingEnabled?: boolean;
  };
  
  /** VMS integration data */
  vms?: {
    provider?: VmsProvider;
    serverId?: mongoose.Types.ObjectId;
    monitorId?: string;
    lastSyncAt?: Date;
  };
  
  /** Flexible metadata for tracking */
  metadata?: {
    source?: string; // e.g., 'vms-import', 'manual', 'demo'
    externalId?: string;
    tags?: string[];
    [key: string]: unknown;
  };
  
  /** Soft delete flag */
  isDeleted: boolean;
  
  /** Last time camera was seen online */
  lastSeen?: Date;
  
  /** Modification timestamp */
  lastModified?: Date;
  
  /** Audit fields */
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

const CameraSchema = new Schema<ICamera>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required for multi-tenant isolation'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Camera name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must be less than 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must be less than 500 characters'],
    },
    streamUrl: {
      type: String,
      trim: true,
      validate: {
        validator: function (url: string) {
          if (!url) return true; // Optional
          return /^(rtsp|rtmp|http|https):\/\/.+/.test(url);
        },
        message: 'Stream URL must be a valid RTSP, RTMP, HTTP, or HTTPS URL',
      },
    },
    streamConfig: {
      type: {
        type: String,
        enum: ['vms', 'direct-rtsp'],
        default: 'vms',
      },
      rtspUrl: {
        type: String,
        trim: true,
        validate: {
          validator: function (url: string) {
            // TEST-ONLY: Require rtspUrl when using direct-rtsp config.
            const streamType = this.streamConfig?.type;
            if (streamType === 'direct-rtsp') {
              return !!url && /^(rtsp|rtmp|http|https):\/\/.+/.test(url);
            }
            if (!url) return true;
            return /^(rtsp|rtmp|http|https):\/\/.+/.test(url);
          },
          message: 'RTSP URL is required for direct-rtsp and must be a valid RTSP/HTTP URL',
        },
      },
      transport: {
        type: String,
        enum: ['tcp', 'udp'],
      },
      auth: {
        username: {
          type: String,
          trim: true,
        },
        password: {
          type: String,
          // TEST-ONLY: Prevent auth secrets from leaking in camera responses.
          select: false,
        },
      },
    },
    type: {
      type: String,
      enum: {
        values: ['ip', 'analog', 'usb'],
        message: '{VALUE} is not a valid camera type',
      },
      default: 'ip',
    },
    status: {
      type: String,
      enum: {
        values: ['online', 'offline', 'error', 'maintenance'],
        message: '{VALUE} is not a valid camera status',
      },
      default: 'offline',
    },
    capabilities: {
      ptz: {
        type: Boolean,
        default: false,
      },
      audio: {
        type: Boolean,
        default: false,
      },
      motionDetection: {
        type: Boolean,
        default: false,
      },
    },
    maintenanceSchedule: {
      intervalDays: {
        type: Number,
        min: [1, 'Maintenance interval must be at least 1 day'],
      },
      lastServiceAt: {
        type: Date,
      },
      nextServiceAt: {
        type: Date,
      },
      notes: {
        type: String,
        trim: true,
        maxlength: [500, 'Maintenance notes must be less than 500 characters'],
      },
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: function (values: string[]) {
          return Array.isArray(values) && values.every((value) => value.trim().length > 0);
        },
        message: 'Tags must be non-empty strings',
      },
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: [true, 'Location coordinates are required'],
        validate: {
          validator: function (coords: number[]) {
            return (
              coords.length === 2 &&
              coords[0] >= -180 &&
              coords[0] <= 180 &&
              coords[1] >= -90 &&
              coords[1] <= 90
            );
          },
          message: 'Coordinates must be [longitude, latitude] within valid ranges',
        },
      },
      address: {
        type: String,
        trim: true,
        maxlength: [500, 'Address must be less than 500 characters'],
      },
    },
    settings: {
      resolution: {
        type: String,
        default: '1920x1080',
      },
      fps: {
        type: Number,
        min: [1, 'FPS must be at least 1'],
        max: [120, 'FPS must be at most 120'],
        default: 30,
      },
      recordingEnabled: {
        type: Boolean,
        default: false,
      },
    },
    vms: {
      provider: {
        type: String,
        enum: ['shinobi', 'zoneminder', 'agentdvr', 'other'],
      },
      serverId: {
        type: Schema.Types.ObjectId,
        ref: 'VmsServer',
      },
      monitorId: {
        type: String,
        trim: true,
      },
      lastSyncAt: {
        type: Date,
      },
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
    },
    lastModified: {
      type: Date,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
CameraSchema.index({ companyId: 1, isDeleted: 1 });
CameraSchema.index({ companyId: 1, name: 1 });
CameraSchema.index({ companyId: 1, status: 1 });
CameraSchema.index({ companyId: 1, tags: 1 });
CameraSchema.index({ 'vms.serverId': 1 });
CameraSchema.index({ 'vms.monitorId': 1 });
CameraSchema.index({ 'metadata.source': 1 });
CameraSchema.index({ location: '2dsphere' });

// Pre-save hook to update lastModified
CameraSchema.pre('save', function (next) {
  this.lastModified = new Date();
  next();
});

export const Camera = mongoose.model<ICamera>('Camera', CameraSchema);
