/**
 * WebSocket Service
 * 
 * Manages WebSocket connections, company rooms, and real-time broadcasts
 * Enforces multi-tenant isolation through company-specific rooms
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { socketAuthMiddleware, AuthenticatedSocket } from '../middleware/socket-auth.middleware';
import { logger } from '../utils/logger';

/**
 * WebSocket event types
 */
export enum WebSocketEvent {
  // Events
  EVENT_CREATED = 'event:created',
  EVENT_UPDATED = 'event:updated',
  EVENT_DELETED = 'event:deleted',
  
  // Reports
  REPORT_CREATED = 'report:created',
  REPORT_UPDATED = 'report:updated',

  // Cameras
  CAMERA_STATUS = 'camera:status',
  
  // Cameras
  CAMERA_STATUS_UPDATED = 'camera:status_updated',
  
  // Connection
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  
  // Company room
  JOIN_COMPANY = 'join:company',
  LEAVE_COMPANY = 'leave:company',
}

/**
 * Connection tracking per company
 */
interface CompanyConnections {
  [companyId: string]: Set<string>; // socketId
}

/**
 * WebSocket Service
 * Singleton pattern to ensure single Socket.io instance
 */
class WebSocketService {
  private io: SocketIOServer | null = null;
  private companyConnections: CompanyConnections = {};

  /**
   * Initialize Socket.io server
   * 
   * @param httpServer HTTP server instance
   */
  public initialize(httpServer: HTTPServer): void {
    if (this.io) {
      logger.warn('websocket.initialize.already_initialized', {
        action: 'websocket.initialize',
      });
      return;
    }

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    // Apply authentication middleware
    this.io.use(socketAuthMiddleware);

    // Handle connections
    this.io.on(WebSocketEvent.CONNECTION, this.handleConnection.bind(this));

    logger.info('websocket.initialized', {
      action: 'websocket.initialize',
      transports: ['websocket', 'polling'],
    });
  }

  /**
   * Handle new WebSocket connection
   * 
   * @param socket Authenticated socket
   */
  private handleConnection(socket: Socket): void {
    const authSocket = socket as AuthenticatedSocket;
    const { user, correlationId } = authSocket;

    logger.info('websocket.connection.established', {
      correlationId,
      socketId: socket.id,
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
    });

    // Auto-join company room
    this.joinCompanyRoom(authSocket);

    // Track connection
    this.trackConnection(user.companyId, socket.id);

    // Handle disconnect
    socket.on(WebSocketEvent.DISCONNECT, (reason) => {
      this.handleDisconnect(authSocket, reason);
    });

    // Handle errors
    socket.on(WebSocketEvent.ERROR, (error) => {
      logger.error('websocket.connection.error', {
        correlationId,
        socketId: socket.id,
        userId: user.id,
        companyId: user.companyId,
        error: error.message,
      });
    });
  }

  /**
   * Join company-specific room
   * 
   * @param socket Authenticated socket
   */
  private joinCompanyRoom(socket: AuthenticatedSocket): void {
    const { user, correlationId } = socket;
    const roomName = this.getCompanyRoomName(user.companyId);

    socket.join(roomName);

    logger.info('websocket.room.joined', {
      correlationId,
      socketId: socket.id,
      userId: user.id,
      companyId: user.companyId,
      room: roomName,
    });

    // Notify client of successful join
    socket.emit(WebSocketEvent.JOIN_COMPANY, {
      success: true,
      companyId: user.companyId,
      connectionCount: this.getCompanyConnectionCount(user.companyId),
    });
  }

  /**
   * Handle socket disconnect
   * 
   * @param socket Authenticated socket
   * @param reason Disconnect reason
   */
  private handleDisconnect(socket: AuthenticatedSocket, reason: string): void {
    const { user, correlationId } = socket;

    logger.info('websocket.connection.disconnected', {
      correlationId,
      socketId: socket.id,
      userId: user.id,
      companyId: user.companyId,
      reason,
    });

    // Untrack connection
    this.untrackConnection(user.companyId, socket.id);
  }

  /**
   * Track connection in company connections map
   * 
   * @param companyId Company ID
   * @param socketId Socket ID
   */
  private trackConnection(companyId: string, socketId: string): void {
    if (!this.companyConnections[companyId]) {
      this.companyConnections[companyId] = new Set();
    }
    this.companyConnections[companyId].add(socketId);
  }

