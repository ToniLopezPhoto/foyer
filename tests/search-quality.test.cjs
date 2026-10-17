'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadMain, subsequenceFuzzy } = require('./support/load-main.cjs');

// Builds a HomeView over a fake vault. `frontmatter` maps a path to its parsed frontmatter, `history` maps a
// path to its last-opened timestamp, and `metadata` overrides parts of the fake metadataCache (isUserIgnored...).
async function createFixture({ specs, frontmatter = {}, history = {}, metadata = {}, resultLimit = 7 }) {
  const fuzzyCalls = { count: 0 };
  const countingFuzzy = (query) => {
    const fuzzy = subsequenceFuzzy(query);
    return (text) => {
      fuzzyCalls.count += 1;
      return fuzzy(text);
    };
  };
  const main = loadMain({ fuzzy: countingFuzzy, animationFrames: true });
  const files = specs.map(({ path, mtime = 0 }) => new main.TFile(path, mtime));
  const vaultHandlers = {};
  const metadataHandlers = {};
  const metadataCache = {
    fileCacheCalls: 0,
    getFileCache(file) {
      metadataCache.fileCacheCalls += 1;
      return frontmatter[file.path] ? { frontmatter: frontmatter[file.path] } : null;
    },
    on(name, handler) {
      (metadataHandlers[name] ||= []).push(handler);
      return { name, handler };
    },
    emit(name, ...args) {
      for (const handler of metadataHandlers[name] || []) handler(...args);
    },
    ...metadata,
  };
  const vault = {
    getFiles: () => files.slice(),
    getAbstractFileByPath: () => null,
    on(name, handler) {
      (vaultHandlers[name] ||= []).push(handler);
      return { name, handler };
    },
  };
  const opened = [];
  const plugin = {
    settings: { name: 'Toni', resultLimit, recentLimit: 8 },
    getEffectiveLanguage: () => 'en',
    getLastOpened: (path) => history[path] || null,
  };
  const view = new main.HomeView({ openFile: async (file) => { opened.push(file.path); } }, plugin);
  view.app = {
    vault,
    metadataCache,
    workspace: { on: () => ({}), getLastOpenFiles: () => [], getActiveViewOfType: () => null },
  };
  await view.onOpen();
  return { main, view, files, opened, fuzzyCalls, metadataCache, frontmatter, history };
}

function search(fixture, text) {
  fixture.view.inputEl.value = text;
  fixture.view.updateResults();
}

const isAction = (item) => item.el.classes.has('foyer__item--action');

// Paths of the visible file results, in order, plus whether "Create note" is offered.
function readResults(fixture) {
  const { view, opened } = fixture;
  opened.length = 0;
  for (const item of view.items.filter((entry) => !isAction(entry))) item.run(false);
  const paths = opened.slice();
  opened.length = 0;
  return { paths, exact: view.items.filter(isAction).length === 1 };
}

// Title and secondary line of the file result at `index`.
function rowText(fixture, index) {
  const [, body] = fixture.view.items[index].el.children;
  return { title: body.children[0].text, secondary: body.children[1]?.text };
}

/* ── Aliases ── */
test('a note is found by an alias given as a string', async () => {
  const fixture = await createFixture({
    specs: [{ path: 'projects/Alpha.md' }, { path: 'Other.md' }],
    frontmatter: { 'projects/Alpha.md': { aliases: 'Zorro' } },
  });
  search(fixture, 'zorro');
  assert.deepEqual(readResults(fixture).paths, ['projects/Alpha.md']);
});

test('a note is found by any alias given as an array, and by the legacy alias key', async () => {
  const fixture = await createFixture({
    specs: [{ path: 'Alpha.md' }, { path: 'Beta.md' }, { path: 'Gamma.md' }],
    frontmatter: {
      'Alpha.md': { aliases: ['Zorro', 'Fox'] },
      'Beta.md': { alias: 'Wolfie' },
      'Gamma.md': { alias: ['Lynx'] },
    },
  });
  search(fixture, 'fox');
  assert.deepEqual(readResults(fixture).paths, ['Alpha.md']);
  search(fixture, 'wolfie');
  assert.deepEqual(readResults(fixture).paths, ['Beta.md']);
  search(fixture, 'lynx');
  assert.deepEqual(readResults(fixture).paths, ['Gamma.md']);
});

