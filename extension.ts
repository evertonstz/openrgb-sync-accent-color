// @ts-nocheck

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { OpenRGBClient } from './src/openrgb/index.js';

export default class OpenRGBAccentSyncExtension extends Extension {
  constructor(metadata) {
    super(metadata);
    this.openrgbClient = null;
    this.accentColorSignal = null;
    this.accentColorSignal2 = null;
    this.settings = null;
    this.periodicCheckTimer = null;
    this.lastKnownColor = null;
    this.reconnectionTimer = null;
    this.reconnectionAttempts = 0;
    this.maxReconnectionAttempts = 10;
    this.reconnectionDelay = 5000;
    this.syncInProgress = false;
    this.syncTimeouts = new Set();
  }

  enable() {
    console.log('OpenRGB Accent Sync: Extension enabled');

    this.settings = this.getSettings();

    const host = this.settings.get_string('openrgb-host') || '127.0.0.1';
    const port = this.settings.get_int('openrgb-port') || 6742;

    this.openrgbClient = new OpenRGBClient(host, port, 'GNOME-OpenRGB-AccentSync', this.settings);

    this.initializeOpenRGB();

    this.monitorAccentColor();
  }

  disable() {
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
      } catch (error) {
        console.warn(
          'OpenRGB Accent Sync: Failed to disconnect accent color signals:',
          error.message,
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

  addTimeout(callback, delay) {
    const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
      this.syncTimeouts.delete(timeoutId);
      return callback();
    });
    this.syncTimeouts.add(timeoutId);
    return timeoutId;
  }

  clearAllTimeouts() {
    for (const timeoutId of this.syncTimeouts) {
      GLib.source_remove(timeoutId);
    }
    this.syncTimeouts.clear();
  }

  async initializeOpenRGB() {
    try {
      await this.openrgbClient.connect();
      await this.openrgbClient.discoverDevices();
      console.log('OpenRGB Accent Sync: OpenRGB initialized successfully');
      this.reconnectionAttempts = 0;

      if (this.reconnectionTimer) {
        GLib.source_remove(this.reconnectionTimer);
        this.reconnectionTimer = null;
      }

      this.syncCurrentAccentColor();
    } catch (error) {
      console.error('OpenRGB Accent Sync: Failed to initialize OpenRGB:', error.message);
      this.startReconnectionTimer();
    }
  }

  startReconnectionTimer() {
    if (this.reconnectionTimer) {
      return;
    }

    if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
      console.error('OpenRGB Accent Sync: Max reconnection attempts reached, giving up');
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

  async ensureOpenRGBConnection() {
    if (!this.openrgbClient || !this.openrgbClient.connected) {
      console.log('OpenRGB Accent Sync: OpenRGB not connected, attempting to reconnect...');

      if (this.reconnectionTimer) {
        console.log('OpenRGB Accent Sync: Reconnection already in progress, skipping');
        return false;
      }

      await this.initializeOpenRGB();
      return this.openrgbClient?.connected;
    }
    return true;
  }

  async forceReconnection() {
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

  syncCurrentAccentColor() {
    try {
      const desktopSettings = new Gio.Settings({
        schema_id: 'org.gnome.desktop.interface',
      });

      const currentColor = this.getAccentColor(desktopSettings);
      if (currentColor) {
        console.log(
          `OpenRGB Accent Sync: Syncing current accent color after connection: RGB(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`,
        );

        this.addTimeout(() => {
          this.syncAccentColor(currentColor);
          return GLib.SOURCE_REMOVE;
        }, 1000);
      } else {
        console.log('OpenRGB Accent Sync: No current accent color to sync');
      }
    } catch (error) {
      console.error('OpenRGB Accent Sync: Failed to sync current accent color:', error.message);
    }
  }

  monitorAccentColor() {
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
        } catch (error) {
          console.warn('OpenRGB Accent Sync: Periodic check failed:', error.message);
        }
        return GLib.SOURCE_CONTINUE;
      });

      console.log('OpenRGB Accent Sync: Periodic check timer started');
    } catch (error) {
      console.error('OpenRGB Accent Sync: Failed to monitor accent color:', error.message);
      this.syncAccentColor({ r: 255, g: 0, b: 0 });
    }
  }

  getAccentColor(settings) {
    try {
      const accentColor = settings.get_string('accent-color');

      // GNOME accent colors are predefined values like 'blue', 'teal', 'green', etc.
      // We need to map these to RGB values
      const colorMap = {
        blue: { r: 53, g: 132, b: 228 },
        teal: { r: 33, g: 144, b: 164 },
        green: { r: 21, g: 160, b: 44 },
        yellow: { r: 215, g: 145, b: 4 },
        orange: { r: 237, g: 71, b: 0 },
        red: { r: 243, g: 5, b: 17 },
        pink: { r: 250, g: 42, b: 153 },
        purple: { r: 167, g: 12, b: 250 },
        slate: { r: 148, g: 201, b: 250 },
        default: { r: 255, g: 255, b: 255 },
      };

      return colorMap[accentColor] || colorMap.default;
    } catch (error) {
      console.warn('OpenRGB Accent Sync: Failed to get accent color:', error.message);
      return null;
    }
  }

  async syncAccentColor(color) {
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

      if (!this.settings.get_boolean('sync-enabled')) {
        console.log('OpenRGB Accent Sync: Sync is disabled, skipping color update');
        return;
      }

      const isConnected = await this.ensureOpenRGBConnection();
      if (!isConnected) {
        console.warn(
          'OpenRGB Accent Sync: Unable to establish OpenRGB connection, will retry when OpenRGB becomes available',
        );
        return;
      }

      console.log(`OpenRGB Accent Sync: Starting sync for RGB(${color.r}, ${color.g}, ${color.b})`);

      const syncDelay = this.settings.get_int('sync-delay');
      if (syncDelay > 0) {
        console.log(`OpenRGB Accent Sync: Waiting ${syncDelay}ms before sync`);
        await new Promise((resolve) =>
          this.addTimeout(() => {
            resolve();
            return GLib.SOURCE_REMOVE;
          }, syncDelay),
        );
      }

      console.log(`OpenRGB Accent Sync: Calling setAllDevicesColor...`);
      const results = await this.openrgbClient.setAllDevicesColor(color);

      const successful = results.filter((r) => r.success).length;
      const total = results.length;
      console.log(
        `OpenRGB Accent Sync: Color sync complete (${successful}/${total} devices successful)`,
      );

      if (successful === 0 && total > 0) {
        console.error('OpenRGB Accent Sync: All devices failed to sync, starting reconnection...');
        this.startReconnectionTimer();
      }
    } catch (error) {
      console.error('OpenRGB Accent Sync: Failed to sync color:', error.message);
      console.error('OpenRGB Accent Sync: Error stack:', error.stack);

      this.startReconnectionTimer();
    } finally {
      this.addTimeout(() => {
        this.syncInProgress = false;
        return GLib.SOURCE_REMOVE;
      }, 1000);
    }
  }
}
