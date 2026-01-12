import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

/**
 * Company Type (for future extensibility)
 */
export enum CompanyType {
  STANDARD = 'standard',
  MOBILE_PARTNER = 'mobile_partner', // For Slice 7
  ENTERPRISE = 'enterprise',
}

/**
 * Company Status
 */
export enum CompanyStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  INACTIVE = 'inactive',
}

/**
 * Company Settings Interface
 */
export interface ICompanySettings {
  allowCitizenReports?: boolean;
  autoLinkReportsToEvents?: boolean;
  maxUsers?: number;
  features?: string[];
}

/**
 * Company Interface
 */
export interface ICompany extends Document {
  name: string;
  type: CompanyType;
  status: CompanyStatus;
  apiKey: string;
  settings: ICompanySettings;
  
  // Contact
  contactEmail?: string;
  contactPhone?: string;
  
  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  
  // Methods
  regenerateApiKey(): string;
}

/**
 * Company Schema
 */
const companySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [100, 'Company name cannot exceed 100 characters'],
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(CompanyType),
      default: CompanyType.STANDARD,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CompanyStatus),
      default: CompanyStatus.ACTIVE,
      required: true,
      index: true,
    },
    apiKey: {
      type: String,
      unique: true,
      index: true,
      select: false, // Don't return by default for security
    },
    settings: {
      allowCitizenReports: {
        type: Boolean,
        default: true,
      },
      autoLinkReportsToEvents: {
        type: Boolean,
        default: false,
      },
      maxUsers: {
        type: Number,
        default: 50,
        min: [1, 'Max users must be at least 1'],
      },
      features: {
        type: [String],
        default: [],
      },
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    contactPhone: {
      type: String,
      trim: true,
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
      transform: (_doc, ret) => {
        // Remove sensitive fields from JSON output
        const obj = ret as any;
        delete obj.__v;
        return ret;
      },
    },
  }
);

/**
 * Indexes for common queries
 */
companySchema.index({ name: 1, status: 1 });
companySchema.index({ createdAt: -1 });

/**
 * Pre-save hook: Generate API key if not present
 */
companySchema.pre('save', function (next) {
  if (!this.apiKey) {
    this.apiKey = `ckey_${crypto.randomBytes(32).toString('hex')}`;
  }
  
  next();
});

/**
 * Method: Regenerate API key
 * Generates a new secure API key for the company
 */
companySchema.methods.regenerateApiKey = function (): string {
  const apiKey = `ckey_${crypto.randomBytes(32).toString('hex')}`;
  this.apiKey = apiKey;
  return apiKey;
};

/**
 * Export Company model
 */
export const Company = mongoose.model<ICompany>('Company', companySchema);
