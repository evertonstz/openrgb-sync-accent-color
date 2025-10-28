# OpenRGB SDK Implementation (TypeScript / GNOME Shell)

This directory contains a modernized TypeScript implementation of the OpenRGB SDK protocol for GNOME Shell extensions. It provides a clean, type-safe, and modular interface to communicate with OpenRGB devices over the network.

## Overview

The OpenRGB SDK allows applications to communicate with OpenRGB instances running in server mode. This implementation provides all the necessary components to:

- Connect to OpenRGB servers with robust error handling
- Discover RGB devices with type safety
- Read device information and capabilities
- Control device colors and modes
- Handle protocol errors gracefully

## Architecture

Components:

```
src/openrgb/
├── types.ts     # Protocol types + helpers
├── errors.ts    # Error classes & utilities
├── enums.ts     # PacketType enum
├── constants.ts # Legacy numeric constants map
├── parser.ts    # Binary parsing logic
├── device.ts    # DeviceData representation + parsing
├── network.ts   # Low-level socket communication
├── client.ts    # High-level client (discovery, updates)
├── hash.ts      # stableId fingerprint + hashing
└── index.ts     # Barrel exports
```

## Core Components

### Types (`types.ts`)

Selected excerpt:

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

### Errors (`errors.ts`)

Domain errors:

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

### Packet Enum (`enums.ts`)

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

Alternative to enum for consumers needing object map.

```typescript
export const PacketType = {
  REQUEST_CONTROLLER_COUNT: 0,
  REQUEST_CONTROLLER_DATA: 1,
  RGBCONTROLLER_UPDATELEDS: 1050,
  RGBCONTROLLER_UPDATEMODE: 1054,
  SET_CLIENT_NAME: 50,
};
```

### Parser (`parser.ts`)

Incremental DataView-based parser with contextual error reporting.

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

Packet framing, async writes & incremental response assembly.

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

### High-Level Client (`client.ts`)

Produces augmented Device objects:

```typescript
export interface Device {
  ephemeralId: number;      // Volatile packet index
  stableId: string;         // Deterministic fingerprint hash (first 16 hex of SHA-256)
  name: string;
  ledCount: number;
  directModeIndex: number;  // Index of direct mode (0 if not found)
  data: DeviceData | null;  // Raw capabilities or null if failed
}
```

Primary methods:
```typescript
await client.connect();
await client.discoverDevices();        // populates internal array
client.getDevices();                   // snapshot copy
client.getDeviceCount();
await client.setDevicesColor(devices, color, setDirectModeOnUpdate?);
await client.setAllDevicesColor(color, setDirectModeOnUpdate?);
```

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

## Stable Device Identity

`stableId` is derived from a normalized fingerprint:

```
serial|location|name|leds:<count>
```

Normalization rules:
- Blank / all-zero serial → placeholder `serial:false`
- Blank location → `loc:false`
- Name lowercased and collapsed whitespace
- LED count appended as `leds:<n>`

SHA-256 of the fingerprint is computed (GLib in GNOME, Node crypto in tests); first 16 hex chars retained. Discovery failures inject placeholder devices with `stableId=failed-<index>`.

Benefits:
- Immune to enumeration order changes
- Differentiates similar hardware with distinct LED counts
- Compact & log-friendly

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

1. Connect TCP → register client name
2. Request controller count
3. For each index: request controller data → parse → compute `stableId` & detect direct mode
4. Optional: set direct mode during discovery (faster subsequent updates)
5. Update LEDs (`RGBCONTROLLER_UPDATELEDS`)

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
  OpenRGBConnectionError,
  formatErrorMessage,
} from './src/openrgb/index.js';

async function demo() {
  const client = new OpenRGBClient('127.0.0.1', 6742, 'MyApp');
  try {
    await client.connect();
    const devices = await client.discoverDevices();
    devices.forEach(d => console.log(`${d.name} stableId=${d.stableId} leds=${d.ledCount}`));

    const blue = createRGBColor(0, 0, 255);
    await client.setAllDevicesColor(blue, true); // ensure direct mode before update

    const active = devices.filter(d => d.ledCount > 0);
    const orange = createRGBColor(255, 128, 0);
    await client.setDevicesColor(active, orange);
  } catch (error) {
    if (error instanceof OpenRGBConnectionError) {
      console.error(`Connection failed to ${error.address}:${error.port}`);
    } else {
      console.error('Unexpected error:', formatErrorMessage(error));
    }
  } finally {
    client.disconnect();
  }
}

demo();
```

## Error Handling

Example pattern:

```typescript
try {
  await client.connect();
} catch (error) {
  if (error instanceof OpenRGBConnectionError) {
    console.error(`Connection failed to ${error.address}:${error.port}`);
  } else if (error instanceof OpenRGBProtocolError) {
    console.error(`Protocol error packetType=${error.packetType}`);
  } else if (error instanceof OpenRGBTimeoutError) {
    console.error(`Timeout after ${error.timeoutMs}ms`);
  } else if (error instanceof OpenRGBParseError) {
    console.error(`Parse error offset=${error.offset}: ${error.message}`);
  } else {
    console.error('Unexpected error:', formatErrorMessage(error));
  }
}
```

Key types:
- `OpenRGBConnectionError` (address, port)
- `OpenRGBProtocolError` (packetType)
- `OpenRGBParseError` (offset)
- `OpenRGBTimeoutError` (timeoutMs)
- `OpenRGBError` (base)

Utilities:
- `isOpenRGBError(error)`
- `formatErrorMessage(error)`

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
