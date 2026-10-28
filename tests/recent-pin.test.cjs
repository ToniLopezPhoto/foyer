'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const { createViewFixture, cardsOf, recentGroupOf, rowTitle, sections } = require('./support/view-fixture.cjs');

const css = readFileSync(join(__dirname, '..', 'styles.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const recentRows = (fixture) => recentGroupOf(fixture.view).children.filter((el) => el.classes.has('foyer__row'));
const pinButton = (row) => row.children.find((child) => child.classes.has('foyer__row-pin'));
const removeButton = (row) => row.children.find((child) => child.classes.has('foyer__row-remove'));

const setup = (extra = {}) => createViewFixture({
  paths: ['A.md', 'B.md', 'C.md'],
  history: { 'A.md': 30, 'B.md': 20, 'C.md': 10 },
  ...extra,
});

test('every Recent row has a pin button with an accessible label, next to the remove button', async () => {
  const fixture = await setup();
  const rows = recentRows(fixture);
  assert.equal(rows.length, 3);
  for (const row of rows) {
    const button = pinButton(row);
    assert.ok(button, 'pin button');
    assert.equal(button.attributes['aria-label'], 'Pin to Foyer');
    assert.equal(button.attributes.title, 'Pin to Foyer');
    assert.equal(button.attributes.type, 'button');
    assert.equal(button.attributes.tabindex, '-1');
    assert.equal(row.children.indexOf(pinButton(row)) + 1, row.children.indexOf(removeButton(row)));
  }
});

test('the label is Spanish when the interface is Spanish', async () => {
  const fixture = await setup({ language: 'es' });
  assert.equal(pinButton(recentRows(fixture)[0]).attributes['aria-label'], 'Fijar en Foyer');
});

test('clicking the pin pins the note, moves it to the board and does not open it', async () => {
  const fixture = await setup();
  const stopped = [];
  pinButton(recentRows(fixture)[1]).dispatch('click', { stopPropagation: () => stopped.push('click') });
  await Promise.resolve();
  assert.deepEqual(fixture.pinnedNow, ['B.md']);
  assert.deepEqual(stopped, ['click']);
  assert.deepEqual(fixture.opened, []);
  assert.deepEqual(sections(fixture.view), [
    { head: 'Pinned', rows: ['B'] },
    { head: 'Recent', rows: ['A', 'C'] },
  ]);
  assert.deepEqual(cardsOf(fixture.view).map(rowTitle), ['B']);
});

test('a middle click on the pin does not reach the row', async () => {
  const fixture = await setup();
  const stopped = [];
  pinButton(recentRows(fixture)[0]).dispatch('auxclick', { button: 1, stopPropagation: () => stopped.push('aux') });
  assert.deepEqual(stopped, ['aux']);
});

test('pinned cards have the unpin button, not the pin', async () => {
  const fixture = await setup({ pinned: ['A.md'] });
  const card = cardsOf(fixture.view)[0];
  assert.equal(card.children.some((child) => child.classes.has('foyer__row-pin')), false);
  assert.equal(card.children.some((child) => child.classes.has('foyer__card-unpin')), true);
});

test('the pin button is styled like the remove button and the row has room for it', () => {
  const body = (selector) => {
    for (const [, selectors, text] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (selectors.split(',').some((candidate) => candidate.trim() === selector)) return text;
    }
    return '';
  };
  assert.match(body('.foyer__row'), /grid-template-columns:\s*auto 1fr auto auto auto;/);
  assert.match(body('.foyer__row-pin'), /opacity:\s*0;/);
  assert.match(css, /\.foyer__row:hover \.foyer__row-pin/);
  assert.match(css, /\.foyer__row\.is-selected \.foyer__row-pin/);
  assert.match(css, /\.is-mobile \.foyer__row-pin/);
});
