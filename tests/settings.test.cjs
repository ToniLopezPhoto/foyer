'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadMain } = require('./support/load-main.cjs');

// Objects created inside the vm context have other prototypes: compare them as plain JSON.
const plain = (value) => JSON.parse(JSON.stringify(value));

/* ── Normalization ── */

test('new settings default to the previous hardcoded behavior', () => {
  const { settingsModule } = loadMain();
  const settings = plain(settingsModule.normalizeSettings(null));
  assert.equal(settings.openOnStartup, true);
  assert.equal(settings.replaceNewTab, true);
  assert.equal(settings.recentLimit, 8);
  assert.equal(settings.resultLimit, 7);
});

test('valid values are kept', () => {
  const { settingsModule } = loadMain();
  const settings = plain(settingsModule.normalizeSettings({
    openOnStartup: false,
    replaceNewTab: false,
    recentLimit: 12,
    resultLimit: 5,
  }));
  assert.equal(settings.openOnStartup, false);
  assert.equal(settings.replaceNewTab, false);
  assert.equal(settings.recentLimit, 12);
  assert.equal(settings.resultLimit, 5);
});

test('limits are clamped to 3-20 and rounded to integers', () => {
  const { settingsModule } = loadMain();
  const normalize = (recentLimit, resultLimit) => plain(settingsModule.normalizeSettings({ recentLimit, resultLimit }));
  assert.deepEqual(
    [normalize(0, 1).recentLimit, normalize(0, 1).resultLimit],
    [3, 3],
  );
  assert.deepEqual(
    [normalize(99, 21).recentLimit, normalize(99, 21).resultLimit],
    [20, 20],
  );
  assert.equal(normalize(-5, 7).recentLimit, 3);
  assert.equal(normalize(9.6, 7).recentLimit, 10);
  assert.equal(normalize(3, 20).recentLimit, 3);
  assert.equal(normalize(3, 20).resultLimit, 20);
});

test('values of the wrong type fall back to the defaults', () => {
  const { settingsModule } = loadMain();
  const settings = plain(settingsModule.normalizeSettings({
    openOnStartup: 'yes',
    replaceNewTab: 1,
    recentLimit: '10',
    resultLimit: NaN,
  }));
  assert.equal(settings.openOnStartup, true);
  assert.equal(settings.replaceNewTab, true);
  assert.equal(settings.recentLimit, 8);
  assert.equal(settings.resultLimit, 7);

  const other = plain(settingsModule.normalizeSettings({ recentLimit: null, resultLimit: Infinity }));
  assert.equal(other.recentLimit, 8);
  assert.equal(other.resultLimit, 7);
});

test('existing settings are preserved next to the new ones', () => {
  const { settingsModule } = loadMain();
  const settings = plain(settingsModule.normalizeSettings({ name: 'Toni', language: 'es' }));
  assert.equal(settings.name, 'Toni');
  assert.equal(settings.language, 'es');
  assert.equal(settings.recentLimit, 8);
});

test('both languages define every new label and description', () => {
  const { settingsModule } = loadMain();
  const keys = [
    'settingsOpenOnStartup', 'settingsOpenOnStartupDescription',
    'settingsReplaceNewTab', 'settingsReplaceNewTabDescription',
    'settingsRecentLimit', 'settingsRecentLimitDescription',
    'settingsResultLimit', 'settingsResultLimitDescription',
  ];
  for (const language of ['es', 'en']) {
    for (const key of keys) {
      assert.equal(typeof settingsModule.STRINGS[language][key], 'string', `${language}.${key}`);
      assert.ok(settingsModule.STRINGS[language][key].length > 0, `${language}.${key}`);
    }
  }
});

/* ── Limits honored by the view ── */

function createViewFixture(settings) {
  const main = loadMain();
  const files = Array.from({ length: 25 }, (_, i) => new main.TFile(`note-${String(i).padStart(2, '0')}.md`, i));
  const byPath = new Map(files.map((file) => [file.path, file]));
  const plugin = {
    settings: { name: '', heroImagePath: '', ...settings },
    getEffectiveLanguage: () => 'en',
    getLastOpened: () => null,
  };
  const view = new main.HomeView({}, plugin);
  view.app = {
    vault: { on: () => ({}), getAbstractFileByPath: (path) => byPath.get(path) || null, getFiles: () => files },
    metadataCache: { on: () => ({}), getFileCache: () => null },
    workspace: {
      on: () => ({}),
      getLastOpenFiles: () => files.map((file) => file.path),
      getActiveViewOfType: () => null,
    },
  };
  return { main, view, plugin };
}

