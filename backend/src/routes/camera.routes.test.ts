/**
 * Camera Routes Integration Tests
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../app';
import { Company, User, UserRole, CompanyStatus, Camera, VmsServer } from '../models';
import { AuthService } from '../services';
import { setupTestDB, teardownTestDB, clearDatabase } from '../test/helpers';

describe('Camera Routes Integration Tests', () => {
  let company: any;
  let vmsServer: any;
  let adminToken: string;
  let operatorToken: string;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    // Create test company
    company = await Company.create({
      name: 'Test Security Company',
      status: CompanyStatus.ACTIVE,
    });

    // Create VMS server for tests
    vmsServer = await VmsServer.create({
      companyId: company._id,
      name: 'Test Shinobi',
      provider: 'shinobi',
      baseUrl: 'http://shinobi.local:8080',
      auth: { apiKey: 'test-key', groupKey: 'test-group' },
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
  });

  describe('POST /api/cameras', () => {
    it('should create a camera as admin', async () => {
      const response = await request(app)
        .post('/api/cameras')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Front Entrance',
          description: 'Main building entrance camera',
          type: 'ip',
          location: {
            coordinates: [34.7818, 32.0853],
            address: '123 Main St',
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Front Entrance');
      expect(response.body.data.type).toBe('ip');
      expect(response.body.data.status).toBe('offline');
      expect(response.body.data.location.coordinates).toEqual([34.7818, 32.0853]);
      expect(response.body.correlationId).toBeDefined();
    });

    it('should create camera with VMS connection', async () => {
      const response = await request(app)
        .post('/api/cameras')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'VMS Camera',
          location: {
            coordinates: [34.7818, 32.0853],
          },
          vms: {
            serverId: vmsServer._id.toString(),
            monitorId: 'monitor-001',
          },
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vms.serverId).toBe(vmsServer._id.toString());
      expect(response.body.data.vms.monitorId).toBe('monitor-001');
      expect(response.body.data.vms.provider).toBe('shinobi');
    });

    it('should reject camera creation from operator', async () => {
      const response = await request(app)
        .post('/api/cameras')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          name: 'Unauthorized Camera',
          location: {
            coordinates: [34.7818, 32.0853],
          },
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should validate required location', async () => {
      const response = await request(app)
        .post('/api/cameras')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Missing Location',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/cameras', () => {
    it('should list cameras for company', async () => {
      await Camera.create([
        {
          companyId: company._id,
          name: 'Camera 1',
          location: { type: 'Point', coordinates: [34.78, 32.08] },
        },
        {
          companyId: company._id,
          name: 'Camera 2',
          location: { type: 'Point', coordinates: [34.79, 32.09] },
        },
      ]);

      const response = await request(app)
        .get('/api/cameras')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should filter by status', async () => {
      await Camera.create([
        {
          companyId: company._id,
          name: 'Online Camera',
          status: 'online',
          location: { type: 'Point', coordinates: [34.78, 32.08] },
        },
        {
          companyId: company._id,
          name: 'Offline Camera',
          status: 'offline',
          location: { type: 'Point', coordinates: [34.79, 32.09] },
        },
      ]);

      const response = await request(app)
        .get('/api/cameras?status=online')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Online Camera');
    });

    it('should not return deleted cameras', async () => {
      await Camera.create([
        {
          companyId: company._id,
          name: 'Active Camera',
          isDeleted: false,
          location: { type: 'Point', coordinates: [34.78, 32.08] },
        },
        {
          companyId: company._id,
          name: 'Deleted Camera',
          isDeleted: true,
          location: { type: 'Point', coordinates: [34.79, 32.09] },
        },
      ]);

      const response = await request(app)
        .get('/api/cameras')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Active Camera');
    });

    it('should not return cameras from other companies', async () => {
      const otherCompany = await Company.create({
        name: 'Other Company',
        status: CompanyStatus.ACTIVE,
      });

      await Camera.create([
        {
          companyId: company._id,
          name: 'Our Camera',
          location: { type: 'Point', coordinates: [34.78, 32.08] },
        },
        {
          companyId: otherCompany._id,
          name: 'Their Camera',
          location: { type: 'Point', coordinates: [34.79, 32.09] },
        },
      ]);

      const response = await request(app)
        .get('/api/cameras')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Our Camera');
    });
  });

  describe('GET /api/cameras/:id', () => {
    it('should get camera by ID', async () => {
      const camera = await Camera.create({
        companyId: company._id,
        name: 'Test Camera',
        location: { type: 'Point', coordinates: [34.78, 32.08] },
      });

      const response = await request(app)
        .get(`/api/cameras/${camera._id}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Test Camera');
    });

    it('should return 404 for non-existent camera', async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/cameras/${fakeId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/cameras/:id/vms/connect', () => {
    it('should connect camera to VMS', async () => {
      const camera = await Camera.create({
        companyId: company._id,
        name: 'Unconnected Camera',
        location: { type: 'Point', coordinates: [34.78, 32.08] },
      });

      const response = await request(app)
        .post(`/api/cameras/${camera._id}/vms/connect`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          serverId: vmsServer._id.toString(),
          monitorId: 'monitor-123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vms.serverId).toBe(vmsServer._id.toString());
      expect(response.body.data.vms.monitorId).toBe('monitor-123');
      expect(response.body.data.vms.provider).toBe('shinobi');
    });

    it('should reject duplicate monitor connection', async () => {
      // Create first camera connected to monitor
      await Camera.create({
        companyId: company._id,
        name: 'First Camera',
        location: { type: 'Point', coordinates: [34.78, 32.08] },
        vms: {
          serverId: vmsServer._id,
          monitorId: 'monitor-123',
          provider: 'shinobi',
        },
      });

      // Try to connect second camera to same monitor
      const secondCamera = await Camera.create({
        companyId: company._id,
        name: 'Second Camera',
        location: { type: 'Point', coordinates: [34.79, 32.09] },
      });

      const response = await request(app)
        .post(`/api/cameras/${secondCamera._id}/vms/connect`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          serverId: vmsServer._id.toString(),
          monitorId: 'monitor-123',
        })
        .expect(409);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/cameras/:id/vms/disconnect', () => {
    it('should disconnect camera from VMS', async () => {
      const camera = await Camera.create({
        companyId: company._id,
        name: 'Connected Camera',
        location: { type: 'Point', coordinates: [34.78, 32.08] },
        vms: {
          serverId: vmsServer._id,
          monitorId: 'monitor-123',
          provider: 'shinobi',
        },
      });

      const response = await request(app)
        .post(`/api/cameras/${camera._id}/vms/disconnect`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.vms).toBeUndefined();
    });
  });

  // TEST-ONLY: VMS streaming and import coverage for camera routes.
  describe('GET /api/cameras/:id/streams', () => {
    it('should return Shinobi stream URLs for connected camera', async () => {
      const camera = await Camera.create({
        companyId: company._id,
        name: 'Stream Camera',
        location: { type: 'Point', coordinates: [34.78, 32.08] },
        vms: {
          serverId: vmsServer._id,
          monitorId: 'monitor-123',
          provider: 'shinobi',
        },
      });

      const response = await request(app)
        .get(`/api/cameras/${camera._id}/streams`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hls).toContain('/hls/');
      expect(response.body.data.embed).toContain('/embed/');
      expect(response.body.data.snapshot).toContain('/jpeg/');
    });
  });

  describe('POST /api/cameras/vms/import', () => {
    it('should import monitors into cameras', async () => {
      const response = await request(app)
        .post('/api/cameras/vms/import')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          serverId: vmsServer._id.toString(),
          monitors: [
            {
              monitorId: 'monitor-1',
              name: 'Imported Camera',
              location: { coordinates: [34.78, 32.08], address: 'Lab' },
            },
          ],
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.created).toBe(1);

      const created = await Camera.findOne({ 'vms.monitorId': 'monitor-1' });
      expect(created).not.toBeNull();
    });
  });

  describe('DELETE /api/cameras/:id', () => {
    it('should soft delete camera', async () => {
      const camera = await Camera.create({
        companyId: company._id,
        name: 'To Delete',
        location: { type: 'Point', coordinates: [34.78, 32.08] },
      });

      const response = await request(app)
        .delete(`/api/cameras/${camera._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify soft deletion
      const deleted = await Camera.findById(camera._id);
      expect(deleted).not.toBeNull();
      expect(deleted!.isDeleted).toBe(true);
    });
  });
});
