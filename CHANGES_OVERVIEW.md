# Changes Overview

## 2026-01-16
- Added test logging pipeline for backend + frontend, writing per-run logs to `logs/` via `/api/test-logs`.
- Mounted `logs/` into backend container and configured test log env vars.
- Added client-side error reporting for API failures to the test logger.
