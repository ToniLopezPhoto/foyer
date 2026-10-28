'use strict';

const { loadMain } = require('./load-main.cjs');

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

// A FoyerPlugin over a fake app. `local` is the per-device open history, `lastOpen` what Obsidian's
// getLastOpenFiles() returns and `leaves` the open Foyer leaves (anything with a `view`).
function createPluginFixture({ data = null, local = null, lastOpen = [], leaves = [] } = {}) {
  const main = loadMain({ deferDebounce: true });
  const activeFile = { current: null }; // a test can change the active note after onload()
  const plugin = new main.FoyerPlugin();
  const handlers = {};
  const commands = {};
  const saved = [];
  const localWrites = [];
  const store = new Map();
  if (local !== null) store.set('foyer-open-history', local);

  plugin.app = {
    workspace: {
      on(name, cb) { handlers[`workspace:${name}`] = cb; return {}; },
      onLayoutReady() {},
      getActiveFile: () => activeFile.current,
      getLeavesOfType: () => leaves,
      getLastOpenFiles: () => lastOpen,
    },
    vault: {
      on(name, cb) { handlers[`vault:${name}`] = cb; return {}; },
    },
    loadLocalStorage: (key) => (store.has(key) ? plain(store.get(key)) : null),
    saveLocalStorage: (key, value) => {
      localWrites.push({ key, value: plain(value) });
      store.set(key, plain(value));
    },
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
  return { main, plugin, handlers, commands, saved, localWrites, store, activeFile };
}

// Same fixture, with onload() already run (and the active note set first when `active` is given).
async function loadedPlugin({ active = null, ...options } = {}) {
  const fixture = createPluginFixture(options);
  if (active) fixture.activeFile.current = new fixture.main.TFile(active);
  await fixture.plugin.onload();
  return fixture;
}

module.exports = { plain, createMenu, createPluginFixture, loadedPlugin };
