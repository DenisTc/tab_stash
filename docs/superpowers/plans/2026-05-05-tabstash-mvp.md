# TabStash MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension (Manifest V3) that lets the user select open tabs, save them into named folders, browse them in a Side Panel, copy as plain text, and reopen them.

**Architecture:** Side Panel as the only UI. Vanilla JS (ES modules) — no bundler, no framework. Logic lives in pure modules under `sidepanel/lib/` (unit-tested with Vitest, with `chrome.*` mocked). Views under `sidepanel/views/` import lib modules and render DOM. A single hash-based router toggles views.

**Tech Stack:** Manifest V3, `chrome.sidePanel`, `chrome.storage.local`, `chrome.tabs`, vanilla JS (ES2022), HTML, CSS with custom properties. Dev: Vitest + happy-dom for tests. Spec: [`docs/superpowers/specs/2026-05-05-tabstash-design.md`](../specs/2026-05-05-tabstash-design.md).

---

## File Structure

```
tab_stash/
├── manifest.json
├── background.js
├── package.json
├── vitest.config.js
├── tests/
│   ├── setup.js                    # chrome.* mocks
│   ├── storage.test.js
│   ├── format.test.js
│   ├── tabs.test.js
│   └── uuid.test.js
├── sidepanel/
│   ├── sidepanel.html
│   ├── sidepanel.css
│   ├── sidepanel.js                # router
│   ├── lib/
│   │   ├── uuid.js
│   │   ├── storage.js
│   │   ├── tabs.js
│   │   ├── format.js
│   │   └── toast.js
│   └── views/
│       ├── library.js
│       ├── folder.js
│       └── save.js
├── icons/                          # placeholder PNGs (16/32/48/128)
└── docs/superpowers/
    ├── specs/
    │   ├── 2026-05-05-tabstash-design.md
    │   └── manual-smoke-test.md
    └── plans/
        └── 2026-05-05-tabstash-mvp.md
```

**Responsibilities:**

- `lib/storage.js` — single owner of `chrome.storage.local`. All folder/tab CRUD goes through here.
- `lib/tabs.js` — wraps `chrome.tabs` queries and mutations.
- `lib/format.js` — plain-text formatting + clipboard.
- `lib/uuid.js` — wraps `crypto.randomUUID`.
- `lib/toast.js` — notification + undo timer.
- `views/*` — DOM only, take state from lib, react to user input.
- `sidepanel.js` — listens to `hashchange`, mounts the right view into `#app`.

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `vitest.config.js`
- Create: `tests/setup.js`
- Modify: `.gitignore` (add npm/test artefacts)

- [ ] **Step 1.1: Create `package.json`**

```json
{
  "name": "tab-stash",
  "version": "0.1.0",
  "description": "Save selected Chrome tabs to named folders.",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^1.6.0",
    "happy-dom": "^14.0.0"
  }
}
```

- [ ] **Step 1.2: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
  },
});
```

- [ ] **Step 1.3: Create `tests/setup.js`** — minimal `chrome.*` mock backed by an in-memory map. Reset between tests.

```js
import { beforeEach, vi } from 'vitest';

const storageBacking = new Map();

globalThis.chrome = {
  storage: {
    local: {
      get: vi.fn(async (key) => {
        if (typeof key === 'string') {
          return storageBacking.has(key) ? { [key]: storageBacking.get(key) } : {};
        }
        if (Array.isArray(key)) {
          const out = {};
          for (const k of key) {
            if (storageBacking.has(k)) out[k] = storageBacking.get(k);
          }
          return out;
        }
        return Object.fromEntries(storageBacking.entries());
      }),
      set: vi.fn(async (obj) => {
        for (const [k, v] of Object.entries(obj)) storageBacking.set(k, v);
      }),
      remove: vi.fn(async (keys) => {
        const arr = Array.isArray(keys) ? keys : [keys];
        for (const k of arr) storageBacking.delete(k);
      }),
      clear: vi.fn(async () => storageBacking.clear()),
    },
  },
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
  windows: {
    create: vi.fn(),
    WINDOW_ID_CURRENT: -2,
  },
  sidePanel: {
    setPanelBehavior: vi.fn(),
  },
  runtime: {
    onInstalled: { addListener: vi.fn() },
  },
};

// Make storageBacking accessible to tests for assertions/seeding.
globalThis.__storageBacking = storageBacking;

beforeEach(() => {
  storageBacking.clear();
  vi.clearAllMocks();
});
```

- [ ] **Step 1.4: Update `.gitignore`** — append npm/vitest noise.

Add to existing `.gitignore`:

```
# Node / Vitest
node_modules/
coverage/
.vitest/
```

- [ ] **Step 1.5: Install deps**

```bash
npm install
```

Expected: lockfile created, `node_modules/` populated. No errors.

- [ ] **Step 1.6: Verify Vitest runs (no tests yet)**

```bash
npm test
```

Expected: `No test files found` — that's fine for now, exits 1 in some Vitest versions. As long as Vitest itself loads without crash, the scaffold is good.

- [ ] **Step 1.7: Commit**

```bash
git add package.json package-lock.json vitest.config.js tests/setup.js .gitignore
git commit -m "chore: scaffold vitest + chrome.* test mocks"
```

---

## Task 2: `lib/uuid.js`

**Files:**
- Create: `sidepanel/lib/uuid.js`
- Create: `tests/uuid.test.js`

- [ ] **Step 2.1: Write the failing test**

`tests/uuid.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { uuid } from '../sidepanel/lib/uuid.js';

