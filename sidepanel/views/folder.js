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
    try {
      await deleteFolder(folder.id);
      showToast(`Deleted '${folder.name}'`);
      location.hash = '#/library';
    } catch (e) {
      showToast(e.message);
    }
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
    try {
      if (where === 'current') await openTabsInCurrentWindow(urls);
      else await openTabsInNewWindow(urls);
      showToast(`Opened ${urls.length} tabs`);
    } catch (e) {
      showToast(`Could not open all tabs: ${e.message}`);
    }
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
      openTab(tab.url).catch(() => {
        showToast(`Cannot open ${tab.url} from extension`);
      });
    });

    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      // Optimistic remove + undo: snapshot then restore on undo.
      const removedTab = { ...tab };
      try {
        await storageRemoveTab(folder.id, tab.id);
      } catch (err) {
        showToast(err.message);
        return;
      }
      const undone = await showUndoToast(`Removed '${removedTab.title || removedTab.url}'`);
      if (undone) {
        try {
          await addTabsToFolder(folder.id, [{ title: removedTab.title, url: removedTab.url, favIconUrl: removedTab.favIconUrl }]);
        } catch (err) {
          showToast(`Could not restore tab: ${err.message}`);
        }
      }
    });
  }
}
