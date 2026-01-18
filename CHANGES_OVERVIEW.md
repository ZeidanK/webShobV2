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
