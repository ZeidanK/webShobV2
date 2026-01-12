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
- Mobile: React Native + TypeScript (Phase 2)
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
| 7 | Camera Management | Camera CRUD, status monitoring | 2 days |
| 8 | Live Video Streaming | RTSP→HLS, web player integration | 2-3 days |
| 9 | VMS Adapters | Adapter pattern, direct RTSP, playback stubs | 2-3 days |
| 10 | Historical Playback | Time-aligned video, multi-camera sync | 2-3 days |
| 11 | AI Service Integration | Detection callback, camera report creation | 2-3 days |
| 12 | First Responder Mobile | React Native app, assignments, location | 3-4 days |
| 13 | Citizen Mobile | React Native app, report submission | 2-3 days |
| 14 | Polish & Hardening | Error handling, edge cases, performance | 2-3 days |

**Total Estimated Duration**: 28-40 days

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
- [ ] Create User model (Mongoose schema)
- [ ] Implement password hashing (bcrypt)
- [ ] Implement `POST /api/auth/register`
- [ ] Implement `POST /api/auth/login` (returns JWT)
- [ ] Implement `POST /api/auth/refresh` (refresh token)
- [ ] Implement `POST /api/auth/forgot-password`
- [ ] Implement `POST /api/auth/reset-password`
- [ ] Implement JWT validation middleware
- [ ] Implement API key validation middleware
- [ ] Add auth endpoints to OpenAPI spec
- [ ] Implement account lockout after 5 failed attempts (CONFIGURABLE DEFAULT)

### Frontend Tasks
- [ ] Create login form with validation
- [ ] Create registration form
- [ ] Create forgot password form
- [ ] Implement auth context/store
- [ ] Implement protected route wrapper
- [ ] Store JWT in secure storage

### API/Swagger Tasks
- [ ] Document all auth endpoints in OpenAPI
- [ ] Add security schemes (Bearer JWT, API Key)
- [ ] Add request/response examples

### Tests
- [ ] Unit: password hashing
- [ ] Unit: JWT generation/validation
- [ ] Integration: registration flow
- [ ] Integration: login flow
- [ ] Integration: invalid credentials (401)
- [ ] Integration: account lockout

### Definition of Done (Slice 1)
- [ ] User can register with email/password
- [ ] User can login and receive JWT
- [ ] Protected endpoints reject requests without valid JWT
- [ ] API key authentication works for mobile endpoints
- [ ] All auth endpoints documented in Swagger
- [ ] All tests pass
- [ ] Audit log entries created for auth events

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
- [ ] Create Company model (Mongoose schema)
- [ ] Implement `POST /api/companies` (super_admin only)
- [ ] Implement `GET /api/companies/:id`
- [ ] Implement `PATCH /api/companies/:id/settings`
- [ ] Implement `POST /api/companies/:id/regenerate-api-key`
- [ ] Implement `GET /api/users` (company-scoped)
- [ ] Implement `POST /api/users` (admin creates users)
- [ ] Implement `GET /api/users/:id`
- [ ] Implement `PATCH /api/users/:id`
- [ ] Implement `DELETE /api/users/:id` (soft delete)
- [ ] Implement RBAC middleware with role checks
- [ ] Add companyId filter to all queries (tenant isolation)

### Frontend Tasks
- [ ] Create admin user list page
- [ ] Create user create/edit form
- [ ] Create company settings page (admin only)
- [ ] Implement role-based UI visibility

### API/Swagger Tasks
- [ ] Document all company endpoints
- [ ] Document all user endpoints
- [ ] Add role requirements to endpoint docs

