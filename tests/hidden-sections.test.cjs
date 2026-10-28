'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadMain } = require('./support/load-main.cjs');
const { createViewFixture, rowTitle, sections } = require('./support/view-fixture.cjs');
const { createPluginFixture } = require('./support/plugin-fixture.cjs');

const key = (name, extra = {}) => ({ key: name, preventDefault() {}, ...extra });

// The page-level keydown listener that drives the list when the search box is hidden.
function pageKeydown(fixture) {
  const entry = fixture.view.domHandlers.find((item) => item.type === 'keydown' && item.el === fixture.view.contentEl);
  assert.ok(entry, 'page keydown listener');
  return (event, target = fixture.view.recentEl) => entry.handler({ target, ...event });
}
const selectedTitle = (fixture) => {
  const item = fixture.view.recentItems[fixture.view.selected];
  return item ? rowTitle(item.el) : null;
};

const noSearch = (extra = {}) => createViewFixture({
  paths: ['A.md', 'B.md', 'P.md'],
  history: { 'B.md': 20, 'A.md': 10 },
  pinned: ['P.md'],
  settings: { showSearch: false },
  ...extra,
});

/* ── The list takes over when the search box is hidden ── */
test('the listbox is focusable and carries the active option only when the search box is hidden', async () => {
  const hidden = await noSearch();
  assert.equal(hidden.view.recentEl.attributes.tabindex, '0');
  assert.equal(hidden.view.recentEl.attributes.role, 'listbox');

  const shown = await noSearch({ settings: {} });
  assert.equal(shown.view.recentEl.attributes.tabindex, undefined);
});

test('focusing the home puts the cursor in the list and selects the first visible card', async () => {
  const fixture = await noSearch();
  fixture.view.app.workspace.getActiveViewOfType = () => fixture.view;
  fixture.view.focusInput();
  for (const timer of fixture.main.timers.timeouts) if (!timer.fired) { timer.fired = true; timer.fn(); }
  assert.ok(fixture.view.recentEl.focusCount >= 1, 'list focused');
  assert.equal(fixture.view.selected, 0);
  assert.equal(selectedTitle(fixture), 'P');
  assert.equal(fixture.view.recentEl.attributes['aria-activedescendant'], fixture.view.recentItems[0].el.attributes.id);
});

test('with the pins hidden too, the first row is selected; with nothing to show, only the list is focused', async () => {
  const rows = await noSearch({ settings: { showSearch: false, showPinned: false } });
  rows.view.app.workspace.getActiveViewOfType = () => rows.view;
  rows.view.focusList();
  assert.equal(selectedTitle(rows), 'B');

  const empty = await createViewFixture({ settings: { showSearch: false } });
  empty.view.focusList();
  assert.ok(empty.view.recentEl.focusCount >= 1);
  assert.equal(empty.view.selected, -1);
});

test('the arrows, Enter and Delete work from the list', async () => {
  const fixture = await noSearch({ pinned: [] });
  const press = pageKeydown(fixture);
  press(key('ArrowDown'));
  press(key('ArrowDown'));
  assert.equal(selectedTitle(fixture), 'A');
  press(key('ArrowUp'));
  assert.equal(selectedTitle(fixture), 'B');
  press(key('Enter'));
  await Promise.resolve();
  assert.deepEqual(fixture.opened, ['B.md']);
  press(key('Delete'));
  assert.deepEqual(fixture.removed, ['B.md']);
});

test('Alt+arrows and Alt+P work from the list too', async () => {
  const fixture = await noSearch({ paths: ['P.md', 'Q.md', 'R.md'], pinned: ['P.md', 'Q.md'], history: { 'R.md': 1 } });
  const press = pageKeydown(fixture);
  press(key('ArrowDown'));
  press(key('ArrowRight', { altKey: true }));
  await fixture.view.pendingMove;
  assert.deepEqual(fixture.reorders, [['Q.md', 'P.md']]);

  press(key('ArrowDown')); // from the moved card (index 1) to the Recent row
  press(key('p', { altKey: true, code: 'KeyP' }));
  await fixture.view.pendingMove;
  assert.deepEqual(fixture.pinnedNow, ['R.md']);
});

test('the page listener ignores keys typed in the search box and keys when the search box is shown', async () => {
  const hidden = await noSearch();
  pageKeydown(hidden)(key('ArrowDown'), hidden.view.inputEl);
  assert.equal(hidden.view.selected, -1);

  const shown = await noSearch({ settings: {} });
  pageKeydown(shown)(key('ArrowDown'));
  assert.equal(shown.view.selected, -1);
});

test('hiding the search box clears what was typed and brings the lists back', async () => {
  const fixture = await noSearch({ settings: {} });
  fixture.view.inputEl.value = 'a';
  fixture.view.updateResults();
  assert.equal(fixture.view.hasQuery, true);
  fixture.plugin.settings = { ...fixture.plugin.settings, showSearch: false };
  fixture.view.refreshSettings();
  assert.equal(fixture.view.inputEl.value, '');
  assert.equal(fixture.view.hasQuery, false);
  assert.deepEqual(fixture.view.resultsEl.children, []);
  assert.equal(fixture.view.recentEl.attributes.tabindex, '0');
});

