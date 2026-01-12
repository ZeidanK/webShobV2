import { v4 as uuidv4 } from 'uuid';
import { Company, User, UserRole, CompanyStatus, CompanyType } from '../models';
import { AuthService } from '../services';
// import { faker } from '@faker-js/faker';

// Export test DB helpers
export { setupTestDB, teardownTestDB, clearTestDB as clearDatabase } from './db';

// TODO: Add model imports when they are created
// import { Company } from '../models/company.model';
// import { User } from '../models/user.model';
// import { Event } from '../models/event.model';

/**
 * Generate a valid JWT token for testing
 * TODO: Implement in Slice 1
 */
export function generateTestToken(_userId: string, _companyId: string, _role: string): string {
  // Placeholder - will be implemented with actual JWT in Slice 1
  return 'test-jwt-token';
}

/**
 * Generate a valid API key for testing
 */
export function generateTestApiKey(): string {
  return `emp_test_${uuidv4().replace(/-/g, '')}`;
}

/**
 * Create test request context
 */
export function createTestContext() {
  return {
    correlationId: uuidv4(),
    companyId: uuidv4(),
    userId: uuidv4(),
  };
}

/**
 * Create a test company
 */
export async function createTestCompany(overrides: any = {}) {
  const company = await Company.create({
    name: overrides.name || 'Test Company',
    type: overrides.type || CompanyType.STANDARD,
    status: overrides.status || CompanyStatus.ACTIVE,
    contactEmail: overrides.contactEmail,
    contactPhone: overrides.contactPhone,
    settings: overrides.settings || {},
  });

  return company;
}

/**
 * Create a test user with token
 */
export async function createTestUser(overrides: any = {}) {
  const user = await User.create({
    email: overrides.email || `test-${uuidv4()}@test.com`,
    password: overrides.password || 'Password123!',
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'User',
    role: overrides.role || UserRole.CITIZEN,
    companyId: overrides.companyId,
    isActive: overrides.isActive !== undefined ? overrides.isActive : true,
    isEmailVerified: overrides.isEmailVerified !== undefined ? overrides.isEmailVerified : true,
  });

  const token = AuthService.generateToken({
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
    companyId: user.companyId.toString(),
  });

  return {
    user,
    token,
  };
}

// Factory functions will be added as models are created in subsequent slices
// export async function createTestEvent(overrides = {}) { ... }
// export async function createTestReport(overrides = {}) { ... }
