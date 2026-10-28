'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadMain } = require('./support/load-main.cjs');
const { createViewFixture, boardOf, cardsOf, rowTitle } = require('./support/view-fixture.cjs');

// A 4-column grid of 100px cards with 10px gaps whose board sits at the origin, so client coordinates are board
// coordinates. Slots follow the DOM order, like a CSS grid, and `animations` records the FLIP animations.
const SIZE = 100;
const GAP = 10;
const COLS = 4;
const slotOf = (board, card) => board.children.indexOf(card);
const slotLeft = (slot) => (slot % COLS) * (SIZE + GAP);
const slotTop = (slot) => Math.floor(slot / COLS) * (SIZE + GAP);
// Center of the slot a card occupies in the layout (no transforms)
const centerOf = (slot) => [slotLeft(slot) + SIZE / 2, slotTop(slot) + SIZE / 2];

function installLayout(fixture) {
  const board = boardOf(fixture.view);
  board.getBoundingClientRect = () => ({ left: 0, top: 0 });
  fixture.animations = fixture.animations || [];
  for (const card of board.children) {
    Object.defineProperty(card, 'offsetLeft', { configurable: true, get: () => slotLeft(slotOf(board, card)) });
    Object.defineProperty(card, 'offsetTop', { configurable: true, get: () => slotTop(slotOf(board, card)) });
    card.offsetWidth = SIZE;
    card.offsetHeight = SIZE;
    card.animate = (keyframes, options) => {
      fixture.animations.push({ card, keyframes: JSON.parse(JSON.stringify(keyframes)), options });
      return { cancel() {} };
    };
  }
  return board;
}

async function dragFixture({ main = loadMain({ animationFrames: true }), pinned = ['A.md', 'B.md', 'C.md', 'D.md'] } = {}) {
  const fixture = await createViewFixture({
    main,
    paths: ['A.md', 'B.md', 'C.md', 'D.md', 'R.md'],
    history: { 'R.md': 10 },
    pinned,
  });
  installLayout(fixture);
  return fixture;
}

const titles = (fixture) => cardsOf(fixture.view).map(rowTitle);
const event = (extra = {}) => ({
  pointerId: 1, pointerType: 'mouse', button: 0, clientX: 0, clientY: 0, preventDefault() {}, stopPropagation() {}, ...extra,
});
const down = (card, x, y, extra) => card.dispatch('pointerdown', event({ clientX: x, clientY: y, ...extra }));
const move = (card, x, y, extra) => card.dispatch('pointermove', event({ clientX: x, clientY: y, ...extra }));
const up = (card, x, y, extra) => card.dispatch('pointerup', event({ clientX: x, clientY: y, ...extra }));

// Runs the pending 300 ms long-press timer, if any.
function longPress(fixture) {
  const timer = fixture.main.timers.timeouts.find((t) => t.ms === 300 && !t.cancelled && !t.fired);
  if (timer) { timer.fired = true; timer.fn(); }
  return Boolean(timer);
}

// Runs all pending 0 ms timers (the click suppression).
function flushZeroTimers(fixture) {
  for (const t of fixture.main.timers.timeouts) {
    if (t.ms === 0 && !t.cancelled && !t.fired) { t.fired = true; t.fn(); }
  }
}

/* ── Mouse ── */
test('dragging a card over another one reorders the board and saves the order on drop', async () => {
  const fixture = await dragFixture();
  const [a] = cardsOf(fixture.view);
  const [ax, ay] = centerOf(0);
  down(a, ax, ay);
  move(a, ax + 3, ay); // below the slop: still a click
  assert.equal(a.classes.has('is-dragging'), false);

  const [bx, by] = centerOf(1);
  move(a, bx, by);
  assert.equal(a.classes.has('is-dragging'), true);
  assert.equal(a.capturedPointer, 1);
  assert.deepEqual(titles(fixture), ['B', 'A', 'C', 'D']); // the others slid out of the way
  assert.deepEqual(fixture.reorders, []); // nothing is saved until the drop

  up(a, bx, by);
  await fixture.view.pendingMove;
  assert.deepEqual(fixture.reorders, [['B.md', 'A.md', 'C.md', 'D.md']]);
  assert.equal(a.classes.has('is-dragging'), false);
  assert.equal(a.style.transform, '');
  assert.deepEqual(fixture.plugin.settings.pinned.map((entry) => entry.path), ['B.md', 'A.md', 'C.md', 'D.md']);
});

test('dragging a card across the whole board and back', async () => {
  const fixture = await dragFixture();
  const [a] = cardsOf(fixture.view);
  down(a, ...centerOf(0));
  move(a, ...centerOf(1));
  move(a, ...centerOf(2));
  move(a, ...centerOf(3));
  assert.deepEqual(titles(fixture), ['B', 'C', 'D', 'A']);
  move(a, ...centerOf(1));
  assert.deepEqual(titles(fixture), ['B', 'A', 'C', 'D']);
  up(a, ...centerOf(1));
  await fixture.view.pendingMove;
  assert.deepEqual(fixture.reorders, [['B.md', 'A.md', 'C.md', 'D.md']]);
});

