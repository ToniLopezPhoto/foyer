'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { loadMain } = require('./support/load-main.cjs');
const { plain, loadedPlugin } = require('./support/plugin-fixture.cjs');
const { createViewFixture, boardOf, cardsOf, recentGroupOf, sections } = require('./support/view-fixture.cjs');

const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/* ── Settings ── */
test('every part of the home is shown by default, stacked', () => {
  const { settingsModule } = loadMain();
  const settings = plain(settingsModule.normalizeSettings(null));
  assert.deepEqual(
    [settings.showGreeting, settings.showSearch, settings.showPinned, settings.showRecent, settings.layout],
    [true, true, true, true, 'stacked'],
  );
});

test('valid section settings are kept', () => {
  const { settingsModule } = loadMain();
  const settings = plain(settingsModule.normalizeSettings({
    showGreeting: false, showSearch: false, showPinned: false, showRecent: false, layout: 'columns',
  }));
  assert.deepEqual(
    [settings.showGreeting, settings.showSearch, settings.showPinned, settings.showRecent, settings.layout],
    [false, false, false, false, 'columns'],
  );
});

test('wrong types fall back to the defaults', () => {
  const { settingsModule } = loadMain();
  const settings = plain(settingsModule.normalizeSettings({
    showGreeting: 'no', showSearch: 0, showPinned: null, showRecent: [], layout: 'grid',
  }));
  assert.deepEqual(
    [settings.showGreeting, settings.showSearch, settings.showPinned, settings.showRecent, settings.layout],
    [true, true, true, true, 'stacked'],
  );
});

test('the new labels exist in both languages', () => {
  const { settingsModule } = loadMain();
  const { es, en } = settingsModule.STRINGS;
  const keys = ['settingsShowGreeting', 'settingsShowGreetingDescription', 'settingsShowSearch', 'settingsShowSearchDescription',
    'settingsShowPinned', 'settingsShowPinnedDescription', 'settingsShowRecent', 'settingsShowRecentDescription',
    'settingsLayout', 'settingsLayoutDescription', 'layoutStacked', 'layoutColumns'];
  for (const key of keys) {
    assert.ok(es[key] && en[key], key);
    assert.notEqual(es[key], en[key], key);
  }
});

/* ── The settings tab ── */
async function displayTab(data = {}) {
  const f = await loadedPlugin({ data });
  const tab = new f.main.HomeSettingTab(f.plugin.app, f.plugin);
  f.main.settingsLog.length = 0;
  tab.display();
  const strings = f.main.settingsModule.STRINGS.en;
  const row = (key) => f.main.settingsLog.find((setting) => setting.name === strings[key]);
  return { f, strings, row };
}
const control = (setting, type) => setting.components.find((component) => component.type === type);

test('the tab has a toggle for each part and a layout dropdown, starting from the saved values', async () => {
  const { row, strings } = await displayTab({ showGreeting: false, showPinned: false, layout: 'columns' });
  const toggles = { settingsShowGreeting: false, settingsShowSearch: true, settingsShowPinned: false, settingsShowRecent: true };
  for (const [key, value] of Object.entries(toggles)) {
    assert.ok(row(key), key);
    assert.equal(row(key).desc, strings[`${key}Description`]);
    assert.equal(control(row(key), 'toggle').value, value, key);
  }
  const layout = control(row('settingsLayout'), 'dropdown');
  assert.deepEqual(plain(layout.options), [['stacked', strings.layoutStacked], ['columns', strings.layoutColumns]]);
  assert.equal(layout.value, 'columns');
});

test('changing the toggles and the layout saves through updateSetting', async () => {
  const { f, row } = await displayTab();
  await control(row('settingsShowGreeting'), 'toggle').changeHandler(false);
  await control(row('settingsShowSearch'), 'toggle').changeHandler(false);
  await control(row('settingsShowPinned'), 'toggle').changeHandler(false);
  await control(row('settingsShowRecent'), 'toggle').changeHandler(false);
  await control(row('settingsLayout'), 'dropdown').changeHandler('columns');
  const last = f.saved.at(-1);
  assert.deepEqual(
    [last.showGreeting, last.showSearch, last.showPinned, last.showRecent, last.layout],
    [false, false, false, false, 'columns'],
  );
});

/* ── The view ── */
const withPins = (settings, extra = {}) => createViewFixture({
  paths: ['A.md', 'B.md', 'P.md'],
  history: { 'B.md': 20, 'A.md': 10 },
  pinned: ['P.md'],
  settings,
  ...extra,
});

test('the greeting block is hidden or shown from the setting, live', async () => {
  const fixture = await withPins({});
  assert.equal(fixture.view.heroEl.hidden, false);
  fixture.plugin.settings = { ...fixture.plugin.settings, showGreeting: false };
  fixture.view.refreshSettings();
  assert.equal(fixture.view.heroEl.hidden, true);
  fixture.plugin.settings = { ...fixture.plugin.settings, showGreeting: true };
  fixture.view.refreshSettings();
  assert.equal(fixture.view.heroEl.hidden, false);
});

