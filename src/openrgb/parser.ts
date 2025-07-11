import { OpenRGBParseError } from './errors.js';
import type { RGBColor } from './types.js';

export class BinaryParser {
  private data: ArrayBuffer;
  private offset: number;

  constructor(data: ArrayBuffer, offset: number = 0) {
    this.data = data;
    this.offset = offset;
  }

  readUint32(): number {
    if (this.offset + 4 > this.data.byteLength) {
      throw new OpenRGBParseError(
        `Cannot read Uint32 at offset ${this.offset}, buffer size: ${this.data.byteLength}`,
        this.offset,
        this.data.byteLength
      );
    }
    const view = new DataView(this.data);
    const value = view.getUint32(this.offset, true);
    this.offset += 4;
    return value;
  }

  readUint16(): number {
    if (this.offset + 2 > this.data.byteLength) {
      throw new OpenRGBParseError(
        `Cannot read Uint16 at offset ${this.offset}, buffer size: ${this.data.byteLength}`,
        this.offset,
        this.data.byteLength
      );
    }
    const view = new DataView(this.data);
    const value = view.getUint16(this.offset, true);
    this.offset += 2;
    return value;
  }

  readString(): string {
    const length = this.readUint16();
    if (this.offset + length > this.data.byteLength) {
      throw new OpenRGBParseError(
        `Cannot read string of length ${length} at offset ${this.offset}, buffer size: ${this.data.byteLength}`,
        this.offset,
        this.data.byteLength
      );
    }

    const bytes = new Uint8Array(this.data, this.offset, length);
    const decoder = new TextDecoder('utf-8');
    const result = decoder.decode(bytes);
    this.offset += length;
    return result;
  }

  readRGBColor(): RGBColor {
    if (this.offset + 4 > this.data.byteLength) {
      throw new OpenRGBParseError(
        `Cannot read RGBColor at offset ${this.offset}, buffer size: ${this.data.byteLength}`,
        this.offset,
        this.data.byteLength
      );
    }

    const view = new DataView(this.data);
    const color: RGBColor = {
      r: view.getUint8(this.offset),
      g: view.getUint8(this.offset + 1),
      b: view.getUint8(this.offset + 2),
      a: view.getUint8(this.offset + 3),
    };
    this.offset += 4;
    return color;
  }

  skip(bytes: number): void {
    if (this.offset + bytes > this.data.byteLength) {
      throw new OpenRGBParseError(
        `Cannot skip ${bytes} bytes at offset ${this.offset}, buffer size: ${this.data.byteLength}`,
        this.offset,
        this.data.byteLength
      );
    }
    this.offset += bytes;
  }

  hasMoreData(): boolean {
    return this.offset < this.data.byteLength;
  }

  getCurrentOffset(): number {
    return this.offset;
  }

  getRemainingBytes(): number {
    return this.data.byteLength - this.offset;
  }
}
