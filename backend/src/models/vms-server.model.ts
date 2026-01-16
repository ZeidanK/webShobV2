/**
 * VMS Server Model
 * 
 * Represents a Video Management System server connection.
 * VMS systems (Shinobi, ZoneMinder, AgentDVR) manage live streams and recordings.
 * Cameras reference a VmsServer via `camera.vms.serverId`.
 * 
 * Multi-tenant: All queries MUST filter by companyId.
 */

import mongoose, { Document, Schema } from 'mongoose';

/** VMS Provider types - limited for MVP */
export type VmsProvider = 'shinobi' | 'zoneminder' | 'agentdvr' | 'other';

/** VMS Server document interface */
export interface IVmsServer extends Document {
  /** Multi-tenant isolation */
  companyId: mongoose.Types.ObjectId;
  
  /** Friendly name, e.g., "Local Shinobi" */
  name: string;
  
  /** VMS provider type */
  provider: VmsProvider;
  
  /** Base URL of the VMS server (http://host:port) */
  baseUrl: string;
  
  /** Authentication credentials - provider-specific */
  auth?: {
    /** Shinobi: API Key */
    apiKey?: string;
    /** Shinobi: Group Key */
    groupKey?: string;
    /** Username for basic auth */
    username?: string;
    /** Password for basic auth */
    password?: string;
  };
  
  /** Whether server is active and should be used */
  isActive: boolean;
  
  /** Connection health tracking */
  lastConnectedAt?: Date;
  connectionStatus?: 'connected' | 'disconnected' | 'error' | 'unknown';
  lastError?: string;
  
  /** Audit fields */
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
}

const VmsServerSchema = new Schema<IVmsServer>(
  {
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required for multi-tenant isolation'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'VMS server name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must be less than 100 characters'],
    },
    provider: {
      type: String,
      required: [true, 'VMS provider type is required'],
      enum: {
        values: ['shinobi', 'zoneminder', 'agentdvr', 'other'],
        message: '{VALUE} is not a supported VMS provider',
      },
    },
    baseUrl: {
      type: String,
      required: [true, 'VMS server base URL is required'],
      trim: true,
      validate: {
        validator: function (url: string) {
          return /^https?:\/\/.+/.test(url);
        },
        message: 'Base URL must be a valid HTTP/HTTPS URL',
      },
    },
    auth: {
      apiKey: {
        type: String,
        trim: true,
        select: false, // Hide by default for security
      },
      groupKey: {
        type: String,
        trim: true,
        select: false, // Hide by default for security
      },
      username: {
        type: String,
        trim: true,
        select: false, // Hide by default for security
      },
      password: {
        type: String,
        select: false, // Hide by default for security
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastConnectedAt: {
      type: Date,
    },
    connectionStatus: {
      type: String,
      enum: ['connected', 'disconnected', 'error', 'unknown'],
      default: 'unknown',
    },
    lastError: {
      type: String,
      maxlength: 500,
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
    toJSON: {
      transform: function (_doc, ret) {
        // Never expose auth credentials in JSON responses
        delete ret.auth;
        return ret;
      },
    },
    toObject: {
      transform: function (_doc, ret) {
        // Never expose auth credentials in object responses
        delete ret.auth;
        return ret;
      },
    },
  }
);

// Indexes for performance
VmsServerSchema.index({ companyId: 1, isActive: 1 });
VmsServerSchema.index({ companyId: 1, provider: 1 });
VmsServerSchema.index({ companyId: 1, name: 1 }, { unique: true });

// Pre-save validation for provider-specific requirements
VmsServerSchema.pre('save', function (next) {
  if (this.provider === 'shinobi') {
    // Shinobi requires both apiKey and groupKey
    if (!this.auth?.apiKey || !this.auth?.groupKey) {
      const error = new Error('Shinobi provider requires auth.apiKey and auth.groupKey');
      return next(error);
    }
  }
  next();
});

export const VmsServer = mongoose.model<IVmsServer>('VmsServer', VmsServerSchema);
