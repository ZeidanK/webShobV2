import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { testLogger } from '../utils/test-logger';
import { successResponse } from '../utils/response';
import { AppError } from '../utils/errors';

const router = Router();

/**
 * Test-only log ingestion endpoint (disabled in production).
 */
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    if (config.env === 'production') {
      throw new AppError('FORBIDDEN', 'Test logging is disabled in production', 403);
    }

    const { level, source, event, message, data } = req.body || {};

    if (!level || !source || !event) {
      throw new AppError('VALIDATION_ERROR', 'level, source, and event are required', 400);
    }

    testLogger.log({
      level,
      source,
      event,
      message,
      data,
    });

    res.status(201).json(
      successResponse({ status: 'logged' }, req.correlationId)
    );
  } catch (error) {
    next(error);
  }
});

export { router as testLogsRoutes };
