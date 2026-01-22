# Event Monitoring and Management Platform

## Work Breakdown Structure (WBS)

**Version:** 1.0  
**Date:** January 12, 2026  
**Status:** Active Planning Document

---

## Non-Negotiables (Extracted from Frozen Foundation Docs)

These constraints MUST be honored in every slice. Violation = drift.

### Terminology (DO NOT CHANGE)
- **Report**: Atomic input from any source (citizen, camera, responder) with optional attachments
- **Event**: Aggregated incident linking multiple reports, tracked through lifecycle
- **Camera**: Video source registered in the system
- **VMS**: Video Management System for video storage/playback

### Architecture Constraints
- [ ] Multi-tenant isolation by `companyId` on ALL database queries
- [ ] CorrelationId on ALL requests (generated in middleware, propagated everywhere)
- [ ] Structured JSON logging (never plain text)
- [ ] Audit trail for all data mutations
- [ ] JWT + API Key authentication (JWT for web, API Key for mobile)
- [ ] RBAC enforced at API layer

### Technology Stack (FROZEN - Assignment Requirement)
- Backend: Node.js 18 LTS + TypeScript + Express
- Database: MongoDB 5.0+
- Frontend: React 18+ + TypeScript
- Mobile: API-only (external team builds mobile apps)
- AI Service: Python 3.9+ + FastAPI

### API Conventions
- RESTful endpoints: `/api/{resource}`
- Standard response envelope: `{ success, data?, error?, correlationId }`
- OpenAPI/Swagger documentation at `/api/docs`
- Versioning via URL path when needed: `/api/v1/...`

### Testing Requirements
- Unit tests: Jest (backend), Jest + RTL (frontend)
- Integration tests: Supertest
- Contract tests: OpenAPI validation
- Minimum coverage target: 70% (CONFIGURABLE DEFAULT)

### Video Requirements
- Live streaming: RTSP → HLS transcoding
- Historical playback: VMS adapter pattern
- Time-aligned to events: playback at event timestamp

---

## Slices Overview

