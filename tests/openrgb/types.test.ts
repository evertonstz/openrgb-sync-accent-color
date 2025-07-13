import { describe, expect, it } from 'vitest';
import {
  createRGBColor,
  isValidRGBColor,
  type RGBColor,
  validateRGBColor,
} from '../../src/openrgb/types.js';

describe('OpenRGB Types Utility Functions', () => {
  describe('validateRGBColor', () => {
    it('should validate and return a complete RGBColor with valid inputs', () => {
      const input = { r: 255, g: 128, b: 64, a: 200 };
      const result = validateRGBColor(input);

      expect(result).toEqual({
        r: 255,
        g: 128,
        b: 64,
        a: 200,
      });
    });

    it('should clamp values above 255 to 255', () => {
      const input = { r: 300, g: 400, b: 500, a: 350 };
      const result = validateRGBColor(input);

      expect(result).toEqual({
        r: 255,
        g: 255,
        b: 255,
        a: 255,
      });
    });

    it('should clamp negative values to 0', () => {
      const input = { r: -10, g: -50, b: -100, a: -25 };
      const result = validateRGBColor(input);

      expect(result).toEqual({
        r: 0,
        g: 0,
        b: 0,
        a: 0,
      });
    });

    it('should handle partial RGBColor objects with missing properties', () => {
      const input = { r: 100, g: 150 };
      const result = validateRGBColor(input);

      expect(result).toEqual({
        r: 100,
        g: 150,
        b: 0,
        a: 255,
      });
    });

    it('should handle empty object with default values', () => {
      const input = {};
      const result = validateRGBColor(input);

      expect(result).toEqual({
        r: 0,
        g: 0,
        b: 0,
        a: 255,
      });
    });

    it('should handle undefined values with defaults', () => {
      const input = { r: undefined, g: undefined, b: undefined, a: undefined };
      const result = validateRGBColor(input);

      expect(result).toEqual({
        r: 0,
        g: 0,
        b: 0,
        a: 255,
      });
    });

    it('should handle NaN values with defaults', () => {
      const input = { r: NaN, g: NaN, b: NaN, a: NaN };
      const result = validateRGBColor(input);

      expect(result).toEqual({
        r: 0,
        g: 0,
        b: 0,
        a: 255,
      });
    });

    it('should floor decimal values', () => {
      const input = { r: 255.9, g: 128.7, b: 64.3, a: 200.1 };
      const result = validateRGBColor(input);

      expect(result).toEqual({
        r: 255,
        g: 128,
        b: 64,
        a: 200,
      });
    });

    it('should handle boundary values correctly', () => {
      const input = { r: 0, g: 255, b: 0, a: 255 };
      const result = validateRGBColor(input);

      expect(result).toEqual({
        r: 0,
        g: 255,
        b: 0,
        a: 255,
      });
    });
  });

  describe('createRGBColor', () => {
    it('should create RGBColor with provided values', () => {
      const result = createRGBColor(255, 128, 64, 200);

      expect(result).toEqual({
        r: 255,
        g: 128,
        b: 64,
        a: 200,
      });
    });

    it('should create RGBColor with default values when no arguments provided', () => {
      const result = createRGBColor();

      expect(result).toEqual({
        r: 0,
        g: 0,
        b: 0,
        a: 255,
      });
    });

    it('should create RGBColor with partial arguments using defaults', () => {
      const result = createRGBColor(100, 150);

      expect(result).toEqual({
        r: 100,
        g: 150,
        b: 0,
        a: 255,
      });
    });

    it('should clamp out-of-range values', () => {
      const result = createRGBColor(-10, 300, 128, 400);

      expect(result).toEqual({
        r: 0,
        g: 255,
        b: 128,
        a: 255,
      });
    });

    it('should handle decimal values by flooring them', () => {
      const result = createRGBColor(255.9, 128.7, 64.3, 200.1);

      expect(result).toEqual({
        r: 255,
        g: 128,
        b: 64,
        a: 200,
      });
    });

    it('should handle NaN values with defaults', () => {
      const result = createRGBColor(NaN, NaN, NaN, NaN);

      expect(result).toEqual({
        r: 0,
        g: 0,
        b: 0,
        a: 255,
      });
    });
  });

  describe('isValidRGBColor', () => {
    it('should return true for valid RGBColor objects', () => {
      const validColor: RGBColor = { r: 255, g: 128, b: 64, a: 200 };
      expect(isValidRGBColor(validColor)).toBe(true);
    });

    it('should return true for valid RGBColor with boundary values', () => {
      const validColor: RGBColor = { r: 0, g: 255, b: 0, a: 255 };
      expect(isValidRGBColor(validColor)).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidRGBColor(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isValidRGBColor(undefined)).toBe(false);
    });

    it('should return false for non-object values', () => {
      expect(isValidRGBColor(42)).toBe(false);
      expect(isValidRGBColor('string')).toBe(false);
      expect(isValidRGBColor(true)).toBe(false);
      expect(isValidRGBColor([])).toBe(false);
    });

    it('should return false for objects missing required properties', () => {
      expect(isValidRGBColor({ r: 255, g: 128, b: 64 })).toBe(false); // missing 'a'
      expect(isValidRGBColor({ r: 255, g: 128, a: 200 })).toBe(false); // missing 'b'
      expect(isValidRGBColor({ r: 255, b: 64, a: 200 })).toBe(false); // missing 'g'
      expect(isValidRGBColor({ g: 128, b: 64, a: 200 })).toBe(false); // missing 'r'
    });

    it('should return false for objects with non-number properties', () => {
      expect(isValidRGBColor({ r: '255', g: 128, b: 64, a: 200 })).toBe(false);
      expect(isValidRGBColor({ r: 255, g: '128', b: 64, a: 200 })).toBe(false);
      expect(isValidRGBColor({ r: 255, g: 128, b: '64', a: 200 })).toBe(false);
      expect(isValidRGBColor({ r: 255, g: 128, b: 64, a: '200' })).toBe(false);
    });

    it('should return false for objects with out-of-range values', () => {
      expect(isValidRGBColor({ r: -1, g: 128, b: 64, a: 200 })).toBe(false);
      expect(isValidRGBColor({ r: 255, g: 256, b: 64, a: 200 })).toBe(false);
      expect(isValidRGBColor({ r: 255, g: 128, b: -10, a: 200 })).toBe(false);
      expect(isValidRGBColor({ r: 255, g: 128, b: 64, a: 300 })).toBe(false);
    });

    it('should return false for objects with NaN values', () => {
      expect(isValidRGBColor({ r: NaN, g: 128, b: 64, a: 200 })).toBe(false);
      expect(isValidRGBColor({ r: 255, g: NaN, b: 64, a: 200 })).toBe(false);
      expect(isValidRGBColor({ r: 255, g: 128, b: NaN, a: 200 })).toBe(false);
      expect(isValidRGBColor({ r: 255, g: 128, b: 64, a: NaN })).toBe(false);
    });

    it('should return false for objects with additional properties but missing required ones', () => {
      expect(isValidRGBColor({ r: 255, g: 128, b: 64, extra: 'property' })).toBe(false);
    });

    it('should return true for objects with additional properties and all required ones', () => {
      expect(
        isValidRGBColor({
          r: 255,
          g: 128,
          b: 64,
          a: 200,
          extra: 'property',
        }),
      ).toBe(true);
    });

    it('should handle edge cases with decimal numbers', () => {
      // Valid decimals within range
      expect(isValidRGBColor({ r: 255.0, g: 128.0, b: 64.0, a: 200.0 })).toBe(true);

      // Valid decimals within range but non-integer
      expect(isValidRGBColor({ r: 254.9, g: 128.7, b: 64.3, a: 200.1 })).toBe(true);

      // Invalid decimals (out of range)
      expect(isValidRGBColor({ r: 255.1, g: 128, b: 64, a: 200 })).toBe(false);
    });

    it('should handle Infinity values', () => {
      expect(isValidRGBColor({ r: Infinity, g: 128, b: 64, a: 200 })).toBe(false);
      expect(isValidRGBColor({ r: -Infinity, g: 128, b: 64, a: 200 })).toBe(false);
    });
  });

  describe('Type integration tests', () => {
    it('should work together - validate then check validity', () => {
      const input = { r: 300, g: -50, b: 128.7 }; // Invalid/out-of-range input
      const validated = validateRGBColor(input);

      expect(isValidRGBColor(validated)).toBe(true);
      expect(validated).toEqual({
        r: 255,
        g: 0,
        b: 128,
        a: 255,
      });
    });

    it('should work together - create then check validity', () => {
      const created = createRGBColor(255, 128, 64, 200);

      expect(isValidRGBColor(created)).toBe(true);
      expect(created).toEqual({
        r: 255,
        g: 128,
        b: 64,
        a: 200,
      });
    });

    it('should handle the complete workflow from invalid to valid', () => {
      // Start with completely invalid input
      const invalidInput = { r: 'red', g: null, b: undefined, a: NaN };

      // Validate it (this will handle type coercion and defaults)
      const validated = validateRGBColor(invalidInput as any);

      // Should now be valid
      expect(isValidRGBColor(validated)).toBe(true);
      expect(validated).toEqual({
        r: 0,
        g: 0,
        b: 0,
        a: 255,
      });
    });
  });
});
