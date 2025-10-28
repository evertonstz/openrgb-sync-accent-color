import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenRGBClient } from '../src/openrgb/client.js';

// Mock NetworkClient for deterministic data
vi.mock('../src/openrgb/network.js', () => {
  return {
    NetworkClient: vi.fn().mockImplementation(() => ({
      connected: false,
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      registerClient: vi.fn().mockResolvedValue(undefined),
      getControllerCount: vi.fn().mockResolvedValue(2),
      getControllerData: vi.fn().mockImplementation((index: number) => ({
        name: index === 0 ? 'Alpha Device' : 'Beta Device',
        serial: index === 0 ? 'A1B2C3D4' : 'A1B2C3D5',
        location: index === 0 ? 'usb-0000:00:14.0-1' : 'usb-0000:00:14.0-2',
        modes: [{ name: 'Direct', value: 0 }],
        leds: Array.from({ length: 5 }, (_, i) => ({ name: `LED ${i}` })),
        zones: [],
        colors: Array.from({ length: 5 }, () => ({ r: 10, g: 20, b: 30, a: 255 })),
      })),
      updateLeds: vi.fn().mockResolvedValue(undefined),
      setDeviceMode: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('StableId Determinism', () => {
  let client: any;
  beforeEach(async () => {
    vi.clearAllMocks();
    client = new OpenRGBClient('127.0.0.1', 6742, 'StableID-Test');
    await client.connect();
  });

  it('produces deterministic stableId across discoveries', async () => {
    const first = await client.discoverDevices();
    const firstIds = first.map((d: any) => d.stableId);
    // Re-discover
    const second = await client.discoverDevices();
    const secondIds = second.map((d: any) => d.stableId);
    expect(firstIds).toEqual(secondIds);
    // Format check
    firstIds.forEach((id: string) => expect(/^[0-9a-f]{16}$/.test(id)).toBe(true));
  });

  it('stableId changes if LED count changes', async () => {
    await client.discoverDevices();
    const originalIds = client.getDevices().map((d: any) => d.stableId);
    // Modify mock to return different LED count for device 0
    client.networkClient.getControllerData = vi.fn().mockImplementation((index: number) => ({
      name: index === 0 ? 'Alpha Device' : 'Beta Device',
      serial: index === 0 ? 'A1B2C3D4' : 'A1B2C3D5',
      location: index === 0 ? 'usb-0000:00:14.0-1' : 'usb-0000:00:14.0-2',
      modes: [{ name: 'Direct', value: 0 }],
      leds: Array.from({ length: index === 0 ? 6 : 5 }, (_, i) => ({ name: `LED ${i}` })), // changed
      zones: [],
      colors: Array.from({ length: index === 0 ? 6 : 5 }, () => ({ r: 10, g: 20, b: 30, a: 255 })),
    }));
    await client.discoverDevices();
    const newIds = client.getDevices().map((d: any) => d.stableId);
    expect(newIds[0]).not.toEqual(originalIds[0]);
    expect(newIds[1]).toEqual(originalIds[1]);
  });
});