test('the search box is hidden from the setting', async () => {
  const hidden = await withPins({ showSearch: false });
  assert.equal(hidden.view.searchEl.hidden, true);
  const shown = await withPins({});
  assert.equal(shown.view.searchEl.hidden, false);
});

test('without the search box nothing steals focus', async () => {
  const fixture = await withPins({ showSearch: false });
  const focused = [];
  fixture.view.inputEl.focus = () => focused.push('focus');
  fixture.view.app.workspace.getActiveViewOfType = () => fixture.view;
  fixture.view.focusInput();
  for (const timer of fixture.main.timers.timeouts) if (!timer.fired) { timer.fired = true; timer.fn(); }
  assert.deepEqual(focused, []);

  const shown = await withPins({});
  shown.view.inputEl.focus = () => focused.push('focus');
  shown.view.app.workspace.getActiveViewOfType = () => shown.view;
  shown.view.focusInput();
  for (const timer of shown.main.timers.timeouts) if (!timer.fired) { timer.fired = true; timer.fn(); }
  assert.ok(focused.length >= 1, 'focused when the search box is shown');
});

test('hiding pinned notes removes the board, shows them in Recent again and drops the pin buttons', async () => {
  const fixture = await withPins({ showPinned: false });
  assert.equal(boardOf(fixture.view), null);
  assert.deepEqual(sections(fixture.view), [{ head: 'Recent', rows: ['B', 'A'] }]);
  fixture.plugin.openHistory['P.md'] = 30;
  fixture.view.renderRecent();
  assert.deepEqual(sections(fixture.view), [{ head: 'Recent', rows: ['P', 'B', 'A'] }]);
  const rows = recentGroupOf(fixture.view).children.filter((el) => el.classes.has('foyer__row'));
  assert.equal(rows.some((row) => row.children.some((child) => child.classes.has('foyer__row-pin'))), false);
  assert.equal(fixture.plugin.settings.pinned.length, 1); // hiding never touches the data
});

test('hiding recent notes keeps only the board, with no empty message', async () => {
  const fixture = await withPins({ showRecent: false });
  assert.equal(recentGroupOf(fixture.view), null);
  assert.deepEqual(sections(fixture.view), [{ head: 'Pinned', rows: ['P'] }]);
  assert.equal(fixture.view.recentEl.attributes['aria-label'], 'Pinned');
  const empty = await createViewFixture({ settings: { showRecent: false } });
  assert.equal(recentGroupOf(empty.view), null);
  assert.deepEqual(empty.view.recentEl.children, []);
});

test('with pins and recents hidden the whole list area is hidden and the combobox is collapsed', async () => {
  const fixture = await withPins({ showPinned: false, showRecent: false });
  assert.deepEqual(fixture.view.recentEl.children, []);
  assert.equal(fixture.view.recentWrapEl.hidden, true);
  assert.equal(fixture.view.inputEl.attributes['aria-expanded'], 'false');
  const shown = await withPins({});
  assert.equal(shown.view.recentWrapEl.hidden, false);
});

test('keyboard navigation follows only what is shown', async () => {
  const fixture = await withPins({ showPinned: false });
  const key = (name) => ({ key: name, preventDefault() {} });
  const order = [];
  for (let i = 0; i < 3; i++) {
    fixture.view.onKeyDown(key('ArrowDown'));
    order.push(fixture.view.recentItems[fixture.view.selected].el.children[1].children[0].text);
  }
  assert.deepEqual(order, ['B', 'A', 'B']);
});

test('the two-column layout is a class on the page, set and removed live', async () => {
  const stacked = await withPins({});
  assert.equal(stacked.view.wrapEl.classes.has('is-columns'), false);
  const columns = await withPins({ layout: 'columns' });
  assert.equal(columns.view.wrapEl.classes.has('is-columns'), true);
  columns.plugin.settings = { ...columns.plugin.settings, layout: 'stacked' };
  columns.view.refreshSettings();
  assert.equal(columns.view.wrapEl.classes.has('is-columns'), false);
  assert.deepEqual(cardsOf(columns.view).length, 1);
});

/* ── CSS ── */
const rule = (selector) => {
  const found = [];
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectors.split(',').some((candidate) => candidate.trim() === selector)) found.push(body.trim());
  }
  return found.join('\n');
};

test('hidden parts really disappear', () => {
  for (const selector of ['.foyer__hero[hidden]', '.foyer__search[hidden]', '.foyer__recent[hidden]']) {
    assert.match(rule(selector), /display:\s*none/, selector);
  }
});

test('the two-column layout puts pins and recents side by side and collapses on narrow panes', () => {
  assert.match(rule('.is-columns .foyer__list'), /grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(rule('.is-columns .foyer__list > :only-child'), /grid-column:\s*1 \/ -1/);
  assert.match(rule('.is-columns .foyer__board + .foyer__recent-group'), /margin-top:\s*0/);
  assert.match(css, /@container foyer \(max-width: \d+px\)/);
  assert.match(rule('.foyer.view-content'), /container:\s*foyer \/ inline-size/);
  assert.match(css, /\.is-mobile \.is-columns \.foyer__list/);
});
