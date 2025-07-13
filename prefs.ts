import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {
  gettext as _,
  ExtensionPreferences,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { OpenRGBClient } from './src/openrgb/index.js';
import { ACCENT_COLOR_MAP, type AccentColorName, ExtensionConstants } from './src/types/extension.js';

export default class OpenRGBAccentSyncPreferences extends ExtensionPreferences {
  override fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    const settings = this.getSettings();

    const mainPage = new Adw.PreferencesPage({
      title: _('Connection & Sync'),
      icon_name: 'applications-graphics-symbolic',
    });

    const devicesPage = new Adw.PreferencesPage({
      title: _('Devices'),
      icon_name: 'computer-symbolic',
    });

    this._createConnectionGroup(mainPage, settings);
    this._createSyncGroup(mainPage, settings);
    this._createAboutGroup(mainPage);
    this._createDevicesGroup(devicesPage, settings);

    window.add(mainPage);
    window.add(devicesPage);

    return Promise.resolve();
  }

  private _createConnectionGroup(page: Adw.PreferencesPage, settings: Gio.Settings): void {
    const connectionGroup = new Adw.PreferencesGroup({
      title: _('OpenRGB Connection'),
      description: _('Configure connection to OpenRGB server using the SDK protocol.'),
    });

    const hostRow = new Adw.EntryRow({
      title: _('Server Host'),
      text: settings.get_string('openrgb-host'),
    });
    hostRow.connect('notify::text', () => {
      settings.set_string('openrgb-host', hostRow.text);
    });

    const portRow = new Adw.SpinRow({
      title: _('Server Port'),
      adjustment: new Gtk.Adjustment({
        lower: 1,
        upper: 65535,
        step_increment: 1,
        value: settings.get_int('openrgb-port'),
      }),
    });
    portRow.connect('notify::value', () => {
      settings.set_int('openrgb-port', portRow.value);
    });

    const testButton = new Gtk.Button({
      label: _('Test Connection'),
      css_classes: ['suggested-action'],
      valign: Gtk.Align.CENTER,
    });

    const connectionStatus = new Gtk.Label({
      label: _('Not tested'),
      css_classes: ['dim-label'],
    });

    const testRow = new Adw.ActionRow({
      title: _('Connection Test'),
      subtitle: _('Test the connection to OpenRGB server'),
    });
    testRow.add_suffix(connectionStatus);
    testRow.add_suffix(testButton);

    testButton.connect('clicked', async () => {
      await this._testConnection(settings, connectionStatus, testButton);
    });

    connectionGroup.add(hostRow);
    connectionGroup.add(portRow);
    connectionGroup.add(testRow);
    page.add(connectionGroup);
  }

  private _createSyncGroup(page: Adw.PreferencesPage, settings: Gio.Settings): void {
    const syncGroup = new Adw.PreferencesGroup({
      title: _('Synchronization'),
      description: _(
        'The extension uses the OpenRGB SDK protocol for direct communication with RGB devices.',
      ),
    });

    const enabledRow = new Adw.SwitchRow({
      title: _('Enable Synchronization'),
      subtitle: _('Automatically sync GNOME accent color with OpenRGB devices'),
      active: settings.get_boolean('sync-enabled'),
    });
    enabledRow.connect('notify::active', () => {
      settings.set_boolean('sync-enabled', enabledRow.active);
    });

    const delayRow = new Adw.SpinRow({
      title: _('Sync Delay'),
      subtitle: _('Delay in milliseconds before applying color changes'),
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 5000,
        step_increment: 50,
        value: settings.get_int('sync-delay'),
      }),
    });
    delayRow.connect('notify::value', () => {
      settings.set_int('sync-delay', delayRow.value);
    });

    const directModeRow = new Adw.SwitchRow({
      title: _('Set Direct Mode on Every Update'),
      subtitle: _('Enable if devices change modes unexpectedly (may slow down color updates)'),
      active: settings.get_boolean('set-direct-mode-on-update'),
    });
    directModeRow.connect('notify::active', () => {
      settings.set_boolean('set-direct-mode-on-update', directModeRow.active);
    });

    syncGroup.add(enabledRow);
    syncGroup.add(delayRow);
    syncGroup.add(directModeRow);
    page.add(syncGroup);
  }

  private _createAboutGroup(page: Adw.PreferencesPage): void {
    const aboutGroup = new Adw.PreferencesGroup({
      title: _('About'),
    });

    const aboutRow = new Adw.ActionRow({
      title: _('OpenRGB Accent Sync'),
      subtitle: _('Synchronize GNOME accent colors with OpenRGB devices'),
    });

    const linkButton = new Gtk.LinkButton({
      label: _('GitHub Repository'),
      uri: 'https://github.com/evertonstz/openrgb-sync-accent-color',
      valign: Gtk.Align.CENTER,
    });
    aboutRow.add_suffix(linkButton);

    aboutGroup.add(aboutRow);
    page.add(aboutGroup);
  }

  private _createDevicesGroup(page: Adw.PreferencesPage, settings: Gio.Settings): void {
    const deviceListGroup = new Adw.PreferencesGroup({
      title: _('Available Devices'),
      description: _('Discover and manage OpenRGB devices for accent color synchronization.'),
    });

    const discoveryRow = new Adw.ActionRow({
      title: _('Device Discovery'),
      subtitle: _('Scan for available OpenRGB devices'),
    });

    const discoverButton = new Gtk.Button({
      label: _('Discover Devices'),
      css_classes: ['suggested-action'],
      valign: Gtk.Align.CENTER,
    });

    discoveryRow.add_suffix(discoverButton);

    deviceListGroup.add(discoveryRow);

    const ignoredDevicesGroup = new Adw.PreferencesGroup({
      title: _('Ignored Devices'),
      description: _('Devices that are currently excluded from synchronization.'),
    });

    const ignoredDevicesRows: Adw.ActionRow[] = [];
    const deviceRows: Adw.ActionRow[] = [];

    const resetButton = new Gtk.Button({
      label: _('Reset All'),
      css_classes: ['destructive-action'],
      valign: Gtk.Align.CENTER,
    });

    const resetRow = new Adw.ActionRow({
      title: _('Reset Ignored Devices'),
      subtitle: _('Clear all ignored devices and enable synchronization for all'),
    });
    resetRow.add_suffix(resetButton);

    resetButton.connect('clicked', () => {
      const ignoredDeviceJsons = settings.get_strv('ignored-devices');
      const reEnabledDevices = ignoredDeviceJsons
        .map((deviceJson) => {
          try {
            return JSON.parse(deviceJson);
          } catch {
            return null;
          }
        })
        .filter((device) => device !== null);

      settings.set_strv('ignored-devices', []);

      this._updateIgnoredDevicesSection(
        settings,
        ignoredDevicesGroup,
        ignoredDevicesRows,
        resetButton,
        deviceListGroup,
        deviceRows,
      );

      reEnabledDevices.forEach((device) => {
        this._triggerColorUpdate(settings, device);
      });

      discoverButton.emit('clicked');
    });

    discoverButton.connect('clicked', async () => {
      await this._discoverDevices(
        settings,
        discoverButton,
        deviceListGroup,
        resetButton,
        deviceRows,
        ignoredDevicesGroup,
        ignoredDevicesRows,
      );
    });

    this._updateIgnoredDevicesSection(
      settings,
      ignoredDevicesGroup,
      ignoredDevicesRows,
      resetButton,
      deviceListGroup,
      deviceRows,
    );

    page.add(deviceListGroup);

    ignoredDevicesGroup.add(resetRow);
    page.add(ignoredDevicesGroup);
  }

  private async _discoverDevices(
    settings: Gio.Settings,
    button: Gtk.Button,
    deviceListGroup: Adw.PreferencesGroup,
    resetButton: Gtk.Button,
    deviceRows: Adw.ActionRow[],
    ignoredDevicesGroup: Adw.PreferencesGroup,
    ignoredDevicesRows: Adw.ActionRow[],
  ): Promise<void> {
    button.sensitive = false;
    
    const statusRow = new Adw.ActionRow({
      title: _('Discovering devices...'),
      subtitle: _('Please wait while scanning for OpenRGB devices'),
    });
    deviceListGroup.add(statusRow);

    deviceRows.forEach((row) => deviceListGroup.remove(row));
    deviceRows.length = 0;

    try {
      const host = settings.get_string('openrgb-host');
      const port = settings.get_int('openrgb-port');
      const client = new OpenRGBClient(host, port, 'GNOME-Preferences');

      await client.connect();
      const devices = await client.discoverDevices();
      client.disconnect();

      if (devices.length === 0) {
        statusRow.title = _('No devices found');
        statusRow.subtitle = _('Make sure OpenRGB server is running and devices are connected');
        return;
      }

      deviceListGroup.remove(statusRow);

      const ignoredDeviceJsons = settings.get_strv('ignored-devices');
      const ignoredDeviceIds = ignoredDeviceJsons
        .map((deviceJson) => {
          try {
            const device = JSON.parse(deviceJson);
            return device.id;
          } catch (error) {
            console.warn('Failed to parse ignored device JSON:', deviceJson, error);
            return -1;
          }
        })
        .filter((id) => id !== -1);

      devices.forEach((device) => {
        const isEnabled = !ignoredDeviceIds.includes(device.id);

        if (!isEnabled) {
          return;
        }

        const deviceRow = new Adw.ActionRow({
          title: device.name,
          subtitle: _(`Device ID: ${device.id} • LEDs: ${device.ledCount}`),
        });

        const ignoreButton = new Gtk.Button({
          label: _('Ignore'),
          css_classes: ['destructive-action'],
          valign: Gtk.Align.CENTER,
        });

        deviceRow.add_suffix(ignoreButton);

        ignoreButton.connect('clicked', () => {
          const currentIgnoredJsons = settings.get_strv('ignored-devices');
          const currentIgnoredDevices = currentIgnoredJsons
            .map((deviceJson) => {
              try {
                return JSON.parse(deviceJson);
              } catch (error) {
                console.warn('Failed to parse ignored device JSON:', deviceJson, error);
                return null;
              }
            })
            .filter((device) => device !== null);

          const deviceExists = currentIgnoredDevices.some(
            (ignoredDevice) => ignoredDevice.id === device.id,
          );
          if (!deviceExists) {
            currentIgnoredDevices.push(device);
            settings.set_strv(
              'ignored-devices',
              currentIgnoredDevices.map((device) =>
                JSON.stringify({
                  id: device.id,
                  name: device.name,
                  ledCount: device.ledCount,
                }),
              ),
            );
          }

          deviceListGroup.remove(deviceRow);
          const deviceIndex = deviceRows.indexOf(deviceRow);
          if (deviceIndex > -1) {
            deviceRows.splice(deviceIndex, 1);
          }

          const hasIgnoredDevices = settings.get_strv('ignored-devices').length > 0;
          resetButton.sensitive = hasIgnoredDevices;

          this._updateIgnoredDevicesSection(
            settings,
            ignoredDevicesGroup,
            ignoredDevicesRows,
            resetButton,
            deviceListGroup,
            deviceRows,
          );
        });

        deviceListGroup.add(deviceRow);
        deviceRows.push(deviceRow);
      });

      const hasIgnoredDevices = ignoredDeviceIds.length > 0;
      resetButton.sensitive = hasIgnoredDevices;

      this._updateIgnoredDevicesSection(
        settings,
        ignoredDevicesGroup,
        ignoredDevicesRows,
        resetButton,
        deviceListGroup,
        deviceRows,
      );

      deviceListGroup.remove(statusRow);
    } catch (error) {
      console.error('Device discovery failed:', error);
      let errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('Connection refused') || errorMessage.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        errorMessage = 'Connection timeout';
      } else {
        errorMessage = 'Discovery failed';
      }

      statusRow.title = _('Discovery Failed');
      statusRow.subtitle = _(`${errorMessage} - Make sure OpenRGB server is running`);
    } finally {
      button.sensitive = true;
    }
  }

  private async _testConnection(
    settings: Gio.Settings,
    statusLabel: Gtk.Label,
    button: Gtk.Button,
  ): Promise<void> {
    button.sensitive = false;
    statusLabel.label = _('Testing...');
    statusLabel.css_classes = ['dim-label'];

    try {
      const host = settings.get_string('openrgb-host');
      const port = settings.get_int('openrgb-port');

      const address = Gio.InetSocketAddress.new_from_string(host, port);
      if (!address) {
        throw new Error(`Invalid address: ${host}:${port}`);
      }

      const socket = new Gio.SocketClient();

      const connection = await new Promise<Gio.SocketConnection>((resolve, reject) => {
        const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 5000, () => {
          reject(new Error('Connection timeout'));
          return GLib.SOURCE_REMOVE;
        });

        socket.connect_async(address, null, (source, result) => {
          GLib.source_remove(timeoutId);
          try {
            const conn = source!.connect_finish(result);
            resolve(conn);
          } catch (error) {
            reject(error);
          }
        });
      });

      connection.close(null);

      statusLabel.label = _('✓ Connected');
      statusLabel.css_classes = ['success'];
    } catch (error) {
      console.error('OpenRGB connection test failed:', error);
      let errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('Connection refused') || errorMessage.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused - Try: openrgb --server --server-host 127.0.0.1';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        errorMessage = 'Connection timeout - Check host and port settings';
      } else if (
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('Name or service not known')
      ) {
        errorMessage = 'Host not found - Check the hostname/IP address';
      } else if (
        errorMessage.includes('família desconhecida') ||
        errorMessage.includes('Unknown family')
      ) {
        errorMessage = 'Invalid host address - Use IP address like 127.0.0.1 instead of localhost';
      } else if (
        errorMessage.includes('Invalid host address') ||
        errorMessage.includes('Invalid IP address')
      ) {
        errorMessage = 'Invalid host address - Use IP address like 127.0.0.1 or 192.168.1.100';
      }

      statusLabel.label = _(`✗ ${errorMessage}`);
      statusLabel.css_classes = ['error'];
    } finally {
      button.sensitive = true;
    }
  }

  private _updateIgnoredDevicesSection(
    settings: Gio.Settings,
    ignoredDevicesGroup: Adw.PreferencesGroup,
    ignoredDevicesRows: Adw.ActionRow[],
    resetButton: Gtk.Button,
    deviceListGroup?: Adw.PreferencesGroup,
    deviceRows?: Adw.ActionRow[],
  ): void {
    ignoredDevicesRows.forEach((row) => ignoredDevicesGroup.remove(row));
    ignoredDevicesRows.length = 0;

    const ignoredDeviceJsons = settings.get_strv('ignored-devices');

    const ignoredDevices = ignoredDeviceJsons
      .map((deviceJson) => {
        try {
          return JSON.parse(deviceJson);
        } catch (error) {
          console.warn('Failed to parse ignored device JSON:', deviceJson, error);
          return null;
        }
      })
      .filter((device) => device !== null);

    resetButton.sensitive = ignoredDevices.length > 0;

    if (ignoredDevices.length === 0) {
      const noDevicesRow = new Adw.ActionRow({
        title: _('No ignored devices'),
        subtitle: _('All devices are currently enabled for synchronization'),
      });
      ignoredDevicesGroup.add(noDevicesRow);
      ignoredDevicesRows.push(noDevicesRow as any);
      return;
    }

    ignoredDevices.forEach((device) => {
      const deviceRow = new Adw.ActionRow({
        title: device.name || _(`Device ID: ${device.id}`),
        subtitle: _(`Device ID: ${device.id} • LEDs: ${device.ledCount || 0} • Currently ignored`),
      });

      const removeButton = new Gtk.Button({
        icon_name: 'window-close-symbolic',
        css_classes: ['flat'],
        valign: Gtk.Align.CENTER,
        tooltip_text: _('Remove from ignored list'),
      });

      deviceRow.add_suffix(removeButton);

      removeButton.connect('clicked', () => {
        const currentIgnoredJsons = settings.get_strv('ignored-devices');
        const newIgnoredJsons = currentIgnoredJsons.filter((deviceJson) => {
          try {
            const ignoredDevice = JSON.parse(deviceJson);
            return ignoredDevice.id !== device.id;
          } catch (error) {
            console.warn(
              'Failed to parse ignored device JSON during removal:',
              deviceJson,
              error,
            );
            return false; // Remove invalid entries
          }
        });
        settings.set_strv('ignored-devices', newIgnoredJsons);

        if (deviceListGroup && deviceRows) {
          const newDeviceRow = new Adw.ActionRow({
            title: device.name || _(`Device ID: ${device.id}`),
            subtitle: _(`Device ID: ${device.id} • LEDs: ${device.ledCount || 0}`),
          });

          const ignoreButton = new Gtk.Button({
            label: _('Ignore'),
            css_classes: ['destructive-action'],
            valign: Gtk.Align.CENTER,
          });

          newDeviceRow.add_suffix(ignoreButton);

          ignoreButton.connect('clicked', () => {
            const currentIgnoredJsons = settings.get_strv('ignored-devices');
            const currentIgnoredDevices = currentIgnoredJsons
              .map((deviceJson) => {
                try {
                  return JSON.parse(deviceJson);
                } catch {
                  return null;
                }
              })
              .filter((device) => device !== null);

            const deviceExists = currentIgnoredDevices.some(
              (ignoredDevice) => ignoredDevice.id === device.id,
            );
            if (!deviceExists) {
              currentIgnoredDevices.push(device);
              settings.set_strv(
                'ignored-devices',
                currentIgnoredDevices.map((device) =>
                  JSON.stringify({
                    id: device.id,
                    name: device.name,
                    ledCount: device.ledCount,
                  }),
                ),
              );
            }

            deviceListGroup.remove(newDeviceRow);
            const deviceIndex = deviceRows.indexOf(newDeviceRow);
            if (deviceIndex > -1) {
              deviceRows.splice(deviceIndex, 1);
            }

            this._updateIgnoredDevicesSection(
              settings,
              ignoredDevicesGroup,
              ignoredDevicesRows,
              resetButton,
              deviceListGroup,
              deviceRows,
            );
          });

          deviceListGroup.add(newDeviceRow);
          deviceRows.push(newDeviceRow);
        }

        this._triggerColorUpdate(settings, device);

        this._updateIgnoredDevicesSection(
          settings,
          ignoredDevicesGroup,
          ignoredDevicesRows,
          resetButton,
          deviceListGroup,
          deviceRows,
        );
      });

      ignoredDevicesGroup.add(deviceRow);
      ignoredDevicesRows.push(deviceRow);
    });
  }

  private async _triggerColorUpdate(settings: Gio.Settings, device: any): Promise<void> {
    if (!settings.get_boolean('sync-enabled')) {
      console.log('OpenRGB Accent Sync: Sync is disabled, skipping color update for re-enabled device');
      return;
    }

    try {
      const desktopSettings = new Gio.Settings({
        schema_id: ExtensionConstants.DESKTOP_INTERFACE_SCHEMA,
      });
      
      const accentColorName = desktopSettings.get_string(ExtensionConstants.ACCENT_COLOR_KEY);
      const currentColor = ACCENT_COLOR_MAP[accentColorName as AccentColorName] ?? ACCENT_COLOR_MAP.default;

      console.log(`OpenRGB Accent Sync: Triggering color update for re-enabled device ${device.name} (ID: ${device.id})`);
      console.log(`OpenRGB Accent Sync: Current accent color: RGB(${currentColor.r}, ${currentColor.g}, ${currentColor.b})`);

      const host = settings.get_string('openrgb-host');
      const port = settings.get_int('openrgb-port');
      const client = new OpenRGBClient(host, port, 'GNOME-Preferences-ColorUpdate');

      await client.connect();
      
      const setDirectModeOnUpdate = settings.get_boolean('set-direct-mode-on-update');
      
      const results = await client.setDevicesColor([device], currentColor, setDirectModeOnUpdate);
      
      client.disconnect();

      const successful = results.filter((r) => r.success).length;
      if (successful > 0) {
        console.log(`OpenRGB Accent Sync: Successfully updated color for re-enabled device ${device.name}`);
      } else {
        console.warn(`OpenRGB Accent Sync: Failed to update color for re-enabled device ${device.name}`);
      }
    } catch (error) {
      console.error('OpenRGB Accent Sync: Failed to trigger color update for re-enabled device:', error);
    }
  }
}
