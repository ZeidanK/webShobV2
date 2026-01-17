# WebSocket Events Documentation

**Version**: 1.0  
**Last Updated**: January 12, 2026  
**Slice**: 5 - Real-Time Foundation

---

## Overview

The Event Monitoring Platform uses WebSocket (Socket.IO) for real-time bidirectional communication between the backend and frontend clients. This enables instant updates for events, reports, and system changes without polling.

---

## Connection

### Endpoint
```
ws://localhost:3000 (development)
wss://your-domain.com (production)
```

### Authentication

WebSocket connections require JWT authentication. Provide the token in one of two ways:

**Option 1: Auth Object (Recommended)**
```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: '<JWT_TOKEN>'
  }
});
```

**Option 2: Authorization Header**
```javascript
const socket = io('http://localhost:3000', {
  extraHeaders: {
    'Authorization': 'Bearer <JWT_TOKEN>'
  }
});
```

### Connection Options

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: jwtToken },
  transports: ['websocket', 'polling'],  // Prefer WebSocket, fallback to polling
  reconnection: true,                    // Auto-reconnect enabled
  reconnectionDelay: 1000,               // Start with 1s delay
  reconnectionDelayMax: 5000,            // Max 5s between attempts
  reconnectionAttempts: 10,              // Try 10 times before giving up
});
```

---

## Connection Events

### `connect`
Emitted when successfully connected to server.

**Client Handler:**
```javascript
socket.on('connect', () => {
  console.log('Connected:', socket.id);
});
```

### `disconnect`
Emitted when disconnected from server.

**Client Handler:**
```javascript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // Reasons: 'io server disconnect', 'io client disconnect', 'ping timeout', 'transport close', 'transport error'
});
```

### `connect_error`
Emitted when connection fails (e.g., authentication error).

**Client Handler:**
```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
  // Common errors: 'AUTHENTICATION_REQUIRED', 'INVALID_USER', 'jwt malformed'
});
```

### `reconnect`
Emitted when successfully reconnected after disconnect.

**Client Handler:**
```javascript
socket.on('reconnect', (attemptNumber) => {
  console.log('Reconnected after', attemptNumber, 'attempts');
});
```

### `join:company`
Emitted by server after client successfully joins their company room.

**Server → Client:**
```json
{
  "success": true,
  "companyId": "507f1f77bcf86cd799439011",
  "connectionCount": 5
}
```

**Client Handler:**
```javascript
socket.on('join:company', (data) => {
  console.log('Joined company room:', data.companyId);
  console.log('Active connections:', data.connectionCount);
});
```

---

## Real-Time Data Events

### `event:created`
Emitted when a new Event is created in the company.

**Server → Client:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "Suspicious Activity Reported",
  "description": "Multiple reports of suspicious person near Main St",
  "status": "active",
  "priority": "high",
  "eventTypeId": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Suspicious Activity",
    "color": "#ff5722"
  },
  "location": {
    "type": "Point",
    "coordinates": [-73.935242, 40.730610]
  },
  "locationDescription": "Near Main St and 5th Ave",
  "createdBy": {
    "_id": "507f1f77bcf86cd799439013",
    "firstName": "John",
    "lastName": "Operator"
  },
  "reportIds": ["507f1f77bcf86cd799439014", "507f1f77bcf86cd799439015"],
  "createdAt": "2026-01-12T10:30:00.000Z",
  "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Client Handler:**
```javascript
socket.on('event:created', (event) => {
  console.log('New event created:', event.title);
  // Update UI: add to event list, show notification, etc.
});
```

### `event:updated`
Emitted when an Event is updated (fields changed, status transition, assignment).

**Server → Client:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "title": "Suspicious Activity Reported",
  "status": "assigned",
  "priority": "high",
  "assignedTo": {
    "_id": "507f1f77bcf86cd799439016",
    "firstName": "Jane",
    "lastName": "Responder"
  },
  "updatedAt": "2026-01-12T10:35:00.000Z",
  "changes": {
    "status": {
      "from": "active",
      "to": "assigned"
    }
  },
  "correlationId": "b2c3d4e5-f6a7-8901-bcde-f12345678901"
}
```