describe('uuid', () => {
  it('returns a v4-formatted UUID string', () => {
    const id = uuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('returns unique values on repeated calls', () => {
    const ids = new Set(Array.from({ length: 100 }, uuid));
    expect(ids.size).toBe(100);
  });
});
```

- [ ] **Step 2.2: Run test, verify it fails**

```bash
npm test -- tests/uuid.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 2.3: Implement `sidepanel/lib/uuid.js`**

```js
export function uuid() {
  return crypto.randomUUID();
}
```

- [ ] **Step 2.4: Run test, verify it passes**

```bash
npm test -- tests/uuid.test.js
```

Expected: PASS (2 tests).

- [ ] **Step 2.5: Commit**

```bash
git add sidepanel/lib/uuid.js tests/uuid.test.js
git commit -m "feat(lib): add uuid wrapper"
```

---

## Task 3: `lib/storage.js` — load/save and schema

**Files:**
- Create: `sidepanel/lib/storage.js`
- Create: `tests/storage.test.js`

- [ ] **Step 3.1: Write failing tests**

`tests/storage.test.js`:

```js
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
```

- [ ] **Step 3.2: Run tests, verify failure**

```bash
npm test -- tests/storage.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3.3: Implement initial `sidepanel/lib/storage.js`**

```js
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
```

- [ ] **Step 3.4: Run tests, verify pass**

```bash
npm test -- tests/storage.test.js
```

Expected: PASS (2 tests).

- [ ] **Step 3.5: Commit**

```bash
git add sidepanel/lib/storage.js tests/storage.test.js
git commit -m "feat(lib): storage load/save with schema versioning"
```

---

## Task 4: `lib/storage.js` — folder CRUD

**Files:**
- Modify: `sidepanel/lib/storage.js`
- Modify: `tests/storage.test.js`

- [ ] **Step 4.1: Append failing tests for folder CRUD**

Add to `tests/storage.test.js`:

```js
import { createFolder, renameFolder, deleteFolder, getFolder } from '../sidepanel/lib/storage.js';

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
```

- [ ] **Step 4.2: Run tests, verify failure**

```bash
npm test -- tests/storage.test.js
```

Expected: FAIL — `createFolder is not a function`, etc.

- [ ] **Step 4.3: Append folder CRUD to `sidepanel/lib/storage.js`**

```js
import { uuid } from './uuid.js';

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
```

- [ ] **Step 4.4: Run tests, verify pass**

```bash
npm test -- tests/storage.test.js
```

Expected: all folder CRUD tests PASS.

- [ ] **Step 4.5: Commit**

```bash
git add sidepanel/lib/storage.js tests/storage.test.js
git commit -m "feat(lib): folder create/rename/delete/get with name uniqueness"
```

---

## Task 5: `lib/storage.js` — tab operations

**Files:**
- Modify: `sidepanel/lib/storage.js`
- Modify: `tests/storage.test.js`

- [ ] **Step 5.1: Append failing tests for tab operations**

Add to `tests/storage.test.js`:

```js
import { addTabsToFolder, removeTab } from '../sidepanel/lib/storage.js';

describe('tab operations', () => {
  it('addTabsToFolder appends tabs with generated id and savedAt', async () => {
    const f = await createFolder('Work');
    const result = await addTabsToFolder(f.id, [
      { title: 'A', url: 'https://a.com/' },
      { title: 'B', url: 'https://b.com/' },
    ]);
    expect(result.added).toBe(2);
    expect(result.skipped).toBe(0);
    const after = await getFolder(f.id);
    expect(after.tabs).toHaveLength(2);
    expect(after.tabs[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(after.tabs[0].savedAt).toBeGreaterThan(0);
  });

  it('addTabsToFolder dedupes by URL within the folder', async () => {
    const f = await createFolder('Work');
    await addTabsToFolder(f.id, [{ title: 'A', url: 'https://a.com/' }]);
    const result = await addTabsToFolder(f.id, [
      { title: 'A duplicate', url: 'https://a.com/' },
      { title: 'B', url: 'https://b.com/' },
    ]);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);
    const after = await getFolder(f.id);
    expect(after.tabs).toHaveLength(2);
  });

  it('addTabsToFolder updates folder updatedAt', async () => {
    const f = await createFolder('Work');
    const original = f.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    await addTabsToFolder(f.id, [{ title: 'A', url: 'https://a.com/' }]);
    const after = await getFolder(f.id);
    expect(after.updatedAt).toBeGreaterThan(original);
  });

  it('addTabsToFolder throws for unknown folder', async () => {
    await expect(addTabsToFolder('nope', [{ title: 'A', url: 'https://a.com/' }])).rejects.toThrow(/not found/i);
  });

  it('removeTab removes by tab id', async () => {
    const f = await createFolder('Work');
    await addTabsToFolder(f.id, [
      { title: 'A', url: 'https://a.com/' },
      { title: 'B', url: 'https://b.com/' },
    ]);
    const folderBefore = await getFolder(f.id);
    const targetId = folderBefore.tabs[0].id;
    await removeTab(f.id, targetId);
    const folderAfter = await getFolder(f.id);
    expect(folderAfter.tabs).toHaveLength(1);
    expect(folderAfter.tabs.find((t) => t.id === targetId)).toBeUndefined();
  });
});
```

- [ ] **Step 5.2: Run tests, verify failure**

```bash
npm test -- tests/storage.test.js
```

Expected: FAIL — functions not exported.

- [ ] **Step 5.3: Append tab operations to `sidepanel/lib/storage.js`**

```js
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
```

- [ ] **Step 5.4: Run all tests**

```bash
npm test
```

Expected: all storage tests PASS.

- [ ] **Step 5.5: Commit**

```bash
git add sidepanel/lib/storage.js tests/storage.test.js
git commit -m "feat(lib): add/remove tabs with URL dedupe per folder"
```

---

## Task 6: `lib/format.js` — plain text + clipboard

**Files:**
- Create: `sidepanel/lib/format.js`
- Create: `tests/format.test.js`

- [ ] **Step 6.1: Write failing tests**

`tests/format.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { tabsToPlainText, copyTabsAsText } from '../sidepanel/lib/format.js';

describe('format', () => {
  it('tabsToPlainText returns one URL per line', () => {
    const out = tabsToPlainText([
      { title: 'A', url: 'https://a.com/' },
      { title: 'B', url: 'https://b.com/' },
    ]);
    expect(out).toBe('https://a.com/\nhttps://b.com/');
  });

  it('tabsToPlainText returns empty string for empty list', () => {
    expect(tabsToPlainText([])).toBe('');
  });

  it('copyTabsAsText writes joined URLs to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    globalThis.navigator = { clipboard: { writeText } };

    await copyTabsAsText([
      { title: 'A', url: 'https://a.com/' },
      { title: 'B', url: 'https://b.com/' },
    ]);

    expect(writeText).toHaveBeenCalledWith('https://a.com/\nhttps://b.com/');
  });

  it('copyTabsAsText throws when clipboard API absent', async () => {
    globalThis.navigator = {};
    await expect(copyTabsAsText([{ url: 'https://a.com/' }])).rejects.toThrow(/clipboard/i);
  });
});
```

- [ ] **Step 6.2: Run tests, verify failure**

```bash
npm test -- tests/format.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 6.3: Implement `sidepanel/lib/format.js`**

```js
export function tabsToPlainText(tabs) {
  return tabs.map((t) => t.url).join('\n');
}

export async function copyTabsAsText(tabs) {
  const text = tabsToPlainText(tabs);
  if (!navigator?.clipboard?.writeText) {
    throw new Error('Clipboard API unavailable');
  }
  await navigator.clipboard.writeText(text);
}
```

- [ ] **Step 6.4: Run tests, verify pass**

```bash
npm test -- tests/format.test.js
```

Expected: PASS (4 tests).

- [ ] **Step 6.5: Commit**

```bash
git add sidepanel/lib/format.js tests/format.test.js
git commit -m "feat(lib): plain-text format + clipboard copy"
```

---

## Task 7: `lib/tabs.js` — chrome.tabs wrapper

**Files:**
- Create: `sidepanel/lib/tabs.js`
- Create: `tests/tabs.test.js`

- [ ] **Step 7.1: Write failing tests**

`tests/tabs.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import {
  getCurrentWindowTabs,
  getHighlightedTabs,
  closeTabs,
  openTab,
  openTabsInCurrentWindow,
  openTabsInNewWindow,
} from '../sidepanel/lib/tabs.js';

describe('tabs wrapper', () => {
  it('getCurrentWindowTabs filters out pinned tabs', async () => {
    chrome.tabs.query.mockResolvedValueOnce([
      { id: 1, title: 'A', url: 'https://a.com/', pinned: false },
      { id: 2, title: 'P', url: 'https://p.com/', pinned: true },
      { id: 3, title: 'B', url: 'https://b.com/', pinned: false },
    ]);

    const tabs = await getCurrentWindowTabs();

    expect(chrome.tabs.query).toHaveBeenCalledWith({ currentWindow: true });
    expect(tabs.map((t) => t.id)).toEqual([1, 3]);
  });

  it('getHighlightedTabs returns highlighted non-pinned tabs from current window', async () => {
    chrome.tabs.query.mockResolvedValueOnce([
      { id: 1, title: 'A', url: 'https://a.com/', pinned: false, highlighted: true },
      { id: 2, title: 'B', url: 'https://b.com/', pinned: false, highlighted: true },
    ]);

    const tabs = await getHighlightedTabs();

    expect(chrome.tabs.query).toHaveBeenCalledWith({ currentWindow: true, highlighted: true });
    expect(tabs).toHaveLength(2);
  });

  it('closeTabs calls chrome.tabs.remove with all ids', async () => {
    chrome.tabs.remove.mockResolvedValueOnce(undefined);
    await closeTabs([10, 20, 30]);
    expect(chrome.tabs.remove).toHaveBeenCalledWith([10, 20, 30]);
  });

  it('closeTabs is a no-op for empty list', async () => {
    await closeTabs([]);
    expect(chrome.tabs.remove).not.toHaveBeenCalled();
  });

  it('openTab opens in background by default', async () => {
    chrome.tabs.create.mockResolvedValueOnce({ id: 99 });
    await openTab('https://x.com/');
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'https://x.com/', active: false });
  });

  it('openTabsInCurrentWindow opens many tabs as background', async () => {
    chrome.tabs.create.mockResolvedValue({ id: 1 });
    await openTabsInCurrentWindow(['https://a.com/', 'https://b.com/']);
    expect(chrome.tabs.create).toHaveBeenCalledTimes(2);
    expect(chrome.tabs.create).toHaveBeenNthCalledWith(1, { url: 'https://a.com/', active: false });
    expect(chrome.tabs.create).toHaveBeenNthCalledWith(2, { url: 'https://b.com/', active: false });
  });

  it('openTabsInNewWindow creates a new window with all urls', async () => {
    chrome.windows.create.mockResolvedValueOnce({ id: 5 });
    await openTabsInNewWindow(['https://a.com/', 'https://b.com/']);
    expect(chrome.windows.create).toHaveBeenCalledWith({ url: ['https://a.com/', 'https://b.com/'] });
  });
});
```

- [ ] **Step 7.2: Run tests, verify failure**

```bash
npm test -- tests/tabs.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 7.3: Implement `sidepanel/lib/tabs.js`**

```js
export async function getCurrentWindowTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs.filter((t) => !t.pinned);
}

export async function getHighlightedTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true, highlighted: true });
  return tabs.filter((t) => !t.pinned);
}

