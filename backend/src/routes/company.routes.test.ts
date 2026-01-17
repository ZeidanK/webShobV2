import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../app';
import { Company, User, UserRole, CompanyStatus } from '../models';
import { AuthService } from '../services';
import { setupTestDB, teardownTestDB, clearDatabase } from '../test/helpers';

describe('Company Routes Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  describe('POST /api/companies', () => {
    it('should create a company as super_admin', async () => {
      // Create super_admin user
      const company1 = await Company.create({
        name: 'Platform Admin Company',
        status: CompanyStatus.ACTIVE,
      });

      const superAdmin = await User.create({
        email: 'super@admin.com',
        password: 'password123',
        firstName: 'Super',
        lastName: 'Admin',
        role: UserRole.SUPER_ADMIN,
        companyId: company1._id,
      });

      const token = AuthService.generateToken({
        userId: superAdmin._id.toString(),
        email: superAdmin.email,
        role: superAdmin.role,
        companyId: superAdmin.companyId.toString(),
      });

      const response = await request(app)
        .post('/api/companies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Company',
          type: 'standard',
          contactEmail: 'contact@test.com',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Company');
      expect(response.body.data.type).toBe('standard');
      expect(response.body.data.status).toBe('active');
      expect(response.body.correlationId).toBeDefined();
    });

    it('should reject company creation from non-super_admin', async () => {
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
        .post('/api/companies')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Another Company',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });
  });

  describe('GET /api/companies/:id', () => {
    it('should allow user to get their own company', async () => {
      const company = await Company.create({
        name: 'Test Company',
        status: CompanyStatus.ACTIVE,
      });

      const user = await User.create({
        email: 'user@company.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.OPERATOR,
        companyId: company._id,
      });

      const token = AuthService.generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        companyId: user.companyId.toString(),
      });

      const response = await request(app)
        .get(`/api/companies/${company._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Company');
    });

    it('should reject access to another company (tenant isolation)', async () => {
      const company1 = await Company.create({
        name: 'Company 1',
        status: CompanyStatus.ACTIVE,
      });

      const company2 = await Company.create({
        name: 'Company 2',
        status: CompanyStatus.ACTIVE,
      });

      const user = await User.create({
        email: 'user@company1.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.ADMIN,
        companyId: company1._id,
      });

      const token = AuthService.generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        companyId: user.companyId.toString(),
      });

      const response = await request(app)
        .get(`/api/companies/${company2._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TENANT_MISMATCH');
    });

    it('should allow super_admin to access any company', async () => {
      const platformCompany = await Company.create({
        name: 'Platform',
        status: CompanyStatus.ACTIVE,
      });

      const targetCompany = await Company.create({
        name: 'Target Company',
        status: CompanyStatus.ACTIVE,
      });

      const superAdmin = await User.create({
        email: 'super@admin.com',
        password: 'password123',
        firstName: 'Super',
        lastName: 'Admin',
        role: UserRole.SUPER_ADMIN,
        companyId: platformCompany._id,
      });

      const token = AuthService.generateToken({
        userId: superAdmin._id.toString(),
        email: superAdmin.email,
        role: superAdmin.role,
        companyId: superAdmin.companyId.toString(),
      });

      const response = await request(app)
        .get(`/api/companies/${targetCompany._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Target Company');
    });
  });

  describe('PATCH /api/companies/:id/settings', () => {
    it('should allow admin to update their company settings', async () => {
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
        .patch(`/api/companies/${company._id}/settings`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          allowCitizenReports: false,
          maxUsers: 100,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.settings.allowCitizenReports).toBe(false);
      expect(response.body.data.settings.maxUsers).toBe(100);
    });

    it('should reject settings update from operator', async () => {
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
        .patch(`/api/companies/${company._id}/settings`)
        .set('Authorization', `Bearer ${token}`)
        .send({ maxUsers: 200 })
        .expect(403);
    });
  });

  describe('POST /api/companies/:id/regenerate-api-key', () => {
    it('should regenerate API key as admin', async () => {
      const company = await Company.create({
        name: 'Test Company',
        status: CompanyStatus.ACTIVE,
      });

      const oldApiKey = company.apiKey;

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
        .post(`/api/companies/${company._id}/regenerate-api-key`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.apiKey).toBeDefined();
      expect(response.body.data.apiKey).not.toBe(oldApiKey);
      expect(response.body.data.apiKey).toMatch(/^ckey_/);
    });
  });
});
