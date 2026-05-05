import { getCurrentWindowTabs, getHighlightedTabs, closeTabs } from '../lib/tabs.js';
import { loadStorage, addTabsToFolder, createFolder } from '../lib/storage.js';
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
  const removeLink = document.createElement('a');
  removeLink.href = '#';
  removeLink.textContent = 'Remove';
  removeLink.style.color = 'var(--danger)';
  removeLink.style.textDecoration = 'none';
  removeLink.style.marginLeft = '6px';
  const updateRemoveLink = () => {
    const enabled = checked.size > 0;
    removeLink.style.opacity = enabled ? '1' : '0.4';
    removeLink.style.pointerEvents = enabled ? 'auto' : 'none';
  };
  titleRow.append(
    titleText,
    allLink,
    document.createTextNode(' · '),
    noneLink,
    document.createTextNode(' · '),
    removeLink,
  );
  root.appendChild(titleRow);

  const list = document.createElement('div');
  root.appendChild(list);

  function renderRows() {
    list.innerHTML = '';
    if (browserTabs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No tabs to save. Open the panel from a window with tabs.';
      list.appendChild(empty);
      return;
    }
    for (const tab of browserTabs) {
      const row = document.createElement('label');
      row.className = 'tab-row';
      row.style.cursor = 'pointer';
      row.style.paddingRight = '28px';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'checkbox';
      cb.checked = checked.has(tab.id);
      cb.addEventListener('change', () => {
        if (cb.checked) checked.add(tab.id);
        else checked.delete(tab.id);
        updateCount();
        updateSaveButton();
        updateRemoveLink();
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

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'delete-btn';
      del.textContent = '×';
      del.title = 'Remove from list';
      del.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = browserTabs.indexOf(tab);
        if (idx !== -1) browserTabs.splice(idx, 1);
        checked.delete(tab.id);
        updateCount();
        updateSaveButton();
        updateRemoveLink();
        renderRows();
      });

      row.append(cb, fav, info, del);
      list.appendChild(row);
    }
  }

  allLink.addEventListener('click', (e) => {
    e.preventDefault();
    for (const tab of browserTabs) checked.add(tab.id);
    updateCount();
    updateSaveButton();
    updateRemoveLink();
    renderRows();
  });
  noneLink.addEventListener('click', (e) => {
    e.preventDefault();
    checked.clear();
    updateCount();
    updateSaveButton();
    updateRemoveLink();
    renderRows();
  });
  removeLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (checked.size === 0) return;
    for (let i = browserTabs.length - 1; i >= 0; i--) {
      if (checked.has(browserTabs[i].id)) browserTabs.splice(i, 1);
    }
    checked.clear();
    updateCount();
    updateSaveButton();
    updateRemoveLink();
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

    try {
      let folder = data.folders.find((f) => f.name === folderName);
      if (!folder) folder = await createFolder(folderName);
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
    } catch (e) {
      showToast(e.message);
    }
  });

  renderRows();
  updateSaveButton();
  updateRemoveLink();
}
