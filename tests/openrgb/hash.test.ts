// @ts-ignore - provided by mock in test setup
import GLib from 'gi://GLib';
import { describe, expect, it } from 'vitest';
import { buildDeviceFingerprint, hashFingerprint } from '../../src/openrgb/hash.js';

describe('hash.ts', () => {
  describe('buildDeviceFingerprint', () => {
    it('builds a composite string with placeholders', () => {
      const fp = buildDeviceFingerprint({
        serial: null,
        location: undefined,
        name: null,
        ledCount: 5,
      });
      expect(fp).toBe('serial:false|loc:false|name:false|leds:5');
    });

    it('normalizes trimming, case and whitespace collapsing', () => {
      const fp = buildDeviceFingerprint({
        serial: '  ABCD1234  ',
        location: '  Rack   42  ',
        name: ' My   Device ',
        ledCount: 10,
      });
      expect(fp).toBe('abcd1234|rack 42|my device|leds:10');
    });

    it('treats all-zero serial as missing', () => {
      const zeroSerial = buildDeviceFingerprint({
        serial: '000000',
        location: null,
        name: 'X',
        ledCount: 1,
      });
      expect(zeroSerial.startsWith('serial:false')).toBe(true);
    });

    it('reflects LED count changes', () => {
      const fp1 = buildDeviceFingerprint({ serial: 's', location: 'l', name: 'n', ledCount: 5 });
      const fp2 = buildDeviceFingerprint({ serial: 's', location: 'l', name: 'n', ledCount: 6 });
      expect(fp1).not.toBe(fp2);
      expect(fp1.replace(/leds:\d+$/, '')).toBe(fp2.replace(/leds:\d+$/, ''));
    });
  });

  describe('hashFingerprint', () => {
    it('produces 16 hex chars', () => {
      const h = hashFingerprint('example-fingerprint', GLib);
      expect(h).toMatch(/^[0-9a-f]{16}$/);
    });

    it('is deterministic for same input', () => {
      const a = hashFingerprint('same-fp', GLib);
      const b = hashFingerprint('same-fp', GLib);
      expect(a).toBe(b);
    });

    it('changes when fingerprint changes', () => {
      const a = hashFingerprint('fp-A', GLib);
      const b = hashFingerprint('fp-B', GLib);
      expect(a).not.toBe(b);
    });

    it('throws if GLib returns empty hash', () => {
      const badGlib = { ChecksumType: { SHA256: 1 }, compute_checksum_for_string: () => '' };
      expect(() => hashFingerprint('x', badGlib as any)).toThrow(/returned empty hash/);
    });
  });
});