export async function closeTabs(tabIds) {
  if (!tabIds || tabIds.length === 0) return;
  await chrome.tabs.remove(tabIds);
}

export async function openTab(url) {
  await chrome.tabs.create({ url, active: false });
}

export async function openTabsInCurrentWindow(urls) {
  for (const url of urls) {
    await chrome.tabs.create({ url, active: false });
  }
}

export async function openTabsInNewWindow(urls) {
  await chrome.windows.create({ url: urls });
}
```

- [ ] **Step 7.4: Run tests, verify pass**

```bash
npm test -- tests/tabs.test.js
```

Expected: PASS (7 tests).

- [ ] **Step 7.5: Commit**

```bash
git add sidepanel/lib/tabs.js tests/tabs.test.js
git commit -m "feat(lib): chrome.tabs wrapper (query, close, open)"
```

---

## Task 8: `manifest.json`

**Files:**
- Create: `manifest.json`
- Create: `icons/icon-16.png`, `icons/icon-32.png`, `icons/icon-48.png`, `icons/icon-128.png` (placeholder, solid color is fine for MVP)

- [ ] **Step 8.1: Create `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "TabStash",
  "version": "0.1.0",
  "description": "Save selected Chrome tabs to named folders.",
  "permissions": ["tabs", "storage", "sidePanel", "clipboardWrite"],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_title": "TabStash",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "side_panel": {
    "default_path": "sidepanel/sidepanel.html"
  },
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

