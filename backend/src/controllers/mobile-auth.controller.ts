import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { Company, CompanyType } from '../models/company.model';
import { User, UserRole } from '../models/user.model';
import { AuditLog, AuditAction } from '../models/audit-log.model';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { rateLimitMobileAuth } from '../middleware/rate-limit.middleware';

/**
 * Mobile Authentication Controller
 * Handles authentication for mobile apps using API key + user credentials
 */

/**
 * Mobile login with API key + user credentials
 * POST /api/mobile/auth/login
 */
export const login = [
  rateLimitMobileAuth, // Apply stricter rate limiting for auth
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const apiKey = req.headers['x-api-key'] as string;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      // Validate request
      if (!apiKey) {
        throw new AppError('MISSING_API_KEY', 'X-API-Key header is required for mobile authentication', 401);
      }

      if (!email || !password) {
        throw new AppError('MISSING_CREDENTIALS', 'Email and password are required', 400);
      }

      // Validate API key and get company
      const company = await Company.findOne({ apiKey }).select('+apiKey');
      
      if (!company) {
        throw new AppError('INVALID_API_KEY', 'Invalid API key', 401);
      }

      // Check if company type supports mobile access
      if (![CompanyType.MOBILE_PARTNER, CompanyType.STANDARD, CompanyType.ENTERPRISE].includes(company.type)) {
        throw new AppError('MOBILE_ACCESS_DENIED', 'Company type does not support mobile access', 403);
      }

      // Find user by email and company (must select password for comparison)
      const user = await User.findOne({
        email,
        companyId: company._id,
        isActive: true,
      }).select('+password');

      if (!user) {
        logger.warn({
          action: 'mobile.auth.login.user_not_found',
          context: {
            email,
            companyId: company._id.toString(),
            ipAddress,
          },
          correlationId: req.correlationId,
        });
        
        throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }

      // Check if account is locked
      if (user.isLocked()) {
        logger.warn({
          action: 'mobile.auth.login.account_locked',
          context: {
            userId: user._id.toString(),
            email,
            companyId: company._id.toString(),
          },
          correlationId: req.correlationId,
        });

        throw new AppError('ACCOUNT_LOCKED', 'Account is locked due to multiple failed login attempts', 423);
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        // Increment login attempts
        await user.incrementLoginAttempts();

        logger.warn({
          action: 'mobile.auth.login.invalid_password',
          context: {
            userId: user._id.toString(),
            email,
            companyId: company._id.toString(),
            loginAttempts: user.loginAttempts + 1,
          },
          correlationId: req.correlationId,
        });

        throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }

      // Check if user role is allowed for mobile access
      const allowedRoles = [
        UserRole.CITIZEN,
        UserRole.FIRST_RESPONDER,
        UserRole.OPERATOR,
        UserRole.ADMIN,
      ];

      if (!allowedRoles.includes(user.role)) {
        throw new AppError('ROLE_NOT_ALLOWED', 'User role is not authorized for mobile access', 403);
      }

      // Reset login attempts on successful login
      await user.resetLoginAttempts();

      // Generate tokens
      const accessToken = AuthService.generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        companyId: user.companyId.toString(),
      });

      const refreshToken = AuthService.generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        companyId: user.companyId.toString(),
      });

      // Update user's refresh token
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
        changes: {
          channel: 'mobile',
          ipAddress,
          userAgent,
        },
        correlationId: req.correlationId,
      });

      logger.info({
        action: 'mobile.auth.login.success',
        context: {
          userId: user._id.toString(),
          email: user.email,
          role: user.role,
          companyId: company._id.toString(),
          companyType: company.type,
        },
        correlationId: req.correlationId,
      });

      // Return success response
      res.json({
        success: true,
        data: {
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
          expiresIn: '15m', // Token expiry
        },
        correlationId: req.correlationId,
      });
    } catch (error) {
      next(error);
    }
  },
];

/**
 * Refresh access token
 * POST /api/mobile/auth/refresh
 */
export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    const apiKey = req.headers['x-api-key'] as string;

    // Validate request
    if (!apiKey) {
      throw new AppError('MISSING_API_KEY', 'X-API-Key header is required', 401);
    }

    if (!refreshToken) {
      throw new AppError('MISSING_REFRESH_TOKEN', 'Refresh token is required', 400);
    }

    // Validate API key
    const company = await Company.findOne({ apiKey }).select('+apiKey');
    
    if (!company) {
      throw new AppError('INVALID_API_KEY', 'Invalid API key', 401);
    }

    // Verify refresh token
    const decoded = AuthService.verifyToken(refreshToken);

    // Find user and validate refresh token
    const user = await User.findOne({
      _id: decoded.userId,
      companyId: company._id,
      refreshToken,
      isActive: true,
    });

    if (!user) {
      throw new AppError('INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token', 401);
    }

    // Check if refresh token is expired
    if (user.refreshTokenExpiry && user.refreshTokenExpiry < new Date()) {
      throw new AppError('REFRESH_TOKEN_EXPIRED', 'Refresh token has expired', 401);
    }

    // Generate new tokens
    const newAccessToken = AuthService.generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      companyId: user.companyId.toString(),
    });

    const newRefreshToken = AuthService.generateToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      companyId: user.companyId.toString(),
    });

    // Update user's refresh token
    user.refreshToken = newRefreshToken;
    user.refreshTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await user.save();

    logger.info({
      action: 'mobile.auth.refresh.success',
      context: {
        userId: user._id.toString(),
        companyId: company._id.toString(),
      },
      correlationId: req.correlationId,
    });

    // Return new tokens
    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: '15m',
      },
      correlationId: req.correlationId,
    });
  } catch (error) {
    next(error);
  }
};