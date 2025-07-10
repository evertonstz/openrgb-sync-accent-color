# OpenRGB SDK Implementation

This directory contains a TypeScript/JavaScript implementation of the OpenRGB SDK protocol for GNOME Shell extensions. It provides a clean, modular interface to communicate with OpenRGB devices over the network.

## Overview

The OpenRGB SDK allows applications to communicate with OpenRGB instances running in server mode. This implementation provides all the necessary components to:

- Connect to OpenRGB servers
- Discover RGB devices
- Read device information and capabilities
- Control device colors and modes

## Architecture

The SDK is organized into several modular components:

```
src/openrgb/
├── constants.ts    # Protocol constants and packet types
├── parser.ts       # Binary data parsing utilities
├── device.ts       # Device data structures and parsing
├── network.ts      # Low-level network communication
├── client.ts       # High-level client interface
└── index.ts        # Main exports
```

## Core Components

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

Provides utilities for parsing binary protocol data with proper endianness handling:

```typescript
export class BinaryParser {
  readUint32(): number      // Read 32-bit unsigned integer (little endian)
  readUint16(): number      // Read 16-bit unsigned integer (little endian)
  readString(): string      // Read length-prefixed string
  readRGBColor(): object    // Read RGBA color data
  skip(bytes: number): void // Skip bytes in the buffer
  hasMoreData(): boolean    // Check if more data is available
}
```

### Device Data (`device.ts`)

Handles device information parsing and representation:

```typescript
export class DeviceData {
  name: string          // Device name
  description: string   // Device description
  version: string       // Device version
  serial: string        // Device serial number
  location: string      // Device location
  modes: Mode[]         // Available device modes
  zones: Zone[]         // Device zones
  leds: LED[]          // Individual LEDs
  colors: Color[]      // Current colors
  
  static parse(data: ArrayBuffer): DeviceData
}
```

### Network Client (`network.ts`)

Low-level network communication with OpenRGB server:

```typescript
export class NetworkClient {
  constructor(address: string, port: number, name: string)
  
  async connect(): Promise<void>
  disconnect(): void
  async sendRequest(deviceId: number, packetType: number, data?: ArrayBuffer): Promise<ArrayBuffer>
  async setClientName(): Promise<void>
  async getControllerCount(): Promise<number>
  async getControllerData(deviceId: number): Promise<ArrayBuffer>
  async updateLEDs(deviceId: number, colors: Color[]): Promise<void>
}
```

### OpenRGB Client (`client.ts`)

High-level interface for OpenRGB operations:

```typescript
export class OpenRGBClient {
  constructor(address: string, port: number, name: string, settings?: object)
  
  async connect(): Promise<void>
  disconnect(): void
  async discoverDevices(): Promise<void>
  async setDeviceColor(deviceId: number, color: Color): Promise<object>
  async setAllDevicesColor(color: Color): Promise<object[]>
  getDevices(): DeviceData[]
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

#### Color
```typescript
interface Color {
  r: number  // Red (0-255)
  g: number  // Green (0-255) 
  b: number  // Blue (0-255)
  a?: number // Alpha (0-255, optional)
}
```

#### Mode
```typescript
interface Mode {
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
  colors: Color[]
}
```

#### Zone
```typescript
interface Zone {
  name: string
  type: number
  ledsMin: number
  ledsMax: number
  ledsCount: number
  matrixMap: number[]
}
```

#### LED
```typescript
interface LED {
  name: string
  value: number
}
```

## Usage Example

```typescript
import { OpenRGBClient } from './src/openrgb/index.js';

// Create client instance
const client = new OpenRGBClient('127.0.0.1', 6742, 'MyApp');

// Connect and discover devices
await client.connect();
await client.discoverDevices();

// Set all devices to red
const red = { r: 255, g: 0, b: 0 };
await client.setAllDevicesColor(red);

// Set specific device color
await client.setDeviceColor(0, { r: 0, g: 255, b: 0 });

// Cleanup
client.disconnect();
```

## Error Handling

The SDK includes comprehensive error handling:

- **Connection errors**: Network connection failures
- **Protocol errors**: Invalid packet format or responses
- **Device errors**: Device-specific operation failures
- **Timeout errors**: Operations that exceed time limits

All methods that can fail throw descriptive Error objects with meaningful messages.

## Dependencies

- **GJS/GNOME**: Uses `Gio` for network operations and `GLib` for utilities
- **TypeScript**: Written in TypeScript for better type safety and development experience
- **No external libraries**: Pure implementation using only GNOME platform APIs

## Thread Safety

The implementation is designed for single-threaded use within GNOME Shell extensions. Network operations are asynchronous but should be called sequentially to avoid race conditions.

## Performance Considerations

- **Connection pooling**: Reuses single connection for multiple operations
- **Efficient parsing**: Minimal allocations during binary data parsing
- **Timeout management**: Prevents hanging operations with configurable timeouts
- **Memory management**: Proper cleanup of resources and event handlers

## Compatibility

- **OpenRGB Version**: Compatible with OpenRGB 0.5+ server protocol
- **GNOME Shell**: Requires GNOME Shell 45+ with GJS support
- **Platforms**: Linux systems with GNOME desktop environment

## Development

When extending this SDK:

1. **Add packet types** in `constants.ts`
2. **Extend parser** in `parser.ts` for new data formats
3. **Add device capabilities** in `device.ts` 
4. **Implement network operations** in `network.ts`
5. **Expose high-level APIs** in `client.ts`

## License

This implementation follows the same GPL-3.0 license as the main extension.
