'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadMain, subsequenceFuzzy } = require('./support/load-main.cjs');

// Same filter as main.js: dotfiles, Syncthing temporaries and .tmp files are never listed.
const IGNORED = /(^|\/)(~syncthing~|\.)|\.tmp$/;
const displayName = (file) => (file.extension === 'md' ? file.basename : file.name);

// Reference: the search algorithm Foyer used before 1.1 (full scan, full sort, exact check over all matches).
function referenceSearch(files, query, limit, fuzzyFactory = subsequenceFuzzy) {
  const fuzzy = fuzzyFactory(query);
  const matches = [];
  for (const file of files) {
    if (IGNORED.test(file.path)) continue;
    const name = displayName(file);
    const byName = fuzzy(name);
    if (byName) {
      matches.push({ file, name, onName: true, match: byName });
      continue;
    }
    const byPath = fuzzy(file.path);
    if (byPath) matches.push({ file, name, onName: false, match: byPath });
  }
  matches.sort((a, b) =>
    (b.onName - a.onName) ||
    (b.match.score - a.match.score) ||
    (b.file.stat.mtime - a.file.stat.mtime));
  const exact = matches.some((m) => m.name.toLowerCase() === query.replace(/\.md$/i, '').toLowerCase());
  return { paths: matches.slice(0, limit).map((m) => m.file.path), exact };
}

