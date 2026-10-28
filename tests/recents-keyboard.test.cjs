'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadMain } = require('./support/load-main.cjs');

// Builds a HomeView over a fake vault. `history` maps a path to its last-opened timestamp, `lastOpen` is what
// Obsidian's getLastOpenFiles() returns, `ignored` lists paths hidden by "Excluded files" and `extra` maps
// paths to non-file vault entries (folders...).
async function createFixture({
  paths = [],
  history = {},
  lastOpen = [],
  ignored = [],
  extra = {},
  recentLimit = 8,
  withHistory = true,
  main = loadMain({ animationFrames: true }),
} = {}) {
  const files = new Map(paths.map((path) => [path, new main.TFile(path, 1)]));
  const opened = [];
  const hoverEvents = [];
  const leafCalls = [];
  const plugin = {
    settings: { name: 'Toni', resultLimit: 7, recentLimit },
    getEffectiveLanguage: () => 'en',
    getLastOpened: (path) => history[path] || null,
  };
  if (withHistory) plugin.openHistory = history;
  const newLeaf = { openFile: async (file) => { opened.push(`new:${file.path}`); } };
  const view = new main.HomeView({ openFile: async (file) => { opened.push(file.path); } }, plugin);
  view.app = {
    vault: {
      getFiles: () => [...files.values()],
      getAbstractFileByPath: (path) => files.get(path) || extra[path] || null,
      on: () => ({}),
    },
    metadataCache: {
      getFileCache: () => null,
      isUserIgnored: (path) => ignored.includes(path),
      on: () => ({}),
    },
    workspace: {
      on: () => ({}),
      getLastOpenFiles: () => lastOpen,
      getActiveViewOfType: () => null,
      getLeaf: (mode) => { leafCalls.push(mode); return newLeaf; },
      trigger: (name, payload) => hoverEvents.push({ name, payload }),
    },
  };
  await view.onOpen();
  return { main, view, files, opened, hoverEvents, leafCalls };
}

// The listbox also holds the section headings (presentational): the rows are its options.
const recentRows = (fixture) => fixture.view.recentEl.children
  .flatMap((el) => (el.classes.has('foyer__recent-group') ? el.children : [el]))
  .filter((el) => el.attributes.role === 'option');
const recentTitles = (fixture) => recentRows(fixture).map((row) => row.children[1].children[0].text);
const key = (name, extra = {}) => ({ key: name, preventDefault() {}, ...extra });
const selectedRows = (fixture) => recentRows(fixture).filter((row) => row.classes.has('is-selected'));
const inputOf = (fixture) => fixture.view.inputEl;

function type(fixture, text) {
  fixture.view.inputEl.value = text;
  for (const { el, type: eventType, handler } of fixture.view.domHandlers) {
    if (el === fixture.view.inputEl && eventType === 'input') handler();
  }
}

/* ── Recents from the open history ── */
test('recents are ordered by the open history, most recent first', async () => {
  const fixture = await createFixture({
    paths: ['A.md', 'B.md', 'C.md'],
    history: { 'A.md': 100, 'B.md': 300, 'C.md': 200 },
  });
  assert.deepEqual(recentTitles(fixture), ['B', 'C', 'A']);
});

test('recents ignore getLastOpenFiles when the history has files', async () => {
  const fixture = await createFixture({
    paths: ['A.md', 'B.md'],
    history: { 'A.md': 100 },
    lastOpen: ['B.md'],
  });
  assert.deepEqual(recentTitles(fixture), ['A']);
});

test('recents are capped to recentLimit', async () => {
  const paths = ['A.md', 'B.md', 'C.md', 'D.md', 'E.md'];
  const history = { 'A.md': 5, 'B.md': 4, 'C.md': 3, 'D.md': 2, 'E.md': 1 };
  const fixture = await createFixture({ paths, history, recentLimit: 3 });
  assert.deepEqual(recentTitles(fixture), ['A', 'B', 'C']);
});

test('recents skip missing, deleted, folder, hidden and excluded paths without counting them', async () => {
  const fixture = await createFixture({
    paths: ['A.md', 'Hidden/.secret.md', 'Excluded.md', 'B.md', 'C.md', 'x.tmp'],
    extra: { Folder: new (loadMain().TFolder)('Folder') },
    history: {
      'Gone.md': 900,
      Folder: 800,
      'Hidden/.secret.md': 700,
      'Excluded.md': 600,
      'x.tmp': 500,
      'A.md': 400,
      'B.md': 300,
      'C.md': 200,
    },
    ignored: ['Excluded.md'],
    recentLimit: 3,
  });
  assert.deepEqual(recentTitles(fixture), ['A', 'B', 'C']);
});

