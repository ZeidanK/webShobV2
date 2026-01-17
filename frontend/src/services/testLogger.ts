/**
 * Test logger (frontend)
 *
 * Sends client-side issues to the backend test log endpoint.
 */

type TestLogLevel = 'info' | 'warn' | 'error';

interface FrontendLogEntry {
  level: TestLogLevel;
  event: string;
  message?: string;
  data?: Record<string, unknown>;
}

const TEST_LOG_ENDPOINT = '/api/test-logs';
const TEST_LOG_ENABLED = import.meta.env.DEV;

export async function logFrontendIssue(entry: FrontendLogEntry): Promise<void> {
  if (!TEST_LOG_ENABLED) {
    return;
  }

  try {
    await fetch(TEST_LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: entry.level,
        source: 'frontend',
        event: entry.event,
        message: entry.message,
        data: entry.data,
      }),
    });
  } catch {
    // Ignore logging failures to avoid cascading errors
  }
}
