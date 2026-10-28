'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadMain } = require('./support/load-main.cjs');
const { createViewFixture, cardsOf, rowTitle } = require('./support/view-fixture.cjs');

const COLORS = ['yellow', 'orange', 'red', 'purple', 'blue', 'cyan', 'green', 'pink'];

const board = (extra = {}) => createViewFixture({
  paths: ['Plan.md', 'Idea.md', 'R1.md'],
  history: { 'R1.md': 10 },
  pinned: [{ path: 'Plan.md', color: 'blue' }, { path: 'Idea.md', color: '' }],
  ...extra,
});

// Right-clicks a card and returns the menu that opened and the event used.
function rightClick(fixture, card) {
  let prevented = 0;
  const event = { type: 'contextmenu', preventDefault: () => { prevented += 1; } };
  const before = fixture.main.menus.length;
  card.dispatch('contextmenu', event);
  const menus = fixture.main.menus.slice(before);
  return { menu: menus[0], menus, event, prevented };
}

const titles = (menu) => menu.items.map((item) => (item.separator ? '---' : item.title));

/* ── Items ── */
test('right-clicking a card opens one menu at the mouse and prevents the browser menu', async () => {
  const fixture = await board();
  const { menu, menus, event, prevented } = rightClick(fixture, cardsOf(fixture.view)[0]);
  assert.equal(menus.length, 1);
  assert.equal(prevented, 1);
  assert.equal(menu.shownAt.event, event);
});

test('the menu has Open, Open in new tab, Color and Unpin', async () => {
  const fixture = await board();
  const { menu } = rightClick(fixture, cardsOf(fixture.view)[0]);
  assert.deepEqual(titles(menu), ['Open', 'Open in new tab', '---', 'Color', '---', 'Unpin from Foyer']);
});

test('the menu is in Spanish when the interface is Spanish', async () => {
  const fixture = await board({ language: 'es' });
  const { menu } = rightClick(fixture, cardsOf(fixture.view)[0]);
  assert.deepEqual(titles(menu), ['Abrir', 'Abrir en una pestaña nueva', '---', 'Color', '---', 'Quitar de Foyer']);
  assert.deepEqual(menu.items[3].submenu.items.map((item) => item.title), [
    'Sin color', 'Amarillo', 'Naranja', 'Rojo', 'Morado', 'Azul', 'Cian', 'Verde', 'Rosa',
  ]);
});

test('Open opens the note in the current leaf and Open in new tab in a new one', async () => {
  const fixture = await board();
  const { menu } = rightClick(fixture, cardsOf(fixture.view)[1]);
  menu.items[0].click();
  menu.items[1].click();
  await Promise.resolve();
  assert.deepEqual(fixture.opened, ['Idea.md', 'new:Idea.md']);
  assert.deepEqual(fixture.leafCalls, ['tab']);
});

test('Unpin removes the note from the board', async () => {
  const fixture = await board();
  const { menu } = rightClick(fixture, cardsOf(fixture.view)[0]);
  menu.items[5].click();
  await Promise.resolve();
  assert.deepEqual(fixture.unpinned, ['Plan.md']);
  assert.deepEqual(cardsOf(fixture.view).map(rowTitle), ['Idea']);
});

/* ── Color submenu ── */
test('the Color submenu lists "No color" and the eight palette colors in order', async () => {
  const fixture = await board();
  const { menu } = rightClick(fixture, cardsOf(fixture.view)[0]);
  const submenu = menu.items[3].submenu;
  assert.ok(submenu, 'submenu');
  assert.deepEqual(submenu.items.map((item) => item.title), [
    'No color', 'Yellow', 'Orange', 'Red', 'Purple', 'Blue', 'Cyan', 'Green', 'Pink',
  ]);
  assert.equal(COLORS.length, 8);
});

test('the current color is the only one checked', async () => {
  const fixture = await board();
  const blue = rightClick(fixture, cardsOf(fixture.view)[0]).menu.items[3].submenu.items;
  assert.deepEqual(blue.map((item) => item.checked), [false, false, false, false, false, true, false, false, false]);
  const none = rightClick(fixture, cardsOf(fixture.view)[1]).menu.items[3].submenu.items;
  assert.deepEqual(none.map((item) => item.checked), [true, false, false, false, false, false, false, false, false]);
});

test('picking a color stores it with the pin and the card takes the new class', async () => {
  const fixture = await board();
  const { menu } = rightClick(fixture, cardsOf(fixture.view)[1]);
  menu.items[3].submenu.items[4].click(); // Purple
  await Promise.resolve();
  assert.deepEqual(fixture.colored, [['Idea.md', 'purple']]);
  assert.equal(cardsOf(fixture.view)[1].classes.has('foyer__card--purple'), true);
});

test('"No color" clears the color', async () => {
  const fixture = await board();
  const { menu } = rightClick(fixture, cardsOf(fixture.view)[0]);
  menu.items[3].submenu.items[0].click();
  await Promise.resolve();
  assert.deepEqual(fixture.colored, [['Plan.md', '']]);
  assert.equal(cardsOf(fixture.view)[0].classes.has('foyer__card--blue'), false);
});

test('without submenu support the colors are listed in the main menu', async () => {
  const fixture = await board({ main: loadMain({ animationFrames: true, submenus: false }) });
  const { menu } = rightClick(fixture, cardsOf(fixture.view)[0]);
  const flat = titles(menu);
  assert.equal(flat.includes('Blue'), true);
  assert.equal(flat.at(-1), 'Unpin from Foyer');
  menu.items.find((item) => item.title === 'Green').click();
  await Promise.resolve();
  assert.deepEqual(fixture.colored, [['Plan.md', 'green']]);
});

/* ── Scope ── */
test('Recent rows have no card menu', async () => {
  const fixture = await board();
  const row = fixture.view.recentEl.children.find((el) => el.classes.has('foyer__row'));
  const before = fixture.main.menus.length;
  row.dispatch('contextmenu', { preventDefault() {} });
  assert.equal(fixture.main.menus.length, before);
});

test('the menu strings exist in both languages', () => {
  const { settingsModule } = loadMain();
  const { es, en } = settingsModule.STRINGS;
  for (const key of ['cardOpen', 'cardOpenNewTab']) {
    assert.equal(typeof es[key], 'string', `es.${key}`);
    assert.notEqual(es[key], en[key], key);
  }
  assert.equal(es.cardColor, 'Color'); // the same word in both languages
  assert.equal(en.cardColor, 'Color');
  for (const key of ['none', ...COLORS]) {
    assert.equal(typeof es.pinColors[key], 'string', `es.pinColors.${key}`);
    assert.equal(typeof en.pinColors[key], 'string', `en.pinColors.${key}`);
    assert.notEqual(es.pinColors[key], en.pinColors[key], key);
  }
});
