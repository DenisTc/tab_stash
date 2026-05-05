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
