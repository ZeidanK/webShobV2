/**
 * TEST-ONLY: Camera Status Monitor Service
 *
 * TEST-ONLY: Periodically checks camera health and broadcasts status changes.
 */

import mongoose from 'mongoose';
import { Camera, CameraStatus, AuditLog, AuditAction } from '../models';
import { vmsService } from './vms.service';
import { rtspStreamService } from './rtsp-stream.service';
import { websocketService, WebSocketEvent } from './websocket.service';
import { config } from '../config';
import { logger } from '../utils/logger';

type StatusCheckOptions = {
  companyId?: string;
  reason?: string;
  requestedBy?: string;
  correlationId?: string;
};

type StatusCheckResult = {
  nextStatus: CameraStatus;
  statusMessage: string;
};

class CameraStatusMonitorService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  /**
   * TEST-ONLY: Start periodic status monitoring.
   */
  start(): void {
    if (!config.cameraStatusMonitor.enabled) {
      logger.info('camera.status.monitor.disabled', { action: 'camera.status.monitor.start' });
      return;
    }
    if (this.timer) {
      logger.warn('camera.status.monitor.already_running', { action: 'camera.status.monitor.start' });
      return;
    }

    const intervalMs = config.cameraStatusMonitor.intervalMs;
    this.timer = setInterval(() => {
      this.runOnce({ reason: 'scheduler' }).catch((error) => {
        logger.error('camera.status.monitor.run_failed', {
          action: 'camera.status.monitor.run',
          error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        });
      });
    }, intervalMs);

    logger.info('camera.status.monitor.started', {
      action: 'camera.status.monitor.start',
      intervalMs,
    });
  }

  /**
   * TEST-ONLY: Stop periodic status monitoring.
   */
  async stop(): Promise<void> {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
    logger.info('camera.status.monitor.stopped', { action: 'camera.status.monitor.stop' });
  }

  /**
   * TEST-ONLY: Run a single status check pass.
   */
  async runOnce(options: StatusCheckOptions = {}): Promise<void> {
    if (this.running) {
      logger.warn('camera.status.monitor.already_running', {
        action: 'camera.status.monitor.run',
        reason: options.reason || 'manual',
      });
      return;
    }
    this.running = true;

    try {
      const query: Record<string, unknown> = { isDeleted: false };
      if (options.companyId) {
        query.companyId = new mongoose.Types.ObjectId(options.companyId);
      }

      const cameras = await Camera.find(query)
        .select('_id companyId status vms streamConfig lastSeen')
        .lean();

      for (const camera of cameras) {
        await this.checkCameraStatus(camera, options);
      }
    } finally {
      this.running = false;
    }
  }

  private async checkCameraStatus(
    camera: {
      _id: mongoose.Types.ObjectId;
      companyId: mongoose.Types.ObjectId;
      status: CameraStatus;
      vms?: { serverId?: mongoose.Types.ObjectId; monitorId?: string } | undefined;
      streamConfig?: {
        type?: 'vms' | 'direct-rtsp';
        rtspUrl?: string;
        transport?: 'tcp' | 'udp';
      };
      lastSeen?: Date;
    },
    options: StatusCheckOptions
  ): Promise<void> {
    const statusResult = await this.resolveStatus(camera);
    if (!statusResult) {
      return;
    }

    const { nextStatus, statusMessage } = statusResult;
    if (nextStatus === camera.status) {
      return;
    }

    const update: Record<string, unknown> = {
      status: nextStatus,
      lastModified: new Date(),
    };
    if (nextStatus === 'online') {
      update.lastSeen = new Date();
    }

    const result = await Camera.updateOne(
      { _id: camera._id, companyId: camera.companyId, status: { $ne: nextStatus } },
      { $set: update }
    );

    if (result.modifiedCount === 0) {
      return;
    }

    await AuditLog.create({
      action: AuditAction.CAMERA_STATUS_CHANGED,
      companyId: camera.companyId,
      resourceType: 'Camera',
      resourceId: camera._id,
      userId: options.requestedBy ? new mongoose.Types.ObjectId(options.requestedBy) : undefined,
      changes: {
        status: { from: camera.status, to: nextStatus },
      },
      metadata: {
        reason: options.reason || 'scheduler',
        message: statusMessage,
      },
      correlationId: options.correlationId,
    });

    websocketService.broadcastToCompany(camera.companyId.toString(), WebSocketEvent.CAMERA_STATUS, {
      cameraId: camera._id.toString(),
      companyId: camera.companyId.toString(),
      previousStatus: camera.status,
      status: nextStatus,
      checkedAt: new Date().toISOString(),
      reason: options.reason || 'scheduler',
    });

    logger.info('camera.status.updated', {
      action: 'camera.status.update',
      cameraId: camera._id.toString(),
      companyId: camera.companyId.toString(),
      previousStatus: camera.status,
      status: nextStatus,
      message: statusMessage,
    });
  }

  private async resolveStatus(
    camera: {
      companyId: mongoose.Types.ObjectId;
      vms?: { serverId?: mongoose.Types.ObjectId; monitorId?: string } | undefined;
      streamConfig?: {
        type?: 'vms' | 'direct-rtsp';
        rtspUrl?: string;
        transport?: 'tcp' | 'udp';
      };
    }
  ): Promise<StatusCheckResult | null> {
    if (camera.streamConfig?.type === 'direct-rtsp' && camera.streamConfig?.rtspUrl) {
      const result = await rtspStreamService.testRtspConnection(
        camera.streamConfig.rtspUrl,
        camera.streamConfig.transport || 'tcp'
      );
      return {
        nextStatus: result.success ? 'online' : 'offline',
        statusMessage: result.message,
      };
    }

    if (camera.vms?.serverId && camera.vms?.monitorId) {
      const server = await vmsService.findByIdWithAuth(camera.companyId, camera.vms.serverId);
      if (!server) {
        return { nextStatus: 'error', statusMessage: 'VMS server not found' };
      }
      try {
        const status = await vmsService.getMonitorStatus(server, camera.vms.monitorId);
        return {
          nextStatus: status || 'offline',
          statusMessage: status ? 'VMS status resolved' : 'VMS monitor not found',
        };
      } catch (error) {
        return { nextStatus: 'error', statusMessage: 'VMS status check failed' };
      }
    }

    return null;
  }
}

export const cameraStatusMonitorService = new CameraStatusMonitorService();
