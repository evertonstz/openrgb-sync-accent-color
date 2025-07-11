import { describe, it, expect } from 'vitest';

describe('OpenRGB Module Index', () => {
  describe('module exports', () => {
    it('should export all main classes and constants', async () => {
      const openrgb = await import('../../src/openrgb/index.js');

      expect(openrgb.PacketType).toBeDefined();
      expect(openrgb.DeviceData).toBeDefined();
      expect(openrgb.OpenRGBClient).toBeDefined();
    });

    it('should have proper module structure', async () => {
      const openrgb = await import('../../src/openrgb/index.js');

      // Check that all exports are defined
      expect(typeof openrgb.PacketType).toBe('object');
      expect(typeof openrgb.DeviceData).toBe('function');
      expect(typeof openrgb.OpenRGBClient).toBe('function');
    });

    it('should allow creating instances of exported classes', async () => {
      const { DeviceData, OpenRGBClient } = await import(
        '../../src/openrgb/index.js'
      );

      // Test that we can create instances
      const deviceData = new DeviceData();
      expect(deviceData).toBeInstanceOf(DeviceData);

      const client = new OpenRGBClient();
      expect(client).toBeInstanceOf(OpenRGBClient);
    });
  });

  describe('re-exports consistency', () => {
    it('should re-export the same objects as individual modules', async () => {
      // Import from index
      const fromIndex = await import('../../src/openrgb/index.js');

      // Import from individual modules
      const { PacketType } = await import('../../src/openrgb/enums.js');
      const { DeviceData } = await import('../../src/openrgb/device.js');
      const { OpenRGBClient } = await import('../../src/openrgb/client.js');

      // Verify they're the same objects
      expect(fromIndex.PacketType).toBe(PacketType);
      expect(fromIndex.DeviceData).toBe(DeviceData);
      expect(fromIndex.OpenRGBClient).toBe(OpenRGBClient);
    });
  });
});
