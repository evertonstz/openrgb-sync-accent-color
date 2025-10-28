// GLib is available at runtime inside GNOME (GJS). In the test environment this import will fail type checking
// unless ambient declarations are provided; we rely on a loose any typing fallback when absent.
// eslint-disable-next-line @typescript-eslint/no-var-requires
// @ts-ignore - Provided by GJS at runtime
import GLib from 'gi://GLib';

/**
 * Hash a fingerprint string using GLib SHA-256.
 * Returns first 16 hex characters of SHA-256.
 */
export function hashFingerprint(fingerprint: string, glibOverride?: typeof GLib): string {
  const glibInstance = glibOverride ?? GLib;

  const full = glibInstance.compute_checksum_for_string(
    glibInstance.ChecksumType.SHA256,
    fingerprint,
    fingerprint.length,
  );

  if (!full) {
    throw new Error('hashFingerprint: GLib returned empty hash');
  }

  return full.slice(0, 16);
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
