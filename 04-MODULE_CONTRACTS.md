# Event Monitoring and Management Platform

## Module Contracts Document

**Version:** 2.0  
**Date:** January 12, 2026  
**Status:** Frozen Foundation Document

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Contract Definitions](#2-contract-definitions)
3. [Core Service Contracts](#3-core-service-contracts)
4. [Integration Module Contracts](#4-integration-module-contracts)
5. [Cross-Cutting Contracts](#5-cross-cutting-contracts)

---

## 1. Introduction

### 1.1 Purpose

This document defines explicit contracts for all major modules and services in the Event Monitoring and Management Platform. Each contract specifies what a module does, what it requires, what it guarantees, and how it fails.

### 1.2 Contract Structure

Each module contract includes:

- **Purpose**: High-level responsibility of the module
- **Inputs**: Data and dependencies required
- **Outputs**: Data and effects produced
- **Responsibilities**: Specific tasks the module performs
- **Invariants**: Conditions that must always be true
- **Errors/Failure Modes**: How the module fails and error handling
- **Observability**: Logging, metrics, and monitoring

### 1.3 Design Principles

- **Single Responsibility**: Each module has one clear purpose
- **Explicit Dependencies**: All inputs and dependencies documented
- **Fail-Fast**: Invalid inputs rejected immediately
- **Observable**: All operations logged with structured data
- **Tenant Isolation**: All operations scoped to companyId

---

## 2. Contract Definitions

### 2.1 Common Types

```typescript
// Tenant isolation
type CompanyId = string; // ObjectId as string

// User identity
type UserId = string; // ObjectId as string
type UserRole = 'citizen' | 'first_responder' | 'operator' | 'admin' | 'company_admin' | 'super_admin';

// Geographic data
type GeoPoint = {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
};

// Correlation for tracing
type CorrelationId = string; // UUID v4

// Standard response envelope
type SuccessResponse<T> = {
  success: true;
  data: T;
  correlationId: CorrelationId;
};

type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  correlationId: CorrelationId;
};
```

---

## 3. Core Service Contracts

### 3.1 Authentication Service Contract

#### Purpose
Manage user authentication, authorization, and session lifecycle across web and mobile clients.

#### Inputs
- **User credentials**: email/phone + password
- **JWT tokens**: For validation
- **API keys**: For mobile app authentication
- **Company ID**: For tenant scoping

#### Outputs
- **JWT access tokens**: 24-hour expiration (configurable)
- **JWT refresh tokens**: 30-day expiration (configurable)
- **User context**: Authenticated user with role and companyId
- **Authentication events**: Login, logout, failed attempts

#### Responsibilities

1. **User Registration**
   - Validate email/phone uniqueness within company
   - Hash passwords with bcrypt (10+ rounds)
   - Generate email/SMS verification code
   - Create inactive user account pending verification

2. **User Authentication**
   - Verify credentials against stored hash
   - Generate JWT access and refresh tokens
   - Log authentication events (success, failure, IP address)
   - Enforce account lockout after 5 failed attempts

3. **Token Management**
   - Validate JWT signature and expiration
   - Issue new access token from valid refresh token
   - Rotate refresh tokens on use
   - Revoke all tokens on password change

4. **API Key Validation**
   - Map API key to company tenant
   - Verify API key is active
   - Rate limit per API key
   - Log API key usage

5. **Authorization (RBAC)**
   - Check user role against required permissions
   - Verify resource ownership within company
   - Enforce role hierarchy (cannot modify higher roles)

#### Invariants

- **Password Security**: Passwords never logged or returned in responses
- **Token Integrity**: JWT tokens signed with strong secret (256+ bits)
- **Tenant Isolation**: Users can only authenticate within their company
- **Account Lockout**: Locked accounts cannot authenticate until timeout expires
- **Audit Trail**: All authentication events logged immutably

#### Errors/Failure Modes

| Error Code | Condition | HTTP Status | Handling |
|------------|-----------|-------------|----------|
| `INVALID_CREDENTIALS` | Email/password mismatch | 401 | Log failed attempt, increment counter |
| `ACCOUNT_LOCKED` | 5+ failed attempts | 403 | Return lockout expiry time |
| `TOKEN_EXPIRED` | JWT past expiration | 401 | Client should refresh token |
| `TOKEN_INVALID` | JWT signature invalid | 401 | Force re-authentication |
| `INSUFFICIENT_PERMISSIONS` | Role lacks permission | 403 | Log permission denial |
| `API_KEY_INVALID` | Unknown or inactive key | 401 | Log invalid key attempt |
| `COMPANY_INACTIVE` | Company account disabled | 403 | Prevent all access |

#### Observability

**Logs**:
```json
{
  "level": "INFO",
  "service": "auth-service",
  "action": "user.login.success",
  "userId": "60d5ec49f1b2c8b1f8c1e4a1",
  "companyId": "60d5ec49f1b2c8b1f8c1e4a0",
  "correlationId": "uuid",
  "context": {
    "email": "user@example.com",
    "ipAddress": "192.168.1.100" // anonymized
  }
}
```

**Metrics**:
- `auth.login.success.count` (by companyId)
- `auth.login.failure.count` (by companyId)
- `auth.token.issued.count`
- `auth.token.validation.duration_ms`
- `auth.account_lockout.count`

---

### 3.2 Company Service Contract

#### Purpose
Manage multi-tenant company entities, settings, and API key lifecycle.

#### Inputs
- **Company data**: name, description, subscription plan
- **Company settings**: timezone, locale, feature flags
- **API key rotation requests**: From company_admin
- **User context**: Authenticated user with permissions

#### Outputs
- **Company records**: Complete company data
- **API keys**: Unique, hashed keys for mobile authentication
- **Usage statistics**: Events, reports, API calls per billing period
- **Company events**: Created, updated, deactivated

#### Responsibilities

1. **Company Creation** (super_admin only)
   - Generate unique API key (format: `emp_{shortId}_{random32}`)
   - Hash and store API key
   - Assign subscription plan and limits
   - Create initial company_admin user
   - Initialize default event types

2. **Settings Management**
   - Update company-specific configuration
   - Validate setting values (timezone, locale)
   - Store feature flags (anonymous reports, auto-events)
   - Propagate settings to related services

3. **API Key Lifecycle**
   - Generate new API key on company creation
   - Regenerate API key on request (with grace period)
   - Maintain old key validity during grace period (24h default)
   - Revoke old key after grace period

4. **Usage Tracking**
   - Count events created per month
   - Count reports submitted per month
   - Count API calls per month
   - Enforce subscription limits (soft limits with warnings)

#### Invariants

- **Unique API Key**: Each company has exactly one active API key
- **Unique Name**: Company names are globally unique
- **Tenant Isolation**: Company data never exposed cross-tenant
- **Grace Period**: Old API key valid during regeneration grace period
- **Audit Trail**: All company changes logged

#### Errors/Failure Modes

| Error Code | Condition | HTTP Status | Handling |
|------------|-----------|-------------|----------|
| `COMPANY_NOT_FOUND` | Invalid company ID | 404 | Return error |
| `COMPANY_NAME_EXISTS` | Duplicate company name | 409 | Suggest alternative |
| `COMPANY_INACTIVE` | Company deactivated | 403 | Prevent operations |
| `API_KEY_REGENERATION_FAILED` | Key generation collision | 500 | Retry with new random |
| `INSUFFICIENT_PERMISSIONS` | Non-admin attempting change | 403 | Log and deny |
| `SUBSCRIPTION_LIMIT_EXCEEDED` | Over quota | 429 | Return upgrade prompt |

#### Observability

**Logs**:
```json
{
  "level": "INFO",
  "service": "company-service",
  "action": "company.api_key.regenerated",
  "companyId": "60d5ec49f1b2c8b1f8c1e4a0",
  "userId": "60d5ec49f1b2c8b1f8c1e4a1",
  "correlationId": "uuid",
  "context": {
    "oldKeyPrefix": "emp_abc123_***",
    "newKeyPrefix": "emp_abc123_***",
    "gracePeriodHours": 24
  }
}
```

**Metrics**:
- `company.created.count`
- `company.api_key.regenerated.count`
- `company.usage.events.count` (by companyId)
- `company.usage.reports.count` (by companyId)
- `company.settings.updated.count`

---

### 3.3 User Service Contract

#### Purpose
Manage user accounts, profiles, roles, and first responder location tracking within companies.

#### Inputs
- **User data**: email/phone, name, role, companyId
- **Location updates**: GPS coordinates from first responders
- **User queries**: Filters, search, pagination
- **User context**: Authenticated user making request

#### Outputs
- **User records**: Complete user profiles
- **User lists**: Filtered, paginated results
- **Location data**: Real-time responder positions
- **User events**: Created, updated, deactivated, location updated

#### Responsibilities

1. **User CRUD Operations**
   - Create user with role validation (cannot create higher role)
   - Update user profile and role (with permission checks)
   - Soft delete (deactivate) users (preserve data integrity)
   - Prevent self-deletion and deletion of higher roles

2. **Profile Management**
   - Update user personal information
   - Change password (requires current password)
   - Update notification preferences
   - Manage device tokens for push notifications

3. **Location Tracking** (first_responders only)
   - Accept GPS coordinates with timestamp
   - Validate location accuracy and freshness
   - Store location with geo-spatial index
   - Broadcast location updates via WebSocket
   - Privacy: location only visible within company

4. **User Search and Filtering**
   - Filter by role, active status, company
   - Search by name, email, phone (scoped to company)
   - Paginate results (default 20 per page)
   - Sort by multiple fields

#### Invariants

- **Unique Identity**: Email/phone unique within company
- **Role Hierarchy**: Users cannot create/modify higher-role users
- **Tenant Isolation**: Users scoped to single company
- **Active Status**: Deactivated users cannot authenticate
- **Location Privacy**: Responder location only visible to same company
- **Data Retention**: Deactivated users preserved for audit trail

#### Errors/Failure Modes

| Error Code | Condition | HTTP Status | Handling |
|------------|-----------|-------------|----------|
| `USER_NOT_FOUND` | Invalid user ID | 404 | Return error |
| `USER_EMAIL_EXISTS` | Duplicate email in company | 409 | Suggest alternative |
| `USER_PHONE_EXISTS` | Duplicate phone in company | 409 | Suggest alternative |
| `INSUFFICIENT_PERMISSIONS` | Cannot modify higher role | 403 | Log and deny |
| `CANNOT_DELETE_SELF` | User attempting self-deletion | 400 | Prevent operation |
| `INVALID_LOCATION` | GPS coordinates out of range | 400 | Reject update |
| `LOCATION_NOT_FRESH` | Timestamp too old (>5min) | 400 | Log stale data |

#### Observability

**Logs**:
```json
{
  "level": "INFO",
  "service": "user-service",
  "action": "user.location.updated",
  "userId": "60d5ec49f1b2c8b1f8c1e4a1",
  "companyId": "60d5ec49f1b2c8b1f8c1e4a0",
  "correlationId": "uuid",
  "context": {
    "location": { "type": "Point", "coordinates": [-122.4, 37.8] },
    "timestamp": "2026-01-12T10:30:00Z",
    "accuracy": 10.5 // meters
  }
}
```

**Metrics**:
- `user.created.count` (by companyId, role)
- `user.deactivated.count`
- `user.location.updated.count` (by companyId)
- `user.location.update.latency_ms`
- `user.query.duration_ms`

---

### 3.4 Camera Service Contract

#### Purpose
Manage camera configuration, status monitoring, video stream access, and VMS integration.

#### Inputs
- **Camera data**: name, location, streamUrl, aiConfig, vmsConfig
- **Status updates**: online, offline, maintenance, error
- **Stream requests**: cameraId, live or playback, time range
- **VMS credentials**: For integration with video management systems

#### Outputs
- **Camera records**: Complete camera configuration
- **Stream URLs**: Live RTSP/HLS or playback URLs
- **Camera status**: Real-time connectivity state
- **Snapshot images**: JPEG frames from video
- **Camera events**: Created, updated, status changed

#### Responsibilities

1. **Camera CRUD Operations**
   - Create camera with required fields (name, location, streamUrl)
   - Validate GPS coordinates
   - Configure AI detection settings per camera
   - Configure VMS integration (type, connection, metadata)
   - Soft delete (preserve historical data)

2. **Status Monitoring**
   - Periodic health check (default 60 seconds)
   - Update status: online, offline, maintenance, error
   - Record last online timestamp
   - Trigger notifications on status change
   - Dashboard indicator updates

3. **Live Stream Access**
   - Generate HLS stream URL for web viewing
   - Transcode RTSP to HLS (if direct camera)
   - Proxy VMS live stream (if VMS-managed)
   - Enforce authentication and authorization
   - Handle multiple concurrent viewers

4. **Historical Playback Access**
   - Query VMS for recorded video at timestamp
   - Generate authenticated playback URL
   - Time-align to event timestamps
   - Support multi-camera synchronized playback
   - Handle VMS-specific API differences

5. **Snapshot Capture**
   - Extract frame from live stream
   - Retrieve snapshot from VMS at timestamp
   - Generate thumbnail images
   - Store with proper access controls

6. **Geo-Spatial Queries**
   - Find cameras near location (radius in meters)
   - Find cameras within polygon boundary
   - Sort by distance from point

#### Invariants

- **Unique Stream URL**: Each camera has unique stream source within company
- **Location Required**: All cameras have GPS coordinates
- **Tenant Isolation**: Cameras scoped to company
- **Status Consistency**: Status reflects actual connectivity
- **VMS Config Validity**: VMS type matches adapter implementation
- **Access Control**: Stream URLs authenticated and time-limited

#### Errors/Failure Modes

| Error Code | Condition | HTTP Status | Handling |
|------------|-----------|-------------|----------|
| `CAMERA_NOT_FOUND` | Invalid camera ID | 404 | Return error |
| `CAMERA_OFFLINE` | Camera not responding | 503 | Return status, suggest retry |
| `STREAM_UNAVAILABLE` | Cannot connect to stream | 503 | Log error, notify admin |
| `VMS_CONNECTION_FAILED` | VMS API error | 502 | Retry, fallback to direct |
| `PLAYBACK_NOT_SUPPORTED` | VMS lacks playback API | 501 | Inform user of limitation |
| `INVALID_TIME_RANGE` | Playback time out of range | 400 | Validate against retention |
| `TRANSCODE_FAILED` | FFmpeg error | 500 | Log error, suggest direct view |

#### Observability

**Logs**:
```json
{
  "level": "INFO",
  "service": "camera-service",
  "action": "camera.stream.accessed",
  "cameraId": "60d5ec49f1b2c8b1f8c1e4a2",
  "companyId": "60d5ec49f1b2c8b1f8c1e4a0",
  "userId": "60d5ec49f1b2c8b1f8c1e4a1",
  "correlationId": "uuid",
  "context": {
    "streamType": "live",
    "vmsType": "direct",
    "protocol": "hls"
  }
}
```

**Metrics**:
- `camera.created.count` (by companyId)
- `camera.status.changed.count` (by status)
- `camera.stream.accessed.count` (by streamType)
- `camera.stream.concurrent_viewers.gauge`
- `camera.health_check.duration_ms`
- `camera.transcode.duration_ms`

---

### 3.5 Event Service Contract

#### Purpose
Manage event lifecycle from creation through resolution, including report aggregation, assignment, and audit trail.

#### Inputs
- **Event data**: title, description, location, eventTypeId, priority
- **Report linkages**: Reports to aggregate into event
- **Status transitions**: active → assigned → resolved → closed
- **Assignment**: responderId to assign event
- **Resolution**: notes and outcome

#### Outputs
- **Event records**: Complete event data with linked reports
- **Event lists**: Filtered, sorted, paginated
- **Audit trail**: Immutable history of all changes
- **Event notifications**: Real-time broadcasts of changes
- **Assignment notifications**: To assigned responders

#### Responsibilities

1. **Event Creation**
   - Accept manual creation by operators
   - Auto-create from AI detections (if enabled)
   - Auto-create from citizen reports (if enabled)
   - Validate required fields (title, location, eventTypeId)
   - Initialize status to 'active'
   - Generate correlation ID for tracking

2. **Event-Report Aggregation**
   - Auto-link reports within proximity (500m, 15min configurable)
   - Manual link/unlink by operators
   - Maintain list of linked report IDs
   - Update event when reports added/removed
   - Spatial queries for nearby events

3. **Event Lifecycle Management**
   - State transitions: active → assigned → resolved → closed
   - Validate state transition rules
   - Require resolution notes for resolved state
   - Mark closed events read-only
   - Archive old closed events (configurable retention)

4. **Event Assignment**
   - Assign to available first responder
   - Validate responder exists and is active
   - Support reassignment with reason
   - Notify assignee via WebSocket and push
   - Track assignment history

5. **Audit Trail**
   - Log every event creation, update, deletion
   - Log every status transition with user and timestamp
   - Log every report link/unlink
   - Log every assignment change
   - Store old and new values for changes
   - Append-only, immutable audit log

6. **Event Search and Filtering**
   - Filter by status, priority, type, date range, assignee
   - Full-text search on title and description
   - Geo-spatial search (near location, within bounds)
   - Sort by multiple fields
   - Paginate results

#### Invariants

- **Lifecycle Progression**: Events follow defined state machine
- **Resolution Required**: Resolved events must have resolution notes
- **Closed Immutability**: Closed events cannot be modified
- **Tenant Isolation**: Events scoped to company
- **Report Consistency**: Linked reports belong to same company
- **Audit Integrity**: Audit trail is append-only and complete
- **Assignment Validity**: Assigned user is first_responder role

#### Errors/Failure Modes

| Error Code | Condition | HTTP Status | Handling |
|------------|-----------|-------------|----------|
| `EVENT_NOT_FOUND` | Invalid event ID | 404 | Return error |
| `INVALID_STATE_TRANSITION` | Illegal status change | 400 | Return allowed transitions |
| `RESOLUTION_NOTES_REQUIRED` | Resolving without notes | 400 | Prompt for notes |
| `EVENT_CLOSED` | Modifying closed event | 409 | Inform immutable |
| `REPORT_NOT_FOUND` | Linking invalid report | 404 | Validate report exists |
| `REPORT_COMPANY_MISMATCH` | Cross-tenant report link | 403 | Prevent linking |
| `RESPONDER_NOT_FOUND` | Assigning to invalid user | 404 | Validate user |
| `RESPONDER_INVALID_ROLE` | Assigning to non-responder | 400 | Require responder role |

#### Observability

**Logs**:
```json
{
  "level": "INFO",
  "service": "event-service",
  "action": "event.status.updated",
  "eventId": "60d5ec49f1b2c8b1f8c1e4a3",
  "companyId": "60d5ec49f1b2c8b1f8c1e4a0",
  "userId": "60d5ec49f1b2c8b1f8c1e4a1",
  "correlationId": "uuid",
  "context": {
    "oldStatus": "active",
    "newStatus": "assigned",
    "assignedTo": "60d5ec49f1b2c8b1f8c1e4a4",
    "reason": "Closest available responder"
  }
}
```

**Metrics**:
- `event.created.count` (by companyId, source)
- `event.status.transitioned.count` (by oldStatus, newStatus)
- `event.assigned.count` (by companyId)
- `event.resolved.count` (by companyId)
- `event.resolution_time.duration_seconds` (histogram)
- `event.active.count.gauge` (by companyId, priority)

---

### 3.6 Report Service Contract

#### Purpose
Manage report submissions from all sources (citizen, camera, responder) with attachments and verification workflow.

#### Inputs
- **Citizen reports**: title, description, location, photos, eventTypeId
- **Camera reports**: detectionData, snapshot, confidence, cameraId
- **Responder reports**: eventId, updates, photos/videos
- **Attachments**: Images, videos, audio files
- **Review actions**: verify, reject with notes

#### Outputs
- **Report records**: Complete report data with attachments
- **Report lists**: Filtered, paginated results
- **Attachment URLs**: Secure access to media files
- **Verification events**: Report verified/rejected
- **Event linkage**: Reports linked to events

#### Responsibilities

1. **Citizen Report Submission**
   - Accept title, description, location, eventType
   - Support authenticated and anonymous submission
   - Validate GPS coordinates
   - Handle up to 5 media attachments (configurable)
   - Generate thumbnails for images/videos
   - Auto-link to nearby event or create new (if enabled)

2. **Camera Report Auto-Creation**
   - Receive detection callback from AI service
   - Create report with detection metadata
   - Store snapshot image
   - Include confidence score and object type
   - Link to source camera
   - Auto-aggregate into event

3. **Responder Report Submission**
   - Accept field updates for assigned event
   - Attach photos/videos from scene
   - Include current GPS location
   - Link to event automatically
   - Update event status if specified

4. **Attachment Management**
   - Validate file type (image, video, audio)
   - Validate file size (max 10MB default, configurable)
   - Generate secure storage path
   - Create thumbnails (images, video first frame)
   - Store attachment metadata (timestamp, GPS, hash)
   - Generate time-limited signed URLs for access

5. **Report Verification Workflow**
   - Operator reviews submitted reports
   - Status: submitted → under_review → verified/rejected
   - Capture review notes and reviewer user
   - Verified reports auto-link to events
   - Rejected reports marked with reason

6. **Report Search and Filtering**
   - Filter by reportType, status, eventId, userId, cameraId
   - Geo-spatial search (near location)
   - Date range filtering
   - Full-text search on title/description

#### Invariants

- **Source Integrity**: Report source (citizen/camera/responder) immutable
- **Tenant Isolation**: Reports scoped to company
- **Attachment Limit**: Enforced maximum attachments per report
- **Location Required**: All reports have GPS coordinates
- **Event Linkage**: Reports linked to at most one event
- **Verification Workflow**: Only operators can verify/reject
- **Attachment Security**: Media files access-controlled

#### Errors/Failure Modes

| Error Code | Condition | HTTP Status | Handling |
|------------|-----------|-------------|----------|
| `REPORT_NOT_FOUND` | Invalid report ID | 404 | Return error |
| `ATTACHMENT_TOO_LARGE` | File exceeds size limit | 413 | Return max size |
| `ATTACHMENT_INVALID_TYPE` | Unsupported file type | 415 | Return allowed types |
| `ATTACHMENT_LIMIT_EXCEEDED` | Too many attachments | 400 | Return max count |
| `ANONYMOUS_NOT_ALLOWED` | Company disables anonymous | 403 | Require authentication |
| `LOCATION_INVALID` | GPS coordinates invalid | 400 | Validate range |
| `EVENT_NOT_FOUND` | Linking to invalid event | 404 | Validate event exists |
| `INSUFFICIENT_PERMISSIONS` | Non-operator verifying | 403 | Require operator role |

#### Observability

**Logs**:
```json
{
  "level": "INFO",
  "service": "report-service",
  "action": "report.created",
  "reportId": "60d5ec49f1b2c8b1f8c1e4a5",
  "companyId": "60d5ec49f1b2c8b1f8c1e4a0",
  "userId": "60d5ec49f1b2c8b1f8c1e4a1", // null if anonymous
  "correlationId": "uuid",
  "context": {
    "reportType": "citizen",
    "eventTypeId": "60d5ec49f1b2c8b1f8c1e4a6",
    "attachmentCount": 2,
    "anonymous": false,
    "linkedToEvent": "60d5ec49f1b2c8b1f8c1e4a3"
  }
}
```

**Metrics**:
- `report.created.count` (by companyId, reportType)
- `report.verified.count` (by companyId)
- `report.rejected.count` (by companyId)
- `report.attachment.uploaded.count` (by type)
- `report.attachment.upload.duration_ms`
- `report.creation.duration_ms`

---

### 3.7 EventType Service Contract

#### Purpose
Manage event type taxonomy including system defaults and company-specific custom types.

#### Inputs
- **EventType data**: name, description, icon, color, defaultPriority
- **Company ID**: For company-specific types
- **Active status**: Enable/disable types

#### Outputs
- **EventType records**: Complete type definitions
- **Type lists**: System defaults + company-specific
- **Type events**: Created, updated, activated/deactivated

#### Responsibilities

1. **System Default Types**
   - Seed database with standard event types
   - Prevent deletion of system defaults
   - Allow companies to deactivate (hide) defaults
   - Update defaults across all companies on system upgrade

2. **Custom Type Management**
   - Create company-specific event types
   - Validate name uniqueness within company
   - Configure icon, color, default priority
   - Support hierarchical categories (Phase 2)
   - Soft delete (deactivate) to preserve history

3. **Type Retrieval**
   - Return system defaults + company-specific types
   - Filter by active status
   - Sort by name or custom order
   - Merge system and custom types in response

#### Invariants

- **System Defaults Immutable**: Cannot delete system types
- **Unique Names**: Type names unique within company scope
- **Tenant Isolation**: Custom types scoped to company
- **Data Preservation**: Deactivated types preserved for history
- **Default Priority**: All types have default priority defined

#### Errors/Failure Modes

| Error Code | Condition | HTTP Status | Handling |
|------------|-----------|-------------|----------|
| `EVENTTYPE_NOT_FOUND` | Invalid type ID | 404 | Return error |
| `EVENTTYPE_NAME_EXISTS` | Duplicate name in company | 409 | Suggest alternative |
| `CANNOT_DELETE_SYSTEM_TYPE` | Deleting system default | 403 | Prevent deletion |
| `EVENTTYPE_IN_USE` | Deleting type with events | 409 | Suggest deactivate |
| `INVALID_COLOR` | Malformed hex color | 400 | Validate format |
| `INVALID_PRIORITY` | Unknown priority value | 400 | Return allowed values |

#### Observability

**Logs**:
```json
{
  "level": "INFO",
  "service": "eventtype-service",
  "action": "eventtype.created",
  "eventTypeId": "60d5ec49f1b2c8b1f8c1e4a6",
  "companyId": "60d5ec49f1b2c8b1f8c1e4a0",
  "userId": "60d5ec49f1b2c8b1f8c1e4a1",
  "correlationId": "uuid",
  "context": {
    "name": "Custom Alert Type",
    "color": "#FF5733",
    "defaultPriority": "high",
    "isSystemDefault": false
  }
}
```

**Metrics**:
- `eventtype.created.count` (by companyId)
- `eventtype.deactivated.count`
- `eventtype.query.duration_ms`

---

## 4. Integration Module Contracts

### 4.1 AI Detection Service Contract

#### Purpose
Process video streams with YOLOv8 object detection and submit detections to backend as camera reports.

#### Inputs
- **Camera stream URLs**: RTSP endpoints to monitor
- **Detection configuration**: Object types, confidence threshold, regions
- **Backend API endpoint**: Where to send detection callbacks

#### Outputs
- **Detection callbacks**: POST to backend with detection data
- **Snapshot images**: JPEG frames with bounding boxes
- **Detection metadata**: Confidence, coordinates, timestamp
- **Health status**: Service availability and performance

#### Responsibilities

1. **Video Stream Processing**
   - Connect to RTSP camera streams
   - Extract frames at 5-10 FPS (configurable)
   - Queue frames for inference
   - Handle stream interruptions (reconnect)
   - Support multiple concurrent cameras

2. **Object Detection Inference**
   - Load YOLOv8 model (person, vehicle classes)
   - Run inference on frames
   - Extract bounding box coordinates
   - Calculate confidence scores
   - GPU acceleration when available

3. **Detection Filtering**
   - Apply per-camera confidence threshold
   - Debounce duplicate detections (30 seconds default)
   - Aggregate spatially close detections
   - Skip low-confidence detections

4. **Detection Callback**
   - POST to backend `/api/ai/detection`
   - Include: cameraId, objectType, confidence, bbox, timestamp
   - Attach snapshot image (JPEG, base64 encoded)
   - Retry on failure (3 attempts, exponential backoff)
   - Include correlation ID for tracing

5. **Performance Management**
   - Monitor frame processing rate (FPS)
   - Skip frames during overload
   - Queue management (drop oldest if full)
   - Report processing lag to backend

#### Invariants

- **Real-Time Processing**: Target 5+ FPS per camera
- **Confidence Threshold**: Never submit below configured threshold
- **Deduplication**: Same object not detected twice within debounce window
- **Callback Reliability**: Retry failed callbacks with backoff
- **Snapshot Quality**: Always include clear, identifiable image

#### Errors/Failure Modes

| Error Code | Condition | Handling |
|------------|-----------|----------|
| `STREAM_CONNECTION_FAILED` | Cannot connect to RTSP | Retry every 30s, log error |
| `STREAM_TIMEOUT` | No frames received for 60s | Reconnect stream |
| `MODEL_LOAD_FAILED` | YOLOv8 model file missing | Fatal error, exit |
| `INFERENCE_ERROR` | GPU/model error | Log, skip frame, continue |
| `CALLBACK_FAILED` | Backend API unreachable | Retry 3x, then drop detection |
| `QUEUE_FULL` | Frame queue overflow | Drop oldest frames, log warning |
| `OUT_OF_MEMORY` | Insufficient GPU memory | Reduce batch size, restart |

#### Observability

**Logs**:
```json
{
  "level": "INFO",
  "service": "ai-detection-service",
  "action": "detection.submitted",
  "cameraId": "60d5ec49f1b2c8b1f8c1e4a2",
  "correlationId": "uuid",
  "context": {
    "objectType": "person",
    "confidence": 0.87,
    "boundingBox": { "x": 120, "y": 80, "w": 50, "h": 120 },
    "inferenceTime_ms": 45
  }
}
```

**Metrics**:
- `ai.detection.submitted.count` (by objectType)
- `ai.inference.duration_ms` (histogram)
- `ai.frames_processed.count` (by cameraId)
- `ai.frames_skipped.count` (by reason)
- `ai.callback.success.count`
- `ai.callback.failure.count`
- `ai.queue_depth.gauge` (by cameraId)

---

### 4.2 VMS Adapter Contract

#### Purpose
Abstract video source access across multiple VMS platforms (direct cameras, Milestone, Genetec) with consistent interface.

#### Inputs
- **Camera configuration**: vmsType, connectionId, metadata
- **VMS credentials**: API tokens, usernames, passwords
- **Stream requests**: Live or playback with time range
- **Snapshot requests**: Timestamp for image capture

#### Outputs
- **Stream URLs**: Authenticated URLs for live or recorded video
- **Snapshot images**: JPEG frames at specified timestamps
- **Camera status**: Connectivity and health from VMS
- **Adapter errors**: VMS-specific error details

#### Responsibilities

1. **Adapter Interface Implementation**
   - `getLiveStreamUrl(cameraId): Promise<string>`
   - `getPlaybackUrl(cameraId, startTime, endTime?): Promise<string>`
   - `getSnapshot(cameraId, timestamp): Promise<Buffer>`
   - `getCameraStatus(cameraId): Promise<CameraStatus>`
   - `exportClip(cameraId, startTime, endTime): Promise<string>` (optional)

2. **Direct RTSP Adapter**
   - Connect to IP cameras via RTSP protocol
   - Transcode RTSP to HLS for web viewing
   - Extract snapshots from live stream
   - No playback support (cameras don't store)

3. **Milestone Adapter** (Phase 2)
   - Authenticate with Milestone XProtect API
   - Request live stream URLs
   - Request video export for time ranges
   - Parse Milestone-specific responses

4. **Genetec Adapter** (Phase 2)
   - Authenticate with Genetec Security Center API
   - Request playback tokens
   - Generate HLS streams from playback
   - Handle Genetec error codes

5. **VMS Connection Management**
   - Store credentials securely (encrypted)
   - Test connection health periodically
   - Refresh authentication tokens
   - Handle VMS disconnections gracefully

#### Invariants

- **Interface Consistency**: All adapters implement same interface
- **Authentication Security**: Credentials never logged
- **URL Expiration**: Generated URLs time-limited (1 hour default)
- **Error Transparency**: VMS errors mapped to standard codes
- **Fallback Support**: Direct RTSP fallback when VMS unavailable

#### Errors/Failure Modes

| Error Code | Condition | Handling |
|------------|-----------|----------|
| `VMS_CONNECTION_FAILED` | Cannot reach VMS API | Retry, fallback to direct |
| `VMS_AUTH_FAILED` | Invalid credentials | Log, notify admin |
| `VMS_CAMERA_NOT_FOUND` | Camera not in VMS | Return error |
| `VMS_PLAYBACK_UNAVAILABLE` | No recording at timestamp | Return available times |
| `VMS_API_ERROR` | VMS internal error | Log, return 502 |
| `STREAM_GENERATION_FAILED` | Cannot create stream URL | Retry, return error |

#### Observability

**Logs**:
```json
{
  "level": "INFO",
  "service": "vms-adapter",
  "action": "playback.url.generated",
  "cameraId": "60d5ec49f1b2c8b1f8c1e4a2",
  "correlationId": "uuid",
  "context": {
    "vmsType": "milestone",
    "startTime": "2026-01-12T10:00:00Z",
    "endTime": "2026-01-12T10:05:00Z",
    "urlExpiresAt": "2026-01-12T11:30:00Z"
  }
}
```

**Metrics**:
- `vms.adapter.request.count` (by vmsType, operation)
- `vms.adapter.request.duration_ms` (by vmsType)
- `vms.adapter.error.count` (by vmsType, errorCode)
- `vms.connection.health.gauge` (by connectionId)

---

### 4.3 WebSocket Service Contract

#### Purpose
Provide real-time bidirectional communication for dashboard updates, location sharing, and notifications.

#### Inputs
- **Socket connections**: Authenticated WebSocket clients
- **Domain events**: From Event, User, Report services
- **Client messages**: Location updates, subscriptions
- **Authentication tokens**: JWT for socket authentication

#### Outputs
- **Event broadcasts**: New/updated events to company room
- **Location updates**: Responder positions to company room
- **Notifications**: Alerts for high-priority events
- **Connection status**: Connected clients count

#### Responsibilities

1. **Connection Management**
   - Accept WebSocket connections with JWT auth
   - Validate token on connection
   - Join client to company-specific room (tenant isolation)
   - Handle disconnections and reconnections
   - Track connected clients per company

2. **Event Broadcasting**
   - Listen to domain events (event.created, event.updated)
   - Broadcast to company room (tenant-scoped)
   - Include full event data in broadcast
   - Rate limit broadcasts (prevent flooding)

3. **Location Updates**
   - Receive location updates from responder clients
   - Validate and store location in database
   - Broadcast to company room for map updates
   - Throttle updates (max 1 per 5 seconds per user)

4. **Notification Delivery**
   - Send critical/high priority alerts
   - Include event details and priority
   - Support dismissible notifications
   - Track notification delivery

5. **Room Management**
   - One room per company: `company:{companyId}`
   - Enforce tenant isolation (no cross-company messages)
   - Clean up empty rooms
   - Monitor room sizes

#### Invariants

- **Tenant Isolation**: Clients only receive data from own company
- **Authentication Required**: All connections must have valid JWT
- **Room Scoping**: All broadcasts scoped to company room
- **No Cross-Company**: Impossible to receive other companies' data
- **Connection Limit**: Configurable max connections per company

#### Errors/Failure Modes

| Error Code | Condition | Handling |
|------------|-----------|----------|
| `AUTH_FAILED` | Invalid JWT on connection | Reject connection |
| `TOKEN_EXPIRED` | JWT expired during session | Disconnect, require reconnect |
| `ROOM_JOIN_FAILED` | Cannot join company room | Disconnect |
| `MESSAGE_TOO_LARGE` | Client sends >1MB message | Disconnect |
| `RATE_LIMIT_EXCEEDED` | Too many messages/second | Throttle, disconnect if continues |
| `BROADCAST_FAILED` | Error sending to room | Log, retry once |

#### Observability

**Logs**:
```json
{
  "level": "INFO",
  "service": "websocket-service",
  "action": "event.broadcasted",
  "companyId": "60d5ec49f1b2c8b1f8c1e4a0",
  "correlationId": "uuid",
  "context": {
    "eventType": "event:new",
    "eventId": "60d5ec49f1b2c8b1f8c1e4a3",
    "connectedClients": 12
  }
}
```

**Metrics**:
- `websocket.connections.active.gauge` (by companyId)
- `websocket.message.sent.count` (by eventType)
- `websocket.message.received.count` (by messageType)
- `websocket.broadcast.duration_ms`
- `websocket.connection.duration_seconds` (histogram)

---

## 5. Cross-Cutting Contracts

### 5.1 Logging Service Contract

#### Purpose
Provide structured, consistent logging across all services with correlation and context.

#### Inputs
- **Log level**: ERROR, WARN, INFO, DEBUG
- **Service name**: Originating service
- **Action**: Specific operation being logged
- **Correlation ID**: Request tracking UUID
- **User/Company context**: Identifiers for tracing
- **Structured data**: Key-value context object

#### Outputs
- **JSON log entries**: Structured logs to stdout
- **Aggregated logs**: Collected by container runtime
- **Searchable logs**: Indexed for querying (Phase 2)

#### Responsibilities

1. **Structured Logging**
   - Emit JSON-formatted log entries
   - Include timestamp (ISO 8601)
   - Include log level
   - Include service name
   - Include correlation ID (if available)
   - Include user/company IDs (if available)
   - Include structured context object

2. **Sensitive Data Protection**
   - Never log passwords or tokens
   - Never log full credit card numbers
   - Anonymize IP addresses (last octet)
   - Redact PII from logs
   - Hash or mask sensitive fields

3. **Log Levels**
   - ERROR: System errors requiring attention
   - WARN: Unexpected but handled conditions
   - INFO: Normal operational events
   - DEBUG: Detailed diagnostic information (dev only)

4. **Correlation Propagation**
   - Generate correlation ID if not present
   - Include in all downstream calls
   - Thread through entire request lifecycle
   - Return in API response headers

#### Invariants

- **No Secrets**: Passwords, tokens, API keys never logged
- **Structured Format**: All logs are valid JSON
- **Correlation ID**: Always present when available
- **Timestamp**: Always ISO 8601 format
- **Service Name**: Always identifies source service

#### Observability

**Log Format**:
```json
{
  "timestamp": "2026-01-12T10:30:00.000Z",
  "level": "INFO",
  "service": "backend-api",
  "action": "user.created",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "60d5ec49f1b2c8b1f8c1e4a1",
  "companyId": "60d5ec49f1b2c8b1f8c1e4a0",
  "context": {
    "role": "operator",
    "email": "user@example.com"
  }
}
```

---

### 5.2 Audit Trail Service Contract

#### Purpose
Maintain immutable, queryable audit log of all data modifications and security events.

#### Inputs
- **Action**: What was done (e.g., "event.status.updated")
- **Resource**: Type and ID of affected resource
- **User**: Who performed the action
- **Company**: Tenant context
- **Old/New values**: State before and after change
- **Correlation ID**: Request tracking
- **Timestamp**: When action occurred

#### Outputs
- **Audit log entries**: Immutable records in database
- **Audit reports**: Queryable history for compliance
- **Change timelines**: Chronological view of resource changes

#### Responsibilities

1. **Audit Logging**
   - Record all create, update, delete operations
   - Record all state transitions
   - Record all authentication events
   - Record all authorization failures
   - Include old and new values
   - Never allow modification or deletion

2. **Audit Queries**
   - Query by resource type and ID
   - Query by user ID
   - Query by company ID
   - Query by date range
   - Query by correlation ID
   - Full-text search on action

3. **Compliance Support**
   - Retain audit logs per policy (minimum 90 days)
   - Export audit logs for external systems
   - Generate compliance reports
   - Support legal discovery requests

#### Invariants

- **Immutability**: Audit logs can never be modified or deleted
- **Completeness**: All modifications logged, no gaps
- **Tenant Isolation**: Audit logs scoped to company
- **Correlation**: All related actions share correlation ID
- **Integrity**: Audit logs checksummed for tamper detection

#### Observability

**Audit Log Schema**:
```json
{
  "_id": "ObjectId",
  "companyId": "ObjectId",
  "userId": "ObjectId",
  "correlationId": "uuid",
  "action": "event.status.updated",
  "resourceType": "event",
  "resourceId": "ObjectId",
  "oldValue": { "status": "active" },
  "newValue": { "status": "resolved" },
  "metadata": { "resolutionNotes": "..." },
  "timestamp": "ISODate",
  "ipAddress": "192.168.1.***" // anonymized
}
```

---

### 5.3 API Documentation Contract

#### Purpose
Maintain complete, accurate, testable API documentation via OpenAPI specification.

#### Inputs
- **Route definitions**: All API endpoints
- **Schema definitions**: Request/response types
- **Authentication methods**: JWT, API key
- **Error responses**: Standard error formats

#### Outputs
- **OpenAPI specification**: Machine-readable API contract
- **Swagger UI**: Interactive API documentation
- **Code generation**: Client SDKs (Phase 2)
- **Contract tests**: Automated validation

#### Responsibilities

1. **Specification Maintenance**
   - Document all endpoints with parameters
   - Define request/response schemas
   - Include examples for complex requests
   - Document error responses with codes
   - Keep specification in sync with code

2. **Interactive Documentation**
   - Host Swagger UI at `/api/docs`
   - Support "Try it out" functionality
   - Include authentication mechanisms
   - Provide downloadable spec file

3. **Contract Testing**
   - Validate requests against specification
   - Validate responses against specification
   - Fail tests on breaking changes
   - Generate contract test reports

#### Invariants

- **Completeness**: All endpoints documented
- **Accuracy**: Spec matches actual API behavior
- **Examples**: All complex schemas have examples
- **Versioning**: Breaking changes require new version

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-12 | AI-Assisted | Initial module contracts |
| 2.0 | 2026-01-12 | AI-Assisted | Complete contracts for all modules: Auth, Company, User, Camera, Event, Report, EventType, AI, VMS, WebSocket, Logging, Audit |

---

*This document defines explicit contracts for all modules in the Event Monitoring and Management Platform. Implementation must honor these contracts. Contract changes require formal review and version update.*
