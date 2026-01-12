import { Router, Request, Response } from 'express';
import { successResponse } from '../utils/response.js';

const router = Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the API
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: ok
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     version:
 *                       type: string
 *                       example: "1.0.0"
 *                 correlationId:
 *                   type: string
 *                   format: uuid
 */
router.get('/', (req: Request, res: Response) => {
  res.json(
    successResponse(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
      },
      req.correlationId
    )
  );
});

/**
 * @openapi
 * /api/health/detailed:
 *   get:
 *     summary: Detailed health check
 *     description: Returns detailed health status including database connectivity
 *     tags:
 *       - System
 *     responses:
 *       200:
 *         description: Detailed health information
 */
router.get('/detailed', async (req: Request, res: Response) => {
  // TODO: Add actual health checks for database, Redis, etc.
  res.json(
    successResponse(
      {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime_seconds: Math.floor(process.uptime()),
        components: {
          database: { status: 'ok', latency_ms: 0 }, // TODO: Implement
          // aiService: { status: 'ok', latency_ms: 0 }, // TODO: Implement
        },
      },
      req.correlationId
    )
  );
});

export const healthRoutes = router;