test('the dragged card follows the pointer, keeping the point where it was grabbed', async () => {
  const fixture = await dragFixture();
  const [a] = cardsOf(fixture.view);
  const [ax, ay] = centerOf(0);
  down(a, ax + 10, ay - 10); // grabbed 10px right of and above the center
  move(a, ax + 10 + 40, ay - 10);
  assert.match(a.style.transform, /^translate\(40px, 0px\)/);
  move(a, 170, 40); // over slot 1 (center 160, 50): the card is now laid out there
  assert.deepEqual(titles(fixture), ['B', 'A', 'C', 'D']);
  assert.match(a.style.transform, /^translate\(0px, 0px\)/); // pointer 170 - grab 10 = 160, exactly the new slot center
});

test('the cards that slide aside are animated with FLIP; the dragged one is not', async () => {
  const fixture = await dragFixture();
  const [a, b] = cardsOf(fixture.view);
  down(a, ...centerOf(0));
  move(a, ...centerOf(1));
  assert.equal(fixture.animations.length, 1);
  const [animation] = fixture.animations;
  assert.equal(animation.card, b);
  assert.deepEqual(animation.keyframes, [{ translate: '110px 0px' }, { translate: '0px 0px' }]);
  assert.equal(animation.options.duration, 180);
});

test('moving a card to the next row animates both axes', async () => {
  const fixture = await createViewFixture({
    paths: ['A.md', 'B.md', 'C.md', 'D.md', 'E.md', 'F.md'],
    pinned: ['A.md', 'B.md', 'C.md', 'D.md', 'E.md', 'F.md'],
  });
  installLayout(fixture);
  const cards = cardsOf(fixture.view);
  down(cards[4], ...centerOf(4)); // E, second row first column
  move(cards[4], ...centerOf(3)); // over D, first row last column
  assert.deepEqual(titles(fixture), ['A', 'B', 'C', 'E', 'D', 'F']);
  const d = fixture.animations.find((entry) => entry.card === cards[3]);
  assert.deepEqual(d.keyframes, [{ translate: '330px -110px' }, { translate: '0px 0px' }]); // from the last column of row 1 to the first of row 2
});

test('with reduced motion the order still changes but nothing is animated', async () => {
  const fixture = await dragFixture({ main: loadMain({ animationFrames: true, reducedMotion: true }) });
  const [a] = cardsOf(fixture.view);
  down(a, ...centerOf(0));
  move(a, ...centerOf(1));
  assert.deepEqual(titles(fixture), ['B', 'A', 'C', 'D']);
  assert.deepEqual(fixture.animations, []);
  assert.equal(a.style.transform.includes('scale'), false);
});

test('a click without moving does not start a drag and still opens the note', async () => {
  const fixture = await dragFixture();
  const [a] = cardsOf(fixture.view);
  down(a, ...centerOf(0));
  up(a, ...centerOf(0));
  a.dispatch('click', {});
  await Promise.resolve();
  assert.deepEqual(fixture.opened, ['A.md']);
  assert.deepEqual(fixture.reorders, []);
});

test('the click that ends a drag does not open the note; the next click does', async () => {
  const fixture = await dragFixture();
  const [a] = cardsOf(fixture.view);
  down(a, ...centerOf(0));
  move(a, ...centerOf(1));
  up(a, ...centerOf(1));
  await fixture.view.pendingMove;
  a.dispatch('click', {});
  await Promise.resolve();
  assert.deepEqual(fixture.opened, []);
  flushZeroTimers(fixture);
  a.dispatch('click', {});
  await Promise.resolve();
  assert.deepEqual(fixture.opened, ['A.md']);
});

test('dropping a card where it started saves nothing', async () => {
  const fixture = await dragFixture();
  const [a] = cardsOf(fixture.view);
  down(a, ...centerOf(0));
  move(a, ...centerOf(0).map((v) => v + 20));
  up(a, ...centerOf(0));
  await fixture.view.pendingMove;
  assert.deepEqual(fixture.reorders, []);
  assert.deepEqual(titles(fixture), ['A', 'B', 'C', 'D']);
});

test('right button and other pointers do not start a drag', async () => {
  const fixture = await dragFixture();
  const [a] = cardsOf(fixture.view);
  down(a, ...centerOf(0), { button: 2 });
  move(a, ...centerOf(1), { button: 2 });
  assert.equal(a.classes.has('is-dragging'), false);

  down(a, ...centerOf(0));
  move(a, ...centerOf(1), { pointerId: 7 });
  assert.equal(a.classes.has('is-dragging'), false);
  assert.deepEqual(titles(fixture), ['A', 'B', 'C', 'D']);
});