**Client Handler:**
```javascript
socket.on('event:updated', (event) => {
  console.log('Event updated:', event._id);
  // Update UI: refresh event detail, update list item, show notification
});
```

### `report:created`
Emitted when a new Report is submitted to the company.

**Server → Client:**
```json
{
  "_id": "507f1f77bcf86cd799439020",
  "title": "Broken Street Light",
  "description": "Street light out on Main St",
  "type": "citizen",
  "status": "pending",
  "source": "citizen",
  "location": {
    "type": "Point",
    "coordinates": [-73.935242, 40.730610]
  },
  "locationDescription": "Main St near 5th Ave",
  "reportedBy": {
    "_id": "507f1f77bcf86cd799439021",
    "firstName": "Alice",
    "lastName": "Citizen"
  },
  "reporterName": "Alice Citizen",
  "createdAt": "2026-01-12T10:25:00.000Z",
  "correlationId": "c3d4e5f6-a7b8-9012-cdef-123456789012"
}
```

**Client Handler:**
```javascript
socket.on('report:created', (report) => {
  console.log('New report submitted:', report.title);
  // Update UI: add to report list, show notification, update map
});
```

---

## Company Room Isolation

**CRITICAL**: All broadcasts are scoped to company-specific rooms. Clients automatically join their company room upon connection and only receive broadcasts for their own company.

### Room Naming Convention
```
company:<companyId>
```

Example: `company:507f1f77bcf86cd799439011`

### Multi-Tenant Guarantee
- Client A (Company 1) will NEVER receive events for Company 2
- Each WebSocket connection is authenticated and assigned to exactly one company room
- Server validates `companyId` from JWT and joins socket to `company:<companyId>` room
- All broadcasts are sent to room: `io.to('company:<companyId>').emit(event, data)`

---

## Error Handling

### Authentication Errors

**Missing Token**
```javascript
socket.on('connect_error', (error) => {
  if (error.message === 'AUTHENTICATION_REQUIRED') {
    // Redirect to login or prompt for credentials
  }
});
```

**Invalid Token**
```javascript
socket.on('connect_error', (error) => {
  if (error.message.includes('jwt')) {
    // Token expired or malformed - refresh token or re-login
  }
});
```

**Invalid User**
```javascript
socket.on('connect_error', (error) => {
  if (error.message === 'INVALID_USER') {
    // User no longer exists or is inactive
  }
});
```

### Disconnection Handling

```javascript
socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    // Server forcefully disconnected (auth revoked, etc.)
    // Do NOT auto-reconnect - require re-authentication
  } else if (reason === 'ping timeout' || reason === 'transport close') {
    // Network issue - auto-reconnect will handle
  }
});
```

---

## Frontend Integration Example

### React Hook
```typescript
import { useEffect } from 'react';
import { websocketService, WebSocketEvent } from '../services/websocket';

export function useEventCreated(callback: (event: any) => void) {
  useEffect(() => {
    const unsubscribe = websocketService.on(
      WebSocketEvent.EVENT_CREATED, 
      callback
    );
    return unsubscribe;
  }, [callback]);
}

// Usage in component
function EventsPage() {
  useEventCreated((event) => {
    console.log('New event:', event);
    // Update state, show notification, etc.
  });
  
  return <div>Events Page</div>;
}
```

### Connection Management
```typescript
// On login
const token = localStorage.getItem('accessToken');
if (token) {
  websocketService.connect(token);
}

// On logout
websocketService.disconnect();
```

---

## Backend Broadcasting Examples

