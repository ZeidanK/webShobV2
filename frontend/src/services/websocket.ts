/**
 * WebSocket Service for Real-Time Updates
 * 
 * Manages WebSocket connection to backend with:
 * - JWT authentication
 * - Auto-reconnection
 * - Company room subscription
 * - Event and Report real-time updates
 */

import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

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
  
  // Connection
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  CONNECT_ERROR = 'connect_error',
  RECONNECT = 'reconnect',
  RECONNECT_ATTEMPT = 'reconnect_attempt',
  RECONNECT_ERROR = 'reconnect_error',
  RECONNECT_FAILED = 'reconnect_failed',
  
  // Company room
  JOIN_COMPANY = 'join:company',
  LEAVE_COMPANY = 'leave:company',
}

/**
 * Event listener callback type
 */
type EventCallback<T = any> = (data: T) => void;

/**
 * Connection status
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * WebSocket Service Class
 */
class WebSocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();

  /**
   * Initialize WebSocket connection
   * 
   * @param token JWT token for authentication
   */
  public connect(token: string): void {
    if (this.socket?.connected) {
      console.log('[WebSocket] Already connected');
      return;
    }

    this.token = token;
    this.setStatus(ConnectionStatus.CONNECTING);

    this.socket = io(WS_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
    });

    this.setupEventHandlers();
    console.log('[WebSocket] Connecting to', WS_URL);
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on(WebSocketEvent.CONNECT, () => {
      console.log('[WebSocket] Connected', this.socket?.id);
      this.setStatus(ConnectionStatus.CONNECTED);
    });

    this.socket.on(WebSocketEvent.DISCONNECT, (reason: string) => {
      console.log('[WebSocket] Disconnected', reason);
      this.setStatus(ConnectionStatus.DISCONNECTED);
    });

    this.socket.on(WebSocketEvent.CONNECT_ERROR, (error: Error) => {
      console.error('[WebSocket] Connection error', error.message);
      this.setStatus(ConnectionStatus.ERROR);
    });

    this.socket.on(WebSocketEvent.RECONNECT, (attemptNumber: number) => {
      console.log('[WebSocket] Reconnected after', attemptNumber, 'attempts');
      this.setStatus(ConnectionStatus.CONNECTED);
    });

    this.socket.on(WebSocketEvent.RECONNECT_ATTEMPT, (attemptNumber: number) => {
      console.log('[WebSocket] Reconnection attempt', attemptNumber);
      this.setStatus(ConnectionStatus.RECONNECTING);
    });

    this.socket.on(WebSocketEvent.RECONNECT_ERROR, (error: Error) => {
      console.error('[WebSocket] Reconnection error', error.message);
      this.setStatus(ConnectionStatus.ERROR);
    });

    this.socket.on(WebSocketEvent.RECONNECT_FAILED, () => {
      console.error('[WebSocket] Reconnection failed');
      this.setStatus(ConnectionStatus.ERROR);
    });

    // Company room events
    this.socket.on(WebSocketEvent.JOIN_COMPANY, (data: any) => {
      console.log('[WebSocket] Joined company room', data);
    });

    // Real-time data events
    this.socket.on(WebSocketEvent.EVENT_CREATED, (data: any) => {
      console.log('[WebSocket] Event created', data);
      this.emit(WebSocketEvent.EVENT_CREATED, data);
    });

    this.socket.on(WebSocketEvent.EVENT_UPDATED, (data: any) => {
      console.log('[WebSocket] Event updated', data);
      this.emit(WebSocketEvent.EVENT_UPDATED, data);
    });

    this.socket.on(WebSocketEvent.REPORT_CREATED, (data: any) => {
      console.log('[WebSocket] Report created', data);
      this.emit(WebSocketEvent.REPORT_CREATED, data);
    });

    this.socket.on(WebSocketEvent.CAMERA_STATUS, (data: any) => {
      console.log('[WebSocket] Camera status', data);
      this.emit(WebSocketEvent.CAMERA_STATUS, data);
    });
  }

  /**
   * Disconnect WebSocket
   */
  public disconnect(): void {
    if (this.socket) {
      console.log('[WebSocket] Disconnecting');
      this.socket.disconnect();
      this.socket = null;
      this.token = null;
      this.setStatus(ConnectionStatus.DISCONNECTED);
      this.clearAllListeners();
    }
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get connection status
   */
  public getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * Set connection status and notify listeners
   */
  private setStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.statusListeners.forEach(listener => listener(status));
  }

  /**
   * Subscribe to connection status changes
   * 
   * @param callback Status change callback
   * @returns Unsubscribe function
   */
  public onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  /**
   * Subscribe to WebSocket event
   * 
   * @param event Event name
   * @param callback Event callback
   * @returns Unsubscribe function
   */
  public on<T = any>(event: WebSocketEvent | string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback);
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  /**
   * Emit event to all subscribers
   * 
   * @param event Event name
   * @param data Event data
   */
  private emit<T = any>(event: string, data: T): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('[WebSocket] Error in event listener', event, error);
        }
      });
    }
  }

  /**
   * Clear all event listeners
   */
  private clearAllListeners(): void {
    this.listeners.clear();
    this.statusListeners.clear();
  }

  /**
   * Manually emit event (for testing)
   */
  public send(event: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('[WebSocket] Cannot send, not connected');
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
