/**
 * VMS Adapters
 * 
 * This directory will contain Video Management System adapters.
 * Adapters will be created in Slice 9-11.
 */

// TEST-ONLY: Adapter stream URL shape for live playback.
export interface StreamUrls {
  hls?: string;
  embed?: string;
  snapshot?: string;
  raw?: string;
}

// TEST-ONLY: Minimal adapter surface used by Direct RTSP and VMS providers.
export interface IVMSAdapter {
  getStreamUrls(cameraId: string): Promise<StreamUrls>;
  testConnection(): Promise<{ success: boolean; message?: string }>;
  // TEST-ONLY: Playback URL generation for recorded streams (Slice 12).
  getPlaybackUrl(cameraId: string, startTime: Date, endTime?: Date): Promise<string>;
  // TEST-ONLY: Recording availability probe for a specific time (Slice 12).
  checkRecordingAvailability(cameraId: string, timestamp: Date): Promise<{ available: boolean; reason?: string }>;
  // TEST-ONLY: Recording range lookup for a camera (Slice 12).
  getRecordingRange(cameraId: string): Promise<{ start?: Date; end?: Date } | null>;
}

// Adapters to be implemented:
// - DirectRTSPAdapter: For direct IP camera connections
// - MilestoneAdapter: For Milestone XProtect integration (Phase 2)
// - GenetecAdapter: For Genetec Security Center integration (Phase 2)

export { GenetecAdapter } from './genetec.adapter';
export { MilestoneAdapter } from './milestone.adapter';
export { VmsAdapterFactory } from './factory';
