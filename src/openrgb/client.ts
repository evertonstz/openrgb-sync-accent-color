import type { DeviceData } from './device.js';
import { OpenRGBConnectionError, OpenRGBError } from './errors.js';
import { NetworkClient } from './network.js';
import { type RGBColor, validateRGBColor } from './types.js';

export interface Device {
  id: number;
  name: string;
  ledCount: number;
  directModeIndex: number;
  data: DeviceData | null;
}

interface SyncResult {
  deviceId: number;
  success: boolean;
  error?: string;
}

export class OpenRGBClient {
  private networkClient: NetworkClient;
  private devices: Device[];
  public connected: boolean;

  constructor(
    address: string = '127.0.0.1',
    port: number = 6742,
    name: string = 'GNOME-OpenRGB-AccentSync',
  ) {
    this.networkClient = new NetworkClient(address, port, name);
    this.devices = [];
    this.connected = false;
  }

  async connect(): Promise<void> {
    await this.networkClient.connect();
    this.connected = true;
  }

  disconnect(): void {
    this.networkClient.disconnect();
    this.connected = false;
  }

  async discoverDevices(): Promise<Device[]> {
    if (!this.connected) {
      throw new OpenRGBConnectionError('Client is not connected to OpenRGB server');
    }

    console.log('OpenRGB: Starting device discovery...');

    await this.networkClient.registerClient();

    try {
      const deviceCount = await this.networkClient.getControllerCount();
      console.log(`OpenRGB: Found ${deviceCount} devices`);

      this.devices = [];
      for (let i = 0; i < deviceCount; i++) {
        try {
          const deviceData = await this.networkClient.getControllerData(i);

          let directModeIndex = 0;
          for (let j = 0; j < deviceData.modes.length; j++) {
            const mode = deviceData.modes[j];
            if (mode?.name.toLowerCase().includes('direct')) {
              directModeIndex = j;
              break;
            }
          }

          const device: Device = {
            id: i,
            name: deviceData.name,
            ledCount: deviceData.leds.length,
            directModeIndex: directModeIndex,
            data: deviceData,
          };

          if (device.ledCount > 0) {
            try {
              await this.networkClient.setDeviceMode(device.id, device.directModeIndex);
              console.log(
                `OpenRGB: Device ${i} - Set to direct mode ${device.directModeIndex} during discovery`,
              );
            } catch (modeError) {
              console.warn(
                `OpenRGB: Failed to set device ${i} to direct mode during discovery:`,
                (modeError as Error).message,
              );
            }
          }

          this.devices.push(device);
          console.log(
            `OpenRGB: Device ${i}: ${device.name} (${device.ledCount} LEDs, direct mode: ${device.directModeIndex})`,
          );
        } catch (error) {
          console.warn(`OpenRGB: Failed to get device ${i}:`, (error as Error).message);

          this.devices.push({
            id: i,
            name: `Device ${i} (Failed)`,
            ledCount: 0,
            directModeIndex: 0,
            data: null,
          });
        }
      }

      if (this.devices.length === 0) {
        console.warn('OpenRGB: No devices discovered - no fallback devices');
        this.devices = [];
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('OpenRGB: Device discovery failed:', message);
      throw new OpenRGBError(`Device discovery failed: ${message}`);
    }

    console.log(`OpenRGB: Device discovery complete - ${this.devices.length} devices`);
    return this.devices;
  }

  async setAllDevicesColor(
    color: RGBColor,
    setDirectModeOnUpdate: boolean = false,
  ): Promise<SyncResult[]> {
    return this.setDevicesColor(this.devices, color, setDirectModeOnUpdate);
  }

  async setDevicesColor(
    devices: Device[],
    color: RGBColor,
    setDirectModeOnUpdate: boolean = false,
  ): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    if (!this.connected) {
      throw new OpenRGBConnectionError('Client is not connected to OpenRGB server');
    }

    const validatedColor = validateRGBColor(color);

    console.log(`OpenRGB: Syncing ${devices.length} devices`);

    for (const device of devices) {
      try {
        if (device.ledCount === 0) {
          console.log(`OpenRGB: Skipping device ${device.id} - 0 LEDs`);
          results.push({ deviceId: device.id, success: false, error: 'Device skipped (0 LEDs)' });
          continue;
        }

        console.log(
          `OpenRGB: Updating device ${device.id} (${device.name}) with ${device.ledCount} LEDs`,
        );

        if (setDirectModeOnUpdate) {
          try {
            await this.networkClient.setDeviceMode(device.id, device.directModeIndex);
            console.log(
              `OpenRGB: Device ${device.id} - Set to direct mode ${device.directModeIndex} before update`,
            );
          } catch (modeError) {
            console.warn(
              `OpenRGB: Failed to set device ${device.id} to direct mode before update:`,
              (modeError as Error).message,
            );
          }
        }

        await this.networkClient.updateLeds(device.id, validatedColor, device.ledCount);
        console.log(`OpenRGB: Device ${device.id} - Color update sent successfully`);
        results.push({ deviceId: device.id, success: true });
      } catch (error) {
        console.error(`OpenRGB: Failed to update device ${device.id}:`, (error as Error).message);
        results.push({ deviceId: device.id, success: false, error: (error as Error).message });
      }
    }

    return results;
  }

  /**
   * Get the list of discovered devices
   */
  getDevices(): Device[] {
    return [...this.devices];
  }

  /**
   * Get device count
   */
  getDeviceCount(): number {
    return this.devices.length;
  }
}
