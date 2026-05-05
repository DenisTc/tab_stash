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
