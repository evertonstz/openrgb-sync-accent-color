/**
 * OpenRGB Protocol Constants
 * 
 * These constants define various protocol-level values used throughout
 * the OpenRGB communication protocol.
 */

/** Default OpenRGB server connection settings */
export const DEFAULT_CONNECTION = {
  /** Default host address for OpenRGB server */
  HOST: '127.0.0.1',
  /** Default port for OpenRGB server */
  PORT: 6742,
  /** Default client name for GNOME extension */
  CLIENT_NAME: 'GNOME-OpenRGB-AccentSync',
} as const;

/** Protocol-level constants */
export const PROTOCOL = {
  /** Size of packet header in bytes */
  HEADER_SIZE: 16,
  /** Maximum packet size in bytes */
  MAX_PACKET_SIZE: 1024 * 1024, // 1MB
  /** Default timeout for network operations in milliseconds */
  DEFAULT_TIMEOUT: 10000,
  /** Size of each color in bytes (RGBA) */
  COLOR_SIZE: 4,
} as const;

/** Buffer size constants for network operations */
export const BUFFER_SIZES = {
  /** Default read buffer size */
  READ_BUFFER: 4096,
  /** Small buffer for headers */
  SMALL_BUFFER: 64,
  /** Large buffer for device data */
  LARGE_BUFFER: 16384,
} as const;

/** Validation constants */
export const VALIDATION = {
  /** Maximum reasonable number of devices */
  MAX_DEVICES: 256,
  /** Maximum reasonable number of LEDs per device */
  MAX_LEDS_PER_DEVICE: 10000,
  /** Maximum reasonable string length */
  MAX_STRING_LENGTH: 1024,
} as const;

/** Color value constraints */
export const COLOR_LIMITS = {
  /** Minimum color component value */
  MIN: 0,
  /** Maximum color component value */
  MAX: 255,
  /** Default alpha value */
  DEFAULT_ALPHA: 255,
} as const;
