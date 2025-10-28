import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { NotificationUrgency, showExtensionNotification } from './src/notification.js';
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
  public lastAppliedDeviceColor: RGBColor | null = null;

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

  // Color change queue
  public colorChangeQueue: RGBColor[] = [];
  public isProcessingQueue: boolean = false;

  // Night light state
  public nightLightDBusProxy: Gio.DBusProxy | null = null;
  public isNightLightActive: boolean = false;

  public override enable(): void {
    console.log('OpenRGB Accent Sync: Extension enabled');

    this.settings = this.getSettings();

    // One-time wipe of ignored devices list if not migrated yet
    try {
      if (this.settings && !this.settings.get_boolean('ignored-devices-migrated')) {
        const existingIgnored = this.settings.get_strv('ignored-devices');
        if (existingIgnored.length > 0) {
          console.log(
            `OpenRGB Accent Sync: Performing one-time wipe of ${existingIgnored.length} ignored devices (unstable legacy IDs)`,
          );
          this.settings.set_strv('ignored-devices', []);
          showExtensionNotification('Ignored devices reset', {
            body: 'Legacy ignored devices were cleared due to a bug in the last version. Reconfigure ignored devices in preferences; this should not happen again.',
            persistent: true,
            urgency: NotificationUrgency.HIGH,
          });
        } else {
          console.log('OpenRGB Accent Sync: No legacy ignored devices present; wipe skipped');
        }
        this.settings.set_boolean('ignored-devices-migrated', true);
      }
    } catch (wipeError) {
      console.warn('OpenRGB Accent Sync: Wipe routine failed:', wipeError);
    }

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
    this.initializeNightLightMonitoring().catch((error) => {
      console.error('OpenRGB Accent Sync: Failed to initialize night light monitoring:', error);
    });
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

    if (this.nightLightSignal) {
      try {
        console.log(
          `OpenRGB Accent Sync: Disconnecting night light signal ID: ${this.nightLightSignal}`,
        );

        if (this.nightLightDBusProxy) {
          this.nightLightDBusProxy.disconnect(this.nightLightSignal);
          this.nightLightDBusProxy = null;
        }

        this.nightLightSignal = null;
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
    this.lastAppliedDeviceColor = null;
    this.colorChangeQueue = [];
    this.isProcessingQueue = false;

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
      showExtensionNotification('OpenRGB connection failed', {
        body: `Failed to connect to OpenRGB server after ${this.maxReconnectionAttempts} attempts. Please ensure OpenRGB is running with server mode enabled.`,
        persistent: true,
        urgency: NotificationUrgency.NORMAL,
      });

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

    this.colorChangeQueue.push(color);
    console.log(
      `OpenRGB Accent Sync: Added color to queue, queue length: ${this.colorChangeQueue.length}`,
    );

    if (!this.isProcessingQueue) {
      this.processColorQueue();
    }
  }

  private async processColorQueue(): Promise<void> {
    if (this.isProcessingQueue || this.colorChangeQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    console.log('OpenRGB Accent Sync: Starting queue processing');

    try {
      while (this.colorChangeQueue.length > 0) {
        const targetColor = this.colorChangeQueue.pop()!;
        this.colorChangeQueue = [];

        console.log(
          `OpenRGB Accent Sync: Processing color RGB(${targetColor.r}, ${targetColor.g}, ${targetColor.b})`,
        );

        await this.applyColorChange(targetColor);
      }
    } catch (error: unknown) {
      console.error('OpenRGB Accent Sync: Error processing color queue:', error);
    } finally {
      this.isProcessingQueue = false;
      console.log('OpenRGB Accent Sync: Queue processing completed');

      if (this.colorChangeQueue.length > 0) {
        console.log('OpenRGB Accent Sync: New colors added during processing, restarting queue');
        this.addTimeout(() => {
          this.processColorQueue();
          return GLib.SOURCE_REMOVE;
        }, 100);
      }
    }
  }

  private async applyColorChange(color: RGBColor): Promise<void> {
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

      console.log(`OpenRGB Accent Sync: Preparing device color update...`);
      if (!this.openrgbClient) {
        throw new Error('OpenRGB client not available');
      }

      const ignoredDeviceJsons = this.settings ? this.settings.get_strv('ignored-devices') : [];

      const ignoredStableIds = ignoredDeviceJsons
        .map((deviceJson) => {
          try {
            const device = JSON.parse(deviceJson);
            return device.stableId;
          } catch (error) {
            console.warn('Failed to parse ignored device JSON:', deviceJson, error);
            return null;
          }
        })
        .filter((id): id is string => !!id);

      const allDevices = this.openrgbClient.getDevices();

      const devicesToSync = allDevices.filter(
        (device) => !ignoredStableIds.includes(device.stableId),
      );

      console.log(
        `OpenRGB Accent Sync: Syncing ${devicesToSync.length} devices (${ignoredStableIds.length} ignored)`,
      );
      if (ignoredStableIds.length > 0) {
        console.log(
          `OpenRGB Accent Sync: Ignored device stable IDs: [${ignoredStableIds.join(', ')}]`,
        );
      }

      const setDirectModeOnUpdate = this.settings
        ? this.settings.get_boolean('set-direct-mode-on-update')
        : false;

      const smoothTransitionEnabled = (() => {
        if (!this.settings) return false;

        // Force disable smooth transitions when direct mode is enabled
        if (setDirectModeOnUpdate) {
          console.log('OpenRGB Accent Sync: Smooth transition disabled due to direct mode setting');
          return false;
        }

        try {
          // @ts-ignore access schema if exists
          const hasKey = (this.settings as any).settings_schema?.has_key?.(
            ExtensionConstants.SMOOTH_TRANSITION_KEY,
          );
          if (!hasKey) return false;
          return this.settings.get_boolean(ExtensionConstants.SMOOTH_TRANSITION_KEY);
        } catch {
          return false;
        }
      })();

      if (!smoothTransitionEnabled) {
        console.log(`OpenRGB Accent Sync: Smooth transition disabled, applying instantly`);
        const results = await this.openrgbClient.setDevicesColor(
          devicesToSync,
          color,
          setDirectModeOnUpdate,
        );
        this.lastAppliedDeviceColor = color;

        const successful = results.filter((r) => r.success).length;
        const total = results.length;
        console.log(
          `OpenRGB Accent Sync: Color sync complete (${successful}/${total} devices successful)`,
        );

        if (successful === 0 && total > 0) {
          console.error(
            'OpenRGB Accent Sync: All devices failed to sync, starting reconnection...',
          );
          this.startReconnectionTimer();
        }
      } else {
        // Smooth transition path
        const startColor = this.lastAppliedDeviceColor;
        if (!startColor) {
          // When no previous applied color exists, we need to apply the color immediately
          // Fall back to instant mode for the first application
          console.log(
            'OpenRGB Accent Sync: No previous applied color, applying instantly first time',
          );
          const results = await this.openrgbClient.setDevicesColor(
            devicesToSync,
            color,
            setDirectModeOnUpdate,
          );
          this.lastAppliedDeviceColor = color;

          const successful = results.filter((r) => r.success).length;
          const total = results.length;
          console.log(
            `OpenRGB Accent Sync: Initial color application complete (${successful}/${total} devices successful)`,
          );

          if (successful === 0 && total > 0) {
            console.error(
              'OpenRGB Accent Sync: All devices failed to sync, starting reconnection...',
            );
            this.startReconnectionTimer();
          }
          return;
        }
        const targetColor = color;

        const equalColors =
          startColor.r === targetColor.r &&
          startColor.g === targetColor.g &&
          startColor.b === targetColor.b;

        if (equalColors) {
          console.log('OpenRGB Accent Sync: Start and target colors are equal, no transition');
          return;
        }

        console.log(
          `OpenRGB Accent Sync: Smooth transition enabled, interpolating over ${ExtensionConstants.SMOOTH_TRANSITION_DURATION_MS}ms`,
        );

        const steps = Math.max(
          1,
          Math.floor(
            ExtensionConstants.SMOOTH_TRANSITION_DURATION_MS /
              ExtensionConstants.SMOOTH_TRANSITION_STEP_MS,
          ),
        );

        let lastResults: { success: boolean }[] = [];
        let firstStep = true;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const stepColor: RGBColor = {
            r: Math.round(startColor.r + (targetColor.r - startColor.r) * t),
            g: Math.round(startColor.g + (targetColor.g - startColor.g) * t),
            b: Math.round(startColor.b + (targetColor.b - startColor.b) * t),
            a: targetColor.a,
          };

          try {
            lastResults = await this.openrgbClient.setDevicesColor(
              devicesToSync,
              stepColor,
              firstStep && setDirectModeOnUpdate,
            );
            this.lastAppliedDeviceColor = stepColor;
          } catch (e) {
            console.warn('OpenRGB Accent Sync: Transition step failed:', e);
          }

          if (i < steps) {
            await new Promise<void>((resolve) =>
              this.addTimeout(() => {
                resolve();
                return GLib.SOURCE_REMOVE;
              }, ExtensionConstants.SMOOTH_TRANSITION_STEP_MS),
            );
          }
          firstStep = false;
        }

        const successful = lastResults.filter((r) => r.success).length;
        const total = lastResults.length;
        console.log(
          `OpenRGB Accent Sync: Smooth transition complete (${successful}/${total} devices successful on last step)`,
        );

        if (successful === 0 && total > 0) {
          console.error(
            'OpenRGB Accent Sync: All devices failed to sync on last step, starting reconnection...',
          );
          this.startReconnectionTimer();
        }
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
      this.syncInProgress = false;
    }
  }

  public async initializeNightLightMonitoring(): Promise<void> {
    try {
      console.log('OpenRGB Accent Sync: Initializing night light monitoring');

      this.nightLightDBusProxy = await new Promise<Gio.DBusProxy>((resolve, reject) => {
        Gio.DBusProxy.new_for_bus(
          Gio.BusType.SESSION,
          Gio.DBusProxyFlags.NONE,
          null,
          'org.gnome.SettingsDaemon.Color',
          '/org/gnome/SettingsDaemon/Color',
          'org.gnome.SettingsDaemon.Color',
          null,
          (_source, result) => {
            try {
              const proxy = Gio.DBusProxy.new_for_bus_finish(result);
              resolve(proxy);
            } catch (error) {
              reject(error);
            }
          },
        );
      });

      const nightLightActiveVariant =
        this.nightLightDBusProxy.get_cached_property('NightLightActive');
      this.isNightLightActive = nightLightActiveVariant
        ? nightLightActiveVariant.get_boolean()
        : false;
      console.log(
        `OpenRGB Accent Sync: Initial D-Bus night light active state: ${this.isNightLightActive}`,
      );

      this.nightLightSignal = this.nightLightDBusProxy.connect(
        'g-properties-changed',
        (_proxy, properties) => {
          const nightLightActiveChanged = properties.lookup_value('NightLightActive', null);
          if (nightLightActiveChanged) {
            const newState = nightLightActiveChanged.get_boolean();
            console.log(
              `OpenRGB Accent Sync: D-Bus Night Light active state changed: ${this.isNightLightActive} -> ${newState}`,
            );
            this.isNightLightActive = newState;
            this.handleNightLightStateChange();
          }
        },
      );

      console.log(
        `OpenRGB Accent Sync: D-Bus night light monitoring initialized with signal ID: ${this.nightLightSignal}`,
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
    } catch (error: unknown) {
      console.error(
        'OpenRGB Accent Sync: Failed to initialize night light monitoring:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  public checkInitialNightLightState(): void {
    if (!this.settings) {
      return;
    }

    const isNightLightFeatureEnabled = this.settings.get_boolean('night-light-disable-lights');
    if (!isNightLightFeatureEnabled) {
      console.log(
        'OpenRGB Accent Sync: Night light feature is disabled on startup, no action needed',
      );
      return;
    }

    console.log(
      `OpenRGB Accent Sync: Checking initial night light state - Feature enabled: ${isNightLightFeatureEnabled}, Night light active: ${this.isNightLightActive}`,
    );

    if (this.isNightLightActive) {
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
    if (!this.settings) {
      return;
    }

    const isNightLightFeatureEnabled = this.settings.get_boolean('night-light-disable-lights');

    console.log(
      `OpenRGB Accent Sync: Night light state checked - Feature enabled: ${isNightLightFeatureEnabled}, Night light active: ${this.isNightLightActive}`,
    );

    const needsColorUpdate =
      (isNightLightFeatureEnabled && // Feature is enabled, and either:
        (this.isNightLightActive || // Night Light is active (apply opacity), or
          !this.isNightLightActive)) || // Night Light was deactivated (restore normal colors), or
      !isNightLightFeatureEnabled; // Feature disabled (restore normal colors)

    if (needsColorUpdate) {
      if (!isNightLightFeatureEnabled) {
        console.log('OpenRGB Accent Sync: Night light feature disabled, restoring normal colors');
      } else if (this.isNightLightActive) {
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
    if (!this.settings) {
      console.log('OpenRGB Accent Sync: Night light opacity check - Settings not available');
      return null;
    }

    const isNightLightFeatureEnabled = this.settings.get_boolean('night-light-disable-lights');

    console.log(
      `OpenRGB Accent Sync: Night light opacity check - Feature enabled: ${isNightLightFeatureEnabled}, Night light active: ${this.isNightLightActive}`,
    );

    if (!isNightLightFeatureEnabled || !this.isNightLightActive) {
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
    if (!this.settings) {
      return false;
    }

    const isNightLightFeatureEnabled = this.settings.get_boolean('night-light-disable-lights');

    return isNightLightFeatureEnabled && this.isNightLightActive;
  }
}
