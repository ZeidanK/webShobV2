# Testing Strategy

**Version:** 1.0  
**Date:** January 12, 2026  
**Status:** Frozen Foundation Document

---

## 1. Testing Philosophy

### Principles
1. **Test from Day 1**: Testing infrastructure set up before business logic
2. **Pyramid Model**: More unit tests, fewer E2E tests
3. **Fast Feedback**: Tests run quickly, fail fast
4. **Deterministic**: No flaky tests, reproducible results
5. **Isolated**: Tests don't depend on each other or external state

### Coverage Targets (CONFIGURABLE DEFAULT)
- Unit tests: 80% line coverage
- Integration tests: 70% endpoint coverage
- Overall: 70% minimum

---

## 2. Test Types

### 2.1 Unit Tests

**Purpose**: Test individual functions, classes, and modules in isolation.

**Scope**:
- Service methods (business logic)
- Utility functions
- Validation logic
- State machines
- Data transformations

**Tools**:
- Backend: Jest
- Frontend: Jest + React Testing Library

**Characteristics**:
- No database, network, or external dependencies
- Use mocks/stubs for dependencies
- Execute in milliseconds
- Run on every file save (watch mode)

**Example (Backend)**:
```typescript
// src/services/event.service.test.ts
import { isValidStateTransition } from './event.service';

describe('Event State Machine', () => {
  it('allows active → assigned transition', () => {
    expect(isValidStateTransition('active', 'assigned')).toBe(true);
  });

  it('rejects assigned → active transition', () => {
    expect(isValidStateTransition('assigned', 'active')).toBe(false);
  });

  it('rejects closed → any transition', () => {
    expect(isValidStateTransition('closed', 'active')).toBe(false);
    expect(isValidStateTransition('closed', 'resolved')).toBe(false);
  });
});
```

**Example (Frontend)**:
```typescript
// src/components/EventCard.test.tsx
import { render, screen } from '@testing-library/react';
import { EventCard } from './EventCard';

describe('EventCard', () => {
  it('displays event title', () => {
    render(<EventCard event={{ title: 'Fire on Main St', status: 'active' }} />);
    expect(screen.getByText('Fire on Main St')).toBeInTheDocument();
  });

  it('shows priority badge for high priority', () => {
    render(<EventCard event={{ title: 'Test', status: 'active', priority: 'high' }} />);
    expect(screen.getByText('HIGH')).toHaveClass('priority-high');
  });
});
```

---

### 2.2 Integration Tests

**Purpose**: Test API endpoints with real database, verifying full request flow.

**Scope**:
- REST API endpoints
- Database operations
- Middleware chain (auth, validation, error handling)
- Cross-service interactions

**Tools**:
- Jest + Supertest
- MongoDB Memory Server (in-memory database)

**Characteristics**:
- Use real database (in-memory for speed)
- Test full HTTP request/response cycle
- Verify response status, body, headers
- Run in seconds

**Example**:
```typescript
// src/routes/events.test.ts
import request from 'supertest';
import { app } from '../app';
import { setupTestDB, teardownTestDB, createTestUser } from '../test/helpers';

describe('Events API', () => {
  let authToken: string;
  let companyId: string;

  beforeAll(async () => {
    await setupTestDB();
    const { token, company } = await createTestUser({ role: 'operator' });
    authToken = token;
    companyId = company._id;
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  describe('POST /api/events', () => {
    it('creates event with valid data', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Event',
          description: 'Test description',
          location: { type: 'Point', coordinates: [-122.4, 37.7] },
          eventTypeId: 'type123',
          priority: 'medium'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe('Test Event');
      expect(response.body.data.status).toBe('active');
      expect(response.body.correlationId).toBeDefined();
    });

    it('rejects event without title (400)', async () => {
      const response = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'No title' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects unauthorized request (401)', async () => {
      const response = await request(app)
        .post('/api/events')
        .send({ title: 'Test' });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/events', () => {
    it('returns only events from user company', async () => {
      // Create events in two different companies
      // Verify only own company events returned
    });
  });
});
```

