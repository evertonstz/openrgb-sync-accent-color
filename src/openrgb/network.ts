import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { DeviceData } from './device.js';
import { PacketType } from './enums.js';
import { OpenRGBConnectionError } from './errors.js';
import { type RGBColor, validateRGBColor } from './types.js';

export class NetworkClient {
  private address: string;
  private port: number;
  private name: string;
  private connection: Gio.SocketConnection | null;
  private connected: boolean;
  private timeouts: Set<number>;

  constructor(
    address: string = '127.0.0.1',
    port: number = 6742,
    name: string = 'GNOME-OpenRGB-AccentSync',
  ) {
    this.address = address;
    this.port = port;
    this.name = name;
    this.connection = null;
    this.connected = false;
    this.timeouts = new Set<number>();
  }

  async connect(): Promise<void> {
    this.disconnect();

    return new Promise<void>((resolve, reject) => {
      const address = Gio.InetSocketAddress.new_from_string(this.address, this.port);
      if (!address) {
        reject(new Error(`Invalid address: ${this.address}:${this.port}`));
        return;
      }

      const socket = new Gio.SocketClient();
      socket.connect_async(address, null, (source, result) => {
        try {
          this.connection = source?.connect_finish(result) || null;
          this.connected = true;
          console.log(`OpenRGB: Connected to ${this.address}:${this.port}`);
          resolve();
        } catch (error) {
          console.error('OpenRGB: Connection failed:', (error as Error).message);
          reject(error);
        }
      });
    });
  }

  disconnect(): void {
    this.clearAllTimeouts();

    if (this.connection) {
      try {
        this.connection.close(null);
        console.log('OpenRGB: Connection closed');
      } catch (error) {
        console.warn('OpenRGB: Error closing connection:', (error as Error).message);
      }
      this.connection = null;
    }
    this.connected = false;
  }

