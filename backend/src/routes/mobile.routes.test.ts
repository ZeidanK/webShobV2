import request from 'supertest';
import { app } from '../app';
import { User, UserRole } from '../models/user.model';
import { Company, CompanyType } from '../models/company.model';
import { Report, ReportSource, ReportType } from '../models/report.model';
import { Event, EventStatus } from '../models/event.model';
import { setupTestDb, cleanupTestDb } from '../test/helpers/database';
import { AuthService } from '../services/auth.service';
import mongoose from 'mongoose';

describe('Mobile API Integration', () => {
  let companyId: string;
  let apiKey: string;
  let citizenUser: any;
  let responderUser: any;
  let accessToken: string;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await cleanupTestDb();
  });

  beforeEach(async () => {
    // Create test company with mobile partner type
    const company = new Company({
      name: 'Test Mobile Partner',
      type: CompanyType.MOBILE_PARTNER,
    });
    await company.save();
    companyId = company._id.toString();
    apiKey = company.apiKey;

    // Create test users
    citizenUser = new User({
      email: 'citizen@mobile.test',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'Citizen',
      role: UserRole.CITIZEN,
      companyId,
      isActive: true,
    });
    await citizenUser.save();

    responderUser = new User({
      email: 'responder@mobile.test',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'Responder',
      role: UserRole.FIRST_RESPONDER,
      companyId,
      isActive: true,
    });
    await responderUser.save();
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Company.deleteMany({});
    await Report.deleteMany({});
    await Event.deleteMany({});
  });

  describe('Mobile Authentication', () => {
    describe('POST /api/mobile/auth/login', () => {
      it('should authenticate user with API key + credentials', async () => {
        const response = await request(app)
          .post('/api/mobile/auth/login')
          .set('X-API-Key', apiKey)
          .send({
            email: 'citizen@mobile.test',
            password: 'TestPassword123!',
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('accessToken');
        expect(response.body.data).toHaveProperty('refreshToken');
        expect(response.body.data.user).toMatchObject({
          email: 'citizen@mobile.test',
          role: UserRole.CITIZEN,
        });

        accessToken = response.body.data.accessToken;
      });

      it('should reject login without API key', async () => {
        const response = await request(app)
          .post('/api/mobile/auth/login')
          .send({
            email: 'citizen@mobile.test',
            password: 'TestPassword123!',
          })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('MISSING_API_KEY');
      });

      it('should reject login with invalid credentials', async () => {
        const response = await request(app)
          .post('/api/mobile/auth/login')
          .set('X-API-Key', apiKey)
          .send({
            email: 'citizen@mobile.test',
            password: 'WrongPassword',
          })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      });

      it('should enforce rate limiting', async () => {
        // Make 6 failed login attempts (limit is 5)
        const requests = Array(6).fill(null).map(() =>
          request(app)
            .post('/api/mobile/auth/login')
            .set('X-API-Key', apiKey)
            .send({
              email: 'citizen@mobile.test',
              password: 'WrongPassword',
            })
        );

        const responses = await Promise.all(requests);
        
        // Last request should be rate limited
        expect(responses[5].status).toBe(429);
        expect(responses[5].body.error.code).toBe('AUTH_RATE_LIMIT_EXCEEDED');
      });
    });

    describe('POST /api/mobile/auth/refresh', () => {
      beforeEach(async () => {
        // Get access token
        const response = await request(app)
          .post('/api/mobile/auth/login')
          .set('X-API-Key', apiKey)
          .send({
            email: 'citizen@mobile.test',
            password: 'TestPassword123!',
          });
        
        accessToken = response.body.data.accessToken;
      });

      it('should refresh access token with valid refresh token', async () => {
        // First login to get refresh token
        const loginResponse = await request(app)
          .post('/api/mobile/auth/login')
          .set('X-API-Key', apiKey)
          .send({
            email: 'citizen@mobile.test',
            password: 'TestPassword123!',
          });

        const refreshToken = loginResponse.body.data.refreshToken;

        const response = await request(app)
          .post('/api/mobile/auth/refresh')
          .set('X-API-Key', apiKey)
          .send({ refreshToken })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('accessToken');
        expect(response.body.data).toHaveProperty('refreshToken');
      });
    });
  });

  describe('Mobile Reports', () => {
    beforeEach(async () => {
      // Get access token for citizen
      const response = await request(app)
        .post('/api/mobile/auth/login')
        .set('X-API-Key', apiKey)
        .send({
          email: 'citizen@mobile.test',
          password: 'TestPassword123!',
        });
      
      accessToken = response.body.data.accessToken;
    });

    describe('POST /api/mobile/reports', () => {
      it('should create new report', async () => {
        const reportData = {
          title: 'Mobile Test Report',
          description: 'Test report submitted via mobile API',
          type: ReportType.SUSPICIOUS_ACTIVITY,
          location: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749], // San Francisco
          },
          priority: 'medium',
        };

        const response = await request(app)
          .post('/api/mobile/reports')
          .set('X-API-Key', apiKey)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(reportData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toMatchObject({
          title: reportData.title,
          type: reportData.type,
          source: ReportSource.CITIZEN,
        });
      });

      it('should reject report with invalid location', async () => {
        const reportData = {
          title: 'Invalid Location Report',
          description: 'Test report with bad coordinates',
          type: ReportType.OTHER,
          location: {
            type: 'Point',
            coordinates: [200, 100], // Invalid coordinates
          },
        };

        const response = await request(app)
          .post('/api/mobile/reports')
          .set('X-API-Key', apiKey)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(reportData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_COORDINATES');
      });
    });

    describe('GET /api/mobile/reports', () => {
      beforeEach(async () => {
        // Create test reports
        const reports = [
          {
            title: 'Report 1',
            description: 'First test report',
            type: ReportType.THEFT,
            source: ReportSource.CITIZEN,
            status: 'pending',
            reportedBy: citizenUser._id,
            companyId,
            location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
          },
          {
            title: 'Report 2',
            description: 'Second test report',
            type: ReportType.VANDALISM,
            source: ReportSource.CITIZEN,
            status: 'verified',
            reportedBy: citizenUser._id,
            companyId,
            location: { type: 'Point', coordinates: [-122.4094, 37.7849] },
          },
        ];

        await Report.insertMany(reports);
      });

      it('should get user\'s own reports', async () => {
        const response = await request(app)
          .get('/api/mobile/reports')
          .set('X-API-Key', apiKey)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        expect(response.body.meta).toMatchObject({
          page: 1,
          total: 2,
        });
      });

      it('should filter reports by status', async () => {
        const response = await request(app)
          .get('/api/mobile/reports?status=pending')
          .set('X-API-Key', apiKey)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].status).toBe('pending');
      });
    });
  });

  describe('Mobile Responder Location', () => {
    let responderAccessToken: string;

    beforeEach(async () => {
      // Get access token for responder
      const response = await request(app)
        .post('/api/mobile/auth/login')
        .set('X-API-Key', apiKey)
        .send({
          email: 'responder@mobile.test',
          password: 'TestPassword123!',
        });
      
      responderAccessToken = response.body.data.accessToken;
    });

    describe('POST /api/mobile/users/location', () => {
      it('should update responder location', async () => {
        const locationData = {
          location: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
          accuracy: 5.0,
        };

        const response = await request(app)
          .post('/api/mobile/users/location')
          .set('X-API-Key', apiKey)
          .set('Authorization', `Bearer ${responderAccessToken}`)
          .send(locationData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toBe('Location updated successfully');
        expect(response.body.data.location).toEqual(locationData.location);
      });

      it('should reject location update from non-responder', async () => {
        const locationData = {
          location: {
            type: 'Point',
            coordinates: [-122.4194, 37.7749],
          },
        };

        const response = await request(app)
          .post('/api/mobile/users/location')
          .set('X-API-Key', apiKey)
          .set('Authorization', `Bearer ${accessToken}`) // Citizen token
          .send(locationData)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('FORBIDDEN');
      });
    });

    describe('GET /api/mobile/users/location', () => {
      beforeEach(async () => {
        // Set responder location
        await request(app)
          .post('/api/mobile/users/location')
          .set('X-API-Key', apiKey)
          .set('Authorization', `Bearer ${responderAccessToken}`)
          .send({
            location: {
              type: 'Point',
              coordinates: [-122.4194, 37.7749],
            },
            accuracy: 5.0,
          });
      });

      it('should get responder current location', async () => {
        const response = await request(app)
          .get('/api/mobile/users/location')
          .set('X-API-Key', apiKey)
          .set('Authorization', `Bearer ${responderAccessToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.location).toEqual({
          type: 'Point',
          coordinates: [-122.4194, 37.7749],
        });
        expect(response.body.data.accuracy).toBe(5.0);
      });
    });
  });

  describe('API Key Scoping', () => {
    let standardCompany: any;
    let standardApiKey: string;

    beforeEach(async () => {
      // Create standard company (not mobile partner)
      standardCompany = new Company({
        name: 'Standard Company',
        type: CompanyType.STANDARD,
      });
      await standardCompany.save();
      standardApiKey = standardCompany.apiKey;
    });

    it('should allow mobile partner access to mobile endpoints', async () => {
      const response = await request(app)
        .post('/api/mobile/auth/login')
        .set('X-API-Key', apiKey) // Mobile partner API key
        .send({
          email: 'citizen@mobile.test',
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(200);
    });

    it('should allow standard company access to mobile endpoints', async () => {
      // Create user in standard company
      const standardUser = new User({
        email: 'user@standard.test',
        password: 'TestPassword123!',
        firstName: 'Standard',
        lastName: 'User',
        role: UserRole.CITIZEN,
        companyId: standardCompany._id,
        isActive: true,
      });
      await standardUser.save();

      const response = await request(app)
        .post('/api/mobile/auth/login')
        .set('X-API-Key', standardApiKey)
        .send({
          email: 'user@standard.test',
          password: 'TestPassword123!',
        });

      expect(response.status).toBe(200);
    });
  });
});