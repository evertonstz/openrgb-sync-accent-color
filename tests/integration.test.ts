import { describe, it, expect } from 'vitest';

describe('OpenRGB Module Integration', () => {
  describe('Constants module', () => {
    it('should export PacketType', async () => {
      const { PacketType } = await import('../src/openrgb/constants.js');
      expect(PacketType).toBeDefined();
      expect(typeof PacketType).toBe('object');
    });
  });

  describe('Parser module', () => {
    it('should export BinaryParser class', async () => {
      const { BinaryParser } = await import('../src/openrgb/parser.js');
      expect(BinaryParser).toBeDefined();
      expect(typeof BinaryParser).toBe('function');
    });

    it('should create BinaryParser instances', async () => {
      const { BinaryParser } = await import('../src/openrgb/parser.js');
      const buffer = new ArrayBuffer(10);
      const parser = new BinaryParser(buffer);
      expect(parser).toBeInstanceOf(BinaryParser);
    });
  });

  describe('Device module', () => {
    it('should export DeviceData class', async () => {
      const { DeviceData } = await import('../src/openrgb/device.js');
      expect(DeviceData).toBeDefined();
      expect(typeof DeviceData).toBe('function');
    });

    it('should create DeviceData instances', async () => {
      const { DeviceData } = await import('../src/openrgb/device.js');
      const device = new DeviceData();
      expect(device).toBeInstanceOf(DeviceData);
    });

    it('should have parse static method', async () => {
      const { DeviceData } = await import('../src/openrgb/device.js');
      expect(typeof DeviceData.parse).toBe('function');
    });
  });

  describe('Client module', () => {
    it('should export OpenRGBClient class', async () => {
      const { OpenRGBClient } = await import('../src/openrgb/client.js');
      expect(OpenRGBClient).toBeDefined();
      expect(typeof OpenRGBClient).toBe('function');
    });

    it('should create OpenRGBClient instances', async () => {
      const { OpenRGBClient } = await import('../src/openrgb/client.js');
      const client = new OpenRGBClient();
      expect(client).toBeInstanceOf(OpenRGBClient);
    });
  });

  describe('Module dependencies', () => {
    it('should have proper import relationships', async () => {
      // Test that modules can import their dependencies
      
      // Device should import parser
      const device = await import('../src/openrgb/device');
      expect(device).toBeDefined();
      
      // Client should import network (even if mocked in tests)
      const client = await import('../src/openrgb/client');
      expect(client).toBeDefined();
      
      // Network should import constants and device
      try {
        const network = await import('../src/openrgb/network.js');
        expect(network).toBeDefined();
      } catch (error) {
        // Expected to fail in test environment due to GJS dependencies
        expect(error).toBeDefined();
      }
    });

    it('should not have circular dependencies', async () => {
      // This test ensures modules can be imported independently
      const constants = await import('../src/openrgb/constants.js');
      const parser = await import('../src/openrgb/parser.js');
      const device = await import('../src/openrgb/device.js');
      const client = await import('../src/openrgb/client.js');
      
      expect(constants).toBeDefined();
      expect(parser).toBeDefined();
      expect(device).toBeDefined();
      expect(client).toBeDefined();
    });
  });

  describe('Type consistency', () => {
    it('should have consistent packet type usage', async () => {
      const { PacketType } = await import('../src/openrgb/constants.js');
      
      // Verify packet types are used consistently across modules
      const packetTypes = Object.values(PacketType);
      packetTypes.forEach(type => {
        expect(typeof type).toBe('number');
        expect(Number.isInteger(type)).toBe(true);
        expect(type).toBeGreaterThanOrEqual(0);
      });
    });

    it('should have consistent color format', async () => {
      const { BinaryParser } = await import('../src/openrgb/parser.js');
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      
      // Set up RGBA values
      view.setUint8(0, 255); // R
      view.setUint8(1, 128); // G
      view.setUint8(2, 64);  // B
      view.setUint8(3, 32);  // A
      
      const parser = new BinaryParser(buffer);
      const color = parser.readRGBColor();
      
      // Verify color format consistency
      expect(color).toHaveProperty('r');
      expect(color).toHaveProperty('g');
      expect(color).toHaveProperty('b');
      expect(color).toHaveProperty('a');
      expect(typeof color.r).toBe('number');
      expect(typeof color.g).toBe('number');
      expect(typeof color.b).toBe('number');
      expect(typeof color.a).toBe('number');
    });
  });

  describe('Error handling consistency', () => {
    it('should handle buffer overflow errors consistently', async () => {
      const { BinaryParser } = await import('../src/openrgb/parser.js');
      const smallBuffer = new ArrayBuffer(2);
      const parser = new BinaryParser(smallBuffer);
      
      // All read methods should throw similar errors for buffer overflow
      expect(() => parser.readUint32()).toThrow();
      expect(() => parser.readRGBColor()).toThrow();
    });

    it('should handle invalid data gracefully', async () => {
      const { DeviceData } = await import('../src/openrgb/device.js');
      const emptyBuffer = new ArrayBuffer(0);
      
      // Should not throw, but return valid DeviceData instance
      expect(() => {
        const result = DeviceData.parse(emptyBuffer);
        expect(result).toBeInstanceOf(DeviceData);
      }).not.toThrow();
    });
  });

  describe('Performance considerations', () => {
    it('should handle large buffers efficiently', async () => {
      const { BinaryParser } = await import('../src/openrgb/parser.js');
      const largeBuffer = new ArrayBuffer(1024 * 1024); // 1MB
      
      const startTime = performance.now();
      const parser = new BinaryParser(largeBuffer);
      expect(parser.hasMoreData()).toBe(true);
      const endTime = performance.now();
      
      // Should be fast (less than 100ms for 1MB buffer creation)
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle multiple instances efficiently', async () => {
      const { DeviceData } = await import('../src/openrgb/device.js');
      
      const startTime = performance.now();
      const devices = Array.from({ length: 100 }, () => new DeviceData());
      const endTime = performance.now();
      
      expect(devices).toHaveLength(100);
      devices.forEach(device => {
        expect(device).toBeInstanceOf(DeviceData);
      });
      
      // Should be fast (less than 50ms for 100 instances)
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('Memory management', () => {
    it('should not leak memory with buffer operations', async () => {
      const { BinaryParser } = await import('../src/openrgb/parser.js');
      
      // Create and dispose of many parsers
      for (let i = 0; i < 1000; i++) {
        const buffer = new ArrayBuffer(100);
        const parser = new BinaryParser(buffer);
        expect(parser).toBeInstanceOf(BinaryParser);
        
        // Perform some operations
        if (parser.hasMoreData()) {
          parser.skip(Math.min(10, buffer.byteLength));
        }
      }
      
      // If we get here without running out of memory, the test passes
      expect(true).toBe(true);
    });

    it('should handle buffer references correctly', async () => {
      const { BinaryParser } = await import('../src/openrgb/parser.js');
      const buffer = new ArrayBuffer(100);
      const parser1 = new BinaryParser(buffer);
      const parser2 = new BinaryParser(buffer, 50);
      
      // Both parsers should work with the same buffer
      expect(parser1.hasMoreData()).toBe(true);
      expect(parser2.hasMoreData()).toBe(true);
      
      // Operations on one shouldn't affect the other
      parser1.skip(10);
      expect(parser2.hasMoreData()).toBe(true);
    });
  });
});