---

### 2.3 Contract Tests (OpenAPI Validation)

**Purpose**: Ensure API implementation matches OpenAPI specification.

**Scope**:
- Request validation against schema
- Response validation against schema
- Required fields enforcement
- Type checking

**Tools**:
- express-openapi-validator
- Jest for test execution

**Characteristics**:
- Validates every request/response against OpenAPI spec
- Catches spec drift automatically
- Runs as part of integration tests

**Implementation**:
```typescript
// src/middleware/openapi-validator.ts
import * as OpenApiValidator from 'express-openapi-validator';

export const openApiValidator = OpenApiValidator.middleware({
  apiSpec: './openapi.yaml',
  validateRequests: true,
  validateResponses: true, // Enable in test environment
  ignorePaths: /.*\/docs/
});
```

**Test Setup**:
```typescript
// src/test/setup.ts
import { app } from '../app';

// Enable response validation in test mode
if (process.env.NODE_ENV === 'test') {
  app.use(openApiValidator);
}
```

---

### 2.4 End-to-End Tests (E2E)

**Purpose**: Test complete user workflows through the UI.

**Scope**:
- Critical user journeys
- Cross-browser compatibility
- Real environment behavior

**Tools**:
- Cypress (Phase 2)

**Characteristics**:
- Run against deployed environment
- Slower execution (minutes)
- Run before release, not on every commit

**Example Scenarios** (Phase 2):
- Login → View events → Create event → Assign responder → Resolve
- Citizen submits report → Operator verifies → Links to event
- Camera shows detection → Report created → Event auto-created

---

## 3. Test Database Strategy

### In-Memory MongoDB

Use `mongodb-memory-server` for integration tests:

```typescript
// src/test/db.ts
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

export async function setupTestDB() {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
}

export async function teardownTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongod.stop();
}

export async function clearTestDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}
```

### Test Data Factories

```typescript
// src/test/factories.ts
import { faker } from '@faker-js/faker';
import { User } from '../models/user.model';
import { Company } from '../models/company.model';
import { Event } from '../models/event.model';

export function createTestCompany(overrides = {}) {
  return Company.create({
    name: faker.company.name(),
    apiKey: `emp_test_${faker.string.alphanumeric(32)}`,
    isActive: true,
    ...overrides
  });
}

export function createTestUser(overrides = {}) {
  return User.create({
    email: faker.internet.email(),
    password: 'hashedPassword123',
    role: 'operator',
    companyId: overrides.companyId,
    isActive: true,
    ...overrides
  });
}

export function createTestEvent(overrides = {}) {
  return Event.create({
    title: faker.lorem.sentence(),
    description: faker.lorem.paragraph(),
    status: 'active',
    priority: 'medium',
    location: {
      type: 'Point',
      coordinates: [faker.location.longitude(), faker.location.latitude()]
    },
    companyId: overrides.companyId,
    ...overrides
  });
}
```

---

## 4. Test Organization

### Directory Structure
```
backend/
├── src/
│   ├── services/
│   │   ├── event.service.ts
│   │   └── event.service.test.ts      # Unit tests alongside source
│   ├── routes/
│   │   ├── events.routes.ts
│   │   └── events.routes.test.ts      # Integration tests alongside routes
│   └── utils/
│       ├── logger.ts
│       └── logger.test.ts
├── test/
│   ├── setup.ts                        # Global test setup
│   ├── teardown.ts                     # Global test teardown
│   ├── db.ts                           # Database helpers
│   ├── factories.ts                    # Test data factories
│   └── helpers.ts                      # Common test utilities
└── jest.config.js
```

### Naming Conventions
- Unit tests: `{module}.test.ts`
- Integration tests: `{module}.test.ts` (in routes folder)
- Test files: Same name as source file with `.test.ts` suffix

---

## 5. Running Tests

