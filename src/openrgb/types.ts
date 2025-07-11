/**
 * OpenRGB Protocol Types
 *
 * These interfaces represent the data structures defined by the OpenRGB protocol specification.
 * They are used across multiple modules for parsing binary data and representing device information.
 */

/**
 * RGBA color representation used throughout the OpenRGB protocol
 */
export interface RGBColor {
  /** Red component (0-255) */
  r: number;
  /** Green component (0-255) */
  g: number;
  /** Blue component (0-255) */
  b: number;
  /** Alpha component (0-255) */
  a: number;
}

/**
 * Represents an OpenRGB device mode with its configuration
 */
export interface DeviceMode {
  /** Human-readable name of the mode */
  name: string;
  /** Numeric identifier for the mode */
  value: number;
  /** Mode capability flags */
  flags: number;
  /** Minimum speed value for the mode */
  speedMin: number;
  /** Maximum speed value for the mode */
  speedMax: number;
  /** Minimum number of colors for the mode */
  colorsMin: number;
  /** Maximum number of colors for the mode */
  colorsMax: number;
  /** Current speed setting */
  speed: number;
  /** Direction setting for animated modes */
  direction: number;
  /** Color mode configuration */
  colorMode: number;
  /** Array of colors used by this mode */
  colors: RGBColor[];
}

/**
 * Represents a zone within an OpenRGB device
 */
export interface DeviceZone {
  /** Human-readable name of the zone */
  name: string;
  /** Zone type identifier */
  type: number;
  /** Minimum number of LEDs in this zone */
  ledsMin: number;
  /** Maximum number of LEDs in this zone */
  ledsMax: number;
  /** Current number of LEDs in this zone */
  ledsCount: number;
  /** Matrix height for matrix-type zones */
  matrixHeight?: number;
  /** Matrix width for matrix-type zones */
  matrixWidth?: number;
}

/**
 * Represents an individual LED within an OpenRGB device
 */
export interface DeviceLED {
  /** Human-readable name of the LED */
  name: string;
  /** Numeric identifier for the LED */
  value: number;
}

/**
 * Utility Functions for Type Safety
 */

/**
 * Validates and clamps RGB color values to valid range (0-255)
 */
export function validateRGBColor(color: Partial<RGBColor>): RGBColor {
  const clamp = (value: number | undefined, defaultValue: number = 0): number => {
    if (typeof value !== 'number' || Number.isNaN(value)) return defaultValue;
    return Math.max(0, Math.min(255, Math.floor(value)));
  };

  return {
    r: clamp(color.r),
    g: clamp(color.g),
    b: clamp(color.b),
    a: clamp(color.a, 255),
  };
}

/**
 * Creates a safe RGBColor from any input
 */
export function createRGBColor(
  r: number = 0,
  g: number = 0,
  b: number = 0,
  a: number = 255,
): RGBColor {
  return validateRGBColor({ r, g, b, a });
}

/**
 * Checks if an object is a valid RGBColor
 */
export function isValidRGBColor(obj: unknown): obj is RGBColor {
  if (typeof obj !== 'object' || obj === null) return false;

  const color = obj as Record<string, unknown>;
  const { r, g, b, a } = color;
  
  return (
    typeof r === 'number' &&
    r >= 0 &&
    r <= 255 &&
    typeof g === 'number' &&
    g >= 0 &&
    g <= 255 &&
    typeof b === 'number' &&
    b >= 0 &&
    b <= 255 &&
    typeof a === 'number' &&
    a >= 0 &&
    a <= 255
  );
}