| Slice | Name | Goal | Est. Duration |
|-------|------|------|---------------|
| 0 | Foundation | Project scaffolding, dev environment, CI basics | 1-2 days |
| 1 | Auth Core | Registration, login, JWT, password reset | 2-3 days |
| 2 | Company & User CRUD | Multi-tenant setup, user management, RBAC | 2-3 days |
| 3 | Report Submission | Citizen reports with attachments, storage | 2-3 days |
| 4 | Event Management | Event CRUD, lifecycle, report linking | 2-3 days |
| 5 | Real-Time Foundation | WebSocket server, company rooms, broadcasts | 1-2 days |
| 6 | Map & Dashboard UI | React map integration, event markers, list views | 2-3 days |
| 7 | Mobile API Integration | API endpoints for external mobile team | 2-3 days |
| 8 | Mobile Testing & Docs | Mobile team support, documentation | 1-2 days |
| **9.0** | **VMS Integration (Boaz's Work)** | **Port Shinobi VMS, camera-VMS mapping, HLS streaming** | **3-4 days** |
| 9 | Camera Management Enhancements | Status monitoring, geospatial, bulk ops | 1-2 days |
| 10 | Direct RTSP Adapter | FFmpeg transcoding for non-VMS cameras | 2-3 days |
| 11 | Additional VMS Adapters | Milestone/Genetec stubs, adapter factory | 1-2 days |
| 12 | Historical Playback | Time-aligned video, multi-camera sync | 2-3 days |
| 13 | AI Service Integration | Detection callback, camera report creation | 2-3 days |
| 14 | Polish & Hardening | Error handling, edge cases, performance | 2-3 days |

**Total Estimated Duration**: 29-42 days (includes 3-4 days saved by leveraging Boaz's VMS work)

---

## Slice 0: Foundation

### Goal
Set up project scaffolding with dev environment, testing infrastructure, logging, and OpenAPI documentation. No business logic yet.

### No Scope Creep
- ❌ Do NOT implement authentication logic (only middleware placeholders)
- ❌ Do NOT implement any business entities (Reports, Events, Cameras)
- ❌ Do NOT implement real database models (only connection)
- ❌ Do NOT implement frontend pages beyond stubs

### Backend Tasks
- [x] Initialize Node.js + TypeScript project
- [x] Configure ESLint + Prettier
- [x] Set up folder structure per architecture doc
- [x] Create Express server with middleware chain
- [x] Implement correlationId middleware
- [x] Implement structured JSON logger
- [x] Implement global error handler with standard envelope
- [x] Create RBAC middleware placeholder (no real logic)
- [x] Create health endpoint (`GET /api/health`)
- [x] Set up OpenAPI/Swagger at `/api/docs`
- [x] Create MongoDB connection module (env-driven)
- [x] Set up Jest + Supertest
- [x] Write sample integration test (health endpoint)
- [x] Create Docker Compose (backend + MongoDB)
- [x] Create npm scripts for dev/test/build

### Frontend Tasks
- [x] Initialize React + TypeScript project (Vite)
- [x] Set up folder structure
- [x] Configure ESLint + Prettier
- [x] Create minimal app shell with routing
- [x] Create Login page stub
- [x] Create Dashboard/Map page stub
- [x] Create API client skeleton
- [x] Set up testing structure (optional: 1 sample test)

### AI Service Tasks
- [x] Create Python project structure 
- [x] Set up FastAPI skeleton
- [x] Create health endpoint
- [x] Create placeholder detection callback endpoint
- [x] Create Dockerfile
- [x] Add to Docker Compose

### Documentation Tasks
- [x] Create 00-WORKPLAN.md (this file)
- [x] Create 01-API_CONVENTIONS.md
- [x] Create 02-TESTING_STRATEGY.md
- [x] Create 03-LOGGING_OBSERVABILITY.md

### Definition of Done (Slice 0)
- [ ] `docker-compose up` starts backend + MongoDB + AI service
- [ ] `GET /api/health` returns `{ success: true, data: { status: "ok" } }`
- [ ] `GET /api/docs` shows Swagger UI
- [ ] All requests have correlationId in response headers
- [ ] Logs are structured JSON with correlationId
- [ ] `npm test` passes (health endpoint test)
- [ ] ESLint + Prettier pass with no errors
- [ ] Frontend `npm run dev` shows login stub page

### Dependencies
- None (this is the foundation)

---

## Slice 1: Auth Core

### Goal
Implement user authentication: registration, login, JWT tokens, password reset, API key validation.

### No Scope Creep
- ❌ Do NOT implement user profile management
- ❌ Do NOT implement admin user creation (only self-registration)
- ❌ Do NOT implement OAuth/social login
- ❌ Do NOT implement session management beyond JWT

### Backend Tasks
- [x] Create User model (Mongoose schema)
- [x] Implement password hashing (bcrypt)
- [x] Implement `POST /api/auth/register`
- [x] Implement `POST /api/auth/login` (returns JWT)
- [x] Implement `POST /api/auth/refresh` (refresh token)
- [x] Implement `POST /api/auth/forgot-password`
- [x] Implement `POST /api/auth/reset-password`
- [x] Implement JWT validation middleware
- [x] Implement API key validation middleware
- [x] Add auth endpoints to OpenAPI spec
- [x] Implement account lockout after 5 failed attempts (CONFIGURABLE DEFAULT)

### Frontend Tasks
- [x] Create login form with validation
- [x] Create registration form
- [ ] Create forgot password form
- [ ] Implement auth context/store
- [ ] Implement protected route wrapper
- [x] Store JWT in secure storage

### API/Swagger Tasks
- [x] Document all auth endpoints in OpenAPI
- [x] Add security schemes (Bearer JWT, API Key)
- [x] Add request/response examples

### Tests
- [x] Unit: password hashing
- [x] Unit: JWT generation/validation
- [x] Integration: registration flow
- [x] Integration: login flow
- [x] Integration: invalid credentials (401)
- [x] Integration: account lockout

### Definition of Done (Slice 1)
- [x] User can register with email/password
- [x] User can login and receive JWT
- [x] Protected endpoints reject requests without valid JWT
- [x] API key authentication works for mobile endpoints
- [x] All auth endpoints documented in Swagger
- [x] All tests pass
- [x] Audit log entries created for auth events

### Dependencies
- Slice 0 (Foundation)

---

## Slice 2: Company & User CRUD

### Goal
Implement multi-tenant company management and user CRUD with role-based access control.

### No Scope Creep
- ❌ Do NOT implement billing/subscriptions
- ❌ Do NOT implement company settings beyond basics
- ❌ Do NOT implement user location tracking yet

### Backend Tasks
- [x] Create Company model (Mongoose schema)
- [x] Implement `POST /api/companies` (super_admin only)
- [x] Implement `GET /api/companies/:id`
- [x] Implement `PATCH /api/companies/:id/settings`
- [x] Implement `POST /api/companies/:id/regenerate-api-key`
- [x] Implement `GET /api/users` (company-scoped)
- [x] Implement `POST /api/users` (admin creates users)
- [x] Implement `GET /api/users/:id`
- [x] Implement `PATCH /api/users/:id`
- [x] Implement `DELETE /api/users/:id` (soft delete)
- [x] Implement RBAC middleware with role checks
- [x] Add companyId filter to all queries (tenant isolation)

### Frontend Tasks
- [x] Create admin user list page
- [x] Create user create/edit form
- [x] Create company settings page (admin only)
- [x] Implement role-based UI visibility

### API/Swagger Tasks
- [x] Document all company endpoints
- [x] Document all user endpoints
- [x] Add role requirements to endpoint docs

### Tests
- [x] Unit: RBAC permission checks
- [x] Integration: company creation
- [x] Integration: user CRUD
- [x] Integration: tenant isolation (cannot access other company's data)
- [x] Integration: role hierarchy enforcement

### Definition of Done (Slice 2)
- [x] Super admin can create companies
- [x] Company admin can manage users
- [x] Users cannot see other companies' data
- [x] Role hierarchy enforced (cannot create higher role)
- [x] All endpoints documented in Swagger
- [x] Tenant isolation tested

### Dependencies
- Slice 1 (Auth Core)

---

## Slice 3: Report Submission

### Goal
Implement citizen report submission with attachments and verification workflow.

### No Scope Creep
- ❌ Do NOT implement camera reports (AI detection)
- ❌ Do NOT implement responder reports
- ❌ Do NOT implement event auto-creation yet
- ❌ Do NOT implement anonymous reports yet

### Backend Tasks
- [x] Create Report model (Mongoose schema)
- [x] Create Attachment subdocument schema
- [x] Implement file upload middleware (multer)
- [x] Implement `POST /api/reports` (citizen report)
- [x] Implement `GET /api/reports` (company-scoped, paginated)
- [x] Implement `GET /api/reports/:id`
- [x] Implement `POST /api/reports/:id/attachments`
- [x] Implement `PATCH /api/reports/:id/verify` (operator)
- [x] Implement `PATCH /api/reports/:id/reject` (operator)
- [x] Store attachments (local storage MVP, S3 later)
- [x] Generate thumbnails for images

### Frontend Tasks
- [x] Create report submission form
- [x] Implement file upload with preview
- [x] Create report list view (operator)
- [x] Create report detail view
- [x] Implement verification UI for operators

### API/Swagger Tasks
- [x] Document report endpoints
- [x] Document file upload (multipart/form-data)
- [x] Add attachment URL patterns

### Tests
- [x] Unit: attachment validation
- [x] Integration: report submission
- [x] Integration: file upload
- [x] Integration: verification workflow
- [x] Integration: tenant isolation

### Definition of Done (Slice 3)
- [x] Citizen can submit report with title, description, location, type
- [x] Citizen can attach images/videos
- [x] Operator can view all reports
- [x] Operator can verify/reject reports
- [x] Attachments stored and retrievable
- [x] All tests pass

### Dependencies
- Slice 2 (Company & User CRUD)

---

## Slice 4: Event Management

### Goal
Implement event CRUD, lifecycle management, and report-event linking.

### No Scope Creep
- ❌ Do NOT implement event assignment yet
- ❌ Do NOT implement real-time updates yet
- ❌ Do NOT implement geo-spatial auto-linking yet

### Backend Tasks
- [x] Create Event model (Mongoose schema)
- [x] Create EventType model (with system defaults)
- [x] Implement `POST /api/events` (manual creation)
- [x] Implement `GET /api/events` (company-scoped, paginated)
- [x] Implement `GET /api/events/:id`
- [x] Implement `PATCH /api/events/:id` (update)
- [x] Implement `PATCH /api/events/:id/status` (lifecycle)
- [x] Implement `POST /api/events/:id/reports` (link report)
- [x] Implement `DELETE /api/events/:id/reports/:reportId` (unlink)
- [x] Implement `GET /api/event-types`
- [x] Implement `POST /api/event-types` (company-specific)
- [x] Create audit trail entries for all event changes
- [x] Implement state machine for event lifecycle

### Frontend Tasks
- [ ] Create event list view with filters
- [ ] Create event detail view
- [ ] Create event creation form
- [ ] Implement status transition UI
- [ ] Show linked reports in event detail
- [ ] Implement report linking UI

### API/Swagger Tasks
- [ ] Document all event endpoints
- [ ] Document event-type endpoints
- [ ] Add lifecycle state machine documentation

### Tests
- [x] Unit: lifecycle state transitions
- [x] Integration: event CRUD
- [x] Integration: report linking
- [x] Integration: invalid state transitions (400)
- [x] Integration: audit trail creation

### Definition of Done (Slice 4)
- [x] Operator can create events manually
- [x] Operator can update event status through lifecycle
- [x] Reports can be linked/unlinked to events
- [x] Audit trail captures all changes
- [x] Invalid state transitions rejected
- [x] All tests pass

### Dependencies
- Slice 3 (Report Submission)

---

## Slice 5: Real-Time Foundation

### Goal
Implement WebSocket server with company rooms for real-time broadcasts.

### No Scope Creep
- ❌ Do NOT implement location tracking broadcasts yet
- ❌ Do NOT implement push notifications
- ❌ Do NOT implement offline queue

### Backend Tasks
- [ ] Set up Socket.io server
- [ ] Implement JWT authentication for WebSocket
- [ ] Implement company room management
- [ ] Emit `event:created` on new event
- [ ] Emit `event:updated` on event change
- [ ] Emit `report:created` on new report
- [ ] Implement connection tracking (per company)
- [ ] Add WebSocket to Docker Compose

### Frontend Tasks
- [ ] Create WebSocket client service
- [ ] Implement auto-reconnection
- [ ] Subscribe to company room on login
- [ ] Update event list on `event:created`
- [ ] Update event detail on `event:updated`
- [ ] Show notification toast on new events

### API/Swagger Tasks
- [ ] Document WebSocket events in separate doc
- [ ] Add connection protocol documentation

### Tests
- [ ] Integration: WebSocket connection with JWT
- [ ] Integration: company room isolation
- [ ] Integration: event broadcast received

### Definition of Done (Slice 5)
- [ ] WebSocket connects with JWT auth
- [ ] Clients join company-specific room
- [ ] Event changes broadcast to company room
- [ ] Frontend receives and displays updates
- [ ] No cross-company leakage

### Dependencies
- Slice 4 (Event Management)

---

## Slice 6: Map & Dashboard UI

### Goal
Implement interactive map with event markers and operator dashboard.

### No Scope Creep
- ❌ Do NOT implement camera markers yet
- ❌ Do NOT implement responder location yet
- ❌ Do NOT implement advanced filtering

### Frontend Tasks
- [ ] Integrate Leaflet.js or Mapbox
- [ ] Display event markers on map
- [ ] Implement marker clustering
- [ ] Create event popup on marker click
- [ ] Implement map ↔ list synchronization
- [ ] Create operator dashboard layout
- [ ] Add event list sidebar
- [ ] Add quick filters (status, priority)
- [ ] Implement event count badges

### Backend Tasks
- [ ] Implement `GET /api/events/geo` (bounding box query)
- [ ] Add geo-spatial index to Event model

### Tests
- [ ] Frontend: map renders with markers
- [ ] Integration: geo-spatial query returns events

### Definition of Done (Slice 6)
- [ ] Map displays event markers
- [ ] Clicking marker shows event details
- [ ] Event list syncs with map view
- [ ] Dashboard layout is functional
- [ ] Real-time updates appear on map

### Dependencies
- Slice 5 (Real-Time Foundation)

---

## Slice 7: Mobile API Integration

### Goal
Implement mobile-specific API endpoints and API key management for external mobile development team.

### No Scope Creep
- ❌ Do NOT build any mobile apps (React Native or otherwise)
- ❌ Do NOT implement push notifications (mobile team responsibility)
- ❌ Do NOT implement offline sync
- ❌ Do NOT implement mobile SDK

### Backend Tasks
- [ ] Add `mobile_partner` company type to Company model
- [ ] Implement API key scoping (restrict endpoints per key)
- [ ] Create rate limiting for mobile endpoints
- [ ] Implement `POST /api/mobile/auth/login` (API key + user credentials)
- [ ] Implement `POST /api/mobile/auth/refresh`
- [ ] Implement `GET /api/mobile/reports` (citizen's own reports)
- [ ] Implement `POST /api/mobile/reports` (citizen submission)
- [ ] Implement `POST /api/mobile/reports/:id/attachments`
- [ ] Implement `GET /api/mobile/events/assignments` (responder view)
- [ ] Implement `PATCH /api/mobile/events/:id/status` (responder update)
- [ ] Implement `POST /api/mobile/users/location` (responder location)
- [ ] Add mobile-specific validation rules
- [ ] Emit `responder:location` WebSocket event

### API/Swagger Tasks
- [ ] Create separate OpenAPI spec for mobile APIs
- [ ] Document mobile authentication flow
- [ ] Add mobile endpoint examples
- [ ] Document file upload for mobile (multipart)
- [ ] Create Postman collection for mobile team

### Tests
- [ ] Integration: mobile auth flow (API key + credentials)
- [ ] Integration: API key scope validation
- [ ] Integration: mobile report submission
- [ ] Integration: mobile assignment workflow
- [ ] Integration: rate limiting enforcement
- [ ] Integration: responder location update

### Definition of Done (Slice 7)
- [ ] Mobile team can authenticate with API key + credentials
- [ ] Citizens can submit reports via mobile API
- [ ] Responders can get assignments via mobile API
- [ ] Responders can update event status via mobile API
- [ ] Responder locations broadcast to operators
- [ ] Rate limiting prevents API abuse
- [ ] All mobile endpoints documented in Swagger

### Dependencies
- Slice 6 (Map & Dashboard UI)

---

## Slice 8: Mobile Testing & Documentation

### Goal
Create comprehensive testing tools and documentation for mobile development team.

### No Scope Creep
- ❌ Do NOT build mobile SDK or client libraries
- ❌ Do NOT implement mobile-specific business logic beyond API
- ❌ Do NOT provide mobile UI components

### Backend Tasks
- [ ] Create mobile API testing dashboard (optional admin page)
- [ ] Implement API usage analytics/logging per API key
- [ ] Create webhook test endpoints for mobile team
- [ ] Add API versioning headers (X-API-Version)
- [ ] Implement deprecation warning headers

### Documentation Tasks
- [ ] Create Mobile Integration Guide (Markdown)
- [ ] Document all mobile API endpoints with examples
- [ ] Create mobile authentication guide
- [ ] Document all error codes and handling
- [ ] Create mobile API changelog template
- [ ] Document rate limits and quotas
- [ ] Create mobile team onboarding checklist

### Testing Tasks
- [ ] Create automated mobile API contract tests
- [ ] Create mobile API load tests (k6 or similar)
- [ ] Test mobile API backward compatibility
- [ ] Validate Postman collection works end-to-end

### Definition of Done (Slice 8)
- [ ] Mobile team has complete API documentation
- [ ] Mobile APIs have contract tests
- [ ] Mobile team can test endpoints independently
- [ ] API versioning strategy documented
- [ ] Mobile integration guide complete
- [ ] Postman collection validated

### Dependencies
- Slice 7 (Mobile API Integration)

---

## Slice 9.0: VMS Integration Foundation (Boaz's Work)

### Goal
Port Boaz's Shinobi VMS integration from the old project as the MVP camera solution. This provides VMS server management, camera-to-VMS mapping, and live video streaming via HLS.

### Source
This slice ports tested code from `camera-connection-complete.patch` which includes:
- VMS server CRUD with Shinobi authentication
- Camera ↔ VMS connection management
- Stream URL generation (HLS, embed, snapshot)
- Live video player with hls.js
- Connection testing for cameras
- Shinobi Docker setup for testing

### No Scope Creep
- ❌ Do NOT implement DirectRTSP adapter yet (Slice 10)
- ❌ Do NOT implement Milestone/Genetec adapters yet (Slice 11)
- ❌ Do NOT implement historical playback yet (Slice 12)
- ❌ Do NOT implement AI detection integration (Slice 13)

### Backend Tasks - Models
- [x] Port `VmsServer` model from patch
  - [x] Add `companyId` field for multi-tenant isolation
  - [x] Keep provider enum: ['shinobi', 'zoneminder', 'agentdvr', 'other']
  - [x] Keep auth fields (apiKey, groupKey, username, password)
  - [x] Add security transforms to hide auth in JSON responses
- [x] Port Camera model VMS extensions from patch
  - [x] Add `vms` subdocument: `{ serverId, monitorId }`
  - [x] Add `metadata.source` field for demo tracking
  - [x] Keep existing Camera fields from your architecture

### Backend Tasks - VMS Controller & Routes
*Note: controller logic implemented via existing service/route layer (no standalone vmsController.ts file).*
- [ ] Port `vmsController.ts` from patch
  - [x] Add `companyId` filtering to ALL queries (critical for multi-tenant)
  - [x] Port `POST /api/vms/servers` (create VMS server)
  - [x] Port `GET /api/vms/servers` (list, company-scoped)
  - [x] Port `GET /api/vms/servers/:id` (get single)
  - [x] Port `PATCH /api/vms/servers/:id` (update)
  - [x] Port `DELETE /api/vms/servers/:id` (delete)
  - [x] Port `GET /api/vms/servers/:id/monitors` (Shinobi monitor discovery)
  - [x] Port `POST /api/vms/servers/:id/monitors/import` (batch import)
  - [x] Add audit log entries for VMS operations
  - [x] Add correlationId logging
  - [x] Add OpenAPI/Swagger annotations
- [x] Port `vms.ts` routes from patch
  - [x] Mount at `/api/vms`
  - [x] Add auth middleware to all routes

### Backend Tasks - Camera Extensions
- [x] Port camera-VMS endpoints from patch
  - [x] `POST /api/cameras/:id/vms/connect` (link camera to VMS)
  - [x] `POST /api/cameras/:id/vms/disconnect` (unlink camera)
  - [x] `GET /api/cameras/:id/vms/streams` (get HLS/embed/snapshot URLs)
  - [x] `POST /api/cameras/test-connection` (RTSP and VMS connectivity test)
  - [x] `DELETE /api/cameras/source/:source` (demo cleanup)
- [x] Adapt to use your standard response envelope
- [x] Add tenant isolation checks
  - [x] Add audit logging

### Backend Tasks - Shinobi Adapter
- [x] Port Shinobi stream URL generation logic
  - [x] `liveHlsUrl`: `{baseUrl}/{apiKey}/hls/{groupKey}/{monitorId}/s.m3u8`
  - [x] `liveEmbedUrl`: `{baseUrl}/{apiKey}/embed/{groupKey}/{monitorId}`
  - [x] `snapshotUrl`: `{baseUrl}/{apiKey}/jpeg/{groupKey}/{monitorId}/s.jpg`
- [x] Port Shinobi monitor discovery
  - [x] API call: `GET {baseUrl}/{apiKey}/monitor/{groupKey}`
  - [x] Parse response and normalize to camera schema
- [x] Port connection testing logic (mode: 'rtsp' vs 'vms')

### Frontend Tasks
- [x] Install hls.js: `npm install hls.js @types/hls.js`
- [x] Port `LiveView.tsx` from patch
  - [x] Implement HLS.js video player
  - [x] Add iframe fallback for non-HLS browsers
  - [x] Add loading/error states
  - [x] Adapt to your component styling
- [x] Create VMS server management UI
  - [x] VMS server list page
  - [x] Add/edit VMS server form
  - [x] Test connection button
  - [x] Monitor discovery interface
- [x] Extend camera management UI from patch
  - [x] Add "Connect to VMS" action
  - [x] Show VMS connection status
  - [x] Add "View Live" button (opens LiveView modal)
  - [x] Add demo mode: discover & import Shinobi monitors
  - [x] Add demo cleanup action

### Docker/Infrastructure Tasks
- [x] Create `vms-lab/` directory for Shinobi testing
- [x] Port Shinobi Docker Compose setup
  - [x] Shinobi service (port 8080)
  - [x] MySQL service for Shinobi
  - [x] Add to `.gitignore`
- [x] Document Shinobi setup in README
  - [x] How to start Shinobi: `cd vms-lab && docker-compose up -d`
  - [x] Default credentials and API key generation
  - [x] How to create test cameras/monitors

### Documentation Tasks
- [x] Create `docs/VMS_INTEGRATION.md`
  - [x] Shinobi setup guide
  - [x] API endpoints documentation
  - [x] Stream URL formats
  - [x] Connection testing flow
- [x] Update API documentation with VMS endpoints
- [x] Add Shinobi testing guide for developers

### Tests
- [x] Integration: VMS server CRUD with tenant isolation
- [x] Integration: Camera-VMS connect/disconnect
- [x] Integration: Stream URL generation for Shinobi
- [x] Integration: Monitor discovery and import
- [~] Manual: HLS playback in browser (verified, revisit with tooling)
- [~] Manual: Shinobi connection test (verified, revisit with tooling)

### Definition of Done (Slice 9.0)
- [x] VMS server can be registered (Shinobi credentials)
- [x] Cameras can be linked to Shinobi monitors
- [x] Stream URLs generated correctly (HLS, embed, snapshot)
- [x] Live video plays in browser using hls.js
- [x] Shinobi monitors can be discovered and imported
- [x] Connection testing works for both RTSP and VMS modes
- [x] Demo cameras can be bulk imported and cleaned up
- [x] All operations are multi-tenant (companyId filtered)
- [ ] Shinobi Docker environment runs locally for testing
- [x] Frontend shows camera status and live video
- [~] All tests pass

### Dependencies
- Slice 8 (Mobile Testing & Documentation)

### Estimated Duration
- Backend porting: 1.5 days
- Frontend porting: 1 day
- Shinobi Docker setup: 0.5 days
- Testing & documentation: 0.5 days
- **Total: 3-4 days**

### Migration Notes
- This slice provides a complete MVP camera solution using Shinobi
- Boaz's implementation is production-tested and proven
- Focus on adapting to multi-tenant architecture (companyId everywhere)
- Keep security: never expose VMS auth credentials in API responses
- Use Boaz's connection test logic to validate camera setup

---

## Slice 9: Camera Management Enhancements

### Goal
Enhance camera CRUD beyond Boaz's work with advanced features: status monitoring, geospatial queries, and WebSocket updates.

### No Scope Creep
- ❌ Do NOT implement additional VMS providers yet
- ❌ Do NOT implement AI configuration yet
- ❌ Do NOT implement PTZ controls yet

### Backend Tasks
- [x] Extend Camera model with additional fields
  - [x] Add `capabilities` field (PTZ, audio, motion detection)
  - [x] Add `maintenanceSchedule` field
  - [x] Add `tags` array for categorization
- [x] Implement advanced camera queries
  - [x] `GET /api/cameras/near?lat=X&lng=Y&radius=Z` (geo-spatial)
  - [x] `GET /api/cameras/status/:status` (filter by status)
  - [x] `GET /api/cameras/tags/:tag` (filter by tag)
- [x] Create status monitoring service
  - [x] Background job to check camera health
  - [x] Ping RTSP/VMS endpoints periodically
  - [x] Update camera status (online, offline, error)
  - [x] Emit `camera:status` WebSocket event on changes
- [x] Implement bulk operations
  - [x] `POST /api/cameras/bulk/update` (bulk status update)
  - [x] `POST /api/cameras/bulk/delete` (bulk delete)
  - [x] `POST /api/cameras/bulk/tag` (bulk tagging)

### Frontend Tasks
- [x] Enhance camera list page
  - [x] Add advanced filters (status, tags, VMS)
  - [x] Add bulk selection checkboxes
  - [x] Add bulk action toolbar
  - [x] Show camera health indicators with tooltips
- [x] Create camera detail page
  - [x] Full camera information display
  - [x] Edit capability in place
  - [x] Show connection history/logs
  - [x] Display maintenance schedule
- [x] Add camera search functionality
  - [x] Search by name, location, tags
  - [x] Auto-complete suggestions
- [x] Real-time camera status updates
  - [x] Subscribe to `camera:status` WebSocket events
  - [x] Update UI when camera status changes
  - [x] Show notification on camera offline

### Tests
- [~] Integration: geo-spatial camera query (manual verification completed; automated tests blocked by MongoMemoryServer on Alpine)
- [~] Unit: status monitoring job logic (manual verification completed; automated tests blocked by MongoMemoryServer on Alpine)
- [~] Integration: bulk operations with tenant isolation (manual verification completed; automated tests blocked by MongoMemoryServer on Alpine)
- [~] Integration: WebSocket status updates (manual verification completed; automated tests blocked by MongoMemoryServer on Alpine)

### Definition of Done (Slice 9)
- [x] Geo-spatial queries return nearby cameras (manual verification completed)
- [x] Camera status monitoring runs automatically (manual verification completed)
- [x] Status changes broadcast via WebSocket (manual verification completed)
- [x] Bulk operations work correctly (manual verification completed)
- [x] Advanced search and filtering functional (manual verification completed)
- [x] Real-time status updates appear in UI (manual verification completed)

### Dependencies
- Slice 9.0 (VMS Integration Foundation)

---

## Slice 10: Direct RTSP Adapter (No VMS)

### Goal
Implement DirectRTSP adapter for cameras without VMS, using FFmpeg for RTSP → HLS transcoding.

### Context
Slice 9.0 provides Shinobi VMS integration. This slice adds support for cameras that stream directly via RTSP without a VMS layer.

### No Scope Creep
- ❌ Do NOT implement additional VMS providers (wait for Slice 11)
- ❌ Do NOT implement historical playback (Slice 12)
- ❌ Do NOT implement multi-camera view (Phase 2)
- ❌ Do NOT implement video recording/storage

### Backend Tasks
- [x] Create VMS adapter interface/base class
  - [x] Define `getStreamUrls()` method signature
  - [x] Define `testConnection()` method
  - [x] Define `getPlaybackUrl(timestamp)` stub for Slice 12
- [x] Implement DirectRTSPAdapter
  - [x] Accept RTSP URL as input
  - [x] Spawn FFmpeg process for RTSP → HLS transcoding
  - [x] Store HLS segments in temp directory (`/tmp/hls/{cameraId}/`)
  - [x] Generate HLS playlist URL
  - [x] Implement segment cleanup (delete old segments)
  - [x] Handle FFmpeg process lifecycle (start/stop/restart)
- [x] Implement stream session management
  - [x] Track active streams per camera
  - [x] Auto-stop stream after X minutes of inactivity
  - [x] Implement heartbeat endpoint to keep stream alive
- [x] Add DirectRTSP configuration to Camera model
  - [x] `streamConfig.type: 'direct-rtsp' | 'vms'`
  - [x] `streamConfig.rtspUrl` for direct cameras
- [x] Implement stream authentication tokens
  - [x] Generate time-limited tokens for HLS access
  - [x] Validate tokens on HLS segment requests
  - [x] Add `/api/cameras/:id/stream/token` endpoint

### Frontend Tasks
- [x] Update camera form to support both VMS and Direct RTSP
  - [x] Radio button: VMS or Direct RTSP
  - [x] Show RTSP URL field for direct mode
  - [x] Show VMS selection dropdown for VMS mode
- [x] Extend LiveView to handle both stream types
  - [x] Check camera type (VMS vs Direct RTSP)
  - [x] Request appropriate stream URL
  - [x] Display loading state during FFmpeg startup
- [x] Add stream heartbeat (keep-alive)
  - [x] Ping backend every 30 seconds while viewing
  - [x] Prevent auto-stop of active streams

### Infrastructure Tasks
- [x] Install FFmpeg in backend Docker container
  - [x] Add to Dockerfile: `RUN apt-get install -y ffmpeg`
  - [x] Create HLS segment storage directory
    - [x] Add volume mount for `/tmp/hls` in docker-compose
    - [x] Implement cleanup cron job (delete segments >1 hour old)
  - [x] Add FFmpeg to backend dependencies documentation

### Tests
- [~] Unit: DirectRTSPAdapter stream URL generation (token/path unit tests added; adapter-specific coverage pending)
- [~] Integration: FFmpeg process spawning and cleanup (requires FFmpeg + RTSP source in CI)
- [~] Integration: HLS segment creation and serving (requires FFmpeg + RTSP source in CI)
- [~] Integration: Stream token generation and validation (unit coverage added in rtsp-stream.service.test.ts)
- [~] Integration: Stream auto-stop after inactivity (requires FFmpeg + RTSP source in CI)
- [~] Manual: Direct RTSP stream playback in browser (manual runbook pending)

### Definition of Done (Slice 10)
- [x] Cameras can be configured as Direct RTSP (without VMS)
- [x] FFmpeg transcodes RTSP to HLS automatically
- [x] HLS streams accessible via authenticated URLs
- [x] Stream tokens prevent unauthorized access
- [x] Inactive streams stop automatically to save resources
- [x] Both VMS and Direct RTSP cameras work in LiveView
- [~] All tests pass (integration tests need FFmpeg + RTSP source in CI)

### Dependencies
- Slice 9 (Camera Management Enhancements)

### Estimated Duration
- 2-3 days

---

## Slice 11: Additional VMS Adapters (Milestone/Genetec Stubs)

### Goal
Extend VMS adapter pattern with stubs for Milestone XProtect and Genetec Security Center.

### Context
Slice 9.0 provides Shinobi adapter. Slice 10 provides Direct RTSP. This slice adds adapter stubs for enterprise VMS systems (implementation deferred to Phase 2).

### No Scope Creep
- ❌ Do NOT implement full Milestone/Genetec integration (Phase 2)
- ❌ Do NOT implement video export
- ❌ Do NOT implement advanced VMS features (PTZ, bookmarks, etc.)
- ❌ Do NOT implement VMS SDK integration

### Backend Tasks
- [x] Create VMS adapter factory pattern
  - [x] `VmsAdapterFactory.create(vmsServer)` returns correct adapter
  - [x] Support: 'shinobi', 'direct-rtsp', 'milestone', 'genetec', 'other'
- [x] Create MilestoneAdapter stub
  - [x] Implement interface methods (throw "Not Implemented" errors)
  - [x] Document Milestone API requirements in comments
  - [x] Add placeholder for authentication flow
  - [x] Add `getStreamUrls()` stub returns error message
- [x] Create GenetecAdapter stub
  - [x] Implement interface methods (throw "Not Implemented" errors)
  - [x] Document Genetec SDK requirements in comments
  - [x] Add placeholder for connection logic
  - [x] Add `getStreamUrls()` stub returns error message
- [x] Update VmsServer model
  - [x] Add 'milestone' and 'genetec' to provider enum
  - [x] Add `sdkConfig` field for VMS-specific settings
- [x] Update camera VMS connection logic
  - [x] Check VMS provider before connecting
  - [x] Show helpful error for unsupported VMS types
  - [x] Return capability flags: `{ supportsLive, supportsPlayback, supportsExport }`
- [x] Add VMS capability checking endpoint
  - [x] `GET /api/vms/servers/:id/capabilities`
  - [x] Returns what the VMS adapter supports

### Frontend Tasks
- [x] Update VMS server form
  - [x] Show provider-specific fields based on selection
  - [x] Milestone: Server URL, username, password
  - [x] Genetec: Server URL, SDK config
  - [x] Shinobi: API key, group key (existing)
- [x] Add VMS capability indicators
  - [x] Show badges: "Live ✓", "Playback ✗", "Export ✗"
  - [x] Disable unavailable features in UI
- [x] Add "Coming Soon" messages for unsupported VMS
  - [x] Show when trying to connect Milestone camera
  - [x] Show when trying to view Genetec stream

### Documentation Tasks
- [x] Create `docs/VMS_ADAPTER_GUIDE.md`
  - [x] How to implement a new VMS adapter
  - [x] Interface requirements
  - [x] Testing guidelines
- [x] Document Milestone integration requirements (Phase 2)
  - [x] SDK installation
  - [x] API authentication
  - [x] Stream URL generation
- [x] Document Genetec integration requirements (Phase 2)
  - [x] SDK installation
  - [x] Server connection
  - [x] Stream access patterns

### Tests
- [x] Unit: VMS adapter factory creates correct adapter
- [x] Unit: Milestone stub throws appropriate errors
- [x] Unit: Genetec stub throws appropriate errors
- [~] Integration: VMS capability endpoint returns correct data
- [~] Integration: Unsupported VMS connection shows error
Note: Tests attempted in Docker (Alpine) fail due to MongoMemoryServer unsupported binaries.

### Definition of Done (Slice 11)
- [x] VMS adapter factory pattern implemented
- [x] Milestone and Genetec stubs created
- [x] Adapter interface documented
- [x] VMS capabilities exposed via API
- [x] Frontend shows "Coming Soon" for unsupported VMS
- [x] Clear path for Phase 2 VMS implementation
- [~] All tests pass

### Dependencies
- Slice 10 (Direct RTSP Adapter)

### Estimated Duration
- 1-2 days

---

## Slice 12: Historical Video Playback

### Goal
Implement time-aligned video playback for events, allowing operators to review recorded footage from the time of an incident.

### Context
Slices 9.0-11 provide live streaming. This slice adds historical/recorded video playback tied to event timestamps.

### No Scope Creep
- ❌ Do NOT implement video forensic search (Phase 2)
- ❌ Do NOT implement clip export/download (Phase 2)
- ❌ Do NOT implement video annotation (Phase 2)
- ❌ Do NOT implement frame-by-frame analysis
- ❌ Do NOT implement video editing

### Backend Tasks
- [x] Extend VMS adapter interface with playback methods
  - [x] `getPlaybackUrl(timestamp, duration)` → returns playback stream URL
  - [x] `checkRecordingAvailability(timestamp)` → boolean
  - [x] `getRecordingRange()` → returns available date range
- [x] Implement playback for Shinobi adapter
  - [x] Shinobi playback URL format research
  - [x] Generate time-aligned playback URLs
  - [~] Handle "no recording" gracefully
- [x] Implement playback stub for Direct RTSP
  - [x] Return "Recording not available" (no storage in MVP)
  - [x] Document Phase 2 recording storage requirements
- [~] Implement event video playback endpoint
  - [x] `GET /api/events/:id/video-playback`
  - [x] Find cameras near event location (geo-spatial query)
  - [x] Generate playback URLs for each camera at event timestamp
  - [x] Return array of `{ cameraId, cameraName, playbackUrl, available }`
- [x] Add recording configuration to Camera model
  - [x] `recording.enabled` boolean
  - [x] `recording.retentionDays` integer
  - [x] `recording.vmsHandled` boolean (true for VMS-based recording)

### Frontend Tasks
- [x] Create EventVideoPlayback component
  - [x] Triggered from event detail page
  - [x] "View Video" button (disabled if no cameras nearby)
- [x] Implement multi-camera playback layout
  - [x] Grid view: 1x1, 2x2, 3x3 layouts
  - [x] Each camera in separate video player
  - [x] Show camera name and status
- [ ] Add timeline scrubber
  - [x] Horizontal timeline with event marker
  - [x] Seek to specific time
  - [x] Show current playback time
- [x] Synchronize playback across cameras
  - [x] Play/pause all cameras together
  - [x] Sync seek operations
  - [x] Show sync status indicator
- [x] Handle "no recording" gracefully
  - [x] Show message: "Recording not available for this camera"
  - [x] Suggest enabling recording or checking VMS
- [x] Link from event detail to playback
  - [x] "View Video" button in event detail
  - [x] Badge showing # of cameras with recording

### Tests
- [~] Integration: playback URL generation for Shinobi
- [~] Integration: camera selection by event location
- [~] Integration: no recording handling
- [~] Manual: Multi-camera playback synchronization
- [~] Manual: Timeline scrubber functionality

### Definition of Done (Slice 12)
- [x] Operator can access playback from event detail page
- [x] Playback URLs generated for cameras with recording
- [x] Multiple cameras shown in grid layout
- [ ] Playback synchronized across cameras
- [x] Playback synchronized across cameras
- [x] Timeline scrubber allows seeking
- [x] Graceful handling when no recording exists
- [x] UI shows which cameras have recording available
- [~] All tests pass

### Dependencies
- Slice 11 (Additional VMS Adapters)

### Estimated Duration
- 2-3 days

---

## Slice 13: AI Service Integration

### Goal
Implement AI detection callback that creates camera reports.

### No Scope Creep
- ❌ Do NOT implement real AI model
- ❌ Do NOT implement AI training
- ❌ Do NOT implement detection regions

### Backend Tasks
- [ ] Implement `POST /api/ai/detection` (callback endpoint)
- [ ] Validate detection payload
- [ ] Create camera report from detection
- [ ] Store detection snapshot
- [ ] Auto-link to nearby event (configurable)
- [ ] Emit `report:created` WebSocket event

### AI Service Tasks
- [ ] Implement RTSP stream reading (OpenCV)
- [ ] Implement frame processing queue
- [ ] Implement YOLOv8 inference (or mock)
- [ ] Implement detection callback to backend
- [ ] Implement debouncing logic
- [ ] Add camera configuration endpoint

### Tests
- [ ] Integration: detection callback creates report
- [ ] Integration: snapshot stored
- [ ] Unit: debouncing logic

### Definition of Done (Slice 13)
- [ ] AI service can process camera stream
- [ ] Detections create camera reports
- [ ] Reports appear in operator dashboard
- [ ] Debouncing prevents duplicate detections

### Dependencies
- Slice 12 (Historical Playback)

---

## Slice 14: Polish & Hardening

### Goal
Fix edge cases, improve error handling, performance optimization.

### Tasks
- [ ] Review all error messages
- [ ] Add input validation edge cases
- [ ] Add rate limiting
- [ ] Performance profiling
- [ ] Database index optimization
- [ ] Load testing
- [ ] Security audit
- [ ] Documentation review
- [ ] API versioning if needed

### Definition of Done (Slice 14)
- [ ] All known edge cases handled
- [ ] Rate limiting in place
- [ ] Performance acceptable under load
- [ ] Security review complete
- [ ] Documentation complete

### Dependencies
- Slice 13 (AI Service Integration)

---

## Slice Review Checklist

Use this checklist after completing each slice:

### Tenant Isolation
- [ ] All database queries filter by `companyId`
- [ ] API endpoints verify user belongs to requested company
- [ ] No cross-company data leakage possible

### Logging & Observability
- [ ] All endpoints log structured JSON
- [ ] CorrelationId present in all logs
- [ ] Errors logged with stack traces
- [ ] Audit trail entries created for mutations

### Testing
- [ ] Unit tests for new logic
- [ ] Integration tests for new endpoints
- [ ] Contract tests (OpenAPI validation)
- [ ] Test coverage maintained ≥70%

### API Documentation
- [ ] All endpoints documented in OpenAPI
- [ ] Request/response examples provided
- [ ] Error responses documented
- [ ] Auth requirements documented

### Naming Consistency
- [ ] Uses "Report" (not "submission", "incident report")
- [ ] Uses "Event" (not "incident", "situation")
- [ ] Uses "Camera" (not "sensor", "device")
- [ ] Uses "VMS" (not "NVR", "DVR")

### Code Quality
- [ ] ESLint passes with no errors
- [ ] Prettier formatting applied
- [ ] No TODO comments left untracked
- [ ] No hardcoded secrets

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-12 | AI-Assisted | Initial work breakdown structure |
| 1.1 | 2026-01-12 | AI-Assisted | Replaced mobile app slices (12-13) with Mobile API Integration slices (7-8), renumbered all subsequent slices |

---

*This document guides incremental implementation. Each slice should be completed fully before moving to the next. Do not skip slices or combine multiple slices without explicit approval.*


