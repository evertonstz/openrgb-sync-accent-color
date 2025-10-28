import { vi } from 'vitest';

// Mock GJS modules that are not available in test environment
vi.mock('gi://Gio', () => ({
  default: {
    InetSocketAddress: {
      new_from_string: vi.fn().mockReturnValue({
        toString: () => 'mock-address',
      }),
    },
    SocketClient: vi.fn().mockImplementation(() => ({
      connect_async: vi.fn((_address, _cancellable, callback) => {
        // Simulate successful connection
        setTimeout(() => {
          callback(null, {
            connect_finish: () => ({
              close: vi.fn(),
              get_output_stream: vi.fn(),
              get_input_stream: vi.fn(),
            }),
          });
        }, 0);
      }),
    })),
  },
}));

vi.mock('gi://GLib', () => ({
  default: (() => {
    // Deterministic fake SHA256 generator (non-crypto) good enough for tests
    function fakeSha256Hex(input: string): string {
      // FNV-1a 32-bit then expand to 64 hex chars deterministically
      let hash = 0x811c9dc5;
      for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = (hash * 0x01000193) >>> 0; // unsigned
      }
      const base = hash.toString(16).padStart(8, '0');
      // Mirror + repeat to reach 64 chars
      return (base + base.split('').reverse().join('') + base.repeat(2) + base.repeat(2)).slice(
        0,
        64,
      );
    }

    return {
      ChecksumType: { SHA256: 1 },
      compute_checksum_for_string: (_type: any, data: string, _len: number) => fakeSha256Hex(data),
    };
  })(),
}));

// Global test utilities
(globalThis as any).TextEncoder = TextEncoder;
(globalThis as any).TextDecoder = TextDecoder;
