import request from 'supertest';
import { createApp } from '../app';

describe('Health Routes', () => {
  const app = createApp();

  describe('GET /api/health', () => {
    it('should return 200 with health status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'ok',
        },
      });
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.correlationId).toBeDefined();
    });

    it('should include correlationId in response headers', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(response.body.correlationId).toBe(response.headers['x-correlation-id']);
    });

    it('should use provided correlationId from request header', async () => {
      const customCorrelationId = '550e8400-e29b-41d4-a716-446655440000';

      const response = await request(app)
        .get('/api/health')
        .set('X-Correlation-ID', customCorrelationId);

      expect(response.headers['x-correlation-id']).toBe(customCorrelationId);
      expect(response.body.correlationId).toBe(customCorrelationId);
    });
  });

  describe('GET /api/health/detailed', () => {
    it('should return detailed health information', async () => {
      const response = await request(app).get('/api/health/detailed');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          status: 'ok',
          components: {
            database: { status: 'ok' },
          },
        },
      });
      expect(response.body.data.uptime_seconds).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('404 Handler', () => {
  const app = createApp();

  it('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/api/unknown-route');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: 'Route GET /api/unknown-route not found',
      },
    });
    expect(response.body.correlationId).toBeDefined();
  });
});

describe('CORS', () => {
  const app = createApp();

  it('should include CORS headers', async () => {
    const response = await request(app)
      .options('/api/health')
      .set('Origin', 'http://localhost:5173');

    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });
});
