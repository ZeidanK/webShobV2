# Event Monitoring and Management Platform

## System Architecture Document

**Version:** 2.0  
**Date:** January 12, 2026  
**Status:** Frozen Foundation Document

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Service Architecture](#4-service-architecture)
5. [Data Architecture](#5-data-architecture)
6. [Video Architecture](#6-video-architecture)
7. [Real-Time Architecture](#7-real-time-architecture)
8. [Integration Architecture](#8-integration-architecture)
9. [Observability Architecture](#9-observability-architecture)
10. [Testing Architecture](#10-testing-architecture)
11. [Deployment Architecture](#11-deployment-architecture)
12. [Security Architecture](#12-security-architecture)

---

## 1. Introduction

### 1.1 Purpose

This document defines the technical architecture of the Event Monitoring and Management Platform, specifying how components interact, data flows through the system, and how cross-cutting concerns (logging, testing, video) are implemented.

### 1.2 Architecture Principles

1. **Multi-Tenant by Design**: All services enforce tenant isolation at the data layer
2. **API-First**: All functionality exposed via well-documented RESTful APIs
3. **Real-Time by Default**: State changes broadcast immediately via WebSocket
4. **Human-in-the-Loop**: AI provides signals; humans make decisions
5. **Video as Core Infrastructure**: Live and historical video access is foundational
6. **Observable by Default**: All services emit structured logs and metrics
7. **Testable at All Layers**: Unit, integration, and contract tests are mandatory

---

## 2. Technology Stack

### 2.1 Required Technologies

**Note**: The following stack is mandated by project requirements.

| Layer | Technology | Version | Rationale |
|-------|------------|---------|-----------|
| **Backend API** | Node.js + TypeScript | Node 18 LTS | Async I/O, strong ecosystem, type safety |
| **Database** | MongoDB | 5.0+ | Document model, geo-spatial queries, flexible schema |
| **Web Frontend** | React + TypeScript | React 18+ | Component-based UI, large ecosystem, type safety |
| **Mobile Apps** | React Native + TypeScript | 0.72+ | Cross-platform, shared codebase with web, native performance |
| **AI Service** | Python + FastAPI | Python 3.9+, FastAPI 0.100+ | ML/CV libraries, async performance |

### 2.2 Supporting Technologies

| Purpose | Technology | Rationale |
|---------|------------|-----------|
| **API Framework** | Express.js | Mature, middleware-based, extensive ecosystem |
| **Real-Time** | Socket.io | WebSocket abstraction, reconnection, rooms |
| **Validation** | Joi / Zod | Schema validation for API inputs |
| **ORM/ODM** | Mongoose | MongoDB object modeling, schema validation |
| **Authentication** | JWT (jsonwebtoken) | Stateless auth, standard format |
| **Video Processing** | FFmpeg | RTSP to HLS transcoding, video manipulation |
| **Computer Vision** | YOLOv8 (Ultralytics) | State-of-art object detection, real-time performance |
| **Video Streaming** | OpenCV, FFmpeg, node-rtsp-stream | RTSP handling, frame extraction |
| **Mapping** | Leaflet.js / Mapbox GL JS | Interactive maps, marker clustering |
| **Testing - Backend** | Jest, Supertest | Unit and integration testing |
| **Testing - Frontend** | Jest, React Testing Library | Component testing |
| **API Documentation** | Swagger UI / OpenAPI 3.0 | Interactive API docs, contract testing |
| **Containerization** | Docker, Docker Compose | Consistent environments, easy deployment |
| **Reverse Proxy** | Nginx | Static file serving, SSL termination, load balancing |

---

## 3. System Architecture Overview

### 3.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├──────────────────────┬──────────────────────┬───────────────────────────────┤
│   Web Dashboard      │   Citizen App        │   First Responder App         │
│   (React SPA)        │   (React Native)     │   (React Native)              │
│   - Operators        │   - Report submit    │   - Assignments               │
│   - Event mgmt       │   - Report status    │   - Navigation                │
│   - Live video       │   - Anonymous mode   │   - Status updates            │
│   - Map view         │                      │   - Location sharing          │
└──────────┬───────────┴──────────┬───────────┴───────────┬───────────────────┘
           │                      │                       │
           │         HTTPS        │         HTTPS         │
           ▼                      ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY (Nginx)                                │
│  • SSL Termination          • Rate Limiting          • Static Files          │
│  • Load Balancing           • Request Routing        • CORS                  │
└──────────┬──────────────────────────────────────────────────────────────────┘
           │
           ├─────────── REST API ──────────┐
           │                               │
           ▼                               ▼
┌──────────────────────────┐    ┌─────────────────────────────┐
│   Backend API Server     │    │   WebSocket Server          │
│   (Node.js + Express)    │    │   (Socket.io)               │
│                          │    │                             │
│  • Auth Service          │◄───┤  • Real-time events         │
│  • Company Service       │    │  • Location updates         │
│  • User Service          │    │  • Notifications            │
│  • Camera Service        │    │  • Company rooms (tenant    │
│  • Event Service         │    │    isolation)               │
│  • Report Service        │    └─────────────────────────────┘
│  • EventType Service     │
│  • VMS Adapter           │
└──────────┬───────────────┘
           │
           ├─────────────────────────────────┐
           │                                 │
           ▼                                 ▼
┌──────────────────────────┐    ┌─────────────────────────────┐
│   MongoDB Database       │    │   AI Detection Service      │
│                          │    │   (Python + FastAPI)        │
│  • Multi-tenant data     │    │                             │
│  • Geo-spatial indexes   │    │  • YOLOv8 inference         │
│  • Audit logs            │◄───┤  • RTSP stream reading      │
│  • Structured storage    │    │  • Frame processing queue   │
│                          │    │  • Detection callback       │
└──────────────────────────┘    └─────────┬───────────────────┘
                                          │
                                          │ RTSP Streams
                                          ▼
                         ┌────────────────────────────────────┐
                         │   Video Sources                    │
                         │  • IP Cameras (RTSP/ONVIF)         │
                         │  • VMS (Milestone, Genetec, etc.)  │
                         │  • Video Files (testing)           │
                         └────────────────────────────────────┘

           ┌─────────────────────────────────────────────────┐
           │        Cross-Cutting Infrastructure             │
           ├─────────────────────────────────────────────────┤
           │  • Structured Logging (JSON to stdout)          │
           │  • Correlation ID propagation                   │
           │  • OpenAPI/Swagger documentation                │
           │  • Health check endpoints                       │
           │  • Metrics collection                           │
           └─────────────────────────────────────────────────┘
```

### 3.2 Data Flow Patterns

#### 3.2.1 Citizen Report Submission Flow

```
[Mobile App] 
    │ 1. Submit report (title, desc, location, photo)
    │    POST /api/mobile/reports + API-Key header
    ▼
[API Gateway]
    │ 2. Validate API key, route to backend
    ▼
[Backend - Report Service]
    │ 3. Validate input, extract companyId from API key
    │ 4. Store report in MongoDB (companyId scoped)
    │ 5. If auto-event-creation enabled:
    │    a. Check for nearby events (500m, 15min)
    │    b. Link to existing event OR create new event
    ▼
[Backend - Event Service]
    │ 6. Update event with new report linkage
    │ 7. Broadcast event update via WebSocket
    ▼
[WebSocket Server]
    │ 8. Emit to company room
    ▼
[Web Dashboard]
    │ 9. Update UI: map marker, event list, notification
```

#### 3.2.2 AI Detection Flow

```
[IP Camera] ──RTSP Stream──▶ [AI Service]
                                  │ 1. Read frames from RTSP
                                  │ 2. YOLOv8 inference (person/vehicle)
                                  │ 3. Filter by confidence threshold
                                  │ 4. Debounce duplicate detections
                                  ▼
                            [AI Service - Detection Callback]
                                  │ 5. POST /api/ai/detection
                                  │    - cameraId, objectType, confidence
                                  │    - snapshot image (base64)
                                  │    - bounding box coordinates
                                  ▼
                            [Backend - Report Service]
                                  │ 6. Create camera-sourced report
                                  │ 7. Link to camera record
                                  │ 8. If auto-event-creation:
                                  │    - Find or create event
                                  ▼
                            [Backend - Event Service]
                                  │ 9. Update event, broadcast via WebSocket
                                  ▼
                            [Operator Dashboard]
                                  │ 10. Alert on map, notification toast
                                  │ 11. Operator reviews detection
                                  │ 12. Verifies or rejects report
```

#### 3.2.3 Video Playback Flow

```
[Operator] selects event at timestamp T
    │ 1. Request: GET /api/events/:id/video-playback
    │    - eventTimestamp, nearbyCamera IDs
    ▼
[Backend - Camera Service + VMS Adapter]
    │ 2. Query cameras within radius of event location
    │ 3. For each camera:
    │    a. Check VMS type (direct RTSP, Milestone, etc.)
    │    b. Call appropriate VMS adapter method
    │    c. Get playback URL for timestamp T
    ▼
[VMS Adapter]
    │ 4. Adapter generates authenticated URL or stream
    │    - Direct RTSP: rtsp://cam:port/playback?start=T
    │    - Milestone: API call → video export → temp URL
    │    - Genetec: API call → playback token → HLS stream
    ▼
[Backend Response]
    │ 5. Return array of playback sources to frontend
    │    [{ cameraId, name, playbackUrl, startTime }]
    ▼
[Web Dashboard Video Player]
    │ 6. Load video sources in multi-player view
    │ 7. Seek to timestamp T
    │ 8. Synchronized playback across cameras
```

---

## 4. Service Architecture

### 4.1 Backend Service Modules

The backend is organized as a modular monolith (MVP) with clear service boundaries for future microservices extraction.

#### 4.1.1 Auth Service

**Responsibilities:**
- User registration, login, logout
- JWT token generation and validation
- Password reset workflow
- API key validation
- Role-based permission checks

**Key Functions:**
- `register(email, password, role, companyId)`
- `login(email, password) → JWT`
- `validateToken(token) → user`
- `validateApiKey(apiKey) → company`
- `checkPermission(user, resource, action) → boolean`

**Dependencies:**
- Database: User collection
- External: Email/SMS service (for OTP)

#### 4.1.2 Company Service

**Responsibilities:**
- Company (tenant) creation and management
- Company settings configuration
- API key generation and rotation
- Usage tracking

**Key Functions:**
- `createCompany(data) → company`
- `updateSettings(companyId, settings)`
- `regenerateApiKey(companyId) → newApiKey`
- `getUsageStats(companyId) → stats`

**Dependencies:**
- Database: Company collection

#### 4.1.3 User Service

**Responsibilities:**
- User CRUD operations
- User profile management
- First responder location updates
- User search and filtering

**Key Functions:**
- `createUser(companyId, userData)`
- `updateLocation(userId, {lat, lon, timestamp})`
- `getUsersByCompany(companyId, filters)`
- `deactivateUser(userId)`

**Dependencies:**
- Database: User collection
- Auth Service: Role validation

#### 4.1.4 Camera Service

**Responsibilities:**
- Camera CRUD operations
- Camera status monitoring
- Live stream URL generation
- VMS integration coordination

**Key Functions:**
- `createCamera(companyId, cameraData)`
- `getCameraStream(cameraId) → streamUrl`
- `updateCameraStatus(cameraId, status)`
- `getCamerasNearLocation(location, radius) → cameras[]`

**Dependencies:**
- Database: Camera collection
- VMS Adapter: Video source access

#### 4.1.5 Event Service

**Responsibilities:**
- Event lifecycle management (create, update, close)
- Event-report aggregation
- Event assignment to responders
- Event filtering and search
- Audit trail management

**Key Functions:**
- `createEvent(companyId, eventData)`
- `linkReportToEvent(reportId, eventId)`
- `findOrCreateEventForReport(report) → event`
- `assignEvent(eventId, responderId)`
- `updateEventStatus(eventId, status, notes)`
- `getEventAuditTrail(eventId) → auditEntries[]`

**Dependencies:**
- Database: Event, Report collections
- Report Service: Report linkage
- WebSocket Service: Real-time broadcasts

#### 4.1.6 Report Service

**Responsibilities:**
- Report submission (citizen, camera, responder)
- Report attachment handling
- Report verification workflow
- Report search and filtering

**Key Functions:**
- `createCitizenReport(companyId, reportData, attachments)`
- `createCameraReport(cameraId, detectionData, snapshot)`
- `createResponderReport(userId, eventId, reportData)`
- `uploadAttachment(reportId, file) → attachmentUrl`
- `verifyReport(reportId, reviewerUserId, notes)`

**Dependencies:**
- Database: Report collection
- Storage Service: Media file handling
- Event Service: Auto-event creation

#### 4.1.7 EventType Service

**Responsibilities:**
- Event type taxonomy management
- System default types
- Company-specific custom types

**Key Functions:**
- `getEventTypes(companyId) → types[]` (system + company-specific)
- `createCustomEventType(companyId, typeData)`
- `updateEventType(typeId, updates)`

**Dependencies:**
- Database: EventType collection

### 4.2 Service Communication

**Synchronous (Function Calls)**: All services in modular monolith communicate via direct function calls with clear interfaces.

**Asynchronous (Events)**: Event Service emits domain events that WebSocket Service listens to for real-time broadcasts.

**Future Microservices**: Each service module designed with clear boundaries for extraction to separate microservices in Phase 2+.

---

## 5. Data Architecture

### 5.1 Database Design

**Database**: MongoDB (document-oriented, geo-spatial support)

**Design Principles:**
- Multi-tenant: All collections include `companyId` field
- Indexes: Compound indexes on `companyId` + frequently queried fields
- Geo-spatial: `location` fields use GeoJSON Point format with 2dsphere index
- Audit trail: Separate `audit_logs` collection for immutable history

### 5.2 Collections and Indexes

#### 5.2.1 Companies Collection

```javascript
{
  _id: ObjectId,
  name: String (unique),
  apiKey: String (unique, indexed),
  subscription: { plan: String, ... },
  settings: { timezone: String, ... },
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}

Indexes:
- apiKey (unique)
- name (unique)
```

#### 5.2.2 Users Collection

```javascript
{
  _id: ObjectId,
  companyId: ObjectId (indexed),
  email: String,
  phone: String,
  username: String,
  password: String (hashed),
  role: String (enum),
  isActive: Boolean,
  location: { type: "Point", coordinates: [lon, lat] }, // for responders
  deviceTokens: [String],
  createdAt: Date,
  updatedAt: Date
}

Indexes:
- { companyId: 1, email: 1 } (compound, unique)
- { companyId: 1, phone: 1 } (compound, unique)
- { companyId: 1, role: 1 }
- { location: "2dsphere" } // geo-spatial for responders
```

#### 5.2.3 Cameras Collection

```javascript
{
  _id: ObjectId,
  companyId: ObjectId (indexed),
  name: String,
  location: { type: "Point", coordinates: [lon, lat] },
  streamUrl: String,
  status: String (enum: online, offline, maintenance, error),
  aiConfig: {
    enabled: Boolean,
    detectionTypes: [String],
    confidenceThreshold: Number
  },
  vmsConfig: {
    vmsType: String (enum: direct, milestone, genetec),
    vmsConnectionId: String, // reference to VMS connection
    vmsMetadata: Object // VMS-specific data
  },
  lastOnline: Date,
  createdAt: Date,
  updatedAt: Date
}

Indexes:
- { companyId: 1, status: 1 }
- { location: "2dsphere" } // geo-spatial queries
- { companyId: 1, name: "text" } // text search
```

#### 5.2.4 Events Collection

```javascript
{
  _id: ObjectId,
  companyId: ObjectId (indexed),
  eventTypeId: ObjectId,
  title: String,
  description: String,
  location: { type: "Point", coordinates: [lon, lat] },
  status: String (enum: active, assigned, resolved, closed),
  priority: String (enum: low, medium, high, critical),
  assignedTo: ObjectId, // userId of responder
  reportIds: [ObjectId], // linked reports
  resolutionNotes: String,
  resolvedBy: ObjectId,
  resolvedAt: Date,
  createdAt: Date,
  updatedAt: Date
}

Indexes:
- { companyId: 1, status: 1, createdAt: -1 } (compound)
- { companyId: 1, priority: 1 }
- { companyId: 1, assignedTo: 1 }
- { location: "2dsphere" } // geo-spatial queries
- { title: "text", description: "text" } // text search
```

#### 5.2.5 Reports Collection

```javascript
{
  _id: ObjectId,
  companyId: ObjectId (indexed),
  eventId: ObjectId, // nullable initially, linked later
  reportType: String (enum: citizen, camera, responder),
  userId: ObjectId, // null if anonymous
  cameraId: ObjectId, // if camera report
  title: String,
  description: String,
  location: { type: "Point", coordinates: [lon, lat] },
  attachments: [{
    url: String,
    type: String (enum: image, video, audio),
    thumbnailUrl: String,
    metadata: Object
  }],
  confidence: Number, // for camera reports
  detectionMetadata: Object, // for camera reports
  status: String (enum: submitted, under_review, verified, rejected),
  reviewedBy: ObjectId,
  reviewNotes: String,
  createdAt: Date,
  updatedAt: Date
}

Indexes:
- { companyId: 1, eventId: 1 }
- { companyId: 1, reportType: 1, createdAt: -1 }
- { companyId: 1, userId: 1 } // user's reports
- { companyId: 1, cameraId: 1 } // camera's reports
- { location: "2dsphere" } // geo-spatial queries
- { createdAt: -1 } // time-based queries
```

#### 5.2.6 EventTypes Collection

```javascript
{
  _id: ObjectId,
  companyId: ObjectId, // null for system defaults
  name: String,
  description: String,
  icon: String,
  color: String,
  defaultPriority: String,
  isActive: Boolean,
  isSystemDefault: Boolean,
  createdAt: Date,
  updatedAt: Date
}

Indexes:
- { companyId: 1, isActive: 1 }
- { isSystemDefault: 1 }
```

#### 5.2.7 AuditLogs Collection

```javascript
{
  _id: ObjectId,
  companyId: ObjectId (indexed),
  userId: ObjectId,
  correlationId: String (indexed),
  action: String, // e.g., "event.status.updated"
  resourceType: String, // e.g., "event"
  resourceId: ObjectId,
  oldValue: Object, // previous state
  newValue: Object, // new state
  metadata: Object, // additional context
  timestamp: Date,
  ipAddress: String // anonymized
}

Indexes:
- { companyId: 1, timestamp: -1 }
- { resourceType: 1, resourceId: 1, timestamp: -1 }
- { correlationId: 1 }
- { userId: 1, timestamp: -1 }
```

### 5.3 Data Access Patterns

**Tenant Isolation**: Every query automatically filters by `companyId` via Mongoose middleware or query wrapper.

**Geo-spatial Queries**: Use MongoDB's `$near` or `$geoWithin` operators with 2dsphere indexes for:
- Finding cameras near event location
- Finding nearby events for report aggregation
- Finding responders near incident

**Audit Trail**: Append-only writes to `audit_logs` collection on every data modification.

---

## 6. Video Architecture

### 6.1 Video Management System (VMS) Adapter Pattern

To support multiple video sources (direct cameras, VMS systems), we use an **Adapter Pattern**.

#### 6.1.1 VMS Adapter Interface

```typescript
interface VMSAdapter {
  // Get live stream URL for web viewing
  getLiveStreamUrl(cameraId: string): Promise<string>;
  
  // Get historical video playback URL for specific timestamp
  getPlaybackUrl(cameraId: string, startTime: Date, endTime?: Date): Promise<string>;
  
  // Get snapshot image at specific timestamp
  getSnapshot(cameraId: string, timestamp: Date): Promise<Buffer>;
  
  // Check camera status
  getCameraStatus(cameraId: string): Promise<CameraStatus>;
  
  // Export video clip (if supported)
  exportClip?(cameraId: string, startTime: Date, endTime: Date): Promise<string>;
}
```

#### 6.1.2 Adapter Implementations

**DirectRTSPAdapter** (MVP):
- Connects directly to IP cameras via RTSP
- Live stream: Transcodes RTSP to HLS using FFmpeg
- Playback: Not supported (cameras don't store video)
- Use case: Small deployments without VMS

**MilestoneAdapter** (Phase 2):
- Integrates with Milestone XProtect VMS API
- Live stream: Requests live stream URL from Milestone API
- Playback: Requests video export for time range, gets download URL
- Authentication: Uses Milestone API token

**GenetecAdapter** (Phase 2):
- Integrates with Genetec Security Center API
- Similar pattern to Milestone

**FileBasedAdapter** (Testing):
- Reads video files from filesystem
- Used for development and testing

#### 6.1.3 VMS Configuration

Each camera record includes `vmsConfig`:

```javascript
vmsConfig: {
  vmsType: "direct" | "milestone" | "genetec",
  vmsConnectionId: "abc-123", // Reference to VMS connection config
  vmsMetadata: {
    // VMS-specific fields
    // For Milestone: { cameraGuid, serverUrl }
    // For Genetec: { cameraId, serverHost }
  }
}
```

VMS connection credentials stored separately (encrypted):

```javascript
// vms_connections collection
{
  _id: ObjectId,
  companyId: ObjectId,
  vmsType: String,
  name: String,
  host: String,
  credentials: {
    username: String (encrypted),
    password: String (encrypted),
    apiToken: String (encrypted)
  }
}
```

### 6.2 Video Streaming Pipeline

#### 6.2.1 Live Streaming

```
[IP Camera]
   │ RTSP stream
   ▼
[FFmpeg Process]
   │ Transcode to HLS
   ▼
[Nginx - HLS Server]
   │ Serve .m3u8 and .ts files
   ▼
[Web Browser - HLS.js player]
```

**Implementation Details:**
- FFmpeg spawned as child process per camera
- HLS segments (2-4 seconds each) written to temp directory
- Nginx serves HLS files with CORS headers
- Client-side: HLS.js for browser playback
- Adaptive bitrate: Multiple quality levels (Phase 2)

#### 6.2.2 Historical Playback

```
[VMS / Camera Storage]
   │ Video recording
   ▼
[VMS Adapter]
   │ Get playback URL or export video
   ▼
[Nginx or VMS Server]
   │ Serve video file or stream
   ▼
[Web Browser - Video.js player]
```

**Time Alignment:**
- Event has `createdAt` timestamp
- Operator selects "View video at event time"
- Backend calculates `startTime = eventTime - 30sec`, `endTime = eventTime + 5min`
- VMS adapter retrieves playback URL for time range
- Frontend video player seeks to event timestamp

### 6.3 Video Processing (AI Service)

```
[RTSP Camera Stream]
   │
   ▼
[OpenCV - Frame Capture]
   │ Read frames at 5-10 FPS
   ▼
[Frame Queue]
   │ Buffer frames for processing
   ▼
[YOLOv8 Inference]
   │ Detect objects (person, vehicle)
   ▼
[Detection Filter]
   │ Apply confidence threshold
   │ Debounce duplicates
   ▼
[Detection Callback]
   │ POST to backend API
   │ Include snapshot (JPEG encoded)
```

**Optimizations:**
- Frame skipping during high load
- Batch processing (multiple frames per inference)
- GPU acceleration (CUDA) when available
- Multiple camera processing: One thread per camera or thread pool

---

## 7. Real-Time Architecture

### 7.1 WebSocket Implementation

**Technology**: Socket.io (WebSocket with fallback)

**Server Structure:**

```javascript
// WebSocket server (Socket.io)
io.on('connection', (socket) => {
  // 1. Authenticate socket connection
  const token = socket.handshake.auth.token;
  const user = validateJWT(token);
  
  // 2. Join company-specific room (tenant isolation)
  socket.join(`company:${user.companyId}`);
  
  // 3. Set up event listeners
  socket.on('location:update', (data) => {
    // Handle responder location update
    updateUserLocation(user.id, data.location);
    // Broadcast to company room
    io.to(`company:${user.companyId}`).emit('responder:moved', {
      userId: user.id,
      location: data.location
    });
  });
  
  socket.on('disconnect', () => {
    // Cleanup
  });
});
```

### 7.2 Real-Time Event Broadcasting

**Event Service → WebSocket Integration:**

```javascript
// Event Service emits domain events
class EventService {
  async createEvent(data) {
    const event = await Event.create(data);
    
    // Emit domain event
    eventEmitter.emit('event:created', {
      companyId: event.companyId,
      event: event.toJSON()
    });
    
    return event;
  }
}

// WebSocket service listens to domain events
eventEmitter.on('event:created', ({ companyId, event }) => {
  io.to(`company:${companyId}`).emit('event:new', event);
});

eventEmitter.on('event:updated', ({ companyId, event }) => {
  io.to(`company:${companyId}`).emit('event:updated', event);
});
```

### 7.3 Client-Side WebSocket Handling

```javascript
// Frontend WebSocket connection
const socket = io('wss://api.example.com', {
  auth: { token: jwtToken }
});

socket.on('connect', () => {
  console.log('Connected to real-time server');
});

socket.on('event:new', (event) => {
  // Add event to local state
  dispatch(addEvent(event));
  
  // Show notification
  showNotification(`New ${event.priority} event: ${event.title}`);
  
  // Update map marker
  addMarkerToMap(event);
});

socket.on('responder:moved', ({ userId, location }) => {
  // Update responder marker position on map
  updateMarkerPosition(userId, location);
});

socket.on('disconnect', () => {
  // Attempt reconnection (Socket.io handles automatically)
});
```

### 7.4 Scalability Considerations

**Current (MVP)**:
- Single Socket.io server instance
- In-memory rooms and connections
- Suitable for 100 concurrent users

**Future (Phase 2+)**:
- Multiple Socket.io instances behind load balancer
- Redis adapter for distributed rooms/events
- Sticky sessions via Nginx (client always connects to same instance)

---

## 8. Integration Architecture

### 8.1 External Service Integrations

#### 8.1.1 Map Provider Integration

**Primary**: OpenStreetMap with Leaflet.js (MVP)
**Secondary**: Mapbox GL JS (Phase 2)

```javascript
// Map initialization
const map = L.map('map').setView([lat, lon], zoom);

// Base tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Add camera markers
cameras.forEach(camera => {
  L.marker([camera.location.coordinates[1], camera.location.coordinates[0]], {
    icon: cameraIcon,
    title: camera.name
  }).addTo(map).on('click', () => openCameraView(camera.id));
});
```

**Geocoding**: OpenStreetMap Nominatim API for address search

#### 8.1.2 File Storage Integration

**MVP**: Local filesystem
- Uploads stored in `/data/uploads/{companyId}/{reportId}/`
- Served by Nginx with authentication check

**Phase 2**: S3-compatible storage (AWS S3, MinIO)
- Pre-signed URLs for secure direct access
- Lifecycle policies for automatic cleanup

```javascript
// File upload handling
const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const path = `/data/uploads/${req.user.companyId}/${req.params.reportId}`;
    cb(null, path);
  },
  filename: (req, file, cb) => {
    const filename = `${Date.now()}-${file.originalname}`;
    cb(null, filename);
  }
});
```

#### 8.1.3 Notification Services (Phase 2)

**Push Notifications**:
- Firebase Cloud Messaging (FCM) for Android
- Apple Push Notification Service (APNS) for iOS

**Integration Pattern**:
```javascript
// Device token registration
async function registerDeviceToken(userId, token, platform) {
  await User.updateOne(
    { _id: userId },
    { $addToSet: { deviceTokens: { token, platform } } }
  );
}

// Send notification
async function sendPushNotification(userId, notification) {
  const user = await User.findById(userId);
  for (const device of user.deviceTokens) {
    if (device.platform === 'ios') {
      await apns.send(device.token, notification);
    } else {
      await fcm.send(device.token, notification);
    }
  }
}
```

### 8.2 API Design Patterns

#### 8.2.1 REST API Structure

**Base URL**: `https://api.example.com/api/v1`

**Naming Conventions**:
- Resources: Plural nouns (`/events`, `/cameras`)
- Actions: HTTP verbs (GET, POST, PUT, DELETE)
- Nested resources: `/events/:eventId/reports`

**Response Format**:
```json
{
  "success": true,
  "data": { /* resource or array */ },
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 150
  },
  "correlationId": "uuid-v4"
}
```

**Error Format**:
```json
{
  "success": false,
  "error": {
    "code": "EVENT_NOT_FOUND",
    "message": "Event with ID 123 not found",
    "details": { /* additional context */ }
  },
  "correlationId": "uuid-v4"
}
```

#### 8.2.2 Authentication Middleware

```javascript
// JWT authentication middleware
async function authenticateJWT(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No token provided' }
    });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(decoded.userId);
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Token invalid or expired' }
    });
  }
}

// API key authentication middleware (for mobile apps)
async function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No API key provided' }
    });
  }
  
  const company = await Company.findOne({ apiKey });
  if (!company || !company.isActive) {
    return res.status(401).json({
      success: false,
      error: { code: 'INVALID_API_KEY', message: 'Invalid or inactive API key' }
    });
  }
  
  req.company = company;
  next();
}
```

#### 8.2.3 Tenant Isolation Middleware

```javascript
// Ensure all queries scoped to user's company
function tenantIsolation(req, res, next) {
  // Add companyId to all queries automatically
  const originalFind = req.db.collection.find;
  req.db.collection.find = function(query, ...args) {
    query.companyId = req.user.companyId;
    return originalFind.call(this, query, ...args);
  };
  
  next();
}
```

---

## 9. Observability Architecture

### 9.1 Structured Logging

**Format**: JSON logs written to stdout (captured by Docker)

**Log Schema**:
```json
{
  "timestamp": "2026-01-12T10:30:00.000Z",
  "level": "INFO",
  "service": "backend-api",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "60d5ec49f1b2c8b1f8c1e4a1",
  "companyId": "60d5ec49f1b2c8b1f8c1e4a0",
  "message": "Event created",
  "context": {
    "eventId": "60d5ec49f1b2c8b1f8c1e4a2",
    "eventType": "intrusion",
    "priority": "high"
  }
}
```

**Implementation**:
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Usage
logger.info('Event created', {
  correlationId: req.correlationId,
  userId: req.user.id,
  companyId: req.user.companyId,
  context: { eventId: event.id, eventType: event.type }
});
```

### 9.2 Correlation ID Propagation

**Generation**: UUID v4 generated for each API request

**Propagation**:
1. API Gateway generates or extracts `X-Correlation-ID` header
2. Backend attaches to `req.correlationId`
3. All log entries include `correlationId`
4. All downstream calls include `X-Correlation-ID` header
5. Response includes `X-Correlation-ID` header

```javascript
// Middleware to generate/extract correlation ID
function correlationIdMiddleware(req, res, next) {
  req.correlationId = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('X-Correlation-ID', req.correlationId);
  next();
}
```

### 9.3 Audit Trail

**Audit Log Service**:
```javascript
class AuditLogService {
  async log(action, resourceType, resourceId, oldValue, newValue, metadata) {
    await AuditLog.create({
      companyId: metadata.companyId,
      userId: metadata.userId,
      correlationId: metadata.correlationId,
      action,
      resourceType,
      resourceId,
      oldValue,
      newValue,
      metadata,
      timestamp: new Date()
    });
  }
}

// Usage in Event Service
async updateEventStatus(eventId, newStatus, userId) {
  const event = await Event.findById(eventId);
  const oldStatus = event.status;
  
  event.status = newStatus;
  event.updatedBy = userId;
  await event.save();
  
  // Log to audit trail
  await auditLogService.log(
    'event.status.updated',
    'event',
    eventId,
    { status: oldStatus },
    { status: newStatus },
    { companyId: event.companyId, userId, correlationId: req.correlationId }
  );
}
```

### 9.4 Metrics and Monitoring

**Health Check Endpoints**:
```javascript
// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: mongoClient.isConnected() ? 'up' : 'down',
      redis: redisClient.ping() ? 'up' : 'down'
    }
  });
});

// Readiness check
app.get('/ready', async (req, res) => {
  const isReady = await checkAllDependencies();
  res.status(isReady ? 200 : 503).json({ ready: isReady });
});
```

**Metrics Exposed** (Phase 2):
- HTTP request count, duration (by endpoint, status)
- WebSocket connection count
- Database query count, duration
- AI detection count, inference time
- Event creation rate
- Report submission rate

**Monitoring Stack** (Phase 2):
- Prometheus for metrics collection
- Grafana for dashboards
- Alertmanager for alerting

---

## 10. Testing Architecture

### 10.1 Testing Strategy

**Test Pyramid**:
```
         ┌─────────────────┐
         │   E2E Tests     │  (Few, critical flows)
         │   (Cypress)     │
         └─────────────────┘
       ┌───────────────────────┐
       │  Integration Tests    │  (API, DB, services)
       │  (Jest + Supertest)   │
       └───────────────────────┘
  ┌─────────────────────────────────┐
  │      Unit Tests                 │  (Functions, components)
  │      (Jest + RTL)               │
  └─────────────────────────────────┘
```

### 10.2 Unit Testing

**Backend (Jest)**:
```javascript
// Example: Event Service unit test
describe('EventService', () => {
  describe('createEvent', () => {
    it('should create event with required fields', async () => {
      const eventData = {
        companyId: 'company-123',
        eventTypeId: 'type-456',
        title: 'Test Event',
        location: { type: 'Point', coordinates: [-122.4, 37.8] }
      };
      
      const event = await eventService.createEvent(eventData);
      
      expect(event).toBeDefined();
      expect(event.companyId).toBe('company-123');
      expect(event.status).toBe('active');
    });
    
    it('should emit event:created domain event', async () => {
      const eventEmitterSpy = jest.spyOn(eventEmitter, 'emit');
      
      await eventService.createEvent({ /* data */ });
      
      expect(eventEmitterSpy).toHaveBeenCalledWith('event:created', expect.any(Object));
    });
  });
});
```

**Frontend (Jest + React Testing Library)**:
```javascript
// Example: EventList component test
import { render, screen } from '@testing-library/react';
import EventList from './EventList';

test('renders event list with events', () => {
  const events = [
    { id: '1', title: 'Event 1', priority: 'high' },
    { id: '2', title: 'Event 2', priority: 'medium' }
  ];
  
  render(<EventList events={events} />);
  
  expect(screen.getByText('Event 1')).toBeInTheDocument();
  expect(screen.getByText('Event 2')).toBeInTheDocument();
});
```

### 10.3 Integration Testing

**API Integration Tests (Supertest)**:
```javascript
describe('POST /api/events', () => {
  it('should create new event with valid data', async () => {
    const token = await getAuthToken();
    
    const response = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${token}`)
      .send({
        eventTypeId: 'type-123',
        title: 'Test Event',
        location: { type: 'Point', coordinates: [-122.4, 37.8] }
      });
    
    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.title).toBe('Test Event');
  });
  
  it('should return 403 for unauthorized user', async () => {
    const citizenToken = await getCitizenToken();
    
    const response = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${citizenToken}`)
      .send({ /* data */ });
    
    expect(response.status).toBe(403);
  });
});
```

**Database Integration Tests**:
```javascript
beforeEach(async () => {
  // Clear database and seed test data
  await clearDatabase();
  await seedTestData();
});

