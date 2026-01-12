# Logging & Observability

**Version:** 1.0  
**Date:** January 12, 2026  
**Status:** Frozen Foundation Document

---

## 1. Logging Philosophy

### Principles
1. **Structured**: All logs are JSON (never plain text)
2. **Contextual**: Every log includes correlationId, companyId, userId when available
3. **Leveled**: Use appropriate log levels (ERROR, WARN, INFO, DEBUG)
4. **Actionable**: Logs should help diagnose issues without additional context
5. **Secure**: Never log sensitive data (passwords, tokens, PII)

---

## 2. Log Structure

### Standard Log Entry
```json
{
  "timestamp": "2026-01-12T15:30:00.000Z",
  "level": "INFO",
  "service": "backend-api",
  "action": "event.created",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "companyId": "60d5ec49f1b2c8b1f8c1e4a0",
  "userId": "60d5ec49f1b2c8b1f8c1e4a1",
  "message": "Event created successfully",
  "context": {
    "eventId": "60d5ec49f1b2c8b1f8c1e4a3",
    "eventType": "fire",
    "priority": "high"
  },
  "duration_ms": 45
}
```

### Required Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | string | Yes | ISO 8601 UTC timestamp |
| `level` | string | Yes | ERROR, WARN, INFO, DEBUG |
| `service` | string | Yes | Service name (backend-api, ai-service, websocket) |
| `action` | string | Yes | Dot-notation action identifier |
| `correlationId` | string | Yes | Request tracking UUID |
| `message` | string | Yes | Human-readable description |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `companyId` | string | Tenant identifier (when available) |
| `userId` | string | User performing action (when authenticated) |
| `context` | object | Additional structured data |
| `duration_ms` | number | Operation duration in milliseconds |
| `error` | object | Error details (for ERROR level) |

---

## 3. Log Levels

### ERROR
**When**: System errors requiring immediate attention
**Examples**:
- Database connection failure
- Unhandled exceptions
- External service unavailable
- Data corruption detected

```json
{
  "level": "ERROR",
  "action": "database.connection.failed",
  "message": "Failed to connect to MongoDB",
  "error": {
    "name": "MongoNetworkError",
    "message": "connect ECONNREFUSED 127.0.0.1:27017",
    "stack": "MongoNetworkError: connect ECONNREFUSED..."
  }
}
```

### WARN
**When**: Unexpected but handled conditions
**Examples**:
- Rate limit approaching
- Deprecated API usage
- Retry attempt on transient failure
- Invalid input rejected

```json
{
  "level": "WARN",
  "action": "auth.login.failed",
  "message": "Invalid credentials - attempt 3 of 5",
  "context": {
    "email": "user@example.com",
    "attemptCount": 3,
    "remainingAttempts": 2
  }
}
```

### INFO
**When**: Normal operational events
**Examples**:
- Request completed successfully
- User logged in
- Event created/updated
- Background job completed

```json
{
  "level": "INFO",
  "action": "event.status.updated",
  "message": "Event status changed to resolved",
  "context": {
    "eventId": "60d5ec49f1b2c8b1f8c1e4a3",
    "oldStatus": "assigned",
    "newStatus": "resolved"
  }
}
```

### DEBUG
**When**: Detailed diagnostic information (development/debugging only)
**Examples**:
- Query parameters received
- Cache hit/miss
- Intermediate computation results
- Third-party API request details

```json
{
  "level": "DEBUG",
  "action": "vms.adapter.request",
  "message": "Requesting playback URL from VMS",
  "context": {
    "vmsType": "milestone",
    "cameraId": "cam123",
    "timestamp": "2026-01-12T10:00:00Z"
  }
}
```

---

## 4. Action Naming Convention

### Format
```
{domain}.{entity}.{action}
```

### Examples
```
auth.login.success
auth.login.failed
auth.token.refreshed
auth.token.expired

user.created
user.updated
user.deactivated
user.location.updated

event.created
event.updated
event.status.updated
event.assigned
event.report.linked

report.created
report.verified
report.rejected
report.attachment.uploaded

camera.created
camera.status.changed
camera.stream.accessed

websocket.client.connected
websocket.client.disconnected
websocket.message.broadcast

ai.detection.received
ai.detection.processed
ai.detection.submitted
```

---

## 5. Correlation ID

### Purpose
- Track requests across services
- Correlate logs for debugging
- Reference for support tickets

### Generation
```typescript
// src/middleware/correlation-id.middleware.ts
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Use provided ID or generate new one
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  // Attach to request for use in handlers
  req.correlationId = correlationId;
  
  // Include in response headers
  res.setHeader('X-Correlation-ID', correlationId);
  
  next();
}
```

### Propagation
```typescript
// Include in all downstream requests
async function callExternalService(data: any, correlationId: string) {
  return fetch('http://ai-service/detection', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId
    },
    body: JSON.stringify(data)
  });
}
```

### In Logs
```typescript
// Always include correlationId in logs
logger.info('Event created', {
  action: 'event.created',
  correlationId: req.correlationId,
  context: { eventId }
});
```

---

## 6. Logger Implementation

### Winston Configuration
```typescript
// src/utils/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'backend-api'
  },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'development'
        ? winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        : winston.format.json()
    })
  ]
});

export function createLogger(context: Record<string, any> = {}) {
  return logger.child(context);
}

export { logger };
```

### Request Logger Middleware
```typescript
// src/middleware/request-logger.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration_ms = Date.now() - startTime;

    logger.info('Request completed', {
      action: 'http.request.completed',
      correlationId: req.correlationId,
      companyId: req.user?.companyId,
      userId: req.user?.id,
      context: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        userAgent: req.headers['user-agent']
      },
      duration_ms
    });
  });

  next();
}
```

