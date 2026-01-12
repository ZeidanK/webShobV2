import { setupTestDB, teardownTestDB, clearTestDB } from './db';

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
});

afterAll(async () => {
  await teardownTestDB();
  // Give Jest time to close all handles
  await new Promise(resolve => setTimeout(resolve, 500));
});

afterEach(async () => {
  await clearTestDB();
});
