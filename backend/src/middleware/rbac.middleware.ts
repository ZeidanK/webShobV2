import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { UserRole } from '../models';

/**
 * Role hierarchy for permission checking
 * Higher value = higher permissions
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  citizen: 0,
  first_responder: 1,
  operator: 2,
  admin: 3,
  company_admin: 3, // Same level as admin
  super_admin: 5,
};

/**
 * Check if user has at least the minimum required role level
 * @param userRole - User's current role
 * @param requiredRole - Minimum required role
 * @returns true if user has sufficient permissions
 */
export function hasMinimumRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if user can create/assign a specific role
 * Rule: Cannot create a user with higher or equal role (except super_admin can create anything)
 * @param userRole - User's current role
 * @param targetRole - Role to be assigned
 * @returns true if user can assign the target role
 */
export function canAssignRole(userRole: UserRole, targetRole: UserRole): boolean {
  // Super admin can assign any role
  if (userRole === UserRole.SUPER_ADMIN) {
    return true;
  }
  
  // Admin/Company admin can assign roles below their level
  if (userRole === UserRole.ADMIN || userRole === UserRole.COMPANY_ADMIN) {
    return ROLE_HIERARCHY[targetRole] < ROLE_HIERARCHY[userRole];
  }
  
  // No other roles can assign roles
  return false;
}

/**
 * Middleware: Require minimum role level
 * @param minimumRole - Minimum required role
 */
export function requireRole(minimumRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    if (!hasMinimumRole(req.user.role as UserRole, minimumRole)) {
      logger.warn({
        action: 'rbac.role.denied',
        userId: req.user.id,
        companyId: req.user.companyId,
        context: {
          userRole: req.user.role,
          requiredRole: minimumRole,
        },
        correlationId: req.correlationId,
      });
      
      throw new AppError(
        'INSUFFICIENT_PERMISSIONS',
        `Role ${minimumRole} or higher required`,
        403
      );
    }

    next();
  };
}

/**
 * Middleware: Require one of the specified roles
 * @param allowedRoles - Array of allowed roles
 */
export function requireAnyRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const userRole = req.user.role as UserRole;
    
    if (!allowedRoles.includes(userRole)) {
      logger.warn({
        action: 'rbac.role.denied',
        userId: req.user.id,
        companyId: req.user.companyId,
        context: {
          userRole,
          allowedRoles,
        },
        correlationId: req.correlationId,
      });
      
      throw new AppError(
        'INSUFFICIENT_PERMISSIONS',
        `One of these roles required: ${allowedRoles.join(', ')}`,
        403
      );
    }

    next();
  };
}

/**
 * Middleware: Validate role assignment in request body
 * Ensures user can only assign roles they have permission for
 */
export function validateRoleAssignment(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const targetRole = req.body.role as UserRole;
  
  // If no role in body, skip validation (might be an update without role change)
  if (!targetRole) {
    return next();
  }

  const userRole = req.user.role as UserRole;

  if (!canAssignRole(userRole, targetRole)) {
    logger.warn({
      action: 'rbac.role.assignment.denied',
      userId: req.user.id,
      companyId: req.user.companyId,
      context: {
        userRole,
        targetRole,
      },
      correlationId: req.correlationId,
    });
    
    throw new AppError(
      'ROLE_HIERARCHY_VIOLATION',
      `Cannot create/assign role ${targetRole}. You can only assign roles below your level.`,
      403
    );
  }

  next();
}

/**
 * Middleware: Enforce tenant isolation
 * Ensures users can only access their own company's resources (except super_admin)
 * @param companyIdField - Field name to check for companyId (default: 'companyId' in params)
 */
export function enforceTenantIsolation(companyIdField: 'params' | 'body' | 'query' = 'params') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
    }

    // Super admin can access any company
    if (req.user.role === UserRole.SUPER_ADMIN) {
      return next();
    }

    let targetCompanyId: string | undefined;
    
    if (companyIdField === 'params') {
      targetCompanyId = req.params.companyId;
    } else if (companyIdField === 'body') {
      targetCompanyId = req.body.companyId;
    } else if (companyIdField === 'query') {
      targetCompanyId = req.query.companyId as string;
    }

    // If targetCompanyId exists and doesn't match user's company, deny access
    if (targetCompanyId && targetCompanyId !== req.user.companyId) {
      logger.warn({
        action: 'rbac.tenant.isolation.violated',
        userId: req.user.id,
        companyId: req.user.companyId,
        context: {
          targetCompanyId,
        },
        correlationId: req.correlationId,
      });
      
      throw new AppError(
        'TENANT_MISMATCH',
        'Cannot access resources from another company',
        403
      );
    }

    next();
  };
}

/**
 * Helper: Check if user is super admin
 */
export function isSuperAdmin(req: Request): boolean {
  return req.user?.role === UserRole.SUPER_ADMIN;
}

/**
 * Helper: Check if user is admin or higher
 */
export function isAdmin(req: Request): boolean {
  if (!req.user) return false;
  const userRole = req.user.role as UserRole;
  return hasMinimumRole(userRole, UserRole.ADMIN);
}

/**
 * Helper: Check if user belongs to same company
 */
export function isSameCompany(req: Request, companyId: string): boolean {
  if (!req.user) return false;
  return req.user.companyId === companyId || req.user.role === UserRole.SUPER_ADMIN;
}
