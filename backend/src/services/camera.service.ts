/**
 * Camera Service
 * 
 * Handles all camera operations including:
 * - CRUD operations for cameras
 * - VMS connection management
 * - Batch import from VMS
 * - Stream URL generation
 * 
 * Multi-tenant: All operations filter by companyId.
 */

import mongoose, { Document } from 'mongoose';
import { Camera, ICamera, CameraStatus, VmsServer, IVmsServer, AuditLog, AuditAction } from '../models';
import type { VmsProvider } from '../models/vms-server.model';
import { vmsService, VmsMonitor, StreamUrls } from './vms.service';
import { rtspStreamService } from './rtsp-stream.service';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';
import { logger } from '../utils/logger';

/** Pagination options */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** Filter options for cameras */
export interface CameraFilters {
  status?: CameraStatus;
  vmsServerId?: mongoose.Types.ObjectId;
  hasVms?: boolean;
  search?: string;
  tags?: string[];
  isDeleted?: boolean;
}

/** Optional audit context for camera VMS operations */
export interface CameraAuditContext {
  userId?: mongoose.Types.ObjectId;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

/** Create camera input */
export interface CreateCameraInput {
  name: string;
  description?: string;
  streamUrl?: string;
  capabilities?: {
    ptz?: boolean;
    audio?: boolean;
    motionDetection?: boolean;
  };
  maintenanceSchedule?: {
    intervalDays?: number;
    lastServiceAt?: Date;
    nextServiceAt?: Date;
    notes?: string;
  };
  tags?: string[];
  // TEST-ONLY: Stream configuration for Direct RTSP scaffolding.
  streamConfig?: {
    type: 'vms' | 'direct-rtsp';
    rtspUrl?: string;
    transport?: 'tcp' | 'udp';
    auth?: {
      username?: string;
      password?: string;
    };
  };
  type?: 'ip' | 'analog' | 'usb';
  status?: CameraStatus;
  location: {
    coordinates: [number, number];
    address?: string;
  };
  settings?: {
    resolution?: string;
    fps?: number;
    recordingEnabled?: boolean;
  };
  // TEST-ONLY: Recording configuration (Slice 12).
  recording?: {
    enabled?: boolean;
    retentionDays?: number;
    vmsHandled?: boolean;
  };
  vms?: {
    provider?: VmsProvider;
    serverId?: mongoose.Types.ObjectId;
    monitorId?: string;
  };
  metadata?: {
    source?: string;
    externalId?: string;
    tags?: string[];
    [key: string]: unknown;
  };
}

/** Update camera input */
export interface UpdateCameraInput {
  name?: string;
  description?: string;
  streamUrl?: string;
  capabilities?: {
    ptz?: boolean;
    audio?: boolean;
    motionDetection?: boolean;
  };
  maintenanceSchedule?: {
    intervalDays?: number;
    lastServiceAt?: Date;
    nextServiceAt?: Date;
    notes?: string;
  };
  tags?: string[];
  // TEST-ONLY: Stream configuration for Direct RTSP scaffolding.
  streamConfig?: {
    type?: 'vms' | 'direct-rtsp';
    rtspUrl?: string;
    transport?: 'tcp' | 'udp';
    auth?: {
      username?: string;
      password?: string;
    };
  };
  type?: 'ip' | 'analog' | 'usb';
  status?: CameraStatus;
  location?: {
    coordinates?: [number, number];
    address?: string;
  };
  settings?: {
    resolution?: string;
    fps?: number;
    recordingEnabled?: boolean;
  };
  // TEST-ONLY: Recording configuration (Slice 12).
  recording?: {
    enabled?: boolean;
    retentionDays?: number;
    vmsHandled?: boolean;
  };
  metadata?: Record<string, unknown>;
}

/** Plain camera data (result of lean() query) */
export type CameraData = Omit<ICamera, keyof Document> & { _id: mongoose.Types.ObjectId };

/** Camera with stream URLs */
export interface CameraWithStreams extends CameraData {
  streams?: StreamUrls;
}

class CameraService {
  // TEST-ONLY: Normalize tag inputs to trimmed, unique values.
  private normalizeTags(tags?: string[]): string[] | undefined {
    if (!tags) {
      return undefined;
    }
    const normalized = tags
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    return Array.from(new Set(normalized));
  }

