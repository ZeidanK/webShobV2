# Changes Overview

## 2026-01-16
- Added test logging pipeline for backend + frontend, writing per-run logs to `logs/` via `/api/test-logs`.
- Mounted `logs/` into backend container and configured test log env vars.
- Added client-side error reporting for API failures to the test logger.
## 2026-01-17
### VMS import and error clarity
- VMS import server lookup and monitor discovery now use the correct query/order so existing servers are found.
- New VMS error codes (`VMS_SERVER_NOT_FOUND`, `VMS_AUTH_MISSING`) surface in UI alerts with structured `ApiRequestError` codes.
- VMS connection and discovery errors include server/provider details for troubleshooting.

### Live view stability and status refresh
- LiveView retries are capped for network/media errors and missing stream URLs now surface explicit errors.
- Camera status is refreshed when streams are requested (no background polling yet; status updates on access).

### VMS stream playback and cleanup
- Added `publicBaseUrl` support so browser stream URLs can differ from backend Docker URLs.
- VMS server delete now soft-deletes linked cameras to prevent orphaned data.

### Single-URL test workflow
- Backend auto-normalizes `localhost` base URLs: stores internal Docker URL for backend calls and preserves the original for browser playback.
- UI copy updated to indicate a single URL is acceptable for test setups.

## 2026-01-18
### Phase 1 status monitoring + wall controls
- Monitor wall now loads all cameras (not just online) so status monitoring reflects offline/maintenance devices.
- Local operator settings (stored in `localStorage` under `monitorWall.settings`) control wall interaction mode.
- Drag-and-drop swapping is enabled for camera tiles, with visual feedback for drag source/target.
- Status badges now render on every tile (including live streams) to keep operator context visible.
- Grid tiles now size to content, leaving unused space below rather than stretching tiles.
- Header controls wrap to keep the wall settings button visible at smaller widths.
- Added a resize handle that uses drag gestures to toggle enlarge/de-enlarge on a camera tile.
- Resize drag now triggers on pointer movement (not just pointer release) to improve Firefox behavior.
- Resize handle is now larger and clickable as a fallback when drag gestures are missed.
- Resize handle moved to the tile top-right with higher contrast to ensure it is visible above live video.
- Drag swap ignores resize handle interactions so resize gestures do not trigger tile swaps.
- Resize control now renders inside the LiveView header to avoid being hidden by the video layer.
- Resize control is now inline (not absolutely positioned) so it appears beside the LIVE indicator.
- Monitor wall tiles now use a flex-wrap layout with per-tile width/height so operators can freely resize tiles.
- Resize gestures now adjust tile dimensions in-session; grid size changes reset tile sizes.
- Resize control moved to right/bottom edge drag zones with a subtle hover outline to reduce on-screen clutter.
- Added a corner resize zone (nwse-resize cursor) and a Reset Wall button to restore original ordering and sizing.
- LiveView now uses `object-fit: cover` when tiles are resized so feeds fill their container.
- Added resize hotspots for all four corners with proper cursor directions, plus flex alignment fixes to prevent overlap when tiles grow.
- Current behavior: edge/corner drag resizing is enabled with push-down layout; no overlay is expected for normal use.
- Map events now offer a "View Nearby Cameras" action that opens the monitor wall in nearby mode.
- Monitor wall adds "Reset Layout" (positions only) and "Exit Nearby" (restore full wall) controls, with nearby selection stored in session storage.

### Operator wall scroll + encoding cleanup
- Monitor wall now renders all cameras for a grid size and relies on scroll to view overflow tiles.
- Camera grid container uses `min-height` so extra rows extend and the wall scrolls when cameras exceed the grid.
- Grid size selection now explicitly controls wall column count while keeping overflow cameras scrollable.
- Wall viewport height is measured to keep tile heights aligned to the selected NxN rows while scrolling vertically.
- Monitor wall scroll is vertical-only to keep the grid width locked to the chosen column count.
- Wall header labels (grid size + refresh) now use ASCII-only text to avoid mojibake.
- LiveView status/error glyphs use ASCII-only labels to prevent garbled UI symbols.
- Camera grid empty/offline labels use ASCII-only text for consistent operator display.
- Navigation sidebar labels are normalized to ASCII for dashboard/report/camera links.
- Monitor wall uses a scroll-friendly grid container to allow overflow rows without shrinking tile size.
### Phase 2.2 direct-rtsp streaming (in progress)
- Added RTSP-to-HLS pipeline service with per-camera FFmpeg processes and idle cleanup.
- Added short-lived stream tokens scoped to camera/company for HLS asset access.
- Exposed a secured HLS asset route that injects tokens into playlists for segment access.
- Direct-rtsp stream URLs now return backend-hosted HLS playlist URLs with tokens.
- Added streaming configuration (base dir, token TTL, idle timeout, public base URL).
- Backend Docker image now installs FFmpeg for RTSP transcoding.
- Added `streams/` to `.gitignore` to avoid committing HLS output.
- Request logging now redacts `token` query parameters to avoid leaking stream tokens.
- Added optional RTSP transcode mode (configurable preset) for non-copyable streams.
- HLS playlist delivery now waits briefly for initial generation before returning not-ready errors.
- Added a max RTSP process cap to evict least-recently-used pipelines under load.
- Added a stream token cookie fallback for native players that drop HLS query params.

