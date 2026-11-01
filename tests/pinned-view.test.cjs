'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadMain } = require('./support/load-main.cjs');
const { createViewFixture, optionRows, recentGroupOf, rowTitle, sectionHeads, sections } = require('./support/view-fixture.cjs');

const key = (name, extra = {}) => ({ key: name, preventDefault() {}, ...extra });
const selectedTitles = (fixture) => optionRows(fixture.view)
  .filter((row) => row.classes.has('is-selected'))
  .map(rowTitle);

/* ── Rendering ── */
test('pinned notes appear in a Pinned section above Recent', async () => {
  const fixture = await createViewFixture({
    paths: ['A.md', 'B.md', 'C.md'],
    history: { 'A.md': 300, 'B.md': 200, 'C.md': 100 },
    pinned: ['C.md'],
  });
  assert.deepEqual(sections(fixture.view), [
    { head: 'Pinned', rows: ['C'] },
    { head: 'Recent', rows: ['A', 'B'] },
  ]);
});

test('without pinned notes there is no Pinned section', async () => {
  const fixture = await createViewFixture({ paths: ['A.md'], history: { 'A.md': 1 } });
  assert.deepEqual(sections(fixture.view), [{ head: 'Recent', rows: ['A'] }]);
});

test('pinned notes keep their pinning order, not the history order', async () => {
  const fixture = await createViewFixture({
    paths: ['A.md', 'B.md', 'C.md'],
    history: { 'A.md': 300, 'B.md': 200, 'C.md': 100 },
    pinned: ['C.md', 'A.md'],
  });
  assert.deepEqual(sections(fixture.view)[0], { head: 'Pinned', rows: ['C', 'A'] });
});

test('pinned notes that are missing, folders, hidden or excluded are skipped', async () => {
  const fixture = await createViewFixture({
    paths: ['A.md', 'Excluded.md', 'Hidden/.secret.md'],
    extra: { Folder: new (loadMain().TFolder)('Folder') },
    ignored: ['Excluded.md'],
    pinned: ['Gone.md', 'Folder', 'Excluded.md', 'Hidden/.secret.md', 'A.md'],
  });
  assert.deepEqual(sections(fixture.view)[0], { head: 'Pinned', rows: ['A'] });
  assert.equal(fixture.plugin.settings.pinned.length, 5); // rendering never prunes the setting
});

test('a pinned note is not repeated in Recent and the Recent limit still applies to Recent', async () => {
  const fixture = await createViewFixture({
    paths: ['A.md', 'B.md', 'C.md', 'D.md'],
    history: { 'A.md': 4, 'B.md': 3, 'C.md': 2, 'D.md': 1 },
    pinned: ['A.md'],
    recentLimit: 2,
  });
  assert.deepEqual(sections(fixture.view), [
    { head: 'Pinned', rows: ['A'] },
    { head: 'Recent', rows: ['B', 'C'] },
  ]);
});

test('pinned rows have no limit of their own', async () => {
  const paths = Array.from({ length: 12 }, (_, i) => `N${i}.md`);
  const fixture = await createViewFixture({ paths, pinned: paths, recentLimit: 3 });
  assert.equal(sections(fixture.view)[0].rows.length, 12);
});

test('when everything in the history is pinned the Recent section is omitted', async () => {
  const fixture = await createViewFixture({
    paths: ['A.md', 'B.md', 'Other.md'],
    history: { 'A.md': 2, 'B.md': 1 },
    pinned: ['A.md', 'B.md'],
    lastOpen: ['Other.md'],
  });
  assert.deepEqual(sections(fixture.view), [{ head: 'Pinned', rows: ['A', 'B'] }]);
  assert.equal(recentGroupOf(fixture.view), null);
});

test('the Obsidian fallback also leaves out pinned notes', async () => {
  const fixture = await createViewFixture({
    paths: ['A.md', 'B.md'],
    lastOpen: ['A.md', 'B.md'],
    pinned: ['A.md'],
  });
  assert.deepEqual(sections(fixture.view), [
    { head: 'Pinned', rows: ['A'] },
    { head: 'Recent', rows: ['B'] },
  ]);
});

test('with no pinned notes and no history the empty message is still shown under Recent', async () => {
  const fixture = await createViewFixture({});
  assert.deepEqual(sections(fixture.view), [{ head: 'Recent', rows: [] }]);
  assert.equal(recentGroupOf(fixture.view).children.some((el) => el.classes.has('foyer__empty')), true);
});

test('pinned notes with an empty Recent show only the Pinned section', async () => {
  const fixture = await createViewFixture({ paths: ['A.md'], pinned: ['A.md'] });
  assert.deepEqual(sections(fixture.view), [{ head: 'Pinned', rows: ['A'] }]);
});

