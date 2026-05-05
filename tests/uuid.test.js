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
