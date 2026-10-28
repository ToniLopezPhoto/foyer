'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadMain } = require('./support/load-main.cjs');
const { plain, createMenu, loadedPlugin } = require('./support/plugin-fixture.cjs');

const loaded = loadedPlugin;

// Pinned entries are { path, color }; most tests only care about the order of the paths.
const pathsOf = (pinned) => plain(pinned).map((entry) => entry.path);
const pinnedPaths = (f) => pathsOf(f.plugin.settings.pinned);

/* ── Settings ── */
test('DEFAULT_SETTINGS starts with an empty pinned list', () => {
  const { settingsModule } = loadMain();
  assert.deepEqual(plain(settingsModule.DEFAULT_SETTINGS.pinned), []);
});

test('normalizeSettings keeps a clean pinned list', () => {
  const { settingsModule } = loadMain();
  const pinned = settingsModule.normalizeSettings({ pinned: ['a.md', 'dir/b.md'] }).pinned;
  assert.deepEqual(plain(pinned), [{ path: 'a.md', color: '' }, { path: 'dir/b.md', color: '' }]);
});

test('normalizeSettings drops non-strings, empty strings and duplicates from pinned', () => {
  const { settingsModule } = loadMain();
  const pinned = settingsModule.normalizeSettings({ pinned: ['a.md', 3, '', null, 'a.md', { x: 1 }, 'b.md'] }).pinned;
  assert.deepEqual(pathsOf(pinned), ['a.md', 'b.md']);
});

test('normalizeSettings turns an invalid pinned value into an empty list', () => {
  const { settingsModule } = loadMain();
  for (const bad of [undefined, null, 'a.md', 5, { 'a.md': true }, true]) {
    assert.deepEqual(plain(settingsModule.normalizeSettings({ pinned: bad }).pinned), [], String(bad));
  }
  assert.deepEqual(plain(settingsModule.normalizeSettings(null).pinned), []);
});

test('normalizeSettings does not share the pinned array with its input', () => {
  const { settingsModule } = loadMain();
  const input = ['a.md'];
  const out = settingsModule.normalizeSettings({ pinned: input });
  out.pinned.push({ path: 'b.md', color: '' });
  assert.deepEqual(plain(input), ['a.md']);
});

/* ── Plugin API ── */
test('pinFile stores the path in data.json and leaves the open history alone', async () => {
  const f = await loaded();
  await f.plugin.pinFile('a.md');
  assert.deepEqual(pinnedPaths(f), ['a.md']);
  assert.equal(f.plugin.isPinned('a.md'), true);
  assert.equal(f.plugin.isPinned('b.md'), false);
  assert.equal(f.saved.length, 1);
  assert.deepEqual(pathsOf(f.saved[0].pinned), ['a.md']);
  assert.equal('openHistory' in f.saved[0], false);
  f.plugin.saveHistorySoon.run();
  assert.equal(f.localWrites.length, 0);
});

test('pinFile keeps the pinning order and ignores a note that is already pinned', async () => {
  const f = await loaded();
  await f.plugin.pinFile('a.md');
  await f.plugin.pinFile('b.md');
  await f.plugin.pinFile('a.md');
  assert.deepEqual(pinnedPaths(f), ['a.md', 'b.md']);
  assert.equal(f.saved.length, 2);
});

test('unpinFile removes the path and saves; unpinning an unknown path does nothing', async () => {
  const f = await loaded({ data: { pinned: ['a.md', 'b.md'] } });
  await f.plugin.unpinFile('a.md');
  assert.deepEqual(pinnedPaths(f), ['b.md']);
  assert.equal(f.saved.length, 1);
  await f.plugin.unpinFile('zzz.md');
  assert.equal(f.saved.length, 1);
});

test('pinned notes load from data.json on startup', async () => {
  const f = await loaded({ data: { pinned: ['a.md', 7, 'a.md'] } });
  assert.deepEqual(pinnedPaths(f), ['a.md']);
  assert.equal(f.saved.length, 0);
});

