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
test('hovering or selecting a card adds no shadow and no lift; it only straightens the card', () => {
  for (const selector of ['.foyer__card:hover', '.foyer__card.is-selected']) {
    assert.ok(declarations(selector), selector);
    assert.equal(property(selector, 'box-shadow'), null, selector);
    assert.doesNotMatch(declarations(selector), /translate/, selector);
  }
  assert.equal(property('.foyer__card:hover', 'transform'), 'rotate(0deg)');
});

test('the resting card has no shadow, just a subtle theme border', () => {
  assert.equal(property('.foyer__card', 'box-shadow'), null);
  assert.equal(property('.foyer__card', 'border'), '1px solid var(--foyer-card-line)');
  assert.equal(property('.foyer__card', '--foyer-card-line'), 'var(--background-modifier-border)');
  assert.match(property('.foyer__card', 'transition'), /^transform [\d.]+s ease$/); // nothing animates a shadow
});

test('a card still gets a soft shadow while it is being dragged', () => {
  assert.match(declarations('.foyer__card.is-dragging'), /box-shadow:/);
});

test('the card has no background fill and no tint', () => {
  assert.equal(property('.foyer__card', 'background'), 'transparent');
  assert.doesNotMatch(css, /--foyer-card-tint/);
  assert.doesNotMatch(declarations('.foyer__card'), /linear-gradient/);
});

test('a pin color tints the border and the fold line, never a fill', () => {
  for (const color of ['yellow', 'orange', 'red', 'purple', 'blue', 'cyan', 'green', 'pink']) {
    const body = declarations(`.foyer__card--${color}`);
    assert.match(body, new RegExp(`--foyer-card-line:\\s*rgba\\(var\\(--color-${color}-rgb\\)`), color);
    assert.doesNotMatch(body, /background/, color);
  }
});

test('the folded corner is a line drawn with the border color, without a fill', () => {
  const body = declarations('.foyer__card-fold');
  assert.match(body, /var\(--foyer-card-line\)/);
  assert.doesNotMatch(body, /background-primary|rgba\(var\(--mono|background-color/);
  assert.match(property('.foyer__card-fold', 'background'), /transparent/);
});

test('the card text takes its size from the same properties as the Recent rows', () => {
  assert.equal(property('.foyer__row-title', 'font-size'), 'var(--foyer-title-size)');
  assert.equal(property('.foyer__card-title', 'font-size'), 'var(--foyer-title-size)');
  assert.equal(property('.foyer__row-path', 'font-size'), 'var(--foyer-path-size)');
  assert.equal(property('.foyer__card-path', 'font-size'), 'var(--foyer-path-size)');
  assert.equal(property('.foyer.view-content', '--foyer-title-size'), '0.88em');
  assert.equal(property('.foyer.view-content', '--foyer-path-size'), '0.62em');
  assert.equal((css.match(/0\.88em/g) || []).length, 1, 'the size is written once');
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
