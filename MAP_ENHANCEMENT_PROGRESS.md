# Map Enhancement Implementation Progress

**Feature**: Advanced Map View with Camera Integration, Real-time Updates, and Radius-based Camera Wall

**Started**: January 21, 2026

---

## Phase 1: Enhanced EventMap Component with Camera Display ⏳

### 1.1 Install Dependencies
- [ ] Install `react-leaflet-markercluster` package
- [ ] Install `leaflet.markercluster` package
- [ ] Verify dependencies in package.json

### 1.2 Update EventMap Component Interface
- [ ] Add `cameras?: Camera[]` prop
- [ ] Add `onCameraClick?: (camera: Camera) => void` callback
- [ ] Add `showCameraClusters?: boolean` prop (default: true)
- [ ] Add `onEventRadiusView?: (event: Event, radius: number) => void` callback

### 1.3 Implement Camera Markers with Clustering
- [ ] Import MarkerClusterGroup from react-leaflet-markercluster
- [ ] Create `getCameraIcon()` function with status-based colors
- [ ] Add camera markers inside MarkerClusterGroup
- [ ] Configure clustering options (maxClusterRadius: 80, spiderfyOnMaxZoom: true)
- [ ] Add camera popup with details and actions

### 1.4 Add Event Radius Functionality
- [ ] Modify event popup to include "View Nearby Cameras" button
- [ ] Add radius selector dropdown (500m, 1km, 2km, 5km)
- [ ] Implement click handler that calls `onEventRadiusView(event, selectedRadius)`

---

## Phase 2: Advanced Filter Overlay System ⏳

### 2.1 Create FilterOverlay Component
- [ ] Create FilterOverlay.tsx component file
- [ ] Define MapFilters interface (display, events, cameras, geographic)
- [ ] Implement modal overlay positioned top-right of map
- [ ] Add collapsible sections with expand/collapse animation
- [ ] Add Apply/Reset buttons with live preview
- [ ] Add camera and event count badges

### 2.2 Add Filter Overlay Styles
- [ ] Create FilterOverlay.module.css
- [ ] Implement glassmorphism effect for panel
- [ ] Add smooth open/close animations
- [ ] Make responsive for mobile/desktop

---

## Phase 3: Real-time Camera Status Updates ⏳

### 3.1 Extend WebSocket Events (Backend)
- [ ] Add `CAMERA_STATUS_UPDATED` to WebSocketEvent enum
- [ ] Define CameraStatusUpdate interface
- [ ] Create `broadcastCameraStatusUpdate()` method in websocket.service.ts

### 3.2 Add Camera Status Broadcasting (Backend)
- [ ] Modify camera.service.ts `updateStatus()` method
- [ ] Add WebSocket broadcast on status change
- [ ] Ensure multi-tenant company room isolation
- [ ] Add audit logging for status changes

### 3.3 Frontend WebSocket Camera Updates
- [ ] Add `useCameraStatusUpdated()` hook in useWebSocket.ts
- [ ] Handle camera:status_updated events
- [ ] Provide callback for status update handling

### 3.4 Integrate Real-time Updates in OperatorDashboard
- [ ] Add useCameraStatusUpdated hook to OperatorDashboard
- [ ] Update camera state on status changes
- [ ] Show toast notification on status change

---

## Phase 4: OperatorDashboard Enhancement ⏳

### 4.1 Add Camera Data Fetching
- [ ] Add `cameras` state to OperatorDashboard
- [ ] Add `mapFilters` state with MapFilters interface
- [ ] Create `loadCameras()` function with filter support
- [ ] Integrate camera loading with useEffect

### 4.2 Implement Event Radius Camera View
- [ ] Create `handleEventRadiusView()` function
- [ ] Call api.cameras.findNearby with event coordinates
- [ ] Store nearby context in sessionStorage
- [ ] Navigate to monitor wall with context

### 4.3 Update EventMap Integration
- [ ] Pass cameras prop to EventMap
- [ ] Pass onCameraClick handler
- [ ] Pass onEventRadiusView handler
- [ ] Pass showCameraClusters from filters

### 4.4 Add Filter Overlay Integration
- [ ] Add showFilterOverlay state
- [ ] Add filter button to UI
- [ ] Integrate FilterOverlay component
- [ ] Connect filter changes to data fetching

