/**
 * Test Logger
 *
 * Writes JSON lines to a per-run log file for debugging test flows.
 */

import fs from 'fs';
import path from 'path';

export type TestLogLevel = 'info' | 'warn' | 'error';

export interface TestLogEntry {
  timestamp: string;
  level: TestLogLevel;
  source: 'backend' | 'frontend';
  event: string;
  message?: string;
  data?: Record<string, unknown>;
}

class TestLogger {
  private static instance: TestLogger;
  private readonly logFilePath: string;

  private constructor() {
    const logDir = process.env.TEST_LOG_DIR || path.resolve(process.cwd(), 'logs');
    const prefix = process.env.TEST_LOG_PREFIX || 'test-run';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFilePath = path.join(logDir, `${prefix}-${timestamp}.log`);

    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(this.logFilePath, '');
  }

  static getInstance(): TestLogger {
    if (!TestLogger.instance) {
      TestLogger.instance = new TestLogger();
    }
    return TestLogger.instance;
  }

  log(entry: Omit<TestLogEntry, 'timestamp'>): void {
    const payload: TestLogEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };
    fs.appendFile(this.logFilePath, `${JSON.stringify(payload)}\n`, () => undefined);
  }

  info(entry: Omit<TestLogEntry, 'timestamp' | 'level'>): void {
    this.log({ ...entry, level: 'info' });
  }

  warn(entry: Omit<TestLogEntry, 'timestamp' | 'level'>): void {
    this.log({ ...entry, level: 'warn' });
  }

  error(entry: Omit<TestLogEntry, 'timestamp' | 'level'>): void {
    this.log({ ...entry, level: 'error' });
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }
}

export const testLogger = TestLogger.getInstance();
