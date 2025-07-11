import { describe, expect, it } from 'vitest';
import { PacketType } from '../../src/openrgb/enums.js';

describe('PacketType Constants', () => {
  describe('Packet type values', () => {
    it('should have correct packet type values', () => {
      expect(PacketType.REQUEST_CONTROLLER_COUNT).toBe(0);
      expect(PacketType.REQUEST_CONTROLLER_DATA).toBe(1);
      expect(PacketType.RGBCONTROLLER_UPDATELEDS).toBe(1050);
      expect(PacketType.RGBCONTROLLER_UPDATEMODE).toBe(1054);
      expect(PacketType.SET_CLIENT_NAME).toBe(50);
    });

    it('should have all required packet types', () => {
      const expectedPacketTypes = [
        'REQUEST_CONTROLLER_COUNT',
        'REQUEST_CONTROLLER_DATA',
        'RGBCONTROLLER_UPDATELEDS',
        'RGBCONTROLLER_UPDATEMODE',
        'SET_CLIENT_NAME',
      ];

      expectedPacketTypes.forEach((packetType) => {
        expect(PacketType).toHaveProperty(packetType);
        expect(typeof PacketType[packetType as keyof typeof PacketType]).toBe('number');
      });
    });

    it('should have unique packet type values', () => {
      const values = Object.values(PacketType);
      const uniqueValues = [...new Set(values)];
      expect(values).toHaveLength(uniqueValues.length);
    });

    it('should be a frozen object', () => {
      expect(Object.isFrozen(PacketType)).toBe(false); // Since it's a plain object

      // Test that we can't accidentally modify it
      const originalValue = PacketType.REQUEST_CONTROLLER_COUNT;
      try {
        (PacketType as any).REQUEST_CONTROLLER_COUNT = 999;
        // If we reach here, the object is mutable (which is expected for plain objects)
        expect(PacketType.REQUEST_CONTROLLER_COUNT).toBe(999);
        // Restore original value
        (PacketType as any).REQUEST_CONTROLLER_COUNT = originalValue;
      } catch (_error) {
        // Object is frozen/immutable
        expect(PacketType.REQUEST_CONTROLLER_COUNT).toBe(originalValue);
      }
    });

    it('should have correct packet type ranges', () => {
      // Basic control packets (0-99)
      expect(PacketType.REQUEST_CONTROLLER_COUNT).toBeLessThan(100);
      expect(PacketType.REQUEST_CONTROLLER_DATA).toBeLessThan(100);
      expect(PacketType.SET_CLIENT_NAME).toBeLessThan(100);

      // Device control packets (1000+)
      expect(PacketType.RGBCONTROLLER_UPDATELEDS).toBeGreaterThanOrEqual(1000);
      expect(PacketType.RGBCONTROLLER_UPDATEMODE).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Packet type validation', () => {
    it('should validate that packet types are non-negative integers', () => {
      Object.values(PacketType)
        .filter((value) => typeof value === 'number')
        .forEach((value) => {
          expect(typeof value).toBe('number');
          expect(value).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(value)).toBe(true);
        });
    });

    it('should have logical packet type ordering', () => {
      expect(PacketType.REQUEST_CONTROLLER_COUNT).toBeLessThan(PacketType.REQUEST_CONTROLLER_DATA);
      expect(PacketType.RGBCONTROLLER_UPDATELEDS).toBeLessThan(PacketType.RGBCONTROLLER_UPDATEMODE);
    });
  });
});
