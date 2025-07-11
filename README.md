# <img src="https://github.com/user-attachments/assets/bcf7adce-6425-4713-a955-56332b51caef" width="32" height="32" align="top"> OpenRGB Accent Color Sync

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GNOME Shell](https://img.shields.io/badge/GNOME%20Shell-45%2B-4A90E2?logo=gnome&logoColor=white)](https://www.gnome.org/)
[![OpenRGB](https://img.shields.io/badge/OpenRGB-Compatible-orange?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMSA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDMgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K)](https://openrgb.org/)
[![CI Status](https://img.shields.io/github/actions/workflow/status/evertonstz/openrgb-sync-accent-color/ci.yml?branch=main&logo=github&label=CI)](https://github.com/evertonstz/openrgb-sync-accent-color/actions)
[![GitHub Release](https://img.shields.io/github/v/release/evertonstz/openrgb-sync-accent-color?logo=github)](https://github.com/evertonstz/openrgb-sync-accent-color/releases)
[![GitHub Downloads](https://img.shields.io/github/downloads/evertonstz/openrgb-sync-accent-color/total?logo=github)](https://github.com/evertonstz/openrgb-sync-accent-color/releases)


<p align="center">
  <a href="https://extensions.gnome.org/extension/8331/openrgb-accent-color-sync/">
    <img src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true" alt="Get it on GNOME Extensions" height="100" align="middle">
  </a>
</p>A GNOME Shell extension that automatically synchronizes your GNOME accent colors with OpenRGB devices.

## Features

- 🎨 Automatically syncs GNOME accent colors to all OpenRGB devices
- 🔄 Real-time color synchronization when accent color changes
- ⚙️ Configurable sync settings and delays
- 🔌 Automatic reconnection handling for OpenRGB

## Documentation

Wanna build a GNOME extension with OpenRGB support? **[The implementation of the OpenRGB-SDK in this repo might help you](src/openrgb)**

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

# Run unit and integration tests
make test
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

## Special Thanks

This project was made possible thanks to the excellent work and documentation from:

- **[OpenRGB Documentation](https://gitlab.com/OpenRGBDevelopers/OpenRGB-Wiki/-/blob/stable/Developer-Documentation/OpenRGB-SDK-Documentation.md)** - Official OpenRGB SDK protocol documentation
- **[OpenRGB Python SDK](https://github.com/jath03/openrgb-python)** - Python implementation that served as reference for protocol implementation
- **[Artemis OpenRGB Plugin](https://github.com/Artemis-RGB/Artemis.Plugins)** - Excellent example of OpenRGB integration patterns
- **[OpenRGB.NET](https://github.com/diogotr7/OpenRGB.NET)** - C# SDK implementation providing additional protocol insights

## License

This project is licensed under the GPL-3.0 License - see the LICENSE file for details.
