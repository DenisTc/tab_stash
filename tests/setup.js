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
