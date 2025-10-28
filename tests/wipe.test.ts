import { beforeEach, describe, expect, it } from 'vitest';

// We cannot instantiate the real GNOME extension class in Node tests (GJS only), so we isolate the wipe logic.
// Extract the logic from enable() into a small test harness that mimics the settings interactions.

interface MockSettings {
  get_boolean(key: string): boolean;
  set_boolean(key: string, value: boolean): void;
  get_strv(key: string): string[];
  set_strv(key: string, value: string[]): void;
}

class InMemorySettings implements MockSettings {
  private store: Record<string, any> = {
    'ignored-devices-migrated': false,
    'ignored-devices': [],
  };
  get_boolean(key: string): boolean {
    return !!this.store[key];
  }
  set_boolean(key: string, value: boolean): void {
    this.store[key] = value;
  }
  get_strv(key: string): string[] {
    return Array.isArray(this.store[key]) ? [...this.store[key]] : [];
  }
  set_strv(key: string, value: string[]): void {
    this.store[key] = [...value];
  }
}

function runWipeRoutine(settings: MockSettings): { wiped: number } {
  let wiped = 0;
  try {
    if (!settings.get_boolean('ignored-devices-migrated')) {
      const existingIgnored = settings.get_strv('ignored-devices');
      if (existingIgnored.length > 0) {
        wiped = existingIgnored.length;
        settings.set_strv('ignored-devices', []);
      }
      settings.set_boolean('ignored-devices-migrated', true);
    }
  } catch {
    // swallow for test; return wiped count
  }
  return { wiped };
}

describe('Ignored Devices Wipe Logic', () => {
  let settings: InMemorySettings;

  beforeEach(() => {
    settings = new InMemorySettings();
    settings.set_boolean('ignored-devices-migrated', false);
    settings.set_strv('ignored-devices', [
      JSON.stringify({ stableId: 'abc', name: 'X', ledCount: 1 }),
    ]);
  });

  it('wipes ignored devices list on first run when not migrated', () => {
    expect(settings.get_boolean('ignored-devices-migrated')).toBe(false);
    expect(settings.get_strv('ignored-devices').length).toBe(1);
    const result = runWipeRoutine(settings);
    expect(result.wiped).toBe(1);
    expect(settings.get_boolean('ignored-devices-migrated')).toBe(true);
    expect(settings.get_strv('ignored-devices').length).toBe(0);
  });

  it('does not wipe again once migrated', () => {
    runWipeRoutine(settings); // first run
    expect(settings.get_strv('ignored-devices').length).toBe(0);
    // Add a new ignored device after migration
    settings.set_strv('ignored-devices', [
      JSON.stringify({ stableId: 'def', name: 'Y', ledCount: 2 }),
    ]);
    const before = settings.get_strv('ignored-devices').length;
    const result = runWipeRoutine(settings); // second run
    expect(result.wiped).toBe(0);
    expect(settings.get_boolean('ignored-devices-migrated')).toBe(true);
    expect(settings.get_strv('ignored-devices').length).toBe(before);
  });
});
