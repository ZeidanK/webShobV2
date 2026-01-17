/**
 * RBAC utilities for role-based access control
 * Role hierarchy: citizen(0) < first_responder(1) < operator(2) < admin(3) = company_admin(3) < super_admin(5)
 */

export type UserRole = 'citizen' | 'first_responder' | 'operator' | 'admin' | 'company_admin' | 'super_admin';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  citizen: 0,
  first_responder: 1,
  operator: 2,
  admin: 3,
  company_admin: 3, // Same level as admin
  super_admin: 5,
};

/**
 * Check if user has at least the minimum required role
 */
export function hasMinimumRole(userRole: UserRole, minimumRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Check if user can manage users (admin+ only)
 */
export function canManageUsers(role: UserRole): boolean {
  return hasMinimumRole(role, 'admin');
}

/**
 * Check if user can configure company settings (admin+ only)
 */
export function canManageCompanySettings(role: UserRole): boolean {
  return hasMinimumRole(role, 'admin');
}

/**
 * Check if user can view/manage all companies (super_admin only)
 */
export function canManageAllCompanies(role: UserRole): boolean {
  return role === 'super_admin';
}

/**
 * Check if user can view events/reports (operator+ only)
 */
export function canViewEvents(role: UserRole): boolean {
  return hasMinimumRole(role, 'operator');
}

/**
 * Check if user can manage cameras (admin+ only)
 */
export function canManageCameras(role: UserRole): boolean {
  return hasMinimumRole(role, 'admin');
}

/**
 * Check if user has dashboard access (operator+ only)
 * Citizens and first responders use mobile app only
 */
export function hasDashboardAccess(role: UserRole): boolean {
  return hasMinimumRole(role, 'operator');
}