describe('Event.findNearby', () => {
  it('should find events within 500m radius', async () => {
    const location = { type: 'Point', coordinates: [-122.4, 37.8] };
    const events = await Event.findNearby(location, 500);
    
    expect(events).toHaveLength(2);
    expect(events[0].distance).toBeLessThan(500);
  });
});
```

### 10.4 API Contract Testing

**OpenAPI Specification Validation**:
```javascript
const OpenAPIValidator = require('express-openapi-validator');

// Middleware to validate requests/responses against OpenAPI spec
app.use(
  OpenAPIValidator.middleware({
    apiSpec: './openapi.yaml',
    validateRequests: true,
    validateResponses: true
  })
);
```

**Contract Test**:
```javascript
describe('API Contract', () => {
  it('should match OpenAPI spec for GET /api/events', async () => {
    const response = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${token}`);
    
    // Response validated automatically by OpenAPIValidator middleware
    expect(response.status).toBe(200);
  });
});
```

### 10.5 End-to-End Testing (Phase 2)

**Cypress Tests**:
```javascript
describe('Citizen Report Submission Flow', () => {
  it('should allow citizen to submit report with photo', () => {
    cy.login('citizen@example.com', 'password');
    
    cy.visit('/mobile/report/new');
    
    cy.get('input[name="title"]').type('Suspicious activity');
    cy.get('textarea[name="description"]').type('Person loitering near entrance');
    
    cy.get('input[type="file"]').attachFile('test-image.jpg');
    
    cy.get('button[type="submit"]').click();
    
    cy.contains('Report submitted successfully');
  });
});
```

---

## 11. Deployment Architecture

### 11.1 Containerization

**Dockerfile Structure**:

```dockerfile
# Backend API Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

USER node
EXPOSE 5000
CMD ["node", "dist/index.js"]
```

```dockerfile
# AI Service Dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

USER nobody
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 11.2 Docker Compose (MVP Deployment)

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - ./frontend/build:/usr/share/nginx/html:ro
    depends_on:
      - backend
    networks:
      - app-network

  backend:
    build: ./backend
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/empdb
      - JWT_SECRET=${JWT_SECRET}
      - PORT=5000
    volumes:
      - uploads:/data/uploads
    depends_on:
      - mongo
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  ai-service:
    build: ./ai-service
    environment:
      - BACKEND_API_URL=http://backend:5000
      - MODEL_PATH=/models/yolov8n.pt
    volumes:
      - models:/models
    depends_on:
      - backend
    networks:
      - app-network
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

  mongo:
    image: mongo:5.0
    environment:
      - MONGO_INITDB_ROOT_USERNAME=${MONGO_USER}
      - MONGO_INITDB_ROOT_PASSWORD=${MONGO_PASSWORD}
    volumes:
      - mongo-data:/data/db
    networks:
      - app-network
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongo --quiet
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  mongo-data:
  uploads:
  models:

networks:
  app-network:
    driver: bridge
```

### 11.3 Deployment Process

**CI/CD Pipeline** (GitHub Actions example):

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run tests
        run: |
          npm ci
          npm test
          npm run test:integration

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build Docker images
        run: docker-compose build
      - name: Push to registry
        run: docker-compose push

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          ssh user@server 'cd /app && docker-compose pull && docker-compose up -d'
```

### 11.4 Environment Configuration

**.env file structure**:
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/empdb
MONGO_USER=admin
MONGO_PASSWORD=secure_password

# Backend
NODE_ENV=production
PORT=5000
JWT_SECRET=your-256-bit-secret
JWT_EXPIRATION=24h

# AI Service
AI_SERVICE_URL=http://ai-service:8000
MODEL_PATH=/models/yolov8n.pt

# Storage
UPLOAD_DIR=/data/uploads
MAX_FILE_SIZE=10485760

# External Services
MAP_PROVIDER=openstreetmap
SMTP_HOST=smtp.example.com
SMTP_PORT=587
```

---

## 12. Security Architecture

### 12.1 Authentication Flow

```
[Client] 
   │ 1. POST /api/auth/login (email, password)
   ▼
[Backend - Auth Service]
   │ 2. Validate credentials
   │ 3. Generate JWT (payload: userId, companyId, role)
   │ 4. Generate refresh token (store in DB)
   ▼
[Client]
   │ 5. Store JWT in memory (not localStorage)
   │ 6. Store refresh token in httpOnly cookie
   │ 7. Include JWT in Authorization header for API calls
   ▼
[Backend - Auth Middleware]
   │ 8. Validate JWT signature and expiration
   │ 9. Extract user from token
   │ 10. Attach user to request context
```

### 12.2 Authorization Flow

```
[Request] → [Auth Middleware] → [Permission Middleware] → [Route Handler]
               │                      │
               │                      └─→ Check user role + resource ownership
               │
               └─→ Verify JWT and extract user
```

**Permission Middleware**:
```javascript
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' }
      });
    }
    next();
  };
}

// Usage
app.post('/api/events', authenticateJWT, requireRole('operator', 'admin'), createEvent);
```

### 12.3 Data Security

**Encryption at Rest**:
- MongoDB: Encrypted storage engine (WiredTiger)
- Passwords: bcrypt hashing (10 rounds)
- API keys: hashed before storage
- Sensitive config: Environment variables or secrets manager

**Encryption in Transit**:
- TLS 1.2+ for all connections
- Certificate management via Let's Encrypt or enterprise CA

**Input Sanitization**:
```javascript
const { body, query, param } = require('express-validator');

// Route with validation
app.post('/api/events',
  [
    body('title').trim().isLength({ min: 3, max: 200 }),
    body('description').trim().isLength({ max: 2000 }),
    body('location.coordinates').isArray({ min: 2, max: 2 }),
    body('location.coordinates.*').isFloat()
  ],
  handleValidationErrors,
  createEvent
);
```

### 12.4 Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many requests, please try again later'
});

// Strict limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 attempts
  message: 'Too many login attempts, please try again later'
});

