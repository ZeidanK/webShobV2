import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { 
  setupTestDB, 
  teardownTestDB, 
  createTestUser, 
  createTestCompany
} from '../test/helpers';
import { Event, EventStatus, EventPriority } from '../models/event.model';
import { EventType } from '../models/event-type.model';
import { Report, ReportType, ReportSource } from '../models/report.model';
import { UserRole } from '../models/user.model';

describe('Event Routes', () => {
  const app = createApp();
  let company1: any, company2: any;
  let admin1: any, operator1: any, admin2: any;
  let token1: string, tokenOperator1: string, token2: string;
  let eventType1: any, eventType2: any;

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

    // Create event types
    eventType1 = await EventType.create({
      name: 'Security Test',
      description: 'Test event type',
      color: '#FF0000',
      icon: 'shield',
      companyId: company1._id,
      isSystemDefault: false,
      isActive: true,
    });

    eventType2 = await EventType.create({
      name: 'Another Test',
      description: 'Another test event type',
      color: '#00FF00',
      icon: 'alert',
      companyId: company2._id,
      isSystemDefault: false,
      isActive: true,
    });
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  afterEach(async () => {
    await Event.deleteMany({});
    await Report.deleteMany({});
  });

  describe('POST /api/events', () => {
    it('should create event with valid data', async () => {
      const eventData = {
        title: 'Test Event',
        description: 'This is a test event',
        eventTypeId: eventType1._id.toString(),
        priority: EventPriority.HIGH,
        location: {
          type: 'Point',
          coordinates: [-73.935242, 40.730610], // NYC coordinates
        },
        locationDescription: 'New York City',
      };

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token1}`)
        .send(eventData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        title: eventData.title,
        description: eventData.description,
        priority: eventData.priority,
        status: EventStatus.CREATED,
        companyId: company1._id.toString(),
      });
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({ title: 'Test' });

      expect(response.status).toBe(401);
    });

    it('should require operator role or higher', async () => {
      // Create citizen user
      const citizen = await createTestUser({ companyId: company1._id, role: UserRole.CITIZEN });

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${citizen.token}`)
        .send({
          title: 'Test Event',
          description: 'Test',
          eventTypeId: eventType1._id.toString(),
          location: { type: 'Point', coordinates: [-73.935242, 40.730610] },
        });

      expect(response.status).toBe(403);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token1}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate location format', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          title: 'Test Event',
          description: 'Test',
          eventTypeId: eventType1._id.toString(),
          location: { type: 'Point', coordinates: [180.1, 91] }, // Invalid coordinates
        });

      expect(response.status).toBe(400);
    });

    it('should enforce tenant isolation', async () => {
      // Try to create event with other company's event type
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          title: 'Test Event',
          description: 'Test',
          eventTypeId: eventType2._id.toString(), // Company 2's event type
          location: { type: 'Point', coordinates: [-73.935242, 40.730610] },
        });

      expect(response.status).toBe(400);
    });

    it('should link initial reports if provided', async () => {
      // Create a report first
      const report = await Report.create({
        title: 'Test Report',
        description: 'Test report description',
        type: ReportType.THEFT,
        source: ReportSource.CITIZEN,
        companyId: company1._id,
        location: { type: 'Point', coordinates: [-73.935242, 40.730610] },
        reportedBy: admin1._id,
        attachments: [],
      });

      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          title: 'Test Event',
          description: 'Test',
          eventTypeId: eventType1._id.toString(),
          location: { type: 'Point', coordinates: [-73.935242, 40.730610] },
          reportIds: [report._id.toString()],
        });

      expect(response.status).toBe(201);
      expect(response.body.data.reportIds).toHaveLength(1);
    });
  });

  describe('GET /api/events', () => {
    let event1: any, event2: any;

    beforeEach(async () => {
      event1 = await Event.create({
        title: 'Event 1',
        description: 'First test event',
        companyId: company1._id,
        eventTypeId: eventType1._id,
        priority: EventPriority.HIGH,
        status: EventStatus.ACTIVE,
        location: { type: 'Point', coordinates: [-73.935242, 40.730610] },
        createdBy: admin1._id,
        reportIds: [],
      });

      event2 = await Event.create({
        title: 'Event 2',
        description: 'Second test event',
        companyId: company2._id, // Different company
        eventTypeId: eventType2._id,
        priority: EventPriority.LOW,
        status: EventStatus.CREATED,
        location: { type: 'Point', coordinates: [-74.006, 40.7128] },
        createdBy: admin2._id,
        reportIds: [],
      });
    });

    it('should return events for company with pagination', async () => {
      const response = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Event 1');
      expect(response.body.meta).toMatchObject({
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    it('should enforce tenant isolation', async () => {
      // Company 1 should only see their event
      const response1 = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${token1}`);
      expect(response1.body.data).toHaveLength(1);

      // Company 2 should only see their event
      const response2 = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${token2}`);
      expect(response2.body.data).toHaveLength(1);
      expect(response2.body.data[0].title).toBe('Event 2');
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/events?status=active')
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });

    it('should support search', async () => {
      const response = await request(app)
        .get('/api/events?search=First')
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
    });
  });

  describe('GET /api/events/:id', () => {
    let event: any;

    beforeEach(async () => {
      event = await Event.create({
        title: 'Test Event',
        description: 'Test event description',
        companyId: company1._id,
        eventTypeId: eventType1._id,
        priority: EventPriority.MEDIUM,
        status: EventStatus.ACTIVE,
        location: { type: 'Point', coordinates: [-73.935242, 40.730610] },
        createdBy: admin1._id,
        reportIds: [],
      });
    });

    it('should return event details', async () => {
      const response = await request(app)
        .get(`/api/events/${event._id}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Event');
    });

    it('should enforce tenant isolation', async () => {
      const response = await request(app)
        .get(`/api/events/${event._id}`)
        .set('Authorization', `Bearer ${token2}`);

      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent event', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/events/${fakeId}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/events/:id/status', () => {
    let event: any;

    beforeEach(async () => {
      event = await Event.create({
        title: 'Test Event',
        description: 'Test event description',
        companyId: company1._id,
        eventTypeId: eventType1._id,
        priority: EventPriority.MEDIUM,
        status: EventStatus.CREATED,
        location: { type: 'Point', coordinates: [-73.935242, 40.730610] },
        createdBy: admin1._id,
        reportIds: [],
      });
    });

    it('should update event status with valid transition', async () => {
      const response = await request(app)
        .patch(`/api/events/${event._id}/status`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ status: EventStatus.ACTIVE });

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(EventStatus.ACTIVE);
    });

    it('should reject invalid status transitions', async () => {
      // Try to go from CREATED to RESOLVED (invalid)
      const response = await request(app)
        .patch(`/api/events/${event._id}/status`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ status: EventStatus.RESOLVED });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('BUSINESS_LOGIC_ERROR');
    });

    it('should require operator role or higher', async () => {
      const citizen = await createTestUser({ companyId: company1._id, role: UserRole.CITIZEN });

      const response = await request(app)
        .patch(`/api/events/${event._id}/status`)
        .set('Authorization', `Bearer ${citizen.token}`)
        .send({ status: EventStatus.ACTIVE });

      expect(response.status).toBe(403);
    });

    it('should enforce tenant isolation', async () => {
      const response = await request(app)
        .patch(`/api/events/${event._id}/status`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ status: EventStatus.ACTIVE });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/events/:id/reports', () => {
    let event: any, report: any;

    beforeEach(async () => {
      event = await Event.create({
        title: 'Test Event',
        description: 'Test event description',
        companyId: company1._id,
        eventTypeId: eventType1._id,
        priority: EventPriority.MEDIUM,
        status: EventStatus.ACTIVE,
        location: { type: 'Point', coordinates: [-73.935242, 40.730610] },
        createdBy: admin1._id,
        reportIds: [],
      });

      report = await Report.create({
        title: 'Test Report',
        description: 'Test report description',
        type: ReportType.THEFT,
        source: ReportSource.CITIZEN,
        companyId: company1._id,
        location: { type: 'Point', coordinates: [-73.935242, 40.730610] },
        reportedBy: admin1._id,
        attachments: [],
      });
    });

    it('should link report to event', async () => {
      const response = await request(app)
        .post(`/api/events/${event._id}/reports`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ reportId: report._id.toString() });

      expect(response.status).toBe(200);
      expect(response.body.data.reportIds).toContain(report._id.toString());
    });

    it('should prevent duplicate linking', async () => {
      // Link report first
      await request(app)
        .post(`/api/events/${event._id}/reports`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ reportId: report._id.toString() });

      // Try to link again
      const response = await request(app)
        .post(`/api/events/${event._id}/reports`)
        .set('Authorization', `Bearer ${token1}`)
        .send({ reportId: report._id.toString() });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('BUSINESS_LOGIC_ERROR');
    });

    it('should enforce tenant isolation', async () => {
      const response = await request(app)
        .post(`/api/events/${event._id}/reports`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ reportId: report._id.toString() });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/events/:id/reports/:reportId', () => {
    let event: any, report: any;

    beforeEach(async () => {
      report = await Report.create({
        title: 'Test Report',
        description: 'Test report description',
        type: ReportType.THEFT,
        source: ReportSource.CITIZEN,
        companyId: company1._id,
        location: { type: 'Point', coordinates: [-73.935242, 40.730610] },
        reportedBy: admin1._id,
        attachments: [],
      });

      event = await Event.create({
        title: 'Test Event',
        description: 'Test event description',
        companyId: company1._id,
        eventTypeId: eventType1._id,
        priority: EventPriority.MEDIUM,
        status: EventStatus.ACTIVE,
        location: { type: 'Point', coordinates: [-73.935242, 40.730610] },
        createdBy: admin1._id,
        reportIds: [report._id],
      });
    });

    it('should unlink report from event', async () => {
      const response = await request(app)
        .delete(`/api/events/${event._id}/reports/${report._id}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(200);
      expect(response.body.data.reportIds).not.toContain(report._id.toString());
    });

    it('should handle report not linked', async () => {
      // Create another report not linked to event
      const otherReport = await Report.create({
        title: 'Other Report',
        description: 'Other report description',
        type: ReportType.THEFT,
        source: ReportSource.CITIZEN,
        companyId: company1._id,
        location: { type: 'Point', coordinates: [-73.935242, 40.730610] },
        reportedBy: admin1._id,
        attachments: [],
      });

      const response = await request(app)
        .delete(`/api/events/${event._id}/reports/${otherReport._id}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('BUSINESS_LOGIC_ERROR');
    });
  });
});