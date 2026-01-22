import { VmsProvider } from '../../models/vms-server.model';
import { IVMSAdapter } from './index';
import { MilestoneAdapter } from './milestone.adapter';
import { GenetecAdapter } from './genetec.adapter';

export type VmsAdapterCapabilities = {
  supportsLive: boolean;
  supportsPlayback: boolean;
  supportsExport: boolean;
};

export type VmsAdapterFactoryResult = {
  adapter: IVMSAdapter;
  capabilities: VmsAdapterCapabilities;
};

const unsupportedCapabilities: VmsAdapterCapabilities = {
  supportsLive: false,
  supportsPlayback: false,
  supportsExport: false,
};

export class VmsAdapterFactory {
  // TEST-ONLY: Allow direct-rtsp to reuse capability checks without a VMS server.
  static create(provider: VmsProvider | 'direct-rtsp'): VmsAdapterFactoryResult {
    switch (provider) {
      case 'shinobi':
        return {
          adapter: {
            getStreamUrls: async () => {
              throw new Error('Shinobi adapter is handled via vmsService');
            },
            testConnection: async () => {
              throw new Error('Shinobi adapter is handled via vmsService');
            },
            getPlaybackUrl: async () => {
              throw new Error('Shinobi adapter is handled via vmsService');
            },
            checkRecordingAvailability: async () => {
              throw new Error('Shinobi adapter is handled via vmsService');
            },
            getRecordingRange: async () => {
              throw new Error('Shinobi adapter is handled via vmsService');
            },
          },
          capabilities: {
            supportsLive: true,
            supportsPlayback: true,
            supportsExport: false,
          },
        };
      case 'direct-rtsp':
        return {
          adapter: {
            getStreamUrls: async () => {
              throw new Error('Direct RTSP streams are handled via rtspStreamService');
            },
            testConnection: async () => {
              throw new Error('Direct RTSP streams are handled via rtspStreamService');
            },
            getPlaybackUrl: async () => {
              throw new Error('Direct RTSP playback is not supported');
            },
            checkRecordingAvailability: async () => {
              throw new Error('Direct RTSP playback is not supported');
            },
            getRecordingRange: async () => {
              throw new Error('Direct RTSP playback is not supported');
            },
          },
          capabilities: {
            supportsLive: true,
            supportsPlayback: false,
            supportsExport: false,
          },
        };
      case 'milestone':
        return {
          adapter: new MilestoneAdapter(),
          capabilities: { ...unsupportedCapabilities },
        };
      case 'genetec':
        return {
          adapter: new GenetecAdapter(),
          capabilities: { ...unsupportedCapabilities },
        };
      case 'zoneminder':
      case 'agentdvr':
      case 'other':
      default:
        return {
          adapter: {
            getStreamUrls: async () => {
              throw new Error(`Unsupported VMS provider: ${provider}`);
            },
            testConnection: async () => {
              throw new Error(`Unsupported VMS provider: ${provider}`);
            },
            getPlaybackUrl: async () => {
              throw new Error(`Unsupported VMS provider: ${provider}`);
            },
            checkRecordingAvailability: async () => {
              throw new Error(`Unsupported VMS provider: ${provider}`);
            },
            getRecordingRange: async () => {
              throw new Error(`Unsupported VMS provider: ${provider}`);
            },
          },
          capabilities: { ...unsupportedCapabilities },
        };
    }
  }
}