### Known Issues
- [Resolved] HLS segment requests rely on query tokens; cookie fallback added for native players.
- [Resolved] FFmpeg process cap is enforced via LRU eviction (STREAMING_MAX_PROCESSES).
- [Partial] Stream startup can still be slow for some RTSP sources; wait loop helps but does not eliminate delays.
- [Open] Transcode is global (env flag) rather than per-camera; mixed camera fleets may need different modes.
- [Open] Stream errors are not surfaced with camera-specific diagnostics in the UI yet.
- [Open] HLS endpoints are token-protected but not rate-limited; burst traffic could impact stability.
## 2026-01-18
### Phase 2 scaffolding (Direct RTSP)
- Added `streamConfig` to camera models and API types to support Direct RTSP configuration without changing VMS behavior.
- Camera service now accepts `streamConfig` on create/update; no streaming logic yet (Phase 2.2+).
- Added server-side validation to require `streamConfig.rtspUrl` for direct-rtsp and block mixed VMS/streamUrl configs.
- Camera routes now accept `streamConfig` on create/update so validation is enforced.
- Stream config auth passwords are excluded from camera query results by default.
- Local test: direct-rtsp without rtspUrl now fails with validation (HTTP 400).
- Local test: streamConfig.auth password is not returned in camera responses.
- Validation now requires `streamConfig.type` when streamConfig is supplied to prevent ambiguous defaults.
- Fixed update edge case where partial streamConfig updates could fail casting due to undefined auth.

#### Key changes
**Monitor wall settings + ordering (frontend)**
```tsx
// frontend/src/pages/MonitorWallPage.tsx
const [wallSettings, setWallSettings] = useState<WallSettings>(() => loadWallSettings());
const updateWallSettings = useCallback((updates: Partial<WallSettings>) => {
  setWallSettings((prev) => {
    const next = { ...prev, ...updates };
    localStorage.setItem(wallSettingsKey, JSON.stringify(next));
    return next;
  });
}, []);
```
This keeps per-operator wall controls local while preserving user intent across refreshes.

**Drag swap + status overlay (frontend)**
```tsx
// frontend/src/components/CameraGrid.tsx
const allowsClick = interactionMode !== 'drag';
const allowsDrag = interactionMode !== 'click';
```
Interaction mode gates click focus vs drag swapping for operator workflow flexibility.

## 2026-01-19
### Slice 9-A connectivity + audit logging
- Added `/api/cameras/test-connection` to validate RTSP URLs or VMS servers in one endpoint.
- Added RTSP probe support in the backend with a short FFmpeg connectivity test.
- Added audit log actions for VMS server lifecycle, monitor discovery/import, and camera VMS connect/disconnect.
- Added correlationId/ip/userAgent metadata to VMS audit logs for traceability.

### LiveView fallback + demo cleanup
- LiveView now supports iframe fallback via `embedUrl` when HLS is unsupported or absent.
- Monitor wall and camera modal now retain embed/snapshot URLs for fallback playback.
- VMS settings now include a cleanup action to remove `vms-import` demo cameras.

### Slice 9-B VMS lab + docs
- Added `vms-lab/docker-compose.yml` for local Shinobi testing.
- Added Shinobi lab instructions to README and documentation index.
- Added `docs/VMS_INTEGRATION.md` with endpoints, URL formats, and test flow.
- Added vms-lab data paths to `.gitignore` to prevent committing lab data.
- Normalized VMS settings UI labels to ASCII and fixed the cleanup action wiring.
- Confirmed Swagger annotations cover VMS endpoints and marked the workplan task complete.

### Slice 9-C tests + manual checks
- Added VMS route integration tests for test connection, monitor discovery, and monitor import.
- Added camera route integration tests for stream URL generation and VMS import.
- Documented manual HLS playback and connection test steps in `docs/VMS_INTEGRATION.md`.

## 2026-01-20
### Slice 9-A camera metadata + query endpoints
- Extended camera model with capability flags, maintenance scheduling, and tag arrays.
- Added status and tag filter endpoints plus a `/cameras/near` alias for geo queries.
- Normalized tags on create/update and added tag-based filtering in list queries.
- Added bulk status update, delete, and tag operations with tenant scoping.

## 2026-01-21
### Phase 9-B scope (expanded)
- Background health check job will periodically evaluate camera status with a configurable interval.
- Status evaluation will branch by source: VMS monitor status for VMS-linked cameras and RTSP probing for direct streams.
- Status updates will only be persisted on changes, with `lastSeen` refreshed on online transitions.
- WebSocket `camera:status` broadcasts will carry cameraId, companyId, previous status, next status, and timestamp.
- Admin-triggered refresh endpoint will allow manual status checks without waiting for the scheduler.

