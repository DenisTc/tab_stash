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
