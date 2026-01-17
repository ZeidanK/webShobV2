import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getCurrentUser } from '../utils/auth';
import { UserRole, hasMinimumRole } from '../utils/rbac';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, requiredRole, allowedRoles }: ProtectedRouteProps) {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  const userRole = currentUser.role as UserRole;

  // Check if user meets role requirements
  if (requiredRole && !hasMinimumRole(userRole, requiredRole)) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Access Denied</h1>
        <p>You do not have permission to access this page.</p>
        <p>Required role: {requiredRole} or higher. Your role: {userRole}</p>
      </div>
    );
  }

  // Check if user is in allowed roles list
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Access Denied</h1>
        <p>You do not have permission to access this page.</p>
        <p>Your role: {userRole}</p>
      </div>
    );
  }

  return <>{children}</>;
}
