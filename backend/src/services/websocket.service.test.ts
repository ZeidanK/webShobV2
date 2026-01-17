/**
 * WebSocket Integration Tests
 * Tests WebSocket connection, authentication, company room isolation, and event broadcasts
 */

import { Server } from 'http';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import express from 'express';
import { setupTestDB, teardownTestDB } from '../test/db';
import { User } from '../models/user.model';
import { Company, CompanyType } from '../models/company.model';
import { config } from '../config';
import { websocketService } from '../services/websocket.service';

describe('WebSocket Integration Tests', () => {
  let httpServer: Server | null;
  let company1Id: string;
  let company2Id: string;
  let user1Id: string;
  let user2Id: string;
  let token1: string;
  let token2: string;

  beforeAll(async () => {
    await setupTestDB();

    // Create HTTP server and initialize WebSocket
    const app = express();
    httpServer = app.listen(0);
    websocketService.initialize(httpServer);
  });

  beforeEach(async () => {
    // Create test companies
    const company1 = await Company.create({
      name: 'Test Company 1',
      type: CompanyType.STANDARD,
      status: 'active',
    });
    company1Id = company1._id.toString();

    const company2 = await Company.create({
      name: 'Test Company 2',
      type: CompanyType.STANDARD,
      status: 'active',
    });
    company2Id = company2._id.toString();

    // Create test users
    const user1 = await User.create({
      email: 'user1@company1.com',
      password: 'password123',
      firstName: 'User',
      lastName: 'One',
      role: 'operator',
      companyId: company1._id,
      isActive: true,
    });
    user1Id = user1._id.toString();

    const user2 = await User.create({
      email: 'user2@company2.com',
      password: 'password123',
      firstName: 'User',
      lastName: 'Two',
      role: 'operator',
      companyId: company2._id,
      isActive: true,
    });
    user2Id = user2._id.toString();

    // Generate JWT tokens
    token1 = jwt.sign(
      {
        userId: user1Id,
        companyId: company1Id,
        role: 'operator',
        email: 'user1@company1.com',
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    token2 = jwt.sign(
      {
        userId: user2Id,
        companyId: company2Id,
        role: 'operator',
        email: 'user2@company2.com',
      },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    await websocketService.close();
    if (httpServer) {
      httpServer.close();
    }
    await teardownTestDB();
  });

  describe('WebSocket Connection', () => {
    it('should connect with valid JWT token', (done) => {
      const address = httpServer!.address();
      if (!address || typeof address === 'string') {
        throw new Error('Invalid server address');
      }
      
      const port = address.port;
      const client = ioClient(`http://localhost:${port}`, {
        auth: { token: token1 },
        transports: ['websocket'],
      });

      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
        done();
      });

      client.on('connect_error', (error: Error) => {
        done(error);
      });
    });

    it('should reject connection without token', (done) => {
      const address = httpServer!.address();
      if (!address || typeof address === 'string') {
        throw new Error('Invalid server address');
      }
      
      const port = address.port;
      const client = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
      });

      client.on('connect', () => {
        client.disconnect();
        done(new Error('Should not connect without token'));
      });

      client.on('connect_error', (error: Error) => {
        expect(error.message).toContain('AUTHENTICATION_REQUIRED');
        done();
      });
    });

    it('should reject connection with invalid token', (done) => {
      const address = httpServer!.address();
      if (!address || typeof address === 'string') {
        throw new Error('Invalid server address');
      }
      
      const port = address.port;
      const client = ioClient(`http://localhost:${port}`, {
        auth: { token: 'invalid-token' },
        transports: ['websocket'],
      });

      client.on('connect', () => {
        client.disconnect();
        done(new Error('Should not connect with invalid token'));
      });

      client.on('connect_error', (error: Error) => {
        expect(error.message).toBeTruthy();
        done();
      });
    });
  });

  describe('Company Room Isolation', () => {
    let client1: ClientSocket;
    let client2: ClientSocket;

    beforeEach((done) => {
      const address = httpServer!.address();
      if (!address || typeof address === 'string') {
        throw new Error('Invalid server address');
      }
      
      const port = address.port;

      // Connect both clients
      client1 = ioClient(`http://localhost:${port}`, {
        auth: { token: token1 },
        transports: ['websocket'],
      });

      client2 = ioClient(`http://localhost:${port}`, {
        auth: { token: token2 },
        transports: ['websocket'],
      });

      let connectedCount = 0;
      const checkBothConnected = () => {
        connectedCount++;
        if (connectedCount === 2) {
          done();
        }
      };

      client1.on('connect', checkBothConnected);
      client2.on('connect', checkBothConnected);
    });

    afterEach(() => {
      client1?.disconnect();
      client2?.disconnect();
    });

    it('should only receive events for own company', (done) => {
      let client1ReceivedEvent = false;
      let client2ReceivedEvent = false;

      // Set up listeners
      client1.on('event:created', () => {
        client1ReceivedEvent = true;
      });

      client2.on('event:created', () => {
        client2ReceivedEvent = true;
      });

      // Broadcast to company1 only
      websocketService.broadcastEventCreated(company1Id, {
        _id: 'test-event-1',
        title: 'Test Event for Company 1',
        priority: 'high',
      });

      // Wait and verify
      setTimeout(() => {
        expect(client1ReceivedEvent).toBe(true);
        expect(client2ReceivedEvent).toBe(false);
        done();
      }, 200);
    });

    it('should receive broadcasts for own company only', (done) => {
      const eventsReceived: string[] = [];

      client1.on('event:created', (data: any) => {
        eventsReceived.push(data._id);
      });

      // Broadcast to company1
      websocketService.broadcastEventCreated(company1Id, {
        _id: 'event-company1',
        title: 'Event for Company 1',
      });

      // Broadcast to company2
      websocketService.broadcastEventCreated(company2Id, {
        _id: 'event-company2',
        title: 'Event for Company 2',
      });

      setTimeout(() => {
        expect(eventsReceived).toContain('event-company1');
        expect(eventsReceived).not.toContain('event-company2');
        done();
      }, 200);
    });
  });

  describe('Event Broadcasts', () => {
    let client: ClientSocket;

    beforeEach((done) => {
      const address = httpServer!.address();
      if (!address || typeof address === 'string') {
        throw new Error('Invalid server address');
      }
      
      const port = address.port;

      client = ioClient(`http://localhost:${port}`, {
        auth: { token: token1 },
        transports: ['websocket'],
      });

      client.on('connect', () => {
        done();
      });
    });

    afterEach(() => {
      client?.disconnect();
    });

    it('should receive event:created broadcast', (done) => {
      const testEvent = {
        _id: 'test-event',
        title: 'Test Event',
        description: 'Test Description',
        status: 'active',
        priority: 'high',
      };

      client.on('event:created', (data) => {
        expect(data._id).toBe(testEvent._id);
        expect(data.title).toBe(testEvent.title);
        expect(data.priority).toBe(testEvent.priority);
        done();
      });

      websocketService.broadcastEventCreated(company1Id, testEvent);
    });

    it('should receive event:updated broadcast', (done) => {
      const testEvent = {
        _id: 'test-event',
        title: 'Updated Event',
        status: 'resolved',
      };

      client.on('event:updated', (data) => {
        expect(data._id).toBe(testEvent._id);
        expect(data.title).toBe(testEvent.title);
        expect(data.status).toBe(testEvent.status);
        done();
      });

      websocketService.broadcastEventUpdated(company1Id, testEvent);
    });

    it('should receive report:created broadcast', (done) => {
      const testReport = {
        _id: 'test-report',
        title: 'Test Report',
        type: 'citizen',
        status: 'pending',
      };

      client.on('report:created', (data) => {
        expect(data._id).toBe(testReport._id);
        expect(data.title).toBe(testReport.title);
        expect(data.type).toBe(testReport.type);
        done();
      });

      websocketService.broadcastReportCreated(company1Id, testReport);
    });
  });

  describe('Connection Tracking', () => {
    it('should track active connections per company', (done) => {
      const address = httpServer!.address();
      if (!address || typeof address === 'string') {
        throw new Error('Invalid server address');
      }
      
      const port = address.port;

      const client1 = ioClient(`http://localhost:${port}`, {
        auth: { token: token1 },
        transports: ['websocket'],
      });

      const client2 = ioClient(`http://localhost:${port}`, {
        auth: { token: token1 }, // Same company
        transports: ['websocket'],
      });

      let connectedCount = 0;
      const checkBothConnected = () => {
        connectedCount++;
        if (connectedCount === 2) {
          // Both clients connected
          setTimeout(() => {
            const count = websocketService.getCompanyConnectionCount(company1Id);
            expect(count).toBe(2);
            
            client1.disconnect();
            client2.disconnect();
            done();
          }, 100);
        }
      };

      client1.on('connect', checkBothConnected);
      client2.on('connect', checkBothConnected);
    });
  });
});
