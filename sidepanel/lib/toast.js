const container = () => document.getElementById('toast-container');

export function showToast(message, opts = {}) {
  const { duration = 3000 } = opts;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  container().appendChild(el);
  setTimeout(() => el.remove(), duration);
}

/**
 * Show an undoable toast. Returns a promise that resolves to true if
 * the user clicked "Undo" before the timer expired, otherwise false.
 */
export function showUndoToast(message, opts = {}) {
  const { duration = 5000 } = opts;
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'toast';
    const text = document.createElement('span');
    text.textContent = message;
    const btn = document.createElement('button');
    btn.textContent = 'Undo';
    el.appendChild(text);
    el.appendChild(btn);
    container().appendChild(el);

    const timer = setTimeout(() => {
      el.remove();
      resolve(false);
    }, duration);

    btn.addEventListener('click', () => {
      clearTimeout(timer);
      el.remove();
      resolve(true);
    });
  });
}