test('showing the search box again removes the list focus attributes', async () => {
  const fixture = await noSearch();
  fixture.view.focusList();
  fixture.plugin.settings = { ...fixture.plugin.settings, showSearch: true };
  fixture.view.refreshSettings();
  assert.equal(fixture.view.recentEl.attributes.tabindex, undefined);
  assert.equal(fixture.view.recentEl.attributes['aria-activedescendant'], undefined);
});

/* ── Everything hidden ── */
const allOff = { showGreeting: false, showSearch: false, showPinned: false, showRecent: false };

test('with every section hidden a hint says how to turn one back on', async () => {
  const fixture = await createViewFixture({ paths: ['A.md'], history: { 'A.md': 1 }, settings: allOff });
  assert.equal(fixture.view.hintEl.hidden, false);
  assert.equal(fixture.view.hintEl.text, 'Everything on this page is hidden. Turn a section back on in Foyer’s settings.');
  const es = await createViewFixture({ settings: allOff, language: 'es' });
  assert.equal(es.view.hintEl.text, 'Todo está oculto. Vuelve a activar alguna sección en los ajustes de Foyer.');
});

test('the hint disappears as soon as any section is shown, live', async () => {
  const fixture = await createViewFixture({ settings: allOff });
  for (const name of ['showGreeting', 'showSearch', 'showPinned', 'showRecent']) {
    fixture.plugin.settings = { ...fixture.plugin.settings, ...allOff, [name]: true };
    fixture.view.refreshSettings();
    assert.equal(fixture.view.hintEl.hidden, true, name);
  }
  fixture.plugin.settings = { ...fixture.plugin.settings, ...allOff };
  fixture.view.refreshSettings();
  assert.equal(fixture.view.hintEl.hidden, false);
});

test('the hint is not shown by default', async () => {
  const fixture = await createViewFixture({ paths: ['A.md'], history: { 'A.md': 1 } });
  assert.equal(fixture.view.hintEl.hidden, true);
  assert.deepEqual(sections(fixture.view), [{ head: 'Recent', rows: ['A'] }]);
});

/* ── Focus Foyer search with the search box hidden ── */
async function commandFixture(settings) {
  const f = createPluginFixture({ data: settings });
  const calls = [];
  const state = { leaves: [], active: null };
  const makeView = (leaf) => {
    const view = new f.main.HomeView(leaf, f.plugin);
    view.inputEl = { focus: () => calls.push('focus') };
    return view;
  };
  Object.assign(f.plugin.app.workspace, {
    rootSplit: {},
    getLeavesOfType: () => state.leaves,
    getActiveViewOfType: (type) => (state.active instanceof type ? state.active : null),
    getMostRecentLeaf: () => null,
    getLeaf: () => {
      const leaf = {
        view: null,
        setViewState: async () => { leaf.view = makeView(leaf); state.leaves.push(leaf); },
      };
      return leaf;
    },
    revealLeaf: async () => {},
    setActiveLeaf: (leaf) => { state.active = leaf.view; },
  });
  await f.plugin.onload();
  return { ...f, calls, state };
}

test('Focus Foyer search with the search box hidden opens Foyer and shows a notice instead of focusing', async () => {
  const f = await commandFixture({ showSearch: false });
  await f.commands['focus-search'].callback();
  assert.equal(f.state.leaves.length, 1); // Foyer is still brought up
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.main.notices, ['The search box is hidden. Turn it on in Foyer’s settings.']);
});

test('the notice is Spanish when the interface is Spanish, and nothing is shown when the search box is visible', async () => {
  const es = await commandFixture({ showSearch: false, language: 'es' });
  await es.commands['focus-search'].callback();
  assert.deepEqual(es.main.notices, ['El buscador está oculto. Actívalo en los ajustes de Foyer.']);

  const shown = await commandFixture({});
  await shown.commands['focus-search'].callback();
  assert.deepEqual(shown.calls, ['focus']);
  assert.deepEqual(shown.main.notices, []);
});

test('the new strings exist in both languages', () => {
  const { settingsModule } = loadMain();
  const { es, en } = settingsModule.STRINGS;
  for (const k of ['allHidden', 'searchHiddenNotice']) {
    assert.ok(es[k] && en[k], k);
    assert.notEqual(es[k], en[k], k);
  }
});

test('the focused list shows no outline of its own and the hint is styled quietly', () => {
  const { readFileSync } = require('node:fs');
  const { join } = require('node:path');
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const body = (selector) => {
    for (const [, selectors, text] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (selectors.split(',').some((candidate) => candidate.trim() === selector)) return text;
    }
    return '';
  };
  assert.match(body('.foyer__list:focus'), /outline:\s*none/);
  assert.match(body('.foyer__hint'), /color:\s*var\(--text-faint\)/);
  assert.match(body('.foyer__hint'), /text-align:\s*center/);
});