### NPM Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest --testPathPattern=services|utils",
    "test:integration": "jest --testPathPattern=routes",
    "test:ci": "jest --ci --coverage --reporters=default --reporters=jest-junit"
  }
}
```

### Coverage Reports
```bash
# Generate HTML coverage report
npm run test:coverage

# View report
open coverage/lcov-report/index.html
```

### CI Integration
```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:ci
      - uses: codecov/codecov-action@v3
```

---

## 6. Mocking Strategies

### External Services
```typescript
// Mock VMS adapter
jest.mock('../adapters/vms.adapter', () => ({
  DirectRTSPAdapter: {
    getLiveStreamUrl: jest.fn().mockResolvedValue('rtsp://mock-stream'),
    getPlaybackUrl: jest.fn().mockResolvedValue('http://mock-playback'),
  }
}));
```

### Database Queries (Unit Tests)
```typescript
// Mock mongoose model
jest.mock('../models/event.model', () => ({
  Event: {
    find: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([])
  }
}));
```

### Time/Date
```typescript
// Freeze time for deterministic tests
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-01-12T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});
```

---

## 7. Swagger/OpenAPI Testing

### Interactive Testing
1. Start server: `npm run dev`
2. Open browser: `http://localhost:3000/api/docs`
3. Click "Authorize" and enter JWT
4. Test endpoints with "Try it out"

### Automated Validation
```typescript
// Validate response matches OpenAPI schema
import { OpenAPIValidator } from 'openapi-validator';

const validator = new OpenAPIValidator({ spec: './openapi.yaml' });

test('GET /api/events matches schema', async () => {
  const response = await request(app)
    .get('/api/events')
    .set('Authorization', `Bearer ${token}`);

  const errors = validator.validateResponse(
    'get',
    '/api/events',
    response.status,
    response.body
  );

  expect(errors).toHaveLength(0);
});
```

---

## 8. Frontend Testing

### Component Tests
```typescript
// src/components/EventList.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { EventList } from './EventList';
import { MockedProvider } from './test-utils';

test('displays loading state initially', () => {
  render(
    <MockedProvider>
      <EventList />
    </MockedProvider>
  );

  expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
});

test('displays events after loading', async () => {
  render(
    <MockedProvider events={mockEvents}>
      <EventList />
    </MockedProvider>
  );

  await waitFor(() => {
    expect(screen.getByText('Fire on Main St')).toBeInTheDocument();
  });
});
```

### API Mocking
```typescript
// Mock fetch for API calls
import { setupServer } from 'msw/node';
import { rest } from 'msw';

const server = setupServer(
  rest.get('/api/events', (req, res, ctx) => {
    return res(ctx.json({
      success: true,
      data: mockEvents,
      correlationId: 'test-123'
    }));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## 9. Test Checklist (Per Feature)

Use this checklist when implementing tests for each feature:

### Unit Tests
- [ ] Happy path (valid input → expected output)
- [ ] Edge cases (empty input, boundary values)
- [ ] Error cases (invalid input → proper error)
- [ ] Business logic branches (all if/else paths)

### Integration Tests
- [ ] Successful request (2xx response)
- [ ] Validation failure (400)
- [ ] Unauthorized request (401)
- [ ] Forbidden request (403)
- [ ] Not found (404)
- [ ] Tenant isolation (cannot access other company's data)
- [ ] Pagination (correct meta, page navigation)
- [ ] CorrelationId in response

### Contract Tests
- [ ] Request matches OpenAPI schema
- [ ] Response matches OpenAPI schema
- [ ] Error responses match schema

---

## 10. Debugging Failed Tests

### Verbose Output
```bash
npm test -- --verbose
```

### Single Test
```bash
npm test -- --testNamePattern="creates event"
```

### Debug Mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Check Database State
```typescript
// Add to test for debugging
console.log('Events in DB:', await Event.find({}).lean());
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-12 | AI-Assisted | Initial testing strategy |

---

*All code changes must include appropriate tests. PRs without tests for new functionality will be rejected.*
