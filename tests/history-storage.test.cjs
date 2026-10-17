'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadMain } = require('./support/load-main.cjs');

const KEY = 'foyer-open-history';

// Objects created inside the vm context have other prototypes: compare them as plain JSON.
const plain = (value) => JSON.parse(JSON.stringify(value));

function createFixture({ data = null, local, localApi = true, activeFile = null } = {}) {
  const { FoyerPlugin, TFile } = loadMain({ deferDebounce: true });
  const plugin = new FoyerPlugin();

  const calls = [];
  const store = new Map();
  if (local !== undefined) store.set(KEY, local);

  const handlers = {};
  const registered = [];
  let layoutReady = null;
  const leaf = {};

  plugin.app = {
    workspace: {
      on(name, cb) { handlers[`workspace:${name}`] = cb; return {}; },
      onLayoutReady(cb) { layoutReady = cb; },
      getActiveFile: () => activeFile,
      getLeavesOfType: () => [leaf],
      revealLeaf: async () => {},
      setActiveLeaf() {},
      getMostRecentLeaf: () => null,
    },
    vault: {
      on(name, cb) { handlers[`vault:${name}`] = cb; return {}; },
    },
  };
  if (localApi) {
    plugin.app.saveLocalStorage = (key, value) => {
      calls.push({ type: 'local', key, value: plain(value) });
      store.set(key, plain(value));
    };
    plugin.app.loadLocalStorage = (key) => (store.has(key) ? plain(store.get(key)) : null);
  }

  plugin.loadData = async () => (data === null ? null : plain(data));
  plugin.saveData = async (value) => { calls.push({ type: 'data', value: plain(value) }); };
  plugin.registerEvent = (ref) => ref;
  plugin.register = (fn) => { registered.push(fn); };
  plugin.registerView = () => {};
  plugin.registerHoverLinkSource = () => {};
  plugin.addSettingTab = () => {};
  plugin.addRibbonIcon = () => {};
  plugin.addCommand = () => {};

  const localWrites = () => calls.filter((call) => call.type === 'local');
  const dataWrites = () => calls.filter((call) => call.type === 'data');
  return {
    plugin, TFile, calls, store, handlers, registered, localWrites, dataWrites,
    runLayoutReady: () => layoutReady(),
  };
}

test('opening a file never calls saveData and writes the history to local storage', async () => {
  const f = createFixture();
  await f.plugin.onload();
  f.handlers['workspace:file-open'](new f.TFile('a.md'));
  f.plugin.saveHistorySoon.run();

  assert.equal(f.dataWrites().length, 0);
  assert.equal(f.localWrites().length, 1);
  assert.equal(f.localWrites()[0].key, KEY);
  assert.deepEqual(Object.keys(f.localWrites()[0].value), ['a.md']);
  assert.ok(f.plugin.getLastOpened('a.md') > 0);
  assert.equal(f.plugin.getLastOpened('missing.md'), null);
});

test('several opens are coalesced into one deferred local write', async () => {
  const f = createFixture();
  await f.plugin.onload();
  f.handlers['workspace:file-open'](new f.TFile('a.md'));
  f.handlers['workspace:file-open'](new f.TFile('b.md'));
  assert.equal(f.localWrites().length, 0);

  f.plugin.saveHistorySoon.run();
  assert.equal(f.localWrites().length, 1);
  assert.deepEqual(Object.keys(f.localWrites()[0].value).sort(), ['a.md', 'b.md']);
});

test('pending history is flushed to local storage on unload', async () => {
  const f = createFixture();
  await f.plugin.onload();
  f.handlers['workspace:file-open'](new f.TFile('a.md'));
  assert.equal(f.localWrites().length, 0);

  for (const fn of f.registered) fn();
  assert.equal(f.localWrites().length, 1);
  assert.equal(f.dataWrites().length, 0);
});

test('existing local history is loaded on startup', async () => {
  const f = createFixture({ local: { 'a.md': 123 } });
  await f.plugin.onload();
  assert.equal(f.plugin.getLastOpened('a.md'), 123);
  assert.equal(f.dataWrites().length, 0);
});

test('migration merges data.json history into local storage keeping the max timestamp', async () => {
  const f = createFixture({
    data: { name: 'Toni', language: 'en', openHistory: { 'a.md': 100, 'b.md': 50 } },
    local: { 'a.md': 200, 'c.md': 10 },
  });
  await f.plugin.onload();

  assert.deepEqual(f.store.get(KEY), { 'a.md': 200, 'b.md': 50, 'c.md': 10 });
  assert.equal(f.plugin.getLastOpened('b.md'), 50);

  const writes = f.dataWrites();
  assert.equal(writes.length, 1);
  assert.equal(writes[0].value.name, 'Toni');
  assert.equal(writes[0].value.language, 'en');
  assert.equal('openHistory' in writes[0].value, false);
  // The local copy is saved before the history is removed from data.json.
  assert.equal(f.calls[0].type, 'local');
  assert.equal(f.calls[1].type, 'data');
});

