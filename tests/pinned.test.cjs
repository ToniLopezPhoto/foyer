'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadMain } = require('./support/load-main.cjs');

// Objects created inside the vm context have other prototypes: compare them as plain JSON.
const plain = (value) => JSON.parse(JSON.stringify(value));

// A menu that records the items added by a `file-menu` handler.
function createMenu() {
  const items = [];
  return {
    items,
    addItem(callback) {
      const item = {
        title: '',
        icon: '',
        setTitle(title) { item.title = title; return item; },
        setIcon(icon) { item.icon = icon; return item; },
        onClick(handler) { item.click = handler; return item; },
      };
      items.push(item);
      callback(item);
      return this;
    },
  };
}

function createFixture({ data = null, local = null } = {}) {
  const main = loadMain({ deferDebounce: true });
  const activeFile = { current: null }; // a test can change the active note after onload()
  const plugin = new main.FoyerPlugin();
  const handlers = {};
  const commands = {};
  const saved = [];
  const localWrites = [];

  plugin.app = {
    workspace: {
      on(name, cb) { handlers[`workspace:${name}`] = cb; return {}; },
      onLayoutReady() {},
      getActiveFile: () => activeFile.current,
      getLeavesOfType: () => [],
    },
    vault: {
      on(name, cb) { handlers[`vault:${name}`] = cb; return {}; },
    },
    loadLocalStorage: () => (local === null ? null : plain(local)),
    saveLocalStorage: (key, value) => { localWrites.push({ key, value: plain(value) }); },
  };
  plugin.loadData = async () => (data === null ? null : plain(data));
  plugin.saveData = async (value) => { saved.push(plain(value)); };
  plugin.registerEvent = (ref) => ref;
  plugin.register = () => {};
  plugin.registerView = () => {};
  plugin.registerHoverLinkSource = () => {};
  plugin.addSettingTab = () => {};
  plugin.addRibbonIcon = () => {};
  plugin.addCommand = (command) => { commands[command.id] = command; };
  return { main, plugin, handlers, commands, saved, localWrites, activeFile };
}

async function loaded({ active = null, ...options } = {}) {
  const fixture = createFixture(options);
  if (active) fixture.activeFile.current = new fixture.main.TFile(active);
  await fixture.plugin.onload();
  return fixture;
}

/* ── Settings ── */
test('DEFAULT_SETTINGS starts with an empty pinned list', () => {
  const { settingsModule } = loadMain();
  assert.deepEqual(plain(settingsModule.DEFAULT_SETTINGS.pinned), []);
});

test('normalizeSettings keeps a clean pinned list', () => {
  const { settingsModule } = loadMain();
  assert.deepEqual(plain(settingsModule.normalizeSettings({ pinned: ['a.md', 'dir/b.md'] }).pinned), ['a.md', 'dir/b.md']);
});

test('normalizeSettings drops non-strings, empty strings and duplicates from pinned', () => {
  const { settingsModule } = loadMain();
  const pinned = settingsModule.normalizeSettings({ pinned: ['a.md', 3, '', null, 'a.md', { x: 1 }, 'b.md'] }).pinned;
  assert.deepEqual(plain(pinned), ['a.md', 'b.md']);
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
  out.pinned.push('b.md');
  assert.deepEqual(plain(input), ['a.md']);
});

/* ── Plugin API ── */
test('pinFile stores the path in data.json and leaves the open history alone', async () => {
  const f = await loaded();
  await f.plugin.pinFile('a.md');
  assert.deepEqual(plain(f.plugin.settings.pinned), ['a.md']);
  assert.equal(f.plugin.isPinned('a.md'), true);
  assert.equal(f.plugin.isPinned('b.md'), false);
  assert.equal(f.saved.length, 1);
  assert.deepEqual(f.saved[0].pinned, ['a.md']);
  assert.equal('openHistory' in f.saved[0], false);
  f.plugin.saveHistorySoon.run();
  assert.equal(f.localWrites.length, 0);
});

