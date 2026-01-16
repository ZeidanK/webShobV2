import { Request, Response, NextFunction } from 'express';
import { 
  AppError, 
  ErrorCodes, 
  NotFoundError, 
  ValidationError, 
  ConflictError, 
  ExternalServiceError,
  UnauthorizedError,
  ForbiddenError
} from '../utils/errors';
import { errorResponse } from '../utils/response';
import { createRequestLogger } from '../utils/logger';

/**
 * Check if error is one of our custom error classes
 */
function isCustomError(err: Error): boolean {
  return err instanceof NotFoundError ||
    err instanceof ValidationError ||
    err instanceof ConflictError ||
    err instanceof ExternalServiceError ||
    err instanceof UnauthorizedError ||
    err instanceof ForbiddenError;
}

/**
 * Global error handler middleware
 * Converts all errors to standard API response format
 */
export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const logger = createRequestLogger(req.correlationId);

  // Determine if this is an operational (expected) error
  const isOperational = (err instanceof AppError && err.isOperational) || isCustomError(err);

  // Log the error
  if (isOperational) {
    logger.warn('Operational error', {
      action: 'error.operational',
      error: {
        code: (err as AppError).code || err.name,
        message: err.message,
        details: (err as AppError).details,
      },
    });
  } else {
    // Unexpected errors - log full stack trace
    logger.error('Unexpected error', {
      action: 'error.unexpected',
      error: {
        message: err.message,
        stack: err.stack,
        name: err.name,
      },
    });
  }

  // Build response
  if (err instanceof AppError) {
    res.status(err.statusCode).json(
      errorResponse(err.code, err.message, req.correlationId, err.details)
    );
  } else if (isCustomError(err)) {
    // Handle our custom error classes
    const customErr = err as NotFoundError | ValidationError | ConflictError | ExternalServiceError;
    res.status(customErr.statusCode).json(
      errorResponse(customErr.code, customErr.message, req.correlationId)
    );
  } else if (err.name === 'ValidationError' && 'errors' in err) {
    // Mongoose validation error
    const mongooseErr = err as Error & { errors: Record<string, { message: string }> };
    const messages = Object.values(mongooseErr.errors).map(e => e.message).join(', ');
    res.status(400).json(
      errorResponse(ErrorCodes.VALIDATION_ERROR, messages, req.correlationId)
    );
  } else {
    // For unexpected errors, don't leak internal details
    res.status(500).json(
      errorResponse(
        ErrorCodes.INTERNAL_ERROR,
        process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
        req.correlationId
      )
    );
  }
}

/**
 * 404 Not Found handler for unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(
    errorResponse(
      ErrorCodes.RESOURCE_NOT_FOUND,
      `Route ${req.method} ${req.path} not found`,
      req.correlationId
    )
  );
}
