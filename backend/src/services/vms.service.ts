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
import jwt from 'jsonwebtoken';
import { VmsServer, IVmsServer, VmsProvider, Camera, CameraStatus, AuditLog, AuditAction } from '../models';
import { AppError, ErrorCodes, NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { VmsAdapterFactory, type VmsAdapterCapabilities } from '../adapters/vms/factory';
import { config } from '../config';

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

interface PlaybackTokenPayload {
  scope: 'vms-playback';
  cameraId: string;
  companyId: string;
  serverId: string;
  monitorId: string;
  filename: string;
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

/** Optional audit context for VMS operations */
export interface VmsAuditContext {
  userId?: mongoose.Types.ObjectId;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/** Create VMS server input */
export interface CreateVmsServerInput {
  name: string;
  provider: VmsProvider;
  baseUrl: string;
  // TEST-ONLY: Public base URL for browser access (optional).
  publicBaseUrl?: string;
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
  // TEST-ONLY: Public base URL for browser access (optional).
  publicBaseUrl?: string;
  auth?: {
    apiKey?: string;
    groupKey?: string;
    username?: string;
    password?: string;
  };
  isActive?: boolean;
}

class VmsService {
  // Normalize VMS base URL and derive public URL for browser playback in Docker dev.
  private normalizeVmsUrls(baseUrl: string, publicBaseUrl?: string): { baseUrl: string; publicBaseUrl?: string } {
    const trimmedBaseUrl = baseUrl.replace(/\/+$/, '');
    const trimmedPublicUrl = publicBaseUrl ? publicBaseUrl.replace(/\/+$/, '') : undefined;
    if (trimmedPublicUrl) {
      return { baseUrl: trimmedBaseUrl, publicBaseUrl: trimmedPublicUrl };
    }

    try {
      const parsed = new URL(trimmedBaseUrl);
      const isLocalhost = ['localhost', '127.0.0.1'].includes(parsed.hostname);
      if (isLocalhost) {
        const internalUrl = `${parsed.protocol}//host.docker.internal${parsed.port ? `:${parsed.port}` : ''}`;
        return { baseUrl: internalUrl, publicBaseUrl: trimmedBaseUrl };
      }
    } catch {
      // Leave URLs as-is when parsing fails.
    }

    return { baseUrl: trimmedBaseUrl };
  }
  // TEST-ONLY: Validate Shinobi playback filenames to prevent traversal.
  private validateShinobiPlaybackFilename(filename: string): boolean {
    return /^[0-9TZ\-:]+\.mp4$/i.test(filename);
  }

  // TEST-ONLY: Expose playback filename validation for route guards.
  isValidPlaybackFilename(filename: string): boolean {
    return this.validateShinobiPlaybackFilename(filename);
  }

  // TEST-ONLY: Create a short-lived playback token for proxying Shinobi clips.
  createPlaybackToken(
    cameraId: string,
    companyId: string,
    serverId: string,
    monitorId: string,
    filename: string
  ): string {
    const payload: PlaybackTokenPayload = {
      scope: 'vms-playback',
      cameraId,
      companyId,
      serverId,
      monitorId,
      filename,
    };
    return jwt.sign(payload, config.jwt.secret, { expiresIn: config.streaming.tokenTtlSeconds });
  }

  // TEST-ONLY: Verify playback token payload and scope.
  verifyPlaybackToken(token: string): PlaybackTokenPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as PlaybackTokenPayload;
      if (decoded.scope !== 'vms-playback') {
        throw new AppError(ErrorCodes.PLAYBACK_TOKEN_INVALID, 'Invalid playback token scope', 401);
      }
      return decoded;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new AppError(ErrorCodes.PLAYBACK_TOKEN_EXPIRED, 'Playback token expired', 401);
      }
      throw new AppError(ErrorCodes.PLAYBACK_TOKEN_INVALID, 'Invalid playback token', 401);
    }
  }
  // TEST-ONLY: normalize Shinobi monitor status to a camera status.
  private mapShinobiStatus(status?: string): CameraStatus {
    const normalized = (status || '').toLowerCase();
    if (['watching', 'recording', 'online', 'active', 'connected', 'started'].includes(normalized)) {
      return 'online';
    }
    if (['paused', 'stopped', 'offline', 'disconnected', 'error'].includes(normalized)) {
      return 'offline';
    }
    return 'offline';
  }
  // TEST-ONLY: Persist a VMS audit entry with standard metadata.
  private async writeAuditLog(
    action: AuditAction,
    companyId: mongoose.Types.ObjectId,
    resourceId: mongoose.Types.ObjectId | undefined,
    changes: Record<string, unknown> | undefined,
    metadata: Record<string, unknown> | undefined,
    context?: VmsAuditContext
  ): Promise<void> {
    await AuditLog.create({
      action,
      companyId,
      resourceType: 'VmsServer',
      resourceId,
      userId: context?.userId,
      changes,
      metadata,
      correlationId: context?.correlationId,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });
  }
  /**
   * Create a new VMS server
   */
  async create(
    companyId: mongoose.Types.ObjectId,
    data: CreateVmsServerInput,
    userId?: mongoose.Types.ObjectId,
    context?: VmsAuditContext
  ): Promise<IVmsServer> {
    logger.info({
      action: 'vms.create.start',
      context: { companyId: companyId.toString(), provider: data.provider, name: data.name },
      correlationId: context?.correlationId,
    });

    const urls = this.normalizeVmsUrls(data.baseUrl, data.publicBaseUrl);
    const server = new VmsServer({
      ...data,
      baseUrl: urls.baseUrl,
      publicBaseUrl: urls.publicBaseUrl,
      companyId,
      createdBy: userId,
      updatedBy: userId,
    });

    await server.save();

    // TEST-ONLY: Record audit metadata for VMS server creation.
    await this.writeAuditLog(
      AuditAction.VMS_SERVER_CREATED,
      companyId,
      server._id,
      { name: server.name, provider: server.provider, baseUrl: server.baseUrl },
      { publicBaseUrl: server.publicBaseUrl },
      { ...context, userId }
    );

    logger.info({
      action: 'vms.create.success',
      context: { serverId: server._id.toString(), provider: data.provider },
      correlationId: context?.correlationId,
    });
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
    userId?: mongoose.Types.ObjectId,
    context?: VmsAuditContext
  ): Promise<IVmsServer> {
    // ALWAYS filter by companyId, include auth for validation
    const server = await VmsServer.findOne({ _id: serverId, companyId })
      .select('+auth.apiKey +auth.groupKey +auth.username +auth.password');

    if (!server) {
      throw new NotFoundError(`VMS server with ID ${serverId} not found`);
    }

    // Update fields
    if (data.name !== undefined) server.name = data.name;
    if (data.baseUrl !== undefined || data.publicBaseUrl !== undefined) {
      const urls = this.normalizeVmsUrls(data.baseUrl ?? server.baseUrl, data.publicBaseUrl);
      server.baseUrl = urls.baseUrl;
      server.publicBaseUrl = urls.publicBaseUrl;
    }
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

    // TEST-ONLY: Record audit metadata for VMS server updates.
    await this.writeAuditLog(
      AuditAction.VMS_SERVER_UPDATED,
      companyId,
      server._id,
      {
        name: data.name,
        baseUrl: data.baseUrl,
        publicBaseUrl: data.publicBaseUrl,
        isActive: data.isActive,
      },
      { provider: server.provider },
      { ...context, userId }
    );

    logger.info({
      action: 'vms.update.success',
      context: { serverId: server._id.toString(), provider: server.provider },
      correlationId: context?.correlationId,
    });
    return server;
  }

  /**
   * Delete a VMS server
   */
  async delete(
    companyId: mongoose.Types.ObjectId,
    serverId: mongoose.Types.ObjectId,
    context?: VmsAuditContext
  ): Promise<void> {
    // ALWAYS filter by companyId
    const result = await VmsServer.deleteOne({ _id: serverId, companyId });

    if (result.deletedCount === 0) {
      throw new NotFoundError(`VMS server with ID ${serverId} not found`);
    }

    // TEST-ONLY: Soft delete cameras linked to this VMS server.
    await Camera.updateMany(
      { companyId, isDeleted: false, 'vms.serverId': serverId },
      { $set: { isDeleted: true, lastModified: new Date() } }
    );

    // TEST-ONLY: Record audit metadata for VMS server deletion.
    await this.writeAuditLog(
      AuditAction.VMS_SERVER_DELETED,
      companyId,
      serverId,
      undefined,
      undefined,
      context
    );

    logger.info({
      action: 'vms.delete.success',
      context: { serverId: serverId.toString() },
      correlationId: context?.correlationId,
    });
  }

  /**
   * Test connection to a VMS server
   */
  async testConnection(
    companyId: mongoose.Types.ObjectId,
    serverId: mongoose.Types.ObjectId,
    context?: VmsAuditContext
  ): Promise<{ success: boolean; message: string; monitors?: number }> {
    const server = await this.findByIdWithAuth(companyId, serverId);

    if (!server) {
      throw new NotFoundError(`VMS server with ID ${serverId} not found`);
    }

    try {
      switch (server.provider) {
        case 'shinobi':
          const result = await this.testShinobiConnection(server);
          // TEST-ONLY: Audit successful Shinobi connection tests.
          await this.writeAuditLog(
            AuditAction.VMS_SERVER_TESTED,
            companyId,
            server._id,
            undefined,
            { provider: server.provider, success: true, monitors: result.monitors },
            context
          );
          return result;
        case 'zoneminder':
          // TEST-ONLY: Audit unsupported provider test attempts.
          await this.writeAuditLog(
            AuditAction.VMS_SERVER_TESTED,
            companyId,
            server._id,
            undefined,
            { provider: server.provider, success: false, message: 'unsupported' },
            context
          );
          return { success: false, message: 'ZoneMinder integration not yet implemented' };
        case 'agentdvr':
          // TEST-ONLY: Audit unsupported provider test attempts.
          await this.writeAuditLog(
            AuditAction.VMS_SERVER_TESTED,
            companyId,
            server._id,
            undefined,
            { provider: server.provider, success: false, message: 'unsupported' },
            context
          );
          return { success: false, message: 'AgentDVR integration not yet implemented' };
        case 'milestone':
          // TEST-ONLY: Audit unsupported provider test attempts.
          await this.writeAuditLog(
            AuditAction.VMS_SERVER_TESTED,
            companyId,
            server._id,
            undefined,
            { provider: server.provider, success: false, message: 'unsupported' },
            context
          );
          return { success: false, message: 'Milestone integration not yet implemented' };
        case 'genetec':
          // TEST-ONLY: Audit unsupported provider test attempts.
          await this.writeAuditLog(
            AuditAction.VMS_SERVER_TESTED,
            companyId,
            server._id,
            undefined,
            { provider: server.provider, success: false, message: 'unsupported' },
            context
          );
          return { success: false, message: 'Genetec integration not yet implemented' };
        default:
          // TEST-ONLY: Audit unsupported provider test attempts.
          await this.writeAuditLog(
            AuditAction.VMS_SERVER_TESTED,
            companyId,
            server._id,
            undefined,
            { provider: server.provider, success: false, message: 'unsupported' },
            context
          );
          return { success: false, message: `Unknown provider: ${server.provider}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';

      // Track last error details for troubleshooting
      await VmsServer.updateOne(
        { _id: serverId, companyId },
        {
          connectionStatus: 'error',
          lastError: message,
        }
      );

      // TEST-ONLY: Audit failed connection tests for troubleshooting.
      await this.writeAuditLog(
        AuditAction.VMS_SERVER_TESTED,
        companyId,
        serverId,
        undefined,
        { provider: server.provider, success: false, error: message },
        context
      );

      logger.error('VMS connection test failed', { serverId, error: message });
      throw new AppError(
        ErrorCodes.VMS_CONNECTION_FAILED,
        `VMS connection failed: ${message}`,
        502,
        { serverId: serverId.toString(), provider: server.provider }
      );
    }
  }

  /**
   * Discover monitors (cameras) from a VMS server
   */
  async discoverMonitors(
    companyId: mongoose.Types.ObjectId,
    serverId: mongoose.Types.ObjectId,
    context?: VmsAuditContext
  ): Promise<VmsMonitor[]> {
    const server = await this.findByIdWithAuth(companyId, serverId);

    if (!server) {
      throw new NotFoundError(`VMS server with ID ${serverId} not found`);
    }

    try {
      switch (server.provider) {
        case 'shinobi':
          const monitors = await this.discoverShinobiMonitors(server);
          // TEST-ONLY: Audit monitor discovery counts.
          await this.writeAuditLog(
            AuditAction.VMS_MONITORS_DISCOVERED,
            companyId,
            server._id,
            undefined,
            { provider: server.provider, count: monitors.length },
            context
          );
          return monitors;
        case 'zoneminder':
          return [];
        case 'agentdvr':
          return [];
        case 'milestone':
          return [];
        case 'genetec':
          return [];
        default:
          return [];
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Monitor discovery failed';
      logger.error('VMS monitor discovery failed', { serverId, error: message });
      throw new AppError(
        ErrorCodes.VMS_CONNECTION_FAILED,
        `Monitor discovery failed: ${message}`,
        502,
        { serverId: serverId.toString(), provider: server.provider }
      );
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
      case 'milestone':
        return {};
      case 'genetec':
        return {};
      default:
        return {};
    }
  }

  /**
   * TEST-ONLY: Resolve playback URL for a VMS camera (Slice 12).
   */
  async getPlaybackUrl(
    server: IVmsServer,
    monitorId: string,
    startTime: Date,
    endTime?: Date
  ): Promise<string | null> {
    const info = await this.getPlaybackInfo(server, monitorId, startTime, endTime);
    return info?.playbackUrl ?? null;
  }

  /**
   * TEST-ONLY: Resolve playback details for a VMS camera (Slice 12).
   */
  async getPlaybackInfo(
    server: IVmsServer,
    monitorId: string,
    startTime: Date,
    endTime?: Date
  ): Promise<{ playbackUrl: string; filename: string; clipStart?: Date; clipEnd?: Date } | null> {
    switch (server.provider) {
      case 'shinobi': {
        const match = await this.findShinobiPlaybackClip(server, monitorId, startTime, endTime);
        if (!match?.filename || !this.validateShinobiPlaybackFilename(match.filename)) {
          return null;
        }
        const playbackUrl = this.buildShinobiPlaybackUrl(
          server,
          monitorId,
          match.filename,
          false
        );
        if (!playbackUrl) {
          return null;
        }
        const clipStart = match.time ? new Date(match.time) : undefined;
        const clipEnd = match.end ? new Date(match.end) : undefined;
        return { playbackUrl, filename: match.filename, clipStart, clipEnd };
      }
      case 'milestone':
      case 'genetec':
      case 'zoneminder':
      case 'agentdvr':
      default:
        return null;
    }
  }

  /**
   * TEST-ONLY: Build an internal playback download URL for proxying clips.
   */
  getPlaybackDownloadUrl(
    server: IVmsServer,
    monitorId: string,
    filename: string
  ): string | null {
    return this.buildShinobiPlaybackUrl(server, monitorId, filename, false);
  }

  /**
   * TEST-ONLY: Check recording availability for a specific time (Slice 12).
   */
  async checkRecordingAvailability(
    server: IVmsServer,
    monitorId: string,
    timestamp: Date
  ): Promise<{ available: boolean; reason?: string }> {
    switch (server.provider) {
      case 'shinobi': {
        const match = await this.findShinobiPlaybackClip(server, monitorId, timestamp);
        if (match?.filename) {
          return { available: true };
        }
        return { available: false, reason: 'No recording found for requested time' };
      }
      case 'milestone':
      case 'genetec':
      case 'zoneminder':
      case 'agentdvr':
      default:
        return { available: false, reason: `Playback not supported for ${server.provider}` };
    }
  }

  /**
   * TEST-ONLY: Fetch recording range metadata for a camera (Slice 12).
   */
  async getRecordingRange(
    server: IVmsServer,
    monitorId: string
  ): Promise<{ start?: Date; end?: Date } | null> {
    switch (server.provider) {
      case 'shinobi': {
        const videos = await this.fetchShinobiVideos(server, monitorId);
        if (videos.length === 0) {
          return null;
        }
        const times = videos
          .map((video) => {
            const start = Date.parse(video.time || '');
            const end = Date.parse(video.end || '');
            return {
              start: Number.isNaN(start) ? undefined : start,
              end: Number.isNaN(end) ? undefined : end,
            };
          })
          .filter((entry) => entry.start !== undefined);
        if (times.length === 0) {
          return null;
        }
        const minStart = Math.min(...times.map((entry) => entry.start as number));
        const maxEnd = Math.max(...times.map((entry) => (entry.end ?? entry.start) as number));
        return { start: new Date(minStart), end: new Date(maxEnd) };
      }
      case 'milestone':
      case 'genetec':
      case 'zoneminder':
      case 'agentdvr':
      default:
        return null;
    }
  }

  /**
   * Get monitor status for a VMS camera
   */
  async getMonitorStatus(
    server: IVmsServer,
    monitorId: string
  ): Promise<CameraStatus | null> {
    switch (server.provider) {
      case 'shinobi': {
        // TEST-ONLY: fetch Shinobi monitor list and map to camera status.
        const monitors = await this.discoverShinobiMonitors(server);
        const monitor = monitors.find((item) => item.id === monitorId);
        return this.mapShinobiStatus(monitor?.status);
      }
      case 'milestone':
      case 'genetec':
      case 'zoneminder':
      case 'agentdvr':
      default:
        return null;
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
      // Provide explicit VMS auth error for troubleshooting
      throw new AppError(
        ErrorCodes.VMS_AUTH_MISSING,
        'Shinobi requires apiKey and groupKey',
        400
      );
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
      // Provide explicit VMS auth error for troubleshooting
      throw new AppError(
        ErrorCodes.VMS_AUTH_MISSING,
        'Shinobi requires apiKey and groupKey',
        400
      );
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
    const { baseUrl, auth, publicBaseUrl } = server;

    if (!auth?.apiKey || !auth?.groupKey) {
      logger.warn('Missing Shinobi auth for stream URL generation', { serverId: server._id });
      return {};
    }

    const apiKey = auth.apiKey;
    const groupKey = auth.groupKey;

    const streamBaseUrl = publicBaseUrl || baseUrl;

    return {
      hls: `${streamBaseUrl}/${apiKey}/hls/${groupKey}/${monitorId}/s.m3u8`,
      embed: `${streamBaseUrl}/${apiKey}/embed/${groupKey}/${monitorId}`,
      snapshot: `${streamBaseUrl}/${apiKey}/jpeg/${groupKey}/${monitorId}/s.jpg`,
    };
  }

  // TEST-ONLY: Build a Shinobi playback URL for MP4 clips.
  private buildShinobiPlaybackUrl(
    server: IVmsServer,
    monitorId: string,
    filename: string,
    usePublicBaseUrl: boolean
  ): string | null {
    const apiKey = server.auth?.apiKey;
    const groupKey = server.auth?.groupKey;
    if (!apiKey || !groupKey) {
      return null;
    }
    const base = (usePublicBaseUrl ? server.publicBaseUrl || server.baseUrl : server.baseUrl).replace(/\/+$/, '');
    return `${base}/${apiKey}/videos/${groupKey}/${monitorId}/${encodeURIComponent(filename)}`;
  }

  // TEST-ONLY: Shinobi videos metadata used for playback selection.
  private async fetchShinobiVideos(
    server: IVmsServer,
    monitorId: string,
    limit = config.streaming.playbackLookupLimit
  ): Promise<Array<{ time?: string; end?: string; filename?: string; href?: string }>> {
    const { baseUrl, auth } = server;
    if (!auth?.apiKey || !auth?.groupKey) {
      return [];
    }
    const url = `${baseUrl}/${auth.apiKey}/videos/${auth.groupKey}/${monitorId}?limit=${limit}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      throw new Error(`Shinobi returned status ${response.status}`);
    }
    const payload = await response.json();
    const videos = Array.isArray(payload?.videos) ? payload.videos : [];
    return videos.map((video: Record<string, unknown>) => ({
      time: typeof video.time === 'string' ? video.time : undefined,
      end: typeof video.end === 'string' ? video.end : undefined,
      filename: typeof video.filename === 'string' ? video.filename : undefined,
      href: typeof video.href === 'string' ? video.href : undefined,
    }));
  }

  // TEST-ONLY: Find the Shinobi playback clip that covers the requested timestamp.
  private async findShinobiPlaybackClip(
    server: IVmsServer,
    monitorId: string,
    startTime: Date,
    endTime?: Date
  ): Promise<{ time?: string; end?: string; filename?: string; href?: string } | null> {
    const videos = await this.fetchShinobiVideos(server, monitorId, 50);
    if (videos.length === 0) {
      return null;
    }
    const target = startTime.getTime();
    const boundedTarget = endTime ? Math.min(endTime.getTime(), target) : target;
    const match = videos.find((video) => {
      const start = Date.parse(video.time || '');
      const end = Date.parse(video.end || '');
      if (Number.isNaN(start)) {
        return false;
      }
      if (!Number.isNaN(end)) {
        return boundedTarget >= start && boundedTarget <= end;
      }
      return boundedTarget >= start;
    });
    if (match?.filename) {
      return match;
    }
    const fallback = videos.find((video) => {
      const start = Date.parse(video.time || '');
      return !Number.isNaN(start) && boundedTarget >= start;
    });
    return fallback ?? videos[0] ?? null;
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

  /**
   * Resolve adapter capabilities for a provider.
   */
  getCapabilities(provider: VmsProvider): VmsAdapterCapabilities {
    return VmsAdapterFactory.create(provider).capabilities;
  }

  /**
   * Import monitors from VMS as cameras
   * 
   * @param serverId - VMS server ID
   * @param monitorIds - Optional array of monitor IDs to import (if empty, imports all)
   * @param defaultLocation - Default location for cameras (coordinates and optional address)
   * @param source - Metadata source tag for bulk cleanup (e.g., 'vms-import', 'shinobi-demo')
   * @param companyId - Company ID for multi-tenant isolation
   * @param userId - User ID of the creator
   * @returns Array of created camera documents
   */
  async importMonitors(
    serverId: mongoose.Types.ObjectId,
    monitorIds: string[] | undefined,
    defaultLocation: { coordinates: [number, number]; address?: string } | undefined,
    source: string | undefined,
    companyId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    context?: VmsAuditContext
  ): Promise<any[]> {
    // VMS servers do not support soft delete; filter by company only
    // Ensure the VMS server exists for the current tenant
    const server = await VmsServer.findOne({ _id: serverId, companyId });
    
    if (!server) {
      throw new AppError(
        ErrorCodes.VMS_SERVER_NOT_FOUND,
        'VMS server not found for this company',
        404,
        { serverId: serverId.toString(), companyId: companyId.toString() }
      );
    }

    if (server.provider !== 'shinobi') {
      throw new ValidationError('Monitor import currently supports Shinobi only');
    }

    // Discover all monitors
    // Maintain discoverMonitors signature: (companyId, serverId)
    const monitors = await this.discoverMonitors(companyId, serverId, context);

    // Filter to selected monitors if specified
    const selectedMonitors = monitorIds && monitorIds.length > 0
      ? monitors.filter(m => monitorIds.includes(m.id))
      : monitors;

    if (selectedMonitors.length === 0) {
      return [];
    }

    // Check which monitors are already imported
    const existingCameras = await Camera.find({
      companyId,
      isDeleted: false,
      'vms.serverId': serverId,
      'vms.monitorId': { $in: selectedMonitors.map(m => m.id) },
    }).select('vms.monitorId');

    const existingMonitorIds = new Set(existingCameras.map(c => c.vms?.monitorId).filter(Boolean));

    // Prepare location
    const location = defaultLocation?.coordinates?.length === 2
      ? defaultLocation
      : { coordinates: [0, 0] as [number, number], address: 'Imported from VMS' };

    // Create camera documents for new monitors
    const camerasToCreate = selectedMonitors
      .filter(m => !existingMonitorIds.has(m.id))
      .map(monitor => {
        const streamUrls = this.getShinobiStreamUrls(server, monitor.id);
        
        return {
          companyId,
          name: monitor.name || `Monitor ${monitor.id}`,
          description: `Imported from VMS - ${monitor.status || 'unknown status'}`.slice(0, 500),
          streamUrl: streamUrls.hls || '',
          type: 'ip',
          status: this.mapShinobiStatus(monitor.status),
          location: {
            type: 'Point',
            coordinates: location.coordinates,
            address: location.address,
          },
          settings: {
            resolution: '1920x1080',
            fps: 30,
            recordingEnabled: false,
          },
          metadata: {
            source: source || 'vms-import',
            vmsMonitorDetails: {
              mode: monitor.mode,
              host: monitor.host,
              type: monitor.type,
            },
          },
          vms: {
            provider: server.provider,
            serverId: server._id,
            monitorId: monitor.id,
            lastSyncAt: new Date(),
          },
          createdBy: userId,
        };
      });

    if (camerasToCreate.length === 0) {
      logger.info('No new monitors to import', { serverId, companyId });
      return [];
    }

    const createdCameras = await Camera.insertMany(camerasToCreate);
    
    // TEST-ONLY: Audit imported monitor counts for VMS tracking.
    await this.writeAuditLog(
      AuditAction.VMS_MONITORS_IMPORTED,
      companyId,
      serverId,
      undefined,
      { provider: server.provider, count: createdCameras.length },
      { ...context, userId }
    );

    logger.info('Imported monitors as cameras', {
      serverId,
      companyId,
      count: createdCameras.length,
      monitorIds: createdCameras.map(c => c.vms?.monitorId),
    });

    return createdCameras;
  }
}

export const vmsService = new VmsService();