test('recents fall back to getLastOpenFiles when the history is empty', async () => {
  const fixture = await createFixture({
    paths: ['A.md', 'B.md'],
    history: {},
    lastOpen: ['B.md', 'A.md', 'B.md'],
  });
  assert.deepEqual(recentTitles(fixture), ['B', 'A']);
});

test('recents fall back to getLastOpenFiles when no history path resolves to a listed file', async () => {
  const fixture = await createFixture({
    paths: ['A.md'],
    history: { 'Gone.md': 10, 'Deleted.md': 20 },
    lastOpen: ['A.md'],
  });
  assert.deepEqual(recentTitles(fixture), ['A']);
});

test('recents fall back when the plugin has no open history at all', async () => {
  const fixture = await createFixture({ paths: ['A.md'], lastOpen: ['A.md'], withHistory: false });
  assert.deepEqual(recentTitles(fixture), ['A']);
});

test('the fallback also hides excluded files and honours recentLimit', async () => {
  const fixture = await createFixture({
    paths: ['A.md', 'B.md', 'C.md'],
    lastOpen: ['A.md', 'B.md', 'C.md'],
    ignored: ['A.md'],
    recentLimit: 1,
  });
  assert.deepEqual(recentTitles(fixture), ['B']);
});

/* ── Keyboard navigation of recents ── */
const threeRecents = () => createFixture({
  paths: ['A.md', 'B.md', 'C.md'],
  history: { 'A.md': 300, 'B.md': 200, 'C.md': 100 },
});

test('with an empty query nothing is selected at first', async () => {
  const fixture = await threeRecents();
  assert.equal(fixture.view.selected, -1);
  assert.equal(selectedRows(fixture).length, 0);
});

test('ArrowDown walks the recents and wraps around', async () => {
  const fixture = await threeRecents();
  const order = [];
  for (let i = 0; i < 4; i++) {
    fixture.view.onKeyDown(key('ArrowDown'));
    order.push(recentRows(fixture).findIndex((row) => row.classes.has('is-selected')));
  }
  assert.deepEqual(order, [0, 1, 2, 0]);
  assert.equal(selectedRows(fixture).length, 1);
});

test('ArrowUp starts at the last recent and wraps around', async () => {
  const fixture = await threeRecents();
  const order = [];
  for (let i = 0; i < 4; i++) {
    fixture.view.onKeyDown(key('ArrowUp'));
    order.push(recentRows(fixture).findIndex((row) => row.classes.has('is-selected')));
  }
  assert.deepEqual(order, [2, 1, 0, 2]);
});

test('Enter opens the selected recent in the current leaf', async () => {
  const fixture = await threeRecents();
  fixture.view.onKeyDown(key('ArrowDown'));
  fixture.view.onKeyDown(key('ArrowDown'));
  fixture.view.onKeyDown(key('Enter'));
  await Promise.resolve();
  assert.deepEqual(fixture.opened, ['B.md']);
  assert.deepEqual(fixture.leafCalls, []);
});

test('Mod+Enter opens the selected recent in a new tab', async () => {
  const fixture = await threeRecents();
  fixture.view.onKeyDown(key('ArrowDown'));
  fixture.view.onKeyDown(key('Enter', { mode: 'tab' }));
  await Promise.resolve();
  assert.deepEqual(fixture.opened, ['new:A.md']);
  assert.deepEqual(fixture.leafCalls, ['tab']);
});

test('Enter with an empty query and nothing selected opens nothing', async () => {
  const fixture = await threeRecents();
  fixture.view.onKeyDown(key('Enter'));
  await Promise.resolve();
  assert.deepEqual(fixture.opened, []);
});

test('arrow keys do nothing harmful when there are no recents', async () => {
  const fixture = await createFixture({});
  fixture.view.onKeyDown(key('ArrowDown'));
  fixture.view.onKeyDown(key('ArrowUp'));
  assert.equal(fixture.view.selected, -1);
  assert.equal(inputOf(fixture).attributes['aria-activedescendant'], undefined);
});

test('typing switches to search results and drops the recents selection', async () => {
  const fixture = await threeRecents();
  fixture.view.onKeyDown(key('ArrowDown'));
  fixture.view.onKeyDown(key('ArrowDown'));
  type(fixture, 'a');
  fixture.main.frames.flush();
  assert.equal(selectedRows(fixture).length, 0);
  assert.equal(recentRows(fixture)[1].attributes['aria-selected'], 'false');
  assert.equal(fixture.view.selected, 0); // first search result
  assert.equal(inputOf(fixture).attributes['aria-controls'], fixture.view.resultsEl.attributes.id);
  fixture.view.onKeyDown(key('Enter'));
  await Promise.resolve();
  assert.deepEqual(fixture.opened, ['A.md']);
});