/* ── Rename and delete ── */
test('renaming a pinned file or a folder moves the pinned paths', async () => {
  const f = await loaded({ data: { pinned: ['a.md', 'dir/b.md', 'dir/sub/c.md', 'other.md'] } });
  await f.handlers['vault:rename']({ path: 'z.md' }, 'a.md');
  await f.handlers['vault:rename']({ path: 'renamed' }, 'dir');
  assert.deepEqual(pinnedPaths(f), ['z.md', 'renamed/b.md', 'renamed/sub/c.md', 'other.md']);
  assert.equal(f.saved.length, 2);
  assert.deepEqual(pathsOf(f.saved.pop().pinned), ['z.md', 'renamed/b.md', 'renamed/sub/c.md', 'other.md']);
});

test('a rename that touches no pinned path does not write data.json', async () => {
  const f = await loaded({ data: { pinned: ['a.md'] } });
  await f.handlers['vault:rename']({ path: 'y.md' }, 'x.md');
  assert.equal(f.saved.length, 0);
});

test('renaming a note onto an already pinned path does not duplicate it', async () => {
  const f = await loaded({ data: { pinned: ['a.md', 'b.md'] } });
  await f.handlers['vault:rename']({ path: 'b.md' }, 'a.md');
  assert.deepEqual(pinnedPaths(f), ['b.md']);
});

test('deleting a pinned file or a folder drops the pinned paths', async () => {
  const f = await loaded({ data: { pinned: ['a.md', 'dir/b.md', 'dir/sub/c.md', 'other.md'] } });
  await f.handlers['vault:delete']({ path: 'a.md' });
  await f.handlers['vault:delete']({ path: 'dir' });
  assert.deepEqual(pinnedPaths(f), ['other.md']);
  assert.equal(f.saved.length, 2);
});

test('a delete that touches no pinned path does not write data.json', async () => {
  const f = await loaded({ data: { pinned: ['a.md'] } });
  await f.handlers['vault:delete']({ path: 'x.md' });
  assert.equal(f.saved.length, 0);
});

test('rename and delete still update the open history', async () => {
  const f = await loaded({ local: { 'a.md': 5 } });
  f.handlers['vault:rename']({ path: 'z.md' }, 'a.md');
  assert.equal(f.plugin.getLastOpened('z.md'), 5);
});

/* ── Commands ── */
test('the pin and unpin commands are registered with checkCallback', async () => {
  const f = await loaded();
  for (const id of ['pin-current', 'unpin-current']) {
    assert.equal(typeof f.commands[id].checkCallback, 'function', id);
    assert.equal(f.commands[id].callback, undefined, id);
  }
  assert.equal(f.commands['pin-current'].name, 'Pin current note to Foyer');
  assert.equal(f.commands['unpin-current'].name, 'Unpin current note from Foyer');
});

test('pin-current is available only for a listed note that is not pinned', async () => {
  const f = await loaded({ active: 'a.md' });
  assert.equal(f.commands['pin-current'].checkCallback(true), true);
  assert.equal(f.commands['unpin-current'].checkCallback(true), false);
  assert.equal(f.saved.length, 0); // checking never acts

  f.activeFile.current = null;
  assert.equal(f.commands['pin-current'].checkCallback(true), false);
  f.activeFile.current = new f.main.TFile('.hidden/secret.md');
  assert.equal(f.commands['pin-current'].checkCallback(true), false);
});

