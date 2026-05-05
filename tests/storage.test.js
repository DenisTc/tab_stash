import { describe, it, expect } from 'vitest';
import { loadStorage, saveStorage, CURRENT_SCHEMA_VERSION } from '../sidepanel/lib/storage.js';
import { createFolder, renameFolder, deleteFolder, getFolder } from '../sidepanel/lib/storage.js';

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

describe('folder CRUD', () => {
  it('createFolder adds a folder with uuid id and timestamps', async () => {
    const folder = await createFolder('Work');
    expect(folder.name).toBe('Work');
    expect(folder.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(folder.createdAt).toBeGreaterThan(0);
    expect(folder.updatedAt).toBe(folder.createdAt);
    expect(folder.tabs).toEqual([]);

    const data = await loadStorage();
    expect(data.folders).toHaveLength(1);
    expect(data.folders[0].id).toBe(folder.id);
  });

  it('createFolder rejects empty / whitespace-only names', async () => {
    await expect(createFolder('')).rejects.toThrow(/empty/i);
    await expect(createFolder('   ')).rejects.toThrow(/empty/i);
  });

  it('createFolder rejects duplicate names (case-sensitive)', async () => {
    await createFolder('Work');
    await expect(createFolder('Work')).rejects.toThrow(/exists/i);
    // Different case is allowed (case-sensitive).
    await expect(createFolder('work')).resolves.toBeDefined();
  });

  it('renameFolder updates name and updatedAt', async () => {
    const f = await createFolder('Old');
    const original = f.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    const renamed = await renameFolder(f.id, 'New');
    expect(renamed.name).toBe('New');
    expect(renamed.updatedAt).toBeGreaterThan(original);
  });

  it('renameFolder rejects rename to existing name', async () => {
    await createFolder('A');
    const b = await createFolder('B');
    await expect(renameFolder(b.id, 'A')).rejects.toThrow(/exists/i);
  });

  it('deleteFolder removes by id', async () => {
    const f = await createFolder('Doomed');
    await deleteFolder(f.id);
    const data = await loadStorage();
    expect(data.folders).toHaveLength(0);
  });

  it('getFolder returns the folder by id, or null', async () => {
    const f = await createFolder('X');
    expect((await getFolder(f.id))?.name).toBe('X');
    expect(await getFolder('nonexistent')).toBeNull();
  });
});
