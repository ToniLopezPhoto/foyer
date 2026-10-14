'use strict';

/*
 * Foyer — página de inicio minimalista para Obsidian.
 * Barra de búsqueda (fuzzy sobre nombres y rutas) + notas abiertas recientemente.
 * Todo el estilo sale de las variables del tema activo (styles.css).
 */

const homeSettingsModule = { exports: {} };
(function(module, exports) {
'use strict';

const DEFAULT_SETTINGS = Object.freeze({
  name: '',
  language: 'auto',
  heroImagePath: '',
});

const HERO_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp']);
const OPEN_HISTORY_LIMIT = 200;

const STRINGS = {
  es: {
    viewTitle: 'Inicio',
    greeting: ['Buenos días', 'Buenas tardes', 'Buenas noches'],
    searchPlaceholder: 'Buscar en el vault....',
    searchLabel: 'Buscar notas',
    keyboardHelp: ['↑↓ moverse', '↵ abrir', (mod) => `${mod} ↵ nueva pestaña`, '⇧ ↵ buscar en contenido'],
    recent: 'Recientes',
    emptyRecent: 'Todavía no has abierto ninguna nota.',
    searchContent: (query) => `Buscar «${query}» en el contenido`,
    createNote: (query) => `Crear nota «${query}»`,
    globalSearchUnavailable: 'La búsqueda global no está disponible.',
    createNoteFailed: 'No se pudo crear la nota.',
    openHome: 'Abrir inicio',
    settingsName: 'Nombre del saludo',
    settingsNameDescription: 'Deja el campo vacío para mostrar el saludo sin nombre.',
    settingsLanguage: 'Idioma',
    settingsLanguageDescription: 'Elige el idioma de la página de inicio.',
    languageAuto: 'Automático (idioma de Obsidian)',
    languageSpanish: 'Español',
    languageEnglish: 'English',
    settingsImage: 'Imagen principal',
    settingsImageDescription: 'Elige una imagen del vault o súbela desde tu equipo (se copiará al vault). Formatos: PNG, JPEG, GIF, WebP, AVIF o BMP. SVG no está admitido.',
    chooseImage: 'Elegir del vault',
    uploadImage: 'Subir desde el equipo',
    clearImage: 'Quitar imagen',
    imageCleared: 'Imagen principal eliminada.',
    imageSelected: 'Imagen principal actualizada.',
    imageUnsupported: 'Formato de imagen no admitido.',
    imageImportFailed: 'No se pudo importar la imagen.',
    noVaultImages: 'No hay imágenes en el vault. Usa «Subir desde el equipo».',
    noImage: 'No hay ninguna imagen seleccionada.',
    infoTag: 'Tu imagen',
    infoTitle: '¿Dónde aparece?',
    infoPoints: [
      ['layout-template', 'En la cabecera de la página de inicio, justo encima de la fecha y el saludo.'],
      ['crop', 'Se recorta automáticamente para encajar (máx. 280 × 180 px, esquinas redondeadas). Funcionan mejor las imágenes horizontales.'],
      ['sparkles', 'Sin imagen, se muestra el destello con el color de acento del tema.'],
    ],
    infoCurrent: 'Imagen actual:',
  },
  en: {
    viewTitle: 'Home',
    greeting: ['Good morning', 'Good afternoon', 'Good evening'],
    searchPlaceholder: 'Search the vault....',
    searchLabel: 'Search notes',
    keyboardHelp: ['↑↓ navigate', '↵ open', (mod) => `${mod} ↵ new tab`, '⇧ ↵ search content'],
    recent: 'Recent',
    emptyRecent: 'You have not opened any notes yet.',
    searchContent: (query) => `Search “${query}” in content`,
    createNote: (query) => `Create note “${query}”`,
    globalSearchUnavailable: 'Global search is unavailable.',
    createNoteFailed: 'Could not create the note.',
    openHome: 'Open home',
    settingsName: 'Greeting name',
    settingsNameDescription: 'Leave this blank to show the greeting without a name.',
    settingsLanguage: 'Language',
    settingsLanguageDescription: 'Choose the home page language.',
    languageAuto: 'Automatic (Obsidian language)',
    languageSpanish: 'Español',
    languageEnglish: 'English',
    settingsImage: 'Hero image',
    settingsImageDescription: 'Pick an image from the vault or upload one from your computer (it will be copied into the vault). Formats: PNG, JPEG, GIF, WebP, AVIF, or BMP. SVG is not supported.',
    chooseImage: 'Choose from vault',
    uploadImage: 'Upload from computer',
    clearImage: 'Clear image',
    imageCleared: 'Hero image cleared.',
    imageSelected: 'Hero image updated.',
    imageUnsupported: 'Unsupported image format.',
    imageImportFailed: 'Could not import the image.',
    noVaultImages: 'There are no images in the vault. Use “Upload from computer”.',
    noImage: 'No image selected.',
    infoTag: 'Your image',
    infoTitle: 'Where does it appear?',
    infoPoints: [
      ['layout-template', 'In the header of the home page, right above the date and greeting.'],
      ['crop', 'It is cropped automatically to fit (max. 280 × 180 px, rounded corners). Landscape images work best.'],
      ['sparkles', 'Without an image, the spark in the theme accent color is shown.'],
    ],
    infoCurrent: 'Current image:',
  },
};

function normalizeOpenHistory(value) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const [path, ts] of Object.entries(value)) {
    if (typeof path === 'string' && path && Number.isFinite(ts) && ts > 0) out[path] = ts;
  }
  return out;
}

