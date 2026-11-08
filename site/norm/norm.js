// The Norm runtime. `mountNorm(options)` renders the footer and the
// documentation reader, and returns a handle. It owns no app content: the app
// keeps its own `#home` section and its own header; the runtime adds a reader
// section beside it, a footer and a tooltip.
//
// No import may ever require this file by name (NORM-OPT-01): every check
// inspects the rendered page, not the module graph. Apps import it guarded.

import {
  composeSpecs,
  docsHash,
  parseRoute,
  renderMarkdown,
  splitDocument,
  uniqueIcons,
} from './reader.js';
import { icon } from './icons.js';
import { footerHtml, fillFooter } from './footer.js';

const DEFAULT_DOCS = [
  { slug: 'readme', title: 'README', file: 'docs/README.md' },
  { slug: 'specs', title: 'SPECS', file: 'docs/APP-SPECS.md', changelog: 'docs/RELEASE-NOTES.md' },
  { slug: 'norm', title: 'NORM', file: 'norm/NORM.md' },
];

const READER_HTML = [
  '<section id="reader" hidden aria-label="Documentation">',
  '  <div class="reader-head">',
  '    <div>',
  '      <p class="eyebrow">Documentation</p>',
  '      <h2 id="reader-title">README</h2>',
  '    </div>',
  '    <button id="reader-close" class="button" type="button">Back</button>',
  '  </div>',
  '  <div id="reader-tabs" class="reader-tabs" role="tablist" aria-label="Documents"></div>',
  '  <nav id="reader-sections" class="reader-sections" aria-label="Sections"></nav>',
  '  <h3 id="reader-section-title" class="reader-section-title"></h3>',
  '  <article id="reader-body" class="reader-body"></article>',
  '</section>',
  '<div id="tooltip" class="tooltip" role="tooltip" hidden></div>',
].join('\n');

