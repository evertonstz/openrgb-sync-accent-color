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
      throw new Error(
        `Cannot read Uint32 at offset ${this.offset}, buffer size: ${this.data.byteLength}`,
      );
    }
    const view = new DataView(this.data, this.offset, 4);
    const value = view.getUint32(0, true);
    this.offset += 4;
    return value;
  }

  readUint16(): number {
    if (this.offset + 2 > this.data.byteLength) {
      throw new Error(
        `Cannot read Uint16 at offset ${this.offset}, buffer size: ${this.data.byteLength}`,
      );
    }
    const view = new DataView(this.data, this.offset, 2);
    const value = view.getUint16(0, true);
    this.offset += 2;
    return value;
  }

  readString(): string {
    const length = this.readUint16();
    if (length === 0) return '';

    if (this.offset + length > this.data.byteLength) {
      throw new Error(
        `Cannot read string of length ${length} at offset ${this.offset}, buffer size: ${this.data.byteLength}`,
      );
    }

    const bytes = new Uint8Array(this.data, this.offset, length);
    this.offset += length;
    return new TextDecoder().decode(bytes);
  }

  readRGBColor(): RGBColor {
    if (this.offset + 4 > this.data.byteLength) {
      throw new Error(
        `Cannot read RGBColor at offset ${this.offset}, buffer size: ${this.data.byteLength}`,
      );
    }

    const r = new DataView(this.data, this.offset, 1).getUint8(0);
    const g = new DataView(this.data, this.offset + 1, 1).getUint8(0);
    const b = new DataView(this.data, this.offset + 2, 1).getUint8(0);
    const a = new DataView(this.data, this.offset + 3, 1).getUint8(0);

    this.offset += 4;
    return { r, g, b, a };
  }

  skip(bytes: number): void {
    if (this.offset + bytes > this.data.byteLength) {
      throw new Error(
        `Cannot skip ${bytes} bytes at offset ${this.offset}, buffer size: ${this.data.byteLength}`,
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

  getDataLength(): number {
    return this.data.byteLength;
  }

  getRemainingBytes(): number {
    return this.data.byteLength - this.offset;
  }
}