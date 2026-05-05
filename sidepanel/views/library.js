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
