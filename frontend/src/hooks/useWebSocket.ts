/**
 * WebSocket Hook
 * React hook for subscribing to WebSocket events
 */

import { useEffect, useState, useCallback } from 'react';
import { websocketService, WebSocketEvent, ConnectionStatus } from '../services/websocket';

/**
 * Hook to get WebSocket connection status
 */
export function useWebSocketStatus() {
  const [status, setStatus] = useState<ConnectionStatus>(websocketService.getStatus());

  useEffect(() => {
    const unsubscribe = websocketService.onStatusChange(setStatus);
    return unsubscribe;
  }, []);

  return {
    status,
    isConnected: status === ConnectionStatus.CONNECTED,
    isConnecting: status === ConnectionStatus.CONNECTING,
    isReconnecting: status === ConnectionStatus.RECONNECTING,
    isDisconnected: status === ConnectionStatus.DISCONNECTED,
    isError: status === ConnectionStatus.ERROR,
  };
}

/**
 * Hook to subscribe to WebSocket events
 * 
 * @param event Event name
 * @param callback Event callback
 */
export function useWebSocketEvent<T = any>(
  event: WebSocketEvent | string,
  callback: (data: T) => void
) {
  useEffect(() => {
    const unsubscribe = websocketService.on<T>(event, callback);
    return unsubscribe;
  }, [event, callback]);
}

/**
 * Hook to listen for new events
 */
export function useEventCreated(callback: (event: any) => void) {
  const stableCallback = useCallback(callback, [callback]);
  useWebSocketEvent(WebSocketEvent.EVENT_CREATED, stableCallback);
}

/**
 * Hook to listen for event updates
 */
export function useEventUpdated(callback: (event: any) => void) {
  const stableCallback = useCallback(callback, [callback]);
  useWebSocketEvent(WebSocketEvent.EVENT_UPDATED, stableCallback);
}

/**
 * Hook to listen for new reports
 */
export function useReportCreated(callback: (report: any) => void) {
  const stableCallback = useCallback(callback, [callback]);
  useWebSocketEvent(WebSocketEvent.REPORT_CREATED, stableCallback);
}

/**
 * Hook to listen for camera status updates
 */
export function useCameraStatus(callback: (payload: any) => void) {
  const stableCallback = useCallback(callback, [callback]);
  useWebSocketEvent(WebSocketEvent.CAMERA_STATUS, stableCallback);
}

/**
 * Hook to listen for camera status updates
 */
export function useCameraStatusUpdated(callback: (update: {
  cameraId: string;
  oldStatus: string;
  newStatus: string;
  timestamp: Date;
  companyId: string;
}) => void) {
  const stableCallback = useCallback(callback, [callback]);
  useWebSocketEvent(WebSocketEvent.CAMERA_STATUS_UPDATED, stableCallback);
}