test('a render while dragging waits for the drop', async () => {
  const fixture = await dragFixture();
  const [a] = cardsOf(fixture.view);
  down(a, ...centerOf(0));
  move(a, ...centerOf(1));
  fixture.view.renderRecent(); // e.g. a file-open event
  assert.equal(cardsOf(fixture.view)[1], a); // the dragged card is still the same element
  assert.equal(a.classes.has('is-dragging'), true);
  up(a, ...centerOf(1));
  await fixture.view.pendingMove;
  assert.deepEqual(titles(fixture), ['B', 'A', 'C', 'D']);
});

test('pointercancel puts the board back as it was and saves nothing', async () => {
  const fixture = await dragFixture();
  const [a] = cardsOf(fixture.view);
  down(a, ...centerOf(0));
  move(a, ...centerOf(2));
  assert.deepEqual(titles(fixture), ['B', 'C', 'A', 'D']);
  a.dispatch('pointercancel', event());
  assert.deepEqual(titles(fixture), ['A', 'B', 'C', 'D']);
  assert.deepEqual(fixture.reorders, []);
  assert.equal(fixture.view.drag, null);
});

test('the context menu is ignored while a drag is active', async () => {
  const fixture = await dragFixture();
  const [a] = cardsOf(fixture.view);
  down(a, ...centerOf(0));
  move(a, ...centerOf(1));
  const before = fixture.main.menus.length;
  a.dispatch('contextmenu', { preventDefault() {} });
  assert.equal(fixture.main.menus.length, before);
});

/* ── Touch ── */
test('on touch a drag starts after a 300 ms long press, not before', async () => {
  const fixture = await dragFixture();
  const [a] = cardsOf(fixture.view);
  down(a, ...centerOf(0), { pointerType: 'touch' });
  move(a, ...centerOf(0).map((v) => v + 4), { pointerType: 'touch' }); // a small wobble is fine
  assert.equal(a.classes.has('is-dragging'), false);
  assert.equal(longPress(fixture), true);
  assert.equal(a.classes.has('is-dragging'), true);

  move(a, ...centerOf(1), { pointerType: 'touch' });
  assert.deepEqual(titles(fixture), ['B', 'A', 'C', 'D']);
  up(a, ...centerOf(1), { pointerType: 'touch' });
  await fixture.view.pendingMove;
  assert.deepEqual(fixture.reorders, [['B.md', 'A.md', 'C.md', 'D.md']]);
});

test('on touch, moving before the long press is a scroll: no drag starts', async () => {
  const fixture = await dragFixture();
  const [a] = cardsOf(fixture.view);
  down(a, ...centerOf(0), { pointerType: 'touch' });
  move(a, ...centerOf(0).map((v) => v + 30), { pointerType: 'touch' });
  assert.equal(longPress(fixture), false); // the timer was cancelled
  assert.equal(a.classes.has('is-dragging'), false);
  assert.equal(fixture.view.drag, null);
});

test('a short tap on touch is only a tap', async () => {
  const fixture = await dragFixture();
  const [a] = cardsOf(fixture.view);
  down(a, ...centerOf(0), { pointerType: 'touch' });
  up(a, ...centerOf(0), { pointerType: 'touch' });
  assert.equal(longPress(fixture), false);
  a.dispatch('click', {});
  await Promise.resolve();
  assert.deepEqual(fixture.opened, ['A.md']);
  assert.equal(fixture.main.menus.length, 0);
});

test('a long press released without moving opens the card menu at the finger', async () => {
  const fixture = await dragFixture();
  const [a] = cardsOf(fixture.view);
  down(a, 40, 60, { pointerType: 'touch' });
  longPress(fixture);
  up(a, 40, 60, { pointerType: 'touch' });
  await fixture.view.pendingMove;
  assert.equal(fixture.main.menus.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.main.menus[0].shownAt.position)), { x: 40, y: 60 });
  assert.deepEqual(fixture.reorders, []);
});

test('while dragging on touch, touchmove does not scroll the page; otherwise it is left alone', async () => {
  const fixture = await dragFixture();
  const handler = fixture.view.domHandlers.find((entry) => entry.type === 'touchmove');
  assert.ok(handler, 'touchmove handler');
  let prevented = 0;
  const touchEvent = { cancelable: true, preventDefault: () => { prevented += 1; } };
  handler.handler(touchEvent);
  assert.equal(prevented, 0);

  const [a] = cardsOf(fixture.view);
  down(a, ...centerOf(0), { pointerType: 'touch' });
  longPress(fixture);
  handler.handler(touchEvent);
  assert.equal(prevented, 1);
});
