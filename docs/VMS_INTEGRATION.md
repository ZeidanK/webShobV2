# VMS Integration (Slice 9.0)

This document describes the Shinobi VMS integration used for the MVP camera flow.

## Local Shinobi Lab

Use the dedicated lab stack for a local Shinobi instance:

```bash
cd vms-lab
docker-compose up -d
```

Default ports:
- Shinobi UI: http://localhost:8080
- MySQL: 3306

If the default Shinobi credentials do not work, create an admin in the UI and
generate API keys from the Shinobi account settings.
Create at least one monitor in Shinobi so discovery returns results.

## VMS Server Model

Key fields:
- `baseUrl`: backend-facing URL for Shinobi API calls.
- `publicBaseUrl`: optional browser-facing URL for stream playback.
- `auth.apiKey` and `auth.groupKey`: Shinobi credentials required for stream URLs.

## Stream URL Formats (Shinobi)

Shinobi URL patterns used by the backend:
- HLS: `{baseUrl}/{apiKey}/hls/{groupKey}/{monitorId}/s.m3u8`
- Embed: `{baseUrl}/{apiKey}/embed/{groupKey}/{monitorId}`
- Snapshot: `{baseUrl}/{apiKey}/jpeg/{groupKey}/{monitorId}/s.jpg`

If `publicBaseUrl` is set, the backend uses it for playback URLs.

## API Endpoints

VMS server management:
- `POST /api/vms` create server
- `GET /api/vms` list servers
- `GET /api/vms/:id` get server
- `PUT /api/vms/:id` update server
- `DELETE /api/vms/:id` delete server
- `POST /api/vms/:id/test` test VMS connection
- `GET /api/vms/:id/monitors` discover Shinobi monitors
- `POST /api/vms/:id/monitors/import` import monitors as cameras

Camera integration:
- `POST /api/cameras/:id/vms/connect`
- `POST /api/cameras/:id/vms/disconnect`
- `GET /api/cameras/:id/streams`
- `POST /api/cameras/test-connection` (mode: `vms` or `rtsp`)
- `DELETE /api/cameras/source/:source` (bulk cleanup)

## Connection Testing

Use the unified test endpoint for both RTSP and VMS:

- VMS test:
  - `mode: "vms"`
  - `serverId`: VMS server id
- RTSP test:
  - `mode: "rtsp"`
  - `rtspUrl`: camera RTSP URL
  - `transport`: `tcp` or `udp`

The endpoint returns a simple `{ success, message }` response and can be called
from the VMS settings UI or automation scripts.

## Expected UI Flow

1. Register a VMS server with Shinobi credentials.
2. Discover monitors from Shinobi.
3. Import monitors as cameras.
4. Connect individual cameras to specific monitors if needed.
5. Open LiveView or the monitor wall to view HLS playback.

## Manual Checks

HLS playback:
1. Open VMS Settings and discover monitors.
2. Import a monitor and open the camera in LiveView.
3. Confirm the HLS stream starts and the LIVE status shows.

Connection test:
1. In VMS Settings, click "Test" for a Shinobi server.
2. Confirm a success response with monitor count.
3. For RTSP, call `POST /api/cameras/test-connection` with `mode: "rtsp"` and verify `success: true`.
