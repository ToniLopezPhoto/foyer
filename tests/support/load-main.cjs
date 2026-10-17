'use strict';

const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');

// Carga main.js en un contexto vm con un módulo obsidian simulado. No arranca Obsidian.

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

// Elemento DOM mínimo: lo justo para renderizar la vista sin Obsidian.
function createElement(options = {}) {
  const el = {
    text: '',
    value: '',
    hidden: false,
    children: [],
    attributes: {},
    classes: new Set(),
    addClass(...names) { for (const name of names) this.classes.add(name); },
    removeClass(name) { this.classes.delete(name); },
    toggleClass(name, force) { if (force) this.classes.add(name); else this.classes.delete(name); },
    setText(value) { this.text = String(value); },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    removeAttribute(name) { delete this.attributes[name]; },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener() {},
    scrollIntoView() {},
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

function loadMain() {
  const notices = [];
  const clock = { hour: 9, date: 'lunes, 1 de enero' };
  const timers = { intervals: [], timeouts: [] };

  class FakeDate extends Date {
    getHours() { return clock.hour; }
  }

  const obsidian = {
    Plugin: class {},
    PluginSettingTab: class {},
    Setting: class {},
    FuzzySuggestModal: class {},
    ItemView: class {
      constructor(leaf) {
        this.leaf = leaf;
        this.contentEl = createElement();
      }
      registerDomEvent() {}
      registerEvent() {}
      registerInterval(id) { return id; }
    },
    Notice: class {
      constructor(message) { notices.push(message); }
    },
    Keymap: { isModEvent: (event) => event.mode || false },
    Platform: { isMacOS: false },
    prepareFuzzySearch: (query) => (text) => (
      text.toLowerCase().includes(query.toLowerCase()) ? { score: 1, matches: [] } : null
    ),
    renderMatches() {},
    setIcon() {},
    moment: createMoment(clock),
    getLanguage: () => 'en',
    normalizePath: (path) => path.replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, ''),
    debounce: (fn) => {
      const run = (...args) => fn(...args);
      run.run = () => fn();
      return run;
    },
    TFile,
    TFolder,
  };

  const window = {
    setInterval(fn, ms) {
      timers.intervals.push({ fn, ms });
      return timers.intervals.length;
    },
    setTimeout(fn, ms) {
      timers.timeouts.push({ fn, ms });
      return timers.timeouts.length;
    },
    clearTimeout() {},
  };

  const context = vm.createContext({
    module: { exports: {} },
    require(id) {
      assert.equal(id, 'obsidian');
      return obsidian;
    },
    window,
    Date: FakeDate,
    createSvg: (tag, options) => createElement(normalizeOptions(options)),
  });

  const source = readFileSync(join(__dirname, '..', '..', 'main.js'), 'utf8');
  vm.runInContext(
    `${source}\nmodule.exports = { HomeView, FoyerPlugin: module.exports };`,
    context,
  );
  const { HomeView, FoyerPlugin } = context.module.exports;
  return { HomeView, FoyerPlugin, TFile, TFolder, clock, notices, timers };
}

module.exports = { createElement, loadMain };