// Deterministic pseudo-random generator so fixtures are stable between runs.
function lcg(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

// Small alphabet and few mtimes: plenty of ties on score and on mtime, names and paths that match differently.
function buildFixtureSpecs(count = 160) {
  const random = lcg(42);
  const folders = ['', 'notes/', 'archive/notes/', 'projects/alpha/', 'abc/'];
  const letters = 'abcde';
  const specs = [];
  for (let i = 0; i < count; i++) {
    let name = '';
    const length = 2 + Math.floor(random() * 5);
    for (let j = 0; j < length; j++) name += letters[Math.floor(random() * letters.length)];
    const folder = folders[Math.floor(random() * folders.length)];
    specs.push({ path: `${folder}${name}-${i % 7}.md`, mtime: 1000 + Math.floor(random() * 4) * 100 });
  }
  specs.push(
    { path: 'Idea.md', mtime: 5000 },
    { path: 'ideas/Plan.md', mtime: 5100 },
    { path: 'Ideal/readme.md', mtime: 5200 },
    { path: 'notes/Idea.md', mtime: 5000 },
    { path: 'diagram.canvas', mtime: 4000 },
    // Never listed:
    { path: '.obsidian/abc.md', mtime: 9000 },
    { path: 'abc/.hidden.md', mtime: 9000 },
    { path: 'abc/~syncthing~abc.md', mtime: 9000 },
    { path: 'abc/abc.tmp', mtime: 9000 },
  );
  return specs;
}

async function createFixture({ specs = buildFixtureSpecs(), resultLimit = 7, animationFrames = true } = {}) {
  const fuzzyCalls = { count: 0 };
  const countingFuzzy = (query) => {
    const fuzzy = subsequenceFuzzy(query);
    return (text) => {
      fuzzyCalls.count += 1;
      return fuzzy(text);
    };
  };
  const main = loadMain({ fuzzy: countingFuzzy, animationFrames });
  const files = specs.map(({ path, mtime }) => new main.TFile(path, mtime));
  const handlers = {};
  const vault = {
    getFilesCalls: 0,
    getFiles() {
      vault.getFilesCalls += 1;
      return files.slice();
    },
    getAbstractFileByPath: () => null,
    on(name, handler) {
      (handlers[name] ||= []).push(handler);
      return { name, handler };
    },
    emit(name, ...args) {
      for (const handler of handlers[name] || []) handler(...args);
    },
    add(path, mtime = 0) {
      const file = new main.TFile(path, mtime);
      files.push(file);
      vault.emit('create', file);
      return file;
    },
    remove(path) {
      const index = files.findIndex((file) => file.path === path);
      const [file] = files.splice(index, 1);
      vault.emit('delete', file);
    },
    rename(oldPath, newPath) {
      const old = files.find((file) => file.path === oldPath);
      const renamed = new main.TFile(newPath, old.stat.mtime);
      files[files.indexOf(old)] = renamed;
      vault.emit('rename', renamed, oldPath);
    },
  };
  const opened = [];
  const leaf = { openFile: async (file) => { opened.push(file.path); } };
  const plugin = {
    settings: { name: 'Toni', resultLimit, recentLimit: 8 },
    getEffectiveLanguage: () => 'en',
    getLastOpened: () => null,
  };
  const view = new main.HomeView(leaf, plugin);
  view.app = {
    vault,
    workspace: { on: () => ({}), getLastOpenFiles: () => [], getActiveViewOfType: () => null },
  };
  await view.onOpen();
  return { main, view, vault, files, opened, fuzzyCalls, plugin };
}

// Types a query as the user would: set the value and fire the registered input handler (no frame flush).
function typeText(view, text) {
  view.inputEl.value = text;
  const input = view.domHandlers.find(({ el, type }) => el === view.inputEl && type === 'input');
  input.handler();
}

function typeAndFlush(fixture, text) {
  typeText(fixture.view, text);
  fixture.main.frames.flush();
}

const isAction = (item) => item.el.classes.has('foyer__item--action');

// Paths of the visible file results, in order, plus whether "Create note" is offered.
function readResults(fixture) {
  const { view, opened } = fixture;
  opened.length = 0;
  const fileItems = view.items.filter((item) => !isAction(item));
  for (const item of fileItems) item.run(false);
  const paths = opened.slice();
  opened.length = 0;
  const actions = view.items.filter(isAction).length;
  return { paths, exact: actions === 1 };
}

function assertMatchesReference(fixture, query, limit = fixture.plugin.settings.resultLimit) {
  const expected = referenceSearch(fixture.files, query, limit);
  const actual = readResults(fixture);
  assert.deepEqual(actual.paths, expected.paths, `ranking for «${query}»`);
  assert.equal(actual.exact, expected.exact, `exact-match flag for «${query}»`);
}

test('ranking is identical to the previous algorithm for every query, searched from scratch', async () => {
  const fixture = await createFixture();
  const queries = ['a', 'ab', 'abc', 'abcd', 'b', 'c', 'de', 'ea', 'notes', 'nt', 'alpha', 'idea', 'ide', 'ideal',
    'idea.md', 'Idea', 'plan', 'diagram', 'zzz', 'abc.tmp', 'hidden', 'syncthing', '-3', 'a-1', 'arch'];
  for (const query of queries) {
    // Reset narrowing state so each query is a full scan.
    fixture.vault.emit('create', {});
    typeAndFlush(fixture, query);
    assertMatchesReference(fixture, query);
  }
});

test('ranking keeps ties in vault order and honors name-before-path, score, then newer mtime', async () => {
  const specs = [
    { path: 'zeta/ab.md', mtime: 100 },       // name match, score tie with the next two
    { path: 'alpha/ab.md', mtime: 300 },      // name match, newer
    { path: 'beta/ab.md', mtime: 300 },       // name match, same mtime as the previous: vault order decides
    { path: 'a-b.md', mtime: 900 },           // name match with a worse score (one skipped character)
    { path: 'ab/readme.md', mtime: 9999 },    // path match only: always after every name match
    { path: '.hidden/ab.md', mtime: 9999 },   // ignored
  ];
  const fixture = await createFixture({ specs });
  typeAndFlush(fixture, 'ab');
  assert.deepEqual(readResults(fixture).paths, [
    'alpha/ab.md', 'beta/ab.md', 'zeta/ab.md', 'a-b.md', 'ab/readme.md',
  ]);
  assertMatchesReference(fixture, 'ab');
});

test('only the best resultLimit matches are listed, in the same order as the full sort', async () => {
  for (const limit of [3, 7, 20]) {
    const fixture = await createFixture({ resultLimit: limit });
    typeAndFlush(fixture, 'a');
    const { paths } = readResults(fixture);
    assert.equal(paths.length, limit);
    assertMatchesReference(fixture, 'a', limit);
  }
});

test('the exact-match check ignores a trailing .md and still offers Create note for partial names', async () => {
  const fixture = await createFixture();
  typeAndFlush(fixture, 'Idea');
  assert.equal(readResults(fixture).exact, true);
  typeAndFlush(fixture, 'idea.md');
  assert.equal(readResults(fixture).exact, true);
  typeAndFlush(fixture, 'ide');
  assert.equal(readResults(fixture).exact, false);
  // The exact file is not among the visible results, but it still counts.
  const crowded = await createFixture({ resultLimit: 3, specs: [
    ...Array.from({ length: 10 }, (_, i) => ({ path: `idea-${i}.md`, mtime: 9000 + i })),
    { path: 'old/idea.md', mtime: 1 },
  ] });
  typeAndFlush(crowded, 'idea');
  const crowdedResults = readResults(crowded);
  assert.equal(crowdedResults.paths.includes('old/idea.md'), false, 'the older exact file is cut by the limit');
  assert.equal(crowdedResults.exact, true);
});

test('the listed-file cache is built once and reused until the vault changes', async () => {
  const fixture = await createFixture();
  typeAndFlush(fixture, 'a');
  typeAndFlush(fixture, 'b');
  typeAndFlush(fixture, 'ab');
  assert.equal(fixture.vault.getFilesCalls, 1);
});

test('creating a file invalidates the cache and the new file is searchable', async () => {
  const fixture = await createFixture();
  typeAndFlush(fixture, 'qwerty');
  assert.deepEqual(readResults(fixture).paths, []);
  fixture.vault.add('notes/qwerty.md', 10);
  typeAndFlush(fixture, 'qwerty');
  assert.deepEqual(readResults(fixture).paths, ['notes/qwerty.md']);
  assert.equal(fixture.vault.getFilesCalls, 2);
});

test('deleting a file invalidates the cache and the file disappears', async () => {
  const fixture = await createFixture();
  typeAndFlush(fixture, 'Plan');
  assert.deepEqual(readResults(fixture).paths, ['ideas/Plan.md']);
  fixture.vault.remove('ideas/Plan.md');
  typeAndFlush(fixture, 'Plan');
  assert.deepEqual(readResults(fixture).paths, []);
});

test('renaming a file invalidates the cache: found under the new name, gone under the old one', async () => {
  const fixture = await createFixture();
  typeAndFlush(fixture, 'diagram');
  assert.deepEqual(readResults(fixture).paths, ['diagram.canvas']);
  fixture.vault.rename('diagram.canvas', 'drawings/sketch.canvas');
  typeAndFlush(fixture, 'diagram');
  assert.deepEqual(readResults(fixture).paths, []);
  typeAndFlush(fixture, 'sketch');
  assert.deepEqual(readResults(fixture).paths, ['drawings/sketch.canvas']);
});

test('several vault events between two searches cost a single rebuild', async () => {
  const fixture = await createFixture();
  typeAndFlush(fixture, 'a');
  fixture.vault.add('x1.md');
  fixture.vault.add('x2.md');
  fixture.vault.add('x3.md');
  assert.equal(fixture.vault.getFilesCalls, 1, 'the cache is rebuilt lazily, not on each event');
  typeAndFlush(fixture, 'ab');
  assert.equal(fixture.vault.getFilesCalls, 2);
});

test('extending the previous query only matches against the previous candidates, with identical results', async () => {
  const fixture = await createFixture();
  const listed = fixture.files.filter((file) => !IGNORED.test(file.path)).length;
  typeAndFlush(fixture, 'i');
  assert.ok(fixture.fuzzyCalls.count >= listed, 'the first search scans every listed file');
  const candidates = referenceSearch(fixture.files, 'i', Infinity).paths.length;
  assert.ok(candidates > 0 && candidates < listed / 4, 'the fixture has few candidates for «i»');

  fixture.fuzzyCalls.count = 0;
  typeAndFlush(fixture, 'id');
  assert.ok(fixture.fuzzyCalls.count <= 2 * candidates, `narrowed scan: ${fixture.fuzzyCalls.count} calls for ${candidates} candidates`);
  assert.ok(fixture.fuzzyCalls.count < listed, 'fewer matcher calls than files in the vault');
  assertMatchesReference(fixture, 'id');

  typeAndFlush(fixture, 'ide');
  assertMatchesReference(fixture, 'ide');
  typeAndFlush(fixture, 'idea');
  assertMatchesReference(fixture, 'idea');
  typeAndFlush(fixture, 'idea ');
  assertMatchesReference(fixture, 'idea');
});

test('a case-different extension of the previous query still narrows', async () => {
  const fixture = await createFixture();
  typeAndFlush(fixture, 'id');
  fixture.fuzzyCalls.count = 0;
  typeAndFlush(fixture, 'IDe');
  const listed = fixture.files.filter((file) => !IGNORED.test(file.path)).length;
  assert.ok(fixture.fuzzyCalls.count < listed);
  assertMatchesReference(fixture, 'IDe');
});

test('a non-prefix edit (backspace or replacement) rescans the whole cache and matches a full scan', async () => {
  const fixture = await createFixture();
  const listed = fixture.files.filter((file) => !IGNORED.test(file.path)).length;
  typeAndFlush(fixture, 'abc');
  typeAndFlush(fixture, 'ab');
  assert.ok(fixture.fuzzyCalls.count >= listed);
  assertMatchesReference(fixture, 'ab');

  typeAndFlush(fixture, 'a');
  assertMatchesReference(fixture, 'a');
  typeAndFlush(fixture, 'de');
  assertMatchesReference(fixture, 'de');
  typeAndFlush(fixture, 'dex');
  assertMatchesReference(fixture, 'dex');
  typeAndFlush(fixture, 'd');
  assertMatchesReference(fixture, 'd');
});

test('narrowing is dropped after the vault changes: files created or renamed in between still show up', async () => {
  const fixture = await createFixture();
  typeAndFlush(fixture, 'ab');
  fixture.vault.add('late/abzz.md', 99999);
  fixture.vault.rename('Idea.md', 'abIdea.md');
  typeAndFlush(fixture, 'abz');
  assertMatchesReference(fixture, 'abz');
  assert.ok(readResults(fixture).paths.includes('late/abzz.md'));
  typeAndFlush(fixture, 'abi');
  assertMatchesReference(fixture, 'abi');
  assert.ok(readResults(fixture).paths.includes('abIdea.md'));
});

test('clearing the query resets narrowing: a later unrelated query is a full scan', async () => {
  const fixture = await createFixture();
  typeAndFlush(fixture, 'abc');
  typeAndFlush(fixture, '');
  assert.equal(fixture.view.items.length, 0);
  typeAndFlush(fixture, 'abcd');
  assertMatchesReference(fixture, 'abcd');
  typeAndFlush(fixture, 'zq');
  typeAndFlush(fixture, 'zqx');
  assert.deepEqual(readResults(fixture).paths, []);
});

test('a burst of input events runs one search per animation frame', async () => {
  const fixture = await createFixture();
  let searches = 0;
  const original = fixture.view.updateResults.bind(fixture.view);
  fixture.view.updateResults = () => { searches += 1; original(); };

  typeText(fixture.view, 'a');
  typeText(fixture.view, 'ab');
  typeText(fixture.view, 'abc');
  assert.equal(searches, 0, 'nothing runs before the frame');
  assert.equal(fixture.main.frames.queue.length, 1, 'a single frame is requested for the whole burst');

  fixture.main.frames.flush();
  assert.equal(searches, 1);
  assertMatchesReference(fixture, 'abc');

  typeText(fixture.view, 'abcd');
  fixture.main.frames.flush();
  assert.equal(searches, 2);
});

test('without requestAnimationFrame the search is delayed by at most 50 ms with a timer', async () => {
  const fixture = await createFixture({ animationFrames: false });
  let searches = 0;
  const original = fixture.view.updateResults.bind(fixture.view);
  fixture.view.updateResults = () => { searches += 1; original(); };
  const before = fixture.main.timers.timeouts.length;

  typeText(fixture.view, 'a');
  typeText(fixture.view, 'ab');
  const scheduled = fixture.main.timers.timeouts.slice(before);
  assert.equal(scheduled.length, 1, 'one timer for the whole burst');
  assert.ok(scheduled[0].ms <= 50);
  assert.equal(searches, 0);

  scheduled[0].fn();
  assert.equal(searches, 1);
  assertMatchesReference(fixture, 'ab');
});

test('Enter with a pending search runs it first and opens the best match for the current text', async () => {
  const fixture = await createFixture();
  typeAndFlush(fixture, 'a');
  const stale = readResults(fixture).paths[0];

  typeText(fixture.view, 'plan'); // pending: the rendered results still belong to «a»
  fixture.opened.length = 0;
  fixture.view.onKeyDown({ key: 'Enter', preventDefault() {}, shiftKey: false });

  assert.deepEqual(fixture.opened, ['ideas/Plan.md']);
  assert.notEqual(stale, 'ideas/Plan.md');
  fixture.main.frames.flush(); // the frame that was pending must not search again with stale state
  assert.equal(fixture.main.frames.queue.length, 0);
});

test('arrow keys with a pending search move through the up-to-date results', async () => {
  const fixture = await createFixture();
  typeAndFlush(fixture, 'a');
  typeText(fixture.view, 'ide');
  fixture.view.onKeyDown({ key: 'ArrowDown', preventDefault() {} });
  assert.equal(fixture.view.selected, 1);
  const expected = referenceSearch(fixture.files, 'ide', 7).paths;
  assert.deepEqual(readResults(fixture).paths, expected);

  typeText(fixture.view, 'plan');
  fixture.view.onKeyDown({ key: 'ArrowUp', preventDefault() {} });
  const total = fixture.view.items.length;
  assert.equal(fixture.view.selected, total - 1, 'wraps from the first item to the last of the new results');
});

test('Escape clears the query and cancels the pending search', async () => {
  const fixture = await createFixture();
  typeAndFlush(fixture, 'abc');
  typeText(fixture.view, 'abcd');
  fixture.view.onKeyDown({ key: 'Escape', preventDefault() {} });
  assert.equal(fixture.view.inputEl.value, '');
  assert.equal(fixture.view.items.length, 0);
  fixture.main.frames.flush();
  assert.equal(fixture.view.items.length, 0, 'the cancelled frame never repaints old results');
});

test('closing the view cancels the pending search and drops the caches', async () => {
  const fixture = await createFixture();
  let searches = 0;
  const original = fixture.view.updateResults.bind(fixture.view);
  fixture.view.updateResults = () => { searches += 1; original(); };
  typeText(fixture.view, 'abc');
  await fixture.view.onClose();
  fixture.main.frames.flush();
  assert.equal(searches, 0);
});

test('timing report: 50,000 synthetic files, typing one query character by character', async () => {
  const random = lcg(7);
  const syllables = ['no', 'te', 'ra', 'li', 'mo', 'ka', 'su', 'pe', 'ta', 'vi'];
  const specs = [];
  for (let i = 0; i < 50000; i++) {
    const parts = [];
    for (let j = 0; j < 3; j++) parts.push(syllables[Math.floor(random() * syllables.length)]);
    specs.push({
      path: `folder-${i % 200}/sub-${i % 17}/${parts.join('')}-${i}.md`,
      mtime: 1000 + Math.floor(random() * 5000),
    });
  }
  const fixture = await createFixture({ specs, animationFrames: true });
  const query = 'notera';
  const lines = [];
  let total = 0;
  for (let length = 1; length <= query.length; length++) {
    const text = query.slice(0, length);
    const start = performance.now();
    typeAndFlush(fixture, text);
    const elapsed = performance.now() - start;
    total += elapsed;
    const reference = performance.now();
    const expected = referenceSearch(fixture.files, text, 7);
    const referenceElapsed = performance.now() - reference;
    assert.deepEqual(readResults(fixture).paths, expected.paths);
    lines.push(`  «${text}»: ${elapsed.toFixed(1)} ms now, ${referenceElapsed.toFixed(1)} ms with the previous algorithm`);
  }
  // Backspace: a full rescan of the cache, no narrowing.
  const start = performance.now();
  typeAndFlush(fixture, 'noter');
  lines.push(`  «noter» (backspace-style edit): ${(performance.now() - start).toFixed(1)} ms now`);
  console.log(`[timing] 50,000 files, per search (matcher stub, not Obsidian's):\n${lines.join('\n')}\n  typing total: ${total.toFixed(1)} ms`);
});
