/**
 * Standard error codes used across the API
 */
export const ErrorCodes = {
  // Authentication Errors (401)
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  INVALID_TOKEN: 'INVALID_TOKEN',
  API_KEY_INVALID: 'API_KEY_INVALID',
  INVALID_API_KEY: 'INVALID_API_KEY',
  MISSING_AUTH_TOKEN: 'MISSING_AUTH_TOKEN',
  MISSING_API_KEY: 'MISSING_API_KEY',
  INVALID_AUTH_FORMAT: 'INVALID_AUTH_FORMAT',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
  INVALID_RESET_TOKEN: 'INVALID_RESET_TOKEN',

  // Authorization Errors (403)
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  COMPANY_ACCESS_DENIED: 'COMPANY_ACCESS_DENIED',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  RESOURCE_ACCESS_DENIED: 'RESOURCE_ACCESS_DENIED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  ROLE_HIERARCHY_VIOLATION: 'ROLE_HIERARCHY_VIOLATION',
  COMPANY_INACTIVE: 'COMPANY_INACTIVE',

  // Validation Errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_FORMAT: 'INVALID_FIELD_FORMAT',
  INVALID_ENUM_VALUE: 'INVALID_ENUM_VALUE',

  // Resource Errors (404, 409)
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  COMPANY_NOT_FOUND: 'COMPANY_NOT_FOUND',
  USER_EXISTS: 'USER_EXISTS',
  COMPANY_EXISTS: 'COMPANY_EXISTS',
  SELF_DELETION: 'SELF_DELETION',

  // System Errors (500, 502, 503)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  VMS_CONNECTION_FAILED: 'VMS_CONNECTION_FAILED',
  AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',

  // Rate Limiting (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Custom application error class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Factory functions for common errors
 */
export const Errors = {
  validation: (message: string, details?: Record<string, unknown>) =>
    new AppError(ErrorCodes.VALIDATION_ERROR, message, 400, details),

  unauthorized: (message = 'Authentication required') =>
    new AppError(ErrorCodes.INVALID_CREDENTIALS, message, 401),

  forbidden: (message = 'Insufficient permissions') =>
    new AppError(ErrorCodes.INSUFFICIENT_PERMISSIONS, message, 403),

  notFound: (resource: string, id?: string) =>
    new AppError(
      ErrorCodes.RESOURCE_NOT_FOUND,
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      404,
      { resource, id }
    ),

  conflict: (message: string, details?: Record<string, unknown>) =>
    new AppError(ErrorCodes.RESOURCE_ALREADY_EXISTS, message, 409, details),

  invalidStateTransition: (from: string, to: string) =>
    new AppError(
      ErrorCodes.INVALID_STATE_TRANSITION,
      `Cannot transition from ${from} to ${to}`,
      409,
      { from, to }
    ),

  internal: (message = 'Internal server error') =>
    new AppError(ErrorCodes.INTERNAL_ERROR, message, 500),

  rateLimitExceeded: (retryAfter: number) =>
    new AppError(ErrorCodes.RATE_LIMIT_EXCEEDED, 'Too many requests', 429, { retryAfter }),
};
