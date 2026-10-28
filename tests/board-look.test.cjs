'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { createViewFixture, boardOf, recentGroupOf, sectionHeads, sections } = require('./support/view-fixture.cjs');

const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Declarations of every rule whose selector list contains `selector` (exactly), joined.
function declarations(selector) {
  const found = [];
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectors.split(',').some((candidate) => candidate.trim() === selector)) found.push(body.trim());
  }
  return found.join('\n');
}
const property = (selector, name) => {
  const match = declarations(selector).match(new RegExp(`(?:^|[;\\s])${name}\\s*:\\s*([^;]+)`));
  return match ? match[1].trim() : null;
};

/* ── Look of the sticky note ── */
test('hovering or selecting a card changes no shadow', () => {
  for (const selector of ['.foyer__card:hover', '.foyer__card.is-selected']) {
    assert.ok(declarations(selector), selector);
    assert.equal(property(selector, 'box-shadow'), null, selector);
  }
});

test('the card has no background fill and no tint', () => {
  assert.equal(property('.foyer__card', 'background'), 'transparent');
  assert.doesNotMatch(css, /--foyer-card-tint/);
  assert.doesNotMatch(declarations('.foyer__card'), /linear-gradient/);
});

test('a pin color shows as the card border, never as a fill', () => {
  for (const color of ['yellow', 'orange', 'red', 'purple', 'blue', 'cyan', 'green', 'pink']) {
    const body = declarations(`.foyer__card--${color}`);
    assert.match(body, new RegExp(`border-color:\\s*rgba\\(var\\(--color-${color}-rgb\\)`), color);
    assert.doesNotMatch(body, /background/, color);
  }
});

test('the card text has the same size and weight as the Recent rows', () => {
  assert.equal(property('.foyer__card-title', 'font-size'), property('.foyer__row-title', 'font-size'));
  assert.equal(property('.foyer__card-title', 'font-weight'), property('.foyer__row-title', 'font-weight')); // both unset
  assert.equal(property('.foyer__card-title', 'font-weight'), null);
  assert.equal(property('.foyer__card-path', 'font-size'), property('.foyer__row-path', 'font-size'));
  assert.equal(property('.foyer__card-path', 'font-family'), property('.foyer__row-path', 'font-family'));
  assert.equal(property('.foyer__card-path', 'color'), property('.foyer__row-path', 'color'));
});

/* ── No "Pinned" label ── */
const mixed = (extra = {}) => createViewFixture({
  paths: ['A.md', 'B.md'],
  history: { 'B.md': 1 },
  pinned: ['A.md'],
  ...extra,
});

test('there is no visible Pinned heading; only Recent keeps its heading', async () => {
  const fixture = await mixed();
  assert.deepEqual(sectionHeads(fixture.view).map((head) => head.children[0].text), ['Recent']);
  const pinsOnly = await createViewFixture({ paths: ['A.md'], pinned: ['A.md'] });
  assert.deepEqual(sectionHeads(pinsOnly.view), []);
});

test('the board is still announced as a labelled group, in both languages', async () => {
  const en = await mixed();
  assert.equal(boardOf(en.view).attributes.role, 'group');
  assert.equal(boardOf(en.view).attributes['aria-label'], 'Pinned');
  const es = await mixed({ language: 'es' });
  assert.equal(boardOf(es.view).attributes['aria-label'], 'Fijadas');
  assert.equal(recentGroupOf(es.view).attributes['aria-label'], 'Recientes');
});

test('the listbox holds the board and the Recent group, in that order', async () => {
  const fixture = await mixed();
  assert.deepEqual(
    fixture.view.recentEl.children.map((el) => [...el.classes][0]),
    ['foyer__board', 'foyer__recent-group'],
  );
  assert.equal(recentGroupOf(fixture.view).attributes.role, 'group');
  assert.deepEqual(sections(fixture.view), [{ head: 'Pinned', rows: ['A'] }, { head: 'Recent', rows: ['B'] }]);
});