### From Service Layer
```typescript
import { websocketService } from '../services/websocket.service';

// Broadcast new event
websocketService.broadcastEventCreated(companyId, {
  _id: event._id,
  title: event.title,
  status: event.status,
  // ... other fields
  correlationId,
});

// Broadcast event update
websocketService.broadcastEventUpdated(companyId, {
  _id: event._id,
  status: event.status,
  changes: { ... },
  correlationId,
});

// Broadcast new report
websocketService.broadcastReportCreated(companyId, {
  _id: report._id,
  title: report.title,
  type: report.type,
  // ... other fields
  correlationId,
});
```

---

## Logging

All WebSocket events are logged with structured logging:

```json
{
  "timestamp": "2026-01-12T10:30:00.000Z",
  "level": "INFO",
  "service": "backend-api",
  "action": "websocket.connection.established",
  "correlationId": "...",
  "context": {
    "socketId": "abc123xyz",
    "userId": "507f1f77bcf86cd799439011",
    "companyId": "507f1f77bcf86cd799439012",
    "role": "operator"
  }
}
```

### Logged Events
- `websocket.initialized` - Server started
- `websocket.connection.established` - Client connected
- `websocket.room.joined` - Client joined company room
- `websocket.connection.disconnected` - Client disconnected
- `websocket.broadcast.sent` - Event broadcast to room
- `websocket.auth.failed` - Authentication failure
- `websocket.connection.error` - Connection error

---

## Performance Considerations

### Connection Limits
- No hard limit per company (scales with infrastructure)
- Each connection consumes ~1KB memory + socket overhead
- Typical deployment: 1000-5000 concurrent connections per server

### Message Size
- Keep broadcast payloads minimal (<10KB recommended)
- Avoid sending large attachments or images via WebSocket
- Use REST API for bulk data, WebSocket for notifications

### Reconnection Strategy
- Exponential backoff: 1s → 2s → 4s → 5s (max)
- Max 10 attempts, then give up
- Client must handle reconnection failure (e.g., show offline banner)

---

## Security

### Authentication
- JWT required for all connections
- Token validated on initial connection
- No re-authentication required during session (unless server disconnect)

### Authorization
- Company room isolation enforced at server
- Cannot subscribe to other companies' events
- Cannot emit custom events (server-to-client only)

### Rate Limiting
- Standard HTTP rate limits do NOT apply to WebSocket
- Future: implement per-connection broadcast rate limit if needed

---

## Testing

### Manual Testing with `socket.io-client`
```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:3000', {
  auth: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('connect', () => {
  console.log('Connected');
});

socket.on('event:created', (data) => {
  console.log('Event created:', data);
});
```

### Integration Tests
See `backend/src/services/websocket.service.test.ts` for examples:
- Connection with JWT
- Company room isolation
- Event broadcast reception
- Connection tracking

---

## Future Enhancements (Not in Slice 5)

- **Slice 6**: Location tracking broadcasts (`responder:location`)
- **Slice 7**: Push notification integration
- **Slice 9**: Chat/messaging events
- **Slice 10**: Video stream status updates

---

## Troubleshooting

### Client not receiving events
1. Check WebSocket connection status: `socket.connected`
2. Verify JWT token is valid and not expired
3. Confirm `companyId` in JWT matches event's company
4. Check browser console for `connect_error` events
5. Verify server logs for `websocket.broadcast.sent`

### Authentication failures
1. Ensure JWT token is passed in `auth.token` or `Authorization` header
2. Check token expiration (`exp` claim)
3. Verify user still exists and `isActive = true`
4. Check server logs for `websocket.auth.failed` with error details

### Reconnection issues
1. Check network connectivity
2. Verify server is running and accessible
3. Check `reconnectionAttempts` and `reconnectionDelayMax` settings
4. Monitor `reconnect_attempt` and `reconnect_error` events

---

## Support

For issues or questions:
1. Check server logs (`action: websocket.*`)
2. Enable client debug mode: `localStorage.debug = 'socket.io-client:*'`
3. Review integration tests for usage examples
4. Consult project documentation and frozen terminology rules

---

**End of WebSocket Events Documentation**
