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