test('ArrowDown right after typing navigates the results, not the recents', async () => {
  const fixture = await threeRecents();
  type(fixture, 'b');
  fixture.view.onKeyDown(key('ArrowDown'));
  assert.equal(selectedRows(fixture).length, 0);
  assert.ok(fixture.view.items[fixture.view.selected]);
});

test('clearing the query returns to the recents with no selection', async () => {
  const fixture = await threeRecents();
  type(fixture, 'a');
  fixture.main.frames.flush();
  type(fixture, '');
  fixture.main.frames.flush();
  assert.equal(fixture.view.selected, -1);
  assert.equal(selectedRows(fixture).length, 0);
  assert.equal(inputOf(fixture).attributes['aria-controls'], fixture.view.recentEl.attributes.id);
  assert.equal(inputOf(fixture).attributes['aria-activedescendant'], undefined);
  fixture.view.onKeyDown(key('ArrowDown'));
  assert.equal(selectedRows(fixture).length, 1);
  assert.equal(recentRows(fixture)[0].classes.has('is-selected'), true);
});

test('Escape clears the query and the recents have no selection', async () => {
  const fixture = await threeRecents();
  type(fixture, 'a');
  fixture.main.frames.flush();
  fixture.view.onKeyDown(key('Escape'));
  assert.equal(fixture.view.inputEl.value, '');
  assert.equal(fixture.view.selected, -1);
  assert.equal(selectedRows(fixture).length, 0);
  assert.equal(inputOf(fixture).attributes['aria-activedescendant'], undefined);
});

test('re-rendering the recents while searching keeps the search selection', async () => {
  const fixture = await threeRecents();
  type(fixture, 'a');
  fixture.main.frames.flush();
  fixture.view.onKeyDown(key('ArrowDown'));
  const selected = fixture.view.selected;
  fixture.view.renderRecent();
  assert.equal(fixture.view.selected, selected);
  assert.equal(inputOf(fixture).attributes['aria-activedescendant'], fixture.view.items[selected].el.attributes.id);
});

test('hovering a recent row selects it', async () => {
  const fixture = await threeRecents();
  recentRows(fixture)[2].dispatch('mousemove', {});
  assert.equal(fixture.view.selected, 2);
  assert.equal(recentRows(fixture)[2].classes.has('is-selected'), true);
  recentRows(fixture)[0].dispatch('mousemove', {});
  assert.equal(selectedRows(fixture).length, 1);
  assert.equal(recentRows(fixture)[0].classes.has('is-selected'), true);
});

test('clicking a recent row opens it, Mod+click in a new tab', async () => {
  const fixture = await threeRecents();
  recentRows(fixture)[1].dispatch('click', {});
  recentRows(fixture)[2].dispatch('click', { mode: 'tab' });
  await Promise.resolve();
  assert.deepEqual(fixture.opened, ['B.md', 'new:C.md']);
});

/* ── ARIA ── */
test('the input is a combobox wired to the visible list', async () => {
  const fixture = await threeRecents();
  const { attributes } = inputOf(fixture);
  assert.equal(attributes.role, 'combobox');
  assert.equal(attributes['aria-autocomplete'], 'list');
  assert.equal(attributes['aria-expanded'], 'true');
  assert.equal(attributes['aria-controls'], fixture.view.recentEl.attributes.id);
  assert.equal(attributes['aria-activedescendant'], undefined);
});

test('aria-expanded is false when there is nothing to show', async () => {
  const fixture = await createFixture({});
  assert.equal(inputOf(fixture).attributes['aria-expanded'], 'false');
});

test('both lists are listboxes with ids and labels', async () => {
  const fixture = await threeRecents();
  const { resultsEl, recentEl } = fixture.view;
  assert.equal(resultsEl.attributes.role, 'listbox');
  assert.equal(recentEl.attributes.role, 'listbox');
  assert.ok(resultsEl.attributes.id);
  assert.ok(recentEl.attributes.id);
  assert.notEqual(resultsEl.attributes.id, recentEl.attributes.id);
  assert.ok(resultsEl.attributes['aria-label']);
  assert.ok(recentEl.attributes['aria-label']);
});

