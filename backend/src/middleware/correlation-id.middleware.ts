import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

/**
 * Middleware to attach correlation ID to every request
 * - Uses X-Correlation-ID header if provided (for request tracing)
 * - Generates new UUID if not provided
 * - Adds to response headers
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use provided correlation ID or generate new one
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();

  // Attach to request object for use in handlers
  req.correlationId = correlationId;

  // Include in response headers
  res.setHeader('X-Correlation-ID', correlationId);

  next();
}