export async function mountNorm(options = {}) {
  const root = options.root ?? document;
  const doc = root.ownerDocument ?? root;
  const win = doc.defaultView ?? root;
  const app = options.app ?? { name: 'App', version: '0.0.0' };
  const normVersion = options.normVersion ?? '0.0.0';
  const source = options.source ?? '';
  const base = options.base ?? '';
  const docs = options.docs ?? DEFAULT_DOCS;

  const home = root.querySelector(options.home ?? '#home') ?? root.querySelector('main');
  if (!home) throw new Error('mountNorm: no #home or <main> element found');
  if (!root.querySelector('#reader')) home.insertAdjacentHTML('afterend', READER_HTML);

  if (options.footer !== false) {
    const markup = footerHtml({ app, source, normVersion });
    const existing = root.querySelector('#norm-footer');
    if (existing) existing.outerHTML = markup;
    else doc.body.insertAdjacentHTML('beforeend', markup);
  }

  const elements = {
    home,
    reader: root.querySelector('#reader'),
    tabs: root.querySelector('#reader-tabs'),
    sections: root.querySelector('#reader-sections'),
    title: root.querySelector('#reader-title'),
    sectionTitle: root.querySelector('#reader-section-title'),
    body: root.querySelector('#reader-body'),
    tooltip: root.querySelector('#tooltip'),
  };

  const state = { docs: [], byslug: {}, current: null };

  async function loadDocs() {
    const items = await Promise.all(docs.map(async (spec) => {
      const response = await fetch(base + spec.file);
      let markdown = await response.text();
      if (spec.changelog) {
        const notes = await fetch(base + spec.changelog);
        markdown = composeSpecs(markdown, await notes.text());
      }
      return splitDocument({ slug: spec.slug, title: spec.title, markdown });
    }));
    for (const item of items) state.byslug[item.slug] = item;
    return items;
  }

  function showHome() {
    elements.home.hidden = false;
    elements.reader.hidden = true;
    // The app owns any non-docs hash (its own modes and views). Only the
    // reader-close button clears the address; an unknown address returns here
    // without being rewritten.
  }

  function openDoc(slug, section = null) {
    const current = state.byslug[slug] ?? state.byslug.readme ?? state.docs[0];
    state.current = current;
    elements.home.hidden = true;
    elements.reader.hidden = false;
    elements.title.textContent = current.title;
    elements.tabs.innerHTML = '';
    for (const item of state.docs) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = `reader-tab${item.slug === current.slug ? ' active' : ''}`;
      button.textContent = item.title;
      button.addEventListener('click', () => openDoc(item.slug));
      elements.tabs.append(button);
    }
    const icons = uniqueIcons(current.pages.map((page) => page.title));
    elements.sections.innerHTML = '';
    current.pages.forEach((page, index) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'reader-section';
      button.dataset.tip = page.title;
      button.setAttribute('aria-label', page.title);
      button.innerHTML = icon(icons[index]);
      button.addEventListener('click', () => {
        win.history.pushState(null, '', docsHash(current.slug, page.slug));
        openDoc(current.slug, page.slug);
      });
      elements.sections.append(button);
    });
    const active = current.pages.find((page) => page.slug === section) ?? current.pages[0];
    for (const [index, button] of [...elements.sections.children].entries()) {
      button.classList.toggle('active', current.pages[index].slug === active.slug);
    }
    elements.sectionTitle.textContent = active.title;
    elements.body.innerHTML = renderMarkdown(active.markdown);
    doc.title = `${current.title} — ${app.name}`;
  }

  function route() {
    const parsed = parseRoute(win.location?.hash ?? '');
    if (parsed.view === 'docs') openDoc(parsed.doc, parsed.section);
    else showHome();
  }

  function tooltipFor(target) {
    const text = target.dataset.tip;
    if (!text) return;
    elements.tooltip.textContent = text;
    elements.tooltip.hidden = false;
    elements.tooltip.toggleAttribute('data-wide', target.hasAttribute('data-tip-wide'));
    const box = target.getBoundingClientRect();
    const width = elements.tooltip.offsetWidth;
    const left = Math.min(Math.max(8, box.left + box.width / 2 - width / 2), win.innerWidth - width - 8);
    elements.tooltip.style.left = `${left}px`;
    elements.tooltip.style.top = `${Math.max(8, box.top - elements.tooltip.offsetHeight - 10)}px`;
    elements.tooltip.style.setProperty('--arrow', `${box.left + box.width / 2 - left}px`);
  }

  const onOver = (event) => {
    const target = event.target.closest?.('[data-tip]');
    if (target) tooltipFor(target);
  };
  const onOut = (event) => {
    if (event.target.closest?.('[data-tip]')) elements.tooltip.hidden = true;
  };
  const onFocusOut = () => { elements.tooltip.hidden = true; };

  doc.addEventListener('mouseover', onOver);
  doc.addEventListener('mouseout', onOut);
  doc.addEventListener('focusin', onOver);
  doc.addEventListener('focusout', onFocusOut);

  const click = (selector, handler) => {
    const el = root.querySelector(selector);
    if (el) el.addEventListener('click', handler);
  };
  click('#readme', () => { win.location.hash = docsHash('readme'); });
  click('#specs', () => { win.location.hash = docsHash('specs'); });
  click('#norm', () => { win.location.hash = docsHash('norm'); });
  click('#reader-close', () => { win.location.hash = ''; });
  click('#theme', () => {
    doc.documentElement.style.colorScheme = doc.documentElement.style.colorScheme === 'dark' ? 'light' : 'dark';
  });

  win.addEventListener('hashchange', route);
  win.addEventListener('popstate', route);

  state.docs = await loadDocs();
  fillFooter(root, { app, normVersion, metrics: await loadMetrics(options.metrics) });
  route();

  return {
    open: (slug, section) => {
      win.location.hash = docsHash(slug, section ?? null);
      route();
    },
    close: showHome,
    unmount: () => {
      doc.removeEventListener('mouseover', onOver);
      doc.removeEventListener('mouseout', onOut);
      doc.removeEventListener('focusin', onOver);
      doc.removeEventListener('focusout', onFocusOut);
      win.removeEventListener('hashchange', route);
      win.removeEventListener('popstate', route);
      root.querySelector('#norm-footer')?.remove();
      root.querySelector('#reader')?.remove();
      root.querySelector('#tooltip')?.remove();
    },
  };
}

async function loadMetrics(metrics) {
  if (metrics && typeof metrics === 'object') return metrics;
  if (!metrics) return {};
  try {
    const response = await fetch(metrics);
    return response.ok ? await response.json() : {};
  } catch {
    return {};
  }
}
