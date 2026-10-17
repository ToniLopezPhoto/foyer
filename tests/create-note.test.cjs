'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createElement, loadMain } = require('./support/load-main.cjs');

function createFixture({ files = [], folders = [], newFileParent = '' } = {}) {
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
  const plugin = { settings: { name: 'Toni' }, getEffectiveLanguage: () => 'en' };
  const view = new HomeView(leaf, plugin);
  view.app = {
    vault,
    fileManager,
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

test('the exact-match check ignores a trailing .md, so no Create note action appears', () => {
  const { view } = createFixture({ files: ['idea.md'] });
  // Coincidencia de nombre (match + buscar en contenido); sin «Crear nota».
  assert.equal(search(view, 'idea.md').length, 2);
});

test('Create note still appears for a query that only partly matches a note', () => {
  const { view } = createFixture({ files: ['nueva idea.md'] });
  // Coincidencia parcial (match + buscar en contenido + crear nota).
  assert.equal(search(view, 'nueva').length, 3);
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
