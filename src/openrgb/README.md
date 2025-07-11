# OpenRGB SDK Implementation

This directory contains a modernized TypeScript implementation of the OpenRGB SDK protocol for GNOME Shell extensions. It provides a clean, type-safe, and modular interface to communicate with OpenRGB devices over the network.

## Overview

The OpenRGB SDK allows applications to communicate with OpenRGB instances running in server mode. This implementation provides all the necessary components to:

- Connect to OpenRGB servers with robust error handling
- Discover RGB devices with type safety
- Read device information and capabilities
- Control device colors and modes
- Handle protocol errors gracefully

## Architecture

The SDK is organized into several modular components with clear separation of concerns:

```
src/openrgb/
├── types.ts        # Core protocol types and validation utilities
├── errors.ts       # Custom error classes and error handling
├── enums.ts        # Protocol enums (packet types, etc.)
├── constants.ts    # Protocol constants and configuration
├── parser.ts       # Binary data parsing utilities
├── device.ts       # Device data structures and parsing
├── network.ts      # Low-level network communication
├── client.ts       # High-level client interface
└── index.ts        # Centralized exports
```

## Core Components

### Protocol Types (`types.ts`)

Centralized type definitions and validation utilities for the OpenRGB protocol:

```typescript
export interface RGBColor {
  r: number;  // Red component (0-255)
  g: number;  // Green component (0-255)
  b: number;  // Blue component (0-255)
  a: number;  // Alpha component (0-255)
}

export interface DeviceMode {
  name: string;
  value: number;
  flags: number;
  // ... additional mode properties
}

// Validation utilities
export function isValidRGBColor(obj: unknown): obj is RGBColor;
export function validateRGBColor(color: RGBColor): void;
export function createRGBColor(r: number, g: number, b: number, a?: number): RGBColor;
```

### Error Handling (`errors.ts`)

Custom error classes for comprehensive error handling:

```typescript
export class OpenRGBError extends Error;
export class OpenRGBConnectionError extends OpenRGBError;
export class OpenRGBProtocolError extends OpenRGBError;
export class OpenRGBParseError extends OpenRGBError;
export class OpenRGBTimeoutError extends OpenRGBError;

// Utility functions
export function isOpenRGBError(error: unknown): error is OpenRGBError;
export function formatErrorMessage(error: unknown): string;
```

### Protocol Enums (`enums.ts`)

Type-safe enums for protocol constants:

```typescript
export enum PacketType {
  REQUEST_CONTROLLER_COUNT = 0,
  REQUEST_CONTROLLER_DATA = 1,
  RGBCONTROLLER_UPDATELEDS = 1050,
  RGBCONTROLLER_UPDATEMODE = 1054,
  SET_CLIENT_NAME = 50,
}
```

### Constants (`constants.ts`)

Defines the OpenRGB protocol packet types:

```typescript
export const PacketType = {
  REQUEST_CONTROLLER_COUNT: 0,
  REQUEST_CONTROLLER_DATA: 1,
  RGBCONTROLLER_UPDATELEDS: 1050,
  RGBCONTROLLER_UPDATEMODE: 1054,
  SET_CLIENT_NAME: 50,
};
```

### Binary Parser (`parser.ts`)

Provides utilities for parsing binary protocol data with proper endianness handling and error recovery:

```typescript
export class BinaryParser {
  readUint32(): number      // Read 32-bit unsigned integer (little endian)
  readUint16(): number      // Read 16-bit unsigned integer (little endian)
  readString(): string      // Read length-prefixed string
  readRGBColor(): RGBColor  // Read RGBA color data
  skip(bytes: number): void // Skip bytes in the buffer
  hasMoreData(): boolean    // Check if more data is available
  
  // Enhanced error handling with context
  private validateRead(bytes: number): void
  private getContext(errorOffset: number): string
}
```

### Device Data (`device.ts`)

Handles device information parsing and representation with type safety:

```typescript
export class DeviceData {
  name: string              // Device name
  description: string       // Device description
  version: string          // Device version
  serial: string           // Device serial number
  location: string         // Device location
  modes: DeviceMode[]      // Available device modes
  zones: DeviceZone[]      // Device zones
  leds: DeviceLED[]        // Individual LEDs
  colors: RGBColor[]       // Current colors
  directModeIndex?: number // Index of direct control mode
  
  static parse(data: ArrayBuffer): DeviceData
}
```

### Network Client (`network.ts`)

Low-level network communication with OpenRGB server, featuring robust error handling:

```typescript
export class NetworkClient {
  constructor(address: string, port: number, name: string)
  
  async connect(): Promise<void>
  disconnect(): void
  async sendRequest(deviceId: number, packetType: number, data?: ArrayBuffer): Promise<ArrayBuffer>
  async setClientName(): Promise<void>
  async getControllerCount(): Promise<number>
  async getControllerData(deviceId: number): Promise<ArrayBuffer>
  async updateLEDs(deviceId: number, colors: RGBColor[]): Promise<void>
  
  // Enhanced connection state management
  get connected(): boolean
  private validateConnection(): void
}
```

### OpenRGB Client (`client.ts`)

High-level interface for OpenRGB operations with comprehensive error handling:

