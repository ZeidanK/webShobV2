# Local Test Guide (Non-Docker)
<!-- Guidance for running tests outside Alpine-based containers. -->

## Why this exists
Some integration tests rely on MongoMemoryServer, which fails on Alpine.
Run them locally (Windows/WSL/macOS/Linux host) to validate those paths.

## One-time prep
1. Install Node.js (18+).
2. From repo root, install backend deps:
   - `cd backend`
   - `npm install`

## PowerShell execution policy note
If PowerShell blocks `npm`, run:
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`

Alternative (no policy change):
`cmd /c npm test -- --runTestsByPath <paths>`

## Slice 11: Integration tests (run locally)
Run these from `backend/`:
```
npm test -- --runTestsByPath src/routes/vms.routes.test.ts src/routes/camera.routes.test.ts
```

## Slice 11: Unit tests (no DB)
```
$env:SKIP_DB_SETUP="true"
npm test -- --runTestsByPath src/adapters/vms/factory.test.ts
```

## Slice 10: Unit tests (no DB)
```
$env:SKIP_DB_SETUP="true"
npm test -- --runTestsByPath src/services/rtsp-stream.service.test.ts
```

## Slice 12: Playback integration tests (requires MongoMemoryServer)
Run these from `backend/`:
```
npm test -- --runTestsByPath src/routes/event.routes.test.ts
```

## Slice 12: Manual playback checks
1. Open an event detail page and click "View Cameras".
2. Confirm the playback badge reflects available recordings for the event time.
3. Verify the timeline scrubber updates current time and the "Event" marker is visible.
4. Use Play/Pause to start and stop all playback tiles.
5. Scrub the timeline and confirm all tiles seek together (sync status should stay "Synced").

## Optional full backend test run (host)
```
npm test
```

## Troubleshooting
- MongoMemoryServer downloads binaries on first run. If it hangs, check firewall/proxy.
- If a test still fails on the host, capture the stack trace and log output.