test('pinFile keeps the pinning order and ignores a note that is already pinned', async () => {
  const f = await loaded();
  await f.plugin.pinFile('a.md');
  await f.plugin.pinFile('b.md');
  await f.plugin.pinFile('a.md');
  assert.deepEqual(plain(f.plugin.settings.pinned), ['a.md', 'b.md']);
  assert.equal(f.saved.length, 2);
});

test('unpinFile removes the path and saves; unpinning an unknown path does nothing', async () => {
  const f = await loaded({ data: { pinned: ['a.md', 'b.md'] } });
  await f.plugin.unpinFile('a.md');
  assert.deepEqual(plain(f.plugin.settings.pinned), ['b.md']);
  assert.equal(f.saved.length, 1);
  await f.plugin.unpinFile('zzz.md');
  assert.equal(f.saved.length, 1);
});

test('pinned notes load from data.json on startup', async () => {
  const f = await loaded({ data: { pinned: ['a.md', 7, 'a.md'] } });
  assert.deepEqual(plain(f.plugin.settings.pinned), ['a.md']);
  assert.equal(f.saved.length, 0);
});

/* ── Rename and delete ── */
test('renaming a pinned file or a folder moves the pinned paths', async () => {
  const f = await loaded({ data: { pinned: ['a.md', 'dir/b.md', 'dir/sub/c.md', 'other.md'] } });
  await f.handlers['vault:rename']({ path: 'z.md' }, 'a.md');
  await f.handlers['vault:rename']({ path: 'renamed' }, 'dir');
  assert.deepEqual(plain(f.plugin.settings.pinned), ['z.md', 'renamed/b.md', 'renamed/sub/c.md', 'other.md']);
  assert.equal(f.saved.length, 2);
  assert.deepEqual(f.saved.pop().pinned, ['z.md', 'renamed/b.md', 'renamed/sub/c.md', 'other.md']);
});

test('a rename that touches no pinned path does not write data.json', async () => {
  const f = await loaded({ data: { pinned: ['a.md'] } });
  await f.handlers['vault:rename']({ path: 'y.md' }, 'x.md');
  assert.equal(f.saved.length, 0);
});

test('renaming a note onto an already pinned path does not duplicate it', async () => {
  const f = await loaded({ data: { pinned: ['a.md', 'b.md'] } });
  await f.handlers['vault:rename']({ path: 'b.md' }, 'a.md');
  assert.deepEqual(plain(f.plugin.settings.pinned), ['b.md']);
});

test('deleting a pinned file or a folder drops the pinned paths', async () => {
  const f = await loaded({ data: { pinned: ['a.md', 'dir/b.md', 'dir/sub/c.md', 'other.md'] } });
  await f.handlers['vault:delete']({ path: 'a.md' });
  await f.handlers['vault:delete']({ path: 'dir' });
  assert.deepEqual(plain(f.plugin.settings.pinned), ['other.md']);
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
  assert.deepEqual(plain(f.plugin.settings.pinned), ['dir/a.md']);
  assert.equal(f.commands['pin-current'].checkCallback(true), false);
  assert.equal(f.commands['unpin-current'].checkCallback(true), true);

  assert.equal(f.commands['unpin-current'].checkCallback(false), true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(plain(f.plugin.settings.pinned), []);
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
  assert.deepEqual(plain(f.plugin.settings.pinned), ['dir/a.md']);
});

test('the file menu offers "Unpin from Foyer" for a pinned file', async () => {
  const f = await loaded({ data: { pinned: ['a.md'] } });
  const m = createMenu();
  f.handlers['workspace:file-menu'](m, new f.main.TFile('a.md'));
  assert.equal(m.items.length, 1);
  assert.equal(m.items[0].title, 'Unpin from Foyer');
  assert.equal(m.items[0].icon, 'pin-off');
  await m.items[0].click();
  assert.deepEqual(plain(f.plugin.settings.pinned), []);
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
