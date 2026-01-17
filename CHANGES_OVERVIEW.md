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