  addTimeout(callback: () => boolean, delay: number): number {
    const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, () => {
      this.timeouts.delete(timeoutId);
      return callback();
    });
    this.timeouts.add(timeoutId);
    return timeoutId;
  }

  clearAllTimeouts(): void {
    for (const timeoutId of this.timeouts) {
      GLib.source_remove(timeoutId);
    }
    this.timeouts.clear();
  }

  createHeader(deviceId: number, packetType: PacketType, dataSize: number): ArrayBuffer {
    const header = new ArrayBuffer(16);
    const view = new DataView(header);

    view.setUint8(0, 0x4f); // 'O'
    view.setUint8(1, 0x52); // 'R'
    view.setUint8(2, 0x47); // 'G'
    view.setUint8(3, 0x42); // 'B'

    view.setUint32(4, deviceId, true);
    view.setUint32(8, packetType, true);
    view.setUint32(12, dataSize, true);

    return header;
  }

  async sendPacket(deviceId: number, packetType: PacketType, data?: ArrayBuffer): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to OpenRGB server');
    }

    const dataSize = data ? data.byteLength : 0;
    const header = this.createHeader(deviceId, packetType, dataSize);

    return new Promise<void>((resolve, reject) => {
      const outputStream = this.connection!.get_output_stream();
      const headerBytes = GLib.Bytes.new(new Uint8Array(header));

      outputStream.write_bytes_async(headerBytes, GLib.PRIORITY_DEFAULT, null, (source, result) => {
        try {
          source?.write_bytes_finish(result);

          if (data) {
            const dataBytes = GLib.Bytes.new(new Uint8Array(data));
            outputStream.write_bytes_async(
              dataBytes,
              GLib.PRIORITY_DEFAULT,
              null,
              (source2, result2) => {
                try {
                  source2?.write_bytes_finish(result2);
                  resolve();
                } catch (error) {
                  reject(error);
                }
              },
            );
          } else {
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async registerClient(): Promise<void> {
    const nameBuffer = new TextEncoder().encode(this.name);
    const clientData = new ArrayBuffer(2 + nameBuffer.length);
    const view = new DataView(clientData);

    view.setUint16(0, nameBuffer.length, true);
    const nameArray = new Uint8Array(clientData, 2);
    nameArray.set(nameBuffer);

    await this.sendPacket(0, PacketType.SET_CLIENT_NAME, clientData);
    console.log(`OpenRGB: Registered client "${this.name}"`);
  }

  async getControllerCount(): Promise<number> {
    await this.sendPacket(0, PacketType.REQUEST_CONTROLLER_COUNT);

    return new Promise<number>((resolve, reject) => {
      const inputStream = this.connection!.get_input_stream();

      inputStream.read_bytes_async(20, GLib.PRIORITY_DEFAULT, null, (source, result) => {
        try {
          const readBytes = source?.read_bytes_finish(result);
          const data = readBytes?.get_data();

          if (data && data.length >= 20) {
            const count = data[16]! | (data[17]! << 8) | (data[18]! << 16) | (data[19]! << 24);
            resolve(count);
          } else {
            reject(new Error('Invalid response'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async getControllerData(deviceId: number): Promise<DeviceData> {
    await this.sendPacket(deviceId, PacketType.REQUEST_CONTROLLER_DATA);

    return new Promise<DeviceData>((resolve, reject) => {
      const inputStream = this.connection!.get_input_stream();
      let totalBuffer = new Uint8Array(0);
      let headerReceived = false;
      let expectedDataSize = 0;
      let timeoutId: number | null = null;

      const dataHandler = (_source: any, result: any) => {
        try {
          if (timeoutId !== null) {
            GLib.source_remove(timeoutId);
            this.timeouts.delete(timeoutId);
            timeoutId = null;
          }

          const data = inputStream.read_bytes_finish(result);
          if (data && data.get_size() > 0) {
            const dataArray = data.get_data();
            if (dataArray) {
              const buffer = new Uint8Array(dataArray);

              const newBuffer = new Uint8Array(totalBuffer.length + buffer.length);
              newBuffer.set(totalBuffer);
              newBuffer.set(buffer, totalBuffer.length);
              totalBuffer = newBuffer;

              if (!headerReceived && totalBuffer.length >= 16) {
                const view = new DataView(
                  totalBuffer.buffer,
                  totalBuffer.byteOffset,
                  totalBuffer.byteLength,
                );
                expectedDataSize = view.getUint32(12, true);
                headerReceived = true;
                console.log(
                  `OpenRGB: Device ${deviceId} - Expected data size: ${expectedDataSize}`,
                );
              }

              if (headerReceived && totalBuffer.length >= 16 + expectedDataSize) {
                console.log(`OpenRGB: Device ${deviceId} - processing ${expectedDataSize} bytes`);

                const deviceBuffer = totalBuffer.slice(16, 16 + expectedDataSize);

                const arrayBuffer = deviceBuffer.buffer.slice(
                  deviceBuffer.byteOffset,
                  deviceBuffer.byteOffset + deviceBuffer.byteLength,
                );

                try {
                  const deviceData = DeviceData.parse(arrayBuffer);
                  if (timeoutId !== null) {
                    GLib.source_remove(timeoutId);
                    this.timeouts.delete(timeoutId);
                  }
                  resolve(deviceData);
                } catch (parseError) {
                  console.error(`OpenRGB: Failed to parse device ${deviceId}:`, parseError);
                  reject(parseError);
                }
                return;
              }

              if (totalBuffer.length < 16 + expectedDataSize) {
                inputStream.read_bytes_async(4096, GLib.PRIORITY_DEFAULT, null, dataHandler);
              }
            }
          } else {
            console.warn(`OpenRGB: Device ${deviceId} - no data received`);
            reject(new Error('No data received'));
          }
        } catch (error) {
          if (timeoutId !== null) {
            GLib.source_remove(timeoutId);
            this.timeouts.delete(timeoutId);
          }
          reject(error);
        }
      };

      timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 10000, () => {
        if (timeoutId !== null) {
          this.timeouts.delete(timeoutId);
        }
        reject(new Error('Timeout waiting for device data'));
        return GLib.SOURCE_REMOVE;
      });
      if (timeoutId !== null) {
        this.timeouts.add(timeoutId);
      }

      inputStream.read_bytes_async(4096, GLib.PRIORITY_DEFAULT, null, dataHandler);
    });
  }

  async updateLeds(deviceId: number, color: RGBColor, ledCount: number): Promise<void> {
    const validatedColor = validateRGBColor(color);

    const totalSize = 6 + ledCount * 4;
    const dataPayload = new ArrayBuffer(totalSize);
    const view = new DataView(dataPayload);

    view.setUint32(0, totalSize, true);
    view.setUint16(4, ledCount, true);

    for (let i = 0; i < ledCount; i++) {
      const offset = 6 + i * 4;
      view.setUint8(offset, validatedColor.r);
      view.setUint8(offset + 1, validatedColor.g);
      view.setUint8(offset + 2, validatedColor.b);
      view.setUint8(offset + 3, 0);
    }

    await this.sendPacket(deviceId, PacketType.RGBCONTROLLER_UPDATELEDS, dataPayload);
  }

  async setDeviceMode(deviceId: number, modeIndex: number): Promise<void> {
    if (!this.connected) {
      throw new OpenRGBConnectionError('Not connected to OpenRGB server');
    }

    console.log(`OpenRGB: Setting device ${deviceId} to mode ${modeIndex}`);

    const modeData = new ArrayBuffer(4);
    const view = new DataView(modeData);
    view.setUint32(0, modeIndex, true);

    await this.sendPacket(deviceId, PacketType.RGBCONTROLLER_UPDATEMODE, modeData);

    await new Promise<void>((resolve) =>
      this.addTimeout(() => {
        resolve();
        return true;
      }, 200),
    );
  }
}
