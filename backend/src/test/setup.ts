import { setupTestDB, teardownTestDB, clearTestDB } from './db';
import { EventTypeService } from '../services/event-type.service';

// Increase timeout for MongoDB Memory Server
jest.setTimeout(30000);

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };

beforeAll(async () => {
  await setupTestDB();
  // Seed system default event types
  await EventTypeService.seedSystemDefaults();
});

afterAll(async () => {
  await teardownTestDB();
  // Give Jest time to close all handles
  await new Promise(resolve => setTimeout(resolve, 500));
});

afterEach(async () => {
  await clearTestDB();
  // Re-seed system defaults after clearing DB
  await EventTypeService.seedSystemDefaults();
});
