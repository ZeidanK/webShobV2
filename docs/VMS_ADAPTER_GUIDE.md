# VMS Adapter Guide
<!-- Slice 11 documentation scaffold for adapter stubs. -->

## Purpose
This guide describes how to add new VMS adapters and keep them aligned with the
platform's multi-tenant, audit, and security requirements.

## Adapter Interface
All adapters implement the shared interface in `backend/src/adapters/vms/index.ts`:
- `getStreamUrls(cameraId)` returns live stream URLs (HLS/embed/snapshot as supported).
- `testConnection()` validates credentials and connectivity.
- `getPlaybackUrl(cameraId, startTime, endTime?)` returns a playback URL (Slice 12).

## Adapter Factory Integration
1. Add the provider to `VmsProvider` in `backend/src/models/vms-server.model.ts`.
2. Create a new adapter class in `backend/src/adapters/vms/`.
3. Register it in `backend/src/adapters/vms/factory.ts` with capability flags.
4. Ensure `vmsService` routes use the factory for capability checks.
5. Update frontend provider options and capability UI in `frontend/src/pages/VmsSettingsPage.tsx`.

## Provider Requirements (Phase 2)
### Milestone (XProtect)
- SDK installation (Windows service or Docker image with SDK bundle).
- Auth flow: username/password + optional domain.
- API endpoints for:
  - Camera/monitor discovery
  - Stream URL generation (HLS or RTSP proxy)
  - Playback URL generation

### Genetec (Security Center)
- SDK installation and licensing requirements.
- SDK configuration fields:
  - `server` (hostname or IP)
  - `site` (directory or cluster name)
  - `username` / `password`
- API endpoints for:
  - Camera/monitor discovery
  - Stream URL generation
  - Playback URL generation

## Direct RTSP Recording (Phase 2)
Direct RTSP streams do not support recording in the MVP. Phase 2 requires:
- A storage pipeline for HLS segments or recorded MP4 clips.
- Retention policies per camera (`retentionDays`).
- A playback URL service that maps timestamps to stored segments.

## Testing Guidelines
- Unit: verify `VmsAdapterFactory.create()` returns the correct adapter.
- Unit: verify Milestone/Genetec stubs throw "not implemented" errors.
- Integration: verify `/api/vms/:id/capabilities` returns flags per provider.
- Integration: verify unsupported providers fail on camera connect.

## Security Notes
- Never return VMS credentials in API responses.
- Always enforce `companyId` filters in queries.
- Include `correlationId` in logs for VMS operations.