  // TEST-ONLY: Persist a camera audit entry for VMS-related updates.
  private async writeAuditLog(
    action: AuditAction,
    companyId: mongoose.Types.ObjectId,
    resourceId: mongoose.Types.ObjectId | undefined,
    changes: Record<string, unknown> | undefined,
    metadata: Record<string, unknown> | undefined,
    context?: CameraAuditContext
  ): Promise<void> {
    await AuditLog.create({
      action,
      companyId,
      resourceType: 'Camera',
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
   * Validate stream configuration and related fields.
   */
  private validateStreamConfigInput(
    data: CreateCameraInput | UpdateCameraInput,
    existingCamera?: ICamera | null
  ) {
    const hasStreamConfig = data.streamConfig !== undefined;
    const streamType = data.streamConfig?.type || existingCamera?.streamConfig?.type;
    if (hasStreamConfig && !streamType) {
      throw new ValidationError('streamConfig.type is required when streamConfig is provided');
    }
    if (!streamType) {
      return;
    }

    if (streamType === 'direct-rtsp') {
      // TEST-ONLY: Enforce required RTSP URL and prevent mixed VMS config.
      const rtspUrl = data.streamConfig?.rtspUrl || existingCamera?.streamConfig?.rtspUrl;
      if (!rtspUrl) {
        throw new ValidationError('streamConfig.rtspUrl is required for direct-rtsp cameras');
      }
      const vmsInput = (data as CreateCameraInput).vms;
      if (vmsInput?.serverId || vmsInput?.monitorId) {
        throw new ValidationError('direct-rtsp cameras cannot be linked to a VMS server');
      }
      if (existingCamera?.vms?.serverId) {
        throw new ValidationError('Disconnect VMS before switching to direct-rtsp');
      }
      if (data.streamUrl) {
        throw new ValidationError('streamUrl is not supported for direct-rtsp cameras');
      }
    }
  }

  private buildStreamConfig(
    incoming: UpdateCameraInput['streamConfig'] | CreateCameraInput['streamConfig'] | undefined,
    existing?: ICamera['streamConfig']
  ) {
    if (!incoming && !existing) {
      return undefined;
    }

    const resolvedType = incoming?.type || existing?.type || 'vms';
    const next = {
      type: resolvedType,
      rtspUrl: incoming?.rtspUrl ?? existing?.rtspUrl,
      transport: incoming?.transport ?? existing?.transport,
      auth: incoming?.auth ?? existing?.auth,
    };

    if (!next.rtspUrl) {
      delete (next as { rtspUrl?: string }).rtspUrl;
    }
    if (!next.transport) {
      delete (next as { transport?: string }).transport;
    }
    if (!next.auth || (!next.auth.username && !next.auth.password)) {
      delete (next as { auth?: { username?: string; password?: string } }).auth;
    }

    return next;
  }

  /**
   * Create a new camera
   */
  async create(
    companyId: mongoose.Types.ObjectId,
    data: CreateCameraInput,
    userId?: mongoose.Types.ObjectId
  ): Promise<ICamera> {
    logger.info('Creating camera', { companyId, name: data.name });

    this.validateStreamConfigInput(data);

    // Validate VMS server if specified
    if (data.vms?.serverId) {
      const server = await VmsServer.findOne({
        _id: data.vms.serverId,
        companyId,
      });
      if (!server) {
        throw new NotFoundError(`VMS server with ID ${data.vms.serverId} not found`);
      }
      // Auto-set provider from server if not specified
      if (!data.vms.provider) {
        data.vms.provider = server.provider;
      }
    }

    const camera = new Camera({
      ...data,
      tags: this.normalizeTags(data.tags),
      companyId,
      createdBy: userId,
      updatedBy: userId,
      location: {
        type: 'Point',
        ...data.location,
      },
    });

    await camera.save();

    logger.info('Camera created', { cameraId: camera._id, name: data.name });
    return camera;
  }

  /**
   * Get all cameras for a company with optional filtering
   * If companyId is null/undefined, returns cameras for all companies (super_admin only)
   */
  async findAll(
    companyId: mongoose.Types.ObjectId | null | undefined,
    filters: CameraFilters = {},
    pagination: PaginationOptions = {}
  ): Promise<{ cameras: ICamera[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 50, sortBy = 'name', sortOrder = 'asc' } = pagination;
    const skip = (page - 1) * limit;

    // Build query - filter by companyId only if provided
    const query: Record<string, unknown> = { 
      isDeleted: filters.isDeleted ?? false, // Default to non-deleted
    };
    
    // Only filter by companyId if provided (null/undefined = super_admin viewing all)
    if (companyId) {
      query.companyId = companyId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.vmsServerId) {
      query['vms.serverId'] = filters.vmsServerId;
    }

    if (filters.hasVms !== undefined) {
      if (filters.hasVms) {
        query['vms.serverId'] = { $exists: true, $ne: null };
      } else {
        query.$or = [
          { 'vms.serverId': { $exists: false } },
          { 'vms.serverId': null },
        ];
      }
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } },
        { 'location.address': { $regex: filters.search, $options: 'i' } },
      ];
    }

    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags };
    }