### Tests
- [ ] Unit: RBAC permission checks
- [ ] Integration: company creation
- [ ] Integration: user CRUD
- [ ] Integration: tenant isolation (cannot access other company's data)
- [ ] Integration: role hierarchy enforcement

### Definition of Done (Slice 2)
- [ ] Super admin can create companies
- [ ] Company admin can manage users
- [ ] Users cannot see other companies' data
- [ ] Role hierarchy enforced (cannot create higher role)
- [ ] All endpoints documented in Swagger
- [ ] Tenant isolation tested

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
- [ ] Create Report model (Mongoose schema)
- [ ] Create Attachment subdocument schema
- [ ] Implement file upload middleware (multer)
- [ ] Implement `POST /api/reports` (citizen report)
- [ ] Implement `GET /api/reports` (company-scoped, paginated)
- [ ] Implement `GET /api/reports/:id`
- [ ] Implement `POST /api/reports/:id/attachments`
- [ ] Implement `PATCH /api/reports/:id/verify` (operator)
- [ ] Implement `PATCH /api/reports/:id/reject` (operator)
- [ ] Store attachments (local storage MVP, S3 later)
- [ ] Generate thumbnails for images

### Frontend Tasks
- [ ] Create report submission form
- [ ] Implement file upload with preview
- [ ] Create report list view (operator)
- [ ] Create report detail view
- [ ] Implement verification UI for operators

### API/Swagger Tasks
- [ ] Document report endpoints
- [ ] Document file upload (multipart/form-data)
- [ ] Add attachment URL patterns

### Tests
- [ ] Unit: attachment validation
- [ ] Integration: report submission
- [ ] Integration: file upload
- [ ] Integration: verification workflow
- [ ] Integration: tenant isolation

### Definition of Done (Slice 3)
- [ ] Citizen can submit report with title, description, location, type
- [ ] Citizen can attach images/videos
- [ ] Operator can view all reports
- [ ] Operator can verify/reject reports
- [ ] Attachments stored and retrievable
- [ ] All tests pass

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
- [ ] Create Event model (Mongoose schema)
- [ ] Create EventType model (with system defaults)
- [ ] Implement `POST /api/events` (manual creation)
- [ ] Implement `GET /api/events` (company-scoped, paginated)
- [ ] Implement `GET /api/events/:id`
- [ ] Implement `PATCH /api/events/:id` (update)
- [ ] Implement `PATCH /api/events/:id/status` (lifecycle)
- [ ] Implement `POST /api/events/:id/reports` (link report)
- [ ] Implement `DELETE /api/events/:id/reports/:reportId` (unlink)
- [ ] Implement `GET /api/event-types`
- [ ] Implement `POST /api/event-types` (company-specific)
- [ ] Create audit trail entries for all event changes
- [ ] Implement state machine for event lifecycle

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
- [ ] Unit: lifecycle state transitions
- [ ] Integration: event CRUD
- [ ] Integration: report linking
- [ ] Integration: invalid state transitions (400)
- [ ] Integration: audit trail creation

### Definition of Done (Slice 4)
- [ ] Operator can create events manually
- [ ] Operator can update event status through lifecycle
- [ ] Reports can be linked/unlinked to events
- [ ] Audit trail captures all changes
- [ ] Invalid state transitions rejected
- [ ] All tests pass

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

## Slice 7: Camera Management

### Goal
Implement camera CRUD and status monitoring (no video streaming yet).

### No Scope Creep
- ❌ Do NOT implement live streaming
- ❌ Do NOT implement VMS integration
- ❌ Do NOT implement AI configuration

### Backend Tasks
- [ ] Create Camera model (Mongoose schema)
- [ ] Implement `POST /api/cameras`
- [ ] Implement `GET /api/cameras` (company-scoped)
- [ ] Implement `GET /api/cameras/:id`
- [ ] Implement `PATCH /api/cameras/:id`
- [ ] Implement `DELETE /api/cameras/:id` (soft delete)
- [ ] Implement `GET /api/cameras/near` (geo-spatial)
- [ ] Create status monitoring job (cron/interval)
- [ ] Emit `camera:status` WebSocket event

### Frontend Tasks
- [ ] Create camera list page
- [ ] Create camera create/edit form
- [ ] Display camera markers on map
- [ ] Show camera status indicators

### Tests
- [ ] Integration: camera CRUD
- [ ] Integration: geo-spatial query
- [ ] Unit: status monitoring logic

### Definition of Done (Slice 7)
- [ ] Admin can add/edit/remove cameras
- [ ] Cameras appear on map
- [ ] Camera status updates broadcast
- [ ] Geo-spatial queries work

### Dependencies
- Slice 6 (Map & Dashboard UI)

---

## Slice 8: Live Video Streaming

### Goal
Implement RTSP to HLS transcoding and web video player.

### No Scope Creep
- ❌ Do NOT implement historical playback
- ❌ Do NOT implement VMS adapters
- ❌ Do NOT implement multi-camera view

### Backend Tasks
- [ ] Create VMS adapter interface
- [ ] Implement DirectRTSPAdapter
- [ ] Set up FFmpeg transcoding (RTSP → HLS)
- [ ] Implement `GET /api/cameras/:id/stream` (returns HLS URL)
- [ ] Create HLS segment storage/cleanup
- [ ] Implement stream authentication

### Frontend Tasks
- [ ] Integrate HLS.js video player
- [ ] Create camera video modal
- [ ] Implement stream loading states
- [ ] Handle stream errors gracefully

### Tests
- [ ] Integration: stream URL generation
- [ ] Manual: HLS playback in browser

### Definition of Done (Slice 8)
- [ ] Operator can click camera and see live video
- [ ] HLS stream plays in browser
- [ ] Stream is authenticated
- [ ] Graceful error handling for offline cameras

### Dependencies
- Slice 7 (Camera Management)

---

## Slice 9: VMS Adapters

### Goal
Implement VMS adapter pattern with stubs for Milestone/Genetec.

### No Scope Creep
- ❌ Do NOT implement full Milestone/Genetec integration
- ❌ Do NOT implement video export
- ❌ Do NOT implement playback sync

### Backend Tasks
- [ ] Define VMS adapter interface fully
- [ ] Implement adapter factory
- [ ] Create MilestoneAdapter stub
- [ ] Create GenetecAdapter stub
- [ ] Add vmsConfig to Camera model
- [ ] Implement adapter selection per camera
- [ ] Add VMS connection status to camera status

### Tests
- [ ] Unit: adapter factory
- [ ] Unit: adapter interface compliance

### Definition of Done (Slice 9)
- [ ] Adapter pattern implemented
- [ ] DirectRTSPAdapter works for live video
- [ ] Stub adapters return appropriate errors
- [ ] Cameras can be configured for different VMS types

### Dependencies
- Slice 8 (Live Video Streaming)

---

## Slice 10: Historical Playback

### Goal
Implement time-aligned video playback for events.

### No Scope Creep
- ❌ Do NOT implement video forensic search
- ❌ Do NOT implement clip export
- ❌ Do NOT implement annotation

### Backend Tasks
- [ ] Extend VMS adapter with `getPlaybackUrl(timestamp)`
- [ ] Implement `GET /api/events/:id/video-playback`
- [ ] Find cameras near event location
- [ ] Generate playback URLs for event timestamp
- [ ] Handle "no recording available" gracefully

### Frontend Tasks
- [ ] Create event video playback view
- [ ] Implement multi-camera video layout
- [ ] Add timeline scrubber
- [ ] Synchronize playback across cameras
- [ ] Link from event detail to playback

### Tests
- [ ] Integration: playback URL generation
- [ ] Integration: camera selection by location

### Definition of Done (Slice 10)
- [ ] Operator can view video from event timestamp
- [ ] Multiple cameras shown if available
- [ ] Playback is synchronized
- [ ] Graceful handling when no recording exists

### Dependencies
- Slice 9 (VMS Adapters)

---

## Slice 11: AI Service Integration

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

### Definition of Done (Slice 11)
- [ ] AI service can process camera stream
- [ ] Detections create camera reports
- [ ] Reports appear in operator dashboard
- [ ] Debouncing prevents duplicate detections

### Dependencies
- Slice 10 (Historical Playback)

---

## Slice 12: First Responder Mobile

### Goal
Implement React Native app for first responders.

### No Scope Creep
- ❌ Do NOT implement offline mode
- ❌ Do NOT implement push notifications
- ❌ Do NOT implement navigation/routing

### Mobile Tasks
- [ ] Set up React Native project
- [ ] Implement login screen
- [ ] Implement assignment list
- [ ] Implement assignment detail
- [ ] Implement status update
- [ ] Implement location sharing
- [ ] Implement field report submission

### Backend Tasks
- [ ] Implement `GET /api/assignments` (for responder)
- [ ] Implement `PATCH /api/events/:id/assign`
- [ ] Implement `POST /api/users/:id/location`
- [ ] Emit `responder:location` WebSocket event

### Tests
- [ ] Integration: assignment flow
- [ ] Integration: location update

### Definition of Done (Slice 12)
- [ ] Responder can login with credentials
- [ ] Responder sees assigned events
- [ ] Responder can update event status
- [ ] Responder location visible to operators
- [ ] Responder can submit field reports

### Dependencies
- Slice 11 (AI Service Integration)

---

## Slice 13: Citizen Mobile

### Goal
Implement React Native app for citizens.

### No Scope Creep
- ❌ Do NOT implement anonymous reports yet
- ❌ Do NOT implement push notifications
- ❌ Do NOT implement offline queue

### Mobile Tasks
- [ ] Set up citizen app variant
- [ ] Implement login/registration
- [ ] Implement report submission form
- [ ] Implement photo/video capture
- [ ] Implement report status tracking
- [ ] Implement GPS location capture

### Tests
- [ ] Integration: report submission from mobile
- [ ] Integration: attachment upload

### Definition of Done (Slice 13)
- [ ] Citizen can register and login
- [ ] Citizen can submit report with attachments
- [ ] Citizen can track report status
- [ ] Location captured automatically

### Dependencies
- Slice 12 (First Responder Mobile)

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
- All previous slices

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

---

*This document guides incremental implementation. Each slice should be completed fully before moving to the next. Do not skip slices or combine multiple slices without explicit approval.*
