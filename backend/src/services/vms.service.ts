/**
 * VMS Service
 * 
 * Handles all VMS server operations including:
 * - CRUD operations for VMS servers
 * - Monitor (camera) discovery from VMS
 * - Stream URL generation for different providers
 * 
 * Multi-tenant: All operations filter by companyId.
 */

import mongoose from 'mongoose';
import { VmsServer, IVmsServer, VmsProvider } from '../models';
import { NotFoundError, ValidationError, ExternalServiceError } from '../utils/errors';
import { logger } from '../utils/logger';

/** Monitor info returned from VMS discovery */
export interface VmsMonitor {
  id: string;
  name: string;
  mode?: string;
  status?: string;
  host?: string;
  type?: string;
}

/** Stream URLs for a camera */
export interface StreamUrls {
  hls?: string;
  embed?: string;
  snapshot?: string;
  raw?: string;
}

/** Pagination options */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** Filter options for VMS servers */
export interface VmsServerFilters {
  provider?: VmsProvider;
  isActive?: boolean;
  search?: string;
}

/** Create VMS server input */
export interface CreateVmsServerInput {
  name: string;
  provider: VmsProvider;
  baseUrl: string;
  auth?: {
    apiKey?: string;
    groupKey?: string;
    username?: string;
    password?: string;
  };
  isActive?: boolean;
}

/** Update VMS server input */
export interface UpdateVmsServerInput {
  name?: string;
  baseUrl?: string;
  auth?: {
    apiKey?: string;
    groupKey?: string;
    username?: string;
    password?: string;
  };
  isActive?: boolean;
}

class VmsService {
  /**
   * Create a new VMS server
   */
  async create(
    companyId: mongoose.Types.ObjectId,
    data: CreateVmsServerInput,
    userId?: mongoose.Types.ObjectId
  ): Promise<IVmsServer> {
    logger.info('Creating VMS server', { companyId, provider: data.provider, name: data.name });

    const server = new VmsServer({
      ...data,
      companyId,
      createdBy: userId,
      updatedBy: userId,
    });

    await server.save();

    logger.info('VMS server created', { serverId: server._id, provider: data.provider });
    return server;
  }