function normalizeSettings(data) {
  const source = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  return {
    ...source,
    name: typeof source.name === 'string' ? source.name : DEFAULT_SETTINGS.name,
    language: ['auto', 'es', 'en'].includes(source.language) ? source.language : DEFAULT_SETTINGS.language,
    heroImagePath: typeof source.heroImagePath === 'string' ? source.heroImagePath : DEFAULT_SETTINGS.heroImagePath,
    openHistory: normalizeOpenHistory(source.openHistory),
  };
}

// Registra la hora real de apertura y recorta el historial a las entradas más recientes.
function recordOpen(history, path, now) {
  history[path] = now;
  const paths = Object.keys(history);
  if (paths.length <= OPEN_HISTORY_LIMIT) return history;
  paths
    .sort((a, b) => history[b] - history[a])
    .slice(OPEN_HISTORY_LIMIT)
    .forEach((p) => delete history[p]);
  return history;
}

// Mueve las marcas de tiempo al renombrar un archivo o una carpeta.
function renameInHistory(history, oldPath, newPath) {
  let changed = false;
  for (const path of Object.keys(history)) {
    let next = null;
    if (path === oldPath) next = newPath;
    else if (path.startsWith(`${oldPath}/`)) next = newPath + path.slice(oldPath.length);
    if (next === null) continue;
    history[next] = Math.max(history[next] || 0, history[path]);
    delete history[path];
    changed = true;
  }
  return changed;
}

function deleteFromHistory(history, removedPath) {
  let changed = false;
  for (const path of Object.keys(history)) {
    if (path === removedPath || path.startsWith(`${removedPath}/`)) {
      delete history[path];
      changed = true;
    }
  }
  return changed;
}

function isSafeHeroFileName(name) {
  const dot = typeof name === 'string' ? name.lastIndexOf('.') : -1;
  return dot > 0 && isSupportedHeroImageExtension(name.slice(dot + 1));
}

function sanitizeFileName(name) {
  const dot = name.lastIndexOf('.');
  const base = name.slice(0, dot).replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim() || 'foyer-image';
  return `${base}.${name.slice(dot + 1).toLowerCase()}`;
}

async function loadSettings(plugin) {
  plugin.settings = normalizeSettings(await plugin.loadData());
  return plugin.settings;
}

function resolveLanguage(mode, obsidianLanguage) {
  if (mode === 'es' || mode === 'en') return mode;
  const language = typeof obsidianLanguage === 'string' ? obsidianLanguage.toLowerCase() : '';
  if (language === 'es' || language.startsWith('es-')) return 'es';
  return 'en';
}

function isSupportedHeroImageExtension(extension) {
  return typeof extension === 'string' && HERO_IMAGE_EXTENSIONS.has(extension.toLowerCase());
}

function formatCalendarDate(moment, language) {
  return moment().locale(language).format(language === 'es' ? 'dddd, D [de] MMMM' : 'dddd, MMMM D');
}

function formatRelativeDate(moment, timestamp, language) {
  if (!Number.isFinite(timestamp)) return '';
  // Evita "dentro de unos segundos" si el reloj va ligeramente desfasado.
  return moment(Math.min(timestamp, Date.now())).locale(language).fromNow();
}

function getGreeting(language, hour) {
  const index = hour >= 6 && hour < 13 ? 0 : hour >= 13 && hour < 21 ? 1 : 2;
  return STRINGS[language].greeting[index];
}

