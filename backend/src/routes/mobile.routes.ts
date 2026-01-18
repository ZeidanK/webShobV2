import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { rateLimitMobile } from '../middleware/rate-limit.middleware';
import { apiKeyScoping } from '../middleware/api-key-scoping.middleware';
import { UserRole } from '../models/user.model';
import * as mobileAuthController from '../controllers/mobile-auth.controller';
import * as mobileReportController from '../controllers/mobile-report.controller';
import * as mobileEventController from '../controllers/mobile-event.controller';
import * as mobileUserController from '../controllers/mobile-user.controller';

const router = Router();

// Apply rate limiting and API key scoping to all mobile routes
router.use(rateLimitMobile);
router.use(apiKeyScoping(['mobile']));

// Authentication routes (no auth required)
/**
 * @swagger
 * /api/mobile/auth/login:
 *   post:
 *     summary: Mobile authentication with API key and user credentials
 *     description: Authenticate mobile users using company API key and user credentials
 *     tags: [Mobile Auth]
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *           example:
 *             email: citizen@example.com
 *             password: securePassword123
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:
 *                           $ref: '#/components/schemas/User'
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/auth/login', mobileAuthController.login);

/**
 * @swagger
 * /api/mobile/auth/refresh:
 *   post:
 *     summary: Refresh mobile access token
 *     description: Get new access token using refresh token
 *     tags: [Mobile Auth]
 *     security:
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *           example:
 *             refreshToken: eyJhbGciOiJIUzI1NiIs...
 *     responses:
 *       200:
 *         description: Token refresh successful
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.post('/auth/refresh', mobileAuthController.refresh);

// Protected routes (require JWT authentication via Bearer token)
router.use(authenticate);

// Report routes
/**
 * @swagger
 * /api/mobile/reports:
 *   get:
 *     summary: Get citizen's own reports
 *     description: Retrieve reports submitted by the authenticated citizen
 *     tags: [Mobile Reports]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, verified, rejected]
 *     responses:
 *       200:
 *         description: Reports retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Report'
 *                     meta:
 *                       $ref: '#/components/schemas/PaginationMeta'
 */
router.get('/reports', authorize(UserRole.CITIZEN), mobileReportController.getUserReports);

/**
 * @swagger
 * /api/mobile/reports:
 *   post:
 *     summary: Submit new citizen report
 *     description: Create a new report via mobile app
 *     tags: [Mobile Reports]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReportRequest'
 *     responses:
 *       201:
 *         description: Report created successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/reports', authorize(UserRole.CITIZEN), mobileReportController.createReport);

/**
 * @swagger
 * /api/mobile/reports/{id}/attachments:
 *   post:
 *     summary: Add attachment to report
 *     description: Upload file attachment to existing report
 *     tags: [Mobile Reports]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Attachment uploaded successfully
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.post('/reports/:id/attachments', authorize(UserRole.CITIZEN), mobileReportController.addAttachment);

// Event assignment routes (for responders)
/**
 * @swagger
 * /api/mobile/events/assignments:
 *   get:
 *     summary: Get responder event assignments
 *     description: Retrieve events assigned to the authenticated responder
 *     tags: [Mobile Events]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Assignments retrieved successfully
 */
router.get('/events/assignments', authorize(UserRole.FIRST_RESPONDER), mobileEventController.getAssignments);

/**
 * @swagger
 * /api/mobile/events/{id}:
 *   get:
 *     summary: Get event assignment details
 *     description: Get detailed information about a specific event assignment
 *     tags: [Mobile Events]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event details retrieved successfully
 */
router.get('/events/:id', authorize(UserRole.FIRST_RESPONDER), mobileEventController.getAssignmentDetails);

/**
 * @swagger
 * /api/mobile/events/{id}/status:
 *   patch:
 *     summary: Update event status
 *     description: Update event status from mobile responder app
 *     tags: [Mobile Events]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [assigned, in_progress, resolved]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Event status updated successfully
 */
router.patch('/events/:id/status', authorize(UserRole.FIRST_RESPONDER), mobileEventController.updateStatus);

// Responder location routes
/**
 * @swagger
 * /api/mobile/users/location:
 *   get:
 *     summary: Get responder's current location
 *     description: Retrieve current location of the authenticated responder
 *     tags: [Mobile Users]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Location retrieved successfully
 */
router.get('/users/location', authorize(UserRole.FIRST_RESPONDER), mobileUserController.getLocation);

/**
 * @swagger
 * /api/mobile/users/location:
 *   post:
 *     summary: Update responder location
 *     description: Update current location of responder for tracking
 *     tags: [Mobile Users]
 *     security:
 *       - apiKeyAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - location
 *             properties:
 *               location:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [Point]
 *                   coordinates:
 *                     type: array
 *                     items:
 *                       type: number
 *                     minItems: 2
 *                     maxItems: 2
 *               accuracy:
 *                 type: number
 *                 description: Location accuracy in meters
 *     responses:
 *       200:
 *         description: Location updated successfully
 */
router.post('/users/location', authorize(UserRole.FIRST_RESPONDER), mobileUserController.updateLocation);

export default router;