- [ ] **Step 8.2: Create placeholder icons**

Run from project root:

```bash
mkdir -p icons
# Generate solid blue 1×1 PNGs with sips. Replace with real assets later.
for size in 16 32 48 128; do
  python3 -c "
import struct, zlib
w=h=$size
def chunk(t,d):
    return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
sig=b'\x89PNG\r\n\x1a\n'
ihdr=struct.pack('>IIBBBBB',w,h,8,2,0,0,0)
raw=b''
for _ in range(h):
    raw+=b'\x00'+(b'\x25\x63\xeb')*w
idat=zlib.compress(raw)
data=sig+chunk(b'IHDR',ihdr)+chunk(b'IDAT',idat)+chunk(b'IEND',b'')
open('icons/icon-${size}.png','wb').write(data)
"
done
```

Expected: four PNG files in `icons/`. Solid blue squares — placeholder.

- [ ] **Step 8.3: Commit**

```bash
git add manifest.json icons/
git commit -m "feat: add Manifest V3 with side panel + placeholder icons"
```

---

## Task 9: `background.js` — open Side Panel on action click

**Files:**
- Create: `background.js`

- [ ] **Step 9.1: Implement `background.js`**

```js
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});
```

That's the entire service worker for MVP — the Side Panel API takes care of opening the configured panel page when the user clicks the toolbar icon.

- [ ] **Step 9.2: Commit**

```bash
git add background.js
git commit -m "feat: open side panel on toolbar icon click"
```

---

## Task 10: `sidepanel.html` + base CSS

**Files:**
- Create: `sidepanel/sidepanel.html`
- Create: `sidepanel/sidepanel.css`

- [ ] **Step 10.1: Create `sidepanel/sidepanel.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>TabStash</title>
    <link rel="stylesheet" href="sidepanel.css" />
  </head>
  <body>
    <header class="topbar">
      <div class="brand">TabStash</div>
      <nav class="tabs">
        <a class="tab" data-route="library" href="#/library">Library</a>
        <a class="tab" data-route="save" href="#/save">Save</a>
      </nav>
    </header>
    <main id="app"></main>
    <div id="toast-container"></div>
    <script type="module" src="sidepanel.js"></script>
  </body>
</html>
```

- [ ] **Step 10.2: Create `sidepanel/sidepanel.css`** with CSS variables for theming.

```css
:root {
  --bg: #fafafa;
  --surface: #ffffff;
  --border: #e5e5e5;
  --text: #222;
  --text-muted: #888;
  --text-subtle: #999;
  --accent: #2563eb;
  --accent-text: #ffffff;
  --danger: #dc2626;
  --radius: 6px;
  --gap-sm: 6px;
  --gap: 10px;
  --gap-lg: 14px;
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; height: 100%; }
body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 13px;
  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px var(--gap-lg);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.brand { font-weight: 600; font-size: 14px; }
.tabs { display: flex; gap: 2px; background: #f0f0f0; padding: 2px; border-radius: var(--radius); }
.tab {
  padding: 4px 10px;
  font-size: 12px;
  color: var(--text-muted);
  border-radius: 4px;
  text-decoration: none;
}
.tab.active {
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 1px 2px rgba(0,0,0,0.06);
}

#app { flex: 1; padding: var(--gap-lg); overflow-y: auto; }

.btn-primary {
  background: var(--accent);
  color: var(--accent-text);
  border: none;
  padding: 9px 14px;
  border-radius: var(--radius);
  font-weight: 500;
  width: 100%;
  cursor: pointer;
  font-size: 13px;
}
.btn-secondary {
  background: var(--surface);
  border: 1px solid var(--border);
  padding: 6px 10px;
  border-radius: var(--radius);
  font-size: 12px;
  cursor: pointer;
  color: var(--text);
}
.btn-secondary:hover { background: #f5f5f5; }

.input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 13px;
}

.section-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 var(--gap-sm) 0;
}

.folder-row {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
  margin-bottom: var(--gap-sm);
  cursor: pointer;
}
.folder-row:hover { background: #f5f5f5; }
.folder-name { font-weight: 500; }
.folder-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

.tab-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: var(--gap-sm);
  cursor: pointer;
  position: relative;
}
.tab-row:hover { background: #f5f5f5; }
.tab-row .delete-btn {
  display: none;
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: 0;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 16px;
}
.tab-row:hover .delete-btn { display: block; }
.favicon { width: 16px; height: 16px; flex-shrink: 0; margin-top: 2px; }
.tab-info { flex: 1; min-width: 0; }
.tab-title { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tab-url { font-size: 11px; color: var(--text-subtle); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.action-row {
  display: flex;
  gap: 6px;
  margin-bottom: var(--gap);
}
.action-row .btn-secondary { flex: 1; }

.checkrow { display: flex; align-items: center; gap: 8px; margin: var(--gap) 0; font-size: 12px; }
.checkbox { width: 14px; height: 14px; }

.empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

#toast-container {
  position: fixed;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 1000;
  pointer-events: none;
}
.toast {
  background: #222;
  color: #fff;
  padding: 8px 12px;
  border-radius: var(--radius);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  pointer-events: auto;
  animation: toast-in 150ms ease-out;
}
.toast button {
  background: transparent;
  color: #6ea8fe;
  border: 0;
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
}
@keyframes toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 500;
}
.modal {
  background: var(--surface);
  border-radius: 10px;
  padding: 16px;
  width: 90%;
  max-width: 320px;
  box-shadow: 0 12px 32px rgba(0,0,0,0.25);
}
.modal h3 { margin: 0 0 8px 0; font-size: 14px; }
.modal p { margin: 0 0 12px 0; font-size: 12px; color: var(--text-muted); }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
```