```typescript
export class OpenRGBClient {
  constructor(address: string, port: number, name: string, settings?: object)
  
  async connect(): Promise<void>
  disconnect(): void
  async discoverDevices(): Promise<DeviceData[]>
  async setDeviceColor(deviceId: number, color: RGBColor): Promise<object>
  async setAllDevicesColor(color: RGBColor): Promise<object[]>
  getDevices(): DeviceData[]
  
  // Enhanced state management
  get connected(): boolean
  get devices(): DeviceData[]
  private validateConnection(): void
}
```

## Protocol Details

### Packet Structure

The OpenRGB protocol uses a binary packet format:

```
Header (16 bytes):
- Magic: "ORGB" (4 bytes)
- Device ID: uint32 (4 bytes)
- Command ID: uint32 (4 bytes) 
- Data Length: uint32 (4 bytes)

Data: Variable length based on command
```

### Command Flow

1. **Connection**: TCP connection to OpenRGB server (default: 127.0.0.1:6742)
2. **Client Name**: Send `SET_CLIENT_NAME` with application identifier
3. **Device Discovery**: 
   - Send `REQUEST_CONTROLLER_COUNT` to get device count
   - Send `REQUEST_CONTROLLER_DATA` for each device to get capabilities
4. **Device Control**:
   - Send `RGBCONTROLLER_UPDATELEDS` to update device colors
   - Send `RGBCONTROLLER_UPDATEMODE` to change device modes

### Data Types

#### RGBColor
```typescript
interface RGBColor {
  r: number  // Red (0-255)
  g: number  // Green (0-255) 
  b: number  // Blue (0-255)
  a: number  // Alpha (0-255)
}
```

#### DeviceMode
```typescript
interface DeviceMode {
  name: string
  value: number
  flags: number
  speedMin: number
  speedMax: number
  colorMin: number
  colorMax: number
  speed: number
  direction: number
  colorMode: number
  colors: RGBColor[]
}
```

#### DeviceZone
```typescript
interface DeviceZone {
  name: string
  type: number
  ledsMin: number
  ledsMax: number
  ledsCount: number
  matrixMap: number[]
}
```

#### DeviceLED
```typescript
interface DeviceLED {
  name: string
  value: number
}
```

## Usage Example

```typescript
import { 
  OpenRGBClient, 
  createRGBColor, 
  OpenRGBConnectionError 
} from './src/openrgb/index.js';

try {
  // Create client instance
  const client = new OpenRGBClient('127.0.0.1', 6742, 'MyApp');

  // Connect and discover devices
  await client.connect();
  const devices = await client.discoverDevices();
  
  console.log(`Found ${devices.length} devices`);

  // Set all devices to red using type-safe color creation
  const red = createRGBColor(255, 0, 0);
  await client.setAllDevicesColor(red);

  // Set specific device color
  await client.setDeviceColor(0, createRGBColor(0, 255, 0));

  // Cleanup
  client.disconnect();
} catch (error) {
  if (error instanceof OpenRGBConnectionError) {
    console.error('Connection failed:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Error Handling

The modernized SDK includes comprehensive error handling with specific error types:

```typescript
try {
  await client.connect();
} catch (error) {
  if (error instanceof OpenRGBConnectionError) {
    console.error(`Connection failed to ${error.address}:${error.port}`);
  } else if (error instanceof OpenRGBProtocolError) {
    console.error(`Protocol error with packet type ${error.packetType}`);
  } else if (error instanceof OpenRGBTimeoutError) {
    console.error(`Operation timed out after ${error.timeout}ms`);
  } else if (error instanceof OpenRGBParseError) {
    console.error(`Parse error at offset ${error.offset}: ${error.message}`);
  } else {
    console.error('Unexpected error:', formatErrorMessage(error));
  }
}
```

**Error Types:**
- **OpenRGBConnectionError**: Network connection failures with address/port context
- **OpenRGBProtocolError**: Invalid packet format or responses with packet type info
- **OpenRGBParseError**: Binary data parsing failures with offset information
- **OpenRGBTimeoutError**: Operations that exceed time limits
- **OpenRGBError**: Base class for all OpenRGB-specific errors

**Error Utilities:**
- `isOpenRGBError(error)`: Type guard to check if error is OpenRGB-related
- `formatErrorMessage(error)`: Safe error message formatting for unknown errors

## Dependencies

- **GJS/GNOME**: Uses `Gio` for network operations and `GLib` for utilities
- **TypeScript**: Written in modern TypeScript with strict type safety enabled
- **No external libraries**: Pure implementation using only GNOME platform APIs

## Thread Safety

The implementation is designed for single-threaded use within GNOME Shell extensions. Network operations are asynchronous but should be called sequentially to avoid race conditions.

## Performance Considerations

- **Connection pooling**: Reuses single connection for multiple operations
- **Efficient parsing**: Minimal allocations during binary data parsing with proper error recovery
- **Timeout management**: Prevents hanging operations with configurable timeouts
- **Memory management**: Proper cleanup of resources and event handlers
- **Type-safe operations**: Compile-time checking reduces runtime overhead

## Compatibility

- **OpenRGB Version**: Compatible with OpenRGB 0.5+ server protocol
- **GNOME Shell**: Requires GNOME Shell 45+ with GJS support
- **Platforms**: Linux systems with GNOME desktop environment

## License

This implementation follows the same GPL-3.0 license as the main extension.
