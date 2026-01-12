import request from 'supertest';
import { app } from '../app';
import { User, AuditLog, AuditAction } from '../models';
import mongoose from 'mongoose';

describe('Auth Routes Integration Tests', () => {
  const mockCompanyId = new mongoose.Types.ObjectId().toString();

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          firstName: 'New',
          lastName: 'User',
          companyId: mockCompanyId,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe('newuser@example.com');
      expect(response.body).toHaveProperty('correlationId');
      expect(response.headers['x-correlation-id']).toBeTruthy();

      // Verify user in database
      const user = await User.findOne({ email: 'newuser@example.com' });
      expect(user).toBeTruthy();
      expect(user?.firstName).toBe('New');
      expect(user?.lastName).toBe('User');
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123!',
          firstName: 'Test',
          lastName: 'User',
          companyId: mockCompanyId,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'short',
          firstName: 'Test',
          lastName: 'User',
          companyId: mockCompanyId,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toMatch(/at least 8 characters/i);
    });

    it('should return 409 for duplicate email', async () => {
      // Register first user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'SecurePass123!',
          firstName: 'First',
          lastName: 'User',
          companyId: mockCompanyId,
        })
        .expect(201);

      // Try to register with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'AnotherPass123!',
          firstName: 'Second',
          lastName: 'User',
          companyId: mockCompanyId,
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    });

    it('should create audit log entry', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'audit@example.com',
          password: 'SecurePass123!',
          firstName: 'Audit',
          lastName: 'User',
          companyId: mockCompanyId,
        })
        .expect(201);

      const auditLog = await AuditLog.findOne({
        action: AuditAction.USER_REGISTERED,
        'metadata.email': 'audit@example.com',
      });
      expect(auditLog).toBeTruthy();
      expect(auditLog?.companyId.toString()).toBe(mockCompanyId);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create test user
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'logintest@example.com',
          password: 'TestPass123!',
          firstName: 'Login',
          lastName: 'Test',
          companyId: mockCompanyId,
        });
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'TestPass123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe('logintest@example.com');

      // Verify audit log
      const auditLog = await AuditLog.findOne({
        action: AuditAction.USER_LOGIN,
        'metadata.email': 'logintest@example.com',
      });
      expect(auditLog).toBeTruthy();
    });

    it('should return 401 for invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'TestPass123!',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');

      // Verify failed login was logged
      const auditLog = await AuditLog.findOne({
        action: AuditAction.USER_LOGIN_FAILED,
        'metadata.reason': 'User not found',
      });
      expect(auditLog).toBeTruthy();
    });

    it('should return 401 for invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'WrongPassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');

      // Verify login attempts incremented
      const user = await User.findOne({ email: 'logintest@example.com' });
      expect(user?.loginAttempts).toBeGreaterThan(0);
    });

    it('should lock account after 5 failed attempts', async () => {
      // Fail 5 times
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'logintest@example.com',
            password: 'WrongPassword',
          });
      }

      // Next attempt should be locked
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'TestPass123!',
        })
        .expect(423);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ACCOUNT_LOCKED');
    });

    it('should return 403 for inactive account', async () => {
      // Deactivate user
      await User.updateOne({ email: 'logintest@example.com' }, { isActive: false });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'logintest@example.com',
          password: 'TestPass123!',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'refreshtest@example.com',
          password: 'TestPass123!',
          firstName: 'Refresh',
          lastName: 'Test',
          companyId: mockCompanyId,
        });
      refreshToken = response.body.data.refreshToken;
    });

    it('should refresh access token successfully', async () => {
      // Wait to ensure different iat timestamp
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.refreshToken).not.toBe(refreshToken);
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'forgot@example.com',
          password: 'TestPass123!',
          firstName: 'Forgot',
          lastName: 'Test',
          companyId: mockCompanyId,
        });
    });

    it('should generate password reset token', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'forgot@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('password reset');
      expect(response.body.data).toHaveProperty('resetToken'); // Development mode

      // Verify audit log
      const auditLog = await AuditLog.findOne({
        action: AuditAction.USER_PASSWORD_RESET_REQUESTED,
      });
      expect(auditLog).toBeTruthy();
    });

    it('should not reveal if email does not exist', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('password reset');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    let resetToken: string;

    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'reset@example.com',
          password: 'OldPass123!',
          firstName: 'Reset',
          lastName: 'Test',
          companyId: mockCompanyId,
        });

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'reset@example.com' });
      resetToken = response.body.data.resetToken;
    });

    it('should reset password successfully', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          password: 'NewPass456!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('Password reset successfully');

      // Verify old password no longer works
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'reset@example.com',
          password: 'OldPass123!',
        })
        .expect(401);

      // Verify new password works
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'reset@example.com',
          password: 'NewPass456!',
        })
        .expect(200);

      // Verify audit log
      const auditLog = await AuditLog.findOne({
        action: AuditAction.USER_PASSWORD_RESET_COMPLETED,
      });
      expect(auditLog).toBeTruthy();
    });

    it('should return 400 for invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'NewPass456!',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_RESET_TOKEN');
    });
  });

  describe('Tenant isolation', () => {
    const company1Id = new mongoose.Types.ObjectId().toString();
    const company2Id = new mongoose.Types.ObjectId().toString();

    it('should isolate users by companyId', async () => {
      // Create users in different companies
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'company1@example.com',
          password: 'TestPass123!',
          firstName: 'Company1',
          lastName: 'User',
          companyId: company1Id,
        })
        .expect(201);

      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'company2@example.com',
          password: 'TestPass123!',
          firstName: 'Company2',
          lastName: 'User',
          companyId: company2Id,
        })
        .expect(201);

      // Verify users have different companyIds
      const user1 = await User.findOne({ email: 'company1@example.com' });
      const user2 = await User.findOne({ email: 'company2@example.com' });

      expect(user1?.companyId.toString()).toBe(company1Id);
      expect(user2?.companyId.toString()).toBe(company2Id);
      expect(user1?.companyId.toString()).not.toBe(user2?.companyId.toString());
    });

    it('should include correlationId in all responses', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'correlation@example.com',
          password: 'TestPass123!',
          firstName: 'Correlation',
          lastName: 'User',
          companyId: mockCompanyId,
        })
        .expect(201);

      expect(response.body.correlationId).toBeTruthy();
      expect(response.headers['x-correlation-id']).toBe(response.body.correlationId);
    });
  });
});
