'use strict';

const { loadMain } = require('./load-main.cjs');

// Builds a HomeView over a fake vault and a fake plugin.
//   history  — path -> last-opened timestamp (per-device open history)
//   pinned   — pinned notes in order (data.json): paths, or { path, color } entries
//   lastOpen — what Obsidian's getLastOpenFiles() returns
//   ignored  — paths hidden by "Excluded files"; extra — non-file vault entries (folders...)
// The fake plugin implements the same history/pin API as the real one so the view can call it.
async function createViewFixture({
  paths = [],
  history = {},
  pinned = [],
  lastOpen = [],
  ignored = [],
  extra = {},
  recentLimit = 8,
  main = loadMain({ animationFrames: true }),
} = {}) {
  const files = new Map(paths.map((path) => [path, new main.TFile(path, 1)]));
  const opened = [];
  const hoverEvents = [];
  const leafCalls = [];
  const notices = main.notices;
  const removed = [];
  const unpinned = [];
  const plugin = {
    settings: {
      name: 'Toni',
      resultLimit: 7,
      recentLimit,
      pinned: pinned.map((entry) => (typeof entry === 'string' ? { path: entry, color: '' } : entry)),
    },
    openHistory: history,
    dismissedRecent: new Set(),
    getEffectiveLanguage: () => 'en',
    getLastOpened: (path) => history[path] || null,
    // Same contract as the real plugin, which also refreshes every open Foyer view.
    async unpinFile(path) {
      unpinned.push(path);
      plugin.settings = { ...plugin.settings, pinned: plugin.settings.pinned.filter((entry) => entry.path !== path) };
      view.refreshSettings();
    },
    removeFromHistory(path) {
      removed.push(path);
      plugin.dismissedRecent.add(path);
      const had = path in history;
      delete history[path];
      view.refreshSettings();
      return had;
    },
  };
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
  return { main, view, plugin, files, opened, hoverEvents, leafCalls, notices, removed, unpinned };
}

// The listbox children in DOM order, looking through the (presentational) pinned board.
function listboxChildren(view) {
  return view.recentEl.children.flatMap((child) => (child.classes.has('foyer__board') ? child.children : [child]));
}

// Options of the single Foyer listbox (pinned cards, then Recent rows) and its section headings, in DOM order.
const optionRows = (view) => listboxChildren(view).filter((el) => el.attributes.role === 'option');
const boardOf = (view) => view.recentEl.children.find((el) => el.classes.has('foyer__board')) || null;
const cardsOf = (view) => (boardOf(view) ? boardOf(view).children.filter((el) => el.classes.has('foyer__card')) : []);
const rowTitle = (row) => (row.classes.has('foyer__card')
  ? row.children.find((child) => child.classes.has('foyer__card-title')).text
  : row.children[1].children[0].text);
const sectionHeads = (view) => view.recentEl.children.filter((el) => el.classes.has('foyer__section-head'));

// [{ head: 'Pinned', rows: ['A', ...] }, ...] following the listbox children in order.
function sections(view) {
  const out = [];
  for (const child of listboxChildren(view)) {
    if (child.classes.has('foyer__section-head')) out.push({ head: child.children[0].text, rows: [] });
    else if (child.attributes.role === 'option') out[out.length - 1].rows.push(rowTitle(child));
  }
  return out;
}

module.exports = { createViewFixture, optionRows, boardOf, cardsOf, rowTitle, sectionHeads, sections };