function formatGreeting(language, name, hour) {
  const greeting = getGreeting(language, hour);
  return typeof name === 'string' && name ? `${greeting}, ${name}` : greeting;
}

function resolveHeroImage(vault, path, TFile) {
  if (typeof path !== 'string' || !path) return null;
  try {
    const file = vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || !isSupportedHeroImageExtension(file.extension)) return null;
    const src = vault.getResourcePath(file);
    return typeof src === 'string' && src ? { file, src } : null;
  } catch (_error) {
    return null;
  }
}

function getSupportedHeroFiles(files, TFile) {
  return files.filter((file) => file instanceof TFile && isSupportedHeroImageExtension(file.extension));
}

function showSparkFallback(imageElement, sparkElement) {
  imageElement.hidden = true;
  imageElement.removeAttribute('src');
  sparkElement.hidden = false;
}

async function saveSettingAndRefresh(plugin, key, value) {
  plugin.settings = { ...plugin.settings, [key]: value };
  await plugin.saveData(plugin.settings);
  for (const leaf of plugin.app.workspace.getLeavesOfType('foyer')) {
    leaf.view?.refreshSettings?.();
  }
}

function refreshViewPreservingSearch(view, documentObject) {
  if (!view.inputEl) return;
  const query = view.inputEl.value;
  const wasFocused = documentObject.activeElement === view.inputEl;
  const selected = view.selected;
  view.refresh();
  if (query) {
    view.updateResults();
    if (selected >= 0 && view.items.length) view.select(Math.min(selected, view.items.length - 1));
  }
  if (wasFocused && documentObject.activeElement !== view.inputEl) view.inputEl.focus();
}

module.exports = {
  DEFAULT_SETTINGS,
  STRINGS,
  normalizeSettings,
  loadSettings,
  resolveLanguage,
  isSupportedHeroImageExtension,
  formatCalendarDate,
  formatRelativeDate,
  getGreeting,
  formatGreeting,
  resolveHeroImage,
  getSupportedHeroFiles,
  showSparkFallback,
  saveSettingAndRefresh,
  refreshViewPreservingSearch,
  recordOpen,
  renameInHistory,
  deleteFromHistory,
  isSafeHeroFileName,
  sanitizeFileName,
};

})(homeSettingsModule, homeSettingsModule.exports);
const {
  Plugin,
  PluginSettingTab,
  Setting,
  FuzzySuggestModal,
  ItemView,
  TFile,
  Keymap,
  Notice,
  Platform,
  prepareFuzzySearch,
  renderMatches,
  setIcon,
  moment,
  getLanguage,
  normalizePath,
  debounce,
} = require('obsidian');
const {
  STRINGS,
  loadSettings,
  resolveLanguage,
  formatCalendarDate,
  formatRelativeDate,
  formatGreeting,
  resolveHeroImage,
  getSupportedHeroFiles,
  showSparkFallback,
  saveSettingAndRefresh,
  refreshViewPreservingSearch,
  recordOpen,
  renameInHistory,
  deleteFromHistory,
  isSafeHeroFileName,
  sanitizeFileName,
} = homeSettingsModule.exports;

const VIEW_TYPE = 'foyer';

/* ── Configuración ───────────────────────────────────────────── */
const CONFIG = {
  recentLimit: 8,
  resultLimit: 7,
  openOnStartup: true,     // abrir el inicio al arrancar Obsidian
  replaceNewTab: true,     // las pestañas nuevas vacías muestran el inicio
};

// Ocultar temporales de Syncthing, dotfiles y .tmp
const IGNORED = /(^|\/)(~syncthing~|\.)|\.tmp$/;

const ICONS = {
  md: 'file-text',
  canvas: 'layout-dashboard',
  base: 'table',
  pdf: 'file',
};

/* ── Utilidades ──────────────────────────────────────────────── */
const isListed = (f) => f instanceof TFile && !IGNORED.test(f.path);
const displayName = (f) => (f.extension === 'md' ? f.basename : f.name);
const folderOf = (f) => (f.parent && !f.parent.isRoot() ? f.parent.path : '');

