import { ipcRenderer } from 'electron';

const MAX_ENTRIES = 12;
const FADE_AFTER_MS = 2800;
const REMOVE_AFTER_MS = 3300;

const logEl = document.getElementById('log')!;

document.getElementById('closeBtn')!.addEventListener('click', () => window.close());

function addEntry(label: string, category: 'expr' | 'system'): void {
  const entry = document.createElement('div');
  entry.className = `entry ${category}`;
  entry.textContent = label;
  logEl.appendChild(entry);

  while (logEl.children.length > MAX_ENTRIES) {
    logEl.firstElementChild?.remove();
  }

  setTimeout(() => entry.classList.add('fading'), FADE_AFTER_MS);
  setTimeout(() => entry.remove(), REMOVE_AFTER_MS);
}

ipcRenderer.on('input-action', (_e, label: string, category: 'expr' | 'system') => {
  addEntry(label, category);
});