- [ ] **Step 10.3: Commit**

```bash
git add sidepanel/sidepanel.html sidepanel/sidepanel.css
git commit -m "feat(ui): side panel HTML shell + base styles"
```

---

## Task 11: `sidepanel.js` — hash router

**Files:**
- Create: `sidepanel/sidepanel.js`

- [ ] **Step 11.1: Implement the router**

```js
import { renderLibrary } from './views/library.js';
import { renderFolder } from './views/folder.js';
import { renderSave } from './views/save.js';

const app = document.getElementById('app');

function parseRoute() {
  // Forms: '#/library', '#/save', '#/folder/<id>'
  const hash = location.hash.replace(/^#\/?/, '');
  if (!hash) return { name: 'library' };
  const [head, id] = hash.split('/');
  if (head === 'folder' && id) return { name: 'folder', id };
  if (head === 'save') return { name: 'save' };
  return { name: 'library' };
}

function setActiveTab(name) {
  for (const tab of document.querySelectorAll('.tab')) {
    const isLibraryGroup = (name === 'library' || name === 'folder');
    tab.classList.toggle(
      'active',
      (tab.dataset.route === 'library' && isLibraryGroup) ||
      (tab.dataset.route === 'save' && name === 'save'),
    );
  }
}

async function render() {
  const route = parseRoute();
  setActiveTab(route.name);
  app.innerHTML = '';
  if (route.name === 'library') await renderLibrary(app);
  else if (route.name === 'folder') await renderFolder(app, route.id);
  else if (route.name === 'save') await renderSave(app);
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);

// Also re-render when storage changes (other windows / external).
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') render();
});
```

- [ ] **Step 11.2: Commit**

```bash
git add sidepanel/sidepanel.js
git commit -m "feat(ui): hash-based router for side panel views"
```

---

## Task 12: `lib/toast.js` — toast + undo

**Files:**
- Create: `sidepanel/lib/toast.js`

- [ ] **Step 12.1: Implement toast helper**

```js
const container = () => document.getElementById('toast-container');

export function showToast(message, opts = {}) {
  const { duration = 3000 } = opts;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container().appendChild(el);
  setTimeout(() => el.remove(), duration);
}

/**
 * Show an undoable toast. Returns a promise that resolves to true if
 * the user clicked "Undo" before the timer expired, otherwise false.
 */
export function showUndoToast(message, opts = {}) {
  const { duration = 5000 } = opts;
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'toast';
    const text = document.createElement('span');
    text.textContent = message;
    const btn = document.createElement('button');
    btn.textContent = 'Undo';
    el.appendChild(text);
    el.appendChild(btn);
    container().appendChild(el);

    const timer = setTimeout(() => {
      el.remove();
      resolve(false);
    }, duration);

    btn.addEventListener('click', () => {
      clearTimeout(timer);
      el.remove();
      resolve(true);
    });
  });
}
```

> **Note:** Toast is DOM-coupled, so we don't unit-test it directly — the manual smoke-test checklist (Task 17) covers the visible behaviour. If you want a happy-dom test for this in the future, fine — but not for MVP.

- [ ] **Step 12.2: Commit**

```bash
git add sidepanel/lib/toast.js
git commit -m "feat(ui): toast + undoable toast helpers"
```

---

## Task 13: `views/library.js` — folder list

**Files:**
- Create: `sidepanel/views/library.js`

- [ ] **Step 13.1: Implement library view**

```js
import { loadStorage } from '../lib/storage.js';

function timeAgo(ts) {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export async function renderLibrary(root) {
  const data = await loadStorage();

  const saveBtn = document.createElement('a');
  saveBtn.href = '#/save';
  saveBtn.className = 'btn-primary';
  saveBtn.textContent = '+ Save current tabs';
  saveBtn.style.display = 'block';
  saveBtn.style.textAlign = 'center';
  saveBtn.style.textDecoration = 'none';
  saveBtn.style.marginBottom = '14px';
  root.appendChild(saveBtn);

  const sectionTitle = document.createElement('div');
  sectionTitle.className = 'section-title';
  sectionTitle.textContent = `Folders · ${data.folders.length}`;
  root.appendChild(sectionTitle);

  if (data.folders.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No folders yet. Save some tabs to get started.';
    root.appendChild(empty);
    return;
  }

  for (const folder of data.folders) {
    const row = document.createElement('a');
    row.href = `#/folder/${folder.id}`;
    row.className = 'folder-row';
    row.style.display = 'block';
    row.style.textDecoration = 'none';
    row.style.color = 'inherit';

    const name = document.createElement('div');
    name.className = 'folder-name';
    name.textContent = folder.name;

    const meta = document.createElement('div');
    meta.className = 'folder-meta';
    meta.textContent = `${folder.tabs.length} tabs · updated ${timeAgo(folder.updatedAt)}`;

    row.appendChild(name);
    row.appendChild(meta);
    root.appendChild(row);
  }
}
```

- [ ] **Step 13.2: Commit**

```bash
git add sidepanel/views/library.js
git commit -m "feat(ui): library view — folder list"
```

---

## Task 14: `views/folder.js` — folder detail

**Files:**
- Create: `sidepanel/views/folder.js`

- [ ] **Step 14.1: Implement folder detail view**

```js
import { getFolder, removeTab as storageRemoveTab, deleteFolder, renameFolder, addTabsToFolder } from '../lib/storage.js';
import { openTab, openTabsInCurrentWindow, openTabsInNewWindow } from '../lib/tabs.js';
import { copyTabsAsText } from '../lib/format.js';
import { showToast, showUndoToast } from '../lib/toast.js';

