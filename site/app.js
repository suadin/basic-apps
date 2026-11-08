// basic-apps: render the workspace state. Everything that is shared — footer,
// reader, routing, tooltips, the NORM tab — comes from the Norm runtime; only
// the state card, the project table and the publishable-mode toggle stay here.

import {
  driftText,
  folderCount,
  folderLine,
  parseMode,
  repoRows,
  stamp,
  visibleFolders,
} from './logic.js';

const state = { workspace: null };

function text(tag, value, className) {
  const node = document.createElement(tag);
  if (value != null) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function renderState() {
  const workspace = state.workspace;
  document.querySelector('#generated-at').textContent = stamp(workspace?.generatedAt);

  const cards = document.querySelector('#folder-cards');
  cards.innerHTML = '';
  for (const folder of visibleFolders(workspace, parseMode(location.hash))) {
    const card = text('article', null, 'card');
    card.append(text('h3', `${folder.name}/`));
    card.append(text('p', folder.role, 'role'));
    card.append(text('p', folder.text, 'text'));
    const meta = text('p', null, 'meta');
    meta.append(text('span', folderCount(folder), 'count'));
    meta.append(document.createTextNode(' · '));
    meta.append(text('span', folderLine(folder), 'names'));
    card.append(meta);
    card.dataset.public = folder.public ? 'yes' : 'no';
    cards.append(card);
  }

  const rows = repoRows(workspace);
  const table = document.querySelector('#repo-table');
  const body = table.querySelector('tbody');
  body.innerHTML = '';
  table.hidden = rows.length === 0;
  document.querySelector('#repos-empty').hidden = rows.length > 0;
  for (const row of rows) {
    const line = document.createElement('tr');
    for (const value of [row.name, row.app, row.standard, row.deviations, row.lastCommit, row.origin, row.restore]) {
      line.append(text('td', value));
    }
    body.append(line);
  }

  document.querySelector('#drift').textContent = driftText(workspace);
  const list = document.querySelector('#drift-list');
  list.innerHTML = '';
  for (const item of workspace?.drift ?? []) list.append(text('li', item));
}

function renderMode() {
  const mode = parseMode(location.hash);
  for (const button of document.querySelectorAll('.mode')) {
    button.classList.toggle('active', button.dataset.mode === mode);
  }
  document.querySelector('main')?.setAttribute('data-mode', mode);
}

function renderHome() {
  renderState();
  renderMode();
  document.title = 'Workspace state — basic-apps';
}

async function loadState() {
  try {
    const response = await fetch('state.json');
    if (response.ok) state.workspace = await response.json();
  } catch {
    /* renderState shows its no-state copy */
  }
}

async function fetchRuntime() {
  try {
    const response = await fetch('norm/app.json');
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

for (const button of document.querySelectorAll('.mode')) {
  button.addEventListener('click', () => {
    location.hash = `#/mode/${button.dataset.mode}`;
  });
}
window.addEventListener('hashchange', () => {
  if (!/^#\/docs\//.test(location.hash)) renderHome();
});

await loadState();

try {
  const { mountNorm } = await import('./norm/norm.js');
  const runtime = await fetchRuntime();
  await mountNorm({
    app: { name: runtime?.app ?? 'basic-apps', version: runtime?.appVersion ?? '0.1.0', logo: 'tokens.svg' },
    source: 'https://github.com/suadin/basic-apps',
    normVersion: runtime?.norm ?? '2.0.0',
    metrics: 'test-metrics.json',
  });
} catch {
  /* Without the package the state still renders; footer and reader are absent. */
}

renderHome();
