import { describe, it, expect } from 'vitest';
import { loadStorage, saveStorage, CURRENT_SCHEMA_VERSION } from '../sidepanel/lib/storage.js';

describe('storage load/save', () => {
  it('returns an empty default when storage is uninitialised', async () => {
    const data = await loadStorage();
    expect(data).toEqual({ schemaVersion: CURRENT_SCHEMA_VERSION, folders: [] });
  });

  it('saves and reloads data round-trip', async () => {
    await saveStorage({ schemaVersion: CURRENT_SCHEMA_VERSION, folders: [{ id: 'f1', name: 'Work', createdAt: 1, updatedAt: 1, tabs: [] }] });
    const data = await loadStorage();
    expect(data.folders).toHaveLength(1);
    expect(data.folders[0].name).toBe('Work');
  });
});