const OPEN_ALL_THRESHOLD = 20;

function showOpenAllModal(tabs) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    const title = document.createElement('h3');
    title.textContent = `Open ${tabs.length} tabs?`;
    const desc = document.createElement('p');
    desc.textContent = tabs.length > OPEN_ALL_THRESHOLD
      ? `That's a lot of tabs. Choose where to open them.`
      : `Choose where to open them.`;

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn-secondary';
    cancel.textContent = 'Cancel';
    const newWin = document.createElement('button');
    newWin.className = 'btn-secondary';
    newWin.textContent = 'New window';
    const current = document.createElement('button');
    current.className = 'btn-primary';
    current.style.width = 'auto';
    current.textContent = 'Current window';

    cancel.onclick = () => { overlay.remove(); resolve(null); };
    newWin.onclick = () => { overlay.remove(); resolve('new'); };
    current.onclick = () => { overlay.remove(); resolve('current'); };

    actions.append(cancel, newWin, current);
    modal.append(title, desc, actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

function confirmModal(title, body) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    const h = document.createElement('h3');
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = body;
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn-secondary';
    cancel.textContent = 'Cancel';
    const ok = document.createElement('button');
    ok.className = 'btn-primary';
    ok.style.width = 'auto';
    ok.textContent = 'Delete';
    cancel.onclick = () => { overlay.remove(); resolve(false); };
    ok.onclick = () => { overlay.remove(); resolve(true); };
    actions.append(cancel, ok);
    modal.append(h, p, actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}

export async function renderFolder(root, folderId) {
  const folder = await getFolder(folderId);
  if (!folder) {
    location.hash = '#/library';
    return;
  }

  // Header
  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.gap = '8px';
  header.style.marginBottom = '10px';

  const back = document.createElement('a');
  back.href = '#/library';
  back.textContent = '← ';
  back.style.textDecoration = 'none';
  back.style.color = 'var(--text-muted)';
  back.style.fontSize = '16px';

  const nameEl = document.createElement('div');
  nameEl.style.fontWeight = '600';
  nameEl.style.flex = '1';
  nameEl.textContent = folder.name;

  const menuBtn = document.createElement('button');
  menuBtn.className = 'btn-secondary';
  menuBtn.textContent = '⋮';
  menuBtn.style.padding = '2px 8px';

  header.append(back, nameEl, menuBtn);
  root.appendChild(header);

  function showMenu() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.background = 'transparent';
    const menu = document.createElement('div');
    menu.className = 'modal';
    menu.style.position = 'absolute';
    const rect = menuBtn.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    menu.style.padding = '6px';
    menu.style.minWidth = '140px';
    menu.style.maxWidth = '180px';

    function item(text, onClick) {
      const b = document.createElement('button');
      b.className = 'btn-secondary';
      b.style.width = '100%';
      b.style.textAlign = 'left';
      b.style.border = '0';
      b.textContent = text;
      b.onclick = () => { overlay.remove(); onClick(); };
      return b;
    }

    menu.append(
      item('Rename', () => promptRename()),
      item('Delete folder', () => promptDelete()),
    );
    overlay.appendChild(menu);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  async function promptRename() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    const h = document.createElement('h3');
    h.textContent = 'Rename folder';
    const input = document.createElement('input');
    input.className = 'input';
    input.value = folder.name;
    input.style.marginBottom = '12px';
    const err = document.createElement('div');
    err.style.color = 'var(--danger)';
    err.style.fontSize = '11px';
    err.style.minHeight = '14px';
    err.style.marginBottom = '8px';
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const cancel = document.createElement('button');
    cancel.className = 'btn-secondary';
    cancel.textContent = 'Cancel';
    const save = document.createElement('button');
    save.className = 'btn-primary';
    save.style.width = 'auto';
    save.textContent = 'Rename';
    cancel.onclick = () => overlay.remove();
    save.onclick = async () => {
      try {
        await renameFolder(folder.id, input.value);
        overlay.remove();
        showToast(`Renamed to '${input.value.trim()}'`);
        location.hash = `#/folder/${folder.id}`;
      } catch (e) {
        err.textContent = e.message;
      }
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save.click(); });
    actions.append(cancel, save);
    modal.append(h, input, err, actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    input.focus();
    input.select();
  }

  async function promptDelete() {
    const ok = await confirmModal('Delete folder?', `Delete '${folder.name}' and ${folder.tabs.length} tabs?`);
    if (!ok) return;
    await deleteFolder(folder.id);
    showToast(`Deleted '${folder.name}'`);
    location.hash = '#/library';
  }

  menuBtn.addEventListener('click', showMenu);

  // Action row
  const actions = document.createElement('div');
  actions.className = 'action-row';
  const openAll = document.createElement('button');
  openAll.className = 'btn-secondary';
  openAll.textContent = 'Open all';
  const copy = document.createElement('button');
  copy.className = 'btn-secondary';
  copy.textContent = 'Copy';
  actions.append(openAll, copy);
  root.appendChild(actions);

  openAll.addEventListener('click', async () => {
    if (folder.tabs.length === 0) return;
    const where = await showOpenAllModal(folder.tabs);
    if (!where) return;
    const urls = folder.tabs.map((t) => t.url);
    if (where === 'current') await openTabsInCurrentWindow(urls);
    else await openTabsInNewWindow(urls);
    showToast(`Opened ${urls.length} tabs`);
  });

  copy.addEventListener('click', async () => {
    if (folder.tabs.length === 0) return;
    try {
      await copyTabsAsText(folder.tabs);
      showToast(`Copied ${folder.tabs.length} URLs`);
    } catch (e) {
      // Fallback: textarea modal
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      const modal = document.createElement('div');
      modal.className = 'modal';
      const ta = document.createElement('textarea');
      ta.style.width = '100%';
      ta.style.height = '160px';
      ta.value = folder.tabs.map((t) => t.url).join('\n');
      ta.select();
      const close = document.createElement('button');
      close.className = 'btn-primary';
      close.style.width = 'auto';
      close.textContent = 'Close';
      close.onclick = () => overlay.remove();
      modal.append(ta, close);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
    }
  });

  // Tab list
  const sectionTitle = document.createElement('div');
  sectionTitle.className = 'section-title';
  sectionTitle.textContent = `Tabs · ${folder.tabs.length}`;
  root.appendChild(sectionTitle);

  if (folder.tabs.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No tabs in this folder yet.';
    root.appendChild(empty);
    return;
  }

  for (const tab of folder.tabs) {
    const row = document.createElement('div');
    row.className = 'tab-row';

    const fav = document.createElement('img');
    fav.className = 'favicon';
    fav.src = tab.favIconUrl || '';
    fav.onerror = () => { fav.style.visibility = 'hidden'; };

    const info = document.createElement('div');
    info.className = 'tab-info';
    const t = document.createElement('div');
    t.className = 'tab-title';
    t.textContent = tab.title || tab.url;
    const u = document.createElement('div');
    u.className = 'tab-url';
    u.textContent = tab.url;
    info.append(t, u);

    const del = document.createElement('button');
    del.className = 'delete-btn';
    del.textContent = '×';
    del.title = 'Remove';

    row.append(fav, info, del);
    root.appendChild(row);

    row.addEventListener('click', (e) => {
      if (e.target === del) return;
      openTab(tab.url);
    });

    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      // Optimistic remove + undo: snapshot then restore on undo.
      const removedTab = { ...tab };
      await storageRemoveTab(folder.id, tab.id);
      const undone = await showUndoToast(`Removed '${removedTab.title || removedTab.url}'`);
      if (undone) {
        // Re-add (will dedupe-no-op if user already added it again somehow).
        await addTabsToFolder(folder.id, [{ title: removedTab.title, url: removedTab.url, favIconUrl: removedTab.favIconUrl }]);
      }
    });
  }
}
```

- [ ] **Step 14.2: Commit**

```bash
git add sidepanel/views/folder.js
git commit -m "feat(ui): folder detail view with open/copy/delete + undo"
```

---

## Task 15: `views/save.js` — save view

**Files:**
- Create: `sidepanel/views/save.js`

- [ ] **Step 15.1: Implement save view**

```js
import { getCurrentWindowTabs, getHighlightedTabs, closeTabs } from '../lib/tabs.js';
import { loadStorage, addTabsToFolder, createFolder, getFolder } from '../lib/storage.js';
import { showToast } from '../lib/toast.js';

