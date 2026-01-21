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
  static create(provider: VmsProvider): VmsAdapterFactoryResult {
    switch (provider) {
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
          },
          capabilities: { ...unsupportedCapabilities },
        };
    }
  }
}
