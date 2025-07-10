import { describe, it, expect, beforeEach } from 'vitest';
import { BinaryParser } from '../../src/openrgb/parser.js';

describe('BinaryParser', () => {
  let buffer: ArrayBuffer;
  let parser: any;

  beforeEach(() => {
    // Create a test buffer with known data
    buffer = new ArrayBuffer(64);
    const view = new DataView(buffer);

    // Write test data in little-endian format
    view.setUint32(0, 0x12345678, true); // offset 0-3
    view.setUint16(4, 0xabcd, true); // offset 4-5
    view.setUint16(6, 5, true); // string length at offset 6-7
    // String "Hello" at offset 8-12
    view.setUint8(8, 72); // 'H'
    view.setUint8(9, 101); // 'e'
    view.setUint8(10, 108); // 'l'
    view.setUint8(11, 108); // 'l'
    view.setUint8(12, 111); // 'o'

    // RGB color at offset 13-16
    view.setUint8(13, 255); // R
    view.setUint8(14, 128); // G
    view.setUint8(15, 64); // B
    view.setUint8(16, 32); // A

    parser = new BinaryParser(buffer);
  });

  describe('constructor', () => {
    it('should initialize with data and default offset of 0', () => {
      const newParser = new BinaryParser(buffer) as any;
      expect(newParser.data).toBe(buffer);
      expect(newParser.offset).toBe(0);
    });

    it('should initialize with custom offset', () => {
      const newParser = new BinaryParser(buffer, 10) as any;
      expect(newParser.data).toBe(buffer);
      expect(newParser.offset).toBe(10);
    });
  });

  describe('readUint32', () => {
    it('should read 32-bit unsigned integer in little-endian format', () => {
      const value = parser.readUint32();
      expect(value).toBe(0x12345678);
      expect(parser.offset).toBe(4);
    });

    it('should throw error when reading beyond buffer', () => {
      parser.offset = buffer.byteLength - 2; // Not enough space for Uint32
      expect(() => parser.readUint32()).toThrow('Cannot read Uint32 at offset');
    });

    it('should read multiple Uint32 values correctly', () => {
      const view = new DataView(buffer);
      view.setUint32(4, 0x87654321, true);

      const value1 = parser.readUint32();
      const value2 = parser.readUint32();

      expect(value1).toBe(0x12345678);
      expect(value2).toBe(0x87654321);
      expect(parser.offset).toBe(8);
    });
  });

  describe('readUint16', () => {
    it('should read 16-bit unsigned integer in little-endian format', () => {
      parser.offset = 4; // Skip the Uint32
      const value = parser.readUint16();
      expect(value).toBe(0xabcd);
      expect(parser.offset).toBe(6);
    });

    it('should throw error when reading beyond buffer', () => {
      parser.offset = buffer.byteLength - 1; // Not enough space for Uint16
      expect(() => parser.readUint16()).toThrow('Cannot read Uint16 at offset');
    });

    it('should handle edge values correctly', () => {
      const view = new DataView(buffer);
      view.setUint16(20, 0, true); // Min value
      view.setUint16(22, 0xffff, true); // Max value

      parser.offset = 20;
      const minValue = parser.readUint16();
      const maxValue = parser.readUint16();

      expect(minValue).toBe(0);
      expect(maxValue).toBe(0xffff);
    });
  });

  describe('readString', () => {
    it('should read string with length prefix', () => {
      parser.offset = 6; // Position at string length
      const str = parser.readString();
      expect(str).toBe('Hello');
      expect(parser.offset).toBe(13);
    });

    it('should return empty string when length is 0', () => {
      const view = new DataView(buffer);
      view.setUint16(30, 0, true); // Zero length

      parser.offset = 30;
      const str = parser.readString();
      expect(str).toBe('');
      expect(parser.offset).toBe(32);
    });

    it('should throw error when string extends beyond buffer', () => {
      const view = new DataView(buffer);
      view.setUint16(60, 10, true); // Length of 10 but only 4 bytes left

      parser.offset = 60;
      expect(() => parser.readString()).toThrow('Cannot read string of length');
    });

    it('should handle Unicode strings correctly', () => {
      const testString = 'Hello 🌍';
      const encoder = new TextEncoder();
      const encoded = encoder.encode(testString);

      const testBuffer = new ArrayBuffer(encoded.length + 2);
      const view = new DataView(testBuffer);
      view.setUint16(0, encoded.length, true);

      const uint8View = new Uint8Array(testBuffer, 2);
      uint8View.set(encoded);

      const testParser = new BinaryParser(testBuffer);
      const decoded = testParser.readString();
      expect(decoded).toBe(testString);
    });
  });

  describe('readRGBColor', () => {
    it('should read RGBA color values', () => {
      parser.offset = 13; // Position at color data
      const color = parser.readRGBColor();

      expect(color).toEqual({
        r: 255,
        g: 128,
        b: 64,
        a: 32,
      });
      expect(parser.offset).toBe(17);
    });

    it('should throw error when reading beyond buffer', () => {
      parser.offset = buffer.byteLength - 2; // Not enough space for RGBA
      expect(() => parser.readRGBColor()).toThrow('Cannot read RGBColor at offset');
    });

    it('should handle edge color values', () => {
      const view = new DataView(buffer);
      view.setUint8(20, 0); // R = 0
      view.setUint8(21, 255); // G = 255
      view.setUint8(22, 0); // B = 0
      view.setUint8(23, 255); // A = 255

      parser.offset = 20;
      const color = parser.readRGBColor();

      expect(color).toEqual({
        r: 0,
        g: 255,
        b: 0,
        a: 255,
      });
    });
  });

  describe('skip', () => {
    it('should advance offset by specified number of bytes', () => {
      const initialOffset = parser.offset;
      parser.skip(10);
      expect(parser.offset).toBe(initialOffset + 10);
    });

    it('should throw error when skipping beyond buffer', () => {
      parser.offset = buffer.byteLength - 5;
      expect(() => parser.skip(10)).toThrow('Cannot skip 10 bytes at offset');
    });

    it('should allow skipping 0 bytes', () => {
      const initialOffset = parser.offset;
      parser.skip(0);
      expect(parser.offset).toBe(initialOffset);
    });
  });

  describe('hasMoreData', () => {
    it('should return true when there is more data to read', () => {
      expect(parser.hasMoreData()).toBe(true);
    });

    it('should return false when at end of buffer', () => {
      parser.offset = buffer.byteLength;
      expect(parser.hasMoreData()).toBe(false);
    });

    it('should return false when past end of buffer', () => {
      parser.offset = buffer.byteLength + 10;
      expect(parser.hasMoreData()).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle empty buffer', () => {
      const emptyBuffer = new ArrayBuffer(0);
      const emptyParser = new BinaryParser(emptyBuffer);

      expect(emptyParser.hasMoreData()).toBe(false);
      expect(() => emptyParser.readUint32()).toThrow();
      expect(() => emptyParser.readUint16()).toThrow();
      expect(() => emptyParser.readRGBColor()).toThrow();
    });

    it('should provide accurate error messages with buffer information', () => {
      parser.offset = buffer.byteLength - 1;

      try {
        parser.readUint32();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain(`offset ${buffer.byteLength - 1}`);
        expect(error.message).toContain(`buffer size: ${buffer.byteLength}`);
      }
    });

    it('should handle large offset values gracefully', () => {
      parser.offset = Number.MAX_SAFE_INTEGER;
      expect(parser.hasMoreData()).toBe(false);
      expect(() => parser.readUint32()).toThrow();
    });
  });

  describe('sequential reading operations', () => {
    it('should correctly parse a complete data structure', () => {
      // Reset parser to beginning
      parser.offset = 0;

      // Read in sequence: Uint32, Uint16, String, RGBColor
      const uint32Value = parser.readUint32();
      const uint16Value = parser.readUint16();
      const stringValue = parser.readString();
      const colorValue = parser.readRGBColor();

      expect(uint32Value).toBe(0x12345678);
      expect(uint16Value).toBe(0xabcd);
      expect(stringValue).toBe('Hello');
      expect(colorValue).toEqual({ r: 255, g: 128, b: 64, a: 32 });
      expect(parser.offset).toBe(17);
    });

    it('should maintain correct offset throughout multiple operations', () => {
      const offsets: number[] = [];

      offsets.push(parser.offset); // 0
      parser.readUint32();
      offsets.push(parser.offset); // 4
      parser.readUint16();
      offsets.push(parser.offset); // 6
      parser.readString();
      offsets.push(parser.offset); // 13
      parser.readRGBColor();
      offsets.push(parser.offset); // 17

      expect(offsets).toEqual([0, 4, 6, 13, 17]);
    });
  });
});
