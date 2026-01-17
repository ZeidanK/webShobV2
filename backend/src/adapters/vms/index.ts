/**
 * VMS Adapters
 * 
 * This directory will contain Video Management System adapters.
 * Adapters will be created in Slice 8-10.
 */

/**
 * VMS Adapter Interface
 * All VMS adapters must implement this interface.
 */
export interface IVMSAdapter {
  /**
   * Get live stream URL for a camera
   */
  getLiveStreamUrl(cameraId: string): Promise<string>;

  /**
   * Get playback URL for recorded video
   */
  getPlaybackUrl(cameraId: string, startTime: Date, endTime?: Date): Promise<string>;

  /**
   * Get snapshot image at specific timestamp
   */
  getSnapshot(cameraId: string, timestamp: Date): Promise<Buffer>;

  /**
   * Get camera connection status
   */
  getCameraStatus(cameraId: string): Promise<CameraStatus>;
}

export interface CameraStatus {
  online: boolean;
  lastSeen: Date;
  error?: string;
}

// Adapters to be implemented:
// - DirectRTSPAdapter: For direct IP camera connections
// - MilestoneAdapter: For Milestone XProtect integration (Phase 2)
// - GenetecAdapter: For Genetec Security Center integration (Phase 2)

export {};
