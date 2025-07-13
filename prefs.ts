import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';

import {
  gettext as _,
  ExtensionPreferences,
} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import { OpenRGBClient } from './src/openrgb/index.js';

export default class OpenRGBAccentSyncPreferences extends ExtensionPreferences {
  override fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
    const settings = this.getSettings();

    // Connection & Sync Page
    const mainPage = new Adw.PreferencesPage({
      title: _('Connection & Sync'),
      icon_name: 'applications-graphics-symbolic',
    });

    // Devices Page
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
    const devicesGroup = new Adw.PreferencesGroup({
      title: _('Device Management'),
      description: _('Select which OpenRGB devices should be synchronized with accent colors.'),
    });

    // Connection status for device discovery
    const discoveryStatusLabel = new Gtk.Label({
      label: _('Click "Discover Devices" to find available OpenRGB devices'),
      css_classes: ['dim-label'],
      wrap: true,
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

    const resetButton = new Gtk.Button({
      label: _('Reset All'),
      css_classes: ['destructive-action'],
      valign: Gtk.Align.CENTER,
      sensitive: false,
    });

    discoveryRow.add_suffix(resetButton);
    discoveryRow.add_suffix(discoverButton);

    // Device list container
    const deviceListGroup = new Adw.PreferencesGroup({
      title: _('Available Devices'),
    });

    const deviceRows: Adw.SwitchRow[] = [];

    // Reset button functionality
    resetButton.connect('clicked', () => {
      // Clear ignored devices (enable all)
      settings.set_strv('ignored-devices', []);

      // Update UI
      deviceRows.forEach((row) => {
        row.active = true;
      });

      resetButton.sensitive = false;
    });

    // Discover button functionality
    discoverButton.connect('clicked', async () => {
      await this._discoverDevices(
        settings,
        discoverButton,
        discoveryStatusLabel,
        deviceListGroup,
        resetButton,
        deviceRows,
      );
    });

    devicesGroup.add(discoveryRow);
    devicesGroup.add(discoveryStatusLabel);
    page.add(devicesGroup);
    page.add(deviceListGroup);
  }

  private async _discoverDevices(
    settings: Gio.Settings,
    button: Gtk.Button,
    statusLabel: Gtk.Label,
    deviceListGroup: Adw.PreferencesGroup,
    resetButton: Gtk.Button,
    deviceRows: Adw.SwitchRow[],
  ): Promise<void> {
    button.sensitive = false;
    statusLabel.label = _('Discovering devices...');
    statusLabel.css_classes = ['dim-label'];

    // Clear existing device rows
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
        statusLabel.label = _('No devices found');
        statusLabel.css_classes = ['warning'];
        return;
      }

      // Get currently ignored devices
      const ignoredDevices = settings.get_strv('ignored-devices').map((id) => parseInt(id));

      // Create device rows
      devices.forEach((device) => {
        const isEnabled = !ignoredDevices.includes(device.id);

        const deviceRow = new Adw.SwitchRow({
          title: device.name,
          subtitle: _(`Device ID: ${device.id} • LEDs: ${device.ledCount}`),
          active: isEnabled,
        });

        deviceRow.connect('notify::active', () => {
          const currentIgnored = settings.get_strv('ignored-devices').map((id) => parseInt(id));

          if (deviceRow.active) {
            // Enable device (remove from ignored list)
            const newIgnored = currentIgnored.filter((id) => id !== device.id);
            settings.set_strv(
              'ignored-devices',
              newIgnored.map((id) => id.toString()),
            );
          } else {
            // Disable device (add to ignored list)
            if (!currentIgnored.includes(device.id)) {
              currentIgnored.push(device.id);
              settings.set_strv(
                'ignored-devices',
                currentIgnored.map((id) => id.toString()),
              );
            }
          }

          // Update reset button state
          const hasIgnoredDevices = settings.get_strv('ignored-devices').length > 0;
          resetButton.sensitive = hasIgnoredDevices;
        });

        deviceListGroup.add(deviceRow);
        deviceRows.push(deviceRow);
      });

      // Update reset button state
      const hasIgnoredDevices = ignoredDevices.length > 0;
      resetButton.sensitive = hasIgnoredDevices;

      statusLabel.label = _(`✓ Found ${devices.length} device(s)`);
      statusLabel.css_classes = ['success'];
    } catch (error) {
      console.error('Device discovery failed:', error);
      let errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('Connection refused') || errorMessage.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused - Make sure OpenRGB server is running';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        errorMessage = 'Connection timeout - Check host and port settings';
      }

      statusLabel.label = _(`✗ ${errorMessage}`);
      statusLabel.css_classes = ['error'];
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

      statusLabel.label = _('✓ Connected successfully');
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
}
