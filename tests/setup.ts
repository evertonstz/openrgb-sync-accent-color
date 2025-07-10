import { vi } from 'vitest';

// Mock GJS modules that are not available in test environment
vi.mock('gi://Gio', () => ({
  default: {
    InetSocketAddress: {
      new_from_string: vi.fn().mockReturnValue({ 
        toString: () => 'mock-address' 
      })
    },
    SocketClient: vi.fn().mockImplementation(() => ({
      connect_async: vi.fn((address, cancellable, callback) => {
        // Simulate successful connection
        setTimeout(() => {
          callback(null, {
            connect_finish: () => ({
              close: vi.fn(),
              get_output_stream: vi.fn(),
              get_input_stream: vi.fn()
            })
          });
        }, 0);
      })
    }))
  }
}));

vi.mock('gi://GLib', () => ({
  default: {
    Bytes: {
      new: vi.fn()
    },
    MainLoop: {
      new: vi.fn()
    }
  }
}));

// Global test utilities
(globalThis as any).TextEncoder = TextEncoder;
(globalThis as any).TextDecoder = TextDecoder;
