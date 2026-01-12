# Event Monitoring and Management Platform

## Requirements Specification Document

**Version:** 2.0  
**Date:** January 12, 2026  
**Status:** Frozen Foundation Document

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Technology Constraints](#2-technology-constraints)
3. [User Roles and Permissions](#3-user-roles-and-permissions)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Data Requirements](#6-data-requirements)
7. [Integration Requirements](#7-integration-requirements)

---

## 1. Introduction

### 1.1 Purpose

This document specifies complete, testable requirements for the Event Monitoring and Management Platform. Each requirement is classified by priority and includes acceptance criteria for verification.

### 1.2 Requirement Priorities

- **MUST**: Mandatory for MVP release - system incomplete without this
- **SHOULD**: Highly desired for MVP - include unless significant blockers arise
- **COULD**: Valuable but deferrable - include if time/resources permit
- **WON'T (MVP)**: Explicitly deferred to Phase 2+ - documented for future planning

### 1.3 Terminology

- **Report**: Atomic input from any source (citizen, camera, responder) with optional attachments
- **Event**: Aggregated incident linking multiple reports, tracked through lifecycle
- **VMS**: Video Management System providing video storage and playback
- **Operator**: User role with dashboard access for monitoring and managing incidents

---

## 2. Technology Constraints

**Note**: The following technology stack is a hard requirement from the project assignment.

### 2.1 Required Technologies

| Layer | Technology | Constraint Reason |
|-------|------------|-------------------|
| Backend API | Node.js + TypeScript | Assignment requirement |
| Database | MongoDB | Assignment requirement |
| Web Frontend | React + TypeScript | Assignment requirement |
| Mobile Apps | React Native + TypeScript | Assignment requirement |
| AI Service | Python + FastAPI | Assignment requirement for AI workload |

### 2.2 Deployment

| Component | Technology | Priority |
|-----------|------------|----------|
| Containerization | Docker | MUST |
| Orchestration | Docker Compose (MVP), Kubernetes (Phase 2+) | MUST for MVP |
| Reverse Proxy | Nginx | SHOULD |

---

## 3. User Roles and Permissions

### 3.1 Role Hierarchy

```
super_admin
  └── company_admin
        └── admin
              └── operator
                    ├── first_responder
                    └── citizen
```

### 3.2 Role Definitions

#### 3.2.1 Citizen

**Description**: Public mobile app users who submit incident reports

| Capability | Allowed | Notes |
|------------|---------|-------|
| Submit authenticated reports | ✅ | With user identity |
| Submit anonymous reports | ✅ | If company policy allows |
| Attach media to reports | ✅ | Images/videos/audio |
| View own report status | ✅ | Track lifecycle |
| View public event information | ✅ | Limited details |
| Access dashboard | ❌ | Mobile app only |
| View other users' data | ❌ | Privacy protection |

#### 3.2.2 First Responder

**Description**: Emergency/security personnel with field mobile app

| Capability | Allowed | Notes |
|------------|---------|-------|
| All citizen capabilities | ✅ | Can submit reports |
| Share live GPS location | ✅ | For dispatch visibility |
| Receive event assignments | ✅ | Push to mobile |
| Update event status | ✅ | Field updates |
| View event full details | ✅ | Including all reports |
| View other responders (same company) | ✅ | Coordination |
| Access full dashboard | ✅ | Via mobile or web |

#### 3.2.3 Operator

**Description**: Control room personnel monitoring and managing incidents

| Capability | Allowed | Notes |
|------------|---------|-------|
| View all events | ✅ | Company-scoped |
| View all reports | ✅ | All sources |
| View all cameras | ✅ | Live and config |
| Access live video streams | ✅ | Multiple simultaneous |
| Access historical video playback | ✅ | Time-aligned to events |
| Create manual events | ✅ | From observations |
| Link/unlink reports to events | ✅ | Manual correlation |
| Assign events to responders | ✅ | Dispatch function |
| Update event status | ✅ | Lifecycle management |
| Verify/reject reports | ✅ | Quality control |
| Manage users | ❌ | Admin function |
| Configure system | ❌ | Admin function |

#### 3.2.4 Admin

**Description**: Company administrators with configuration access

| Capability | Allowed | Notes |
|------------|---------|-------|
| All operator capabilities | ✅ | Can operate system |
| Create/edit/delete users | ✅ | Except higher roles |
| Manage cameras | ✅ | Add, edit, remove |
| Configure event types | ✅ | Company taxonomy |
| View audit logs | ✅ | All user actions |
| Configure company settings | ✅ | Limited settings |
| Manage API keys | ❌ | Company admin only |

#### 3.2.5 Company Admin

**Description**: Organization owner with full company control

| Capability | Allowed | Notes |
|------------|---------|-------|
| All admin capabilities | ✅ | Full access |
| Manage API keys | ✅ | Generation and rotation |
| Configure all company settings | ✅ | Complete control |
| View usage and billing | ✅ | Metrics |
| Promote users to admin | ✅ | Role management |

#### 3.2.6 Super Admin

**Description**: Platform administrator across all companies

| Capability | Allowed | Notes |
|------------|---------|-------|
| Create/manage companies | ✅ | Tenant provisioning |
| Access any company data | ✅ | Cross-tenant support |
| System-wide configuration | ✅ | Global settings |
| Platform health monitoring | ✅ | Infrastructure |

---

## 4. Functional Requirements

### 4.1 Authentication and Authorization

#### FR-AUTH-001: User Registration
- **Priority**: MUST
- **Description**: Users register with email (web) or phone (mobile) and password
- **Acceptance Criteria**:
  - Email validated via confirmation link
  - Phone validated via OTP code (SMS or email)
  - Password minimum 8 characters, 1 uppercase, 1 number, 1 special character
  - Prevent duplicate email/phone per company
  - New user account disabled until verified

#### FR-AUTH-002: User Login
- **Priority**: MUST
- **Description**: Users authenticate to access the system
- **Acceptance Criteria**:
  - Web: Email + password
  - Mobile: Phone + password
  - JWT token issued on successful authentication
  - Token expiration configurable (default 24 hours)
  - Refresh token mechanism to extend sessions
  - Failed login attempts logged

#### FR-AUTH-003: API Key Authentication
- **Priority**: MUST
- **Description**: Mobile apps authenticate using company API keys
- **Acceptance Criteria**:
  - API key in header `X-API-Key`
  - Key maps to specific company (tenant isolation)
  - Invalid key returns 401 Unauthorized
  - Rate limiting applied per API key
  - Key usage logged for audit

#### FR-AUTH-004: Role-Based Access Control (RBAC)
- **Priority**: MUST
- **Description**: System enforces permissions based on user role
- **Acceptance Criteria**:
  - Role verified on every API request
  - Insufficient permissions return 403 Forbidden
  - Roles assignable only by equal or higher role
  - Tenant isolation: users cannot access other companies' data
  - RBAC rules tested in integration tests

#### FR-AUTH-005: Password Reset
- **Priority**: MUST
- **Description**: Users can reset forgotten passwords
- **Acceptance Criteria**:
  - Reset link/code sent to email or SMS
  - Reset token expires in 1 hour
  - Old password cannot be reused
  - All existing sessions invalidated on password change
  - Password reset event logged to audit trail

#### FR-AUTH-006: Session Management
- **Priority**: MUST
- **Description**: System manages user sessions securely
- **Acceptance Criteria**:
  - Logout invalidates JWT refresh token
  - Concurrent session limit configurable per role
  - Session activity tracked for audit
  - Idle timeout configurable (default 30 minutes for web)

---

### 4.2 Company (Tenant) Management

#### FR-COMP-001: Company Creation
- **Priority**: MUST
- **Description**: Super admins create new company tenants
- **Acceptance Criteria**:
  - Unique company name and identifier
  - Unique API key auto-generated
  - Subscription plan assigned
  - Initial company_admin user created
  - Company creation logged

#### FR-COMP-002: Company Settings
- **Priority**: MUST
- **Description**: Company admins configure company-specific settings
- **Acceptance Criteria**:
  - Timezone configuration
  - Language preference
  - Anonymous reporting enabled/disabled toggle
  - Auto-event creation from reports toggle
  - Notification preferences
  - Settings changes logged to audit trail

#### FR-COMP-003: API Key Management
- **Priority**: MUST
- **Description**: Company admins manage API keys for mobile apps
- **Acceptance Criteria**:
  - View current API key (partially masked)
  - Regenerate API key with confirmation
  - Old key remains valid for configurable grace period (default 24 hours)
  - API key regeneration logged to audit trail

#### FR-COMP-004: Multi-Tenant Data Isolation
- **Priority**: MUST
- **Description**: Company data is completely isolated between tenants
- **Acceptance Criteria**:
  - All database queries filtered by companyId
  - API key restricts access to single company
  - No data leakage between companies (verified in integration tests)
  - Cross-company queries prevented at database and API layers

---

### 4.3 User Management

#### FR-USER-001: User CRUD Operations
- **Priority**: MUST
- **Description**: Admins manage users within their company
- **Acceptance Criteria**:
  - Create user with role assignment (equal or lower role only)
  - Edit user details (name, email, phone, role)
  - Soft delete (deactivate) users
  - Cannot delete self
  - Cannot delete or modify higher-role users
  - User changes logged to audit trail

#### FR-USER-002: User Profile Management
- **Priority**: MUST
- **Description**: Users view and edit their own profile
- **Acceptance Criteria**:
  - View personal information
  - Update name, email, phone (with re-verification)
  - Change password (requires current password)
  - Set notification preferences
  - Profile changes logged

#### FR-USER-003: First Responder Location Sharing
- **Priority**: MUST
- **Description**: First responders share live GPS location
- **Acceptance Criteria**:
  - Location updates sent every 30 seconds (configurable)
  - Location visible on operator dashboard map
  - Location stored with timestamp
  - Location sharing can be toggled on/off by responder
  - Privacy: location visible only within same company

---

### 4.4 Camera Management

#### FR-CAM-001: Camera CRUD Operations
- **Priority**: MUST
- **Description**: Admins manage camera configurations
- **Acceptance Criteria**:
  - Add camera: name, location (GPS), RTSP stream URL
  - Edit camera configuration
  - Soft delete camera (mark inactive, preserve history)
  - Bulk import cameras from CSV file
  - Camera changes logged to audit trail

#### FR-CAM-002: Camera Status Monitoring
- **Priority**: MUST
- **Description**: System monitors camera connectivity and health
- **Acceptance Criteria**:
  - Status values: online, offline, maintenance, error
  - Status updated via periodic health check (configurable interval)
  - Last online timestamp recorded
  - Status changes trigger notifications to operators
  - Dashboard displays real-time status indicator

#### FR-CAM-003: Live Video Streaming
- **Priority**: MUST
- **Description**: Operators view live video from cameras
- **Acceptance Criteria**:
  - RTSP streams converted to web-compatible format (HLS/WebRTC)
  - Video player with play, pause, stop controls
  - Multi-camera grid view (configurable layouts)
  - Snapshot capture from live stream
  - Stream quality adapts to network conditions

#### FR-CAM-004: Historical Video Playback
- **Priority**: MUST
- **Description**: Operators access recorded video through VMS integration
- **Acceptance Criteria**:
  - Playback video from specific timestamp
  - Time-align playback to report/event timestamps
  - Playback controls: play, pause, seek, speed adjustment
  - Export video clips for evidence (if VMS supports)
  - Multi-camera synchronized playback (SHOULD)

#### FR-CAM-005: VMS Integration
- **Priority**: MUST
- **Description**: System integrates with Video Management Systems for video storage
- **Acceptance Criteria**:
  - Support for direct RTSP/ONVIF camera connections (MVP)
  - Adapter pattern for VMS integration (architecture design)
  - Milestone integration (Phase 2)
  - Genetec integration (Phase 2)
  - VMS connection status monitoring

#### FR-CAM-006: AI Detection Configuration
- **Priority**: MUST
- **Description**: Admins configure AI detection per camera
- **Acceptance Criteria**:
  - Enable/disable AI detection toggle
  - Select detection types: person, vehicle (MVP)
  - Set confidence threshold (0-100%, default 70%)
  - Detection configuration per camera
  - Define regions of interest (COULD)

---

### 4.5 AI Detection Service

#### FR-AI-001: Object Detection
- **Priority**: MUST
- **Description**: AI service detects objects in video streams
- **Acceptance Criteria**:
  - Person detection with bounding box coordinates
  - Vehicle detection with bounding box coordinates
  - Confidence score (0.0-1.0) for each detection
  - Detection timestamp (ISO 8601 format)
  - Detection metadata: camera ID, frame number

#### FR-AI-002: Detection Report Submission
- **Priority**: MUST
- **Description**: AI service submits detections to backend as camera reports
- **Acceptance Criteria**:
  - POST to backend API with detection data
  - Include snapshot image (JPEG, base64 or multipart)
  - Include confidence score and object type
  - Retry on failure (3 attempts with exponential backoff)
  - Detection submission logged with correlation ID

#### FR-AI-003: Frame Processing Performance
- **Priority**: MUST
- **Description**: AI service processes frames efficiently
- **Acceptance Criteria**:
  - Process minimum 5 FPS per camera (CONFIGURABLE based on hardware)
  - Queue management for multiple cameras
  - Frame skipping during overload to maintain real-time processing
  - GPU acceleration when available
  - Processing performance metrics logged

#### FR-AI-004: Detection Filtering
- **Priority**: SHOULD
- **Description**: AI service filters duplicate and low-confidence detections
- **Acceptance Criteria**:
  - Debounce same object within 30 seconds (configurable)
  - Aggregate spatially close detections
  - Respect per-camera confidence threshold
  - Filtering logic transparent and logged

---

### 4.6 Report Management

#### FR-RPT-001: Citizen Report Submission
- **Priority**: MUST
- **Description**: Citizens submit incident reports via mobile app
- **Acceptance Criteria**:
  - Required fields: title, description, event type
  - Auto-capture GPS location (with permission)
  - Attach up to 5 images or videos (CONFIGURABLE)
  - Audio attachment support (COULD)
  - Optional priority selection
  - Anonymous submission (if company allows)
  - Report submitted with correlation ID for tracking

#### FR-RPT-002: Camera Report Auto-Creation
- **Priority**: MUST
- **Description**: AI detections automatically create camera reports
- **Acceptance Criteria**:
  - Auto-created on detection callback from AI service
  - Include snapshot image from video frame
  - Include confidence score and detection metadata
  - Link to source camera
  - Auto-link to existing nearby event OR create new event (if auto-create enabled)
  - Report creation logged with correlation ID

#### FR-RPT-003: First Responder Field Report
- **Priority**: MUST
- **Description**: Responders submit reports from the field
- **Acceptance Criteria**:
  - Submit report linked to assigned event
  - Attach photos, videos (from camera or library)
  - Include current GPS location automatically
  - Update linked event status
  - Field report creation logged

#### FR-RPT-004: Report Attachments
- **Priority**: MUST
- **Description**: Reports support multiple media attachments
- **Acceptance Criteria**:
  - Attachment types: image (JPEG, PNG), video (MP4), audio (MP3, AAC)
  - Max file size per attachment: configurable (default 10MB)
  - Attachments stored securely with access control
  - Thumbnails generated for images and videos
  - Attachment metadata tracked: timestamp, GPS, file hash

#### FR-RPT-005: Report Review Workflow
- **Priority**: SHOULD
- **Description**: Operators review and verify submitted reports
- **Acceptance Criteria**:
  - Report states: submitted → under_review → verified/rejected
  - Review notes captured with timestamp and reviewer
  - Rejected reports include rejection reason
  - Verified reports automatically linked to events
  - Review workflow logged to audit trail

---

### 4.7 Event Management

#### FR-EVT-001: Event Creation
- **Priority**: MUST
- **Description**: Events created from multiple sources
- **Acceptance Criteria**:
  - Auto-create from AI detection (if enabled in company settings)
  - Auto-create from citizen report (if enabled in company settings)
  - Manual creation by operators
  - Required fields: title, location, eventTypeId, companyId
  - Initial status: active
  - Event creation logged with correlation ID

#### FR-EVT-002: Event Lifecycle Management
- **Priority**: MUST
- **Description**: Events transition through defined lifecycle states
- **Acceptance Criteria**:
  - States: active → assigned → resolved → closed
  - State transitions: active→assigned (on responder assignment), assigned→resolved (responder marks complete), resolved→closed (operator confirmation)
  - State change logged with timestamp, user, and reason
  - Resolved state requires resolution notes (mandatory field)
  - Closed events become read-only (archived)
  - All state changes logged to audit trail

#### FR-EVT-003: Event-Report Aggregation
- **Priority**: MUST
- **Description**: Multiple reports linked to events for correlation
- **Acceptance Criteria**:
  - Auto-link reports within 500m and 15 minutes (CONFIGURABLE)
  - Manual link/unlink by operators
  - View all contributing reports on event detail page
  - Report count displayed on event list
  - Aggregation logic transparent and auditable

#### FR-EVT-004: Event Assignment
- **Priority**: MUST
- **Description**: Events assigned to first responders
- **Acceptance Criteria**:
  - Assign to specific first responder
  - Notification sent to assignee (real-time + mobile push if available)
  - Assignment visible on dashboard map
  - Reassignment supported with reason
  - Unassignment supported
  - Assignment history logged

#### FR-EVT-005: Event List and Filtering
- **Priority**: MUST
- **Description**: Users view and filter events
- **Acceptance Criteria**:
  - Paginated list (configurable page size, default 20)
  - Filter by: status, priority, event type, date range, assigned responder
  - Sort by: created date, priority, status (ascending/descending)
  - Search by: title, description (full-text search)
  - Filter/sort preferences saved per user

#### FR-EVT-006: Event Details View
- **Priority**: MUST
- **Description**: Users view complete event information
- **Acceptance Criteria**:
  - All event properties displayed
  - List of all linked reports (with thumbnails)
  - Timeline of status changes (audit trail)
  - Assigned responder information and status
  - Location on map with nearby cameras highlighted
  - Video playback access for linked cameras at event timestamp

#### FR-EVT-007: Event Audit Trail
- **Priority**: MUST
- **Description**: Complete audit trail for all event changes
- **Acceptance Criteria**:
  - Log all create, update, delete operations
  - Log all status transitions with user and timestamp
  - Log all report linking/unlinking
  - Log all assignments and reassignments
  - Audit trail immutable (append-only)
  - Correlation IDs link related operations

---

### 4.8 Map and Geospatial

#### FR-MAP-001: Interactive Map View
- **Priority**: MUST
- **Description**: Dashboard includes interactive map for situational awareness
- **Acceptance Criteria**:
  - Base map provider: OpenStreetMap or Mapbox
  - Zoom and pan controls
  - Full screen mode
  - Map type toggle: street, satellite (if provider supports)
  - Map state persists across sessions (zoom level, center)

#### FR-MAP-002: Camera Markers
- **Priority**: MUST
- **Description**: Cameras displayed as markers on map
- **Acceptance Criteria**:
  - Camera icon at GPS coordinates
  - Color indicates status: green (online), red (offline), yellow (maintenance), gray (error)
  - Click marker to view camera details popup
  - Click "View Live" to open video player
  - Marker clustering when zoomed out (>50 cameras visible)

#### FR-MAP-003: Event Markers
- **Priority**: MUST
- **Description**: Active events displayed on map
- **Acceptance Criteria**:
  - Event icon at GPS coordinates
  - Icon style indicates event type
  - Color indicates priority: red (critical), orange (high), yellow (medium), blue (low)
  - Click marker to view event details popup
  - Badge shows report count if >1
  - Only active and assigned events shown (not closed)

#### FR-MAP-004: First Responder Markers
- **Priority**: MUST
- **Description**: Active responders displayed on map with live location
- **Acceptance Criteria**:
  - Responder icon at current GPS location
  - Icon changes when assigned to event (filled vs outlined)
  - Click marker to view responder details
  - Location updates in real-time (via WebSocket)
  - Movement trail (breadcrumb) for last 30 minutes (COULD)

#### FR-MAP-005: Location Search
- **Priority**: SHOULD
- **Description**: Search for locations on map
- **Acceptance Criteria**:
  - Search by address or place name
  - Search by camera name
  - Search results displayed as list
  - Select result to center map and highlight marker
  - Search history saved per user session

---

### 4.9 Real-Time Updates

#### FR-RT-001: WebSocket Connection
- **Priority**: MUST
- **Description**: Dashboard maintains persistent connection for real-time updates
- **Acceptance Criteria**:
  - WebSocket connection established on login
  - Auto-reconnect on disconnect (exponential backoff)
  - Authentication via JWT token
  - Company-scoped room (tenant isolation)
  - Connection status indicator in UI

#### FR-RT-002: Event Notifications
- **Priority**: MUST
- **Description**: New and updated events broadcast in real-time
- **Acceptance Criteria**:
  - New event appears on dashboard within 2 seconds (CONFIGURABLE)
  - Event updates reflect immediately (status, assignment, reports)
  - High/critical priority events trigger visual alert (flash, color)
  - Toast notification for new events (dismissible)
  - Audio alert for critical events (configurable, user can disable)

#### FR-RT-003: Location Updates
- **Priority**: MUST
- **Description**: Responder locations update in real-time on map
- **Acceptance Criteria**:
  - Map markers update within 5 seconds of location change (CONFIGURABLE)
  - Smooth marker animation between positions
  - No full map re-render (performance optimization)
  - Batch updates if multiple responders move simultaneously

---

### 4.10 Event Type Management

#### FR-TYPE-001: Event Type Configuration
- **Priority**: MUST
- **Description**: Admins configure event type taxonomy
- **Acceptance Criteria**:
  - System default event types (cannot be deleted)
  - Company-specific custom types
  - Hierarchical categories: parent/child (COULD)
  - Each type: name, description, icon, color, default priority
  - Active/inactive toggle (preserve data for inactive types)
  - Event type changes logged

---

### 4.11 Dashboard and Analytics

#### FR-DASH-001: Overview Dashboard
- **Priority**: MUST
- **Description**: Main dashboard displays key operational metrics
- **Acceptance Criteria**:
  - Total active events count (real-time)
  - Events by priority breakdown (pie/donut chart)
  - Events by type breakdown (bar chart)
  - Camera status summary (online/offline counts)
  - Active responders count and availability
  - Refresh interval: 30 seconds or real-time via WebSocket

#### FR-DASH-002: Event List View
- **Priority**: MUST
- **Description**: Tabular view of events with actions
- **Acceptance Criteria**:
  - Sortable columns (click header to sort)
  - Pagination controls
  - Expandable rows for quick details
  - Quick actions: assign, change status, view details
  - Export to CSV (SHOULD)

#### FR-DASH-003: Camera Grid View
- **Priority**: MUST
- **Description**: Multi-camera video grid display
- **Acceptance Criteria**:
  - Grid layouts: 1x1, 2x2, 3x3, 4x4 (configurable)
  - Click camera to expand to full screen
  - Cycle through camera groups (if >grid size cameras)
  - Status indicator overlay on each video tile
  - Double-click to open camera detail page

#### FR-DASH-004: Basic Analytics
- **Priority**: SHOULD
- **Description**: Basic analytics charts and reports
- **Acceptance Criteria**:
  - Events over time (line chart, daily/weekly/monthly)
  - Events by type (pie chart)
  - Response time metrics (average, median, p95)
  - Report source breakdown (citizen, camera, responder)
  - Date range selector
  - Export charts as PNG/PDF (COULD)

---

### 4.12 Logging and Observability

#### FR-LOG-001: Structured Logging
- **Priority**: MUST
- **Description**: All services emit structured logs
- **Acceptance Criteria**:
  - Log format: JSON with consistent schema
  - Log levels: ERROR, WARN, INFO, DEBUG
  - Each log entry includes: timestamp, level, service, message, correlationId
  - No sensitive data in logs (passwords, tokens, PII)
  - Logs aggregated to centralized system (stdout for containerized deployment)

#### FR-LOG-002: Correlation IDs
- **Priority**: MUST
- **Description**: Requests tracked across services with correlation IDs
- **Acceptance Criteria**:
  - Correlation ID generated for each API request
  - Correlation ID propagated to all downstream calls
  - Correlation ID included in all log entries
  - Correlation ID returned in API response headers
  - Format: UUID v4

#### FR-LOG-003: Audit Trail
- **Priority**: MUST
- **Description**: User actions logged for compliance and investigation
- **Acceptance Criteria**:
  - Log all data modifications (create, update, delete)
  - Log all event lifecycle transitions
  - Log all authentication events (login, logout, failed attempts)
  - Log all permission-denied events
  - Audit logs stored separately from application logs
  - Audit logs immutable (append-only)
  - Retention period: configurable (minimum 90 days)

---

### 4.13 Testing and Quality Assurance

#### FR-TEST-001: Unit Test Coverage
- **Priority**: MUST
- **Description**: Code has comprehensive unit test coverage
- **Acceptance Criteria**:
  - Minimum 80% code coverage for backend services
  - Minimum 70% code coverage for frontend components
  - All business logic functions have unit tests
  - Tests run in CI/CD pipeline
  - Coverage reports generated and tracked

#### FR-TEST-002: Integration Testing
- **Priority**: MUST
- **Description**: Integration tests verify component interactions
- **Acceptance Criteria**:
  - API endpoint integration tests for all routes
  - Database integration tests with test fixtures
  - Real-time (WebSocket) integration tests
  - Multi-tenant isolation verified in integration tests
  - Tests run in CI/CD pipeline before deployment

#### FR-TEST-003: API Contract Testing
- **Priority**: MUST
- **Description**: API contracts documented and tested
- **Acceptance Criteria**:
  - OpenAPI/Swagger specification for all endpoints
  - Specification auto-generated from code or maintained in sync
  - Contract validation in integration tests
  - Breaking changes detected automatically
  - Mobile team can test against API specification

---

### 4.14 API Documentation

#### FR-DOC-001: OpenAPI Specification
- **Priority**: MUST
- **Description**: Complete API documentation via OpenAPI/Swagger
- **Acceptance Criteria**:
  - All endpoints documented with request/response schemas
  - Authentication methods documented
  - Error responses documented with examples
  - Swagger UI accessible at `/api/docs`
  - Specification file downloadable
  - Examples provided for complex requests

#### FR-DOC-002: API Versioning
- **Priority**: SHOULD
- **Description**: API versioned to support backward compatibility
- **Acceptance Criteria**:
  - Version in URL path: `/api/v1/...`
  - Version in header: `Accept: application/vnd.api+json; version=1`
  - Breaking changes require new version
  - Old versions deprecated with notice period (minimum 90 days)

---

## 5. Non-Functional Requirements

### 5.1 Performance

#### NFR-PERF-001: API Response Time
- **Priority**: MUST
- **Acceptance Criteria**:
  - p95 response time < 200ms for GET requests (CONFIGURABLE based on deployment)
  - p95 response time < 500ms for POST/PUT requests
  - p99 response time < 1 second for all requests
  - Performance tested under expected load

#### NFR-PERF-002: Real-Time Latency
- **Priority**: MUST
- **Acceptance Criteria**:
  - WebSocket message latency < 100ms (CONFIGURABLE)
  - Map marker updates < 5 seconds
  - New event notification < 2 seconds

#### NFR-PERF-003: Video Streaming
- **Priority**: MUST
- **Acceptance Criteria**:
  - Live stream latency < 3 seconds (CONFIGURABLE, depends on protocol)
  - Video playback start time < 2 seconds
  - Smooth playback without buffering under normal network conditions
  - Graceful degradation under poor network (lower quality, not freeze)

#### NFR-PERF-004: Database Query Performance
- **Priority**: MUST
- **Acceptance Criteria**:
  - p95 query time < 100ms
  - Indexes on frequently queried fields (companyId, status, timestamp)
  - No N+1 query problems
  - Query performance monitored and alerted

### 5.2 Scalability

#### NFR-SCALE-001: Concurrent Users
- **Priority**: MUST (MVP targets, Phase 2+ targets)
- **Acceptance Criteria**:
  - MVP: Support 100 concurrent users per deployment
  - Phase 2: Support 1,000 concurrent users
  - Phase 3: Support 10,000+ concurrent users
  - Horizontal scaling via load balancer

#### NFR-SCALE-002: Data Volume
- **Priority**: MUST
- **Acceptance Criteria**:
  - MVP: 25 cameras per company
  - MVP: 1,000 events per day per company
  - MVP: 10 companies per deployment
  - MVP: 50 GB storage
  - Database performance maintained as data grows

#### NFR-SCALE-003: Geographic Distribution
- **Priority**: WON'T (Phase 3)
- **Description**: Multi-region deployment for global scale
- **Acceptance Criteria**:
  - Regional deployments with data residency
  - Cross-region replication for disaster recovery
  - CDN for media assets

### 5.3 Availability

#### NFR-AVAIL-001: System Uptime
- **Priority**: MUST
- **Acceptance Criteria**:
  - Target: 99.9% uptime (< 9 hours downtime per year)
  - Planned maintenance windows: maximum 4 hours per month
  - Maintenance scheduled during low-usage periods
  - Users notified of maintenance 72 hours in advance

#### NFR-AVAIL-002: Disaster Recovery
- **Priority**: SHOULD
- **Acceptance Criteria**:
  - Recovery Time Objective (RTO): 4 hours (CONFIGURABLE)
  - Recovery Point Objective (RPO): 1 hour (CONFIGURABLE)
  - Daily automated backups
  - Backup restoration tested quarterly

#### NFR-AVAIL-003: Graceful Degradation
- **Priority**: SHOULD
- **Acceptance Criteria**:
  - Core features remain operational if non-critical services fail
  - Video unavailable: reports and events still functional
  - AI service down: manual event creation still works
  - Database read replica used for queries during primary maintenance

### 5.4 Security

#### NFR-SEC-001: Data Encryption
- **Priority**: MUST
- **Acceptance Criteria**:
  - Data in transit: TLS 1.2+ for all connections
  - Data at rest: AES-256 encryption for database
  - Sensitive fields (passwords) hashed with bcrypt (10+ rounds)
  - API keys and secrets stored in environment variables or secrets manager

#### NFR-SEC-002: Authentication Security
- **Priority**: MUST
- **Acceptance Criteria**:
  - JWT tokens signed with strong secret (minimum 256 bits)
  - Token expiration enforced
  - Refresh token rotation on use
  - Account lockout after 5 failed login attempts (configurable)
  - Lockout duration: 15 minutes (configurable)
  - CAPTCHA after 3 failed attempts (SHOULD)

#### NFR-SEC-003: Input Validation
- **Priority**: MUST
- **Acceptance Criteria**:
  - All user inputs validated on server side
  - Input sanitization to prevent XSS
  - Parameterized queries to prevent NoSQL injection
  - File upload validation: type, size, content inspection
  - Rate limiting on all public endpoints

#### NFR-SEC-004: Security Headers
- **Priority**: MUST
- **Acceptance Criteria**:
  - Content Security Policy (CSP) header
  - X-Frame-Options: DENY or SAMEORIGIN
  - X-Content-Type-Options: nosniff
  - Strict-Transport-Security (HSTS)
  - CORS configured with allowed origins (not wildcard in production)

#### NFR-SEC-005: Audit and Compliance
- **Priority**: MUST (audit), SHOULD (compliance frameworks)
- **Acceptance Criteria**:
  - Complete audit trail for all data access and modifications
  - Audit logs tamper-proof (append-only, checksummed)
  - Support for GDPR data export and deletion (Phase 2)
  - Support for SOC2 compliance requirements (Phase 3)

### 5.5 Usability

#### NFR-USAB-001: Browser Compatibility
- **Priority**: MUST
- **Acceptance Criteria**:
  - Chrome 90+ (desktop and mobile)
  - Firefox 88+ (desktop and mobile)
  - Safari 14+ (desktop and mobile)
  - Edge 90+ (desktop)
  - No support for Internet Explorer

#### NFR-USAB-002: Mobile Platform Compatibility
- **Priority**: MUST
- **Acceptance Criteria**:
  - iOS 14+ (iPhone and iPad)
  - Android 10+ (phones and tablets)
  - React Native version compatible with both platforms
  - Touch-optimized UI elements

#### NFR-USAB-003: Responsive Design
- **Priority**: MUST
- **Acceptance Criteria**:
  - Web dashboard responsive: 1024px - 2560px (desktop)
  - Mobile app adapts to screen sizes: 360px - 768px
  - Map and video players responsive
  - No horizontal scrolling on supported screen sizes

#### NFR-USAB-004: Accessibility
- **Priority**: SHOULD
- **Acceptance Criteria**:
  - WCAG 2.1 Level AA compliance (minimum)
  - Keyboard navigation support
  - Screen reader compatibility
  - Sufficient color contrast ratios
  - Alt text for images

#### NFR-USAB-005: Internationalization
- **Priority**: WON'T (Phase 2)
- **Description**: Multi-language support
- **Acceptance Criteria**:
  - English as default MVP language
  - i18n framework integrated for future languages
  - Locale-aware date/time formatting
  - Right-to-left (RTL) support for Arabic, Hebrew (Phase 2)

### 5.6 Maintainability

#### NFR-MAINT-001: Code Quality
- **Priority**: MUST
- **Acceptance Criteria**:
  - Linting configured and enforced (ESLint for JS/TS, Pylint for Python)
  - Code formatting standardized (Prettier for JS/TS, Black for Python)
  - No critical or high-severity linting errors in production code
  - Code review required for all changes

#### NFR-MAINT-002: Documentation
- **Priority**: MUST
- **Acceptance Criteria**:
  - README with setup instructions in each repository
  - Architecture documentation maintained
  - API documentation (OpenAPI/Swagger)
  - Inline code comments for complex logic
  - Deployment runbook

#### NFR-MAINT-003: Monitoring and Alerting
- **Priority**: SHOULD
- **Acceptance Criteria**:
  - Application metrics exposed (response times, error rates)
  - Infrastructure metrics collected (CPU, memory, disk)
  - Alerts configured for critical errors
  - Dashboard for real-time system health
  - Log aggregation and search (ELK stack or similar)

---

## 6. Data Requirements

### 6.1 Data Models

**Note**: Detailed schemas defined in System Architecture document. Requirements specify mandatory fields and relationships.

#### DR-001: Company
- **Priority**: MUST
- **Required Fields**: name (unique), apiKey (unique), subscription plan, settings, isActive
- **Relationships**: has many Users, Cameras, Events, Reports

#### DR-002: User
- **Priority**: MUST
- **Required Fields**: companyId, email OR phone, username (unique per company), password (hashed), role, isActive
- **Optional Fields**: location (for first_responders), deviceTokens (for push notifications)
- **Relationships**: belongs to Company

#### DR-003: Camera
- **Priority**: MUST
- **Required Fields**: companyId, name, location (GPS coordinates), streamUrl, status
- **Optional Fields**: snapshotUrl, aiConfig, installationDate
- **Relationships**: belongs to Company, has many Reports (camera-sourced)

#### DR-004: Event
- **Priority**: MUST
- **Required Fields**: companyId, eventTypeId, title, location (GPS), status, priority, createdAt
- **Optional Fields**: assignedTo (userId), resolvedAt, resolvedBy, resolutionNotes
- **Relationships**: belongs to Company, has many Reports, belongs to EventType, assigned to User

#### DR-005: Report
- **Priority**: MUST
- **Required Fields**: companyId, eventId (nullable initially), reportType (citizen/camera/responder), location (GPS), createdAt
- **Optional Fields**: userId (null if anonymous), cameraId (if camera report), title, description, attachments array, confidence (if camera report)
- **Relationships**: belongs to Company, belongs to Event (nullable), belongs to User (nullable), belongs to Camera (nullable)

#### DR-006: EventType
- **Priority**: MUST
- **Required Fields**: companyId (null for system defaults), name, icon, color, defaultPriority, isActive
- **Relationships**: has many Events

### 6.2 Data Retention

#### DR-RET-001: Active Data
- **Priority**: MUST
- **Acceptance Criteria**:
  - Active events retained indefinitely (until manually archived)
  - Closed events retained for minimum 90 days (configurable per company)

#### DR-RET-002: Archived Data
- **Priority**: SHOULD
- **Acceptance Criteria**:
  - Archived events moved to separate collection/table
  - Archived data retained for configurable period (default 7 years for compliance)
  - Archived data accessible via separate query interface (slower)

#### DR-RET-003: Media Attachments
- **Priority**: MUST
- **Acceptance Criteria**:
  - Images/videos retained with associated reports
  - Cleanup job deletes attachments when parent report deleted
  - Orphaned attachments cleaned up monthly

#### DR-RET-004: Audit Logs
- **Priority**: MUST
- **Acceptance Criteria**:
  - Audit logs retained for minimum 90 days (configurable)
  - Critical audit events (auth, permission denials) retained longer (configurable, default 1 year)

### 6.3 Data Privacy

#### DR-PRIV-001: Anonymization
- **Priority**: MUST
- **Acceptance Criteria**:
  - Anonymous reports do not store user identification
  - Personal data excluded from logs
  - IP addresses not stored (or anonymized)

#### DR-PRIV-002: Data Export
- **Priority**: SHOULD (Phase 2)
- **Description**: Users can export their data (GDPR compliance)
- **Acceptance Criteria**:
  - User-initiated data export in machine-readable format (JSON)
  - Export includes all user-generated content
  - Export delivered within 30 days

#### DR-PRIV-003: Data Deletion
- **Priority**: SHOULD (Phase 2)
- **Description**: Users can request data deletion (GDPR "right to be forgotten")
- **Acceptance Criteria**:
  - Soft delete preserves referential integrity
  - Personal data anonymized or removed
  - Deletion logged to audit trail

---

## 7. Integration Requirements

### 7.1 Map Provider Integration

#### INT-MAP-001: Base Map Service
- **Priority**: MUST
- **Acceptance Criteria**:
  - Integration with OpenStreetMap (Leaflet.js) OR Mapbox
  - Tile caching for performance
  - Fallback to alternate provider if primary unavailable (SHOULD)

#### INT-MAP-002: Geocoding Service
- **Priority**: SHOULD
- **Acceptance Criteria**:
  - Reverse geocoding: GPS → address
  - Forward geocoding: address → GPS
  - Used for location search and display

### 7.2 Video Streaming Integration

#### INT-VID-001: RTSP Support
- **Priority**: MUST
- **Acceptance Criteria**:
  - Direct RTSP connection to IP cameras
  - RTSP to HLS transcoding for web browsers
  - ONVIF protocol support for camera discovery and PTZ (COULD)

#### INT-VID-002: VMS Integration
- **Priority**: MUST (architecture), SHOULD (specific VMS implementations)
- **Acceptance Criteria**:
  - Adapter pattern for pluggable VMS integrations
  - Milestone XProtect integration (Phase 2)
  - Genetec Security Center integration (Phase 2)
  - VMS API calls logged with correlation IDs

### 7.3 Notification Services

#### INT-NOTIF-001: Push Notifications
- **Priority**: SHOULD (Phase 2)
- **Acceptance Criteria**:
  - Firebase Cloud Messaging (FCM) for Android
  - Apple Push Notification Service (APNS) for iOS
  - Web Push for browser notifications
  - Push token management per user device

#### INT-NOTIF-002: SMS Gateway
- **Priority**: WON'T (Phase 2)
- **Description**: SMS notifications for critical alerts
- **Acceptance Criteria**:
  - Integration with Twilio or AWS SNS
  - SMS sent for high/critical priority events (configurable)

#### INT-NOTIF-003: Email Service
- **Priority**: WON'T (Phase 2)
- **Description**: Email notifications and alerts
- **Acceptance Criteria**:
  - SMTP or email service API (SendGrid, AWS SES)
  - Email templates for common notifications
  - Unsubscribe mechanism

### 7.4 Cloud Storage Integration

#### INT-STOR-001: Media Storage
- **Priority**: MUST
- **Acceptance Criteria**:
  - Local filesystem storage (MVP)
  - S3-compatible storage (AWS S3, MinIO) (Phase 2)
  - Automatic cleanup of expired attachments
  - Secure signed URLs for media access

---

## Appendix A: Default Event Types

| Name | Icon | Color | Default Priority |
|------|------|-------|------------------|
| Suspicious Activity | ⚠️ | #FFA500 | high |
| Person Detected | 👤 | #4CAF50 | low |
| Vehicle Detected | 🚗 | #2196F3 | low |
| Intrusion | 🚨 | #F44336 | critical |
| Fire/Smoke | 🔥 | #FF5722 | critical |
| Medical Emergency | 🏥 | #E91E63 | critical |
| Traffic Incident | 🚦 | #9C27B0 | medium |
| Vandalism | 💥 | #FF9800 | high |
| Theft | 💰 | #F44336 | high |
| Other | ❓ | #607D8B | medium |

---

## Appendix B: API Key Format

```
Format: emp_{company_id_short}_{random_32_chars}
Example: emp_abc123_k7j9m2n4p6q8r0t1v3x5z7b9d1f3h5j7
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-12 | AI-Assisted | Initial requirements specification |
| 2.0 | 2026-01-12 | AI-Assisted | Refactored: added logging/testing/API doc requirements, clarified video/VMS requirements, separated architecture details |

---

*This document specifies complete, testable requirements for the Event Monitoring and Management Platform. Implementation must satisfy all MUST requirements for MVP release. Requirements are frozen but may be amended through formal change control process.*
