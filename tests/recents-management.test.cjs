'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createViewFixture, optionRows, rowTitle, sections } = require('./support/view-fixture.cjs');
const { plain, loadedPlugin } = require('./support/plugin-fixture.cjs');
const { loadMain } = require('./support/load-main.cjs');

const key = (name, extra = {}) => ({ key: name, preventDefault() {}, ...extra });
const removeButton = (row) => row.children.find((child) => child.classes.has('foyer__row-remove'));
const selectedTitle = (fixture) => {
  const row = optionRows(fixture.view).find((el) => el.classes.has('is-selected'));
  return row ? rowTitle(row) : null;
};

const threeRecents = (extra = {}) => createViewFixture({
  paths: ['A.md', 'B.md', 'C.md', 'P.md'],
  history: { 'A.md': 300, 'B.md': 200, 'C.md': 100 },
  ...extra,
});

/* ── The ✕ button ── */
test('every Recent row has a remove button with an accessible label; Pinned rows have none', async () => {
  const fixture = await threeRecents({ pinned: ['P.md'] });
  const [pinnedRow, ...recentRows] = optionRows(fixture.view);
  assert.equal(removeButton(pinnedRow), undefined);
  assert.equal(recentRows.length, 3);
  for (const row of recentRows) {
    const button = removeButton(row);
    assert.ok(button, 'remove button');
    assert.equal(button.attributes['aria-label'], 'Remove from Recent');
    assert.equal(button.attributes.title, 'Remove from Recent');
    assert.equal(button.attributes.type, 'button');
    assert.equal(button.attributes.tabindex, '-1');
  }
});

test('clicking ✕ removes only that history entry and does not open the note', async () => {
  const fixture = await threeRecents();
  const stopped = [];
  removeButton(optionRows(fixture.view)[1]).dispatch('click', { stopPropagation: () => stopped.push('click') });
  await Promise.resolve();
  assert.deepEqual(fixture.removed, ['B.md']);
  assert.deepEqual(sections(fixture.view), [{ head: 'Recent', rows: ['A', 'C'] }]);
  assert.deepEqual(fixture.opened, []);
  assert.deepEqual(stopped, ['click']);
  assert.equal(fixture.files.size, 4); // the file itself is untouched
});

test('a middle click on ✕ does not bubble up to the row', async () => {
  const fixture = await threeRecents();
  const stopped = [];
  removeButton(optionRows(fixture.view)[0]).dispatch('auxclick', { button: 1, stopPropagation: () => stopped.push('aux') });
  assert.deepEqual(stopped, ['aux']);
});

/* ── The Delete key ── */
test('Delete removes the selected Recent row and selects the one that takes its place', async () => {
  const fixture = await threeRecents();
  fixture.view.onKeyDown(key('ArrowDown'));
  fixture.view.onKeyDown(key('ArrowDown')); // B
  let prevented = false;
  fixture.view.onKeyDown(key('Delete', { preventDefault: () => { prevented = true; } }));
  assert.equal(prevented, true);
  assert.deepEqual(fixture.removed, ['B.md']);
  assert.deepEqual(sections(fixture.view), [{ head: 'Recent', rows: ['A', 'C'] }]);
  assert.equal(selectedTitle(fixture), 'C');
  assert.equal(fixture.view.inputEl.attributes['aria-activedescendant'], optionRows(fixture.view)[1].attributes.id);
});

test('Delete on the last row selects the new last row; on the only row it clears the selection', async () => {
  const fixture = await threeRecents();
  fixture.view.onKeyDown(key('ArrowUp')); // C (last)
  fixture.view.onKeyDown(key('Delete'));
  assert.equal(selectedTitle(fixture), 'B');
  fixture.view.onKeyDown(key('Delete'));
  assert.equal(selectedTitle(fixture), 'A');
  fixture.view.onKeyDown(key('Delete'));
  assert.equal(fixture.view.selected, -1);
  assert.equal(fixture.view.inputEl.attributes['aria-activedescendant'], undefined);
  assert.deepEqual(fixture.removed, ['C.md', 'B.md', 'A.md']);
});

test('Delete does nothing on a pinned row, with nothing selected, or while searching', async () => {
  const fixture = await threeRecents({ pinned: ['P.md'] });
  fixture.view.onKeyDown(key('Delete')); // nothing selected
  fixture.view.onKeyDown(key('ArrowDown')); // P (pinned)
  let prevented = false;
  fixture.view.onKeyDown(key('Delete', { preventDefault: () => { prevented = true; } }));
  assert.equal(prevented, false);
  assert.deepEqual(fixture.removed, []);

  fixture.view.onKeyDown(key('ArrowDown')); // A
  fixture.view.inputEl.value = 'a';
  fixture.view.onKeyDown(key('Delete'));
  assert.deepEqual(fixture.removed, []);
});