test('recent rows are options with unique ids and aria-selected in sync', async () => {
  const fixture = await threeRecents();
  const rows = recentRows(fixture);
  assert.deepEqual(rows.map((row) => row.attributes.role), ['option', 'option', 'option']);
  assert.equal(new Set(rows.map((row) => row.attributes.id)).size, 3);
  assert.deepEqual(rows.map((row) => row.attributes['aria-selected']), ['false', 'false', 'false']);

  fixture.view.onKeyDown(key('ArrowDown'));
  assert.deepEqual(rows.map((row) => row.attributes['aria-selected']), ['true', 'false', 'false']);
  assert.equal(inputOf(fixture).attributes['aria-activedescendant'], rows[0].attributes.id);

  fixture.view.onKeyDown(key('ArrowDown'));
  assert.deepEqual(rows.map((row) => row.attributes['aria-selected']), ['false', 'true', 'false']);
  assert.equal(inputOf(fixture).attributes['aria-activedescendant'], rows[1].attributes.id);
});

test('result rows, including the action rows, are options with unique ids', async () => {
  const fixture = await threeRecents();
  type(fixture, 'a');
  fixture.main.frames.flush();
  const { items, resultsEl } = fixture.view;
  assert.ok(items.length >= 2);
  assert.ok(items.every((item) => item.el.attributes.role === 'option'));
  assert.equal(new Set(items.map((item) => item.el.attributes.id)).size, items.length);
  assert.ok(items.every((item, index) => item.el.attributes['aria-selected'] === String(index === 0)));
  assert.equal(inputOf(fixture).attributes['aria-activedescendant'], items[0].el.attributes.id);
  assert.equal(inputOf(fixture).attributes['aria-controls'], resultsEl.attributes.id);
  assert.equal(inputOf(fixture).attributes['aria-expanded'], 'true');

  fixture.view.onKeyDown(key('ArrowDown'));
  assert.equal(items[0].el.attributes['aria-selected'], 'false');
  assert.equal(items[1].el.attributes['aria-selected'], 'true');
  assert.equal(inputOf(fixture).attributes['aria-activedescendant'], items[1].el.attributes.id);
});

test('ids are unique per view instance', async () => {
  const main = loadMain({ animationFrames: true });
  const first = await createFixture({ main, paths: ['A.md'], history: { 'A.md': 1 } });
  const second = await createFixture({ main, paths: ['A.md'], history: { 'A.md': 1 } });
  const idsOf = (fixture) => [fixture.view.resultsEl, fixture.view.recentEl, ...recentRows(fixture)].map((el) => el.attributes.id);
  const all = [...idsOf(first), ...idsOf(second)];
  assert.equal(new Set(all).size, all.length);
});

/* ── Hover preview ── */
test('file search results trigger hover-link on mouseover', async () => {
  const fixture = await createFixture({ paths: ['notes/Alpha.md', 'Beta.md'] });
  type(fixture, 'alpha');
  fixture.main.frames.flush();
  const item = fixture.view.items[0];
  const event = { type: 'mouseover' };
  item.el.dispatch('mouseover', event);
  assert.equal(fixture.hoverEvents.length, 1);
  const { name, payload } = fixture.hoverEvents[0];
  assert.equal(name, 'hover-link');
  assert.deepEqual(
    { source: payload.source, hoverParent: payload.hoverParent, targetEl: payload.targetEl, linktext: payload.linktext, event: payload.event },
    { source: 'foyer', hoverParent: fixture.view, targetEl: item.el, linktext: 'notes/Alpha.md', event },
  );
});

test('recent rows trigger hover-link with the same payload shape', async () => {
  const fixture = await createFixture({ paths: ['notes/Alpha.md'], history: { 'notes/Alpha.md': 1 } });
  const row = recentRows(fixture)[0];
  const event = { type: 'mouseover' };
  row.dispatch('mouseover', event);
  assert.equal(fixture.hoverEvents.length, 1);
  const { name, payload } = fixture.hoverEvents[0];
  assert.equal(name, 'hover-link');
  assert.deepEqual(Object.keys(payload).sort(), ['event', 'hoverParent', 'linktext', 'source', 'targetEl']);
  assert.deepEqual(
    { source: payload.source, hoverParent: payload.hoverParent, targetEl: payload.targetEl, linktext: payload.linktext, event: payload.event },
    { source: 'foyer', hoverParent: fixture.view, targetEl: row, linktext: 'notes/Alpha.md', event },
  );
});

test('the search-content and create-note rows do not trigger hover-link', async () => {
  const fixture = await createFixture({ paths: ['Alpha.md'] });
  type(fixture, 'alp');
  fixture.main.frames.flush();
  const actionItems = fixture.view.items.filter((item) => item.el.classes.has('foyer__item--action'));
  assert.equal(actionItems.length, 2);
  for (const item of actionItems) item.el.dispatch('mouseover', {});
  assert.equal(fixture.hoverEvents.length, 0);
});
