import { AppError } from '../../utils/errors';
import { IVMSAdapter, StreamUrls } from './index';

export class MilestoneAdapter implements IVMSAdapter {
  async getStreamUrls(_cameraId: string): Promise<StreamUrls> {
    // Stub implementation for Slice 11: not yet supported.
    throw new AppError('RESOURCE_NOT_FOUND', 'Milestone adapter is not implemented', 501);
  }

  async testConnection(): Promise<{ success: boolean; message?: string }> {
    // Stub implementation for Slice 11: not yet supported.
    throw new AppError('RESOURCE_NOT_FOUND', 'Milestone adapter is not implemented', 501);
  }

  async getPlaybackUrl(_cameraId: string, _startTime: Date, _endTime?: Date): Promise<string> {
    // Stub implementation for Slice 11: not yet supported.
    throw new AppError('RESOURCE_NOT_FOUND', 'Milestone adapter is not implemented', 501);
  }
}
