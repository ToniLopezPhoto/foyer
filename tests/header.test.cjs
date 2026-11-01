'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadMain } = require('./support/load-main.cjs');

async function openView() {
  const main = loadMain();
  const plugin = {
    settings: { name: 'Toni', heroImagePath: '' },
    getEffectiveLanguage: () => 'en',
  };
  const view = new main.HomeView({}, plugin);
  view.app = {
    vault: { on: () => ({}), getAbstractFileByPath: () => null, getFiles: () => [] },
    metadataCache: { on: () => ({}), getFileCache: () => null },
    workspace: { on: () => ({}), getLastOpenFiles: () => [], getActiveViewOfType: () => null },
  };
  await view.onOpen();
  return { main, view };
}

test('refreshHeader updates the date and greeting', async () => {
  const { main, view } = await openView();
  main.clock.hour = 14;
  main.clock.date = 'martes, 2 de enero';
  view.refreshHeader();
  assert.equal(view.titleEl.text, 'Good afternoon, Toni');
  assert.equal(view.dateEl.text, 'martes, 2 de enero');
});

test('the 30-second interval refreshes the date and greeting without re-rendering recents', async () => {
  const { main, view } = await openView();
  const interval = main.timers.intervals.find(({ ms }) => ms === 30 * 1000);
  assert.ok(interval, 'the view registers a 30-second interval');

  let renders = 0;
  const renderRecent = view.renderRecent;
  view.renderRecent = () => {
    renders += 1;
    renderRecent.call(view);
  };

  main.clock.hour = 22;
  main.clock.date = 'martes, 2 de enero';
  interval.fn();

  assert.equal(view.titleEl.text, 'Good evening, Toni');
  assert.equal(view.dateEl.text, 'martes, 2 de enero');
  assert.equal(renders, 0);
});

test('without a hero image the header shows the Foyer archway mark in the accent color', async () => {
  const { view } = await openView();
  assert.equal(view.sparkEl.hidden, false);
  const [svg] = view.sparkEl.children;
  assert.equal(svg.attributes.viewBox, '40 40 176 168');
  assert.equal(svg.attributes['aria-hidden'], 'true');
  const shapes = svg.children;
  assert.equal(shapes.length, 4, 'outer arch, door, inner light and threshold');
  assert.ok(shapes.every((shape) => typeof shape.attributes.d === 'string'), 'every shape is a path');
  assert.ok(shapes.every((shape) => !('x1' in shape.attributes)), 'no spark rays');
});
