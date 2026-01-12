import { Request, Response, NextFunction } from 'express';
import { Errors } from '../utils/errors.js';
import { createRequestLogger } from '../utils/logger.js';

// Extend Express Request type for user context
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        companyId: string;
        role: UserRole;
        email: string;
      };
    }
  }
}

export type UserRole =
  | 'citizen'
  | 'first_responder'
  | 'operator'
  | 'admin'
  | 'company_admin'
  | 'super_admin';

/**
 * Role hierarchy for permission checking
 * Higher index = higher permissions
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  citizen: 0,
  first_responder: 1,
  operator: 2,
  admin: 3,
  company_admin: 4,
  super_admin: 5,
};

/**
 * Placeholder authentication middleware
 * TODO: Implement in Slice 1 (Auth Core)
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const logger = createRequestLogger(req.correlationId);

  // Check for Authorization header
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    // For now, allow unauthenticated requests to pass through
    // This will be properly implemented in Slice 1
    logger.debug('No auth header provided', {
      action: 'auth.check.skipped',
      context: { reason: 'placeholder_middleware' },
    });
    return next();
  }

  // TODO: Validate JWT token
  // TODO: Extract user from token
  // TODO: Attach user to request

  logger.debug('Auth header found (placeholder)', {
    action: 'auth.check.placeholder',
    context: { hasBearer: authHeader.startsWith('Bearer ') },
  });

  next();
}

/**
 * Placeholder API key authentication middleware
 * TODO: Implement in Slice 1 (Auth Core)
 */
export function authenticateApiKey(req: Request, _res: Response, next: NextFunction): void {
  const logger = createRequestLogger(req.correlationId);

  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    logger.debug('No API key provided', {
      action: 'auth.apikey.skipped',
      context: { reason: 'placeholder_middleware' },
    });
    return next();
  }

  // TODO: Validate API key
  // TODO: Extract company from API key
  // TODO: Attach context to request

  logger.debug('API key found (placeholder)', {
    action: 'auth.apikey.placeholder',
    context: { keyPrefix: apiKey.slice(0, 10) + '***' },
  });

  next();
}

/**
 * Authorization middleware - check if user has required role
 * @param requiredRoles - Roles that are allowed to access the endpoint
 */
export function authorize(...requiredRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const logger = createRequestLogger(req.correlationId);

    // If no user attached (placeholder mode), skip authorization
    if (!req.user) {
      logger.debug('Authorization skipped - no user', {
        action: 'auth.authorize.skipped',
        context: { requiredRoles, reason: 'no_user_context' },
      });
      return next();
    }

    const userRoleLevel = ROLE_HIERARCHY[req.user.role];
    const requiredMinLevel = Math.min(...requiredRoles.map((r) => ROLE_HIERARCHY[r]));

    if (userRoleLevel >= requiredMinLevel) {
      logger.debug('Authorization passed', {
        action: 'auth.authorize.passed',
        context: {
          userRole: req.user.role,
          requiredRoles,
        },
      });
      return next();
    }

    logger.warn('Authorization failed', {
      action: 'auth.authorize.failed',
      userId: req.user.id,
      companyId: req.user.companyId,
      context: {
        userRole: req.user.role,
        requiredRoles,
      },
    });

    throw Errors.forbidden(`Role ${req.user.role} is not authorized for this action`);
  };
}

/**
 * Check if user can access a specific company's resources
 * (Tenant isolation enforcement)
 */
export function authorizeCompany(companyIdParam = 'companyId') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const logger = createRequestLogger(req.correlationId);

    // If no user attached (placeholder mode), skip
    if (!req.user) {
      return next();
    }

    const targetCompanyId = req.params[companyIdParam] || req.body?.companyId;

    // Super admin can access any company
    if (req.user.role === 'super_admin') {
      return next();
    }

    // User must belong to the target company
    if (targetCompanyId && req.user.companyId !== targetCompanyId) {
      logger.warn('Cross-company access denied', {
        action: 'auth.company.denied',
        userId: req.user.id,
        companyId: req.user.companyId,
        context: {
          targetCompanyId,
        },
      });
      throw Errors.forbidden('Cannot access resources from another company');
    }

    next();
  };
}
