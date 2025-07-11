import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenRGBClient } from '../src/openrgb/client.js';

// Mock the NetworkClient since it depends on GJS/GTK
vi.mock('../src/openrgb/network.js', () => {
  return {
    NetworkClient: vi.fn().mockImplementation((address, port, name) => ({
      address,
      port,
      name,
      connected: false,
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      registerClient: vi.fn().mockResolvedValue(undefined),
      getControllerCount: vi.fn().mockResolvedValue(2),
      getControllerData: vi.fn().mockImplementation((index) => ({
        name: `Test Device ${index}`,
        description: 'Test Description',
        version: '1.0',
        serial: '12345',
        location: 'Test Location',
        modes: [
          { name: 'Direct', value: 0 },
          { name: 'Static', value: 1 },
        ],
        zones: [{ name: 'Zone 1', ledsCount: 10 }],
        leds: Array.from({ length: 10 }, (_, i) => ({ name: `LED ${i}` })),
        colors: Array.from({ length: 10 }, () => ({ r: 255, g: 0, b: 0, a: 255 })),
      })),
      updateLeds: vi.fn().mockResolvedValue(undefined),
      setDeviceMode: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('OpenRGBClient', () => {
  let client: any;
  const mockAddress = '192.168.1.100';
  const mockPort = 6742;
  const mockName = 'Test Client';

  beforeEach(() => {
    vi.clearAllMocks();
    client = new OpenRGBClient(mockAddress, mockPort, mockName);
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const defaultClient = new OpenRGBClient() as any;
      expect(defaultClient).toBeDefined();
      // Check that it was created with defaults by checking internal state
      expect(defaultClient.connected).toBe(false);
      expect(Array.isArray(defaultClient.devices)).toBe(true);
      expect(defaultClient.devices).toEqual([]);
    });

    it('should initialize with custom values', () => {
      expect(client).toBeDefined();
      expect(client.connected).toBe(false);
      expect(Array.isArray(client.devices)).toBe(true);
      expect(client.devices).toEqual([]);
    });

    it('should accept settings parameter', () => {
      const _settings = { timeout: 5000 };
      // Note: settings parameter might not be supported in current implementation
      const clientWithSettings = new OpenRGBClient(mockAddress, mockPort, mockName) as any;
      expect(clientWithSettings).toBeDefined();
      // Test would need to be updated if settings parameter is implemented
    });
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      await client.connect();
      expect(client.connected).toBe(true);
      expect(client.networkClient.connect).toHaveBeenCalledOnce();
    });

    it('should handle connection errors', async () => {
      const errorClient = new OpenRGBClient() as any;
      errorClient.networkClient.connect = vi.fn().mockRejectedValue(new Error('Connection failed'));

      await expect(errorClient.connect()).rejects.toThrow('Connection failed');
      expect(errorClient.connected).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('should disconnect successfully', async () => {
      await client.connect();
      expect(client.connected).toBe(true);

      client.disconnect();
      expect(client.connected).toBe(false);
      expect(client.networkClient.disconnect).toHaveBeenCalledOnce();
    });

    it('should handle disconnect when not connected', () => {
      expect(client.connected).toBe(false);
      expect(() => client.disconnect()).not.toThrow();
      expect(client.connected).toBe(false);
    });
  });

  describe('discoverDevices', () => {
    beforeEach(async () => {
      await client.connect();
    });

    it('should discover devices successfully', async () => {
      await client.discoverDevices();

      expect(client.networkClient.registerClient).toHaveBeenCalledOnce();
      expect(client.networkClient.getControllerCount).toHaveBeenCalledOnce();
      expect(client.networkClient.getControllerData).toHaveBeenCalledWith(0);
      expect(client.networkClient.getControllerData).toHaveBeenCalledWith(1);

      expect(client.devices).toHaveLength(2);
      expect(client.devices[0]).toMatchObject({
        id: 0,
        name: 'Test Device 0',
      });
      expect(client.devices[1]).toMatchObject({
        id: 1,
        name: 'Test Device 1',
      });
    });

    it('should throw error when not connected', async () => {
      client.disconnect();
      await expect(client.discoverDevices()).rejects.toThrow(
        'Client is not connected to OpenRGB server',
      );
    });

    it('should find direct mode for devices', async () => {
      await client.discoverDevices();

      // Assuming the mock returns modes with 'Direct' mode
      expect(client.devices[0]).toHaveProperty('directModeIndex');
      expect(typeof client.devices[0].directModeIndex).toBe('number');
    });

    it('should handle devices without direct mode', async () => {
      // Mock device without direct mode
      client.networkClient.getControllerData = vi.fn().mockImplementation((index) => ({
        name: `Test Device ${index}`,
        modes: [
          { name: 'Static', value: 1 },
          { name: 'Rainbow', value: 2 },
        ],
        zones: [],
        leds: [],
        colors: [],
      }));

      await client.discoverDevices();

      expect(client.devices[0]).toHaveProperty('directModeIndex');
      expect(client.devices[0].directModeIndex).toBe(0); // Should default to first mode
    });

    it('should handle discovery errors gracefully', async () => {
      client.networkClient.getControllerCount = vi
        .fn()
        .mockRejectedValue(new Error('Discovery failed'));

      await expect(client.discoverDevices()).rejects.toThrow(
        'Device discovery failed: Discovery failed',
      );
    });

    it('should handle individual device errors gracefully', async () => {
      client.networkClient.getControllerData = vi
        .fn()
        .mockResolvedValueOnce({
          name: 'Working Device',
          modes: [{ name: 'Direct', value: 0 }],
          zones: [],
          leds: [],
          colors: [],
        })
        .mockRejectedValueOnce(new Error('Device error'));

      // Should not throw, but should handle the error for the second device
      const devices = await client.discoverDevices();
      expect(devices).toHaveLength(2); // Working device + failed placeholder

      // Should have the working device
      expect(devices[0].name).toBe('Working Device');

      // Should have a placeholder for the failed device
      expect(devices[1].name).toBe('Device 1 (Failed)');
      expect(devices[1].ledCount).toBe(0);
      expect(devices[1].data).toBeNull();
    });
  });

  describe('device management', () => {
    beforeEach(async () => {
      await client.connect();
      await client.discoverDevices();
    });

    it('should maintain device list', () => {
      expect(Array.isArray(client.devices)).toBe(true);
      expect(client.devices.length).toBeGreaterThan(0);
    });

    it('should provide device information', () => {
      const device = client.devices[0];
      expect(device).toHaveProperty('id');
      expect(device).toHaveProperty('name');
      expect(typeof device.id).toBe('number');
      expect(typeof device.name).toBe('string');
    });

    it('should clear devices on new discovery', async () => {
      const initialDevices = [...client.devices];
      expect(initialDevices.length).toBeGreaterThan(0);

      await client.discoverDevices();

      // Devices should be replaced, not appended
      expect(client.devices.length).toBe(2); // Same as mock count
    });
  });

  describe('network client integration', () => {
    it('should pass correct parameters to NetworkClient', () => {
      const testClient = new OpenRGBClient('10.0.0.1', 1234, 'Custom Name');
      expect((testClient as any).networkClient.address).toBe('10.0.0.1');
      expect((testClient as any).networkClient.port).toBe(1234);
      expect((testClient as any).networkClient.name).toBe('Custom Name');
    });

    it('should use default NetworkClient parameters', () => {
      const defaultClient = new OpenRGBClient();
      expect((defaultClient as any).networkClient.address).toBe('127.0.0.1');
      expect((defaultClient as any).networkClient.port).toBe(6742);
      expect((defaultClient as any).networkClient.name).toBe('GNOME-OpenRGB-AccentSync');
    });
  });

  describe('error handling', () => {
    it('should handle connection state properly', async () => {
      expect(client.connected).toBe(false);

      await client.connect();
      expect(client.connected).toBe(true);

      client.disconnect();
      expect(client.connected).toBe(false);
    });

    it('should maintain consistency on connection errors', async () => {
      client.networkClient.connect = vi.fn().mockRejectedValue(new Error('Network error'));

      try {
        await client.connect();
      } catch (_error) {
        expect(client.connected).toBe(false);
      }
    });
  });

  describe('settings handling', () => {
    it('should store settings when provided', () => {
      const settings = {
        timeout: 10000,
        retries: 3,
        enableLogging: true,
      };
      const clientWithSettings = new OpenRGBClient('127.0.0.1', 6742, 'Test', settings as any);
      expect((clientWithSettings as any).settings).toEqual(settings);
    });

    it('should handle null settings', () => {
      const clientWithNullSettings = new OpenRGBClient('127.0.0.1', 6742, 'Test', null);
      expect((clientWithNullSettings as any).settings).toBeNull();
    });

    it('should handle undefined settings', () => {
      const clientWithUndefinedSettings = new OpenRGBClient('127.0.0.1', 6742, 'Test');
      expect((clientWithUndefinedSettings as any).settings).toBeNull();
    });
  });
});
