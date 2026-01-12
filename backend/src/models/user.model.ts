import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * User Roles (RBAC)
 * - citizen: Can submit reports
 * - first_responder: Field personnel with mobile access
 * - operator: Monitor events, manage incidents
 * - admin: Company admin (manages users, company settings)
 * - company_admin: Same as admin (alias)
 * - super_admin: Platform admin (cross-company access)
 */
export enum UserRole {
  CITIZEN = 'citizen',
  FIRST_RESPONDER = 'first_responder',
  OPERATOR = 'operator',
  ADMIN = 'admin',
  COMPANY_ADMIN = 'company_admin',
  SUPER_ADMIN = 'super_admin',
}

/**
 * User Interface
 */
export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  companyId: mongoose.Types.ObjectId; // Multi-tenant isolation
  apiKey?: string; // For mobile/responder devices
  
  // Account security
  isActive: boolean;
  isEmailVerified: boolean;
  loginAttempts: number;
  lockUntil?: Date;
  
  // Token management
  refreshToken?: string;
  refreshTokenExpiry?: Date;
  passwordResetToken?: string;
  passwordResetExpiry?: Date;
  
  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateApiKey(): string;
  generatePasswordResetToken(): string;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
  isLocked(): boolean;
}

/**
 * User Schema
 */
const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // Don't return password by default
    },
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CITIZEN,
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company ID is required for multi-tenant isolation'],
      index: true,
    },
    apiKey: {
      type: String,
      unique: true,
      sparse: true, // Allow multiple null values
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    refreshTokenExpiry: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpiry: {
      type: Date,
      select: false,
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
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: {
      transform: (_doc, ret) => {
        // Remove sensitive fields from JSON output
        const obj = ret as any;
        delete obj.password;
        delete obj.refreshToken;
        delete obj.refreshTokenExpiry;
        delete obj.passwordResetToken;
        delete obj.passwordResetExpiry;
        delete obj.__v;
        return ret;
      },
    },
  }
);

/**
 * Compound index for tenant isolation queries
 */
userSchema.index({ companyId: 1, email: 1 });
userSchema.index({ companyId: 1, role: 1 });
userSchema.index({ companyId: 1, isActive: 1 });

/**
 * Pre-save hook: Hash password if modified
 */
userSchema.pre('save', async function (next) {
  const user = this as IUser;
  
  // Only hash password if it's modified
  if (!user.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

/**
 * Method: Compare password
 */
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  const user = this as IUser;
  return bcrypt.compare(candidatePassword, user.password);
};

/**
 * Method: Generate API key for mobile/responder devices
 */
userSchema.methods.generateApiKey = function (): string {
  const user = this as IUser;
  const apiKey = `emp_${crypto.randomBytes(32).toString('hex')}`;
  user.apiKey = apiKey;
  return apiKey;
};

/**
 * Method: Generate password reset token
 */
userSchema.methods.generatePasswordResetToken = function (): string {
  const user = this as IUser;
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Hash the token before storing
  user.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  // Token expires in 1 hour
  user.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000);
  
  // Return unhashed token to send via email
  return resetToken;
};

/**
 * Method: Increment login attempts and lock account if needed
 */
userSchema.methods.incrementLoginAttempts = async function (): Promise<void> {
  const user = this as IUser;
  const maxAttempts = 5;
  const lockTime = 30 * 60 * 1000; // 30 minutes
  
  // If lock has expired, reset attempts
  if (user.lockUntil && user.lockUntil < new Date()) {
    await User.updateOne(
      { _id: user._id },
      {
        $set: { loginAttempts: 1 },
        $unset: { lockUntil: 1 },
      }
    );
    return;
  }
  
  // Increment attempts
  const updates: any = { $inc: { loginAttempts: 1 } };
  
  // Lock account if max attempts reached
  if (user.loginAttempts + 1 >= maxAttempts && !user.lockUntil) {
    updates.$set = { lockUntil: new Date(Date.now() + lockTime) };
  }
  
  await User.updateOne({ _id: user._id }, updates);
};

/**
 * Method: Reset login attempts after successful login
 */
userSchema.methods.resetLoginAttempts = async function (): Promise<void> {
  const user = this as IUser;
  await User.updateOne(
    { _id: user._id },
    {
      $set: { loginAttempts: 0 },
      $unset: { lockUntil: 1 },
    }
  );
};

/**
 * Method: Check if account is locked
 */
userSchema.methods.isLocked = function (): boolean {
  const user = this as IUser;
  return !!(user.lockUntil && user.lockUntil > new Date());
};

/**
 * Static method: Find by email with password (for login)
 */
userSchema.statics.findByEmailWithPassword = function (
  email: string
): Promise<IUser | null> {
  return this.findOne({ email }).select('+password');
};

/**
 * User Model
 */
export interface IUserModel extends Model<IUser> {
  findByEmailWithPassword(email: string): Promise<IUser | null>;
}

export const User = mongoose.model<IUser, IUserModel>('User', userSchema);