test('a comma-separated string holds several aliases and non-string or empty entries are ignored', async () => {
  const fixture = await createFixture({
    specs: [{ path: 'Alpha.md' }, { path: 'Beta.md' }],
    frontmatter: {
      'Alpha.md': { aliases: 'Zorro, Fox' },
      'Beta.md': { aliases: [null, '', 42, { x: 1 }, 'Wolfie'] },
    },
  });
  search(fixture, 'fox');
  assert.deepEqual(readResults(fixture).paths, ['Alpha.md']);
  search(fixture, 'wolfie');
  assert.deepEqual(readResults(fixture).paths, ['Beta.md']);
  search(fixture, '42');
  assert.deepEqual(readResults(fixture).paths, ['Beta.md']);
});

test('only Markdown files read aliases', async () => {
  const fixture = await createFixture({
    specs: [{ path: 'board.canvas' }, { path: 'Alpha.md' }],
    frontmatter: { 'board.canvas': { aliases: ['Zorro'] }, 'Alpha.md': { aliases: ['Zorro'] } },
  });
  search(fixture, 'zorro');
  assert.deepEqual(readResults(fixture).paths, ['Alpha.md']);
});

test('an alias match shows the highlighted alias as the title and the note name with its folder below', async () => {
  const fixture = await createFixture({
    specs: [{ path: 'projects/Alpha.md' }, { path: 'Beta.md' }],
    frontmatter: { 'projects/Alpha.md': { aliases: ['Zorro'] }, 'Beta.md': { aliases: ['Zorro'] } },
  });
  search(fixture, 'zorro');
  assert.deepEqual(rowText(fixture, 0), { title: 'Zorro', secondary: 'Alpha · projects' });
  assert.deepEqual(rowText(fixture, 1), { title: 'Zorro', secondary: 'Beta' });
});

test('a name match keeps the usual row: name as the title and the folder below', async () => {
  const fixture = await createFixture({
    specs: [{ path: 'projects/Alpha.md' }],
    frontmatter: { 'projects/Alpha.md': { aliases: ['Zorro'] } },
  });
  search(fixture, 'alpha');
  assert.deepEqual(rowText(fixture, 0), { title: 'Alpha', secondary: 'projects' });
});

test('the name is tried before the aliases and an alias match ranks like a name match, ahead of path matches', async () => {
  const fixture = await createFixture({
    specs: [
      { path: 'zor/readme.md', mtime: 9000 },  // path match only
      { path: 'Alpha.md', mtime: 1 },          // alias match
      { path: 'Zorba.md', mtime: 1 },          // name match with the same score and an alias that also matches
    ],
    frontmatter: { 'Alpha.md': { aliases: ['Zorro'] }, 'Zorba.md': { aliases: ['Zorro'] } },
  });
  search(fixture, 'zor');
  const { paths } = readResults(fixture);
  assert.deepEqual(paths, ['Alpha.md', 'Zorba.md', 'zor/readme.md']);
  assert.equal(rowText(fixture, 1).title, 'Zorba', 'the name wins over the alias of the same note');
  assert.equal(rowText(fixture, 2).title, 'readme');
});

test('Create note is not offered when the query equals an alias, ignoring case', async () => {
  const fixture = await createFixture({
    specs: [{ path: 'Alpha.md' }],
    frontmatter: { 'Alpha.md': { aliases: ['Zorro'] } },
  });
  for (const query of ['Zorro', 'zorro', 'ZORRO']) {
    search(fixture, query);
    assert.equal(readResults(fixture).exact, true, `exact for «${query}»`);
  }
  search(fixture, 'zorr');
  assert.equal(readResults(fixture).exact, false);
  search(fixture, 'alpha');
  assert.equal(readResults(fixture).exact, true, 'exact name matches still work');
});

test('the exact alias counts even when the note is cut by the result limit', async () => {
  const specs = Array.from({ length: 6 }, (_, i) => ({ path: `zorro-${i}.md`, mtime: 9000 + i }));
  specs.push({ path: 'old/Alpha.md', mtime: 1 });
  const fixture = await createFixture({
    specs,
    frontmatter: { 'old/Alpha.md': { aliases: ['zorro'] } },
    resultLimit: 3,
  });
  search(fixture, 'zorro');
  const { paths, exact } = readResults(fixture);
  assert.equal(paths.includes('old/Alpha.md'), false);
  assert.equal(exact, true);
});

