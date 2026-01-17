import request from 'supertest';
import path from 'path';
import fs from 'fs';
import { app } from '../app';
import { setupTestDB, teardownTestDB, createTestUser, createTestCompany } from '../test/helpers';
import { User, UserRole, Company, Report, ReportStatus, ReportType } from '../models';

describe('Report Routes', () => {
  let company1Id: string;
  let company2Id: string;
  let citizenToken: string;
  let citizenUserId: string;
  let operatorToken: string;
  let operatorUserId: string;

  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    // Create test companies
    const company1 = await createTestCompany({ name: 'Test Company 1' });
    const company2 = await createTestCompany({ name: 'Test Company 2' });
    company1Id = company1._id.toString();
    company2Id = company2._id.toString();

    // Create citizen user
    const citizen = await createTestUser({
      email: 'citizen@test.com',
      password: 'Password123!',
      role: UserRole.CITIZEN,
      companyId: company1Id,
    });
    citizenUserId = citizen.user._id.toString();
    citizenToken = citizen.token;

    // Create operator user
    const operator = await createTestUser({
      email: 'operator@test.com',
      password: 'Password123!',
      role: UserRole.OPERATOR,
      companyId: company1Id,
    });
    operatorUserId = operator.user._id.toString();
    operatorToken = operator.token;
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Company.deleteMany({});
    await Report.deleteMany({});
  });

  describe('POST /api/reports', () => {
    it('should create a report as citizen', async () => {
      const reportData = {
        title: 'Suspicious activity',
        description: 'Saw someone loitering near the park',
        type: ReportType.SUSPICIOUS_ACTIVITY,
        location: {
          longitude: -122.4194,
          latitude: 37.7749,
        },
        locationDescription: 'Central Park entrance',
      };

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send(reportData)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe(reportData.title);
      expect(res.body.data.description).toBe(reportData.description);
      expect(res.body.data.type).toBe(reportData.type);
      expect(res.body.data.status).toBe(ReportStatus.PENDING);
      expect(res.body.data.companyId).toBe(company1Id);
      expect(res.body.data.reportedBy).toBeDefined();
      expect(res.body.data.location.type).toBe('Point');
      expect(res.body.data.location.coordinates).toEqual([
        reportData.location.longitude,
        reportData.location.latitude,
      ]);
    });

    it('should reject report with invalid location', async () => {
      const reportData = {
        title: 'Test report',
        description: 'Test description',
        type: ReportType.SUSPICIOUS_ACTIVITY,
        location: {
          type: 'Point',
          coordinates: [999, 37.7749], // Invalid longitude (> 180)
        },
      };

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send(reportData)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('should reject report without authentication', async () => {
      const reportData = {
        title: 'Test report',
        description: 'Test description',
        type: ReportType.SUSPICIOUS_ACTIVITY,
        location: {
          longitude: -122.4194,
          latitude: 37.7749,
        },
      };

      await request(app).post('/api/reports').send(reportData).expect(401);
    });

    it('should reject report with missing required fields', async () => {
      const reportData = {
        title: 'Test report',
        // Missing description, type, location
      };

      const res = await request(app)
        .post('/api/reports')
        .set('Authorization', `Bearer ${citizenToken}`)
        .send(reportData)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/reports', () => {
    beforeEach(async () => {
      // Create test reports for company1
      await Report.create([
        {
          title: 'Report 1',
          description: 'Description 1',
          type: ReportType.SUSPICIOUS_ACTIVITY,
          status: ReportStatus.PENDING,
          companyId: company1Id,
          location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
          reportedBy: citizenUserId,
          reporterName: 'Test Citizen',
        },
        {
          title: 'Report 2',
          description: 'Description 2',
          type: ReportType.THEFT,
          status: ReportStatus.VERIFIED,
          companyId: company1Id,
          location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
          reportedBy: citizenUserId,
          reporterName: 'Test Citizen',
        },
        {
          title: 'Report 3 - Company 2',
          description: 'Description 3',
          type: ReportType.VANDALISM,
          status: ReportStatus.PENDING,
          companyId: company2Id,
          location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
          reportedBy: citizenUserId,
          reporterName: 'Test Citizen',
        },
      ]);
    });

    it('should get all reports for company (operator)', async () => {
      const res = await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2); // Only company1 reports
      expect(res.body.meta.total).toBe(2);
      expect(res.body.meta.page).toBe(1);
    });

    it('should filter reports by status', async () => {
      const res = await request(app)
        .get('/api/reports?status=pending')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe(ReportStatus.PENDING);
    });

    it('should filter reports by type', async () => {
      const res = await request(app)
        .get('/api/reports?type=theft')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].type).toBe(ReportType.THEFT);
    });

    it('should paginate results', async () => {
      const res = await request(app)
        .get('/api/reports?page=1&pageSize=1')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.pageSize).toBe(1);
      expect(res.body.meta.totalPages).toBe(2);
    });

    it('should enforce tenant isolation', async () => {
      const res = await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      // Should only see company1 reports (2), not company2 report (1)
      expect(res.body.data).toHaveLength(2);
      res.body.data.forEach((report: any) => {
        expect(report.companyId).toBe(company1Id);
      });
    });

    it('should reject access from citizen role', async () => {
      await request(app)
        .get('/api/reports')
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(403);
    });
  });

  describe('GET /api/reports/:id', () => {
    let reportId: string;

    beforeEach(async () => {
      const report = await Report.create({
        title: 'Test Report',
        description: 'Test Description',
        type: ReportType.SUSPICIOUS_ACTIVITY,
        status: ReportStatus.PENDING,
        companyId: company1Id,
        location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
        reportedBy: citizenUserId,
        reporterName: 'Test Citizen',
      });
      reportId = report._id.toString();
    });

    it('should get report by ID', async () => {
      const res = await request(app)
        .get(`/api/reports/${reportId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data._id).toBe(reportId);
      expect(res.body.data.title).toBe('Test Report');
    });

    it('should return 404 for non-existent report', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      await request(app)
        .get(`/api/reports/${fakeId}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(404);
    });

    it('should enforce tenant isolation', async () => {
      // Create report in company2
      const company2Report = await Report.create({
        title: 'Company 2 Report',
        description: 'Test',
        type: ReportType.THEFT,
        status: ReportStatus.PENDING,
        companyId: company2Id,
        location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
        reportedBy: citizenUserId,
        reporterName: 'Test',
      });

      // Try to access from company1 user
      await request(app)
        .get(`/api/reports/${company2Report._id}`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(404);
    });

    it('should return 400 for invalid ID format', async () => {
      await request(app)
        .get('/api/reports/invalid-id')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(400);
    });
  });

  describe('PATCH /api/reports/:id/verify', () => {
    let reportId: string;

    beforeEach(async () => {
      const report = await Report.create({
        title: 'Test Report',
        description: 'Test Description',
        type: ReportType.SUSPICIOUS_ACTIVITY,
        status: ReportStatus.PENDING,
        companyId: company1Id,
        location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
        reportedBy: citizenUserId,
        reporterName: 'Test Citizen',
      });
      reportId = report._id.toString();
    });

    it('should verify report as operator', async () => {
      const res = await request(app)
        .patch(`/api/reports/${reportId}/verify`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ReportStatus.VERIFIED);
      expect(res.body.data.verifiedBy).toBeDefined();
      expect(res.body.data.verifiedAt).toBeDefined();
    });

    it('should reject verification from citizen', async () => {
      await request(app)
        .patch(`/api/reports/${reportId}/verify`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(403);
    });

    it('should reject double verification', async () => {
      // First verification
      await request(app)
        .patch(`/api/reports/${reportId}/verify`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);

      // Second verification attempt
      const res = await request(app)
        .patch(`/api/reports/${reportId}/verify`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(400);

      expect(res.body.error.code).toBe('REPORT_ALREADY_PROCESSED');
    });
  });

  describe('PATCH /api/reports/:id/reject', () => {
    let reportId: string;

    beforeEach(async () => {
      const report = await Report.create({
        title: 'Test Report',
        description: 'Test Description',
        type: ReportType.SUSPICIOUS_ACTIVITY,
        status: ReportStatus.PENDING,
        companyId: company1Id,
        location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
        reportedBy: citizenUserId,
        reporterName: 'Test Citizen',
      });
      reportId = report._id.toString();
    });

    it('should reject report as operator', async () => {
      const res = await request(app)
        .patch(`/api/reports/${reportId}/reject`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ rejectionReason: 'Duplicate report' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ReportStatus.REJECTED);
      expect(res.body.data.rejectionReason).toBe('Duplicate report');
      expect(res.body.data.verifiedBy).toBeDefined();
      expect(res.body.data.verifiedAt).toBeDefined();
    });

    it('should require rejection reason', async () => {
      const res = await request(app)
        .patch(`/api/reports/${reportId}/reject`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({})
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject rejection from citizen', async () => {
      await request(app)
        .patch(`/api/reports/${reportId}/reject`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .send({ rejectionReason: 'Test' })
        .expect(403);
    });
  });

  describe('POST /api/reports/:id/attachments', () => {
    let reportId: string;
    const testImagePath = path.join(__dirname, '../test/fixtures/test-image.jpg');

    beforeEach(async () => {
      const report = await Report.create({
        title: 'Test Report',
        description: 'Test Description',
        type: ReportType.SUSPICIOUS_ACTIVITY,
        status: ReportStatus.PENDING,
        companyId: company1Id,
        location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
        reportedBy: citizenUserId,
        reporterName: 'Test Citizen',
      });
      reportId = report._id.toString();

      // Create test image if doesn't exist
      const fixturesDir = path.join(__dirname, '../test/fixtures');
      if (!fs.existsSync(fixturesDir)) {
        fs.mkdirSync(fixturesDir, { recursive: true });
      }
      if (!fs.existsSync(testImagePath)) {
        // Create a minimal 1x1 JPEG
        const jpegBuffer = Buffer.from([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
          0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
          0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11,
          0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff,
          0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0xff, 0xd9,
        ]);
        fs.writeFileSync(testImagePath, jpegBuffer);
      }
    });

    afterEach(() => {
      // Cleanup uploaded files
      const uploadsDir = path.join(__dirname, '../../uploads');
      if (fs.existsSync(uploadsDir)) {
        try {
          const files = fs.readdirSync(uploadsDir);
          files.forEach((file) => {
            const filePath = path.join(uploadsDir, file);
            if (fs.statSync(filePath).isFile() && file !== '.gitkeep') {
              fs.unlinkSync(filePath);
            }
          });
        } catch (error) {
          // Ignore cleanup errors in tests
        }
      }
    });

    it('should add attachment to report', async () => {
      const res = await request(app)
        .post(`/api/reports/${reportId}/attachments`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .attach('files', testImagePath)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.attachments).toHaveLength(1);
      expect(res.body.data.attachments[0].filename).toBe('test-image.jpg');
      expect(res.body.data.attachments[0].type).toBe('image');
      expect(res.body.data.attachments[0].mimeType).toBe('image/jpeg');
    });

    it('should reject when no files provided', async () => {
      const res = await request(app)
        .post(`/api/reports/${reportId}/attachments`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should enforce 10 attachment limit', async () => {
      // Add 10 attachments
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post(`/api/reports/${reportId}/attachments`)
          .set('Authorization', `Bearer ${citizenToken}`)
          .attach('files', testImagePath);
      }

      // Try to add 11th
      const res = await request(app)
        .post(`/api/reports/${reportId}/attachments`)
        .set('Authorization', `Bearer ${citizenToken}`)
        .attach('files', testImagePath)
        .expect(400);

      expect(res.body.error.code).toBe('ATTACHMENT_LIMIT_EXCEEDED');
    });
  });
});
