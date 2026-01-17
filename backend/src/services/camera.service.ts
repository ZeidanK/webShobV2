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
import { Camera, ICamera, CameraStatus, VmsServer, IVmsServer } from '../models';
import { vmsService, VmsMonitor, StreamUrls } from './vms.service';
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
  isDeleted?: boolean;
}

/** Create camera input */
export interface CreateCameraInput {
  name: string;
  description?: string;
  streamUrl?: string;
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
  vms?: {
    provider?: 'shinobi' | 'zoneminder' | 'agentdvr' | 'other';
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
  metadata?: Record<string, unknown>;
}

/** Plain camera data (result of lean() query) */
export type CameraData = Omit<ICamera, keyof Document> & { _id: mongoose.Types.ObjectId };

/** Camera with stream URLs */
export interface CameraWithStreams extends CameraData {
  streams?: StreamUrls;
}

class CameraService {
  /**
   * Create a new camera
   */
  async create(
    companyId: mongoose.Types.ObjectId,
    data: CreateCameraInput,
    userId?: mongoose.Types.ObjectId
  ): Promise<ICamera> {
    logger.info('Creating camera', { companyId, name: data.name });

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

    // Update fields
    if (data.name !== undefined) camera.name = data.name;
    if (data.description !== undefined) camera.description = data.description;
    if (data.streamUrl !== undefined) camera.streamUrl = data.streamUrl;
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
    userId?: mongoose.Types.ObjectId
  ): Promise<ICamera> {
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

    logger.info('Camera connected to VMS', { cameraId, serverId, monitorId });
    return camera;
  }

  /**
   * Disconnect a camera from VMS
   */
  async disconnectFromVms(
    companyId: mongoose.Types.ObjectId,
    cameraId: mongoose.Types.ObjectId,
    userId?: mongoose.Types.ObjectId
  ): Promise<ICamera> {
    const camera = await Camera.findOne({ _id: cameraId, companyId, isDeleted: false });
    if (!camera) {
      throw new NotFoundError(`Camera with ID ${cameraId} not found`);
    }

    camera.vms = undefined;
    camera.updatedBy = userId;
    await camera.save();

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
    userId?: mongoose.Types.ObjectId
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
    cameraId: mongoose.Types.ObjectId
  ): Promise<StreamUrls> {
    const camera = await this.findById(companyId, cameraId);
    if (!camera) {
      throw new NotFoundError(`Camera with ID ${cameraId} not found`);
    }

    if (!camera.vms?.serverId || !camera.vms?.monitorId) {
      return {};
    }

    const server = await vmsService.findByIdWithAuth(companyId, camera.vms.serverId);
    if (!server) {
      return {};
    }

    return vmsService.getStreamUrls(server, camera.vms.monitorId);
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
