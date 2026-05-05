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