---

## Phase 5: Monitor Wall Enhancement ⏳

### 5.1 Update MonitorWallPage for Radius Context
- [ ] Add useEffect to check for nearbyCameraContext in sessionStorage
- [ ] Load cameras from radius query when context exists
- [ ] Set page title based on event context
- [ ] Clear sessionStorage after loading context

### 5.2 Add Context Information Display
- [ ] Add Alert component showing event radius view info
- [ ] Add "Back to Map" button
- [ ] Style context information banner

---

## Phase 6: Context Menu Enhancement ⏳

### 6.1 Create MapContextMenu Component
- [ ] Create MapContextMenu.tsx component file
- [ ] Define MapContextMenuProps interface
- [ ] Add menu items for Create Event, Add Camera, Location Info
- [ ] Implement role-based menu filtering
- [ ] Add navigation handlers with location state

### 6.2 Add MapContextMenu Styles
- [ ] Create MapContextMenu.module.css
- [ ] Style context menu with proper positioning
- [ ] Add hover effects and transitions
- [ ] Handle edge-of-screen positioning

### 6.3 Integrate Context Menu in EventMap
- [ ] Add contextMenu state to EventMap
- [ ] Add contextmenu event handler to MapEventHandler
- [ ] Close menu on map click
- [ ] Pass user role to context menu

---

## Phase 7: Form Integration for Location Pre-filling ⏳

### 7.1 Update EventFormPage
- [ ] Add location state handling in EventFormPage
- [ ] Pre-fill coordinates from map context
- [ ] Add reverse geocoding for address lookup
- [ ] Show indicator when location is from map

### 7.2 Update Camera Form
- [ ] Check if CameraFormPage exists or create it
- [ ] Add location state handling
- [ ] Pre-fill GPS coordinates from map context
- [ ] Add map preview showing selected location

---

## Testing & Polish 🔄

### Unit Tests
- [ ] Write tests for EventMap camera markers
- [ ] Write tests for FilterOverlay component
- [ ] Write tests for MapContextMenu component
- [ ] Write tests for WebSocket camera updates

### Integration Tests
- [ ] Test radius functionality end-to-end
- [ ] Test filter interactions with API
- [ ] Test context menu navigation flow
- [ ] Test real-time camera status updates

### Performance Testing
- [ ] Test with 100+ cameras (clustering)
- [ ] Test with 500+ events (performance)
- [ ] Test filter debouncing and API call optimization
- [ ] Profile component re-renders

### Mobile Responsiveness
- [ ] Test EventMap on mobile devices
- [ ] Test FilterOverlay on mobile
- [ ] Test context menu touch interactions
- [ ] Verify responsive layouts

---

## Documentation 📝

### API Documentation
- [ ] Document new WebSocket events
- [ ] Update camera API endpoint docs
- [ ] Document radius query parameters

### Component Documentation
- [ ] Add JSDoc comments to EventMap
- [ ] Document FilterOverlay props and usage
- [ ] Document MapContextMenu props

### User Guide Updates
- [ ] Document camera clustering feature
- [ ] Document radius-based camera viewing
- [ ] Document filter overlay usage
- [ ] Document context menu actions

---

## Progress Summary

**Overall Progress**: 0% Complete (0/9 phases)

- ✅ Phase 0: Planning and Documentation Complete
- ⏳ Phase 1: EventMap Enhancement - Not Started
- ⏳ Phase 2: Filter Overlay - Not Started
- ⏳ Phase 3: Real-time Updates - Not Started
- ⏳ Phase 4: OperatorDashboard - Not Started
- ⏳ Phase 5: Monitor Wall - Not Started
- ⏳ Phase 6: Context Menu - Not Started
- ⏳ Phase 7: Form Integration - Not Started
- 🔄 Testing & Polish - Not Started

---

## Notes and Issues

### Technical Decisions
- Using react-leaflet-markercluster for camera clustering
- Filter overlay positioned as floating panel (not sidebar)
- WebSocket updates for real-time camera status
- SessionStorage for radius context passing

### Known Issues
- None yet

### Future Enhancements
- Add heatmap layer for event density
- Add drawing tools for custom area selection
- Add camera coverage cone visualization
- Add historical playback timeline on map

---

**Last Updated**: January 21, 2026
