import { uuid } from './uuid.js';

export const CURRENT_SCHEMA_VERSION = 1;
const STORAGE_KEY = 'data';

function emptyStorage() {
  return { schemaVersion: CURRENT_SCHEMA_VERSION, folders: [] };
}

export async function loadStorage() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const data = result[STORAGE_KEY];
  if (!data) return emptyStorage();
  return migrate(data);
}

export async function saveStorage(data) {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

function migrate(data) {
  // Currently only schema v1 exists. Future: chain `migrate_1_to_2` etc.
  return { schemaVersion: CURRENT_SCHEMA_VERSION, ...data };
}

function findFolder(folders, id) {
  return folders.find((f) => f.id === id) ?? null;
}

function nameExists(folders, name, exceptId = null) {
  return folders.some((f) => f.name === name && f.id !== exceptId);
}

export async function createFolder(name) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Folder name cannot be empty');
  const data = await loadStorage();
  if (nameExists(data.folders, trimmed)) {
    throw new Error(`Folder '${trimmed}' already exists`);
  }
  const now = Date.now();
  const folder = {
    id: uuid(),
    name: trimmed,
    createdAt: now,
    updatedAt: now,
    tabs: [],
  };
  data.folders.unshift(folder);
  await saveStorage(data);
  return folder;
}

export async function renameFolder(id, name) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Folder name cannot be empty');
  const data = await loadStorage();
  const folder = findFolder(data.folders, id);
  if (!folder) throw new Error('Folder not found');
  if (nameExists(data.folders, trimmed, id)) {
    throw new Error(`Folder '${trimmed}' already exists`);
  }
  folder.name = trimmed;
  folder.updatedAt = Date.now();
  await saveStorage(data);
  return folder;
}

export async function deleteFolder(id) {
  const data = await loadStorage();
  const idx = data.folders.findIndex((f) => f.id === id);
  if (idx === -1) throw new Error('Folder not found');
  data.folders.splice(idx, 1);
  await saveStorage(data);
}

export async function getFolder(id) {
  const data = await loadStorage();
  return findFolder(data.folders, id);
}

export async function addTabsToFolder(folderId, tabsInput) {
  const data = await loadStorage();
  const folder = findFolder(data.folders, folderId);
  if (!folder) throw new Error('Folder not found');

  const existingUrls = new Set(folder.tabs.map((t) => t.url));
  const now = Date.now();
  let added = 0;
  let skipped = 0;
  const newTabs = [];
  for (const t of tabsInput) {
    if (existingUrls.has(t.url)) {
      skipped++;
      continue;
    }
    existingUrls.add(t.url);
    newTabs.push({
      id: uuid(),
      title: t.title ?? '',
      url: t.url,
      favIconUrl: t.favIconUrl,
      savedAt: now,
    });
    added++;
  }
  // Newest first.
  folder.tabs = [...newTabs, ...folder.tabs];
  folder.updatedAt = now;
  await saveStorage(data);
  return { added, skipped };
}

export async function removeTab(folderId, tabId) {
  const data = await loadStorage();
  const folder = findFolder(data.folders, folderId);
  if (!folder) throw new Error('Folder not found');
  const idx = folder.tabs.findIndex((t) => t.id === tabId);
  if (idx === -1) throw new Error('Tab not found');
  folder.tabs.splice(idx, 1);
  folder.updatedAt = Date.now();
  await saveStorage(data);
}
