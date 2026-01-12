import { AuthService } from '../services/auth.service';
import { User, UserRole, AuditLog, AuditAction } from '../models';
import { AppError } from '../utils/errors';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

describe('AuthService', () => {
  const mockCompanyId = new mongoose.Types.ObjectId().toString();
  const correlationId = 'test-correlation-id';

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        companyId: mockCompanyId,
        correlationId,
      };

      const result = await AuthService.register(registerData);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(registerData.email);
      expect(result.user.firstName).toBe(registerData.firstName);
      expect(result.user.lastName).toBe(registerData.lastName);
      expect(result.user.role).toBe(UserRole.CITIZEN);

      // Verify user was created in database
      const user = await User.findOne({ email: registerData.email });
      expect(user).toBeTruthy();
      expect(user?.password).not.toBe(registerData.password); // Password should be hashed

      // Verify audit log was created
      const auditLog = await AuditLog.findOne({
        action: AuditAction.USER_REGISTERED,
        userId: user?._id,
      });
      expect(auditLog).toBeTruthy();
    });

    it('should throw error if email already exists', async () => {
      const registerData = {
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe',
        companyId: mockCompanyId,
        correlationId,
      };

      // Register first time
      await AuthService.register(registerData);

      // Try to register again with same email
      await expect(AuthService.register(registerData)).rejects.toThrow(AppError);
      await expect(AuthService.register(registerData)).rejects.toMatchObject({
        code: 'EMAIL_ALREADY_EXISTS',
        statusCode: 409,
      });
    });

    it('should hash password correctly', async () => {
      const registerData = {
        email: 'hashtest@example.com',
        password: 'PlainPassword123',
        firstName: 'Hash',
        lastName: 'Test',
        companyId: mockCompanyId,
        correlationId,
      };

      await AuthService.register(registerData);

      const user = await User.findOne({ email: registerData.email }).select('+password');
      expect(user?.password).not.toBe(registerData.password);
      expect(user?.password).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt hash pattern

      // Verify password can be compared
      const isValid = await user!.comparePassword(registerData.password);
      expect(isValid).toBe(true);

      const isInvalid = await user!.comparePassword('WrongPassword');
      expect(isInvalid).toBe(false);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Create a test user
      await AuthService.register({
        email: 'login@example.com',
        password: 'TestPass123!',
        firstName: 'Login',
        lastName: 'User',
        companyId: mockCompanyId,
        correlationId,
      });
    });

    it('should login successfully with valid credentials', async () => {
      const result = await AuthService.login({
        email: 'login@example.com',
        password: 'TestPass123!',
        correlationId,
      });

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('login@example.com');

      // Verify JWT token is valid
      const decoded = jwt.verify(result.accessToken, process.env.JWT_SECRET || 'development-secret-change-in-production') as any;
      expect(decoded.email).toBe('login@example.com');
      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('companyId');

      // Verify audit log
      const auditLog = await AuditLog.findOne({
        action: AuditAction.USER_LOGIN,
        resourceType: 'User',
      });
      expect(auditLog).toBeTruthy();
    });

    it('should throw error for invalid email', async () => {
      await expect(
        AuthService.login({
          email: 'nonexistent@example.com',
          password: 'TestPass123!',
          correlationId,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        statusCode: 401,
      });

      // Verify failed login was logged
      const auditLog = await AuditLog.findOne({
        action: AuditAction.USER_LOGIN_FAILED,
      });
      expect(auditLog).toBeTruthy();
      expect(auditLog?.metadata?.reason).toBe('User not found');
    });

    it('should throw error for invalid password', async () => {
      await expect(
        AuthService.login({
          email: 'login@example.com',
          password: 'WrongPassword',
          correlationId,
        })
      ).rejects.toMatchObject({
        code: 'INVALID_CREDENTIALS',
        statusCode: 401,
      });

      // Verify failed login was logged
      const auditLog = await AuditLog.findOne({
        action: AuditAction.USER_LOGIN_FAILED,
        'metadata.reason': 'Invalid password',
      });
      expect(auditLog).toBeTruthy();
    });

    it('should lock account after 5 failed login attempts', async () => {
      // Attempt login 5 times with wrong password
      for (let i = 0; i < 5; i++) {
        try {
          await AuthService.login({
            email: 'login@example.com',
            password: 'WrongPassword',
            correlationId,
          });
        } catch (error) {
          // Expected to fail
        }
      }

      // Next attempt should return account locked error
      await expect(
        AuthService.login({
          email: 'login@example.com',
          password: 'TestPass123!', // Even with correct password
          correlationId,
        })
      ).rejects.toMatchObject({
        code: 'ACCOUNT_LOCKED',
        statusCode: 423,
      });

      // Verify user is locked
      const user = await User.findOne({ email: 'login@example.com' });
      expect(user?.isLocked()).toBe(true);
    });

    it('should reset login attempts after successful login', async () => {
      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        try {
          await AuthService.login({
            email: 'login@example.com',
            password: 'WrongPassword',
            correlationId,
          });
        } catch (error) {
          // Expected
        }
      }

      let user = await User.findOne({ email: 'login@example.com' });
      expect(user?.loginAttempts).toBe(3);

      // Login successfully
      await AuthService.login({
        email: 'login@example.com',
        password: 'TestPass123!',
        correlationId,
      });

      // Verify attempts were reset
      user = await User.findOne({ email: 'login@example.com' });
      expect(user?.loginAttempts).toBe(0);
      expect(user?.lockUntil).toBeUndefined();
    });

    it('should throw error for inactive account', async () => {
      // Deactivate user
      await User.updateOne({ email: 'login@example.com' }, { isActive: false });

      await expect(
        AuthService.login({
          email: 'login@example.com',
          password: 'TestPass123!',
          correlationId,
        })
      ).rejects.toMatchObject({
        code: 'ACCOUNT_INACTIVE',
        statusCode: 403,
      });
    });
  });

  describe('refreshAccessToken', () => {
    let refreshToken: string;
    let userId: string;

    beforeEach(async () => {
      const result = await AuthService.register({
        email: 'refresh@example.com',
        password: 'TestPass123!',
        firstName: 'Refresh',
        lastName: 'User',
        companyId: mockCompanyId,
        correlationId,
      });
      refreshToken = result.refreshToken;
      userId = result.user.id;
    });

    it('should refresh access token successfully', async () => {
      // Wait a moment to ensure different iat timestamp
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      const result = await AuthService.refreshAccessToken(refreshToken, correlationId);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.refreshToken).not.toBe(refreshToken); // New refresh token

      // Verify new tokens are valid
      const decoded = jwt.verify(result.accessToken, process.env.JWT_SECRET || 'development-secret-change-in-production') as any;
      expect(decoded.userId).toBe(userId);
    });

    it('should throw error for invalid refresh token', async () => {
      await expect(
        AuthService.refreshAccessToken('invalid-token', correlationId)
      ).rejects.toMatchObject({
        code: 'INVALID_REFRESH_TOKEN',
        statusCode: 401,
      });
    });

    it('should throw error if user is inactive', async () => {
      await User.updateOne({ email: 'refresh@example.com' }, { isActive: false });

      await expect(
        AuthService.refreshAccessToken(refreshToken, correlationId)
      ).rejects.toMatchObject({
        code: 'INVALID_REFRESH_TOKEN',
        statusCode: 401,
      });
    });
  });

  describe('requestPasswordReset', () => {
    beforeEach(async () => {
      await AuthService.register({
        email: 'reset@example.com',
        password: 'TestPass123!',
        firstName: 'Reset',
        lastName: 'User',
        companyId: mockCompanyId,
        correlationId,
      });
    });

    it('should generate password reset token', async () => {
      const resetToken = await AuthService.requestPasswordReset('reset@example.com', correlationId);

      expect(typeof resetToken).toBe('string');
      expect(resetToken.length).toBeGreaterThan(0);

      // Verify token was stored (hashed)
      const user = await User.findOne({ email: 'reset@example.com' }).select('+passwordResetToken +passwordResetExpiry');
      expect(user?.passwordResetToken).toBeTruthy();
      expect(user?.passwordResetExpiry).toBeInstanceOf(Date);
      expect(user?.passwordResetExpiry!.getTime()).toBeGreaterThan(Date.now());

      // Verify audit log
      const auditLog = await AuditLog.findOne({
        action: AuditAction.USER_PASSWORD_RESET_REQUESTED,
      });
      expect(auditLog).toBeTruthy();
    });

    it('should not reveal if email does not exist', async () => {
      const result = await AuthService.requestPasswordReset('nonexistent@example.com', correlationId);
      expect(result).toBe('If the email exists, a password reset link has been sent');
    });
  });

  describe('resetPassword', () => {
    let resetToken: string;

    beforeEach(async () => {
      await AuthService.register({
        email: 'newpass@example.com',
        password: 'OldPass123!',
        firstName: 'NewPass',
        lastName: 'User',
        companyId: mockCompanyId,
        correlationId,
      });
      resetToken = await AuthService.requestPasswordReset('newpass@example.com', correlationId);
    });

    it('should reset password successfully', async () => {
      await AuthService.resetPassword(resetToken, 'NewPass456!', correlationId);

      // Verify old password no longer works
      await expect(
        AuthService.login({
          email: 'newpass@example.com',
          password: 'OldPass123!',
          correlationId,
        })
      ).rejects.toThrow();

      // Verify new password works
      const result = await AuthService.login({
        email: 'newpass@example.com',
        password: 'NewPass456!',
        correlationId,
      });
      expect(result).toHaveProperty('accessToken');

      // Verify audit log
      const auditLog = await AuditLog.findOne({
        action: AuditAction.USER_PASSWORD_RESET_COMPLETED,
      });
      expect(auditLog).toBeTruthy();
    });

    it('should throw error for invalid reset token', async () => {
      await expect(
        AuthService.resetPassword('invalid-token', 'NewPass456!', correlationId)
      ).rejects.toMatchObject({
        code: 'INVALID_RESET_TOKEN',
        statusCode: 400,
      });
    });

    it('should throw error for expired reset token', async () => {
      // Manually expire the token
      await User.updateOne(
        { email: 'newpass@example.com' },
        { passwordResetExpiry: new Date(Date.now() - 1000) }
      );

      await expect(
        AuthService.resetPassword(resetToken, 'NewPass456!', correlationId)
      ).rejects.toMatchObject({
        code: 'INVALID_RESET_TOKEN',
        statusCode: 400,
      });
    });
  });

  describe('verifyToken', () => {
    it('should verify valid JWT token', async () => {
      const result = await AuthService.register({
        email: 'verify@example.com',
        password: 'TestPass123!',
        firstName: 'Verify',
        lastName: 'User',
        companyId: mockCompanyId,
        correlationId,
      });

      const decoded = AuthService.verifyToken(result.accessToken);

      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('email');
      expect(decoded).toHaveProperty('role');
      expect(decoded).toHaveProperty('companyId');
      expect(decoded.email).toBe('verify@example.com');
    });

    it('should throw error for invalid token', () => {
      try {
        AuthService.verifyToken('invalid-token');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('INVALID_TOKEN');
      }
    });

    it('should throw error for expired token', () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId: '123', email: 'test@example.com', role: 'citizen', companyId: mockCompanyId },
        process.env.JWT_SECRET || 'development-secret-change-in-production',
        { expiresIn: '-1s' } // Already expired
      );

      try {
        AuthService.verifyToken(expiredToken);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe('TOKEN_EXPIRED');
      }
    });
  });
});
