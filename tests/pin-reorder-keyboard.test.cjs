'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createViewFixture, optionRows, cardsOf, rowTitle, sections } = require('./support/view-fixture.cjs');

const key = (name, extra = {}) => ({ key: name, preventDefault() {}, ...extra });
const alt = (name, extra = {}) => key(name, { altKey: true, ...extra });
const cardTitles = (fixture) => cardsOf(fixture.view).map(rowTitle);
const selectedTitle = (fixture) => {
  const row = optionRows(fixture.view).find((el) => el.classes.has('is-selected'));
  return row ? rowTitle(row) : null;
};

const four = (extra = {}) => createViewFixture({
  paths: ['A.md', 'B.md', 'C.md', 'D.md', 'R.md'],
  history: { 'R.md': 10 },
  pinned: ['A.md', 'B.md', 'C.md', 'D.md'],
  ...extra,
});

// Selects the card at `index` with plain ArrowDown, then presses a key with Alt and waits for the move to finish.
async function selectAndPress(fixture, index, keyEvent) {
  for (let i = 0; i <= index; i++) fixture.view.onKeyDown(key('ArrowDown'));
  fixture.view.onKeyDown(keyEvent);
  await fixture.view.pendingMove;
}

/* ── Moving ── */
test('Alt+ArrowRight moves the selected card one place later and keeps it selected', async () => {
  const fixture = await four();
  let prevented = 0;
  await selectAndPress(fixture, 0, alt('ArrowRight', { preventDefault: () => { prevented += 1; } }));
  assert.equal(prevented, 1);
  assert.deepEqual(fixture.reorders, [['B.md', 'A.md', 'C.md', 'D.md']]);
  assert.deepEqual(cardTitles(fixture), ['B', 'A', 'C', 'D']);
  assert.equal(selectedTitle(fixture), 'A');
  assert.equal(fixture.view.selected, 1);
  assert.equal(fixture.view.inputEl.attributes['aria-activedescendant'], optionRows(fixture.view)[1].attributes.id);
});

test('Alt+ArrowLeft, Alt+ArrowUp and Alt+ArrowDown move by one place too', async () => {
  const left = await four();
  await selectAndPress(left, 2, alt('ArrowLeft'));
  assert.deepEqual(cardTitles(left), ['A', 'C', 'B', 'D']);

  const up = await four();
  await selectAndPress(up, 3, alt('ArrowUp'));
  assert.deepEqual(cardTitles(up), ['A', 'B', 'D', 'C']);

  const down = await four();
  await selectAndPress(down, 1, alt('ArrowDown'));
  assert.deepEqual(cardTitles(down), ['A', 'C', 'B', 'D']);
});

test('the board does not wrap and a card never moves into Recent', async () => {
  const fixture = await four();
  await selectAndPress(fixture, 0, alt('ArrowLeft'));
  assert.deepEqual(fixture.reorders, []);
  assert.equal(selectedTitle(fixture), 'A');

  const last = await four();
  await selectAndPress(last, 3, alt('ArrowRight'));
  assert.deepEqual(last.reorders, []);
  assert.deepEqual(sections(last.view), [
    { head: 'Pinned', rows: ['A', 'B', 'C', 'D'] },
    { head: 'Recent', rows: ['R'] },
  ]);
});

test('several moves in a row work one after another', async () => {
  const fixture = await four();
  await selectAndPress(fixture, 0, alt('ArrowRight'));
  fixture.view.onKeyDown(alt('ArrowRight'));
  await fixture.view.pendingMove;
  assert.deepEqual(cardTitles(fixture), ['B', 'C', 'A', 'D']);
  assert.equal(selectedTitle(fixture), 'A');
  assert.equal(fixture.reorders.length, 2);
});