    logger.info('Camera query', {
      query: JSON.stringify(query),
      companyId: companyId?.toString() || 'null',
      filters: JSON.stringify(filters),
    });

    const [cameras, total] = await Promise.all([
      Camera.find(query)
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Camera.countDocuments(query),
    ]);

    return { cameras: cameras as unknown as ICamera[], total, page, limit };
  }

  /**
   * Get a single camera by ID
   */
  async findById(
    companyId: mongoose.Types.ObjectId,
    cameraId: mongoose.Types.ObjectId
  ): Promise<ICamera | null> {
    // ALWAYS filter by companyId
    const camera = await Camera.findOne({ _id: cameraId, companyId, isDeleted: false }).lean();
    return camera as ICamera | null;
  }

  /**
   * Get a camera with stream URLs
   */
  async findByIdWithStreams(
    companyId: mongoose.Types.ObjectId,
    cameraId: mongoose.Types.ObjectId
  ): Promise<CameraWithStreams | null> {
    const camera = await this.findById(companyId, cameraId);
    if (!camera) return null;

    // Get stream URLs if connected to VMS
    let streams: StreamUrls | undefined;
    if (camera.vms?.serverId && camera.vms?.monitorId) {
      const server = await vmsService.findByIdWithAuth(
        companyId,
        camera.vms.serverId
      );
      if (server) {
        streams = await vmsService.getStreamUrls(server, camera.vms.monitorId);
      }
    }

    return { ...camera, streams };
  }

  /**
   * Update a camera
   */
  async update(
    companyId: mongoose.Types.ObjectId,
    cameraId: mongoose.Types.ObjectId,
    data: UpdateCameraInput,
    userId?: mongoose.Types.ObjectId
  ): Promise<ICamera> {
    // ALWAYS filter by companyId
    const camera = await Camera.findOne({ _id: cameraId, companyId, isDeleted: false });

    if (!camera) {
      throw new NotFoundError(`Camera with ID ${cameraId} not found`);
    }

    this.validateStreamConfigInput(data, camera);

    // Update fields
    if (data.name !== undefined) camera.name = data.name;
    if (data.description !== undefined) camera.description = data.description;
    if (data.streamUrl !== undefined) camera.streamUrl = data.streamUrl;
    // TEST-ONLY: Allow streamConfig updates for Phase 2 scaffolding.
    if (data.streamConfig !== undefined) {
      // TEST-ONLY: Preserve streamConfig.type when partial updates omit it.
      camera.streamConfig = this.buildStreamConfig(data.streamConfig, camera.streamConfig);
    }
    if (data.type !== undefined) camera.type = data.type;
    if (data.status !== undefined) camera.status = data.status;

    if (data.location) {
      if (data.location.coordinates) {
        camera.location.coordinates = data.location.coordinates;
      }
      if (data.location.address !== undefined) {
        camera.location.address = data.location.address;
      }
    }

    if (data.settings) {
      camera.settings = { ...camera.settings, ...data.settings };
    }

    if (data.recording) {
      camera.recording = { ...camera.recording, ...data.recording };
    }

    if (data.capabilities) {
      camera.capabilities = { ...camera.capabilities, ...data.capabilities };
    }

    if (data.maintenanceSchedule) {
      camera.maintenanceSchedule = {
        ...camera.maintenanceSchedule,
        ...data.maintenanceSchedule,
      };
    }

    if (data.tags !== undefined) {
      camera.tags = this.normalizeTags(data.tags) || [];
    }

    if (data.metadata) {
      camera.metadata = { ...camera.metadata, ...data.metadata };
    }

    camera.updatedBy = userId;
    await camera.save();

    logger.info('Camera updated', { cameraId, name: camera.name });
    return camera;
  }

  /**
   * Soft delete a camera
   */
  async delete(
    companyId: mongoose.Types.ObjectId,
    cameraId: mongoose.Types.ObjectId,
    userId?: mongoose.Types.ObjectId
  ): Promise<void> {
    // ALWAYS filter by companyId
    const result = await Camera.updateOne(
      { _id: cameraId, companyId },
      { isDeleted: true, updatedBy: userId }
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError(`Camera with ID ${cameraId} not found`);
    }

    logger.info('Camera soft deleted', { cameraId });
  }

  /**
   * Connect a camera to a VMS server
   */
  async connectToVms(
    companyId: mongoose.Types.ObjectId,
    cameraId: mongoose.Types.ObjectId,
    serverId: mongoose.Types.ObjectId,
    monitorId: string,
    userId?: mongoose.Types.ObjectId,
    context?: CameraAuditContext
  ): Promise<{ camera: ICamera; capabilities: { supportsLive: boolean; supportsPlayback: boolean; supportsExport: boolean } }> {
    // Verify camera exists in this company
    const camera = await Camera.findOne({ _id: cameraId, companyId, isDeleted: false });
    if (!camera) {
      throw new NotFoundError(`Camera with ID ${cameraId} not found`);
    }

    // Verify VMS server exists in this company
    const server = await VmsServer.findOne({ _id: serverId, companyId });
    if (!server) {
      throw new NotFoundError(`VMS server with ID ${serverId} not found`);
    }
    // TEST-ONLY: Block unsupported VMS providers before connecting.
    if (server.provider !== 'shinobi') {
      throw new ValidationError(`VMS provider ${server.provider} is not supported yet`);
    }

    // Check if another camera already uses this monitor
    const existingCamera = await Camera.findOne({
      companyId,
      'vms.serverId': serverId,
      'vms.monitorId': monitorId,
      _id: { $ne: cameraId },
      isDeleted: false,
    });

    if (existingCamera) {
      throw new ConflictError(
        `Monitor ${monitorId} is already connected to camera "${existingCamera.name}"`
      );
    }

    // Update camera with VMS connection
    camera.vms = {
      provider: server.provider,
      serverId,
      monitorId,
      lastSyncAt: new Date(),
    };
    camera.updatedBy = userId;
    await camera.save();

    // TEST-ONLY: Record audit metadata for camera VMS connections.
    await this.writeAuditLog(
      AuditAction.CAMERA_VMS_CONNECTED,
      companyId,
      camera._id,
      { vms: { serverId: serverId.toString(), monitorId } },
      { provider: server.provider },
      { ...context, userId }
    );

    const capabilities = vmsService.getCapabilities(server.provider);
    logger.info('Camera connected to VMS', { cameraId, serverId, monitorId });
    return { camera, capabilities };
  }

  /**
   * Disconnect a camera from VMS
   */
  async disconnectFromVms(
    companyId: mongoose.Types.ObjectId,
    cameraId: mongoose.Types.ObjectId,
    userId?: mongoose.Types.ObjectId,
    context?: CameraAuditContext
  ): Promise<ICamera> {
    const camera = await Camera.findOne({ _id: cameraId, companyId, isDeleted: false });
    if (!camera) {
      throw new NotFoundError(`Camera with ID ${cameraId} not found`);
    }

    camera.vms = undefined;
    camera.updatedBy = userId;
    await camera.save();

    // TEST-ONLY: Record audit metadata for camera VMS disconnections.
    await this.writeAuditLog(
      AuditAction.CAMERA_VMS_DISCONNECTED,
      companyId,
      camera._id,
      undefined,
      undefined,
      { ...context, userId }
    );

    logger.info('Camera disconnected from VMS', { cameraId });
    return camera;
  }

  /**
   * Batch import cameras from VMS monitors
   */
  async batchImportFromVms(
    companyId: mongoose.Types.ObjectId,
    serverId: mongoose.Types.ObjectId,
    monitors: Array<{
      monitorId: string;
      name: string;
      location: { coordinates: [number, number]; address?: string };
    }>,
    userId?: mongoose.Types.ObjectId,
    context?: CameraAuditContext
  ): Promise<{ created: number; skipped: number; cameras: ICamera[] }> {
    const server = await VmsServer.findOne({ _id: serverId, companyId });
    if (!server) {
      throw new NotFoundError(`VMS server with ID ${serverId} not found`);
    }

    let created = 0;
    let skipped = 0;
    const cameras: ICamera[] = [];

    for (const monitor of monitors) {
      // Check if camera already exists for this monitor
      const existing = await Camera.findOne({
        companyId,
        'vms.serverId': serverId,
        'vms.monitorId': monitor.monitorId,
        isDeleted: false,
      });

      if (existing) {
        skipped++;
        continue;
      }

      const camera = await this.create(
        companyId,
        {
          name: monitor.name,
          location: {
            coordinates: monitor.location.coordinates,
            address: monitor.location.address,
          },
          vms: {
            provider: server.provider,
            serverId,
            monitorId: monitor.monitorId,
          },
          metadata: {
            source: 'vms-import',
            externalId: monitor.monitorId,
          },
        },
        userId
      );

      cameras.push(camera);
      created++;
    }

    logger.info('Batch import from VMS completed', { serverId, created, skipped, total: monitors.length });

    // TEST-ONLY: Record audit metadata for VMS batch import results.
    await this.writeAuditLog(
      AuditAction.VMS_MONITORS_IMPORTED,
      companyId,
      undefined,
      undefined,
      { serverId: serverId.toString(), created, skipped },
      { ...context, userId }
    );

    return { created, skipped, cameras };
  }

  /**
   * Get available monitors from VMS that are not yet imported
   */
  async getAvailableMonitors(
    companyId: mongoose.Types.ObjectId,
    serverId: mongoose.Types.ObjectId
  ): Promise<VmsMonitor[]> {
    // Get all monitors from VMS
    const allMonitors = await vmsService.discoverMonitors(companyId, serverId);

    // Get already connected monitor IDs
    const connectedCameras = await Camera.find({
      companyId,
      'vms.serverId': serverId,
      isDeleted: false,
    }).select('vms.monitorId');

    const connectedIds = new Set(
      connectedCameras.map((c) => c.vms?.monitorId).filter(Boolean)
    );

    // Filter out already connected
    return allMonitors.filter((m) => !connectedIds.has(m.id));
  }

  /**
   * Get stream URLs for a camera
   */
  async getStreamUrls(
    companyId: mongoose.Types.ObjectId,
    cameraId: mongoose.Types.ObjectId,
    publicBaseUrl?: string
  ): Promise<StreamUrls> {
    const camera = await this.findById(companyId, cameraId);
    if (!camera) {
      throw new NotFoundError(`Camera with ID ${cameraId} not found`);
    }

    if (camera.streamConfig?.type === 'direct-rtsp') {
      // TEST-ONLY: Serve direct-rtsp streams from local HLS output.
      const baseUrl = (publicBaseUrl || '').replace(/\/+$/, '');
      await rtspStreamService.ensureStream(camera);
      rtspStreamService.cleanupIdleStreams();
      const token = rtspStreamService.createStreamToken(camera._id.toString(), camera.companyId.toString());
      const hlsUrl = `${baseUrl}/api/cameras/${camera._id}/streams/hls/index.m3u8?token=${token}`;
      return { hls: hlsUrl };
    }

    if (!camera.vms?.serverId || !camera.vms?.monitorId) {
      return {};
    }

    const server = await vmsService.findByIdWithAuth(companyId, camera.vms.serverId);
    if (!server) {
      return {};
    }

    const streams = await vmsService.getStreamUrls(server, camera.vms.monitorId);
    const status = await vmsService.getMonitorStatus(server, camera.vms.monitorId);
    if (status && status !== camera.status) {
      // TEST-ONLY: update camera status when streams are requested.
      await Camera.updateOne(
        { _id: cameraId, companyId },
        {
          status,
          lastSeen: status === 'online' ? new Date() : camera.lastSeen,
        }
      );
    }

    return streams;
  }

  /**
   * Find cameras near a location
   * If companyId is null/undefined, returns cameras for all companies (super_admin only)
   */
  async findNearby(
    companyId: mongoose.Types.ObjectId | null | undefined,
    coordinates: [number, number],
    maxDistanceMeters: number = 5000,
    limit: number = 10
  ): Promise<ICamera[]> {
    const query: Record<string, unknown> = {
      isDeleted: false,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates,
          },
          $maxDistance: maxDistanceMeters,
        },
      },
    };

    // Only filter by companyId if provided (null/undefined = super_admin viewing all)
    if (companyId) {
      query.companyId = companyId;
    }

    return Camera.find(query)
      .limit(limit)
      .lean() as unknown as Promise<ICamera[]>;
  }

  /**
   * TEST-ONLY: Find cameras by status.
   */
  async findByStatus(
    companyId: mongoose.Types.ObjectId | null | undefined,
    status: CameraStatus
  ): Promise<ICamera[]> {
    const query: Record<string, unknown> = { status, isDeleted: false };
    if (companyId) {
      query.companyId = companyId;
    }
    return Camera.find(query).lean() as unknown as Promise<ICamera[]>;
  }

  /**
   * TEST-ONLY: Find cameras by tag.
   */
  async findByTag(
    companyId: mongoose.Types.ObjectId | null | undefined,
    tag: string
  ): Promise<ICamera[]> {
    const query: Record<string, unknown> = {
      tags: tag,
      isDeleted: false,
    };
    if (companyId) {
      query.companyId = companyId;
    }
    return Camera.find(query).lean() as unknown as Promise<ICamera[]>;
  }

  /**
   * TEST-ONLY: Bulk update camera status.
   */
  async bulkUpdateStatus(
    companyId: mongoose.Types.ObjectId,
    cameraIds: mongoose.Types.ObjectId[],
    status: CameraStatus,
    userId?: mongoose.Types.ObjectId
  ): Promise<number> {
    const result = await Camera.updateMany(
      { companyId, _id: { $in: cameraIds }, isDeleted: false },
      { $set: { status, updatedBy: userId, lastModified: new Date() } }
    );
    return result.modifiedCount || 0;
  }

  /**
   * TEST-ONLY: Bulk delete cameras by ID (soft delete).
   */
  async bulkDelete(
    companyId: mongoose.Types.ObjectId,
    cameraIds: mongoose.Types.ObjectId[],
    userId?: mongoose.Types.ObjectId
  ): Promise<number> {
    const result = await Camera.updateMany(
      { companyId, _id: { $in: cameraIds }, isDeleted: false },
      { $set: { isDeleted: true, updatedBy: userId, lastModified: new Date() } }
    );
    return result.modifiedCount || 0;
  }

  /**
   * TEST-ONLY: Bulk tag cameras with add/remove/set behavior.
   */
  async bulkTag(
    companyId: mongoose.Types.ObjectId,
    cameraIds: mongoose.Types.ObjectId[],
    tags: string[],
    mode: 'add' | 'remove' | 'set',
    userId?: mongoose.Types.ObjectId
  ): Promise<number> {
    const normalizedTags = this.normalizeTags(tags) || [];
    const update: Record<string, unknown> = {
      updatedBy: userId,
      lastModified: new Date(),
    };

    if (mode === 'set') {
      update.tags = normalizedTags;
    } else if (mode === 'add') {
      update.$addToSet = { tags: { $each: normalizedTags } };
    } else {
      update.$pull = { tags: { $in: normalizedTags } };
    }

    const result = await Camera.updateMany(
      { companyId, _id: { $in: cameraIds }, isDeleted: false },
      update
    );
    return result.modifiedCount || 0;
  }

  /**
   * Bulk delete cameras by metadata.source (soft delete)
   * 
   * Used for cleaning up demo/test cameras that were imported from VMS.
   * 
   * @param source - Metadata source tag to match (e.g., 'vms-import', 'shinobi-demo')
   * @param companyId - Company ID for multi-tenant isolation
   * @returns Number of cameras soft-deleted
   */
  async deleteCamerasBySource(
    source: string,
    companyId: mongoose.Types.ObjectId
  ): Promise<number> {
    if (!source || source.trim() === '') {
      throw new ValidationError('Source parameter is required');
    }

    const result = await Camera.updateMany(
      {
        companyId,
        isDeleted: false,
        'metadata.source': source,
      },
      {
        $set: {
          isDeleted: true,
          lastModified: new Date(),
        },
      }
    );

    logger.info('Bulk deleted cameras by source', {
      source,
      companyId,
      count: result.modifiedCount,
    });

    return result.modifiedCount || 0;
  }
}

export const cameraService = new CameraService();