test('refreshSettings picks up a changed pinned list', async () => {
  const fixture = await createViewFixture({ paths: ['A.md', 'B.md'], history: { 'A.md': 2, 'B.md': 1 } });
  assert.equal(sectionHeads(fixture.view).length, 1);
  fixture.plugin.settings = { ...fixture.plugin.settings, pinned: [{ path: 'B.md', color: '' }] };
  fixture.view.refreshSettings();
  assert.deepEqual(sections(fixture.view), [
    { head: 'Pinned', rows: ['B'] },
    { head: 'Recent', rows: ['A'] },
  ]);
});

test('section headings are presentational and Spanish labels exist', async () => {
  const fixture = await createViewFixture({ paths: ['A.md', 'B.md'], history: { 'A.md': 2 }, pinned: ['B.md'] });
  assert.ok(sectionHeads(fixture.view).every((head) => head.attributes.role === 'presentation'));
  const { es } = fixture.main.settingsModule.STRINGS;
  assert.equal(es.pinned, 'Fijadas');
});

/* ── One listbox: keyboard and ARIA ── */
const mixed = () => createViewFixture({
  paths: ['P1.md', 'P2.md', 'R1.md', 'R2.md'],
  history: { 'R1.md': 20, 'R2.md': 10 },
  pinned: ['P1.md', 'P2.md'],
});

test('ArrowDown walks Pinned then Recent and wraps around', async () => {
  const fixture = await mixed();
  const order = [];
  for (let i = 0; i < 5; i++) {
    fixture.view.onKeyDown(key('ArrowDown'));
    order.push(selectedTitles(fixture)[0]);
  }
  assert.deepEqual(order, ['P1', 'P2', 'R1', 'R2', 'P1']);
  assert.equal(selectedTitles(fixture).length, 1);
});

test('ArrowUp starts at the last Recent row and walks back through Pinned', async () => {
  const fixture = await mixed();
  const order = [];
  for (let i = 0; i < 5; i++) {
    fixture.view.onKeyDown(key('ArrowUp'));
    order.push(selectedTitles(fixture)[0]);
  }
  assert.deepEqual(order, ['R2', 'R1', 'P2', 'P1', 'R2']);
});

test('Enter opens the selected pinned note, Mod+Enter in a new tab', async () => {
  const fixture = await mixed();
  fixture.view.onKeyDown(key('ArrowDown'));
  fixture.view.onKeyDown(key('Enter'));
  fixture.view.onKeyDown(key('ArrowDown'));
  fixture.view.onKeyDown(key('Enter', { mode: 'tab' }));
  await Promise.resolve();
  assert.deepEqual(fixture.opened, ['P1.md', 'new:P2.md']);
  assert.deepEqual(fixture.leafCalls, ['tab']);
});

test('Pinned and Recent are one listbox with unique option ids and a live aria-activedescendant', async () => {
  const fixture = await mixed();
  const { view } = fixture;
  const input = view.inputEl;
  const rows = optionRows(view);
  assert.equal(rows.length, 4);
  assert.equal(view.recentEl.attributes.role, 'listbox');
  assert.equal(input.attributes['aria-controls'], view.recentEl.attributes.id);
  assert.equal(input.attributes['aria-expanded'], 'true');
  assert.equal(new Set(rows.map((row) => row.attributes.id)).size, 4);
  assert.deepEqual(rows.map((row) => row.attributes.role), ['option', 'option', 'option', 'option']);

  for (let i = 0; i < 3; i++) view.onKeyDown(key('ArrowDown'));
  assert.equal(input.attributes['aria-activedescendant'], rows[2].attributes.id);
  assert.deepEqual(rows.map((row) => row.attributes['aria-selected']), ['false', 'false', 'true', 'false']);
});

test('the listbox is labelled with both sections when pinned notes exist', async () => {
  const fixture = await mixed();
  assert.equal(fixture.view.recentEl.attributes['aria-label'], 'Pinned, Recent');
  const plain = await createViewFixture({ paths: ['A.md'], history: { 'A.md': 1 } });
  assert.equal(plain.view.recentEl.attributes['aria-label'], 'Recent');
});

test('hovering a pinned row selects it and triggers hover-link', async () => {
  const fixture = await mixed();
  const row = optionRows(fixture.view)[1];
  row.dispatch('mousemove', {});
  assert.equal(fixture.view.selected, 1);
  row.dispatch('mouseover', { type: 'mouseover' });
  assert.equal(fixture.hoverEvents.length, 1);
  assert.equal(fixture.hoverEvents[0].payload.linktext, 'P2.md');
});
