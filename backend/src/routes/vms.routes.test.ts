/**
 * VMS Routes Integration Tests
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../app';
import { Company, User, UserRole, CompanyStatus, VmsServer, Camera } from '../models';
import { AuthService } from '../services';
import { setupTestDB, teardownTestDB, clearDatabase } from '../test/helpers';

describe('VMS Routes Integration Tests', () => {
  let company: any;
  let adminToken: string;
  let operatorToken: string;
  let fetchMock: jest.Mock;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    // Mock fetch for Shinobi API calls.
    fetchMock = jest.fn();
    (global as typeof global & { fetch: jest.Mock }).fetch = fetchMock;

    // Create test company
    company = await Company.create({
      name: 'Test Security Company',
      status: CompanyStatus.ACTIVE,
    });

    // Create admin user
    const admin = await User.create({
      email: 'admin@test.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      companyId: company._id,
    });

    adminToken = AuthService.generateToken({
      userId: admin._id.toString(),
      email: admin.email,
      role: admin.role,
      companyId: admin.companyId.toString(),
    });

    // Create operator user
    const operator = await User.create({
      email: 'operator@test.com',
      password: 'password123',
      firstName: 'Operator',
      lastName: 'User',
      role: UserRole.OPERATOR,
      companyId: company._id,
    });

    operatorToken = AuthService.generateToken({
      userId: operator._id.toString(),
      email: operator.email,
      role: operator.role,
      companyId: operator.companyId.toString(),
    });
  });

  afterEach(async () => {
    await clearDatabase();
    fetchMock.mockReset();
  });

  describe('POST /api/vms', () => {
    it('should create a VMS server as admin', async () => {
      const response = await request(app)
        .post('/api/vms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Local Shinobi',
          provider: 'shinobi',
          baseUrl: 'http://localhost:8080',
          auth: {
            apiKey: 'test-api-key',
            groupKey: 'test-group-key',
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Local Shinobi');
      expect(response.body.data.provider).toBe('shinobi');
      expect(response.body.data.baseUrl).toBe('http://localhost:8080');
      expect(response.body.data.isActive).toBe(true);
      // Auth should be hidden in response
      expect(response.body.data.auth).toBeUndefined();
      expect(response.body.correlationId).toBeDefined();
    });

    it('should reject VMS creation from operator', async () => {
      const response = await request(app)
        .post('/api/vms')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          name: 'Local Shinobi',
          provider: 'shinobi',
          baseUrl: 'http://localhost:8080',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/vms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Missing Provider',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate provider enum', async () => {
      const response = await request(app)
        .post('/api/vms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Invalid Provider',
          provider: 'invalid_provider',
          baseUrl: 'http://localhost:8080',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/vms', () => {
    it('should list VMS servers for company', async () => {
      // Create VMS servers
      await VmsServer.create([
        {
          companyId: company._id,
          name: 'Shinobi Server',
          provider: 'shinobi',
          baseUrl: 'http://shinobi.local:8080',
          auth: { apiKey: 'key1', groupKey: 'group1' },
        },
        {
          companyId: company._id,
          name: 'ZoneMinder Server',
          provider: 'zoneminder',
          baseUrl: 'http://zoneminder.local:80',
        },
      ]);

      const response = await request(app)
        .get('/api/vms')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      // Auth should be hidden
      response.body.data.forEach((server: any) => {
        expect(server.auth).toBeUndefined();
      });
    });

    it('should filter by provider', async () => {
      await VmsServer.create([
        {
          companyId: company._id,
          name: 'Shinobi 1',
          provider: 'shinobi',
          baseUrl: 'http://shinobi1.local:8080',
          auth: { apiKey: 'key1', groupKey: 'group1' },
        },
        {
          companyId: company._id,
          name: 'ZoneMinder',
          provider: 'zoneminder',
          baseUrl: 'http://zoneminder.local:80',
        },
      ]);

      const response = await request(app)
        .get('/api/vms?provider=shinobi')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].provider).toBe('shinobi');
    });

    it('should not return VMS servers from other companies', async () => {
      const otherCompany = await Company.create({
        name: 'Other Company',
        status: CompanyStatus.ACTIVE,
      });

      await VmsServer.create([
        {
          companyId: company._id,
          name: 'Our Server',
          provider: 'shinobi',
          baseUrl: 'http://our.local:8080',
          auth: { apiKey: 'key1', groupKey: 'group1' },
        },
        {
          companyId: otherCompany._id,
          name: 'Their Server',
          provider: 'shinobi',
          baseUrl: 'http://their.local:8080',
          auth: { apiKey: 'key2', groupKey: 'group2' },
        },
      ]);

      const response = await request(app)
        .get('/api/vms')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Our Server');
    });
  });

  describe('GET /api/vms/:id', () => {
    it('should get VMS server by ID', async () => {
      const server = await VmsServer.create({
        companyId: company._id,
        name: 'Test Server',
        provider: 'shinobi',
        baseUrl: 'http://test.local:8080',
        auth: { apiKey: 'key1', groupKey: 'group1' },
      });

      const response = await request(app)
        .get(`/api/vms/${server._id}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Server');
      expect(response.body.data.auth).toBeUndefined();
    });

    it('should return 404 for non-existent server', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/vms/${fakeId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should not access VMS server from other company', async () => {
      const otherCompany = await Company.create({
        name: 'Other Company',
        status: CompanyStatus.ACTIVE,
      });

      const server = await VmsServer.create({
        companyId: otherCompany._id,
        name: 'Other Server',
        provider: 'shinobi',
        baseUrl: 'http://other.local:8080',
        auth: { apiKey: 'key1', groupKey: 'group1' },
      });

      const response = await request(app)
        .get(`/api/vms/${server._id}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/vms/:id', () => {
    it('should update VMS server as admin', async () => {
      const server = await VmsServer.create({
        companyId: company._id,
        name: 'Original Name',
        provider: 'shinobi',
        baseUrl: 'http://test.local:8080',
        auth: { apiKey: 'key1', groupKey: 'group1' },
      });

      const response = await request(app)
        .put(`/api/vms/${server._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Updated Name',
          isActive: false,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Updated Name');
      expect(response.body.data.isActive).toBe(false);
    });

    it('should reject update from operator', async () => {
      const server = await VmsServer.create({
        companyId: company._id,
        name: 'Test Server',
        provider: 'shinobi',
        baseUrl: 'http://test.local:8080',
        auth: { apiKey: 'key1', groupKey: 'group1' },
      });

      const response = await request(app)
        .put(`/api/vms/${server._id}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ name: 'Hacked Name' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/vms/:id', () => {
    it('should delete VMS server as admin', async () => {
      const server = await VmsServer.create({
        companyId: company._id,
        name: 'To Delete',
        provider: 'shinobi',
        baseUrl: 'http://test.local:8080',
        auth: { apiKey: 'key1', groupKey: 'group1' },
      });

      const response = await request(app)
        .delete(`/api/vms/${server._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      const deleted = await VmsServer.findById(server._id);
      expect(deleted).toBeNull();
    });

    it('should reject delete from operator', async () => {
      const server = await VmsServer.create({
        companyId: company._id,
        name: 'Protected Server',
        provider: 'shinobi',
        baseUrl: 'http://test.local:8080',
        auth: { apiKey: 'key1', groupKey: 'group1' },
      });

      const response = await request(app)
        .delete(`/api/vms/${server._id}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  // VMS test + discovery + import coverage.
  describe('POST /api/vms/:id/test', () => {
    it('should test a Shinobi server connection', async () => {
      const server = await VmsServer.create({
        companyId: company._id,
        name: 'Test Shinobi',
        provider: 'shinobi',
        baseUrl: 'http://shinobi.local:8080',
        auth: { apiKey: 'key1', groupKey: 'group1' },
      });

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ mid: 'cam-1' }],
      });

      const response = await request(app)
        .post(`/api/vms/${server._id}/test`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.monitors).toBe(1);
    });
  });

  describe('GET /api/vms/:id/monitors', () => {
    it('should discover monitors from Shinobi', async () => {
      const server = await VmsServer.create({
        companyId: company._id,
        name: 'Test Shinobi',
        provider: 'shinobi',
        baseUrl: 'http://shinobi.local:8080',
        auth: { apiKey: 'key1', groupKey: 'group1' },
      });

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { mid: 'cam-1', name: 'Entrance', status: 'Watching' },
        ],
      });

      const response = await request(app)
        .get(`/api/vms/${server._id}/monitors`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].id).toBe('cam-1');
      expect(response.body.data[0].name).toBe('Entrance');
    });
  });

  describe('POST /api/vms/:id/monitors/import', () => {
    it('should import selected monitors as cameras', async () => {
      const server = await VmsServer.create({
        companyId: company._id,
        name: 'Test Shinobi',
        provider: 'shinobi',
        baseUrl: 'http://shinobi.local:8080',
        auth: { apiKey: 'key1', groupKey: 'group1' },
      });

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          { mid: 'cam-1', name: 'Entrance', status: 'Watching' },
          { mid: 'cam-2', name: 'Lobby', status: 'Watching' },
        ],
      });

      const response = await request(app)
        .post(`/api/vms/${server._id}/monitors/import`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          monitorIds: ['cam-1'],
          defaultLocation: { coordinates: [34.78, 32.08], address: 'Test' },
          source: 'vms-import',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      const created = await Camera.find({ 'vms.monitorId': 'cam-1' });
      expect(created).toHaveLength(1);
    });
  });
});
