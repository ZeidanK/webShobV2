import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { 
  setupTestDB, 
  teardownTestDB, 
  createTestUser, 
  createTestCompany
} from '../test/helpers';
import { EventType, SYSTEM_EVENT_TYPES } from '../models/event-type.model';
import { UserRole } from '../models/user.model';

describe('EventType Routes', () => {
  const app = createApp();
  let company1: any, company2: any;
  let admin1: any, operator1: any, admin2: any;
  let token1: string, tokenOperator1: string, token2: string;

  beforeAll(async () => {
    await setupTestDB();

    // Create companies
    company1 = await createTestCompany();
    company2 = await createTestCompany();

    // Create users
    const user1 = await createTestUser({ companyId: company1._id, role: UserRole.ADMIN });
    const user2 = await createTestUser({ companyId: company1._id, role: UserRole.OPERATOR });
    const user3 = await createTestUser({ companyId: company2._id, role: UserRole.ADMIN });

    admin1 = user1.user;
    operator1 = user2.user;
    admin2 = user3.user;

    // Get auth tokens
    token1 = user1.token;
    tokenOperator1 = user2.token;
    token2 = user3.token;

    // Seed system defaults for testing
    await EventType.deleteMany({});
    const systemTypes = SYSTEM_EVENT_TYPES.map((type: any) => ({
      ...type,
      isSystemDefault: true,
      isActive: true,
    }));
    await EventType.insertMany(systemTypes);
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    // Clean up company-specific event types between tests
    await EventType.deleteMany({ isSystemDefault: false });
  });

  describe('GET /api/event-types', () => {
    it('should return system defaults and company-specific types', async () => {
      // Create company-specific type
      await EventType.create({
        name: 'Company Custom',
        description: 'Custom event type',
        color: '#FF0000',
        icon: 'custom',
        companyId: company1._id,
        isSystemDefault: false,
        isActive: true,
      });

      const response = await request(app)
        .get('/api/event-types')
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Should include system defaults + company custom
      const systemDefaultCount = SYSTEM_EVENT_TYPES.length;
      expect(response.body.data).toHaveLength(systemDefaultCount + 1);
      
      // Should include both system and custom types
      const hasSystemType = response.body.data.some((type: any) => type.isSystemDefault);
      const hasCustomType = response.body.data.some((type: any) => type.name === 'Company Custom');
      expect(hasSystemType).toBe(true);
      expect(hasCustomType).toBe(true);
    });

    it('should enforce tenant isolation for company-specific types', async () => {
      // Create company-specific types for both companies
      await EventType.create({
        name: 'Company 1 Custom',
        color: '#FF0000',
        companyId: company1._id,
        isSystemDefault: false,
        isActive: true,
      });

      await EventType.create({
        name: 'Company 2 Custom',
        color: '#00FF00',
        companyId: company2._id,
        isSystemDefault: false,
        isActive: true,
      });

      // Company 1 should not see Company 2's custom type
      const response1 = await request(app)
        .get('/api/event-types')
        .set('Authorization', `Bearer ${token1}`);

      const company1Types = response1.body.data.filter((type: any) => !type.isSystemDefault);
      expect(company1Types).toHaveLength(1);
      expect(company1Types[0].name).toBe('Company 1 Custom');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/event-types');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/event-types/company', () => {
    it('should return only company-specific types', async () => {
      // Create company-specific type
      await EventType.create({
        name: 'Company Custom',
        color: '#FF0000',
        companyId: company1._id,
        isSystemDefault: false,
        isActive: true,
      });

      const response = await request(app)
        .get('/api/event-types/company')
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Company Custom');
      expect(response.body.data[0].isSystemDefault).toBe(false);
    });

    it('should return empty array if no company types', async () => {
      const response = await request(app)
        .get('/api/event-types/company')
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/event-types/:id', () => {
    let customEventType: any;
    let systemEventType: any;

    beforeEach(async () => {
      customEventType = await EventType.create({
        name: 'Custom Type',
        color: '#FF0000',
        companyId: company1._id,
        isSystemDefault: false,
        isActive: true,
      });

      systemEventType = await EventType.findOne({ isSystemDefault: true });
    });

    it('should return company-specific event type', async () => {
      const response = await request(app)
        .get(`/api/event-types/${customEventType._id}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Custom Type');
    });

    it('should return system default event type', async () => {
      const response = await request(app)
        .get(`/api/event-types/${systemEventType._id}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isSystemDefault).toBe(true);
    });

    it('should enforce tenant isolation', async () => {
      const response = await request(app)
        .get(`/api/event-types/${customEventType._id}`)
        .set('Authorization', `Bearer ${token2}`); // Different company

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent type', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/event-types/${fakeId}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/event-types', () => {
    it('should create company-specific event type', async () => {
      const eventTypeData = {
        name: 'New Custom Type',
        description: 'A new custom event type',
        color: '#FF0000',
        icon: 'custom-icon',
      };

      const response = await request(app)
        .post('/api/event-types')
        .set('Authorization', `Bearer ${token1}`)
        .send(eventTypeData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: eventTypeData.name,
        description: eventTypeData.description,
        color: eventTypeData.color,
        icon: eventTypeData.icon,
        companyId: company1._id.toString(),
        isSystemDefault: false,
        isActive: true,
      });
    });

    it('should require admin role', async () => {
      const response = await request(app)
        .post('/api/event-types')
        .set('Authorization', `Bearer ${tokenOperator1}`)
        .send({
          name: 'Test Type',
          color: '#FF0000',
        });

      expect(response.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/event-types')
        .set('Authorization', `Bearer ${token1}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate color format', async () => {
      const response = await request(app)
        .post('/api/event-types')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          name: 'Test Type',
          color: 'invalid-color',
        });

      expect(response.status).toBe(400);
    });

    it('should prevent duplicate names (case insensitive)', async () => {
      // Create first event type
      await request(app)
        .post('/api/event-types')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          name: 'Test Type',
          color: '#FF0000',
        });

      // Try to create with same name (different case)
      const response = await request(app)
        .post('/api/event-types')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          name: 'TEST TYPE',
          color: '#00FF00',
        });

      expect(response.status).toBe(400);
    });

    it('should prevent conflicts with system defaults', async () => {
      const systemType = await EventType.findOne({ isSystemDefault: true });
      
      if (!systemType) {
        throw new Error('No system default event types found');
      }

      const response = await request(app)
        .post('/api/event-types')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          name: systemType.name, // Same as system default
          color: '#FF0000',
        });

      expect(response.status).toBe(400);
    });

    it('should normalize color to uppercase', async () => {
      const response = await request(app)
        .post('/api/event-types')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          name: 'Test Type',
          color: '#ff0000', // lowercase
        });

      expect(response.status).toBe(201);
      expect(response.body.data.color).toBe('#FF0000');
    });
  });

  describe('PATCH /api/event-types/:id', () => {
    let customEventType: any;

    beforeEach(async () => {
      customEventType = await EventType.create({
        name: 'Custom Type',
        color: '#FF0000',
        companyId: company1._id,
        isSystemDefault: false,
        isActive: true,
      });
    });

    it('should update company-specific event type', async () => {
      const updateData = {
        name: 'Updated Type',
        color: '#00FF00',
        description: 'Updated description',
      };

      const response = await request(app)
        .patch(`/api/event-types/${customEventType._id}`)
        .set('Authorization', `Bearer ${token1}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject(updateData);
    });

    it('should prevent updating system defaults', async () => {
      const systemType = await EventType.findOne({ isSystemDefault: true });
      
      if (!systemType) {
        throw new Error('No system default event types found');
      }

      const response = await request(app)
        .patch(`/api/event-types/${systemType._id}`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ name: 'Updated System Type' });

      expect(response.status).toBe(404); // Not found because we only search company types
    });

    it('should require admin role', async () => {
      const response = await request(app)
        .patch(`/api/event-types/${customEventType._id}`)
        .set('Authorization', `Bearer ${tokenOperator1}`)
        .send({ name: 'Updated Type' });

      expect(response.status).toBe(403);
    });

    it('should enforce tenant isolation', async () => {
      const response = await request(app)
        .patch(`/api/event-types/${customEventType._id}`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ name: 'Updated Type' });

      expect(response.status).toBe(404);
    });

    it('should validate color format', async () => {
      const response = await request(app)
        .patch(`/api/event-types/${customEventType._id}`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ color: 'invalid' });

      expect(response.status).toBe(400);
    });

    it('should prevent name conflicts', async () => {
      // Create another event type
      const otherType = await EventType.create({
        name: 'Other Type',
        color: '#00FF00',
        companyId: company1._id,
        isSystemDefault: false,
        isActive: true,
      });

      // Try to update first type to have same name as second
      const response = await request(app)
        .patch(`/api/event-types/${customEventType._id}`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ name: 'Other Type' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/event-types/:id', () => {
    let customEventType: any;

    beforeEach(async () => {
      customEventType = await EventType.create({
        name: 'Custom Type',
        color: '#FF0000',
        companyId: company1._id,
        isSystemDefault: false,
        isActive: true,
      });
    });

    it('should soft delete company-specific event type', async () => {
      const response = await request(app)
        .delete(`/api/event-types/${customEventType._id}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        _id: customEventType._id.toString(),
        name: customEventType.name,
      });

      // Verify soft delete
      const deletedType = await EventType.findById(customEventType._id);
      if (!deletedType) {
        throw new Error('Event type not found after soft delete');
      }
      expect(deletedType.isActive).toBe(false);
    });

    it('should prevent deleting system defaults', async () => {
      const systemType = await EventType.findOne({ isSystemDefault: true });
      
      if (!systemType) {
        throw new Error('No system default event types found');
      }

      const response = await request(app)
        .delete(`/api/event-types/${systemType._id}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(404);
    });

    it('should require admin role', async () => {
      const response = await request(app)
        .delete(`/api/event-types/${customEventType._id}`)
        .set('Authorization', `Bearer ${tokenOperator1}`);

      expect(response.status).toBe(403);
    });

    it('should enforce tenant isolation', async () => {
      const response = await request(app)
        .delete(`/api/event-types/${customEventType._id}`)
        .set('Authorization', `Bearer ${token2}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent type', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .delete(`/api/event-types/${fakeId}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for already deleted type', async () => {
      // Soft delete the type first
      await request(app)
        .delete(`/api/event-types/${customEventType._id}`)
        .set('Authorization', `Bearer ${token1}`);

      // Try to delete again
      const response = await request(app)
        .delete(`/api/event-types/${customEventType._id}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(404);
    });
  });
});