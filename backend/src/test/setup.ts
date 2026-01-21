import { setupTestDB, teardownTestDB, clearTestDB } from './db';
import { EventTypeService } from '../services/event-type.service';

// Allow unit tests to opt out of DB setup in constrained environments.
const skipDbSetup = process.env.SKIP_DB_SETUP === 'true';

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
  if (skipDbSetup) {
    return;
  }
  await setupTestDB();
  // Seed system default event types
  await EventTypeService.seedSystemDefaults();
});

afterAll(async () => {
  if (skipDbSetup) {
    return;
  }
  await teardownTestDB();
  // Give Jest time to close all handles
  await new Promise(resolve => setTimeout(resolve, 500));
});

afterEach(async () => {
  if (skipDbSetup) {
    return;
  }
  await clearTestDB();
  // Re-seed system defaults after clearing DB
  await EventTypeService.seedSystemDefaults();
});
