/**
 * VMS Adapter Factory Unit Tests
 */

import { describe, it, expect } from '@jest/globals';
import { VmsAdapterFactory } from './factory';
import { MilestoneAdapter } from './milestone.adapter';
import { GenetecAdapter } from './genetec.adapter';

describe('VmsAdapterFactory', () => {
  it('returns Shinobi capabilities without a concrete adapter', () => {
    // Verify capability flags for the Shinobi provider.
    const result = VmsAdapterFactory.create('shinobi');

    expect(result.capabilities.supportsLive).toBe(true);
    expect(result.capabilities.supportsPlayback).toBe(true);
    expect(result.capabilities.supportsExport).toBe(false);
  });

  it('returns Milestone adapter with disabled capabilities', () => {
    // Confirm Milestone adapter scaffolding is wired to the factory.
    const result = VmsAdapterFactory.create('milestone');

    expect(result.adapter).toBeInstanceOf(MilestoneAdapter);
    expect(result.capabilities).toEqual({
      supportsLive: false,
      supportsPlayback: false,
      supportsExport: false,
    });
  });

  it('returns Genetec adapter with disabled capabilities', () => {
    // Confirm Genetec adapter scaffolding is wired to the factory.
    const result = VmsAdapterFactory.create('genetec');

    expect(result.adapter).toBeInstanceOf(GenetecAdapter);
    expect(result.capabilities).toEqual({
      supportsLive: false,
      supportsPlayback: false,
      supportsExport: false,
    });
  });

  it('returns unsupported adapter for unknown providers', async () => {
    // Ensure unsupported providers fail with a clear error.
    const result = VmsAdapterFactory.create('other');

    await expect(result.adapter.getStreamUrls('camera')).rejects.toThrow('Unsupported VMS provider');
  });

  it('Milestone adapter methods throw not implemented errors', async () => {
    // Validate stubbed Milestone adapter error messaging.
    const { adapter } = VmsAdapterFactory.create('milestone');

    await expect(adapter.getStreamUrls('camera')).rejects.toThrow('Milestone adapter is not implemented');
    await expect(adapter.testConnection()).rejects.toThrow('Milestone adapter is not implemented');
    await expect(adapter.getPlaybackUrl('camera', new Date())).rejects.toThrow('Milestone adapter is not implemented');
  });

  it('Genetec adapter methods throw not implemented errors', async () => {
    // Validate stubbed Genetec adapter error messaging.
    const { adapter } = VmsAdapterFactory.create('genetec');

    await expect(adapter.getStreamUrls('camera')).rejects.toThrow('Genetec adapter is not implemented');
    await expect(adapter.testConnection()).rejects.toThrow('Genetec adapter is not implemented');
    await expect(adapter.getPlaybackUrl('camera', new Date())).rejects.toThrow('Genetec adapter is not implemented');
  });
});
