# OpenRGB Tests

This directory contains comprehensive unit tests for the OpenRGB TypeScript implementation, inspired by the test patterns from [OpenRGB.NET](https://github.com/diogotr7/OpenRGB.NET/tree/master/src/OpenRGB.NET.Tests).

## Test Structure

The test structure mirrors the source code structure:

```
tests/
├── openrgb/                    # Tests for src/openrgb/ modules
│   ├── constants.test.ts       # Tests for constants.ts
│   ├── parser.test.ts          # Tests for parser.ts  
│   ├── device.test.ts          # Tests for device.ts
│   ├── client.test.ts          # Tests for client.ts
│   ├── network.test.ts         # Tests for network.ts (mocked)
│   └── index.test.ts           # Tests for index.ts
├── integration.test.ts         # Integration tests across modules
├── setup.ts                    # Test setup and mocks
└── README.md                   # This file
```

### Test Files

- **`openrgb/constants.test.ts`** - Tests for packet type constants and enums
- **`openrgb/parser.test.ts`** - Tests for binary data parsing functionality  
- **`openrgb/device.test.ts`** - Tests for device data structures and parsing
- **`openrgb/client.test.ts`** - Tests for OpenRGB client functionality (with mocked network)
- **`openrgb/network.test.ts`** - Tests for network client patterns and error handling
- **`openrgb/index.test.ts`** - Tests for module exports and re-exports
- **`integration.test.ts`** - Integration tests for module interactions
- **`setup.ts`** - Test setup and mocking configuration

### Test Coverage

The tests cover:

#### Constants Module
- Packet type value validation
- Enum consistency and uniqueness
- Type safety and immutability

#### Binary Parser
- Data type reading (Uint32, Uint16, strings, RGB colors)
- Buffer boundary validation
- Error handling for malformed data
- Sequential reading operations
- Memory management

#### Device Data
- Device information parsing
- Mode, zone, LED, and color data structures
- Error recovery for malformed device data
- Data type validation

#### OpenRGB Client
- Connection management
- Device discovery workflow
- Error handling and state management
- Network client integration

#### Network Client
- Connection patterns and error handling
- Message formatting and validation
- Async operation patterns
- State management

#### Integration
- Module dependency validation
- Cross-module type consistency
- Performance considerations
- Memory management

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test

# Run tests once with coverage
npm run test:run
```

## Test Framework

Using **Vitest** for:
- Fast TypeScript execution
- Built-in mocking capabilities
- Coverage reporting
- Watch mode for development

## Mocking Strategy

Since the OpenRGB implementation depends on GJS/GTK (GNOME JavaScript bindings), the tests use comprehensive mocking:

- **GIO/GLib modules** - Mocked for network operations
- **Network operations** - Mocked to simulate OpenRGB server responses
- **Binary data** - Real ArrayBuffer/DataView operations for accurate testing

## Test Patterns

Following patterns from OpenRGB.NET tests:

1. **Property validation** - Ensuring data structures have correct types and ranges
2. **Error handling** - Testing graceful degradation with malformed data
3. **Binary protocol** - Validating packet parsing and generation
4. **State management** - Testing connection and device state consistency
5. **Performance** - Ensuring efficient memory usage and operation speed

## Key Test Scenarios

### Binary Parser Tests
- Reading different data types from buffers
- Handling buffer overflow conditions
- String encoding/decoding validation
- Color format consistency

### Device Parsing Tests  
- Minimal valid device data
- Complex device configurations
- Error recovery scenarios
- Data structure validation

### Client Integration Tests
- Connection lifecycle management
- Device discovery workflow
- Error propagation and handling
- Mock network integration

### Performance Tests
- Large buffer handling
- Multiple instance creation
- Memory leak prevention
- Operation timing validation

## Future Enhancements

Potential areas for test expansion:

1. **Property-based testing** - Using random data generation for edge cases
2. **Snapshot testing** - For device data structure regression testing  
3. **End-to-end testing** - With real OpenRGB server (optional)
4. **Benchmark testing** - Performance regression detection
5. **Fuzz testing** - Random binary data parsing validation

## Contributing

When adding new features:

1. Add corresponding tests following existing patterns
2. Ensure error handling is tested
3. Validate type safety and data consistency
4. Add performance considerations for large data
5. Update this README with new test categories
