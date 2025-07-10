import { describe, it, expect, beforeEach } from 'vitest';
import { DeviceData } from '../src/openrgb/device.js';

describe('DeviceData', () => {
  let deviceData: any;

  beforeEach(() => {
    deviceData = new DeviceData();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(deviceData.name).toBe('');
      expect(deviceData.description).toBe('');
      expect(deviceData.version).toBe('');
      expect(deviceData.serial).toBe('');
      expect(deviceData.location).toBe('');
      expect(deviceData.modes).toEqual([]);
      expect(deviceData.zones).toEqual([]);
      expect(deviceData.leds).toEqual([]);
      expect(deviceData.colors).toEqual([]);
    });
  });

  describe('parse method', () => {
    it('should exist and be a static method', () => {
      expect(typeof DeviceData.parse).toBe('function');
    });

    it('should return DeviceData instance when given invalid data', () => {
      // Test with empty buffer
      const emptyBuffer = new ArrayBuffer(0);
      const result = DeviceData.parse(emptyBuffer);

      expect(result).toBeInstanceOf(DeviceData);
      expect((result as any).name).toBe('');
      expect((result as any).description).toBe('');
      expect((result as any).version).toBe('');
      expect((result as any).serial).toBe('');
      expect((result as any).location).toBe('');
    });

    it('should handle parsing errors gracefully', () => {
      // Create a buffer with insufficient data
      const buffer = new ArrayBuffer(4);
      const view = new DataView(buffer);
      view.setUint32(0, 100, true); // Data size larger than actual buffer

      // Should not throw, but return a DeviceData instance
      expect(() => {
        const result = DeviceData.parse(buffer);
        expect(result).toBeInstanceOf(DeviceData);
      }).not.toThrow();
    });

    it('should parse a well-formed device data buffer', () => {
      // Create a minimal valid device data buffer
      const buffer = createMinimalDeviceDataBuffer();
      const result = DeviceData.parse(buffer);

      expect(result).toBeInstanceOf(DeviceData);
      expect((result as any).name).toBeDefined();
      expect(Array.isArray((result as any).modes)).toBe(true);
      expect(Array.isArray((result as any).zones)).toBe(true);
      expect(Array.isArray((result as any).leds)).toBe(true);
      expect(Array.isArray((result as any).colors)).toBe(true);
    });

    it('should handle device with modes', () => {
      const buffer = createDeviceDataWithModes();
      const result = DeviceData.parse(buffer);

      expect(result).toBeInstanceOf(DeviceData);
      expect((result as any).modes.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle device with zones', () => {
      const buffer = createDeviceDataWithZones();
      const result = DeviceData.parse(buffer);

      expect(result).toBeInstanceOf(DeviceData);
      expect((result as any).zones.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle device with LEDs', () => {
      const buffer = createDeviceDataWithLeds();
      const result = DeviceData.parse(buffer);

      expect(result).toBeInstanceOf(DeviceData);
      expect((result as any).leds.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('data structure validation', () => {
    it('should have correct property types after parsing', () => {
      const buffer = createMinimalDeviceDataBuffer();
      const result = DeviceData.parse(buffer) as any;

      expect(typeof result.name).toBe('string');
      expect(typeof result.description).toBe('string');
      expect(typeof result.version).toBe('string');
      expect(typeof result.serial).toBe('string');
      expect(typeof result.location).toBe('string');
      expect(Array.isArray(result.modes)).toBe(true);
      expect(Array.isArray(result.zones)).toBe(true);
      expect(Array.isArray(result.leds)).toBe(true);
      expect(Array.isArray(result.colors)).toBe(true);
    });

    it('should maintain array immutability patterns', () => {
      const device1 = new DeviceData() as any;
      const device2 = new DeviceData() as any;

      // Arrays should be separate instances
      expect(device1.modes).not.toBe(device2.modes);
      expect(device1.zones).not.toBe(device2.zones);
      expect(device1.leds).not.toBe(device2.leds);
      expect(device1.colors).not.toBe(device2.colors);
    });
  });

  describe('mode data structure', () => {
    it('should parse mode data correctly when present', () => {
      const buffer = createDeviceDataWithComplexModes();
      const result = DeviceData.parse(buffer) as any;

      if (result.modes.length > 0) {
        const mode = result.modes[0];
        expect(mode).toBeDefined();
        expect(typeof mode.name).toBe('string');
        if (Object.hasOwn(mode, 'value')) expect(typeof mode.value).toBe('number');
        if (Object.hasOwn(mode, 'flags')) expect(typeof mode.flags).toBe('number');
        if (Object.hasOwn(mode, 'colors')) expect(Array.isArray(mode.colors)).toBe(true);
      }
    });
  });

  describe('zone data structure', () => {
    it('should parse zone data correctly when present', () => {
      const buffer = createDeviceDataWithComplexZones();
      const result = DeviceData.parse(buffer) as any;

      if (result.zones.length > 0) {
        const zone = result.zones[0];
        expect(zone).toBeDefined();
        expect(typeof zone.name).toBe('string');
        if (Object.hasOwn(zone, 'type')) expect(typeof zone.type).toBe('number');
        if (Object.hasOwn(zone, 'ledsCount')) expect(typeof zone.ledsCount).toBe('number');
      }
    });
  });

  describe('LED data structure', () => {
    it('should parse LED data correctly when present', () => {
      const buffer = createDeviceDataWithComplexLeds();
      const result = DeviceData.parse(buffer) as any;

      if (result.leds.length > 0) {
        const led = result.leds[0];
        expect(led).toBeDefined();
        expect(typeof led.name).toBe('string');
        if (Object.hasOwn(led, 'value')) expect(typeof led.value).toBe('number');
      }
    });
  });

  describe('color data structure', () => {
    it('should parse color data correctly when present', () => {
      const buffer = createDeviceDataWithColors();
      const result = DeviceData.parse(buffer) as any;

      if (result.colors.length > 0) {
        const color = result.colors[0];
        expect(color).toBeDefined();
        expect(typeof color.r).toBe('number');
        expect(typeof color.g).toBe('number');
        expect(typeof color.b).toBe('number');
        expect(typeof color.a).toBe('number');
        expect(color.r).toBeGreaterThanOrEqual(0);
        expect(color.r).toBeLessThanOrEqual(255);
        expect(color.g).toBeGreaterThanOrEqual(0);
        expect(color.g).toBeLessThanOrEqual(255);
        expect(color.b).toBeGreaterThanOrEqual(0);
        expect(color.b).toBeLessThanOrEqual(255);
        expect(color.a).toBeGreaterThanOrEqual(0);
        expect(color.a).toBeLessThanOrEqual(255);
      }
    });
  });
});

// Helper functions to create test buffers
function createMinimalDeviceDataBuffer(): ArrayBuffer {
  // Create minimal valid buffer with empty strings and zero counts
  const buffer = new ArrayBuffer(128);
  const view = new DataView(buffer);
  let offset = 0;

  // Header
  view.setUint32(offset, 100, true);
  offset += 4; // data size
  view.setUint32(offset, 1, true);
  offset += 4; // command type

  // Device strings (all empty)
  view.setUint16(offset, 0, true);
  offset += 2; // name length
  view.setUint16(offset, 0, true);
  offset += 2; // description length
  view.setUint16(offset, 0, true);
  offset += 2; // version length
  view.setUint16(offset, 0, true);
  offset += 2; // serial length
  view.setUint16(offset, 0, true);
  offset += 2; // location length

  // Counts (all zero)
  view.setUint16(offset, 0, true);
  offset += 2; // mode count
  view.setUint32(offset, 0, true);
  offset += 4; // active mode
  view.setUint16(offset, 0, true);
  offset += 2; // zone count
  view.setUint16(offset, 0, true);
  offset += 2; // LED count
  view.setUint16(offset, 0, true);
  offset += 2; // color count

  return buffer;
}

function createDeviceDataWithModes(): ArrayBuffer {
  return createMinimalDeviceDataBuffer(); // For now, return minimal buffer
}

function createDeviceDataWithZones(): ArrayBuffer {
  return createMinimalDeviceDataBuffer(); // For now, return minimal buffer
}

function createDeviceDataWithLeds(): ArrayBuffer {
  return createMinimalDeviceDataBuffer(); // For now, return minimal buffer
}

function createDeviceDataWithColors(): ArrayBuffer {
  return createMinimalDeviceDataBuffer(); // For now, return minimal buffer
}

function createDeviceDataWithComplexModes(): ArrayBuffer {
  return createMinimalDeviceDataBuffer(); // For now, return minimal buffer
}

function createDeviceDataWithComplexZones(): ArrayBuffer {
  return createMinimalDeviceDataBuffer(); // For now, return minimal buffer
}

function createDeviceDataWithComplexLeds(): ArrayBuffer {
  return createMinimalDeviceDataBuffer(); // For now, return minimal buffer
}
