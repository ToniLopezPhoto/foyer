'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadMain } = require('./support/load-main.cjs');
const { createPluginFixture } = require('./support/plugin-fixture.cjs');

// A workspace with at most one Foyer leaf. `state.active` is the view that has focus; revealing/activating a
// leaf makes its view the active one, like Obsidian does. Creating a Foyer leaf builds a real HomeView.
function createWorkspace({ main, plugin, existing = false, active = false }) {
  const calls = [];
  const focused = [];
  const state = { leaves: [], active: null };

  const makeView = (leaf) => {
    const view = new main.HomeView(leaf, plugin);
    view.inputEl = { focus: () => focused.push(view.uid) };
    return view;
  };
  const makeLeaf = () => {
    const leaf = {
      view: null,
      setViewState: async (viewState) => {
        calls.push({ type: 'setViewState', state: JSON.parse(JSON.stringify(viewState)) });
        leaf.view = makeView(leaf);
        state.leaves.push(leaf);
      },
    };
    return leaf;
  };

  if (existing) {
    const leaf = makeLeaf();
    leaf.view = makeView(leaf);
    state.leaves.push(leaf);
    if (active) state.active = leaf.view;
  }

  const workspace = {
    rootSplit: {},
    getLeavesOfType: () => state.leaves,
    getActiveViewOfType: (type) => (state.active instanceof type ? state.active : null),
    getMostRecentLeaf: () => null,
    getLeaf: (mode) => { calls.push({ type: 'getLeaf', mode }); return makeLeaf(); },
    revealLeaf: async (leaf) => { calls.push({ type: 'revealLeaf', leaf }); },
    setActiveLeaf: (leaf) => { calls.push({ type: 'setActiveLeaf', leaf }); state.active = leaf.view; },
  };
  return { workspace, calls, focused, state };
}

async function setup(options = {}) {
  // The workspace needs the plugin and the loaded script, so build the fixture first and patch it in.
  const f = createPluginFixture();
  const ws = createWorkspace({ main: f.main, plugin: f.plugin, ...options });
  Object.assign(f.plugin.app.workspace, ws.workspace);
  await f.plugin.onload();
  return { ...f, ...ws };
}

const callsOf = (ws, type) => ws.calls.filter((call) => call.type === type);

test('the two new commands are registered with their names', async () => {
  const f = await setup();
  assert.equal(f.commands['focus-search'].name, 'Focus Foyer search');
  assert.equal(f.commands['open-new-tab'].name, 'Open Foyer in a new tab');
  assert.equal(typeof f.commands['focus-search'].callback, 'function');
  assert.equal(typeof f.commands['open-new-tab'].callback, 'function');
});

test('Focus Foyer search focuses the input when Foyer is already the active view', async () => {
  const f = await setup({ existing: true, active: true });
  await f.commands['focus-search'].callback();
  assert.equal(f.focused.length, 1);
  assert.equal(f.calls.length, 0); // nothing opened, nothing revealed
});

test('Focus Foyer search brings an open Foyer to the front first, then focuses it', async () => {
  const f = await setup({ existing: true, active: false });
  await f.commands['focus-search'].callback();
  assert.equal(callsOf(f, 'setActiveLeaf').length, 1);
  assert.equal(callsOf(f, 'setViewState').length, 0);
  assert.equal(f.focused.length, 1);
});

test('Focus Foyer search opens Foyer when there is none, then focuses it', async () => {
  const f = await setup({ existing: false });
  await f.commands['focus-search'].callback();
  assert.equal(callsOf(f, 'setViewState').length, 1);
  assert.equal(f.state.leaves.length, 1);
  assert.equal(f.focused.length, 1);
});

test('Open Foyer in a new tab opens another Foyer next to the existing one', async () => {
  const f = await setup({ existing: true, active: true });
  const first = f.state.leaves[0];
  await f.commands['open-new-tab'].callback();

  assert.equal(f.state.leaves.length, 2);
  assert.equal(f.state.leaves[0], first);
  assert.deepEqual(callsOf(f, 'getLeaf').map((call) => call.mode), ['tab']);
  assert.deepEqual(callsOf(f, 'setViewState').map((call) => call.state), [{ type: 'foyer', active: true }]);
  assert.equal(callsOf(f, 'revealLeaf').length, 1);
  assert.equal(f.state.active, f.state.leaves[1].view);
});

test('Open Foyer in a new tab works when no Foyer is open yet', async () => {
  const f = await setup({ existing: false });
  await f.commands['open-new-tab'].callback();
  assert.equal(f.state.leaves.length, 1);
  assert.equal(f.state.active, f.state.leaves[0].view);
});

test('the command names exist in Spanish too', () => {
  const { settingsModule } = loadMain();
  const { es, en } = settingsModule.STRINGS;
  for (const k of ['commandFocusSearch', 'commandOpenNewTab']) {
    assert.equal(typeof es[k], 'string', `es.${k}`);
    assert.equal(typeof en[k], 'string', `en.${k}`);
    assert.notEqual(es[k], en[k], k);
  }
});