### Phase 9-B implementation
- Added camera status monitoring service with scheduled runs and manual refresh support.
- Status checks resolve VMS and direct-RTSP health and persist changes with audit logging.
- Added `camera:status` WebSocket event broadcast for real-time updates.
- Added manual status refresh endpoint for admins and company admins.
- Added configuration for status monitor enablement and interval.

## 2026-01-22
### Phase 9-C camera UI enhancements
- Extended camera APIs with audit log reads, bulk actions, and tag filtering support.
- Added camera detail page with live preview, editable capabilities/tags/maintenance, and audit log view.
- Expanded camera list with advanced filters, bulk toolbar, and inline health indicators.
- Added selection controls in grid/list views and bulk status/tag/delete operations.
- Wired WebSocket `camera:status` updates into camera list and monitor wall, plus offline toast alerts.
### Slice 9 verification status
- Marked Slice 9 DoD items complete based on manual verification; automated tests remain blocked on Alpine MongoMemoryServer.
### Build fixes
- Normalized tag query parsing for `/api/cameras` to avoid ParsedQs type errors.
- Added missing `userId` for VMS monitor discovery audit metadata.
- Registered RTSP streaming error codes to satisfy backend type checks.
- Forced readable text colors for camera/VMS selects and action buttons on light backgrounds.
- Added automatic access token refresh and retry for expired auth responses.
- Skip undefined/empty query params to prevent invalid ObjectId errors in camera filters.
- Added camera search auto-complete suggestions based on names, locations, and tags.
- Added VSCode test tsconfig so Jest globals resolve in backend test files.
### Slice 10-A scaffolding
- Added RTSP stream token and heartbeat endpoints for direct-rtsp playback.
- Added RTSP keep-alive helpers to extend active stream lifetimes.
- Updated VMS adapter interface to standardize stream URL access and connection testing.
### Slice 10-B infrastructure
- Added RTSP segment cleanup job and configurable cleanup settings.
- Mounted `/tmp/hls` streaming directory in Docker for direct-rtsp output.
- Documented FFmpeg as a Direct RTSP prerequisite.
### Slice 10-C frontend integration
- Added VMS vs Direct RTSP selector to camera form, with RTSP transport and VMS monitor inputs.
- Wired direct-rtsp heartbeat pings into LiveView and monitor wall tiles.
- Extended monitor wall stream loading to handle direct-rtsp cameras.
### Slice 10-D checks
- Added unit tests for RTSP stream tokens and HLS path validation.
- Added a `SKIP_DB_SETUP` guard in test setup to allow non-DB unit tests on Alpine.
- Ran `npm test -- --runTestsByPath src/services/rtsp-stream.service.test.ts` with `SKIP_DB_SETUP=true` (passed; ts-jest warnings about `isolatedModules` remain).
### Historical step explanations (Slice 9.0-A to Slice 10-D)
- 9.0-A: Before only core VMS routes existed; after added camera connection tests, audit logging, LiveView fallback, and demo cleanup to close MVP gaps.
- 9.0-B: Before no local VMS lab/docs; after added `vms-lab/` compose, README updates, and VMS integration docs.
- 9.0-C: Before no VMS integration tests/manual runbook; after added VMS route tests and manual HLS check steps.
- 9-A: Before camera model lacked advanced fields; after added tags/maintenance/capabilities plus geo, status, and bulk ops endpoints.
- 9-B: Before no background status monitor; after added status job, WebSocket broadcasts, and manual refresh endpoint.
- 9-C: Before camera UI was basic; after added detail view, bulk tools, and real-time status updates.
- 10-A: Before RTSP direct streams were unsupported; after added direct-rtsp config, tokens, and heartbeat endpoints.
- 10-B: Before no streaming cleanup infra; after added FFmpeg install, segment cleanup job, and streaming mounts.
- 10-C: Before UI couldn't configure direct RTSP; after added form controls, LiveView heartbeat, and wall stream wiring.
- 10-D: Before no RTSP unit checks; after added token/path unit tests and DB setup guard for Alpine.
### Slice 11-A progress
- 11-A: Before no Milestone/Genetec stubs or factory; after added adapter stubs and factory scaffolding plus `sdkConfig` and provider enum expansion.
### Slice 11-B progress
- 11-B: Before no capability endpoint or provider gating; after added capability lookup endpoint, capability flags in camera connect responses, and provider validation for unsupported VMS types.
### Frontend build fixes
- Removed unused React imports and resize handler args that were failing `tsc` strict checks.
- Replaced mojibake UI labels in operator/event playback/report submission flows with ASCII-only text.
- Fixed operator dashboard filter typing and cleaned up the event list markup.
- Updated report creation typing to allow optional location payloads.
- Switched EventVideoPlayback to use `apiClient.get` for typed API responses.
- Added `frontend/src/test-globals.d.ts` for Vitest + jest-dom type support without module name collisions.
- Verified `docker-compose exec -T frontend npm run build` passes.