function iconFor(file) {
  if (/^(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(file.extension)) return 'image';
  return ICONS[file.extension] || 'file';
}

// Pequeño destello radial, en el color de acento del tema
function buildSpark() {
  const svg = createSvg('svg', {
    attr: {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.8',
      'stroke-linecap': 'round',
    },
  });
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const r1 = 2.6;
    const r2 = i % 2 ? 7.4 : 10.4;
    svg.createSvg('line', {
      attr: {
        x1: (12 + r1 * Math.cos(a)).toFixed(2),
        y1: (12 + r1 * Math.sin(a)).toFixed(2),
        x2: (12 + r2 * Math.cos(a)).toFixed(2),
        y2: (12 + r2 * Math.sin(a)).toFixed(2),
      },
    });
  }
  return svg;
}

/* ── Vista ───────────────────────────────────────────────────── */
class HomeView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.navigation = true; // abrir un archivo desde el explorador reemplaza el inicio
    this.items = [];
    this.selected = -1;
    this.refreshRecentSoon = debounce(() => this.renderRecent(), 150, true);
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return STRINGS[this.plugin.getEffectiveLanguage()].viewTitle; }
  getIcon() { return 'home'; }

  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass('foyer');

    this.wrapEl = root.createDiv('foyer__wrap');

    // Cabecera
    const hero = this.wrapEl.createDiv('foyer__hero');
    this.sparkEl = hero.createDiv('foyer__spark');
    this.sparkEl.appendChild(buildSpark());
    this.heroImageEl = hero.createEl('img', { cls: 'foyer__image', attr: { alt: '' } });
    this.heroImageEl.hidden = true;
    this.registerDomEvent(this.heroImageEl, 'error', () => this.showSpark());
    this.dateEl = hero.createDiv('foyer__date');
    this.titleEl = hero.createEl('h1', { cls: 'foyer__title' });

    // Búsqueda
    const search = this.wrapEl.createDiv('foyer__search');
    const box = search.createDiv('foyer__box');
    setIcon(box.createSpan('foyer__search-icon'), 'search');
    this.inputEl = box.createEl('input', {
      cls: 'foyer__input',
      type: 'text',
      attr: {
        placeholder: '',
        spellcheck: 'false',
        autocomplete: 'off',
        'aria-label': '',
      },
    });
    box.createEl('kbd', { cls: 'foyer__kbd', text: '↵' });

    this.resultsEl = search.createDiv('foyer__results');

    const help = search.createDiv('foyer__help');
    this.helpEl = help;

    // Recientes
    const recent = this.wrapEl.createDiv('foyer__recent');
    this.recentLabelEl = recent.createDiv('foyer__section-head')
      .createSpan({ cls: 'foyer__label' });
    this.recentEl = recent.createDiv('foyer__list');

    // Eventos
    this.registerDomEvent(this.inputEl, 'input', () => this.updateResults());
    this.registerDomEvent(this.inputEl, 'keydown', (e) => this.onKeyDown(e));

    const ws = this.app.workspace;
    this.registerEvent(ws.on('file-open', () => this.refreshRecentSoon()));
    this.registerEvent(this.app.vault.on('delete', () => this.refreshRecentSoon()));
    this.registerEvent(this.app.vault.on('rename', () => this.refreshRecentSoon()));
    this.registerEvent(ws.on('active-leaf-change', (leaf) => {
      if (leaf === this.leaf) {
        this.refresh();
        this.focusInput();
      }
    }));
    this.registerInterval(window.setInterval(() => this.updateRecentTimes(), 30 * 1000));

    this.refresh();
    this.focusInput();
  }

  async onClose() {
    this.contentEl.empty();
  }

  refresh() {
    const language = this.plugin.getEffectiveLanguage();
    const strings = STRINGS[language];
    this.dateEl.setText(formatCalendarDate(moment, language));
    this.titleEl.setText(formatGreeting(language, this.plugin.settings.name, new Date().getHours()));
    this.inputEl.placeholder = strings.searchPlaceholder;
    this.inputEl.setAttribute('aria-label', strings.searchLabel);
    this.recentLabelEl.setText(strings.recent);
    const mod = Platform.isMacOS ? '⌘' : 'Ctrl';
    this.helpEl.empty();
    strings.keyboardHelp.forEach((item) => this.helpEl.createSpan({ text: typeof item === 'function' ? item(mod) : item }));
    this.renderHeroImage();
    this.renderRecent();
  }

  refreshSettings() {
    refreshViewPreservingSearch(this, document);
  }

  showSpark() {
    showSparkFallback(this.heroImageEl, this.sparkEl);
  }

  renderHeroImage() {
    const resolved = resolveHeroImage(this.app.vault, this.plugin.settings.heroImagePath, TFile);
    if (!resolved) {
      this.showSpark();
      return;
    }
    this.sparkEl.hidden = true;
    this.heroImageEl.hidden = false;
    this.heroImageEl.src = resolved.src;
  }

  focusInput() {
    window.setTimeout(() => {
      if (!this.inputEl) return;
      if (this.app.workspace.getActiveViewOfType(HomeView) !== this) return;
      if (document.activeElement !== this.inputEl) this.inputEl.focus();
    }, 40);
  }

  /* ── Recientes ── */
  getRecentFiles() {
    const out = [];
    const seen = new Set();
    for (const path of this.app.workspace.getLastOpenFiles()) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!isListed(file) || seen.has(file.path)) continue;
      seen.add(file.path);
      out.push(file);
      if (out.length >= CONFIG.recentLimit) break;
    }
    return out;
  }

  renderRecent() {
    if (!this.recentEl) return;
    this.recentEl.empty();
    this.recentTimeEls = [];

    const files = this.getRecentFiles();
    if (!files.length) {
      this.recentEl.createDiv({
        cls: 'foyer__empty',
        text: STRINGS[this.plugin.getEffectiveLanguage()].emptyRecent,
      });
      return;
    }

    for (const file of files) {
      const row = this.recentEl.createDiv({ cls: 'foyer__row', attr: { title: file.path } });
      setIcon(row.createSpan('foyer__row-icon'), iconFor(file));

      const main = row.createDiv('foyer__row-main');
      main.createSpan({ cls: 'foyer__row-title', text: displayName(file) });
      const folder = folderOf(file);
      if (folder) main.createSpan({ cls: 'foyer__row-path', text: folder });

      // Hora real de la última apertura (no la de modificación del archivo).
      const timeEl = row.createSpan({ cls: 'foyer__row-time' });
      this.recentTimeEls.push({ el: timeEl, path: file.path });

      row.addEventListener('click', (e) => this.openFile(file, Keymap.isModEvent(e)));
      row.addEventListener('auxclick', (e) => { if (e.button === 1) this.openFile(file, 'tab'); });
      row.addEventListener('mouseover', (e) => {
        this.app.workspace.trigger('hover-link', {
          event: e,
          source: VIEW_TYPE,
          hoverParent: this,
          targetEl: row,
          linktext: file.path,
        });
      });
    }
    this.updateRecentTimes();
  }

  updateRecentTimes() {
    if (!this.recentTimeEls) return;
    const language = this.plugin.getEffectiveLanguage();
    for (const { el, path } of this.recentTimeEls) {
      const openedAt = this.plugin.getLastOpened(path);
      el.setText(openedAt ? formatRelativeDate(moment, openedAt, language) : '');
      if (openedAt) el.setAttribute('aria-label', moment(openedAt).locale(language).format('LLL'));
      else el.removeAttribute('aria-label');
    }
  }

  /* ── Búsqueda ── */
  updateResults() {
    const query = this.inputEl.value.trim();
    this.resultsEl.empty();
    this.items = [];
    this.selected = -1;
    this.wrapEl.toggleClass('is-searching', query.length > 0);
    if (!query) return;

    const fuzzy = prepareFuzzySearch(query);
    const matches = [];
    for (const file of this.app.vault.getFiles()) {
      if (!isListed(file)) continue;
      const name = displayName(file);
      const byName = fuzzy(name);
      if (byName) {
        matches.push({ file, name, onName: true, match: byName });
        continue;
      }
      const byPath = fuzzy(file.path);
      if (byPath) matches.push({ file, name, onName: false, match: byPath });
    }

    matches.sort((a, b) =>
      (b.onName - a.onName) ||
      (b.match.score - a.match.score) ||
      (b.file.stat.mtime - a.file.stat.mtime));

    for (const m of matches.slice(0, CONFIG.resultLimit)) {
      const el = this.resultsEl.createDiv('foyer__item');
      setIcon(el.createSpan('foyer__item-icon'), iconFor(m.file));
      const body = el.createDiv('foyer__item-body');
      const title = body.createSpan('foyer__item-title');
      const folder = folderOf(m.file);

      if (m.onName) {
        renderMatches(title, m.name, m.match.matches);
        if (folder) body.createSpan({ cls: 'foyer__item-path', text: folder });
      } else {
        title.setText(m.name);
        renderMatches(body.createSpan('foyer__item-path'), m.file.path, m.match.matches);
      }
      this.addItem(el, (mode) => this.openFile(m.file, mode));
    }

    if (matches.length) this.resultsEl.createDiv('foyer__divider');

    const strings = STRINGS[this.plugin.getEffectiveLanguage()];
    const searchEl = this.actionItem('search', strings.searchContent(query), '⇧ ↵');
    this.addItem(searchEl, () => this.openGlobalSearch(query));

    const exact = matches.some((m) => m.name.toLowerCase() === query.toLowerCase());
    if (!exact) {
      const createEl = this.actionItem('file-plus', strings.createNote(query), '');
      this.addItem(createEl, (mode) => this.createNote(query, mode));
    }

    this.select(0);
  }

  actionItem(icon, text, hint) {
    const el = this.resultsEl.createDiv('foyer__item foyer__item--action');
    setIcon(el.createSpan('foyer__item-icon'), icon);
    el.createDiv('foyer__item-body').createSpan({ cls: 'foyer__item-title', text });
    if (hint) el.createSpan({ cls: 'foyer__item-hint', text: hint });
    return el;
  }

  addItem(el, run) {
    const index = this.items.length;
    this.items.push({ el, run });
    el.addEventListener('mousemove', () => { if (this.selected !== index) this.select(index); });
    el.addEventListener('click', (e) => run(Keymap.isModEvent(e)));
    el.addEventListener('auxclick', (e) => { if (e.button === 1) run('tab'); });
  }

  select(i) {
    if (!this.items.length) return;
    const n = this.items.length;
    const next = ((i % n) + n) % n;
    if (this.items[this.selected]) this.items[this.selected].el.removeClass('is-selected');
    this.selected = next;
    const el = this.items[next].el;
    el.addClass('is-selected');
    el.scrollIntoView({ block: 'nearest' });
  }

  onKeyDown(e) {
    if (e.isComposing) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.select(this.selected + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.select(this.selected - 1);
        break;
      case 'Enter': {
        e.preventDefault();
        const query = this.inputEl.value.trim();
        if (!query) return;
        if (e.shiftKey) {
          this.openGlobalSearch(query);
          return;
        }
        const item = this.items[this.selected];
        if (item) item.run(Keymap.isModEvent(e));
        break;
      }
      case 'Escape':
        if (this.inputEl.value) {
          e.preventDefault();
          this.inputEl.value = '';
          this.updateResults();
        }
        break;
    }
  }

  /* ── Acciones ── */
  async openFile(file, mode) {
    const leaf = mode ? this.app.workspace.getLeaf(mode) : this.leaf;
    // Tab deduplication may redirect this open to an existing leaf.
    await leaf.openFile(file, { active: true });
  }

  openGlobalSearch(query) {
    const gs = this.app.internalPlugins?.getPluginById?.('global-search');
    if (gs?.enabled && gs.instance?.openGlobalSearch) {
      gs.instance.openGlobalSearch(query);
    } else {
      new Notice(STRINGS[this.plugin.getEffectiveLanguage()].globalSearchUnavailable);
    }
  }

  async createNote(name, mode) {
    const clean = name.replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!clean) return;
    try {
      // Respeta «Ubicación por defecto para notas nuevas» de Obsidian.
      const parent = this.app.fileManager.getNewFileParent(this.app.workspace.getActiveFile()?.path ?? '');
      const folder = parent && !parent.isRoot() ? parent.path : '';
      const path = normalizePath(folder ? `${folder}/${clean}.md` : `${clean}.md`);
      const existing = this.app.vault.getAbstractFileByPath(path);
      const file = existing instanceof TFile ? existing : await this.app.vault.create(path, '');
      await this.openFile(file, mode);
    } catch (err) {
      console.error('[foyer]', err);
      new Notice(STRINGS[this.plugin.getEffectiveLanguage()].createNoteFailed);
    }
  }
}

