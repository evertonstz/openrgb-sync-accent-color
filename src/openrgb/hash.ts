// GLib is available at runtime inside GNOME (GJS). In the test environment this import will fail type checking
// unless ambient declarations are provided; we rely on a loose any typing fallback when absent.
// eslint-disable-next-line @typescript-eslint/no-var-requires
// @ts-ignore - Provided by GJS at runtime
import GLib from 'gi://GLib';

/**
 * Hash a fingerprint string using preferred backend (GLib in GNOME, Node crypto in tests).
 * Returns first 16 hex characters of SHA-256.
 * Throws if no viable backend is available.
 */
export function hashFingerprint(fingerprint: string): string {
  // GNOME / GJS path
  if (GLib?.ChecksumType?.SHA256 !== undefined) {
    try {
      const full = GLib.compute_checksum_for_string(
        GLib.ChecksumType.SHA256,
        fingerprint,
        fingerprint.length,
      );
      if (full) return full.slice(0, 16);
    } catch {
      // fall through to node crypto
    }
  }

  // Node / test environment path
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('node:crypto');
    return crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 16);
  } catch {
    throw new Error('hashFingerprint: No hashing backend available');
  }
}

/** Build the deterministic fingerprint string from device attributes */
export function buildDeviceFingerprint(parts: {
  serial?: string | null;
  location?: string | null;
  name?: string | null;
  ledCount: number;
}): string {
  const norm = (v: string | undefined | null, placeholder: string) => {
    if (!v) return placeholder;
    const trimmed = v.trim().toLowerCase();
    if (trimmed === '' || /^0+$/.test(trimmed)) return placeholder; // treat zero serial as missing
    return trimmed.replace(/\s+/g, ' ');
  };
  const serial = norm(parts.serial, 'serial:false');
  const location = norm(parts.location, 'loc:false');
  const name = norm(parts.name, 'name:false');
  const leds = `leds:${parts.ledCount}`;
  return `${serial}|${location}|${name}|${leds}`;
}