  /**
   * Untrack connection from company connections map
   * 
   * @param companyId Company ID
   * @param socketId Socket ID
   */
  private untrackConnection(companyId: string, socketId: string): void {
    if (this.companyConnections[companyId]) {
      this.companyConnections[companyId].delete(socketId);
      
      // Clean up empty sets
      if (this.companyConnections[companyId].size === 0) {
        delete this.companyConnections[companyId];
      }
    }
  }

  /**
   * Get company room name
   * 
   * @param companyId Company ID
   * @returns Room name
   */
  private getCompanyRoomName(companyId: string): string {
    return `company:${companyId}`;
  }

  /**
   * Get connection count for a company
   * 
   * @param companyId Company ID
   * @returns Number of active connections
   */
  public getCompanyConnectionCount(companyId: string): number {
    return this.companyConnections[companyId]?.size || 0;
  }

  /**
   * Get total connection count across all companies
   * 
   * @returns Total number of active connections
   */
  public getTotalConnectionCount(): number {
    return Object.values(this.companyConnections).reduce(
      (total, connections) => total + connections.size,
      0
    );
  }

  /**
   * Broadcast event to company room
   * 
   * @param companyId Company ID
   * @param event Event name
   * @param data Event data
   */
  public broadcastToCompany(companyId: string, event: string, data: any): void {
    if (!this.io) {
      logger.error('websocket.broadcast.not_initialized', {
        action: 'websocket.broadcast',
        companyId,
        event,
      });
      return;
    }

    const roomName = this.getCompanyRoomName(companyId);
    
    this.io.to(roomName).emit(event, data);

    logger.debug('websocket.broadcast.sent', {
      action: 'websocket.broadcast',
      companyId,
      room: roomName,
      event,
      connectionCount: this.getCompanyConnectionCount(companyId),
    });
  }

  /**
   * Broadcast event:created to company
   * 
   * @param companyId Company ID
   * @param eventData Event data
   */
  public broadcastEventCreated(companyId: string, eventData: any): void {
    this.broadcastToCompany(companyId, WebSocketEvent.EVENT_CREATED, eventData);
  }

  /**
   * Broadcast event:updated to company
   * 
   * @param companyId Company ID
   * @param eventData Event data
   */
  public broadcastEventUpdated(companyId: string, eventData: any): void {
    this.broadcastToCompany(companyId, WebSocketEvent.EVENT_UPDATED, eventData);
  }

  /**
   * Broadcast report:created to company
   * 
   * @param companyId Company ID
   * @param reportData Report data
   */
  public broadcastReportCreated(companyId: string, reportData: any): void {
    this.broadcastToCompany(companyId, WebSocketEvent.REPORT_CREATED, reportData);
  }

  /**
   * Broadcast camera:status to company
   *
   * @param companyId Company ID
   * @param statusData Status payload
   */
  public broadcastCameraStatus(companyId: string, statusData: any): void {
    this.broadcastToCompany(companyId, WebSocketEvent.CAMERA_STATUS, statusData);
  }

  /**
   * Broadcast camera:status_updated to company
   * 
   * @param companyId Company ID
   * @param cameraStatusData Camera status update data
   */
  public broadcastCameraStatusUpdated(companyId: string, cameraStatusData: {
    cameraId: string;
    oldStatus: string;
    newStatus: string;
    timestamp: Date;
    companyId: string;
  }): void {
    this.broadcastToCompany(companyId, WebSocketEvent.CAMERA_STATUS_UPDATED, cameraStatusData);
  }

  /**
   * Get Socket.io instance
   * WARNING: Use with caution, prefer using broadcast methods
   * 
   * @returns Socket.io server instance
   */
  public getIO(): SocketIOServer | null {
    return this.io;
  }

  /**
   * Close all connections and shutdown server
   */
  public async close(): Promise<void> {
    if (!this.io) {
      return;
    }

    logger.info('websocket.closing', {
      action: 'websocket.close',
      totalConnections: this.getTotalConnectionCount(),
    });

    // Disconnect all sockets
    const sockets = await this.io.fetchSockets();
    sockets.forEach(socket => socket.disconnect(true));

    // Close server
    this.io.close();
    this.io = null;
    this.companyConnections = {};

    logger.info('websocket.closed', {
      action: 'websocket.close',
    });
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
