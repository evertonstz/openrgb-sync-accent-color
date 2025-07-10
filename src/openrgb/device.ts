// @ts-nocheck
import { BinaryParser } from './parser.js';

export class DeviceData {
  constructor() {
    this.name = '';
    this.description = '';
    this.version = '';
    this.serial = '';
    this.location = '';
    this.modes = [];
    this.zones = [];
    this.leds = [];
    this.colors = [];
  }

  static parse(data) {
    const parser = new BinaryParser(data);
    const device = new DeviceData();

    try {
      console.log(`OpenRGB: Parsing device data, buffer size: ${data.byteLength}`);

      const debugView = new Uint8Array(data, 0, Math.min(64, data.byteLength));
      const hexString = Array.from(debugView)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      const asciiString = Array.from(debugView)
        .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
        .join('');
      console.log(`OpenRGB: First 64 bytes (hex): ${hexString}`);
      console.log(`OpenRGB: First 64 bytes (ASCII): ${asciiString}`);

      console.log('OpenRGB: Parsing binary protocol structure');

      const dataSize = parser.readUint32();
      const commandType = parser.readUint32();
      console.log(`OpenRGB: Header: data_size=${dataSize}, command_type=${commandType}`);

      device.name = parser.readString();
      console.log(`OpenRGB: Device name: "${device.name}"`);

      device.description = parser.readString();
      console.log(`OpenRGB: Description: "${device.description}"`);

      device.version = parser.readString();
      console.log(`OpenRGB: Version: "${device.version}"`);

      device.serial = parser.readString();
      console.log(`OpenRGB: Serial: "${device.serial}"`);

      device.location = parser.readString();
      console.log(`OpenRGB: Location: "${device.location}"`);

      const modeCount = parser.readUint16();
      const activeModeIndex = parser.readUint32();
      console.log(`OpenRGB: Modes: ${modeCount}, Active: ${activeModeIndex}`);

      for (let i = 0; i < modeCount; i++) {
        const mode = {
          name: parser.readString(),
          value: parser.readUint32(),
          flags: parser.readUint32(),
          speedMin: parser.readUint32(),
          speedMax: parser.readUint32(),
          colorsMin: parser.readUint32(),
          colorsMax: parser.readUint32(),
          speed: parser.readUint32(),
          direction: parser.readUint32(),
          colorMode: parser.readUint32(),
        };

        const modeColorCount = parser.readUint16();
        mode.colors = [];
        for (let j = 0; j < modeColorCount; j++) {
          mode.colors.push(parser.readRGBColor());
        }

        device.modes.push(mode);
        console.log(`OpenRGB: Mode ${i}: "${mode.name}" (${mode.colors.length} colors)`);
      }

      const zoneCount = parser.readUint16();
      console.log(`OpenRGB: Zones: ${zoneCount}`);

      for (let i = 0; i < zoneCount; i++) {
        const zone = {
          name: parser.readString(),
          type: parser.readUint32(),
          ledsMin: parser.readUint32(),
          ledsMax: parser.readUint32(),
          ledsCount: parser.readUint32(),
        };

        const matrixLength = parser.readUint16();
        if (matrixLength > 0) {
          zone.matrixHeight = parser.readUint32();
          zone.matrixWidth = parser.readUint32();
          const matrixDataLength = matrixLength - 8;
          if (matrixDataLength > 0) {
            parser.skip(matrixDataLength);
          }
        }

        device.zones.push(zone);
        console.log(`OpenRGB: Zone ${i}: "${zone.name}" (${zone.ledsCount} LEDs)`);
      }

      const ledCount = parser.readUint16();
      console.log(`OpenRGB: LEDs: ${ledCount}`);

      for (let i = 0; i < ledCount; i++) {
        const led = {
          name: parser.readString(),
          value: parser.readUint32(),
        };

        device.leds.push(led);
        console.log(`OpenRGB: LED ${i}: "${led.name}" (value: ${led.value})`);
      }

      const colorCount = parser.readUint16();
      console.log(`OpenRGB: Colors: ${colorCount}`);

      for (let i = 0; i < colorCount; i++) {
        const color = parser.readRGBColor();
        device.colors.push(color);
      }

      console.log(
        `OpenRGB: Successfully parsed device: ${device.name} with ${device.leds.length} LEDs`,
      );
      return device;
    } catch (e) {
      console.log(`OpenRGB: Error parsing device: ${e.message}`);
      console.log(`OpenRGB: Error occurred at offset ${parser.offset}`);

      if (parser.offset > 0) {
        const contextStart = Math.max(0, parser.offset - 20);
        const contextEnd = Math.min(data.byteLength, parser.offset + 20);
        const contextView = new Uint8Array(data, contextStart, contextEnd - contextStart);
        const contextHex = Array.from(contextView)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ');
        console.log(`OpenRGB: Context (${contextStart}-${contextEnd}): ${contextHex}`);
      }

      return device;
    }
  }
}
