// Main classes
export { type Device, OpenRGBClient } from './client.js';
export { DeviceData } from './device.js';
// Enums
export { PacketType } from './enums.js';
export {
  formatErrorMessage,
  isOpenRGBError,
  OpenRGBConnectionError,
  OpenRGBError,
  OpenRGBParseError,
  OpenRGBProtocolError,
  OpenRGBTimeoutError,
} from './errors.js';
export { NetworkClient } from './network.js';
export { BinaryParser } from './parser.js';
// Types and interfaces
export type { DeviceLED, DeviceMode, DeviceZone, RGBColor } from './types.js';
// Utilities
export { createRGBColor, isValidRGBColor, validateRGBColor } from './types.js';
