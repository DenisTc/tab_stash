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
