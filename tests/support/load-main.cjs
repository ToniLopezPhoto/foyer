'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

// Loads main.js in a vm context with a stubbed obsidian module. Does not start Obsidian.

class TFolder {
  constructor(path) {
    this.path = path;
    this.name = path.slice(path.lastIndexOf('/') + 1);
  }

  isRoot() {
    return this.path === '';
  }
}

class TFile {
  constructor(path, mtime = 0) {
    const slash = path.lastIndexOf('/');
    const dot = path.lastIndexOf('.');
    this.path = path;
    this.name = path.slice(slash + 1);
    this.extension = dot > slash ? path.slice(dot + 1) : '';
    this.basename = dot > slash ? path.slice(slash + 1, dot) : this.name;
    this.parent = new TFolder(slash === -1 ? '' : path.slice(0, slash));
    this.stat = { mtime };
  }
}

// Minimal DOM element: just enough to render the view without Obsidian.
function createElement(options = {}) {
  const el = {
    text: '',
    value: '',
    hidden: false,
    style: { setProperty(name, value) { this[name] = String(value); } },
    children: [],
    attributes: {},
    listeners: {},
    classes: new Set(),
    addClass(...names) { for (const name of names) this.classes.add(name); },
    removeClass(name) { this.classes.delete(name); },
    toggleClass(name, force) { if (force) this.classes.add(name); else this.classes.delete(name); },
    setText(value) { this.text = String(value); },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return name in this.attributes ? this.attributes[name] : null; },
    removeAttribute(name) { delete this.attributes[name]; },
    appendChild(child) { this.children.push(child); return child; },
    insertBefore(child, reference) {
      const from = this.children.indexOf(child);
      if (from !== -1) this.children.splice(from, 1);
      const at = reference ? this.children.indexOf(reference) : this.children.length;
      this.children.splice(at, 0, child);
      return child;
    },
    setPointerCapture(id) { this.capturedPointer = id; },
    releasePointerCapture() { this.capturedPointer = null; },
    addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); },
    dispatch(type, event = {}) { for (const handler of this.listeners[type] || []) handler(event); },
    scrollIntoView() {},
    focus() { this.focusCount = (this.focusCount || 0) + 1; },
    empty() { this.children = []; this.text = ''; },
  };
  if (options.cls) el.addClass(...options.cls.split(' '));
  if (options.text) el.setText(options.text);
  for (const [name, value] of Object.entries(options.attr || {})) el.setAttribute(name, value);
  el.createDiv = (childOptions) => addChild(el, childOptions);
  el.createSpan = (childOptions) => addChild(el, childOptions);
  el.createEl = (tag, childOptions) => addChild(el, childOptions);
  el.createSvg = (tag, childOptions) => addChild(el, childOptions);
  return el;
}

function addChild(parent, options) {
  return parent.appendChild(createElement(normalizeOptions(options)));
}

function normalizeOptions(options) {
  return typeof options === 'string' ? { cls: options } : options || {};
}

function createMoment(clock) {
  return () => {
    const api = {
      locale: () => api,
      format: () => clock.date,
      fromNow: () => 'hace un momento',
    };
    return api;
  };
}

// Setting components (toggle, slider...) that only record what the settings tab asks of them.
function createSettingComponent(type) {
  const component = {
    type,
    value: undefined,
    setValue(value) { component.value = value; return component; },
    onChange(handler) { component.changeHandler = handler; return component; },
    setLimits(min, max, step) { component.limits = [min, max, step]; return component; },
    setDynamicTooltip() { component.dynamicTooltip = true; return component; },
    addOption(value, label) { (component.options ||= []).push([value, label]); return component; },
    setButtonText() { return component; },
    setCta() { return component; },
    onClick(handler) { component.clickHandler = handler; return component; },
  };
  return component;
}

// Subsequence fuzzy matcher: case-insensitive, deterministic, score = minus the number of skipped characters.
// Lets search tests produce many score ties; a prefix extension of a query never matches more files.
function subsequenceFuzzy(query) {
  const needle = query.toLowerCase();
  return (text) => {
    const haystack = text.toLowerCase();
    const matches = [];
    let from = 0;
    for (const char of needle) {
      const at = haystack.indexOf(char, from);
      if (at === -1) return null;
      matches.push([at, at + 1]);
      from = at + 1;
    }
    const span = matches.length ? matches[matches.length - 1][0] - matches[0][0] + 1 : 0;
    return { score: -(span - needle.length), matches };
  };
}

