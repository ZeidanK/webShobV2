import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser, UserRole, AuditLog, AuditAction } from '../models';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

/**
 * JWT Payload Interface
 */
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  companyId: string;
  iat?: number;
  exp?: number;
}

/**
 * Registration Data Interface
 */
export interface RegisterDTO {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyId: string;
  role?: UserRole;
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Login Data Interface
 */
export interface LoginDTO {
  email: string;
  password: string;
  correlationId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Auth Response Interface
 */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    companyId: string;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Auth Service
 */
export class AuthService {
  private static readonly JWT_SECRET: string = process.env.JWT_SECRET || 'development-secret-change-in-production';
  private static readonly JWT_EXPIRES_IN: string | number = process.env.JWT_EXPIRES_IN || '15m';
  private static readonly REFRESH_TOKEN_EXPIRES_IN: string | number = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

  /**
   * Register a new user
   */
  static async register(data: RegisterDTO): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new AppError('EMAIL_ALREADY_EXISTS', 'User with this email already exists', 409);
    }

    // Create user
    const user = new User({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || UserRole.CITIZEN,
      companyId: data.companyId,
      isActive: true,
      isEmailVerified: false,
    });

    await user.save();

    // Create audit log
    await AuditLog.create({
      action: AuditAction.USER_REGISTERED,
      companyId: user.companyId,
      userId: user._id,
      resourceType: 'User',
      resourceId: user._id,
      metadata: {
        email: user.email,
        role: user.role,
      },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      correlationId: data.correlationId,
      timestamp: new Date(),
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store refresh token
    user.refreshToken = refreshToken;
    user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await user.save();

    logger.info({
      action: 'auth.register.success',
      userId: user._id.toString(),
      email: user.email,
      companyId: user.companyId.toString(),
      correlationId: data.correlationId,
    });

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId.toString(),
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Login user
   */
  static async login(data: LoginDTO): Promise<AuthResponse> {
    // Find user with password
    const user = await User.findOne({ email: data.email }).select('+password');
    
    if (!user) {
      // Log failed attempt
      await AuditLog.create({
        action: AuditAction.USER_LOGIN_FAILED,
        companyId: new mongoose.Types.ObjectId(), // Unknown company at this point
        resourceType: 'User',
        metadata: {
          email: data.email,
          reason: 'User not found',
        },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        correlationId: data.correlationId,
        timestamp: new Date(),
      });
      
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    // Check if account is locked
    if (user.isLocked()) {
      await AuditLog.create({
        action: AuditAction.USER_LOGIN_FAILED,
        companyId: user.companyId,
        userId: user._id,
        resourceType: 'User',
        resourceId: user._id,
        metadata: {
          email: user.email,
          reason: 'Account locked',
        },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        correlationId: data.correlationId,
        timestamp: new Date(),
      });
      
      throw new AppError('ACCOUNT_LOCKED', 'Account is locked due to too many failed login attempts. Please try again later.', 423);
    }

    // Check if account is active
    if (!user.isActive) {
      await AuditLog.create({
        action: AuditAction.USER_LOGIN_FAILED,
        companyId: user.companyId,
        userId: user._id,
        resourceType: 'User',
        resourceId: user._id,
        metadata: {
          email: user.email,
          reason: 'Account inactive',
        },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        correlationId: data.correlationId,
        timestamp: new Date(),
      });
      
      throw new AppError('ACCOUNT_INACTIVE', 'Account is inactive. Please contact your administrator.', 403);
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(data.password);
    
    if (!isPasswordValid) {
      // Increment login attempts
      await user.incrementLoginAttempts();
      
      await AuditLog.create({
        action: AuditAction.USER_LOGIN_FAILED,
        companyId: user.companyId,
        userId: user._id,
        resourceType: 'User',
        resourceId: user._id,
        metadata: {
          email: user.email,
          reason: 'Invalid password',
          loginAttempts: user.loginAttempts + 1,
        },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        correlationId: data.correlationId,
        timestamp: new Date(),
      });
      
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store refresh token
    user.refreshToken = refreshToken;
    user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await user.save();

    // Create audit log
    await AuditLog.create({
      action: AuditAction.USER_LOGIN,
      companyId: user.companyId,
      userId: user._id,
      resourceType: 'User',
      resourceId: user._id,
      metadata: {
        email: user.email,
      },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      correlationId: data.correlationId,
      timestamp: new Date(),
    });

    logger.info({
      action: 'auth.login.success',
      userId: user._id.toString(),
      email: user.email,
      companyId: user.companyId.toString(),
      correlationId: data.correlationId,
    });

    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        companyId: user.companyId.toString(),
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Refresh access token
   */
  static async refreshAccessToken(refreshToken: string, correlationId: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.JWT_SECRET) as JWTPayload;

      // Find user with refresh token
      const user = await User.findById(decoded.userId).select('+refreshToken +refreshTokenExpiry');
      
      if (!user || !user.isActive) {
        throw new AppError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token', 401);
      }

      // Verify stored refresh token matches
      if (user.refreshToken !== refreshToken) {
        throw new AppError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token', 401);
      }

      // Check if refresh token has expired
      if (user.refreshTokenExpiry && user.refreshTokenExpiry < new Date()) {
        throw new AppError('REFRESH_TOKEN_EXPIRED', 'Refresh token has expired. Please login again.', 401);
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(user);
      const newRefreshToken = this.generateRefreshToken(user);

      // Update refresh token
      user.refreshToken = newRefreshToken;
      user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await user.save();

      logger.info({
        action: 'auth.token.refreshed',
        userId: user._id.toString(),
        companyId: user.companyId.toString(),
        correlationId,
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token', 401);
      }
      throw error;
    }
  }

  /**
   * Request password reset
   */
  static async requestPasswordReset(email: string, correlationId: string, ipAddress?: string, userAgent?: string): Promise<string> {
    const user = await User.findOne({ email });
    
    if (!user) {
      // Don't reveal if user exists
      logger.warn({
        action: 'auth.password.reset.requested',
        email,
        result: 'user_not_found',
        correlationId,
      });
      return 'If the email exists, a password reset link has been sent';
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Create audit log
    await AuditLog.create({
      action: AuditAction.USER_PASSWORD_RESET_REQUESTED,
      companyId: user.companyId,
      userId: user._id,
      resourceType: 'User',
      resourceId: user._id,
      metadata: {
        email: user.email,
      },
      ipAddress,
      userAgent,
      correlationId,
      timestamp: new Date(),
    });

    logger.info({
      action: 'auth.password.reset.requested',
      userId: user._id.toString(),
      email: user.email,
      correlationId,
    });

    // TODO: Send email with reset token
    // For now, return the token (in production, send via email)
    return resetToken;
  }

  /**
   * Reset password with token
   */
  static async resetPassword(token: string, newPassword: string, correlationId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    // Hash the token to match stored value
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpiry: { $gt: new Date() },
    }).select('+passwordResetToken +passwordResetExpiry');

    if (!user) {
      throw new AppError('INVALID_RESET_TOKEN', 'Invalid or expired password reset token', 400);
    }

    // Update password
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    user.refreshToken = undefined; // Invalidate all refresh tokens
    user.refreshTokenExpiry = undefined;
    await user.save();

    // Create audit log
    await AuditLog.create({
      action: AuditAction.USER_PASSWORD_RESET_COMPLETED,
      companyId: user.companyId,
      userId: user._id,
      resourceType: 'User',
      resourceId: user._id,
      metadata: {
        email: user.email,
      },
      ipAddress,
      userAgent,
      correlationId,
      timestamp: new Date(),
    });

    logger.info({
      action: 'auth.password.reset.completed',
      userId: user._id.toString(),
      email: user.email,
      correlationId,
    });
  }

  /**
   * Validate API key
   */
  static async validateApiKey(apiKey: string): Promise<IUser> {
    const user = await User.findOne({ apiKey, isActive: true }).select('+apiKey');
    
    if (!user) {
      throw new AppError('INVALID_API_KEY', 'Invalid or inactive API key', 401);
    }

    return user;
  }

  /**
   * Generate access token (JWT)
   */
  private static generateAccessToken(user: IUser): string {
    const payload: JWTPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      companyId: user.companyId.toString(),
    };

    return jwt.sign(payload, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRES_IN as any });
  }

  /**
   * Generate token for testing (public method to allow test access)
   */
  static generateToken(payload: JWTPayload): string {
    return jwt.sign(payload, this.JWT_SECRET, { expiresIn: this.JWT_EXPIRES_IN as any });
  }

  /**
   * Generate refresh token
   */
  private static generateRefreshToken(user: IUser): string {
    const payload: JWTPayload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      companyId: user.companyId.toString(),
    };

    return jwt.sign(payload, this.JWT_SECRET, { expiresIn: this.REFRESH_TOKEN_EXPIRES_IN as any });
  }

  /**
   * Verify JWT token
   */
  static verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('TOKEN_EXPIRED', 'Access token has expired', 401);
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('INVALID_TOKEN', 'Invalid access token', 401);
      }
      throw error;
    }
  }
}
