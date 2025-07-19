import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {
  formatErrorMessage,
  isOpenRGBError,
  OpenRGBConnectionError,
  OpenRGBTimeoutError,
} from './src/openrgb/errors.js';
import { OpenRGBClient } from './src/openrgb/index.js';
import type { RGBColor } from './src/openrgb/types.js';
import {
  ACCENT_COLOR_MAP,
  type AccentColorName,
  ExtensionConstants,
  type IOpenRGBAccentSyncExtension,
  type SignalId,
  type TimeoutCallback,
  type TimerId,
} from './src/types/extension.js';

export default class OpenRGBAccentSyncExtension
  extends Extension
  implements IOpenRGBAccentSyncExtension
{
  // Core properties
  public openrgbClient: OpenRGBClient | null = null;
  public settings: Gio.Settings | null = null;
  public lastKnownColor: RGBColor | null = null;

  // Signal management
  public accentColorSignal: SignalId | null = null;
  public accentColorSignal2: SignalId | null = null;
  public nightLightSignal: SignalId | null = null;

  // Timer management
  public periodicCheckTimer: TimerId | null = null;
  public reconnectionTimer: TimerId | null = null;
  public syncTimeouts: Set<TimerId> = new Set();

  // Reconnection state
  public reconnectionAttempts: number = 0;
  public readonly maxReconnectionAttempts: number =
    ExtensionConstants.DEFAULT_MAX_RECONNECTION_ATTEMPTS;
  public readonly reconnectionDelay: number = ExtensionConstants.DEFAULT_RECONNECTION_DELAY;

  // Sync state
  public syncInProgress: boolean = false;

  // Night light state
  public nightLightSettings: Gio.Settings | null = null;
  public isNightLightActive: boolean = false;

  public override enable(): void {
    console.log('OpenRGB Accent Sync: Extension enabled');

    this.settings = this.getSettings();

    console.log(
      `OpenRGB Accent Sync: Current night-light-disable-lights: ${this.settings.get_boolean('night-light-disable-lights')}`,
    );
    console.log(
      `OpenRGB Accent Sync: Current night-light-opacity: ${this.settings.get_double('night-light-opacity')}`,
    );

    const host = this.settings.get_string('openrgb-host') || ExtensionConstants.DEFAULT_HOST;
    const port = this.settings.get_int('openrgb-port') || ExtensionConstants.DEFAULT_PORT;

    this.openrgbClient = new OpenRGBClient(host, port, ExtensionConstants.DEFAULT_CLIENT_NAME);

    this.initializeOpenRGB();
    this.monitorAccentColor();
    this.initializeNightLightMonitoring();
  }

  public override disable(): void {
    console.log('OpenRGB Accent Sync: Extension disabled');

    this.clearAllTimeouts();

    if (this.periodicCheckTimer) {
      GLib.source_remove(this.periodicCheckTimer);
      this.periodicCheckTimer = null;
      console.log('OpenRGB Accent Sync: Periodic check timer stopped');
    }

    if (this.accentColorSignal || this.accentColorSignal2) {
      try {
        const desktopSettings = new Gio.Settings({
          schema_id: 'org.gnome.desktop.interface',
        });

        if (this.accentColorSignal) {
          console.log(`OpenRGB Accent Sync: Disconnecting signal ID: ${this.accentColorSignal}`);
          desktopSettings.disconnect(this.accentColorSignal);
          this.accentColorSignal = null;
        }

        if (this.accentColorSignal2) {
          console.log(`OpenRGB Accent Sync: Disconnecting signal ID: ${this.accentColorSignal2}`);
          desktopSettings.disconnect(this.accentColorSignal2);
          this.accentColorSignal2 = null;
        }

        console.log('OpenRGB Accent Sync: Signals disconnected successfully');
      } catch (error: unknown) {
        console.warn(
          'OpenRGB Accent Sync: Failed to disconnect accent color signals:',
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    if (this.nightLightSignal && this.nightLightSettings) {
      try {
        console.log(
          `OpenRGB Accent Sync: Disconnecting night light signal ID: ${this.nightLightSignal}`,
        );
        this.nightLightSettings.disconnect(this.nightLightSignal);
        this.nightLightSignal = null;
        this.nightLightSettings = null;
        console.log('OpenRGB Accent Sync: Night light signal disconnected successfully');
      } catch (error: unknown) {
        console.warn(
          'OpenRGB Accent Sync: Failed to disconnect night light signal:',
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    if (this.openrgbClient) {
      this.openrgbClient.disconnect();
      this.openrgbClient = null;
    }

    this.settings = null;
    this.lastKnownColor = null;

    if (this.reconnectionTimer) {
      GLib.source_remove(this.reconnectionTimer);
      this.reconnectionTimer = null;
      console.log('OpenRGB Accent Sync: Reconnection timer cleared');
    }

    this.reconnectionAttempts = 0;
  }

  public addTimeout(callback: TimeoutCallback, delay: number): TimerId {
    const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
      this.syncTimeouts.delete(timeoutId);
      return callback();
    });
    this.syncTimeouts.add(timeoutId);
    return timeoutId;
  }

  public clearAllTimeouts(): void {
    for (const timeoutId of this.syncTimeouts) {
      GLib.source_remove(timeoutId);
    }
    this.syncTimeouts.clear();
  }

  public async initializeOpenRGB(): Promise<void> {
    try {
      if (!this.openrgbClient) {
        throw new Error('OpenRGB client not initialized');
      }

      await this.openrgbClient.connect();
      await this.openrgbClient.discoverDevices();
      console.log('OpenRGB Accent Sync: OpenRGB initialized successfully');
      this.reconnectionAttempts = 0;

      if (this.reconnectionTimer) {
        GLib.source_remove(this.reconnectionTimer);
        this.reconnectionTimer = null;
      }

      this.syncCurrentAccentColor();
    } catch (error: unknown) {
      const errorMsg = formatErrorMessage(error);

      if (isOpenRGBError(error)) {
        console.error(`OpenRGB Accent Sync: ${errorMsg}`);
      } else {
        console.error('OpenRGB Accent Sync: Failed to initialize OpenRGB:', errorMsg);
      }

      this.startReconnectionTimer();
    }
  }

  public startReconnectionTimer(): void {
    if (this.reconnectionTimer) {
      return;
    }

    if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
      console.error('OpenRGB Accent Sync: Max reconnection attempts reached, giving up');
      try {
        Main.notify(
          'OpenRGB Accent Sync',
          `Failed to connect to OpenRGB server after ${this.maxReconnectionAttempts} attempts. Please check if OpenRGB is running with server mode enabled.`,
        );
      } catch (notificationError) {
        console.warn('OpenRGB Accent Sync: Failed to show notification:', notificationError);
      }

      return;
    }

    this.reconnectionAttempts++;
    const delay = Math.min(this.reconnectionDelay * this.reconnectionAttempts, 30000);

    console.log(
      `OpenRGB Accent Sync: Attempting reconnection in ${delay / 1000} seconds (attempt ${this.reconnectionAttempts}/${this.maxReconnectionAttempts})`,
    );

    this.reconnectionTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
      this.reconnectionTimer = null;
      this.initializeOpenRGB();
      return GLib.SOURCE_REMOVE;
    });
  }

  public async ensureOpenRGBConnection(): Promise<boolean> {
    if (!this.openrgbClient || !this.openrgbClient.connected) {
      console.log('OpenRGB Accent Sync: OpenRGB not connected, attempting to reconnect...');

      if (this.reconnectionTimer) {
        console.log('OpenRGB Accent Sync: Reconnection already in progress, skipping');
        return false;
      }

      await this.initializeOpenRGB();
      return this.openrgbClient?.connected ?? false;
    }
    return true;
  }

  public async forceReconnection(): Promise<void> {
    console.log('OpenRGB Accent Sync: Force reconnection requested');

    if (this.reconnectionTimer) {
      GLib.source_remove(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }

    this.reconnectionAttempts = 0;

    if (this.openrgbClient) {
      this.openrgbClient.disconnect();
    }

    await this.initializeOpenRGB();
  }

  public syncCurrentAccentColor(): void {
    try {
      console.log('OpenRGB Accent Sync: syncCurrentAccentColor called');

      const desktopSettings = new Gio.Settings({
        schema_id: ExtensionConstants.DESKTOP_INTERFACE_SCHEMA,
      });

      const currentColor = this.getAccentColor(desktopSettings);
      if (currentColor) {
        console.log(
          `OpenRGB Accent Sync: Syncing current accent color: RGB(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`,
        );

        this.addTimeout(() => {
          this.syncAccentColor(currentColor);
          return GLib.SOURCE_REMOVE;
        }, ExtensionConstants.INITIAL_SYNC_DELAY);
      } else {
        console.log('OpenRGB Accent Sync: No current accent color to sync');
      }
    } catch (error: unknown) {
      const errorMsg = formatErrorMessage(error);
      console.error('OpenRGB Accent Sync: Failed to sync current accent color:', errorMsg);
    }
  }

  public monitorAccentColor(): void {
    console.log('OpenRGB Accent Sync: Accent color monitoring started');

    try {
      const desktopSettings = new Gio.Settings({
        schema_id: 'org.gnome.desktop.interface',
      });

      const currentColor = this.getAccentColor(desktopSettings);
      if (currentColor) {
        console.log(
          `OpenRGB Accent Sync: Initial accent color: RGB(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`,
        );

        this.addTimeout(() => {
          this.syncAccentColor(currentColor);
          return GLib.SOURCE_REMOVE;
        }, 2000);
      }

      this.accentColorSignal = desktopSettings.connect('changed', (_settings, key) => {
        console.log(`OpenRGB Accent Sync: Interface setting changed: ${key}`);
        if (key === 'accent-color') {
          console.log('OpenRGB Accent Sync: *** ACCENT COLOR CHANGE SIGNAL FIRED ***');
          const newColor = this.getAccentColor(desktopSettings);
          if (newColor) {
            console.log(
              `OpenRGB Accent Sync: New accent color: RGB(${newColor.r}, ${newColor.g}, ${newColor.b})`,
            );

            this.addTimeout(() => {
              this.syncAccentColor(newColor);
              return GLib.SOURCE_REMOVE;
            }, 500);
          } else {
            console.log('OpenRGB Accent Sync: Failed to get new accent color');
          }
        }
      });

      this.accentColorSignal2 = desktopSettings.connect('changed::accent-color', () => {
        console.log('OpenRGB Accent Sync: *** SPECIFIC ACCENT COLOR SIGNAL FIRED ***');
        const newColor = this.getAccentColor(desktopSettings);
        if (newColor) {
          console.log(
            `OpenRGB Accent Sync: New accent color (specific): RGB(${newColor.r}, ${newColor.g}, ${newColor.b})`,
          );

          this.addTimeout(() => {
            this.syncAccentColor(newColor);
            return GLib.SOURCE_REMOVE;
          }, 500);
        } else {
          console.log('OpenRGB Accent Sync: Failed to get new accent color (specific)');
        }
      });

      console.log(
        `OpenRGB Accent Sync: Accent color signals connected with IDs: ${this.accentColorSignal} and ${this.accentColorSignal2}`,
      );

      this.lastKnownColor = currentColor;

      this.periodicCheckTimer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 2000, () => {
        try {
          const currentColor = this.getAccentColor(desktopSettings);
          if (currentColor && this.lastKnownColor) {
            if (
              currentColor.r !== this.lastKnownColor.r ||
              currentColor.g !== this.lastKnownColor.g ||
              currentColor.b !== this.lastKnownColor.b
            ) {
              console.log(`OpenRGB Accent Sync: *** PERIODIC CHECK DETECTED COLOR CHANGE ***`);
              console.log(
                `OpenRGB Accent Sync: From RGB(${this.lastKnownColor.r}, ${this.lastKnownColor.g}, ${this.lastKnownColor.b}) to RGB(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`,
              );

              this.lastKnownColor = currentColor;
              this.syncAccentColor(currentColor);
            }
          }
        } catch (error: unknown) {
          console.warn(
            'OpenRGB Accent Sync: Periodic check failed:',
            error instanceof Error ? error.message : String(error),
          );
        }
        return GLib.SOURCE_CONTINUE;
      });

      console.log('OpenRGB Accent Sync: Periodic check timer started');
    } catch (error: unknown) {
      console.error(
        'OpenRGB Accent Sync: Failed to monitor accent color:',
        error instanceof Error ? error.message : String(error),
      );
      this.syncAccentColor({ r: 255, g: 0, b: 0, a: 255 });
    }
  }

  public getAccentColor(settings: Gio.Settings): RGBColor | null {
    try {
      const accentColor = settings.get_string(ExtensionConstants.ACCENT_COLOR_KEY);

      return ACCENT_COLOR_MAP[accentColor as AccentColorName] ?? ACCENT_COLOR_MAP.default;
    } catch (error: unknown) {
      const errorMsg = formatErrorMessage(error);
      console.warn('OpenRGB Accent Sync: Failed to get accent color:', errorMsg);
      return null;
    }
  }

  public async syncAccentColor(color: RGBColor): Promise<void> {
    console.log(
      `OpenRGB Accent Sync: syncAccentColor called with RGB(${color.r}, ${color.g}, ${color.b})`,
    );

    if (this.syncInProgress) {
      console.log('OpenRGB Accent Sync: Sync already in progress, skipping duplicate call');
      return;
    }

    this.syncInProgress = true;

    try {
      this.lastKnownColor = color;

      if (!this.settings?.get_boolean('sync-enabled')) {
        console.log('OpenRGB Accent Sync: Sync is disabled, skipping color update');
        return;
      }

      const nightLightModifiedColor = this.applyNightLightOpacity(color);
      if (nightLightModifiedColor) {
        console.log(
          `OpenRGB Accent Sync: Night light is active, applying opacity modification: RGB(${nightLightModifiedColor.r}, ${nightLightModifiedColor.g}, ${nightLightModifiedColor.b})`,
        );
        color = nightLightModifiedColor;
      }

      const isConnected = await this.ensureOpenRGBConnection();
      if (!isConnected) {
        console.warn(
          'OpenRGB Accent Sync: Unable to establish OpenRGB connection, will retry when OpenRGB becomes available',
        );
        return;
      }

      console.log(`OpenRGB Accent Sync: Starting sync for RGB(${color.r}, ${color.g}, ${color.b})`);

      const syncDelay =
        this.settings?.get_int('sync-delay') ?? ExtensionConstants.DEFAULT_SYNC_DELAY;
      if (syncDelay > 0) {
        console.log(`OpenRGB Accent Sync: Waiting ${syncDelay}ms before sync`);
        await new Promise<void>((resolve) =>
          this.addTimeout(() => {
            resolve();
            return GLib.SOURCE_REMOVE;
          }, syncDelay),
        );
      }

      console.log(`OpenRGB Accent Sync: Calling setDevicesColor...`);
      if (!this.openrgbClient) {
        throw new Error('OpenRGB client not available');
      }

      const ignoredDeviceJsons = this.settings ? this.settings.get_strv('ignored-devices') : [];

      const ignoredDeviceIds = ignoredDeviceJsons
        .map((deviceJson) => {
          try {
            const device = JSON.parse(deviceJson);
            return device.id;
          } catch (error) {
            console.warn('Failed to parse ignored device JSON:', deviceJson, error);
            return -1; // Invalid ID that won't match any real device
          }
        })
        .filter((id) => id !== -1);

      const allDevices = this.openrgbClient.getDevices();

      const devicesToSync = allDevices.filter((device) => !ignoredDeviceIds.includes(device.id));

      console.log(
        `OpenRGB Accent Sync: Syncing ${devicesToSync.length} devices (${ignoredDeviceIds.length} ignored)`,
      );
      if (ignoredDeviceIds.length > 0) {
        console.log(`OpenRGB Accent Sync: Ignored device IDs: [${ignoredDeviceIds.join(', ')}]`);
      }

      const setDirectModeOnUpdate = this.settings
        ? this.settings.get_boolean('set-direct-mode-on-update')
        : false;

      const results = await this.openrgbClient.setDevicesColor(
        devicesToSync,
        color,
        setDirectModeOnUpdate,
      );

      const successful = results.filter((r) => r.success).length;
      const total = results.length;
      console.log(
        `OpenRGB Accent Sync: Color sync complete (${successful}/${total} devices successful)`,
      );

      if (successful === 0 && total > 0) {
        console.error('OpenRGB Accent Sync: All devices failed to sync, starting reconnection...');
        this.startReconnectionTimer();
      }
    } catch (error: unknown) {
      const errorMsg = formatErrorMessage(error);

      if (isOpenRGBError(error)) {
        console.error(`OpenRGB Accent Sync: Color sync failed - ${errorMsg}`);

        if (error instanceof OpenRGBConnectionError) {
          console.error(`OpenRGB Accent Sync: Connection error at ${error.address}:${error.port}`);
        } else if (error instanceof OpenRGBTimeoutError) {
          console.error(`OpenRGB Accent Sync: Operation timed out after ${error.timeoutMs}ms`);
        }
      } else {
        console.error('OpenRGB Accent Sync: Failed to sync color:', errorMsg);
        if (error instanceof Error && error.stack) {
          console.error('OpenRGB Accent Sync: Error stack:', error.stack);
        }
      }

      this.startReconnectionTimer();
    } finally {
      this.addTimeout(() => {
        this.syncInProgress = false;
        return GLib.SOURCE_REMOVE;
      }, 1000);
    }
  }

  public initializeNightLightMonitoring(): void {
    try {
      console.log('OpenRGB Accent Sync: Initializing night light monitoring');

      this.nightLightSettings = new Gio.Settings({
        schema_id: 'org.gnome.settings-daemon.plugins.color',
      });

      this.isNightLightActive = this.nightLightSettings.get_boolean('night-light-enabled');
      console.log(`OpenRGB Accent Sync: Initial night light state: ${this.isNightLightActive}`);

      this.nightLightSignal = this.nightLightSettings.connect(
        'changed::night-light-enabled',
        () => {
          this.handleNightLightStateChange();
        },
      );

      if (this.settings) {
        this.settings.connect('changed::night-light-disable-lights', () => {
          console.log('OpenRGB Accent Sync: Night light feature enabled/disabled');
          this.handleNightLightStateChange();
        });

        this.settings.connect('changed::night-light-opacity', () => {
          const opacity = this.settings?.get_double('night-light-opacity') ?? 0.0;
          console.log(`OpenRGB Accent Sync: Night light opacity changed to ${opacity}`);
          this.handleNightLightStateChange();
        });
      }

      // Check if we need to apply night light opacity on initial startup
      // This ensures the correct state is applied during login
      this.addTimeout(() => {
        this.checkInitialNightLightState();
        return GLib.SOURCE_REMOVE;
      }, 1000); // Small delay to ensure all systems are initialized

      console.log(
        `OpenRGB Accent Sync: Night light monitoring initialized with signal ID: ${this.nightLightSignal}`,
      );
    } catch (error: unknown) {
      console.error(
        'OpenRGB Accent Sync: Failed to initialize night light monitoring:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  public checkInitialNightLightState(): void {
    if (!this.nightLightSettings || !this.settings) {
      return;
    }

    const isNightLightFeatureEnabled = this.settings.get_boolean('night-light-disable-lights');
    if (!isNightLightFeatureEnabled) {
      console.log(
        'OpenRGB Accent Sync: Night light feature is disabled on startup, no action needed',
      );
      return;
    }

    const isNightLightActive = this.nightLightSettings.get_boolean('night-light-enabled');
    console.log(
      `OpenRGB Accent Sync: Checking initial night light state - Feature enabled: ${isNightLightFeatureEnabled}, Night light active: ${isNightLightActive}`,
    );

    if (isNightLightActive) {
      const opacity = this.settings.get_double('night-light-opacity');
      console.log(
        `OpenRGB Accent Sync: Night light is active on startup with opacity ${opacity}, applying to current colors`,
      );

      this.syncCurrentAccentColor();
    } else {
      console.log('OpenRGB Accent Sync: Night light is not active on startup, using normal colors');
    }
  }

  public handleNightLightStateChange(): void {
    if (!this.nightLightSettings || !this.settings) {
      return;
    }

    const isNightLightFeatureEnabled = this.settings.get_boolean('night-light-disable-lights');
    const isNightLightActive = this.nightLightSettings.get_boolean('night-light-enabled');

    console.log(
      `OpenRGB Accent Sync: Night light state checked - Feature enabled: ${isNightLightFeatureEnabled}, Night light active: ${isNightLightActive}`,
    );

    const previousState = this.isNightLightActive;
    this.isNightLightActive = isNightLightActive;

    const nightLightStateChanged = this.isNightLightActive !== previousState;
    const needsColorUpdate =
      nightLightStateChanged || // Night Light state changed
      (isNightLightFeatureEnabled && isNightLightActive) || // Feature enabled + Night Light active (includes opacity changes)
      !isNightLightFeatureEnabled; // Feature disabled (restore normal colors)

    if (needsColorUpdate) {
      if (!isNightLightFeatureEnabled) {
        console.log('OpenRGB Accent Sync: Night light feature disabled, restoring normal colors');
      } else if (isNightLightActive) {
        const opacity = this.settings.get_double('night-light-opacity');
        console.log(
          `OpenRGB Accent Sync: Night light is active with opacity ${opacity} (read from settings store), updating colors`,
        );
      } else {
        console.log('OpenRGB Accent Sync: Night light deactivated, restoring full accent color');
      }

      this.syncCurrentAccentColor();
    } else {
      console.log('OpenRGB Accent Sync: No color update needed');
    }
  }

  public applyNightLightOpacity(color: RGBColor): RGBColor | null {
    if (!this.settings || !this.nightLightSettings) {
      console.log('OpenRGB Accent Sync: Night light opacity check - Settings not available');
      return null;
    }

    const isNightLightFeatureEnabled = this.settings.get_boolean('night-light-disable-lights');
    const isNightLightActive = this.nightLightSettings.get_boolean('night-light-enabled');

    console.log(
      `OpenRGB Accent Sync: Night light opacity check - Feature enabled: ${isNightLightFeatureEnabled}, Night light active: ${isNightLightActive}`,
    );

    if (!isNightLightFeatureEnabled || !isNightLightActive) {
      return null; // No modification needed
    }

    const opacity = this.settings.get_double('night-light-opacity');
    console.log(`OpenRGB Accent Sync: Retrieved night light opacity from store: ${opacity}`);
    console.log(
      `OpenRGB Accent Sync: Applying night light opacity ${opacity} to color RGB(${color.r}, ${color.g}, ${color.b})`,
    );

    // Apply opacity to the color
    const modifiedColor = {
      r: Math.round(color.r * opacity),
      g: Math.round(color.g * opacity),
      b: Math.round(color.b * opacity),
      a: color.a,
    };

    console.log(
      `OpenRGB Accent Sync: Night light opacity result: RGB(${modifiedColor.r}, ${modifiedColor.g}, ${modifiedColor.b})`,
    );
    return modifiedColor;
  }

  public shouldApplyNightLightOverride(): boolean {
    if (!this.settings || !this.nightLightSettings) {
      return false;
    }

    const isNightLightFeatureEnabled = this.settings.get_boolean('night-light-disable-lights');
    const isNightLightActive = this.nightLightSettings.get_boolean('night-light-enabled');

    return isNightLightFeatureEnabled && isNightLightActive;
  }
}