// With deferDebounce, debounce() calls stay pending until .run() is called, as in Obsidian;
// flushDebounced() runs the last pending call of each debouncer. fuzzy replaces prepareFuzzySearch.
// With animationFrames, window.requestAnimationFrame exists and its callbacks stay in frames.queue
// until frames.flush() is called.
// With submenus: false, menu items have no setSubmenu() (older Obsidian). `menus` records every Menu created.
// With reducedMotion, window.matchMedia('(prefers-reduced-motion: reduce)') matches.
function loadMain({ deferDebounce = false, fuzzy = null, animationFrames = false, submenus = true, reducedMotion = false } = {}) {
  const notices = [];
  const menus = [];
  const clock = { hour: 9, date: 'lunes, 1 de enero' };
  const timers = { intervals: [], timeouts: [] };
  const debouncers = [];

  class FakeDate extends Date {
    getHours() { return clock.hour; }
  }

  // Each Setting created is recorded in settingsLog, in creation order.
  const settingsLog = [];
  class Setting {
    constructor(containerEl) {
      this.containerEl = containerEl;
      this.components = [];
      settingsLog.push(this);
    }

    setName(name) { this.name = name; return this; }
    setDesc(desc) { this.desc = desc; return this; }
    addComponent(type, callback) {
      const component = createSettingComponent(type);
      this.components.push(component);
      callback(component);
      return this;
    }

    addText(callback) { return this.addComponent('text', callback); }
    addDropdown(callback) { return this.addComponent('dropdown', callback); }
    addButton(callback) { return this.addComponent('button', callback); }
    addToggle(callback) { return this.addComponent('toggle', callback); }
    addSlider(callback) { return this.addComponent('slider', callback); }
  }

  // Menu: records its items (and submenus) and where it was shown; clicking is done by the test.
  class Menu {
    constructor() {
      this.items = [];
      menus.push(this);
    }

    addItem(callback) {
      const item = {
        title: '',
        icon: '',
        checked: false,
        setTitle(title) { item.title = title; return item; },
        setIcon(icon) { item.icon = icon; return item; },
        setChecked(checked) { item.checked = Boolean(checked); return item; },
        onClick(handler) { item.click = handler; return item; },
      };
      if (submenus) item.setSubmenu = () => { item.submenu = new Menu(); menus.pop(); return item.submenu; };
      this.items.push(item);
      callback(item);
      return this;
    }

    addSeparator() { this.items.push({ separator: true }); return this; }
    showAtMouseEvent(event) { this.shownAt = { event }; }
    showAtPosition(position) { this.shownAt = { position }; }
  }

  const obsidian = {
    Menu,
    Plugin: class {},
    PluginSettingTab: class {
      constructor(app, plugin) {
        this.app = app;
        this.plugin = plugin;
        this.containerEl = createElement();
      }
    },
    Setting,
    FuzzySuggestModal: class {},
    ItemView: class {
      constructor(leaf) {
        this.leaf = leaf;
        this.contentEl = createElement();
      }
      registerDomEvent(el, type, handler) { (this.domHandlers ||= []).push({ el, type, handler }); }
      registerEvent() {}
      registerInterval(id) { return id; }
    },
    Notice: class {
      constructor(message) { notices.push(message); }
    },
    Keymap: { isModEvent: (event) => event.mode || false },
    Platform: { isMacOS: false },
    prepareFuzzySearch: fuzzy || ((query) => (text) => (
      text.toLowerCase().includes(query.toLowerCase()) ? { score: 1, matches: [] } : null
    )),
    renderMatches(el, text) { el.setText(text); },
    setIcon() {},
    moment: createMoment(clock),
    getLanguage: () => 'en',
    normalizePath: (path) => path.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, ''),
    debounce: (fn) => {
      if (deferDebounce) {
        let pending = null;
        const deferred = (...args) => { pending = args; };
        deferred.run = () => {
          if (!pending) return;
          const args = pending;
          pending = null;
          fn(...args);
        };
        debouncers.push(deferred);
        return deferred;
      }
      const run = (...args) => fn(...args);
      run.run = () => fn();
      return run;
    },
    TFile,
    TFolder,
  };

  const frames = {
    queue: [],
    nextId: 1,
    flush() {
      const pending = frames.queue.splice(0);
      for (const frame of pending) if (!frame.cancelled) frame.fn();
    },
  };

  const window = {
    setInterval(fn, ms) {
      timers.intervals.push({ fn, ms });
      return timers.intervals.length;
    },
    setTimeout(fn, ms) {
      timers.timeouts.push({ fn, ms, cancelled: false, fired: false });
      return timers.timeouts.length;
    },
    clearTimeout(id) {
      if (timers.timeouts[id - 1]) timers.timeouts[id - 1].cancelled = true;
    },
  };
  window.matchMedia = (query) => ({ matches: reducedMotion && query.includes('prefers-reduced-motion') });
  if (animationFrames) {
    window.requestAnimationFrame = (fn) => {
      const id = frames.nextId++;
      frames.queue.push({ id, fn, cancelled: false });
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      const frame = frames.queue.find((entry) => entry.id === id);
      if (frame) frame.cancelled = true;
    };
  }

  const context = vm.createContext({
    module: { exports: {} },
    require(id) {
      assert.equal(id, 'obsidian');
      return obsidian;
    },
    window,
    document: { activeElement: null },
    Date: FakeDate,
    createSvg: (tag, options) => createElement(normalizeOptions(options)),
  });

  const source = readFileSync(join(__dirname, '..', '..', 'main.js'), 'utf8');
  vm.runInContext(
    `${source}\nmodule.exports = { HomeView, HomeSettingTab, FoyerPlugin: module.exports, settingsModule: homeSettingsModule.exports };`,
    context,
  );
  const { HomeView, HomeSettingTab, FoyerPlugin, settingsModule } = context.module.exports;
  const flushDebounced = () => { for (const deferred of debouncers) deferred.run(); };
  return { HomeView, HomeSettingTab, FoyerPlugin, settingsModule, TFile, TFolder, clock, notices, menus, timers, frames, settingsLog, flushDebounced };
}

module.exports = { createElement, loadMain, subsequenceFuzzy };