/* ── Alias cache ── */
test('aliases are read once with the listed entries and again after a metadata change', async () => {
  const fixture = await createFixture({
    specs: [{ path: 'Alpha.md' }, { path: 'Beta.md' }],
    frontmatter: { 'Alpha.md': { aliases: ['Zorro'] } },
  });
  search(fixture, 'zorro');
  search(fixture, 'zorro ');
  search(fixture, 'q');
  assert.equal(fixture.metadataCache.fileCacheCalls, 2, 'one frontmatter read per Markdown file, then cached');

  fixture.frontmatter['Alpha.md'] = { aliases: ['Fox'] };
  fixture.metadataCache.emit('changed', fixture.files[0]);
  search(fixture, 'zorro');
  assert.deepEqual(readResults(fixture).paths, []);
  search(fixture, 'fox');
  assert.deepEqual(readResults(fixture).paths, ['Alpha.md']);
  assert.equal(fixture.metadataCache.fileCacheCalls, 4);
});

test('a metadata change drops the narrowing state: a new alias is found while extending the query', async () => {
  const fixture = await createFixture({
    specs: [{ path: 'Alpha.md' }, { path: 'Beta.md' }],
    frontmatter: { 'Beta.md': { aliases: ['Zebra'] } },
  });
  search(fixture, 'z');
  fixture.frontmatter['Alpha.md'] = { aliases: ['Zorro'] };
  fixture.metadataCache.emit('changed', fixture.files[0]);
  search(fixture, 'zo');
  assert.deepEqual(readResults(fixture).paths, ['Alpha.md']);
});

/* ── Narrowing with aliases ── */
test('extending the query keeps the files that matched through an alias, and still narrows', async () => {
  const specs = [{ path: 'Alpha.md' }, { path: 'Beta.md' }, { path: 'Gamma.md' }, { path: 'zeta/ants.md' }];
  for (let i = 0; i < 40; i++) specs.push({ path: `filler/file-${i}.md` });
  const fixture = await createFixture({
    specs,
    frontmatter: { 'Alpha.md': { aliases: ['Zorro'] }, 'Gamma.md': { aliases: ['Zonda'] } },
  });
  const listed = specs.length;
  search(fixture, 'z');
  assert.deepEqual(readResults(fixture).paths.sort(), ['Alpha.md', 'Gamma.md', 'zeta/ants.md']);

  fixture.fuzzyCalls.count = 0;
  search(fixture, 'zo');
  assert.deepEqual(readResults(fixture).paths.sort(), ['Alpha.md', 'Gamma.md']);
  assert.ok(fixture.fuzzyCalls.count < listed, `narrowed scan: ${fixture.fuzzyCalls.count} matcher calls`);

  search(fixture, 'zorr');
  assert.deepEqual(readResults(fixture).paths, ['Alpha.md']);
  search(fixture, 'zorro');
  assert.deepEqual(readResults(fixture).paths, ['Alpha.md']);
  assert.equal(rowText(fixture, 0).title, 'Zorro');
});

/* ── Excluded files ── */
test('files for which isUserIgnored returns true are not listed, not even through an alias', async () => {
  const ignored = new Set(['private/Secret.md']);
  const fixture = await createFixture({
    specs: [{ path: 'private/Secret.md' }, { path: 'Public.md' }, { path: 'private/Diary.md' }],
    frontmatter: { 'private/Secret.md': { aliases: ['Hidden'] }, 'Public.md': { aliases: ['Hidden'] } },
    metadata: { isUserIgnored: (path) => ignored.has(path) },
  });
  search(fixture, 'hidden');
  assert.deepEqual(readResults(fixture).paths, ['Public.md']);
  search(fixture, 'secret');
  assert.deepEqual(readResults(fixture).paths, []);
  search(fixture, 'diary');
  assert.deepEqual(readResults(fixture).paths, ['private/Diary.md']);
});

test('without metadataCache.isUserIgnored every listed file is searchable', async () => {
  const fixture = await createFixture({ specs: [{ path: 'private/Secret.md' }, { path: 'Public.md' }] });
  assert.equal(fixture.view.app.metadataCache.isUserIgnored, undefined);
  search(fixture, 'secret');
  assert.deepEqual(readResults(fixture).paths, ['private/Secret.md']);
});

