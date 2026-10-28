'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createViewFixture, optionRows, boardOf, cardsOf, rowTitle, sections } = require('./support/view-fixture.cjs');

const cardTexts = (card) => card.children.filter((child) => child.text).map((child) => child.text);

const board = (extra = {}) => createViewFixture({
  paths: ['Inbox.md', 'Projects/Plan.md', 'Projects/Deep/Idea.md', 'R1.md'],
  history: { 'R1.md': 10 },
  pinned: [
    { path: 'Inbox.md', color: '' },
    { path: 'Projects/Plan.md', color: 'blue' },
    { path: 'Projects/Deep/Idea.md', color: 'pink' },
  ],
  ...extra,
});

/* ── Structure ── */
test('pinned notes are cards on a board inside the listbox; Recent stays a list of rows', async () => {
  const fixture = await board();
  const boardEl = boardOf(fixture.view);
  assert.ok(boardEl, 'board');
  assert.equal(boardEl.attributes.role, 'presentation');
  assert.equal(fixture.view.recentEl.attributes.role, 'listbox');
  assert.deepEqual(cardsOf(fixture.view).map(rowTitle), ['Inbox', 'Plan', 'Idea']);
  assert.ok(cardsOf(fixture.view).every((card) => card.attributes.role === 'option'));
  const recentRows = fixture.view.recentEl.children.filter((el) => el.classes.has('foyer__row'));
  assert.equal(recentRows.length, 1);
  assert.deepEqual(sections(fixture.view), [
    { head: 'Pinned', rows: ['Inbox', 'Plan', 'Idea'] },
    { head: 'Recent', rows: ['R1'] },
  ]);
});

test('without pinned notes there is no board', async () => {
  const fixture = await createViewFixture({ paths: ['A.md'], history: { 'A.md': 1 } });
  assert.equal(boardOf(fixture.view), null);
});

test('a card shows the note title and its folder, nothing else', async () => {
  const fixture = await board();
  const [root, plan, deep] = cardsOf(fixture.view);
  assert.deepEqual(cardTexts(root), ['Inbox']);
  assert.deepEqual(cardTexts(plan), ['Plan', 'Projects']);
  assert.deepEqual(cardTexts(deep), ['Idea', 'Projects/Deep']);
  assert.equal(plan.attributes.title, 'Projects/Plan.md');
});

test('rendering the board never reads note contents', async () => {
  const fixture = await board();
  const { vault } = fixture.view.app;
  for (const method of ['read', 'cachedRead', 'readBinary']) assert.equal(method in vault, false, method);
  assert.deepEqual(cardsOf(fixture.view).length, 3); // rendered without any content API available
});

test('cards keep unique option ids shared with the Recent rows', async () => {
  const fixture = await board();
  const ids = optionRows(fixture.view).map((row) => row.attributes.id);
  assert.equal(ids.length, 4);
  assert.equal(new Set(ids).size, 4);
  assert.ok(ids.every((id) => id.startsWith(fixture.view.uid)));
});

/* ── Look ── */
test('each card has a stable tilt derived from its path', async () => {
  const fixture = await board();
  const { cardTilt } = fixture.main.settingsModule;
  const tilts = cardsOf(fixture.view).map((card) => card.style['--foyer-tilt']);
  assert.deepEqual(tilts, ['Inbox.md', 'Projects/Plan.md', 'Projects/Deep/Idea.md'].map((path) => `${cardTilt(path)}deg`));
  fixture.view.refresh();
  assert.deepEqual(cardsOf(fixture.view).map((card) => card.style['--foyer-tilt']), tilts);
});

test('the pin color becomes a card modifier class; no color adds none', async () => {
  const fixture = await board();
  const [none, blue, pink] = cardsOf(fixture.view);
  assert.equal([...none.classes].some((name) => name.startsWith('foyer__card--')), false);
  assert.equal(blue.classes.has('foyer__card--blue'), true);
  assert.equal(pink.classes.has('foyer__card--pink'), true);
  assert.equal(blue.classes.has('foyer__card'), true);
});

test('every palette color has a class and a matching CSS rule using the theme variables', async () => {
  const { readFileSync } = require('node:fs');
  const { join } = require('node:path');
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
  const fixture = await board();
  for (const color of fixture.main.settingsModule.PIN_COLORS) {
    assert.match(css, new RegExp(`\\.foyer__card--${color}\\b[^}]*--color-${color}-rgb`), color);
  }
  assert.doesNotMatch(css, /\.foyer__card[^{]*\{[^}]*#[0-9a-fA-F]{3,8}\b/, 'no hard-coded hex colors on the cards');
});

test('the motion rules respect prefers-reduced-motion', async () => {
  const { readFileSync } = require('node:fs');
  const { join } = require('node:path');
  const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8');
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /\.foyer__card/);
});

/* ── Unpin button ── */
test('a card has an unpin button with an accessible label', async () => {
  const fixture = await board();
  const button = cardsOf(fixture.view)[0].children.find((child) => child.classes.has('foyer__card-unpin'));
  assert.ok(button);
  assert.equal(button.attributes['aria-label'], 'Unpin from Foyer');
  assert.equal(button.attributes.type, 'button');
  assert.equal(button.attributes.tabindex, '-1');
});

test('clicking the unpin button unpins the note and does not open it', async () => {
  const fixture = await board();
  const stopped = [];
  const button = cardsOf(fixture.view)[1].children.find((child) => child.classes.has('foyer__card-unpin'));
  button.dispatch('click', { stopPropagation: () => stopped.push('click') });
  await Promise.resolve();
  assert.deepEqual(fixture.unpinned, ['Projects/Plan.md']);
  assert.deepEqual(fixture.opened, []);
  assert.deepEqual(stopped, ['click']);
  assert.deepEqual(cardsOf(fixture.view).map(rowTitle), ['Inbox', 'Idea']);
});

test('pointerdown on the unpin button does not reach the card', async () => {
  const fixture = await board();
  const stopped = [];
  const button = cardsOf(fixture.view)[0].children.find((child) => child.classes.has('foyer__card-unpin'));
  button.dispatch('pointerdown', { stopPropagation: () => stopped.push('down') });
  assert.deepEqual(stopped, ['down']);
});

/* ── Existing behavior still works on cards ── */
test('clicking a card opens the note, Mod+click in a new tab', async () => {
  const fixture = await board();
  const [, plan, deep] = cardsOf(fixture.view);
  plan.dispatch('click', {});
  deep.dispatch('click', { mode: 'tab' });
  await Promise.resolve();
  assert.deepEqual(fixture.opened, ['Projects/Plan.md', 'new:Projects/Deep/Idea.md']);
});

test('hovering a card shows the note preview', async () => {
  const fixture = await board();
  cardsOf(fixture.view)[1].dispatch('mouseover', { type: 'mouseover' });
  assert.equal(fixture.hoverEvents.length, 1);
  assert.equal(fixture.hoverEvents[0].payload.linktext, 'Projects/Plan.md');
});

test('the strings for the board exist in Spanish too', async () => {
  const fixture = await board();
  const { es, en } = fixture.main.settingsModule.STRINGS;
  assert.equal(typeof es.unpinFromFoyer, 'string');
  assert.notEqual(es.unpinFromFoyer, en.unpinFromFoyer);
});
