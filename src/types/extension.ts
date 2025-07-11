/**
 * Extension Type Definitions
 *
 * This file contains TypeScript type definitions for the GNOME Shell extension,
 * providing type safety for all extension properties, methods, and interfaces.
 */

import type Gio from 'gi://Gio';
import type { OpenRGBClient } from '../openrgb/index.js';
import type { RGBColor } from '../openrgb/types.js';

/**
 * Predefined GNOME accent color names
 */
export type AccentColorName =
  | 'blue'
  | 'teal'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'pink'
  | 'purple'
  | 'slate'
  | 'default';

/**
 * Map of accent color names to their RGB values
 */
export type AccentColorMap = Record<AccentColorName, RGBColor>;

/**
 * Extension settings interface
 */
export interface ExtensionSettings {
  'openrgb-host': string;
  'openrgb-port': number;
  'sync-enabled': boolean;
  'sync-delay': number;
}

/**
 * Device sync result from OpenRGB operations
 */
export interface DeviceSyncResult {
  success: boolean;
  deviceName?: string;
  error?: string;
}

/**
 * Timer ID type for GLib timeouts
 */
export type TimerId = number;

/**
 * Signal connection ID type for GObject signals
 */
export type SignalId = number;

/**
 * Timeout callback function type
 */
export type TimeoutCallback = () => boolean;

/**
 * Main extension class interface
 */
export interface IOpenRGBAccentSyncExtension {
  // Core properties
  openrgbClient: OpenRGBClient | null;
  settings: Gio.Settings | null;
  lastKnownColor: RGBColor | null;

  // Signal management
  accentColorSignal: SignalId | null;
  accentColorSignal2: SignalId | null;

  // Timer management
  periodicCheckTimer: TimerId | null;
  reconnectionTimer: TimerId | null;
  syncTimeouts: Set<TimerId>;

  // Reconnection state
  reconnectionAttempts: number;
  maxReconnectionAttempts: number;
  reconnectionDelay: number;

  // Sync state
  syncInProgress: boolean;

  // Core methods
  enable(): void;
  disable(): void;

  // Timeout management
  addTimeout(callback: TimeoutCallback, delay: number): TimerId;
  clearAllTimeouts(): void;

  // OpenRGB connection management
  initializeOpenRGB(): Promise<void>;
  startReconnectionTimer(): void;
  ensureOpenRGBConnection(): Promise<boolean>;
  forceReconnection(): Promise<void>;

  // Color management
  syncCurrentAccentColor(): void;
  monitorAccentColor(): void;
  getAccentColor(settings: Gio.Settings): RGBColor | null;
  syncAccentColor(color: RGBColor): Promise<void>;
}

/**
 * Utility type guards for runtime type checking
 */
export namespace TypeGuards {
  /**
   * Type guard to check if a value is a valid accent color name
   */
  export function isAccentColorName(value: unknown): value is AccentColorName {
    return (
      typeof value === 'string' &&
      [
        'blue',
        'teal',
        'green',
        'yellow',
        'orange',
        'red',
        'pink',
        'purple',
        'slate',
        'default',
      ].includes(value)
    );
  }

  /**
   * Type guard to check if a value is a valid timer ID
   */
  export function isTimerId(value: unknown): value is TimerId {
    return typeof value === 'number' && value > 0;
  }

  /**
   * Type guard to check if a value is a valid signal ID
   */
  export function isSignalId(value: unknown): value is SignalId {
    return typeof value === 'number' && value > 0;
  }
}

/**
 * Constants for extension configuration
 */
export const ExtensionConstants = {
  // Default connection settings
  DEFAULT_HOST: '127.0.0.1',
  DEFAULT_PORT: 6742,
  DEFAULT_CLIENT_NAME: 'GNOME-OpenRGB-AccentSync',

  // Timer settings
  DEFAULT_SYNC_DELAY: 0,
  PERIODIC_CHECK_INTERVAL: 2000,
  DEFAULT_RECONNECTION_DELAY: 5000,
  MAX_RECONNECTION_DELAY: 30000,
  DEFAULT_MAX_RECONNECTION_ATTEMPTS: 10,

  // Timeout delays
  INITIAL_SYNC_DELAY: 1000,
  SIGNAL_SYNC_DELAY: 500,
  POST_SYNC_CLEANUP_DELAY: 1000,
  INITIAL_MONITOR_DELAY: 2000,

  // Schema IDs
  DESKTOP_INTERFACE_SCHEMA: 'org.gnome.desktop.interface',

  // Settings keys
  ACCENT_COLOR_KEY: 'accent-color',
} as const;

/**
 * Type-safe accent color mapping
 */
export const ACCENT_COLOR_MAP: AccentColorMap = {
  blue: { r: 53, g: 132, b: 228, a: 255 },
  teal: { r: 33, g: 144, b: 164, a: 255 },
  green: { r: 21, g: 160, b: 44, a: 255 },
  yellow: { r: 215, g: 145, b: 4, a: 255 },
  orange: { r: 237, g: 71, b: 0, a: 255 },
  red: { r: 243, g: 5, b: 17, a: 255 },
  pink: { r: 250, g: 42, b: 153, a: 255 },
  purple: { r: 167, g: 12, b: 250, a: 255 },
  slate: { r: 148, g: 201, b: 250, a: 255 },
  default: { r: 255, g: 255, b: 255, a: 255 },
} as const;
