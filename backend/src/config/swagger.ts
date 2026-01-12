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
    ],
  },
  apis: ['./src/routes/*.ts', './src/routes/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
