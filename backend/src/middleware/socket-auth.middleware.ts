/**
 * WebSocket Authentication Middleware
 * 
 * Validates JWT tokens for WebSocket connections
 * Extracts user context and attaches to socket
 */

import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';
import { User } from '../models/user.model';

/**
 * Extended Socket interface with user context
 */
export interface AuthenticatedSocket extends Socket {
  user: {
    id: string;
    companyId: string;
    role: string;
    email: string;
  };
  correlationId: string;
}

/**
 * JWT authentication middleware for Socket.io
 * 
 * Validates token from:
 * 1. handshake.auth.token
 * 2. handshake.headers.authorization
 * 
 * @param socket Socket instance
 * @param next Callback to proceed or reject connection
 */
export const socketAuthMiddleware = async (
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> => {
  const correlationId = socket.handshake.headers['x-correlation-id'] as string || 
                         socket.handshake.auth.correlationId || 
                         socket.id;

  try {
    // Extract token from auth or headers
    let token: string | undefined = socket.handshake.auth.token;

    if (!token) {
      const authHeader = socket.handshake.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      logger.warn('websocket.auth.missing_token', {
        correlationId,
        socketId: socket.id,
        remoteAddress: socket.handshake.address,
      });
      return next(new Error('AUTHENTICATION_REQUIRED'));
    }

    // Verify JWT
    const decoded = jwt.verify(token, config.jwt.secret) as {
      userId: string;
      companyId: string;
      role: string;
      email: string;
    };

    // Validate user exists and is active
    const user = await User.findById(decoded.userId).select('_id companyId role email isActive');

    if (!user || !user.isActive) {
      logger.warn('websocket.auth.invalid_user', {
        correlationId,
        socketId: socket.id,
        userId: decoded.userId,
        userExists: !!user,
        userActive: user?.isActive,
      });
      return next(new Error('INVALID_USER'));
    }

    // Attach user context to socket
    (socket as AuthenticatedSocket).user = {
      id: user._id.toString(),
      companyId: user.companyId.toString(),
      role: user.role,
      email: user.email,
    };

    (socket as AuthenticatedSocket).correlationId = correlationId;

    logger.info('websocket.auth.success', {
      correlationId,
      socketId: socket.id,
      userId: user._id.toString(),
      companyId: user.companyId.toString(),
      role: user.role,
    });

    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'AUTHENTICATION_FAILED';
    
    logger.error('websocket.auth.failed', {
      correlationId,
      socketId: socket.id,
      error: errorMessage,
      remoteAddress: socket.handshake.address,
    });

    next(new Error(errorMessage));
  }
};
