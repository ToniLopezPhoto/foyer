'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createElement, loadMain } = require('./support/load-main.cjs');

// caseInsensitive: the vault also exposes getAbstractFileByPathInsensitive (as Obsidian does).
function createFixture({ files = [], folders = [], newFileParent = '', caseInsensitive = false } = {}) {
  const { HomeView, TFile, TFolder } = loadMain();
  const byPath = new Map([
    ...folders.map((path) => [path, new TFolder(path)]),
    ...files.map((path) => [path, new TFile(path)]),
  ]);
  const vault = {
    created: [],
    createdFolders: [],
    getFiles: () => [...byPath.values()].filter((entry) => entry instanceof TFile),
    getAbstractFileByPath: (path) => byPath.get(path) ?? null,
    ...(caseInsensitive ? {
      getAbstractFileByPathInsensitive: (path) => (
        [...byPath.values()].find((entry) => entry.path.toLowerCase() === path.toLowerCase()) ?? null
      ),
    } : {}),
    async create(path) {
      const file = new TFile(path);
      byPath.set(path, file);
      vault.created.push(path);
      return file;
    },
    async createFolder(path) {
      const folder = new TFolder(path);
      byPath.set(path, folder);
      vault.createdFolders.push(path);
      return folder;
    },
  };
  const fileManager = {
    parentCalls: 0,
    getNewFileParent() {
      fileManager.parentCalls += 1;
      return new TFolder(newFileParent);
    },
  };
  const opened = [];
  const leaf = {
    openFile: async (file, options) => { opened.push({ file, options }); },
  };
  const plugin = { settings: { name: 'Toni' }, getEffectiveLanguage: () => 'en', getLastOpened: () => null };
  const view = new HomeView(leaf, plugin);
  view.app = {
    vault,
    fileManager,
    metadataCache: { getFileCache: () => null },
    workspace: { getActiveFile: () => null, getLastOpenFiles: () => [], on: () => ({}) },
  };
  return { view, vault, fileManager, opened };
}

function search(view, query) {
  view.inputEl = createElement();
  view.inputEl.value = query;
  view.resultsEl = createElement();
  view.wrapEl = createElement();
  view.updateResults();
  return view.items;
}

// Visible title of each search row, in order (the note or action title, not the path or icon).
// Array.from keeps the result in this realm, so deepEqual compares plain arrays.
const itemTitles = (items) => Array.from(items, (item) => item.el.children[1].children[0].text);

test('createNote strips a trailing .md before creating the note', async () => {
  const { view, vault } = createFixture();
  await view.createNote('idea.md');
  assert.deepEqual(vault.created, ['idea.md']);
});

test('createNote strips a trailing .md case-insensitively', async () => {
  const { view, vault } = createFixture();
  await view.createNote('Idea.MD');
  assert.deepEqual(vault.created, ['Idea.md']);
});

test('createNote opens an existing note at the same path instead of creating it', async () => {
  const { view, vault, opened } = createFixture({ files: ['proyectos/plan.md'] });
  await view.createNote('proyectos/plan');
  assert.deepEqual(vault.created, []);
  assert.equal(opened.length, 1);
  assert.equal(opened[0].file.path, 'proyectos/plan.md');
});

test('the exact-match check ignores a trailing .md: only the note and the content search are listed', () => {
  const { view } = createFixture({ files: ['idea.md'] });
  assert.deepEqual(itemTitles(search(view, 'idea.md')), ['idea', 'Search “idea.md” in content']);
});

test('Create note still appears for a query that only partly matches a note', () => {
  const { view } = createFixture({ files: ['nueva idea.md'] });
  // Partial match: the note, the content search and Create note.
  assert.equal(search(view, 'nueva').length, 3);
});

test('a folder query that resolves to an existing note does not offer Create note', () => {
  const { view } = createFixture({ files: ['proyectos/plan.md'] });
  assert.deepEqual(itemTitles(search(view, 'proyectos/plan')), ['plan', 'Search “proyectos/plan” in content']);
});

test('a note with the same name in another folder does not count as an exact match', () => {
  const { view } = createFixture({ files: ['ideas/plan.md'] });
  assert.deepEqual(itemTitles(search(view, 'proyectos/plan')), [
    'Search “proyectos/plan” in content',
    'Create note “proyectos/plan”',
  ]);
});

test('a folder query matches an existing note whose path differs only in case', () => {
  const { view } = createFixture({ files: ['Proyectos/Plan.md'], caseInsensitive: true });
  assert.deepEqual(itemTitles(search(view, 'proyectos/plan')), ['Plan', 'Search “proyectos/plan” in content']);
});

