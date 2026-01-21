import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Event Monitoring and Management Platform API',
      version: '1.0.0',
      description: `
## Overview

RESTful API for the Event Monitoring and Management Platform.

## Authentication

- **JWT Bearer Token**: For web application users
- **API Key**: For mobile applications (X-API-Key header)

## Response Format

All responses use a consistent envelope:

\`\`\`json
{
  "success": true,
  "data": { ... },
  "meta": { ... },
  "correlationId": "uuid"
}
\`\`\`

## Error Format

\`\`\`json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": { ... }
  },
  "correlationId": "uuid"
}
\`\`\`
      `,
      contact: {
        name: 'API Support',
      },
    },
    servers: [
      {
        url: '/api',
        description: 'API v1',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Company API key for mobile apps',
        },
      },
      schemas: {
        // Standard response schemas
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            correlationId: { type: 'string', format: 'uuid' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Invalid input' },
                details: { type: 'object' },
              },
            },
            correlationId: { type: 'string', format: 'uuid' },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            pageSize: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 100 },
            totalPages: { type: 'integer', example: 5 },
            hasNextPage: { type: 'boolean', example: true },
            hasPrevPage: { type: 'boolean', example: false },
          },
        },
        GeoPoint: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['Point'], example: 'Point' },
            coordinates: {
              type: 'array',
              items: { type: 'number' },
              example: [-122.4194, 37.7749],
              description: '[longitude, latitude]',
            },
          },
        },
        // Mobile API specific schemas
        MobileLoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { 
              type: 'string', 
              format: 'email', 
              example: 'user@example.com' 
            },
            password: { 
              type: 'string', 
              minLength: 8,
              example: 'securePassword123' 
            },
          },
        },
        MobileAuthResponse: {
          allOf: [
            { $ref: '#/components/schemas/SuccessResponse' },
            {
              type: 'object',
              properties: {
                data: {
                  type: 'object',
                  properties: {
                    user: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        email: { type: 'string' },
                        firstName: { type: 'string' },
                        lastName: { type: 'string' },
                        role: { type: 'string' },
                        companyId: { type: 'string' },
                      },
                    },
                    accessToken: { type: 'string' },
                    refreshToken: { type: 'string' },
                    expiresIn: { type: 'string', example: '15m' },
                  },
                },
              },
            },
          ],
        },
        MobileReportRequest: {
          type: 'object',
          required: ['title', 'description', 'type', 'location'],
          properties: {
            title: { 
              type: 'string', 
              maxLength: 100,
              example: 'Suspicious activity reported' 
            },
            description: { 
              type: 'string', 
              example: 'Detailed description of the incident' 
            },
            type: { 
              type: 'string', 
              enum: ['suspicious_activity', 'theft', 'vandalism', 'violence', 'fire', 'medical_emergency', 'traffic_incident', 'other'],
              example: 'suspicious_activity' 
            },
            location: { $ref: '#/components/schemas/GeoPoint' },
            priority: { 
              type: 'string', 
              enum: ['low', 'medium', 'high'], 
              default: 'medium' 
            },
            isAnonymous: { 
              type: 'boolean', 
              default: false,
              description: 'Whether to submit report anonymously' 
            },
          },
        },
        ResponderLocationUpdate: {
          type: 'object',
          required: ['location'],
          properties: {
            location: { $ref: '#/components/schemas/GeoPoint' },
            accuracy: {
              type: 'number',
              minimum: 0,
              description: 'Location accuracy in meters',
              example: 5.0,
            },
          },
        },
      },
      parameters: {
        correlationId: {
          name: 'X-Correlation-ID',
          in: 'header',
          description: 'Optional correlation ID for request tracing',
          schema: { type: 'string', format: 'uuid' },
        },
        page: {
          name: 'page',
          in: 'query',
          description: 'Page number (1-indexed)',
          schema: { type: 'integer', default: 1, minimum: 1 },
        },
        pageSize: {
          name: 'pageSize',
          in: 'query',
          description: 'Items per page',
          schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
        },
        sort: {
          name: 'sort',
          in: 'query',
          description: 'Sort field (prefix with - for descending)',
          schema: { type: 'string', example: '-createdAt' },
        },
      },
    },
    tags: [
      { name: 'System', description: 'Health checks and system endpoints' },
      { name: 'Auth', description: 'Authentication and authorization' },
      { name: 'Companies', description: 'Multi-tenant company management' },
      { name: 'Users', description: 'User management' },
      { name: 'Reports', description: 'Citizen and camera reports' },
      { name: 'Events', description: 'Event management and lifecycle' },
      { name: 'Cameras', description: 'Camera management and video' },
      { name: 'AI', description: 'AI detection integration' },
      // Mobile API tags
      { name: 'Mobile Auth', description: 'Mobile authentication with API keys' },
      { name: 'Mobile Reports', description: 'Report submission via mobile apps' },
      { name: 'Mobile Events', description: 'Event assignments for responders' },
      { name: 'Mobile Users', description: 'Mobile user operations (location tracking)' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/routes/**/*.ts', './dist/routes/*.js', './dist/routes/**/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
