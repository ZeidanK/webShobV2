import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

/**
 * Setup in-memory MongoDB for testing
 */
export async function setupTestDb(): Promise<void> {
  // Close existing connection if any
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}

/**
 * Clean up test database
 */
export async function cleanupTestDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongod) {
    await mongod.stop();
  }
}

/**
 * Clear all test data
 */
export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}