export async function renderSave(root) {
  const highlighted = await getHighlightedTabs();
  const usingHighlighted = highlighted.length > 1; // single-tab "highlighted" is just the active tab
  const browserTabs = usingHighlighted ? highlighted : await getCurrentWindowTabs();

  // State: which tab ids are checked
  const checked = new Set(usingHighlighted ? browserTabs.map((t) => t.id) : []);

  // Section title with All / None controls
  const titleRow = document.createElement('div');
  titleRow.className = 'section-title';
  const titleText = document.createElement('span');
  const updateCount = () => { titleText.textContent = `${checked.size} of ${browserTabs.length} tabs · `; };
  updateCount();
  const allLink = document.createElement('a');
  allLink.href = '#';
  allLink.textContent = 'All';
  allLink.style.color = 'var(--accent)';
  allLink.style.textDecoration = 'none';
  const noneLink = document.createElement('a');
  noneLink.href = '#';
  noneLink.textContent = 'None';
  noneLink.style.color = 'var(--accent)';
  noneLink.style.textDecoration = 'none';
  noneLink.style.marginLeft = '6px';
  titleRow.append(titleText, allLink, document.createTextNode(' · '), noneLink);
  root.appendChild(titleRow);

  const list = document.createElement('div');
  root.appendChild(list);

  function renderRows() {
    list.innerHTML = '';
    for (const tab of browserTabs) {
      const row = document.createElement('label');
      row.className = 'tab-row';
      row.style.cursor = 'pointer';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'checkbox';
      cb.checked = checked.has(tab.id);
      cb.addEventListener('change', () => {
        if (cb.checked) checked.add(tab.id);
        else checked.delete(tab.id);
        updateCount();
        updateSaveButton();
      });

      const fav = document.createElement('img');
      fav.className = 'favicon';
      fav.src = tab.favIconUrl || '';
      fav.onerror = () => { fav.style.visibility = 'hidden'; };

      const info = document.createElement('div');
      info.className = 'tab-info';
      const t = document.createElement('div');
      t.className = 'tab-title';
      t.textContent = tab.title || tab.url;
      const u = document.createElement('div');
      u.className = 'tab-url';
      u.textContent = tab.url;
      info.append(t, u);

      row.append(cb, fav, info);
      list.appendChild(row);
    }
  }

  allLink.addEventListener('click', (e) => {
    e.preventDefault();
    for (const tab of browserTabs) checked.add(tab.id);
    updateCount();
    updateSaveButton();
    renderRows();
  });
  noneLink.addEventListener('click', (e) => {
    e.preventDefault();
    checked.clear();
    updateCount();
    updateSaveButton();
    renderRows();
  });

  // Folder name input + datalist
  const data = await loadStorage();
  const wrap = document.createElement('div');
  wrap.style.marginTop = '14px';

  const nameInput = document.createElement('input');
  nameInput.className = 'input';
  nameInput.placeholder = 'Folder name';
  nameInput.setAttribute('list', 'folder-names');
  nameInput.style.marginBottom = '10px';
  const datalist = document.createElement('datalist');
  datalist.id = 'folder-names';
  for (const f of data.folders) {
    const opt = document.createElement('option');
    opt.value = f.name;
    datalist.appendChild(opt);
  }
  wrap.append(nameInput, datalist);

  const closeRow = document.createElement('label');
  closeRow.className = 'checkrow';
  const closeCb = document.createElement('input');
  closeCb.type = 'checkbox';
  closeCb.className = 'checkbox';
  closeRow.append(closeCb, document.createTextNode('Close tabs after saving'));
  wrap.appendChild(closeRow);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn-primary';
  saveBtn.disabled = true;
  function updateSaveButton() {
    const ok = nameInput.value.trim().length > 0 && checked.size > 0;
    saveBtn.disabled = !ok;
    saveBtn.textContent = `Save ${checked.size} tab${checked.size === 1 ? '' : 's'}`;
  }
  nameInput.addEventListener('input', updateSaveButton);
  wrap.appendChild(saveBtn);
  root.appendChild(wrap);

  saveBtn.addEventListener('click', async () => {
    const folderName = nameInput.value.trim();
    if (!folderName || checked.size === 0) return;

    let folder = data.folders.find((f) => f.name === folderName);
    if (!folder) {
      try { folder = await createFolder(folderName); }
      catch (e) { showToast(e.message); return; }
    }
    const selectedTabs = browserTabs.filter((t) => checked.has(t.id));
    const result = await addTabsToFolder(folder.id, selectedTabs.map((t) => ({
      title: t.title,
      url: t.url,
      favIconUrl: t.favIconUrl,
    })));
    if (closeCb.checked) {
      await closeTabs(selectedTabs.map((t) => t.id));
    }
    const msg = result.skipped
      ? `Saved ${result.added} tab${result.added === 1 ? '' : 's'} to '${folderName}' (${result.skipped} already there)`
      : `Saved ${result.added} tab${result.added === 1 ? '' : 's'} to '${folderName}'`;
    showToast(msg);
    location.hash = '#/library';
  });

  renderRows();
  updateSaveButton();
}
```

- [ ] **Step 15.2: Commit**

```bash
git add sidepanel/views/save.js
git commit -m "feat(ui): save view — pick tabs, name folder, optionally close"
```

---

## Task 16: Manual smoke-test checklist

**Files:**
- Create: `docs/superpowers/specs/manual-smoke-test.md`

- [ ] **Step 16.1: Create the checklist**

```markdown
# TabStash Manual Smoke Test