/* ── Plugin ──────────────────────────────────────────────────── */
class HeroImageSuggestModal extends FuzzySuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
  }

  getItems() {
    return getSupportedHeroFiles(this.app.vault.getFiles(), TFile);
  }

  getItemText(file) {
    return file.path;
  }

  onChooseItem(file) {
    this.onChoose(file);
  }
}

class HomeSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    const strings = STRINGS[this.plugin.getEffectiveLanguage()];

    new Setting(containerEl)
      .setName(strings.settingsName)
      .setDesc(strings.settingsNameDescription)
      .addText((text) => text
        .setValue(this.plugin.settings.name)
        .onChange((value) => this.plugin.updateSetting('name', value)));

    new Setting(containerEl)
      .setName(strings.settingsLanguage)
      .setDesc(strings.settingsLanguageDescription)
      .addDropdown((dropdown) => dropdown
        .addOption('auto', strings.languageAuto)
        .addOption('es', strings.languageSpanish)
        .addOption('en', strings.languageEnglish)
        .setValue(this.plugin.settings.language)
        .onChange(async (value) => {
          await this.plugin.updateSetting('language', value);
          this.display();
        }));

    const applyImage = async (file) => {
      await this.plugin.updateSetting('heroImagePath', file.path);
      new Notice(STRINGS[this.plugin.getEffectiveLanguage()].imageSelected);
      this.display();
    };

    // Selector nativo de archivos (oculto); la imagen se copia al vault para poder mostrarla.
    const fileInput = containerEl.createEl('input', {
      attr: { type: 'file', accept: '.png,.jpg,.jpeg,.gif,.webp,.avif,.bmp' },
    });
    fileInput.hidden = true;
    fileInput.addEventListener('change', async () => {
      const picked = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!picked) return;
      const current = STRINGS[this.plugin.getEffectiveLanguage()];
      if (!isSafeHeroFileName(picked.name)) {
        new Notice(current.imageUnsupported);
        return;
      }
      try {
        await applyImage(await this.plugin.importHeroImage(picked));
      } catch (err) {
        console.error('[foyer]', err);
        new Notice(current.imageImportFailed);
      }
    });

    const imageSetting = new Setting(containerEl)
      .setName(strings.settingsImage)
      .setDesc(strings.settingsImageDescription)
      .addButton((button) => button
        .setButtonText(strings.uploadImage)
        .setCta()
        .onClick(() => fileInput.click()))
      .addButton((button) => button
        .setButtonText(strings.chooseImage)
        .onClick(() => {
          const modal = new HeroImageSuggestModal(this.app, applyImage);
          modal.emptyStateText = strings.noVaultImages;
          modal.open();
        }));

    if (this.plugin.settings.heroImagePath) {
      imageSetting.addButton((button) => button
        .setButtonText(strings.clearImage)
        .onClick(async () => {
          await this.plugin.updateSetting('heroImagePath', '');
          new Notice(STRINGS[this.plugin.getEffectiveLanguage()].imageCleared);
          this.display();
        }));
    }

    this.renderImageInfographic(containerEl, strings);
  }

  // Infografía: maqueta en miniatura del inicio con la zona de la imagen resaltada.
  renderImageInfographic(containerEl, strings) {
    const language = this.plugin.getEffectiveLanguage();
    const info = containerEl.createDiv({ cls: 'foyer-settings__info' });

    // Maqueta
    const mock = info.createDiv({ cls: 'foyer-settings__mock', attr: { 'aria-hidden': 'true' } });
    const slot = mock.createDiv({ cls: 'foyer-settings__slot' });
    const spark = slot.createDiv({ cls: 'foyer-settings__spark' });
    spark.appendChild(buildSpark());
    const resolved = resolveHeroImage(this.app.vault, this.plugin.settings.heroImagePath, TFile);
    if (resolved) {
      const image = slot.createEl('img', { cls: 'foyer-settings__image', attr: { src: resolved.src, alt: '' } });
      spark.hidden = true;
      slot.addClass('has-image');
      image.addEventListener('error', () => {
        showSparkFallback(image, spark);
        slot.removeClass('has-image');
      }, { once: true });
    }
    slot.createSpan({ cls: 'foyer-settings__tag', text: strings.infoTag });

    mock.createDiv({ cls: 'foyer-settings__mock-date', text: formatCalendarDate(moment, language) });
    mock.createDiv({
      cls: 'foyer-settings__mock-title',
      text: formatGreeting(language, this.plugin.settings.name, new Date().getHours()),
    });
    const search = mock.createDiv({ cls: 'foyer-settings__mock-search' });
    setIcon(search.createSpan(), 'search');
    search.createSpan({ text: strings.searchPlaceholder });
    const list = mock.createDiv({ cls: 'foyer-settings__mock-list' });
    for (const width of [70, 52, 61]) {
      const row = list.createDiv({ cls: 'foyer-settings__mock-row' });
      row.createSpan({ cls: 'foyer-settings__mock-line' }).style.width = `${width}%`;
      row.createSpan({ cls: 'foyer-settings__mock-line is-short' });
    }

    // Explicación
    const notes = info.createDiv({ cls: 'foyer-settings__notes' });
    notes.createDiv({ cls: 'foyer-settings__notes-title', text: strings.infoTitle });
    const ul = notes.createEl('ul');
    strings.infoPoints.forEach(([icon, text]) => {
      const li = ul.createEl('li');
      setIcon(li.createSpan({ cls: 'foyer-settings__notes-icon' }), icon);
      li.createSpan({ text });
    });
    notes.createDiv({
      cls: 'foyer-settings__status',
      text: resolved ? `${strings.infoCurrent} ${resolved.file.path}` : strings.noImage,
    });
  }
}

