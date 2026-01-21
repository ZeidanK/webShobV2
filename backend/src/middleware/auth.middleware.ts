import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { User, UserRole } from '../models';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

// Note: Express Request type extension is now in src/types/express.d.ts

/**
 * Role hierarchy for permission checking
 * Higher index = higher permissions
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.CITIZEN]: 0,
  [UserRole.FIRST_RESPONDER]: 1,
  [UserRole.VIEWER]: 1,
  [UserRole.OPERATOR]: 2,
  [UserRole.ADMIN]: 3,
  [UserRole.COMPANY_ADMIN]: 4,  [UserRole.SUPER_ADMIN]: 5,};

/**
 * JWT Authentication Middleware
 * Validates JWT token from Authorization header and attaches user to request
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    // Check for Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AppError('MISSING_AUTH_TOKEN', 'Authorization header is required', 401);
    }

    // Extract token from "Bearer <token>"
    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError('INVALID_AUTH_FORMAT', 'Authorization header must be in format: Bearer <token>', 401);
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    // Verify token
    const decoded = AuthService.verifyToken(token);

    // Attach user to request
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      companyId: decoded.companyId,
    };

    logger.debug({
      action: 'auth.jwt.success',
      userId: req.user!.id,
      companyId: req.user!.companyId,
      correlationId: req.correlationId,
    });

    next();
  } catch (error) {
    // Log auth failure
    logger.warn({
      action: 'auth.jwt.failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId: req.correlationId,
    });

    next(error);
  }
}

/**
 * API Key Authentication Middleware
 * Validates API key from X-API-Key header and attaches user to request
 * Used for mobile apps and responder devices
 */
export async function authenticateApiKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new AppError('MISSING_API_KEY', 'X-API-Key header is required', 401);
    }

    // Validate API key
    const user = await AuthService.validateApiKey(apiKey);

    // Attach user to request
    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      companyId: user.companyId.toString(),
    };

    logger.debug({
      action: 'auth.apikey.success',
      userId: req.user!.id,
      companyId: req.user!.companyId,
      correlationId: req.correlationId,
    });

    next();
  } catch (error) {
    // Log auth failure
    logger.warn({
      action: 'auth.apikey.failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      correlationId: req.correlationId,
    });

    next(error);
  }
}

/**
 * Authorization middleware - check if user has required role
 * @param requiredRoles - Roles that are allowed to access the endpoint
 */
export function authorize(...requiredRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // User must be authenticated first
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const userRoleLevel = ROLE_HIERARCHY[req.user.role];
    const requiredMinLevel = Math.min(...requiredRoles.map((r) => ROLE_HIERARCHY[r]));

    if (userRoleLevel >= requiredMinLevel) {
      logger.debug({
        action: 'auth.authorize.passed',
        userId: req.user.id,
        companyId: req.user.companyId,
        context: {
          userRole: req.user.role,
          requiredRoles,
        },
        correlationId: req.correlationId,
      });
      return next();
    }

    logger.warn({
      action: 'auth.authorize.failed',
      userId: req.user.id,
      companyId: req.user.companyId,
      context: {
        userRole: req.user.role,
        requiredRoles,
      },
      correlationId: req.correlationId,
    });

    throw new AppError('FORBIDDEN', `Role ${req.user.role} is not authorized for this action`, 403);
  };
}

/**
 * Check if user can access a specific company's resources
 * (Tenant isolation enforcement)
 */
export function authorizeCompany(companyIdParam = 'companyId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // User must be authenticated first
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const targetCompanyId = req.params[companyIdParam] || req.body?.companyId;

    // Super admin can access any company
    if (req.user.role === 'super_admin') {
      return next();
    }

    // User must belong to the target company
    if (targetCompanyId && req.user.companyId !== targetCompanyId) {
      logger.warn({
        action: 'auth.company.denied',
        userId: req.user.id,
        companyId: req.user.companyId,
        context: {
          targetCompanyId,
        },
        correlationId: req.correlationId,
      });
      throw new AppError('TENANT_MISMATCH', 'Cannot access resources from another company', 403);
    }

    next();
  };
}