Run before tagging a release. ~5 minutes.

## Setup
1. Open `chrome://extensions` → enable Developer mode → Load unpacked → choose this repo.
2. Pin TabStash to the toolbar.

## Save flow
3. Open ~5 tabs, including one chrome:// URL and one pinned tab.
4. Click TabStash icon → Side Panel opens on Library (empty state).
5. Click "+ Save current tabs". Save view appears.
6. Verify: pinned tab is NOT in the list.
7. Type folder name "Smoke" → check "Close tabs after saving" → click Save.
8. Verify: side panel switches back to Library showing "Smoke · 5 tabs". Browser tabs are closed.

## Highlighted-tabs flow
9. Open ~4 tabs. Cmd/Ctrl-click two of them in the tabstrip to highlight them.
10. Click TabStash icon → switch to Save tab.
11. Verify: only the 2 highlighted tabs appear, both checked.

## Browse / open / copy
12. Click "Smoke" folder. Folder Detail appears.
13. Click one tab → it opens in background (focus stays on side panel).
14. Click "Copy" → tost shows `Copied N URLs`. Paste into a notepad → verify URLs, one per line.
15. Click "Open all" → choose "Current window" → all tabs open in background.

## Delete + undo
16. Hover over a tab → click `×`. Toast shows "Removed ... Undo".
17. Wait 6 seconds → tab is gone for good.
18. Hover another tab → click `×` → click "Undo" before timer expires → tab reappears.

## Folder rename / delete
19. Click `⋮` → type `rename` → type new name → save. Library shows new name.
20. Click `⋮` → type `delete` → confirm. Library returns to empty (or earlier state).

## Persistence
21. Save a folder. Quit and re-open Chrome. Open side panel → folder still there.

## Dedupe
22. With folder X already containing https://a.com/, save it again → toast notes "(1 already there)".

If any step fails: file an issue or fix before tagging.
```

- [ ] **Step 16.2: Commit**

```bash
git add docs/superpowers/specs/manual-smoke-test.md
git commit -m "docs: manual smoke test checklist"
```

---

## Task 17: Final integration check

**Files:** none — verification step.

- [ ] **Step 17.1: Run the full unit test suite**

```bash
npm test
```

Expected: all tests pass (storage, format, tabs, uuid).

- [ ] **Step 17.2: Load the extension in Chrome**

- Open `chrome://extensions` → Developer mode → Load unpacked → select this repo.
- Verify there are no errors on the extension card.
- Open the side panel via the toolbar icon. Library should render (empty state).

- [ ] **Step 17.3: Run the manual smoke test**

Execute every step in `docs/superpowers/specs/manual-smoke-test.md`. Report any failures.

- [ ] **Step 17.4: Push**

```bash
git push origin main
```

---

## Notes for the implementer

- **Order matters.** Tasks 1–7 are pure logic (TDD-friendly). Tasks 8–15 are extension wiring + UI (mostly verified manually). Don't skip ahead.
- **Run tests after every code change in lib/**. Failing tests in lib/ block UI work.
- **DOM testing is intentionally minimal.** The smoke checklist (Task 16) is the verification surface for views. If you find yourself wanting more confidence, add happy-dom tests for views — but don't block MVP on it.
- **Icons are placeholders.** Replace with proper assets later; don't waste time hand-crafting them now.
- **Don't add features outside the spec.** Tags, search, dark theme, hotkeys — all roadmap, not MVP.