module.exports = class FoyerPlugin extends Plugin {
  async onload() {
    await loadSettings(this);
    this.saveHistorySoon = debounce(() => this.saveData(this.settings), 2000, true);
    this.register(() => this.saveHistorySoon.run?.());

    // Historial de aperturas: se registra antes que la vista para que ya esté al día al renderizar.
    const ws = this.app.workspace;
    this.registerEvent(ws.on('file-open', (file) => {
      if (!(file instanceof TFile)) return;
      recordOpen(this.settings.openHistory, file.path, Date.now());
      this.saveHistorySoon();
    }));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      if (renameInHistory(this.settings.openHistory, oldPath, file.path)) this.saveHistorySoon();
    }));
    this.registerEvent(this.app.vault.on('delete', (file) => {
      if (deleteFromHistory(this.settings.openHistory, file.path)) this.saveHistorySoon();
    }));

    this.registerView(VIEW_TYPE, (leaf) => new HomeView(leaf, this));
    this.registerHoverLinkSource(VIEW_TYPE, { display: 'Foyer', defaultMod: true });

    this.addSettingTab(new HomeSettingTab(this.app, this));

    this.addRibbonIcon('home', STRINGS[this.getEffectiveLanguage()].openHome, () => this.openHome());
    this.addCommand({ id: 'open', name: STRINGS[this.getEffectiveLanguage()].openHome, callback: () => this.openHome() });

    this.app.workspace.onLayoutReady(async () => {
      // El archivo activo restaurado al arrancar cuenta como abierto ahora.
      const active = ws.getActiveFile();
      if (active instanceof TFile) {
        recordOpen(this.settings.openHistory, active.path, Date.now());
        this.saveHistorySoon();
      }
      if (CONFIG.openOnStartup) await this.openHome();
      if (CONFIG.replaceNewTab) {
        this.registerEvent(this.app.workspace.on('layout-change', () => this.scheduleReplace()));
        this.register(() => window.clearTimeout(this.replaceTimer));
        this.scheduleReplace();
      }
    });
  }

  getLastOpened(path) {
    return this.settings.openHistory[path] || null;
  }

  getEffectiveLanguage() {
    return resolveLanguage(this.settings.language, getLanguage());
  }

  async updateSetting(key, value) {
    await saveSettingAndRefresh(this, key, value);
  }

  // Copia una imagen elegida en el equipo dentro del vault (carpeta de adjuntos) y devuelve el TFile.
  async importHeroImage(browserFile) {
    const name = sanitizeFileName(browserFile.name);
    const fm = this.app.fileManager;
    const path = typeof fm.getAvailablePathForAttachment === 'function'
      ? await fm.getAvailablePathForAttachment(name)
      : normalizePath(name);
    const data = await browserFile.arrayBuffer();
    return this.app.vault.createBinary(path, data);
  }

  async openHome() {
    const ws = this.app.workspace;
    let leaf = ws.getLeavesOfType(VIEW_TYPE)[0];
    if (!leaf) {
      const recent = ws.getMostRecentLeaf(ws.rootSplit);
      leaf = recent && recent.view?.getViewType() === 'empty' ? recent : ws.getLeaf('tab');
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
    }
    await ws.revealLeaf(leaf);
    ws.setActiveLeaf(leaf, { focus: true });
  }

  // Convierte la pestaña vacía activa ("Nueva pestaña") en el inicio.
  // Con retardo y re-comprobación para no pisar archivos que se están abriendo.
  scheduleReplace() {
    window.clearTimeout(this.replaceTimer);
    this.replaceTimer = window.setTimeout(() => {
      const ws = this.app.workspace;
      const leaf = ws.getMostRecentLeaf(ws.rootSplit);
      if (leaf && leaf.view?.getViewType() === 'empty') {
        leaf.setViewState({ type: VIEW_TYPE });
      }
    }, 120);
  }
};