test('a second Alt+arrow while the first is still being saved is ignored', async () => {
  const fixture = await four();
  fixture.view.onKeyDown(key('ArrowDown'));
  fixture.view.onKeyDown(alt('ArrowRight'));
  fixture.view.onKeyDown(alt('ArrowRight'));
  await fixture.view.pendingMove;
  assert.equal(fixture.reorders.length, 1);
  assert.deepEqual(cardTitles(fixture), ['B', 'A', 'C', 'D']);
});

test('hidden pinned entries keep their slot when visible cards move', async () => {
  const fixture = await createViewFixture({ paths: ['A.md', 'B.md'], pinned: ['A.md', 'Gone.md', 'B.md'] });
  await selectAndPress(fixture, 0, alt('ArrowRight'));
  assert.deepEqual(fixture.plugin.settings.pinned.map((entry) => entry.path), ['B.md', 'Gone.md', 'A.md']);
});

test('a moved card keeps its color', async () => {
  const fixture = await createViewFixture({
    paths: ['A.md', 'B.md'],
    pinned: [{ path: 'A.md', color: 'red' }, { path: 'B.md', color: '' }],
  });
  await selectAndPress(fixture, 0, alt('ArrowRight'));
  assert.equal(cardsOf(fixture.view)[1].classes.has('foyer__card--red'), true);
});

/* ── Where it does not apply ── */
test('Alt+arrows do nothing on a Recent row or with nothing selected', async () => {
  const fixture = await four();
  let prevented = 0;
  const event = alt('ArrowRight', { preventDefault: () => { prevented += 1; } });
  fixture.view.onKeyDown(event); // nothing selected: not consumed as a move
  await fixture.view.pendingMove;
  assert.deepEqual(fixture.reorders, []);

  const recent = await four();
  for (let i = 0; i < 5; i++) recent.view.onKeyDown(key('ArrowDown')); // R
  assert.equal(selectedTitle(recent), 'R');
  recent.view.onKeyDown(alt('ArrowRight'));
  await recent.view.pendingMove;
  assert.deepEqual(recent.reorders, []);
});

test('Alt+arrows do nothing while a search is active', async () => {
  const fixture = await four();
  fixture.view.onKeyDown(key('ArrowDown'));
  fixture.view.inputEl.value = 'a';
  fixture.view.onKeyDown(alt('ArrowRight'));
  await fixture.view.pendingMove;
  assert.deepEqual(fixture.reorders, []);
});

/* ── Navigation keeps working ── */
test('plain arrows and Enter still walk the new order, Pinned then Recent', async () => {
  const fixture = await four();
  await selectAndPress(fixture, 0, alt('ArrowRight')); // B A C D
  const order = [];
  for (let i = 0; i < 4; i++) {
    fixture.view.onKeyDown(key('ArrowDown'));
    order.push(selectedTitle(fixture));
  }
  assert.deepEqual(order, ['C', 'D', 'R', 'B']);
  fixture.view.onKeyDown(key('Enter'));
  await Promise.resolve();
  assert.deepEqual(fixture.opened, ['B.md']);
});

/* ── Screen readers ── */
test('a polite live region announces the new position', async () => {
  const fixture = await four();
  const live = fixture.view.liveEl;
  assert.equal(live.attributes['aria-live'], 'polite');
  assert.equal(live.attributes.role, 'status');
  assert.equal(live.attributes['aria-atomic'], 'true');
  assert.equal(live.text, '');
  await selectAndPress(fixture, 0, alt('ArrowRight'));
  assert.equal(live.text, 'A moved to position 2 of 4');
});

test('the announcement is in Spanish when the interface is Spanish', async () => {
  const fixture = await four({ language: 'es' });
  await selectAndPress(fixture, 2, alt('ArrowLeft'));
  assert.equal(fixture.view.liveEl.text, 'C: posición 2 de 4');
});

test('the live region is not part of the listbox', async () => {
  const fixture = await four();
  assert.equal(fixture.view.recentEl.children.includes(fixture.view.liveEl), false);
  assert.ok(fixture.view.liveEl.classes.has('foyer__live'));
});
