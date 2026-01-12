import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AuthService } from '../services/auth.service';
import { successResponse } from '../utils/response';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { UserRole } from '../models';

const router = Router();

/**
 * Validation Schemas
 */
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'any.required': 'Password is required',
  }),
  firstName: Joi.string().trim().max(50).required().messages({
    'string.max': 'First name cannot exceed 50 characters',
    'any.required': 'First name is required',
  }),
  lastName: Joi.string().trim().max(50).required().messages({
    'string.max': 'Last name cannot exceed 50 characters',
    'any.required': 'Last name is required',
  }),
  companyId: Joi.string().required().messages({
    'any.required': 'Company ID is required',
  }),
  role: Joi.string().valid(...Object.values(UserRole)).optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required',
  }),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Reset token is required',
  }),
  password: Joi.string().min(8).required().messages({
    'string.min': 'Password must be at least 8 characters',
    'any.required': 'Password is required',
  }),
});

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new user
 *     description: Create a new user account with email and password. Returns JWT tokens for immediate authentication.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - companyId
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123!
 *               firstName:
 *                 type: string
 *                 maxLength: 50
 *                 example: John
 *               lastName:
 *                 type: string
 *                 maxLength: 50
 *                 example: Doe
 *               companyId:
 *                 type: string
 *                 format: uuid
 *                 example: 507f1f77bcf86cd799439011
 *               role:
 *                 type: string
 *                 enum: [citizen, first_responder, operator, admin, company_admin, super_admin]
 *                 default: citizen
 *     responses:
 *       201:
 *         description: User registered successfully
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
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         firstName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         role:
 *                           type: string
 *                         companyId:
 *                           type: string
 *                     accessToken:
 *                       type: string
 *                       description: JWT access token (expires in 15 minutes)
 *                     refreshToken:
 *                       type: string
 *                       description: JWT refresh token (expires in 7 days)
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already exists
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      throw new AppError('VALIDATION_ERROR', error.details[0].message, 400, { details: error.details });
    }

    // Register user
    const result = await AuthService.register({
      ...value,
      correlationId: req.correlationId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json(successResponse(result, req.correlationId));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login user
 *     description: Authenticate user with email and password. Returns JWT tokens.
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
 *                 example: john.doe@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *     responses:
 *       200:
 *         description: Login successful
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
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         email:
 *                           type: string
 *                         firstName:
 *                           type: string
 *                         lastName:
 *                           type: string
 *                         role:
 *                           type: string
 *                         companyId:
 *                           type: string
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                 correlationId:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account inactive
 *       423:
 *         description: Account locked due to too many failed login attempts
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      throw new AppError('VALIDATION_ERROR', error.details[0].message, 400, { details: error.details });
    }

    // Login user
    const result = await AuthService.login({
      ...value,
      correlationId: req.correlationId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json(successResponse(result, req.correlationId));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Refresh access token
 *     description: Generate a new access token using a valid refresh token.
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
 *                 description: The refresh token received during login/registration
 *     responses:
 *       200:
 *         description: Token refreshed successfully
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
 *                     accessToken:
 *                       type: string
 *                       description: New JWT access token
 *                     refreshToken:
 *                       type: string
 *                       description: New JWT refresh token
 *                 correlationId:
 *                   type: string
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request
    const { error, value } = refreshSchema.validate(req.body);
    if (error) {
      throw new AppError('VALIDATION_ERROR', error.details[0].message, 400, { details: error.details });
    }

    // Refresh token
    const result = await AuthService.refreshAccessToken(value.refreshToken, req.correlationId);

    res.json(successResponse(result, req.correlationId));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/forgot-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Request password reset
 *     description: Send a password reset token to the user's email (token returned in response for development).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *     responses:
 *       200:
 *         description: Password reset email sent (if email exists)
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
 *                     message:
 *                       type: string
 *                       example: If the email exists, a password reset link has been sent
 *                     resetToken:
 *                       type: string
 *                       description: Password reset token (development only)
 *                 correlationId:
 *                   type: string
 */
router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request
    const { error, value } = forgotPasswordSchema.validate(req.body);
    if (error) {
      throw new AppError('VALIDATION_ERROR', error.details[0].message, 400, { details: error.details });
    }

    // Request password reset
    const resetToken = await AuthService.requestPasswordReset(
      value.email,
      req.correlationId,
      req.ip,
      req.get('user-agent')
    );

    // In development, return the token. In production, only send via email.
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    
    const responseData: any = {
      message: 'If the email exists, a password reset link has been sent',
    };
    
    if (isDevelopment && resetToken !== 'If the email exists, a password reset link has been sent') {
      responseData.resetToken = resetToken;
    }
    
    res.json(successResponse(responseData, req.correlationId));
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/auth/reset-password:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Reset password
 *     description: Reset user password using a valid reset token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *                 description: Password reset token received from forgot-password endpoint
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: NewSecurePass123!
 *     responses:
 *       200:
 *         description: Password reset successfully
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
 *                     message:
 *                       type: string
 *                       example: Password reset successfully
 *                 correlationId:
 *                   type: string
 *       400:
 *         description: Invalid or expired reset token
 */
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request
    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) {
      throw new AppError('VALIDATION_ERROR', error.details[0].message, 400, { details: error.details });
    }

    // Reset password
    await AuthService.resetPassword(
      value.token,
      value.password,
      req.correlationId,
      req.ip,
      req.get('user-agent')
    );

    res.json(successResponse({
      message: 'Password reset successfully',
    }, req.correlationId));
  } catch (error) {
    next(error);
  }
});

export default router;
