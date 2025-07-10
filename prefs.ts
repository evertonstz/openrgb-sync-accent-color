import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class OpenRGBAccentSyncPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window: Adw.PreferencesWindow): Promise<void> {
        const settings = this.getSettings('org.gnome.shell.extensions.openrgb-sync-accent-color');

        const page = new Adw.PreferencesPage({
            title: _('OpenRGB Accent Sync'),
            icon_name: 'applications-graphics-symbolic',
        });

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

        const syncGroup = new Adw.PreferencesGroup({
            title: _('Synchronization'),
            description: _('The extension uses the OpenRGB SDK protocol for direct communication with RGB devices.'),
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

        const aboutGroup = new Adw.PreferencesGroup({
            title: _('About'),
        });

        const aboutRow = new Adw.ActionRow({
            title: _('OpenRGB Accent Sync'),
            subtitle: _('Synchronize GNOME accent colors with OpenRGB devices'),
        });

        const linkButton = new Gtk.LinkButton({
            label: _('GitHub Repository'),
            uri: 'https://github.com/evertoncorreia/openrgb-sync-accent-color',
            valign: Gtk.Align.CENTER,
        });
        aboutRow.add_suffix(linkButton);

        aboutGroup.add(aboutRow);

        page.add(connectionGroup);
        page.add(syncGroup);
        page.add(aboutGroup);
        window.add(page);
        
        return Promise.resolve();
    }

    private async _testConnection(settings: Gio.Settings, statusLabel: Gtk.Label, button: Gtk.Button): Promise<void> {
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
            } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('Name or service not known')) {
                errorMessage = 'Host not found - Check the hostname/IP address';
            } else if (errorMessage.includes('família desconhecida') || errorMessage.includes('Unknown family')) {
                errorMessage = 'Invalid host address - Use IP address like 127.0.0.1 instead of localhost';
            } else if (errorMessage.includes('Invalid host address') || errorMessage.includes('Invalid IP address')) {
                errorMessage = 'Invalid host address - Use IP address like 127.0.0.1 or 192.168.1.100';
            }
            
            statusLabel.label = _(`✗ ${errorMessage}`);
            statusLabel.css_classes = ['error'];
        } finally {
            button.sensitive = true;
        }
    }
}