test('a throwing isUserIgnored counts as not ignored, per file', async () => {
  const fixture = await createFixture({
    specs: [{ path: 'Boom.md' }, { path: 'Ignored.md' }, { path: 'Fine.md' }],
    metadata: {
      isUserIgnored(path) {
        if (path === 'Boom.md') throw new Error('private API changed');
        return path === 'Ignored.md';
      },
    },
  });
  search(fixture, 'o');
  assert.deepEqual(readResults(fixture).paths.sort(), ['Boom.md']);
  search(fixture, 'i');
  assert.deepEqual(readResults(fixture).paths, ['Fine.md']);
  search(fixture, 'm');
  assert.deepEqual(readResults(fixture).paths.sort(), ['Boom.md', 'Fine.md']);
});

test('isUserIgnored is consulted once per file while the cache lives', async () => {
  let calls = 0;
  const fixture = await createFixture({
    specs: [{ path: 'A.md' }, { path: 'B.md' }],
    metadata: { isUserIgnored: () => { calls += 1; return false; } },
  });
  search(fixture, 'a');
  search(fixture, 'b');
  search(fixture, 'a');
  assert.equal(calls, 2);
});

/* ── Recency ── */
test('files opened more recently come first among results that tie on name-vs-path and score', async () => {
  const fixture = await createFixture({
    specs: [
      { path: 'a/note.md', mtime: 500 },
      { path: 'b/note.md', mtime: 400 },
      { path: 'c/note.md', mtime: 300 },
      { path: 'd/note.md', mtime: 900 },
    ],
    history: { 'b/note.md': 2000, 'c/note.md': 3000 },
  });
  search(fixture, 'note');
  // Opened files first (newest open first), then the rest by newer mtime.
  assert.deepEqual(readResults(fixture).paths, ['c/note.md', 'b/note.md', 'd/note.md', 'a/note.md']);
});

test('recency does not override a name match over a path match', async () => {
  const fixture = await createFixture({
    specs: [{ path: 'note/readme.md', mtime: 100 }, { path: 'Note.md', mtime: 1 }],
    history: { 'note/readme.md': 99999 },
  });
  search(fixture, 'note');
  assert.deepEqual(readResults(fixture).paths, ['Note.md', 'note/readme.md']);
});

test('recency does not override a higher fuzzy score', async () => {
  const fixture = await createFixture({
    specs: [{ path: 'n-o-t-e.md', mtime: 1 }, { path: 'note.md', mtime: 1 }],
    history: { 'n-o-t-e.md': 99999 },
  });
  search(fixture, 'note');
  assert.deepEqual(readResults(fixture).paths, ['note.md', 'n-o-t-e.md']);
});

test('the bounded top list orders ties by recency, then mtime, then vault order', async () => {
  const specs = Array.from({ length: 12 }, (_, i) => ({ path: `f${i}/idea.md`, mtime: 100 + (i % 3) * 100 }));
  const history = { 'f9/idea.md': 7000, 'f4/idea.md': 8000, 'f11/idea.md': 6000 };
  const fixture = await createFixture({ specs, history, resultLimit: 5 });
  search(fixture, 'idea');
  const expected = specs
    .map((spec, index) => ({ ...spec, index }))
    .sort((a, b) =>
      ((history[b.path] || 0) - (history[a.path] || 0)) || (b.mtime - a.mtime) || (a.index - b.index))
    .slice(0, 5)
    .map((spec) => spec.path);
  assert.deepEqual(readResults(fixture).paths, expected);
  assert.deepEqual(expected.slice(0, 3), ['f4/idea.md', 'f9/idea.md', 'f11/idea.md']);
});

test('recency also breaks ties between alias matches', async () => {
  const fixture = await createFixture({
    specs: [{ path: 'Alpha.md', mtime: 900 }, { path: 'Beta.md', mtime: 100 }],
    frontmatter: { 'Alpha.md': { aliases: ['Zorro'] }, 'Beta.md': { aliases: ['Zorro'] } },
    history: { 'Beta.md': 5000 },
  });
  search(fixture, 'zorro');
  assert.deepEqual(readResults(fixture).paths, ['Beta.md', 'Alpha.md']);
});