---

## 7. Sensitive Data Protection

### Never Log
- Passwords (plain or hashed)
- API keys
- JWT tokens
- Credit card numbers
- Social security numbers
- Full IP addresses (anonymize last octet)

### Masking Examples
```typescript
// Mask sensitive fields
function maskSensitive(data: Record<string, any>): Record<string, any> {
  const masked = { ...data };
  
  if (masked.password) masked.password = '***';
  if (masked.apiKey) masked.apiKey = masked.apiKey.slice(0, 10) + '***';
  if (masked.token) masked.token = '***';
  if (masked.authorization) masked.authorization = 'Bearer ***';
  
  return masked;
}

// Anonymize IP address
function anonymizeIp(ip: string): string {
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
  }
  return 'unknown';
}
```

### Log Sanitization Middleware
```typescript
// Automatically strip sensitive fields from logged request bodies
const sensitiveFields = ['password', 'token', 'apiKey', 'secret'];

function sanitizeForLogging(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  const sanitized: any = Array.isArray(obj) ? [] : {};
  
  for (const key of Object.keys(obj)) {
    if (sensitiveFields.includes(key.toLowerCase())) {
      sanitized[key] = '***REDACTED***';
    } else if (typeof obj[key] === 'object') {
      sanitized[key] = sanitizeForLogging(obj[key]);
    } else {
      sanitized[key] = obj[key];
    }
  }
  
  return sanitized;
}
```

---

## 8. Audit Trail

### Purpose
Immutable record of all data modifications for compliance and investigation.

### What to Audit
- All create, update, delete operations
- Authentication events (login, logout, failed attempts)
- Authorization failures
- Status transitions (event lifecycle)
- Report verifications/rejections
- Assignment changes
- Configuration changes

### Audit Log Schema
```typescript
// src/models/audit-log.model.ts
interface AuditLog {
  _id: ObjectId;
  companyId: ObjectId;
  userId: ObjectId | null; // null for system actions
  correlationId: string;
  action: string;
  resourceType: 'event' | 'report' | 'camera' | 'user' | 'company';
  resourceId: ObjectId;
  oldValue: Record<string, any> | null;
  newValue: Record<string, any> | null;
  metadata: Record<string, any>;
  timestamp: Date;
  ipAddress: string; // anonymized
}
```

### Audit Service
```typescript
// src/services/audit.service.ts
import { AuditLog } from '../models/audit-log.model';

interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  metadata?: Record<string, any>;
}

export async function createAuditLog(
  entry: AuditEntry,
  context: { companyId: string; userId?: string; correlationId: string; ipAddress?: string }
) {
  return AuditLog.create({
    companyId: context.companyId,
    userId: context.userId || null,
    correlationId: context.correlationId,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    oldValue: entry.oldValue || null,
    newValue: entry.newValue || null,
    metadata: entry.metadata || {},
    timestamp: new Date(),
    ipAddress: anonymizeIp(context.ipAddress || 'unknown')
  });
}
```

### Usage Example
```typescript
// In event service
async function updateEventStatus(eventId: string, newStatus: string, context: RequestContext) {
  const event = await Event.findById(eventId);
  const oldStatus = event.status;
  
  event.status = newStatus;
  await event.save();
  
  // Create audit log entry
  await createAuditLog({
    action: 'event.status.updated',
    resourceType: 'event',
    resourceId: eventId,
    oldValue: { status: oldStatus },
    newValue: { status: newStatus }
  }, {
    companyId: context.companyId,
    userId: context.userId,
    correlationId: context.correlationId,
    ipAddress: context.ipAddress
  });
  
  return event;
}
```

---

## 9. Health Checks

### Endpoints
```typescript
// GET /api/health - Basic health check
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-01-12T15:30:00.000Z",
    "version": "1.0.0"
  }
}

// GET /api/health/detailed - Detailed health (internal only)
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-01-12T15:30:00.000Z",
    "version": "1.0.0",
    "components": {
      "database": { "status": "ok", "latency_ms": 5 },
      "redis": { "status": "ok", "latency_ms": 2 },
      "aiService": { "status": "ok", "latency_ms": 50 }
    },
    "uptime_seconds": 86400
  }
}
```

---

## 10. Metrics (Phase 2)

### Key Metrics to Track
```
# HTTP Request Metrics
http_requests_total{method, path, status}
http_request_duration_seconds{method, path}

# Business Metrics
events_created_total{company_id, event_type}
reports_submitted_total{company_id, report_type}
event_resolution_time_seconds{company_id, priority}

# System Metrics
database_queries_total{collection, operation}
database_query_duration_seconds{collection}
websocket_connections_active{company_id}
ai_detections_processed_total{camera_id}
```

---

## 11. Log Aggregation (Phase 2)

### Recommended Stack
- **Collection**: Fluent Bit (sidecar container)
- **Storage**: Elasticsearch / Loki
- **Visualization**: Kibana / Grafana

### Docker Logging
```yaml
# docker-compose.yml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## 12. Debugging Checklist

When investigating issues:

1. **Get Correlation ID** from user or response
2. **Search logs** by correlationId across all services
3. **Follow the flow**: API → Service → Database → External
4. **Check timestamps** for latency issues
5. **Look for WARN/ERROR** entries
6. **Check audit trail** for data changes
7. **Verify tenant context** (correct companyId)

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-12 | AI-Assisted | Initial logging & observability strategy |

---

*All services must implement this logging standard. Code reviews should verify logging compliance.*