test('migration keeps the 200 most recent entries', async () => {
  const legacy = {};
  const local = {};
  for (let i = 0; i < 150; i++) legacy[`old/${i}.md`] = 1000 + i;
  for (let i = 0; i < 150; i++) local[`new/${i}.md`] = 5000 + i;
  const f = createFixture({ data: { openHistory: legacy }, local });
  await f.plugin.onload();

  const merged = f.store.get(KEY);
  assert.equal(Object.keys(merged).length, 200);
  assert.ok('new/0.md' in merged);
  assert.ok('old/149.md' in merged);
  assert.equal('old/0.md' in merged, false);
});

test('no migration write happens when data.json has no history', async () => {
  const f = createFixture({ data: { name: 'Toni' } });
  await f.plugin.onload();
  assert.equal(f.calls.length, 0);
});

test('an empty legacy history is still stripped from data.json', async () => {
  const f = createFixture({ data: { name: 'Toni', openHistory: {} } });
  await f.plugin.onload();
  const writes = f.dataWrites();
  assert.equal(writes.length, 1);
  assert.equal('openHistory' in writes[0].value, false);
});

test('saving a setting never writes openHistory to data.json', async () => {
  const f = createFixture({ data: { openHistory: { 'a.md': 100 } } });
  await f.plugin.onload();
  f.handlers['workspace:file-open'](new f.TFile('b.md'));
  await f.plugin.updateSetting('name', 'Ana');

  const last = f.dataWrites().pop();
  assert.equal(last.value.name, 'Ana');
  assert.equal('openHistory' in last.value, false);
});

test('renaming a file or a folder moves its history entries', async () => {
  const f = createFixture({ local: { 'a.md': 1, 'dir/b.md': 2, 'dir/sub/c.md': 3, 'other.md': 4 } });
  await f.plugin.onload();

  f.handlers['vault:rename']({ path: 'z.md' }, 'a.md');
  f.handlers['vault:rename']({ path: 'renamed' }, 'dir');
  f.plugin.saveHistorySoon.run();

  const saved = f.localWrites().pop().value;
  assert.deepEqual(saved, { 'z.md': 1, 'renamed/b.md': 2, 'renamed/sub/c.md': 3, 'other.md': 4 });
  assert.equal(f.dataWrites().length, 0);
});

test('deleting a file or a folder removes its history entries', async () => {
  const f = createFixture({ local: { 'a.md': 1, 'dir/b.md': 2, 'dir/sub/c.md': 3, 'other.md': 4 } });
  await f.plugin.onload();

  f.handlers['vault:delete']({ path: 'a.md' });
  f.handlers['vault:delete']({ path: 'dir' });
  f.plugin.saveHistorySoon.run();

  assert.deepEqual(f.localWrites().pop().value, { 'other.md': 4 });
  assert.equal(f.dataWrites().length, 0);
});

test('the history is capped at 200 entries', async () => {
  const f = createFixture();
  await f.plugin.onload();
  for (let i = 0; i < 205; i++) f.handlers['workspace:file-open'](new f.TFile(`n/${i}.md`));
  f.plugin.saveHistorySoon.run();
  assert.equal(Object.keys(f.localWrites().pop().value).length, 200);
});

test('the file restored at startup is recorded as opened', async () => {
  const f = createFixture();
  f.plugin.app.workspace.getActiveFile = () => new f.TFile('restored.md');
  await f.plugin.onload();
  await f.runLayoutReady();
  f.plugin.saveHistorySoon.run();

  assert.ok(f.plugin.getLastOpened('restored.md') > 0);
  assert.deepEqual(Object.keys(f.localWrites().pop().value), ['restored.md']);
  assert.equal(f.dataWrites().length, 0);
});

test('without local storage support the history stays in memory and never reaches data.json', async () => {
  const f = createFixture({ localApi: false, data: { name: 'Toni', openHistory: { 'a.md': 100 } } });
  await f.plugin.onload();

  f.handlers['workspace:file-open'](new f.TFile('b.md'));
  f.handlers['vault:rename']({ path: 'z.md' }, 'a.md');
  f.plugin.saveHistorySoon.run();

  assert.equal(f.plugin.getLastOpened('z.md'), 100);
  assert.ok(f.plugin.getLastOpened('b.md') > 0);
  for (const write of f.dataWrites()) assert.equal('openHistory' in write.value, false);
});
