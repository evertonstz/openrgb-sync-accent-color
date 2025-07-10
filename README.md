# OpenRGB Accent Color Sync

A GNOME Shell extension that automatically synchronizes your GNOME accent colors with OpenRGB devices.

## Features

- 🎨 Automatically syncs GNOME accent colors to all OpenRGB devices
- 🔄 Real-time color synchronization when accent color changes
- ⚙️ Configurable sync settings and delays
- 🔌 Automatic reconnection handling for OpenRGB
- 🛠️ Built with TypeScript for better maintainability

## Installation

### Prerequisites

- GNOME Shell 45+ 
- OpenRGB server running and accessible, preferable with `--mode direct` flag

### Building from Source

```bash
# Clone the repository
git clone https://github.com/evertonstz/openrgb-sync-accent-color.git
cd openrgb-sync-accent-color

# Build the extension
make all

# Install locally
make install

# Package for distribution
make pack
```

## OpenRGB Setup

For the extension to work properly, OpenRGB needs to be running in server mode. You can set this up as a systemd user service for automatic startup.

### Systemd User Service (Recommended)

Create a systemd user service file at `~/.config/systemd/user/openrgb.service`:

```ini
[Unit]
Description=OpenRGB server mode
After=graphical-session.target

[Service]
ExecStart=/usr/bin/openrgb --server --server-host 127.0.0.1 --server-port 6742 --mode direct --color FFFFFF --brightness 100
ExecStop=/usr/bin/openrgb --client 127.0.0.1:6742 --mode direct --color 000000 --brightness 0
Restart=on-failure
Environment=DISPLAY=:0
Environment=XAUTHORITY=%h/.Xauthority

[Install]
WantedBy=default.target
```

Then enable and start the service:

```bash
# Reload systemd user configuration
systemctl --user daemon-reload

# Enable the service to start on login
systemctl --user enable openrgb.service

# Start the service immediately
systemctl --user start openrgb.service

# Check service status
systemctl --user status openrgb.service
```

## License

This project is licensed under the GPL-3.0 License - see the LICENSE file for details.