app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
```

### 12.5 Security Headers

```javascript
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

---

## Appendix A: Technology Decision Log

| Decision | Technology | Rationale | Alternatives Considered |
|----------|------------|-----------|-------------------------|
| Backend Runtime | Node.js + TypeScript | Async I/O for real-time, strong ecosystem, type safety | Python (slower for I/O), Go (less ecosystem) |
| Database | MongoDB | Document model, geo-spatial, flexible schema, required | PostgreSQL (relational overhead) |
| Frontend | React + TypeScript | Component-based, huge ecosystem, required | Vue, Angular |
| Real-Time | Socket.io | WebSocket with fallbacks, rooms, reconnection | Native WebSocket (no fallback), SockJS |
| Video Transcoding | FFmpeg | Industry standard, wide format support | GStreamer (more complex) |
| AI Framework | YOLOv8 | State-of-art accuracy/speed, Python ecosystem | SSD, Faster R-CNN (older) |
| API Docs | OpenAPI/Swagger | Standard, tooling support, contract testing | API Blueprint, RAML |

---

## Appendix B: Scaling Strategies (Phase 2+)

### Horizontal Scaling

**Backend API**:
- Multiple instances behind Nginx load balancer
- Stateless design (JWT, no sessions in memory)
- Redis for distributed caching

**WebSocket**:
- Multiple Socket.io instances with Redis adapter
- Sticky sessions via Nginx ip_hash

**AI Service**:
- Multiple instances per camera or camera pool
- Queue-based task distribution (RabbitMQ/Redis Queue)

**Database**:
- Read replicas for query scaling
- Sharding by companyId for write scaling

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-12 | AI-Assisted | Initial architecture document |
| 2.0 | 2026-01-12 | AI-Assisted | Refactored: added VMS adapter, logging/testing architecture, detailed video flow |

---

*This document defines the technical architecture of the Event Monitoring and Management Platform. All implementation must follow these architectural decisions and patterns.*