const recentRows = (view) => view.recentEl.children.filter((el) => el.classes.has('foyer__row'));
const resultRows = (view) => view.resultsEl.children
  .filter((el) => el.classes.has('foyer__item') && !el.classes.has('foyer__item--action'));

test('the recent list honors recentLimit', async () => {
  const { view } = createViewFixture({ recentLimit: 4, resultLimit: 7 });
  await view.onOpen();
  assert.equal(recentRows(view).length, 4);
});

test('the search results honor resultLimit', async () => {
  const { view } = createViewFixture({ recentLimit: 8, resultLimit: 5 });
  await view.onOpen();
  view.inputEl.value = 'note';
  view.updateResults();
  assert.equal(resultRows(view).length, 5);
});

test('changing the limits refreshes an open view without reloading', async () => {
  const { view, plugin } = createViewFixture({ recentLimit: 3, resultLimit: 3 });
  await view.onOpen();
  view.inputEl.value = 'note';
  view.updateResults();
  assert.equal(recentRows(view).length, 3);
  assert.equal(resultRows(view).length, 3);

  plugin.settings = { ...plugin.settings, recentLimit: 10, resultLimit: 9 };
  view.refreshSettings();

  assert.equal(recentRows(view).length, 10);
  assert.equal(resultRows(view).length, 9);
});

/* ── Plugin: startup and live new-tab replacement ── */

function createPluginFixture({ data = null } = {}) {
  const main = loadMain();
  const plugin = new main.FoyerPlugin();
  const layoutChangeHandlers = [];
  const viewStates = [];
  let layoutReady = null;
  const emptyLeaf = {
    view: { getViewType: () => 'empty' },
    setViewState: (state) => { viewStates.push(plain(state)); },
  };
  const saved = [];

  plugin.app = {
    workspace: {
      rootSplit: {},
      on(name, callback) {
        if (name === 'layout-change') layoutChangeHandlers.push(callback);
        return {};
      },
      onLayoutReady(callback) { layoutReady = callback; },
      getActiveFile: () => null,
      getLeavesOfType: () => [],
      getMostRecentLeaf: () => emptyLeaf,
    },
    vault: { on: () => ({}) },
  };
  plugin.loadData = async () => (data === null ? null : plain(data));
  plugin.saveData = async (value) => { saved.push(plain(value)); };
  plugin.registerEvent = (ref) => ref;
  plugin.register = () => {};
  plugin.registerView = () => {};
  plugin.registerHoverLinkSource = () => {};
  plugin.addSettingTab = () => {};
  plugin.addRibbonIcon = () => {};
  plugin.addCommand = () => {};

  let homeOpens = 0;
  plugin.openHome = async () => { homeOpens += 1; };

  // Runs the timeouts that are still pending (not cancelled, not fired).
  const runPendingTimers = () => {
    for (const timer of main.timers.timeouts) {
      if (timer.cancelled || timer.fired) continue;
      timer.fired = true;
      timer.fn();
    }
  };
  const pendingTimers = () => main.timers.timeouts.filter((timer) => !timer.cancelled && !timer.fired);

  return {
    main, plugin, layoutChangeHandlers, viewStates, saved, runPendingTimers, pendingTimers,
    homeOpens: () => homeOpens,
    runLayoutReady: () => layoutReady(),
  };
}

test('openOnStartup opens the home view on layout ready', async () => {
  const f = createPluginFixture();
  await f.plugin.onload();
  await f.runLayoutReady();
  assert.equal(f.homeOpens(), 1);
});

test('openOnStartup=false skips opening the home view', async () => {
  const f = createPluginFixture({ data: { openOnStartup: false } });
  await f.plugin.onload();
  await f.runLayoutReady();
  assert.equal(f.homeOpens(), 0);
});

test('new empty tabs are converted by default', async () => {
  const f = createPluginFixture();
  await f.plugin.onload();
  await f.runLayoutReady();
  f.runPendingTimers();
  assert.deepEqual(f.viewStates, [{ type: 'foyer' }]);

  f.layoutChangeHandlers[0]();
  f.runPendingTimers();
  assert.equal(f.viewStates.length, 2);
});

test('replaceNewTab=false converts nothing, not even at startup', async () => {
  const f = createPluginFixture({ data: { replaceNewTab: false } });
  await f.plugin.onload();
  await f.runLayoutReady();
  f.layoutChangeHandlers.forEach((handler) => handler());
  assert.equal(f.pendingTimers().length, 0);
  f.runPendingTimers();
  assert.deepEqual(f.viewStates, []);
});

