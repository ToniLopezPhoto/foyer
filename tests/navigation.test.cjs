'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

// Load the shipped plugin without starting Obsidian or changing its exports.
const context = vm.createContext({
  module: { exports: {} },
  require(id) {
    assert.equal(id, 'obsidian');
    return {
      Plugin: class {},
      PluginSettingTab: class {},
      FuzzySuggestModal: class {},
      ItemView: class {},
      Keymap: { isModEvent: (event) => event.mode || false },
    };
  },
});
vm.runInContext(
  readFileSync(join(__dirname, '..', 'main.js'), 'utf8') + '\nmodule.exports = HomeView;',
  context,
);
const HomeView = context.module.exports;

function setup({ redirect = false, mode = false } = {}) {
  const file = { path: 'Notes/First recent note.md' };
  const workspace = {
    activeLeaf: null,
    getLeaf(requestedMode) {
      assert.equal(requestedMode, mode);
      return newLeaf;
    },
    setActiveLeaf(leaf) { this.activeLeaf = leaf; },
  };
  const existingLeaf = { file };
  const opened = [];
  const open = async function (requestedFile, options = {}) {
    opened.push({ leaf: this, file: requestedFile });
    const destination = redirect ? existingLeaf : this;
    destination.file = requestedFile;
    // Tab deduplication can open the file in a different leaf.
    if (options.active || workspace.activeLeaf === this) {
      workspace.activeLeaf = destination;
    }
  };
  const homeLeaf = { openFile: open };
  const newLeaf = { openFile: open };
  workspace.activeLeaf = homeLeaf;
  const view = Object.create(HomeView.prototype);
  Object.assign(view, { leaf: homeLeaf, app: { workspace }, items: [], selected: -1 });
  return { view, workspace, file, homeLeaf, newLeaf, existingLeaf, opened };
}

test('opening the first recent file keeps a deduplicated tab active', async () => {
  const state = setup({ redirect: true });
  await state.view.openFile(state.file, false);
  assert.equal(state.workspace.activeLeaf, state.existingLeaf);
  assert.equal(state.opened.length, 1);
});

test('opening an unopened file replaces the home view', async () => {
  const state = setup();
  await state.view.openFile(state.file, false);
  assert.equal(state.workspace.activeLeaf, state.homeLeaf);
  assert.equal(state.homeLeaf.file, state.file);
});

test('explicit new-tab and split modes activate their destination', async () => {
  for (const mode of ['tab', 'split', 'tab:{"deduplicateTabs":false}']) {
    const state = setup({ mode });
    await state.view.openFile(state.file, mode);
    assert.equal(state.workspace.activeLeaf, state.newLeaf);
    assert.equal(state.newLeaf.file, state.file);
  }
});

test('a redirected new-tab open keeps the existing destination active', async () => {
  const state = setup({ redirect: true, mode: 'tab' });
  await state.view.openFile(state.file, 'tab');
  assert.equal(state.workspace.activeLeaf, state.existingLeaf);
});

test('search-result clicks, middle clicks, and Enter use the same navigation', async () => {
  for (const trigger of ['click', 'auxclick', 'Enter']) {
    const state = setup({ redirect: true, mode: trigger === 'auxclick' ? 'tab' : false });
    const listeners = {};
    const el = { addEventListener: (type, callback) => { listeners[type] = callback; }, setAttribute() {} };
    let navigation;
    state.view.addItem(state.view.items, el, (mode) => {
      navigation = state.view.openFile(state.file, mode);
      return navigation;
    });
    if (trigger === 'Enter') {
      state.view.inputEl = { value: 'First recent note' };
      state.view.selected = 0;
      state.view.onKeyDown({ key: 'Enter', preventDefault() {} });
    } else {
      listeners[trigger]({ button: trigger === 'auxclick' ? 1 : 0 });
    }
    await navigation;
    assert.equal(state.workspace.activeLeaf, state.existingLeaf);
    assert.equal(state.opened.length, 1);
  }
});