  /**
   * Get all VMS servers for a company with optional filtering
   */
  async findAll(
    companyId: mongoose.Types.ObjectId,
    filters: VmsServerFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<{ servers: IVmsServer[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = pagination;
    const skip = (page - 1) * limit;

    // Build query - ALWAYS filter by companyId
    const query: Record<string, unknown> = { companyId };

    if (filters.provider) {
      query.provider = filters.provider;
    }

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { baseUrl: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const [servers, total] = await Promise.all([
      VmsServer.find(query)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VmsServer.countDocuments(query),
    ]);

    // Remove auth from lean results (toJSON transform doesn't apply to lean)
    const sanitizedServers = servers.map(s => {
      const { auth, ...rest } = s as Record<string, unknown>;
      return rest;
    });

    return { servers: sanitizedServers as unknown as IVmsServer[], total, page, limit };
  }

  /**
   * Get a single VMS server by ID
   */
  async findById(
    companyId: mongoose.Types.ObjectId,
    serverId: mongoose.Types.ObjectId
  ): Promise<IVmsServer | null> {
    // ALWAYS filter by companyId
    const server = await VmsServer.findOne({ _id: serverId, companyId }).lean();
    if (!server) return null;
    
    // Remove auth from lean results (toJSON transform doesn't apply to lean)
    const { auth, ...rest } = server as Record<string, unknown>;
    return rest as unknown as IVmsServer;
  }

  /**
   * Get VMS server with auth credentials (for internal use only)
   */
  async findByIdWithAuth(
    companyId: mongoose.Types.ObjectId,
    serverId: mongoose.Types.ObjectId
  ): Promise<IVmsServer | null> {
    // ALWAYS filter by companyId
    const server = await VmsServer.findOne({ _id: serverId, companyId })
      .select('+auth.apiKey +auth.groupKey +auth.username +auth.password')
      .lean();
    return server as IVmsServer | null;
  }

  /**
   * Update a VMS server
   */
  async update(
    companyId: mongoose.Types.ObjectId,
    serverId: mongoose.Types.ObjectId,
    data: UpdateVmsServerInput,
    userId?: mongoose.Types.ObjectId
  ): Promise<IVmsServer> {
    // ALWAYS filter by companyId, include auth for validation
    const server = await VmsServer.findOne({ _id: serverId, companyId })
      .select('+auth.apiKey +auth.groupKey +auth.username +auth.password');

    if (!server) {
      throw new NotFoundError(`VMS server with ID ${serverId} not found`);
    }

    // Update fields
    if (data.name !== undefined) server.name = data.name;
    if (data.baseUrl !== undefined) server.baseUrl = data.baseUrl;
    if (data.isActive !== undefined) server.isActive = data.isActive;
    
    // Handle auth updates (merge with existing)
    if (data.auth) {
      server.auth = {
        ...server.auth,
        ...data.auth,
      };
    }

    server.updatedBy = userId;
    await server.save();

    logger.info('VMS server updated', { serverId, provider: server.provider });
    return server;
  }

  /**
   * Delete a VMS server
   */
  async delete(
    companyId: mongoose.Types.ObjectId,
    serverId: mongoose.Types.ObjectId
  ): Promise<void> {
    // ALWAYS filter by companyId
    const result = await VmsServer.deleteOne({ _id: serverId, companyId });

    if (result.deletedCount === 0) {
      throw new NotFoundError(`VMS server with ID ${serverId} not found`);
    }

    logger.info('VMS server deleted', { serverId });
  }

  /**
   * Test connection to a VMS server
   */
  async testConnection(
    companyId: mongoose.Types.ObjectId,
    serverId: mongoose.Types.ObjectId
  ): Promise<{ success: boolean; message: string; monitors?: number }> {
    const server = await this.findByIdWithAuth(companyId, serverId);

    if (!server) {
      throw new NotFoundError(`VMS server with ID ${serverId} not found`);
    }

    try {
      switch (server.provider) {
        case 'shinobi':
          return await this.testShinobiConnection(server);
        case 'zoneminder':
          return { success: false, message: 'ZoneMinder integration not yet implemented' };
        case 'agentdvr':
          return { success: false, message: 'AgentDVR integration not yet implemented' };
        default:
          return { success: false, message: `Unknown provider: ${server.provider}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      
      // Update server status
      await VmsServer.updateOne(
        { _id: serverId, companyId },
        {
          connectionStatus: 'error',
          lastError: message,
        }
      );

      logger.error('VMS connection test failed', { serverId, error: message });
      throw new ExternalServiceError(`VMS connection failed: ${message}`);
    }
  }

  /**
   * Discover monitors (cameras) from a VMS server
   */
  async discoverMonitors(
    companyId: mongoose.Types.ObjectId,
    serverId: mongoose.Types.ObjectId
  ): Promise<VmsMonitor[]> {
    const server = await this.findByIdWithAuth(companyId, serverId);

    if (!server) {
      throw new NotFoundError(`VMS server with ID ${serverId} not found`);
    }

    try {
      switch (server.provider) {
        case 'shinobi':
          return await this.discoverShinobiMonitors(server);
        case 'zoneminder':
          return [];
        case 'agentdvr':
          return [];
        default:
          return [];
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Monitor discovery failed';
      logger.error('VMS monitor discovery failed', { serverId, error: message });
      throw new ExternalServiceError(`Monitor discovery failed: ${message}`);
    }
  }

  /**
   * Generate stream URLs for a camera connected to VMS
   */
  async getStreamUrls(
    server: IVmsServer,
    monitorId: string
  ): Promise<StreamUrls> {
    switch (server.provider) {
      case 'shinobi':
        return this.getShinobiStreamUrls(server, monitorId);
      case 'zoneminder':
        return {};
      case 'agentdvr':
        return {};
      default:
        return {};
    }
  }

  // ==================== SHINOBI IMPLEMENTATION ====================

  /**
   * Test Shinobi server connection
   */
  private async testShinobiConnection(
    server: IVmsServer
  ): Promise<{ success: boolean; message: string; monitors?: number }> {
    const { baseUrl, auth } = server;

    if (!auth?.apiKey || !auth?.groupKey) {
      throw new ValidationError('Shinobi requires apiKey and groupKey');
    }

    // Build URL: /api/{apiKey}/monitor/{groupKey}
    const url = `${baseUrl}/${auth.apiKey}/monitor/${auth.groupKey}`;

    logger.debug('Testing Shinobi connection', { url: url.replace(auth.apiKey, '***') });

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Shinobi returned status ${response.status}`);
    }

    const data = await response.json();

    // Shinobi returns array of monitors on success
    const monitors = Array.isArray(data) ? data.length : 0;

    // Update server status
    await VmsServer.updateOne(
      { _id: server._id },
      {
        connectionStatus: 'connected',
        lastConnectedAt: new Date(),
        lastError: undefined,
      }
    );

    return {
      success: true,
      message: `Connected successfully. Found ${monitors} monitor(s).`,
      monitors,
    };
  }

  /**
   * Discover monitors from Shinobi
   */
  private async discoverShinobiMonitors(server: IVmsServer): Promise<VmsMonitor[]> {
    const { baseUrl, auth } = server;

    if (!auth?.apiKey || !auth?.groupKey) {
      throw new ValidationError('Shinobi requires apiKey and groupKey');
    }

    const url = `${baseUrl}/${auth.apiKey}/monitor/${auth.groupKey}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Shinobi returned status ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      return [];
    }

    // Map Shinobi monitor format to our format
    return data.map((monitor: Record<string, unknown>) => ({
      id: String(monitor.mid || monitor.id || ''),
      name: String(monitor.name || 'Unnamed'),
      mode: String(monitor.mode || 'unknown'),
      status: String(monitor.status || 'unknown'),
      host: String(monitor.host || ''),
      type: String(monitor.type || 'unknown'),
    }));
  }

  /**
   * Generate Shinobi stream URLs
   * 
   * Shinobi URL patterns:
   * - HLS: {baseUrl}/{apiKey}/hls/{groupKey}/{monitorId}/s.m3u8
   * - Embed: {baseUrl}/{apiKey}/embed/{groupKey}/{monitorId}
   * - Snapshot: {baseUrl}/{apiKey}/jpeg/{groupKey}/{monitorId}/s.jpg
   */
  private getShinobiStreamUrls(server: IVmsServer, monitorId: string): StreamUrls {
    const { baseUrl, auth } = server;

    if (!auth?.apiKey || !auth?.groupKey) {
      logger.warn('Missing Shinobi auth for stream URL generation', { serverId: server._id });
      return {};
    }

    const apiKey = auth.apiKey;
    const groupKey = auth.groupKey;

    return {
      hls: `${baseUrl}/${apiKey}/hls/${groupKey}/${monitorId}/s.m3u8`,
      embed: `${baseUrl}/${apiKey}/embed/${groupKey}/${monitorId}`,
      snapshot: `${baseUrl}/${apiKey}/jpeg/${groupKey}/${monitorId}/s.jpg`,
    };
  }

  /**
   * Update connection status for a server
   */
  async updateConnectionStatus(
    serverId: mongoose.Types.ObjectId,
    status: 'connected' | 'disconnected' | 'error' | 'unknown',
    error?: string
  ): Promise<void> {
    const update: Record<string, unknown> = { connectionStatus: status };
    
    if (status === 'connected') {
      update.lastConnectedAt = new Date();
      update.lastError = undefined;
    } else if (error) {
      update.lastError = error;
    }

    await VmsServer.updateOne({ _id: serverId }, update);
  }
}

export const vmsService = new VmsService();