test('createNote treats / as a folder separator relative to the vault root', async () => {
  const { view, vault, fileManager } = createFixture({ newFileParent: 'Inbox' });
  await view.createNote('proyectos/ideas/plan');
  assert.deepEqual(vault.createdFolders, ['proyectos', 'proyectos/ideas']);
  assert.deepEqual(vault.created, ['proyectos/ideas/plan.md']);
  assert.equal(fileManager.parentCalls, 0);
});

test('createNote creates only the missing folders', async () => {
  const { view, vault } = createFixture({ folders: ['proyectos'] });
  await view.createNote('proyectos/ideas/plan');
  assert.deepEqual(vault.createdFolders, ['proyectos/ideas']);
  assert.deepEqual(vault.created, ['proyectos/ideas/plan.md']);
});

test('createNote sanitizes each folder segment and drops empty ones', async () => {
  const { view, vault } = createFixture();
  await view.createNote('Notas*/ /plan|v2');
  assert.deepEqual(vault.createdFolders, ['Notas']);
  assert.deepEqual(vault.created, ['Notas/plan v2.md']);
});

test('createNote without a folder keeps the default new-note location', async () => {
  const { view, vault, fileManager } = createFixture({ newFileParent: 'Inbox' });
  await view.createNote('idea');
  assert.deepEqual(vault.createdFolders, []);
  assert.deepEqual(vault.created, ['Inbox/idea.md']);
  assert.equal(fileManager.parentCalls, 1);
});

test('createNote drops . and .. segments so the path cannot leave the intended folder', async () => {
  const { view, vault } = createFixture({ newFileParent: 'Inbox' });
  await view.createNote('../x');
  await view.createNote('a/./b');
  await view.createNote('../../etc/passwd');
  await view.createNote('./y');
  assert.deepEqual(vault.createdFolders, ['a', 'etc']);
  assert.deepEqual(vault.created, ['Inbox/x.md', 'a/b.md', 'etc/passwd.md', 'Inbox/y.md']);
});

test('createNote does nothing for input made only of . and .. segments', async () => {
  const { view, vault, opened } = createFixture();
  await view.createNote('..');
  await view.createNote('./../.');
  assert.deepEqual(vault.createdFolders, []);
  assert.deepEqual(vault.created, []);
  assert.equal(opened.length, 0);
});

test('createNote does nothing when no usable name remains', async () => {
  const { view, vault, opened } = createFixture();
  await view.createNote('/ /');
  assert.deepEqual(vault.createdFolders, []);
  assert.deepEqual(vault.created, []);
  assert.equal(opened.length, 0);
});

test('createNote ignores a trailing slash, also after .md', async () => {
  const { view, vault } = createFixture();
  await view.createNote('Projects/Idea.md/');
  assert.deepEqual(vault.createdFolders, ['Projects']);
  assert.deepEqual(vault.created, ['Projects/Idea.md']);
});

test('createNote drops segments that start with a dot, so no hidden folder is created', async () => {
  const { view, vault } = createFixture({ newFileParent: 'Inbox' });
  await view.createNote('.obsidian/plan');
  await view.createNote('proyectos/.cache/plan');
  assert.deepEqual(vault.createdFolders, ['proyectos']);
  assert.deepEqual(vault.created, ['Inbox/plan.md', 'proyectos/plan.md']);
});

test('createNote reuses an existing folder whose name differs only in case', async () => {
  const { view, vault } = createFixture({ folders: ['Proyectos'], caseInsensitive: true });
  await view.createNote('proyectos/ideas/plan');
  assert.deepEqual(vault.createdFolders, ['Proyectos/ideas']);
  assert.deepEqual(vault.created, ['Proyectos/ideas/plan.md']);
});

test('without a case-insensitive lookup, createNote keeps the typed folder casing', async () => {
  const { view, vault } = createFixture({ folders: ['Proyectos'] });
  await view.createNote('proyectos/ideas/plan');
  assert.deepEqual(vault.createdFolders, ['proyectos', 'proyectos/ideas']);
  assert.deepEqual(vault.created, ['proyectos/ideas/plan.md']);
});

test('createNote opens an existing note whose name differs only in case instead of duplicating it', async () => {
  const { view, vault, opened } = createFixture({ files: ['Proyectos/Plan.md'], caseInsensitive: true });
  await view.createNote('proyectos/plan');
  assert.deepEqual(vault.created, []);
  assert.equal(opened.length, 1);
  assert.equal(opened[0].file.path, 'Proyectos/Plan.md');
});