/* ── Fallback rows ── */
test('a note from the Obsidian fallback does not come back after it is removed', async () => {
  const fixture = await createViewFixture({ paths: ['A.md', 'B.md'], lastOpen: ['A.md', 'B.md'] });
  assert.deepEqual(sections(fixture.view), [{ head: 'Recent', rows: ['A', 'B'] }]);
  removeButton(optionRows(fixture.view)[0]).dispatch('click', { stopPropagation() {} });
  assert.deepEqual(sections(fixture.view), [{ head: 'Recent', rows: ['B'] }]);
});

test('a dismissed note shows up again once it is opened again', async () => {
  const fixture = await createViewFixture({ paths: ['A.md', 'B.md'], lastOpen: ['A.md', 'B.md'] });
  removeButton(optionRows(fixture.view)[0]).dispatch('click', { stopPropagation() {} });
  fixture.plugin.openHistory['A.md'] = 5; // what the file-open handler does
  fixture.plugin.dismissedRecent.delete('A.md');
  fixture.view.renderRecent();
  assert.deepEqual(sections(fixture.view), [{ head: 'Recent', rows: ['A'] }]);
});

/* ── Plugin: remove and clear ── */
const refreshSpy = () => {
  const calls = [];
  return { calls, leaf: { view: { refreshSettings: () => calls.push('refresh') } } };
};

test('removeFromHistory drops one entry, saves it per device and refreshes the views', async () => {
  const spy = refreshSpy();
  const f = await loadedPlugin({ local: { 'a.md': 1, 'b.md': 2 }, leaves: [spy.leaf] });
  assert.equal(f.plugin.removeFromHistory('a.md'), true);
  assert.equal(f.plugin.getLastOpened('a.md'), null);
  assert.equal(f.plugin.getLastOpened('b.md'), 2);
  assert.equal(f.plugin.dismissedRecent.has('a.md'), true);
  assert.deepEqual(spy.calls, ['refresh']);

  f.plugin.saveHistorySoon.run();
  assert.deepEqual(f.localWrites.at(-1).value, { 'b.md': 2 });
  assert.equal(f.saved.length, 0); // data.json is never written
  assert.equal(f.plugin.removeFromHistory('zzz.md'), false);
});

test('clearHistory empties the history, saves it at once, shows a Notice and refreshes the views', async () => {
  const spy = refreshSpy();
  const f = await loadedPlugin({ local: { 'a.md': 1, 'b.md': 2 }, lastOpen: ['x.md', 'y.md'], leaves: [spy.leaf] });
  f.plugin.clearHistory();
  assert.deepEqual(plain(f.plugin.openHistory), {});
  assert.deepEqual(f.localWrites.at(-1), { key: 'foyer-open-history', value: {} });
  assert.deepEqual(f.main.notices, ['Recent history cleared.']);
  assert.deepEqual(spy.calls, ['refresh']);
  assert.equal(f.plugin.dismissedRecent.has('x.md') && f.plugin.dismissedRecent.has('y.md'), true);
  assert.equal(f.saved.length, 0);
});

test('clearing never touches pinned notes', async () => {
  const f = await loadedPlugin({ data: { pinned: ['a.md'] }, local: { 'a.md': 1 } });
  f.plugin.clearHistory();
  assert.deepEqual(plain(f.plugin.settings.pinned), ['a.md']);
});

test('the Notice is Spanish when the interface is Spanish', async () => {
  const f = await loadedPlugin({ data: { language: 'es' } });
  f.plugin.clearHistory();
  assert.deepEqual(f.main.notices, ['Historial de Recientes borrado.']);
});

test('the "Clear Recent history" command is registered', async () => {
  const f = await loadedPlugin({ local: { 'a.md': 1 } });
  assert.equal(f.commands['clear-history'].name, 'Clear Recent history');
  f.commands['clear-history'].callback();
  assert.deepEqual(plain(f.plugin.openHistory), {});
  assert.deepEqual(f.main.notices, ['Recent history cleared.']);
});

test('the settings tab has a button that clears the history', async () => {
  const f = await loadedPlugin({ local: { 'a.md': 1 } });
  const tab = new f.main.HomeSettingTab(f.plugin.app, f.plugin);
  f.main.settingsLog.length = 0;
  tab.display();
  const strings = f.main.settingsModule.STRINGS.en;
  const setting = f.main.settingsLog.find((entry) => entry.name === strings.settingsClearHistory);
  assert.ok(setting, 'setting row');
  assert.equal(setting.desc, strings.settingsClearHistoryDescription);
  const button = setting.components.find((component) => component.type === 'button');
  button.clickHandler();
  assert.deepEqual(plain(f.plugin.openHistory), {});
  assert.deepEqual(f.main.notices, ['Recent history cleared.']);
});

test('the new strings exist in both languages', () => {
  const { settingsModule } = loadMain();
  const { es, en } = settingsModule.STRINGS;
  const keys = ['removeFromRecent', 'commandClearHistory', 'historyCleared', 'settingsClearHistory',
    'settingsClearHistoryDescription', 'clearHistoryButton'];
  for (const k of keys) {
    assert.equal(typeof es[k], 'string', `es.${k}`);
    assert.equal(typeof en[k], 'string', `en.${k}`);
    assert.notEqual(es[k], en[k], k);
  }
});