test('running pin-current pins the active note; then only unpin-current applies', async () => {
  const f = await loaded({ active: 'dir/a.md' });
  assert.equal(f.commands['pin-current'].checkCallback(false), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(pinnedPaths(f), ['dir/a.md']);
  assert.equal(f.commands['pin-current'].checkCallback(true), false);
  assert.equal(f.commands['unpin-current'].checkCallback(true), true);

  assert.equal(f.commands['unpin-current'].checkCallback(false), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(pinnedPaths(f), []);
});

/* ── File menu ── */
test('the file menu offers "Pin to Foyer" for a listed unpinned file', async () => {
  const f = await loaded();
  const m = createMenu();
  f.handlers['workspace:file-menu'](m, new f.main.TFile('dir/a.md'));
  assert.equal(m.items.length, 1);
  assert.equal(m.items[0].title, 'Pin to Foyer');
  assert.equal(m.items[0].icon, 'pin');
  await m.items[0].click();
  assert.deepEqual(pinnedPaths(f), ['dir/a.md']);
});

test('the file menu offers "Unpin from Foyer" for a pinned file', async () => {
  const f = await loaded({ data: { pinned: ['a.md'] } });
  const m = createMenu();
  f.handlers['workspace:file-menu'](m, new f.main.TFile('a.md'));
  assert.equal(m.items.length, 1);
  assert.equal(m.items[0].title, 'Unpin from Foyer');
  assert.equal(m.items[0].icon, 'pin-off');
  await m.items[0].click();
  assert.deepEqual(pinnedPaths(f), []);
});

test('the file menu adds nothing for folders and hidden files', async () => {
  const f = await loaded();
  const folderMenu = createMenu();
  f.handlers['workspace:file-menu'](folderMenu, new f.main.TFolder('dir'));
  const hiddenMenu = createMenu();
  f.handlers['workspace:file-menu'](hiddenMenu, new f.main.TFile('.hidden/a.md'));
  assert.equal(folderMenu.items.length + hiddenMenu.items.length, 0);
});

test('menu strings exist in Spanish too', () => {
  const { settingsModule } = loadMain();
  const { es, en } = settingsModule.STRINGS;
  for (const key of ['pinned', 'pinToFoyer', 'unpinFromFoyer', 'commandPinCurrent', 'commandUnpinCurrent']) {
    assert.equal(typeof es[key], 'string', `es.${key}`);
    assert.equal(typeof en[key], 'string', `en.${key}`);
    assert.notEqual(es[key], en[key], key);
  }
});

/* ── Sticky-note board: entries with a color, stored order ── */
test('the palette has the eight theme colors, in a fixed order', () => {
  const { settingsModule } = loadMain();
  assert.deepEqual(plain(settingsModule.PIN_COLORS), ['yellow', 'orange', 'red', 'purple', 'blue', 'cyan', 'green', 'pink']);
});

test('normalizeSettings accepts pinned entries with a color', () => {
  const { settingsModule } = loadMain();
  const pinned = settingsModule.normalizeSettings({ pinned: [{ path: 'a.md', color: 'blue' }, { path: 'b.md', color: '' }] }).pinned;
  assert.deepEqual(plain(pinned), [{ path: 'a.md', color: 'blue' }, { path: 'b.md', color: '' }]);
});

test('normalizeSettings accepts the old string list next to the new entries', () => {
  const { settingsModule } = loadMain();
  const pinned = settingsModule.normalizeSettings({ pinned: ['a.md', { path: 'b.md', color: 'pink' }, 'c.md'] }).pinned;
  assert.deepEqual(plain(pinned), [
    { path: 'a.md', color: '' },
    { path: 'b.md', color: 'pink' },
    { path: 'c.md', color: '' },
  ]);
});

test('normalizeSettings drops invalid entries, repeated paths and unknown colors', () => {
  const { settingsModule } = loadMain();
  const pinned = settingsModule.normalizeSettings({
    pinned: [
      null, 3, [], '', { color: 'red' }, { path: '' }, { path: 5 },
      { path: 'a.md', color: 'chartreuse' },
      { path: 'a.md', color: 'red' },
      { path: 'b.md', color: 7 },
      { path: 'c.md', color: 'green', extra: true },
    ],
  }).pinned;
  assert.deepEqual(plain(pinned), [
    { path: 'a.md', color: '' },
    { path: 'b.md', color: '' },
    { path: 'c.md', color: 'green' },
  ]);
});

test('pinFile writes an entry without color', async () => {
  const f = await loaded();
  await f.plugin.pinFile('a.md');
  assert.deepEqual(plain(f.saved.at(-1).pinned), [{ path: 'a.md', color: '' }]);
});

test('setPinColor stores the color with the pin and keeps the order', async () => {
  const f = await loaded({ data: { pinned: ['a.md', 'b.md'] } });
  await f.plugin.setPinColor('b.md', 'purple');
  assert.deepEqual(plain(f.plugin.settings.pinned), [{ path: 'a.md', color: '' }, { path: 'b.md', color: 'purple' }]);
  assert.equal(f.saved.length, 1);
  await f.plugin.setPinColor('b.md', '');
  assert.equal(f.plugin.settings.pinned[1].color, '');
  assert.equal(f.saved.length, 2);
});

test('setPinColor ignores unknown colors, unpinned notes and unchanged colors', async () => {
  const f = await loaded({ data: { pinned: [{ path: 'a.md', color: 'red' }] } });
  await f.plugin.setPinColor('a.md', 'chartreuse');
  await f.plugin.setPinColor('zzz.md', 'blue');
  await f.plugin.setPinColor('a.md', 'red');
  assert.equal(f.saved.length, 0);
  assert.equal(f.plugin.settings.pinned[0].color, 'red');
});

test('renaming keeps the color of a pinned note', async () => {
  const f = await loaded({ data: { pinned: [{ path: 'dir/a.md', color: 'cyan' }] } });
  await f.handlers['vault:rename']({ path: 'new/a.md' }, 'dir/a.md');
  assert.deepEqual(plain(f.plugin.settings.pinned), [{ path: 'new/a.md', color: 'cyan' }]);
});

test('reorderPinned (pure) moves the listed notes and keeps the others in their slots', () => {
  const { settingsModule } = loadMain();
  const entries = ['a', 'b', 'c', 'd'].map((path) => ({ path, color: '' }));
  const order = (list) => list.map((entry) => entry.path);
  assert.deepEqual(order(settingsModule.reorderPinned(entries, ['d', 'c', 'b', 'a'])), ['d', 'c', 'b', 'a']);
  // 'b' is hidden (not listed): it stays in slot 1 while the visible cards swap.
  assert.deepEqual(order(settingsModule.reorderPinned(entries, ['d', 'c', 'a'])), ['d', 'b', 'c', 'a']);
  // unknown and repeated paths are ignored
  assert.deepEqual(order(settingsModule.reorderPinned(entries, ['c', 'zzz', 'a', 'c'])), ['c', 'b', 'a', 'd']);
  // nothing changes: null
  assert.equal(settingsModule.reorderPinned(entries, ['a', 'b', 'c', 'd']), null);
  assert.equal(settingsModule.reorderPinned(entries, []), null);
});

test('reorderPinned (pure) keeps each entry with its color', () => {
  const { settingsModule } = loadMain();
  const entries = [{ path: 'a', color: 'red' }, { path: 'b', color: 'blue' }];
  assert.deepEqual(plain(settingsModule.reorderPinned(entries, ['b', 'a'])), [
    { path: 'b', color: 'blue' },
    { path: 'a', color: 'red' },
  ]);
});

test('plugin.reorderPinned persists the new order once and does nothing when it is unchanged', async () => {
  const f = await loaded({ data: { pinned: ['a.md', 'b.md', 'c.md'] } });
  await f.plugin.reorderPinned(['c.md', 'a.md', 'b.md']);
  assert.deepEqual(pinnedPaths(f), ['c.md', 'a.md', 'b.md']);
  assert.equal(f.saved.length, 1);
  assert.deepEqual(pathsOf(f.saved[0].pinned), ['c.md', 'a.md', 'b.md']);
  await f.plugin.reorderPinned(['c.md', 'a.md', 'b.md']);
  assert.equal(f.saved.length, 1);
});

test('cardTilt is stable per path, between 1 and 2 degrees, and varies across paths', () => {
  const { settingsModule } = loadMain();
  const { cardTilt } = settingsModule;
  const values = [];
  for (let i = 0; i < 200; i++) {
    const path = `Projects/Note ${i}.md`;
    const tilt = cardTilt(path);
    assert.equal(cardTilt(path), tilt);
    assert.ok(Math.abs(tilt) >= 1 && Math.abs(tilt) <= 2, `${path}: ${tilt}`);
    values.push(tilt);
  }
  assert.ok(values.some((v) => v < 0) && values.some((v) => v > 0), 'both directions');
  assert.ok(new Set(values).size > 20, 'varied');
  assert.equal(cardTilt(''), cardTilt(''));
});
