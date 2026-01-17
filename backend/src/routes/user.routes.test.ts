import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../app';
import { Company, User, UserRole, CompanyStatus } from '../models';
import { AuthService } from '../services';
import { setupTestDB, teardownTestDB, clearDatabase } from '../test/helpers';

describe('User Routes Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('POST /api/users', () => {
    it('should create a user as admin', async () => {
      const company = await Company.create({
        name: 'Test Company',
        status: CompanyStatus.ACTIVE,
      });

      const admin = await User.create({
        email: 'admin@company.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        companyId: company._id,
      });

      const token = AuthService.generateToken({
        userId: admin._id.toString(),
        email: admin.email,
        role: admin.role,
        companyId: admin.companyId.toString(),
      });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'newuser@company.com',
          password: 'password123',
          firstName: 'New',
          lastName: 'User',
          role: UserRole.OPERATOR,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('newuser@company.com');
      expect(response.body.data.role).toBe(UserRole.OPERATOR);
      expect(response.body.data.companyId).toBe(company._id.toString());
      expect(response.body.data.password).toBeUndefined(); // Password should not be returned
    });

    it('should enforce role hierarchy - admin cannot create admin', async () => {
      const company = await Company.create({
        name: 'Test Company',
        status: CompanyStatus.ACTIVE,
      });

      const admin = await User.create({
        email: 'admin@company.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        companyId: company._id,
      });

      const token = AuthService.generateToken({
        userId: admin._id.toString(),
        email: admin.email,
        role: admin.role,
        companyId: admin.companyId.toString(),
      });

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'newadmin@company.com',
          password: 'password123',
          firstName: 'New',
          lastName: 'Admin',
          role: UserRole.ADMIN,
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ROLE_HIERARCHY_VIOLATION');
    });

    it('should reject user creation from operator', async () => {
      const company = await Company.create({
        name: 'Test Company',
        status: CompanyStatus.ACTIVE,
      });

      const operator = await User.create({
        email: 'operator@company.com',
        password: 'password123',
        firstName: 'Operator',
        lastName: 'User',
        role: UserRole.OPERATOR,
        companyId: company._id,
      });

      const token = AuthService.generateToken({
        userId: operator._id.toString(),
        email: operator.email,
        role: operator.role,
        companyId: operator.companyId.toString(),
      });

      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .send({
          email: 'newuser@company.com',
          password: 'password123',
          firstName: 'New',
          lastName: 'User',
          role: UserRole.CITIZEN,
        })
        .expect(403);
    });
  });

  describe('GET /api/users', () => {
    it('should list users in same company only', async () => {
      const company1 = await Company.create({
        name: 'Company 1',
        status: CompanyStatus.ACTIVE,
      });

      const company2 = await Company.create({
        name: 'Company 2',
        status: CompanyStatus.ACTIVE,
      });

      // Create users in company 1
      await User.create({
        email: 'user1@company1.com',
        password: 'password123',
        firstName: 'User',
        lastName: 'One',
        role: UserRole.OPERATOR,
        companyId: company1._id,
      });

      const requestingUser = await User.create({
        email: 'admin@company1.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        companyId: company1._id,
      });

      // Create user in company 2
      await User.create({
        email: 'user@company2.com',
        password: 'password123',
        firstName: 'User',
        lastName: 'Two',
        role: UserRole.OPERATOR,
        companyId: company2._id,
      });

      const token = AuthService.generateToken({
        userId: requestingUser._id.toString(),
        email: requestingUser.email,
        role: requestingUser.role,
        companyId: requestingUser.companyId.toString(),
      });

      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2); // Only company 1 users
      expect(response.body.meta.total).toBe(2);
      
      // Verify no company 2 users
      const emails = response.body.data.map((u: any) => u.email);
      expect(emails).not.toContain('user@company2.com');
    });

    it('should support pagination', async () => {
      const company = await Company.create({
        name: 'Test Company',
        status: CompanyStatus.ACTIVE,
      });

      // Create 5 users
      for (let i = 0; i < 5; i++) {
        await User.create({
          email: `user${i}@company.com`,
          password: 'password123',
          firstName: 'User',
          lastName: `${i}`,
          role: UserRole.OPERATOR,
          companyId: company._id,
        });
      }

      const admin = await User.create({
        email: 'admin@company.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        companyId: company._id,
      });

      const token = AuthService.generateToken({
        userId: admin._id.toString(),
        email: admin.email,
        role: admin.role,
        companyId: admin.companyId.toString(),
      });

      const response = await request(app)
        .get('/api/users?page=1&pageSize=3')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.pageSize).toBe(3);
      expect(response.body.meta.total).toBe(6);
    });

    it('should filter by role', async () => {
      const company = await Company.create({
        name: 'Test Company',
        status: CompanyStatus.ACTIVE,
      });

      await User.create({
        email: 'operator@company.com',
        password: 'password123',
        firstName: 'Operator',
        lastName: 'User',
        role: UserRole.OPERATOR,
        companyId: company._id,
      });

      await User.create({
        email: 'citizen@company.com',
        password: 'password123',
        firstName: 'Citizen',
        lastName: 'User',
        role: UserRole.CITIZEN,
        companyId: company._id,
      });

      const admin = await User.create({
        email: 'admin@company.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        companyId: company._id,
      });

      const token = AuthService.generateToken({
        userId: admin._id.toString(),
        email: admin.email,
        role: admin.role,
        companyId: admin.companyId.toString(),
      });

      const response = await request(app)
        .get(`/api/users?role=${UserRole.OPERATOR}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].role).toBe(UserRole.OPERATOR);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should get user by ID in same company', async () => {
      const company = await Company.create({
        name: 'Test Company',
        status: CompanyStatus.ACTIVE,
      });

      const targetUser = await User.create({
        email: 'user@company.com',
        password: 'password123',
        firstName: 'Target',
        lastName: 'User',
        role: UserRole.OPERATOR,
        companyId: company._id,
      });

      const requestingUser = await User.create({
        email: 'admin@company.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.OPERATOR,
        companyId: company._id,
      });

      const token = AuthService.generateToken({
        userId: requestingUser._id.toString(),
        email: requestingUser.email,
        role: requestingUser.role,
        companyId: requestingUser.companyId.toString(),
      });

      const response = await request(app)
        .get(`/api/users/${targetUser._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('user@company.com');
    });

    it('should reject access to user in different company', async () => {
      const company1 = await Company.create({
        name: 'Company 1',
        status: CompanyStatus.ACTIVE,
      });

      const company2 = await Company.create({
        name: 'Company 2',
        status: CompanyStatus.ACTIVE,
      });

      const targetUser = await User.create({
        email: 'user@company2.com',
        password: 'password123',
        firstName: 'Target',
        lastName: 'User',
        role: UserRole.OPERATOR,
        companyId: company2._id,
      });

      const requestingUser = await User.create({
        email: 'admin@company1.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        companyId: company1._id,
      });

      const token = AuthService.generateToken({
        userId: requestingUser._id.toString(),
        email: requestingUser.email,
        role: requestingUser.role,
        companyId: requestingUser.companyId.toString(),
      });

      const response = await request(app)
        .get(`/api/users/${targetUser._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.error.code).toBe('TENANT_MISMATCH');
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('should update user as admin', async () => {
      const company = await Company.create({
        name: 'Test Company',
        status: CompanyStatus.ACTIVE,
      });

      const targetUser = await User.create({
        email: 'user@company.com',
        password: 'password123',
        firstName: 'Old',
        lastName: 'Name',
        role: UserRole.OPERATOR,
        companyId: company._id,
      });

      const admin = await User.create({
        email: 'admin@company.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        companyId: company._id,
      });

      const token = AuthService.generateToken({
        userId: admin._id.toString(),
        email: admin.email,
        role: admin.role,
        companyId: admin.companyId.toString(),
      });

      const response = await request(app)
        .patch(`/api/users/${targetUser._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'New',
          lastName: 'Name',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe('New');
      expect(response.body.data.lastName).toBe('Name');
    });

    it('should enforce role hierarchy on role change', async () => {
      const company = await Company.create({
        name: 'Test Company',
        status: CompanyStatus.ACTIVE,
      });

      const targetUser = await User.create({
        email: 'user@company.com',
        password: 'password123',
        firstName: 'User',
        lastName: 'Name',
        role: UserRole.OPERATOR,
        companyId: company._id,
      });

      const admin = await User.create({
        email: 'admin@company.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        companyId: company._id,
      });

      const token = AuthService.generateToken({
        userId: admin._id.toString(),
        email: admin.email,
        role: admin.role,
        companyId: admin.companyId.toString(),
      });

      // Try to upgrade to admin (should fail)
      const response = await request(app)
        .patch(`/api/users/${targetUser._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          role: UserRole.ADMIN,
        })
        .expect(403);

      expect(response.body.error.code).toBe('ROLE_HIERARCHY_VIOLATION');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should soft delete user as admin', async () => {
      const company = await Company.create({
        name: 'Test Company',
        status: CompanyStatus.ACTIVE,
      });

      const targetUser = await User.create({
        email: 'user@company.com',
        password: 'password123',
        firstName: 'User',
        lastName: 'Name',
        role: UserRole.OPERATOR,
        companyId: company._id,
      });

      const admin = await User.create({
        email: 'admin@company.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        companyId: company._id,
      });

      const token = AuthService.generateToken({
        userId: admin._id.toString(),
        email: admin.email,
        role: admin.role,
        companyId: admin.companyId.toString(),
      });

      const response = await request(app)
        .delete(`/api/users/${targetUser._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify user is soft deleted
      const deletedUser = await User.findById(targetUser._id);
      expect(deletedUser?.isActive).toBe(false);
    });

    it('should prevent self-deletion', async () => {
      const company = await Company.create({
        name: 'Test Company',
        status: CompanyStatus.ACTIVE,
      });

      const admin = await User.create({
        email: 'admin@company.com',
        password: 'password123',
        firstName: 'Admin',
        lastName: 'User',
        role: UserRole.ADMIN,
        companyId: company._id,
      });

      const token = AuthService.generateToken({
        userId: admin._id.toString(),
        email: admin.email,
        role: admin.role,
        companyId: admin.companyId.toString(),
      });

      const response = await request(app)
        .delete(`/api/users/${admin._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.error.code).toBe('SELF_DELETION');
    });
  });
});
