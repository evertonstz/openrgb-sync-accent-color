export interface RGBColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface DeviceMode {
  name: string;
  value: number;
  flags: number;
  speedMin: number;
  speedMax: number;
  colorsMin: number;
  colorsMax: number;
  speed: number;
  direction: number;
  colorMode: number;
  colors: RGBColor[];
}

export interface DeviceZone {
  name: string;
  type: number;
  ledsMin: number;
  ledsMax: number;
  ledsCount: number;
  matrixHeight?: number;
  matrixWidth?: number;
}

export interface DeviceLED {
  name: string;
  value: number;
}