test('turning replaceNewTab off at runtime stops the conversion and clears the pending timer', async () => {
  const f = createPluginFixture();
  await f.plugin.onload();
  await f.runLayoutReady();
  f.runPendingTimers();
  f.viewStates.length = 0;

  f.layoutChangeHandlers[0]();
  assert.equal(f.pendingTimers().length, 1);

  await f.plugin.updateSetting('replaceNewTab', false);
  assert.equal(f.pendingTimers().length, 0);
  assert.equal(f.saved.at(-1).replaceNewTab, false);

  f.layoutChangeHandlers.forEach((handler) => handler());
  f.runPendingTimers();
  assert.deepEqual(f.viewStates, []);
});

test('turning replaceNewTab on at runtime converts the current empty tab once', async () => {
  const f = createPluginFixture({ data: { replaceNewTab: false } });
  await f.plugin.onload();
  await f.runLayoutReady();

  await f.plugin.updateSetting('replaceNewTab', true);
  assert.equal(f.pendingTimers().length, 1);
  f.runPendingTimers();
  assert.deepEqual(f.viewStates, [{ type: 'foyer' }]);
});

test('toggling replaceNewTab several times never duplicates the layout-change handler', async () => {
  const f = createPluginFixture();
  await f.plugin.onload();
  await f.runLayoutReady();
  await f.plugin.updateSetting('replaceNewTab', false);
  await f.plugin.updateSetting('replaceNewTab', true);
  await f.plugin.updateSetting('replaceNewTab', false);
  await f.plugin.updateSetting('replaceNewTab', true);
  assert.equal(f.layoutChangeHandlers.length, 1);

  f.runPendingTimers();
  f.viewStates.length = 0;
  f.layoutChangeHandlers[0]();
  f.runPendingTimers();
  assert.equal(f.viewStates.length, 1);
});

/* ── Settings tab ── */

function displayTab(settings = {}) {
  const f = createPluginFixture({ data: settings });
  const tab = new f.main.HomeSettingTab(f.plugin.app, f.plugin);
  return f.plugin.onload().then(() => {
    f.main.settingsLog.length = 0;
    tab.display();
    return { f, tab, log: f.main.settingsLog };
  });
}

const byType = (setting, type) => setting.components.find((component) => component.type === type);

test('the settings tab shows two toggles and two sliders before the hero image block', async () => {
  const { log } = await displayTab();
  const strings = (await displayTab()).f.main.settingsModule.STRINGS.en;
  const names = log.map((setting) => setting.name);
  const imageIndex = names.indexOf(strings.settingsImage);
  assert.ok(imageIndex > 0);

  for (const key of ['settingsOpenOnStartup', 'settingsReplaceNewTab']) {
    const index = names.indexOf(strings[key]);
    assert.ok(index >= 0 && index < imageIndex, key);
    assert.ok(byType(log[index], 'toggle'), key);
    assert.equal(log[index].desc, strings[`${key}Description`]);
  }
  for (const key of ['settingsRecentLimit', 'settingsResultLimit']) {
    const index = names.indexOf(strings[key]);
    assert.ok(index >= 0 && index < imageIndex, key);
    const slider = byType(log[index], 'slider');
    assert.ok(slider, key);
    assert.deepEqual(plain(slider.limits), [3, 20, 1]);
    assert.equal(slider.dynamicTooltip, true);
    assert.equal(log[index].desc, strings[`${key}Description`]);
  }
});

test('the settings controls start from the saved values', async () => {
  const { f, log } = await displayTab({ openOnStartup: false, replaceNewTab: false, recentLimit: 11, resultLimit: 6 });
  const strings = f.main.settingsModule.STRINGS.en;
  const control = (key, type) => byType(log.find((setting) => setting.name === strings[key]), type);
  assert.equal(control('settingsOpenOnStartup', 'toggle').value, false);
  assert.equal(control('settingsReplaceNewTab', 'toggle').value, false);
  assert.equal(control('settingsRecentLimit', 'slider').value, 11);
  assert.equal(control('settingsResultLimit', 'slider').value, 6);
});

test('changing the controls saves through updateSetting', async () => {
  const { f, log } = await displayTab();
  const strings = f.main.settingsModule.STRINGS.en;
  const control = (key, type) => byType(log.find((setting) => setting.name === strings[key]), type);

  await control('settingsOpenOnStartup', 'toggle').changeHandler(false);
  await control('settingsReplaceNewTab', 'toggle').changeHandler(false);
  await control('settingsRecentLimit', 'slider').changeHandler(12);
  await control('settingsResultLimit', 'slider').changeHandler(4);

  const last = f.saved.at(-1);
  assert.equal(last.openOnStartup, false);
  assert.equal(last.replaceNewTab, false);
  assert.equal(last.recentLimit, 12);
  assert.equal(last.resultLimit, 4);
  assert.equal(f.plugin.settings.recentLimit, 12);
});
