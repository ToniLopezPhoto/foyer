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
  openOnStartup: true,   // abrir el inicio al arrancar Obsidian
  replaceNewTab: true,   // las pestañas nuevas vacías muestran el inicio
  recentLimit: 8,        // notas en «Recientes»
  resultLimit: 7,        // resultados de búsqueda visibles
  pinned: Object.freeze([]), // rutas de las notas fijadas; viven en data.json y se sincronizan
});

const LIMIT_MIN = 3;
const LIMIT_MAX = 20;

const HERO_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'bmp']);
const OPEN_HISTORY_LIMIT = 200;
// Colores de las notas fijadas: los de la paleta del tema (--color-<nombre>); «sin color» es la cadena vacía.
const PIN_COLORS = Object.freeze(['yellow', 'orange', 'red', 'purple', 'blue', 'cyan', 'green', 'pink']);
const OPEN_HISTORY_KEY = 'foyer-open-history';

const STRINGS = {
  es: {
    viewTitle: 'Inicio',
    greeting: ['Buenos días', 'Buenas tardes', 'Buenas noches'],
    searchPlaceholder: 'Buscar en el vault…',
    searchLabel: 'Buscar notas',
    keyboardHelp: ['↑↓ moverse', '↵ abrir', (mod) => `${mod} ↵ nueva pestaña`, '⇧ ↵ buscar en contenido'],
    recent: 'Recientes',
    pinned: 'Fijadas',
    emptyRecent: 'Todavía no has abierto ninguna nota.',
    searchContent: (query) => `Buscar «${query}» en el contenido`,
    createNote: (query) => `Crear nota «${query}»`,
    globalSearchUnavailable: 'La búsqueda global no está disponible.',
    createNoteFailed: 'No se pudo crear la nota.',
    openHome: 'Abrir inicio',
    commandFocusSearch: 'Enfocar la búsqueda de Foyer',
    commandOpenNewTab: 'Abrir Foyer en una pestaña nueva',
    commandPinCurrent: 'Fijar nota actual en Foyer',
    commandUnpinCurrent: 'Quitar nota actual de Foyer',
    pinToFoyer: 'Fijar en Foyer',
    unpinFromFoyer: 'Quitar de Foyer',
    cardOpen: 'Abrir',
    cardOpenNewTab: 'Abrir en una pestaña nueva',
    cardColor: 'Color',
    cardMoved: (title, position, total) => `${title}: posición ${position} de ${total}`,
    pinColors: {
      none: 'Sin color', yellow: 'Amarillo', orange: 'Naranja', red: 'Rojo', purple: 'Morado',
      blue: 'Azul', cyan: 'Cian', green: 'Verde', pink: 'Rosa',
    },
    removeFromRecent: 'Quitar de Recientes',
    commandClearHistory: 'Borrar historial de Recientes',
    historyCleared: 'Historial de Recientes borrado.',
    settingsClearHistory: 'Borrar historial de Recientes',
    settingsClearHistoryDescription: 'Vacía la lista de notas abiertas recientemente en este dispositivo. Tus notas y las notas fijadas no se tocan.',
    clearHistoryButton: 'Borrar',
    settingsName: 'Nombre del saludo',
    settingsNameDescription: 'Deja el campo vacío para mostrar el saludo sin nombre.',
    settingsLanguage: 'Idioma',
    settingsLanguageDescription: 'Elige el idioma de la página de inicio.',
    languageAuto: 'Automático (idioma de Obsidian)',
    languageSpanish: 'Español',
    languageEnglish: 'English',
    settingsOpenOnStartup: 'Abrir al iniciar',
    settingsOpenOnStartupDescription: 'Muestra el inicio al arrancar Obsidian. El cambio se aplica la próxima vez que abras Obsidian.',
    settingsReplaceNewTab: 'Reemplazar pestañas nuevas',
    settingsReplaceNewTabDescription: 'Las pestañas nuevas vacías muestran el inicio. Desactívalo si usas otro plugin de página de inicio.',
    settingsRecentLimit: 'Notas recientes',
    settingsRecentLimitDescription: 'Cuántas notas se muestran en «Recientes» (de 3 a 20).',
    settingsResultLimit: 'Resultados de búsqueda',
    settingsResultLimitDescription: 'Cuántos resultados se muestran al buscar (de 3 a 20).',
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
    searchPlaceholder: 'Search the vault…',
    searchLabel: 'Search notes',
    keyboardHelp: ['↑↓ navigate', '↵ open', (mod) => `${mod} ↵ new tab`, '⇧ ↵ search content'],
    recent: 'Recent',
    pinned: 'Pinned',
    emptyRecent: 'You have not opened any notes yet.',
    searchContent: (query) => `Search “${query}” in content`,
    createNote: (query) => `Create note “${query}”`,
    globalSearchUnavailable: 'Global search is unavailable.',
    createNoteFailed: 'Could not create the note.',
    openHome: 'Open home',
    commandFocusSearch: 'Focus Foyer search',
    commandOpenNewTab: 'Open Foyer in a new tab',
    commandPinCurrent: 'Pin current note to Foyer',
    commandUnpinCurrent: 'Unpin current note from Foyer',
    pinToFoyer: 'Pin to Foyer',
    unpinFromFoyer: 'Unpin from Foyer',
    cardOpen: 'Open',
    cardOpenNewTab: 'Open in new tab',
    cardColor: 'Color',
    cardMoved: (title, position, total) => `${title} moved to position ${position} of ${total}`,
    pinColors: {
      none: 'No color', yellow: 'Yellow', orange: 'Orange', red: 'Red', purple: 'Purple',
      blue: 'Blue', cyan: 'Cyan', green: 'Green', pink: 'Pink',
    },
    removeFromRecent: 'Remove from Recent',
    commandClearHistory: 'Clear Recent history',
    historyCleared: 'Recent history cleared.',
    settingsClearHistory: 'Clear Recent history',
    settingsClearHistoryDescription: 'Empties the list of recently opened notes on this device. Your notes and pinned notes are not touched.',
    clearHistoryButton: 'Clear',
    settingsName: 'Greeting name',
    settingsNameDescription: 'Leave this blank to show the greeting without a name.',
    settingsLanguage: 'Language',
    settingsLanguageDescription: 'Choose the home page language.',
    languageAuto: 'Automatic (Obsidian language)',
    languageSpanish: 'Español',
    languageEnglish: 'English',
    settingsOpenOnStartup: 'Open on startup',
    settingsOpenOnStartupDescription: 'Show the home page when Obsidian starts. Takes effect the next time you start Obsidian.',
    settingsReplaceNewTab: 'Replace new tabs',
    settingsReplaceNewTabDescription: 'Empty new tabs show the home page. Turn this off if you use another home-page plugin.',
    settingsRecentLimit: 'Recent notes',
    settingsRecentLimitDescription: 'How many notes appear under Recent (3 to 20).',
    settingsResultLimit: 'Search results',
    settingsResultLimitDescription: 'How many results appear while searching (3 to 20).',
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

// Entero dentro de [LIMIT_MIN, LIMIT_MAX]; cualquier valor que no sea un número finito usa el valor por defecto.
function normalizeLimit(value, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(LIMIT_MAX, Math.max(LIMIT_MIN, Math.round(value)));
}

// Notas fijadas como [{ path, color }]. Acepta también la lista de rutas de las primeras versiones de 1.2.
// Se descartan las entradas sin ruta válida y las rutas repetidas (gana la primera); un color desconocido es «sin color».
function normalizePinned(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of value) {
    const object = entry && typeof entry === 'object' && !Array.isArray(entry);
    const path = typeof entry === 'string' ? entry : object ? entry.path : null;
    if (typeof path !== 'string' || !path || seen.has(path)) continue;
    seen.add(path);
    out.push({ path, color: object && PIN_COLORS.includes(entry.color) ? entry.color : '' });
  }
  return out;
}

function normalizeToggle(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

// El historial vive en el almacenamiento local del dispositivo, nunca en data.json.
function normalizeSettings(data) {
  const { openHistory: _legacyHistory, ...source } = data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  return {
    ...source,
    name: typeof source.name === 'string' ? source.name : DEFAULT_SETTINGS.name,
    language: ['auto', 'es', 'en'].includes(source.language) ? source.language : DEFAULT_SETTINGS.language,
    heroImagePath: typeof source.heroImagePath === 'string' ? source.heroImagePath : DEFAULT_SETTINGS.heroImagePath,
    openOnStartup: normalizeToggle(source.openOnStartup, DEFAULT_SETTINGS.openOnStartup),
    replaceNewTab: normalizeToggle(source.replaceNewTab, DEFAULT_SETTINGS.replaceNewTab),
    recentLimit: normalizeLimit(source.recentLimit, DEFAULT_SETTINGS.recentLimit),
    resultLimit: normalizeLimit(source.resultLimit, DEFAULT_SETTINGS.resultLimit),
    pinned: normalizePinned(source.pinned),
  };
}

// Combina dos historiales: gana la marca más reciente de cada ruta y se aplica el tope.
function mergeOpenHistory(...histories) {
  const merged = {};
  for (const history of histories) {
    for (const [path, ts] of Object.entries(normalizeOpenHistory(history))) {
      merged[path] = Math.max(merged[path] || 0, ts);
    }
  }
  const paths = Object.keys(merged);
  if (paths.length > OPEN_HISTORY_LIMIT) {
    paths
      .sort((a, b) => merged[b] - merged[a])
      .slice(OPEN_HISTORY_LIMIT)
      .forEach((p) => delete merged[p]);
  }
  return merged;
}

// app.loadLocalStorage / saveLocalStorage son por vault y por dispositivo; si faltan, solo hay memoria.
function loadOpenHistory(app) {
  try {
    if (typeof app.loadLocalStorage !== 'function') return {};
    return normalizeOpenHistory(app.loadLocalStorage(OPEN_HISTORY_KEY));
  } catch (_error) {
    return {};
  }
}

function saveOpenHistory(app, history) {
  try {
    if (typeof app.saveLocalStorage !== 'function') return false;
    app.saveLocalStorage(OPEN_HISTORY_KEY, history);
    return true;
  } catch (_error) {
    return false;
  }
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

// Rutas fijadas tras renombrar un archivo o una carpeta; devuelve la lista nueva o null si nada cambia.
function renameInPinned(pinned, oldPath, newPath) {
  let changed = false;
  const next = pinned.map((entry) => {
    let moved = null;
    if (entry.path === oldPath) moved = newPath;
    else if (entry.path.startsWith(`${oldPath}/`)) moved = newPath + entry.path.slice(oldPath.length);
    if (moved === null) return entry;
    changed = true;
    return { ...entry, path: moved };
  });
  return changed ? normalizePinned(next) : null;
}

// Rutas fijadas tras borrar un archivo o una carpeta; devuelve la lista nueva o null si nada cambia.
function deleteFromPinned(pinned, removedPath) {
  const next = pinned.filter((entry) => entry.path !== removedPath && !entry.path.startsWith(`${removedPath}/`));
  return next.length === pinned.length ? null : next;
}

// Nuevo orden de las fijadas. `order` son las rutas que se ven, en su orden nuevo: ocupan los mismos huecos
// que tenían y las demás entradas (todavía sin sincronizar, excluidas...) no se mueven. null si nada cambia.
function reorderPinned(pinned, order) {
  const byPath = new Map(pinned.map((entry) => [entry.path, entry]));
  const wanted = [...new Set(order)].filter((path) => byPath.has(path));
  if (wanted.length < 2) return null;
  const slots = new Set(wanted);
  let next = 0;
  let changed = false;
  const result = pinned.map((entry) => {
    if (!slots.has(entry.path)) return entry;
    const moved = byPath.get(wanted[next++]);
    if (moved !== entry) changed = true;
    return moved;
  });
  return changed ? result : null;
}

// Inclinación fija de una tarjeta, de 1 a 2 grados hacia un lado u otro, según un hash (FNV-1a) de la ruta:
// la misma nota se inclina igual en cada pintado y en cada dispositivo.
function cardTilt(path) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < path.length; i++) {
    hash ^= path.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const degrees = 1 + ((hash >>> 8) % 101) / 100;
  return hash & 1 ? degrees : -degrees;
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

// Carga ajustes e historial. Si data.json aún trae openHistory (versiones anteriores),
// se fusiona con el historial local y se guardan los ajustes sin él.
async function loadSettings(plugin) {
  const raw = await plugin.loadData();
  const legacy = raw && typeof raw === 'object' && !Array.isArray(raw) && 'openHistory' in raw;
  plugin.settings = normalizeSettings(raw);
  plugin.openHistory = mergeOpenHistory(loadOpenHistory(plugin.app), legacy ? raw.openHistory : null);
  if (legacy) {
    saveOpenHistory(plugin.app, plugin.openHistory);
    await plugin.saveData(plugin.settings);
  }
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
  LIMIT_MIN,
  LIMIT_MAX,
  PIN_COLORS,
  STRINGS,
  normalizeSettings,
  loadSettings,
  saveOpenHistory,
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
  renameInPinned,
  deleteFromPinned,
  reorderPinned,
  cardTilt,
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
  Menu,
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
  LIMIT_MIN,
  LIMIT_MAX,
  loadSettings,
  saveOpenHistory,
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
  renameInPinned,
  deleteFromPinned,
  reorderPinned,
  cardTilt,
  PIN_COLORS,
  isSafeHeroFileName,
  sanitizeFileName,
} = homeSettingsModule.exports;

const VIEW_TYPE = 'foyer';
const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
// Arrastre de tarjetas: pulsación larga en táctil, distancia mínima (px) para empezar o para cancelar por desplazamiento
const LONG_PRESS_MS = 300;
const MOUSE_DRAG_SLOP = 4;
const TOUCH_SCROLL_SLOP = 10;
const FLIP_MS = 180;
let viewCounter = 0; // para que los ids ARIA de cada vista sean únicos

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

// Alias de la nota según su frontmatter (`aliases`, o el antiguo `alias`): texto o lista; como hace Obsidian,
// un texto se separa por comas. Se descartan los valores vacíos y los que no son texto ni número.
function readAliases(frontmatter) {
  const raw = frontmatter && (frontmatter.aliases ?? frontmatter.alias);
  const values = typeof raw === 'string' ? raw.split(',') : Array.isArray(raw) ? raw : [];
  const aliases = [];
  for (const value of values) {
    if (typeof value !== 'string' && typeof value !== 'number') continue;
    const alias = String(value).trim();
    if (alias) aliases.push(alias);
  }
  return aliases;
}

// Orden de los resultados: coincidencia en el nombre, mayor puntuación, apertura más reciente
// (historial del plugin; 0 si nunca se abrió) y archivo modificado más recientemente.
// Devuelve < 0 si el candidato (onName, score, opened, mtime) va antes que `other`; 0 si empatan.
const compareRank = (onName, score, opened, mtime, other) =>
  (other.onName - onName) || (other.match.score - score) || (other.opened - opened) || (other.file.stat.mtime - mtime);

// Inserta `item` en `top` (ordenado, como máximo `limit` elementos) detrás de los que empatan con él.
// Equivale a ordenar todas las coincidencias con un sort estable y quedarse con las primeras.
function insertTop(top, item, limit) {
  let at = top.length;
  while (at > 0 && compareRank(item.onName, item.match.score, item.opened, item.file.stat.mtime, top[at - 1]) < 0) at--;
  top.splice(at, 0, item);
  if (top.length > limit) top.pop();
}

// Quita un «.md» final sin distinguir mayúsculas: «idea.md» busca o crea la nota «idea».
const stripMdSuffix = (text) => text.replace(/\.md$/i, '');

// Separa «carpeta/subcarpeta/nota» en carpetas y nombre; cada segmento se sanea y los vacíos se descartan.
// Una barra final («Proyectos/Idea.md/») no cuenta, y los segmentos que empiezan por «.» se descartan:
// Foyer no lista archivos ocultos, así que no debe crear carpetas ocultas.
function parseNoteInput(input) {
  const text = stripMdSuffix(input.trim().replace(/[\s/]+$/, ''));
  const segments = text
    .split('/')
    .map((segment) => segment.replace(/[\\/:*?"<>|#^[\]]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter((segment) => segment && !segment.startsWith('.')); // «.», «..» y ocultos no pueden salir de la carpeta prevista
  return { folders: segments.slice(0, -1), name: segments[segments.length - 1] || '' };
}

// Ruta de la nota «name» dentro de «folder» (cadena vacía = raíz del vault).
const notePath = (folder, name) => normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);

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
    this.uid = `foyer-${++viewCounter}`;
    this.items = []; // filas de resultados (búsqueda)
    this.recentItems = []; // filas de «Recientes»
    this.hasQuery = false; // true: la lista activa son los resultados; false: los recientes
    this.selected = -1; // índice dentro de la lista activa
    this.listedEntries = null; // caché de archivos listados: { file, name, aliases }, en el orden de vault.getFiles()
    this.searchState = null; // { query, pool }: candidatos de la última búsqueda para acotar la siguiente
    this.pendingSearch = null; // { cancel }: búsqueda programada para el próximo frame
    this.drag = null; // arrastre de una tarjeta en curso (ver onCardPointerDown)
    this.renderPending = false; // se pidió pintar «Recientes» durante un arrastre
    this.suppressClick = false; // el clic que cierra un arrastre no debe abrir la nota
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
    // Anuncia a los lectores de pantalla el resultado de mover una tarjeta (fuera del listbox)
    this.liveEl = root.createDiv({
      cls: 'foyer__live',
      attr: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
    });

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
        role: 'combobox',
        'aria-autocomplete': 'list',
        'aria-expanded': 'false',
      },
    });
    box.createEl('kbd', { cls: 'foyer__kbd', text: '↵' });

    this.resultsEl = search.createDiv({ cls: 'foyer__results', attr: { role: 'listbox', id: `${this.uid}-results` } });

    const help = search.createDiv('foyer__help');
    this.helpEl = help;

    // Fijadas y recientes: un único listbox; los encabezados de sección van dentro (renderRecent)
    const recent = this.wrapEl.createDiv('foyer__recent');
    this.recentEl = recent.createDiv({ cls: 'foyer__list', attr: { role: 'listbox', id: `${this.uid}-recent` } });

    // Eventos
    this.registerDomEvent(this.inputEl, 'input', () => this.scheduleSearch());
    this.registerDomEvent(this.inputEl, 'keydown', (e) => this.onKeyDown(e));
    // En táctil, tras la pulsación larga el dedo arrastra la tarjeta: la página no debe desplazarse.
    this.registerDomEvent(this.recentEl, 'touchmove', (e) => {
      if (this.drag?.active && e.cancelable) e.preventDefault();
    }, { passive: false });

    const ws = this.app.workspace;
    this.registerEvent(ws.on('file-open', () => this.refreshRecentSoon()));
    this.registerEvent(this.app.vault.on('delete', () => this.refreshRecentSoon()));
    this.registerEvent(this.app.vault.on('rename', () => this.refreshRecentSoon()));
    // Cualquier cambio en la lista de archivos invalida la caché de búsqueda (se reconstruye al buscar).
    for (const name of ['create', 'delete', 'rename']) {
      this.registerEvent(this.app.vault.on(name, () => this.invalidateSearchCache()));
    }
    // Los alias salen del frontmatter: si cambian los metadatos, también hay que leerlos de nuevo.
    this.registerEvent(this.app.metadataCache.on('changed', () => this.invalidateSearchCache()));
    this.registerEvent(ws.on('active-leaf-change', (leaf) => {
      if (leaf === this.leaf) {
        this.refresh();
        this.focusInput();
      }
    }));
    this.registerInterval(window.setInterval(() => {
      this.refreshHeader();
      this.updateRecentTimes();
    }, 30 * 1000));

    this.refresh();
    this.focusInput();
  }

  async onClose() {
    this.cancelPendingSearch();
    if (this.drag) window.clearTimeout(this.drag.timer);
    this.drag = null;
    this.invalidateSearchCache();
    this.contentEl.empty();
  }

  refresh() {
    const language = this.plugin.getEffectiveLanguage();
    const strings = STRINGS[language];
    this.refreshHeader();
    this.inputEl.placeholder = strings.searchPlaceholder;
    this.inputEl.setAttribute('aria-label', strings.searchLabel);
    this.resultsEl.setAttribute('aria-label', strings.searchLabel);
    const mod = Platform.isMacOS ? '⌘' : 'Ctrl';
    this.helpEl.empty();
    strings.keyboardHelp.forEach((item) => this.helpEl.createSpan({ text: typeof item === 'function' ? item(mod) : item }));
    this.renderHeroImage();
    this.renderRecent();
  }

  // Fecha y saludo; también los actualiza el temporizador, sin repintar la vista.
  refreshHeader() {
    const language = this.plugin.getEffectiveLanguage();
    this.dateEl.setText(formatCalendarDate(moment, language));
    this.titleEl.setText(formatGreeting(language, this.plugin.settings.name, new Date().getHours()));
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

  /* ── Fijadas y recientes ── */
  // Primeros `limit` archivos de `paths` que existen, se listan y no están excluidos (sin repetir rutas
  // ni las de `skip`).
  resolveRecent(paths, limit, skip = null) {
    const out = [];
    const seen = new Set();
    for (const path of paths) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!isListed(file) || seen.has(file.path) || skip?.has(file.path) || this.isExcluded(file)) continue;
      seen.add(file.path);
      out.push(file);
      if (out.length >= limit) break;
    }
    return out;
  }

  // Notas fijadas, en el orden en que se fijaron. Las que no existen, no se listan o están excluidas
  // no se muestran, pero tampoco se quitan del ajuste: puede que otro dispositivo aún no las haya sincronizado.
  getPinnedFiles() {
    return this.resolveRecent((this.plugin.settings.pinned ?? []).map((entry) => entry.path), Infinity);
  }

  // Historial propio del plugin, del más reciente al más antiguo, sin las notas fijadas (el límite se
  // aplica a lo que queda); si el historial no da ningún archivo, la lista corta de Obsidian (getLastOpenFiles).
  getRecentFiles() {
    const limit = this.plugin.settings.recentLimit;
    const pinned = new Set((this.plugin.settings.pinned ?? []).map((entry) => entry.path));
    const history = this.plugin.openHistory || {};
    const byRecency = Object.keys(history).sort((a, b) => history[b] - history[a]);
    // El respaldo de Obsidian solo entra si el historial no tiene ningún archivo, aunque estén todos fijados;
    // no puede volver a mostrar lo que el usuario quitó o borró de Recientes.
    if (this.resolveRecent(byRecency, 1).length) return this.resolveRecent(byRecency, limit, pinned);
    const skip = new Set([...pinned, ...(this.plugin.dismissedRecent ?? [])]);
    return this.resolveRecent(this.app.workspace.getLastOpenFiles(), limit, skip);
  }

  renderRecent() {
    if (!this.recentEl) return;
    if (this.drag?.active) {
      // No se repinta mientras se arrastra (se perdería la tarjeta que se mueve): se hará al soltar.
      this.renderPending = true;
      return;
    }
    this.recentEl.empty();
    this.recentTimeEls = [];
    this.recentItems = [];
    if (!this.hasQuery) this.selected = -1; // las filas son nuevas: no queda ninguna seleccionada

    const strings = STRINGS[this.plugin.getEffectiveLanguage()];
    const pinned = this.getPinnedFiles();
    const recent = this.getRecentFiles();
    this.recentEl.setAttribute('aria-label', pinned.length ? `${strings.pinned}, ${strings.recent}` : strings.recent);

    if (pinned.length) this.renderBoard(strings.pinned, pinned);
    // Con notas fijadas y nada más en el historial, «Recientes» no se muestra (ni dice que no hay nada).
    if (recent.length || !pinned.length) {
      const group = this.renderSection(strings.recent, recent, true);
      if (!pinned.length && !recent.length) group.createDiv({ cls: 'foyer__empty', text: strings.emptyRecent });
    }
    this.updateRecentTimes();
    this.syncAria();
  }

  // Grupo de «Recientes»: encabezado (decorativo) y filas, que se pueden quitar del historial. Las opciones del
  // listbox siguen siendo solo las filas; el grupo agrupa para la maquetación (columnas) y para los lectores de pantalla.
  renderSection(label, files, removable = false) {
    this.rowsEl = this.recentEl.createDiv({ cls: 'foyer__recent-group', attr: { role: 'group', 'aria-label': label } });
    const head = this.rowsEl.createDiv({ cls: 'foyer__section-head', attr: { role: 'presentation' } });
    head.createSpan({ cls: 'foyer__label', text: label });
    for (const file of files) this.renderRow(file, removable);
    return this.rowsEl;
  }

  // Las fijadas son un tablero de tarjetas cuadradas (rejilla adaptable: solo se guarda su orden), sin rótulo
  // visible; el grupo lleva su nombre para los lectores de pantalla. Las tarjetas son opciones del mismo listbox.
  renderBoard(label, files) {
    this.boardEl = this.recentEl.createDiv({ cls: 'foyer__board', attr: { role: 'group', 'aria-label': label } });
    const colors = new Map(this.plugin.settings.pinned.map((entry) => [entry.path, entry.color]));
    for (const file of files) this.renderCard(file, colors.get(file.path) || '');
  }

  // Nota adhesiva: solo el título y la carpeta (nunca se lee el contenido de la nota), con una inclinación
  // fija según su ruta y, si lo tiene, el color de la paleta del tema.
  renderCard(file, color) {
    const card = this.boardEl.createDiv({
      cls: color ? `foyer__card foyer__card--${color}` : 'foyer__card',
      attr: { title: file.path },
    });
    card.style.setProperty('--foyer-tilt', `${cardTilt(file.path)}deg`);
    this.addItem(this.recentItems, card, (mode) => this.openFile(file, mode), file);
    const item = this.recentItems[this.recentItems.length - 1];
    item.pinPath = file.path;
    item.pinTitle = displayName(file);

    card.createSpan({ cls: 'foyer__card-fold', attr: { 'aria-hidden': 'true' } });
    const label = STRINGS[this.plugin.getEffectiveLanguage()].unpinFromFoyer;
    const unpin = card.createEl('button', {
      cls: 'foyer__card-unpin',
      attr: { type: 'button', tabindex: '-1', 'aria-label': label, title: label },
    });
    setIcon(unpin, 'x');
    // Ni el clic ni el arrastre deben llegar a la tarjeta (la abriría o empezaría a moverla).
    unpin.addEventListener('pointerdown', (e) => e.stopPropagation());
    unpin.addEventListener('auxclick', (e) => e.stopPropagation());
    unpin.addEventListener('click', (e) => {
      e.stopPropagation();
      this.plugin.unpinFile(file.path);
    });
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.drag) this.showCardMenu(e, file);
    });
    card.addEventListener('pointerdown', (e) => this.onCardPointerDown(e, card));
    card.addEventListener('pointermove', (e) => this.onCardPointerMove(e, card));
    card.addEventListener('pointerup', (e) => this.onCardPointerUp(e, card));
    card.addEventListener('pointercancel', (e) => this.onCardPointerCancel(e, card));

    card.createDiv({ cls: 'foyer__card-title', text: displayName(file) });
    const folder = folderOf(file);
    if (folder) card.createDiv({ cls: 'foyer__card-path', text: folder });
  }

  renderRow(file, removable) {
    const row = this.rowsEl.createDiv({ cls: 'foyer__row', attr: { title: file.path } });
    this.addItem(this.recentItems, row, (mode) => this.openFile(file, mode), file);
    const item = this.recentItems[this.recentItems.length - 1];
    setIcon(row.createSpan('foyer__row-icon'), iconFor(file));

    const main = row.createDiv('foyer__row-main');
    main.createSpan({ cls: 'foyer__row-title', text: displayName(file) });
    const folder = folderOf(file);
    if (folder) main.createSpan({ cls: 'foyer__row-path', text: folder });

    // Hora real de la última apertura (no la de modificación del archivo).
    const timeEl = row.createSpan({ cls: 'foyer__row-time' });
    this.recentTimeEls.push({ el: timeEl, path: file.path });

    if (!removable) return;
    const strings = STRINGS[this.plugin.getEffectiveLanguage()];
    // Fijar la nota: pasa al tablero de fijadas y deja de salir en Recientes.
    this.addRowButton(row, 'foyer__row-pin', 'pin', strings.pinToFoyer, () => this.plugin.pinFile(file.path));
    // Quitar solo borra la entrada del historial; el archivo no se toca.
    item.removePath = file.path;
    this.addRowButton(row, 'foyer__row-remove', 'x', strings.removeFromRecent, () => this.removeRecentAt(this.recentItems.indexOf(item)));
  }

  // Botón con icono al final de una fila. Sus clics no deben llegar a la fila (la abriría).
  addRowButton(row, cls, icon, label, run) {
    const button = row.createEl('button', {
      cls,
      attr: { type: 'button', tabindex: '-1', 'aria-label': label, title: label },
    });
    setIcon(button, icon);
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      run();
    });
    button.addEventListener('auxclick', (e) => e.stopPropagation());
  }

  /* ── Arrastrar tarjetas ── */
  // Eventos de puntero, para ratón y táctil. Con ratón el arrastre empieza al mover unos píxeles; en táctil, tras
  // una pulsación larga (si el dedo se mueve antes es un desplazamiento y no se arrastra). Solo se guarda el orden.
  onCardPointerDown(e, card) {
    if (this.drag || this.hasQuery) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const touch = e.pointerType === 'touch';
    this.drag = {
      card,
      pointerId: e.pointerId,
      touch,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      active: false,
      moved: false,
      timer: touch ? window.setTimeout(() => this.startDrag(), LONG_PRESS_MS) : null,
    };
  }

  onCardPointerMove(e, card) {
    const drag = this.drag;
    if (!drag || drag.card !== card || e.pointerId !== drag.pointerId) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (!drag.active) {
      const distance = Math.hypot(drag.x - drag.startX, drag.y - drag.startY);
      if (drag.touch) {
        if (distance > TOUCH_SCROLL_SLOP) this.dropDragCandidate(); // es un desplazamiento de la página
        return;
      }
      if (distance < MOUSE_DRAG_SLOP) return;
      this.startDrag();
    }
    this.dragTo();
  }

  onCardPointerUp(e, card) {
    const drag = this.drag;
    if (!drag || drag.card !== card || e.pointerId !== drag.pointerId) return;
    this.endDrag(true);
  }

  onCardPointerCancel(e, card) {
    const drag = this.drag;
    if (!drag || drag.card !== card || e.pointerId !== drag.pointerId) return;
    this.endDrag(false);
  }

  // Candidato descartado antes de empezar a arrastrar.
  dropDragCandidate() {
    if (!this.drag) return;
    window.clearTimeout(this.drag.timer);
    this.drag = null;
  }

  boardCards() {
    return this.boardEl.children.filter((child) => child.classes.has('foyer__card'));
  }

  pathOfCard(card) {
    return this.recentItems.find((item) => item.el === card)?.pinPath;
  }

  // Posición de una tarjeta en la rejilla sin contar transformaciones (offset*, relativo al tablero).
  layoutRect(card) {
    return { left: card.offsetLeft, top: card.offsetTop, width: card.offsetWidth, height: card.offsetHeight };
  }

  startDrag() {
    const drag = this.drag;
    if (!drag || drag.active) return;
    window.clearTimeout(drag.timer);
    drag.active = true;
    drag.original = this.boardCards().map((card) => this.pathOfCard(card));
    drag.card.addClass('is-dragging');
    this.boardEl.addClass('is-reordering');
    try {
      drag.card.setPointerCapture?.(drag.pointerId);
    } catch (_error) {
      // sin captura, los eventos solo llegan mientras el puntero está sobre la tarjeta
    }
    // Punto de la tarjeta por el que se agarró, respecto a su centro
    const board = this.boardEl.getBoundingClientRect();
    const rect = this.layoutRect(drag.card);
    drag.grabX = drag.startX - board.left - (rect.left + rect.width / 2);
    drag.grabY = drag.startY - board.top - (rect.top + rect.height / 2);
  }

  // Coloca la tarjeta bajo el puntero y, si éste pasa sobre otra, la mueve a su sitio (las demás se deslizan).
  dragTo() {
    const drag = this.drag;
    if (!drag?.active) return;
    const board = this.boardEl.getBoundingClientRect();
    const x = drag.x - board.left;
    const y = drag.y - board.top;
    if (Math.hypot(drag.x - drag.startX, drag.y - drag.startY) > MOUSE_DRAG_SLOP) drag.moved = true;

    const cards = this.boardCards();
    const over = cards.find((card) => {
      if (card === drag.card) return false;
      const r = this.layoutRect(card);
      return x >= r.left && x < r.left + r.width && y >= r.top && y < r.top + r.height;
    });
    if (over) this.moveCardTo(drag.card, cards.indexOf(over));

    const rect = this.layoutRect(drag.card);
    const reduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const dx = x - drag.grabX - (rect.left + rect.width / 2);
    const dy = y - drag.grabY - (rect.top + rect.height / 2);
    drag.card.style.transform = `translate(${dx}px, ${dy}px)${reduced ? '' : ' scale(1.04)'}`;
  }

  // Pone `card` en la posición `index` del tablero; las otras tarjetas que cambian de sitio se animan (FLIP).
  moveCardTo(card, index) {
    const others = this.boardCards().filter((item) => item !== card);
    const first = new Map(others.map((item) => [item, this.layoutRect(item)]));
    this.boardEl.insertBefore(card, others[index] ?? null);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    for (const item of others) {
      const before = first.get(item);
      const after = this.layoutRect(item);
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if ((!dx && !dy) || typeof item.animate !== 'function') continue;
      item.getAnimations?.().forEach((animation) => animation.cancel());
      item.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0px 0px' }], { duration: FLIP_MS, easing: 'ease' });
    }
  }

  // Suelta (guarda el orden) o cancela (vuelve a pintar como estaba) un arrastre.
  endDrag(drop) {
    const drag = this.drag;
    this.drag = null;
    window.clearTimeout(drag.timer);
    if (drag.active) {
      drag.card.removeClass('is-dragging');
      this.boardEl.removeClass('is-reordering');
      drag.card.style.transform = '';
      drag.card.releasePointerCapture?.(drag.pointerId);
      // El clic que sigue al soltar no debe abrir la nota
      this.suppressClick = true;
      window.setTimeout(() => { this.suppressClick = false; }, 0);

      const order = this.boardCards().map((card) => this.pathOfCard(card));
      const title = this.recentItems.find((item) => item.el === drag.card)?.pinTitle;
      if (drop && order.join('\n') !== drag.original.join('\n')) {
        const index = order.indexOf(this.pathOfCard(drag.card));
        this.pendingMove = this.commitOrder(order, title, index).finally(() => { this.pendingMove = null; });
        this.renderPending = false;
        return;
      }
      if (drop && drag.touch && !drag.moved) {
        // La pulsación larga ya no puede abrir el menú del sistema: al soltar sin mover, se abre el de la tarjeta.
        const path = this.pathOfCard(drag.card);
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file) this.showCardMenu(null, file, { x: drag.x, y: drag.y });
      }
      if (!drop) this.renderPending = true; // se descarta el reordenado visual
    }
    if (this.renderPending) {
      this.renderPending = false;
      this.renderRecent();
    }
  }

  // Alt + flechas: mueve un puesto la tarjeta seleccionada (←/↑ antes, →/↓ después). Devuelve true si la tecla
  // se ha consumido, es decir, si hay una tarjeta seleccionada y la búsqueda está vacía.
  moveSelectedCard(e) {
    const item = this.recentItems[this.selected];
    if (this.hasQuery || this.inputEl.value || !item?.pinPath) return false;
    e.preventDefault();
    if (this.pendingMove) return true; // el movimiento anterior aún se está guardando
    const paths = this.recentItems.filter((entry) => entry.pinPath).map((entry) => entry.pinPath);
    const from = paths.indexOf(item.pinPath);
    const to = from + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= paths.length) return true; // no da la vuelta ni pasa a Recientes
    paths.splice(to, 0, paths.splice(from, 1)[0]);
    this.pendingMove = this.commitOrder(paths, item.pinTitle, to).finally(() => { this.pendingMove = null; });
    return true;
  }

  // Guarda el orden nuevo; al repintar, la tarjeta movida sigue seleccionada y se anuncia su posición.
  async commitOrder(paths, title, index) {
    await this.plugin.reorderPinned(paths);
    this.select(index);
    this.announce(STRINGS[this.plugin.getEffectiveLanguage()].cardMoved(title, index + 1, paths.length));
  }

  announce(text) {
    this.liveEl?.setText(text);
  }

  // Menú de una tarjeta (clic derecho): abrir, abrir en pestaña nueva, color y quitar de las fijadas.
  // `at` es la posición ({ x, y }) cuando no hay un evento de ratón.
  showCardMenu(event, file, at) {
    const strings = STRINGS[this.plugin.getEffectiveLanguage()];
    const entry = this.plugin.settings.pinned.find((item) => item.path === file.path);
    const menu = new Menu();
    menu.addItem((item) => item.setTitle(strings.cardOpen).setIcon('file-text').onClick(() => this.openFile(file)));
    menu.addItem((item) => item.setTitle(strings.cardOpenNewTab).setIcon('file-plus').onClick(() => this.openFile(file, 'tab')));
    menu.addSeparator();
    menu.addItem((item) => {
      item.setTitle(strings.cardColor).setIcon('palette');
      // Sin submenús (Obsidian antiguo), los colores van directamente en el menú principal.
      const target = typeof item.setSubmenu === 'function' ? item.setSubmenu() : menu;
      for (const color of ['', ...PIN_COLORS]) {
        target.addItem((colorItem) => colorItem
          .setTitle(strings.pinColors[color || 'none'])
          .setChecked((entry?.color || '') === color)
          .onClick(() => this.plugin.setPinColor(file.path, color)));
      }
    });
    menu.addSeparator();
    menu.addItem((item) => item.setTitle(strings.unpinFromFoyer).setIcon('pin-off').onClick(() => this.plugin.unpinFile(file.path)));
    if (event) menu.showAtMouseEvent(event);
    else menu.showAtPosition(at);
  }

  // Quita del historial la fila `index` de la lista. Al repintar, la selección pasa a la fila que ocupa su lugar.
  removeRecentAt(index) {
    const path = this.recentItems[index]?.removePath;
    if (!path) return;
    const keep = this.selected;
    this.plugin.removeFromHistory(path);
    if (keep >= 0 && this.recentItems.length) this.select(Math.min(keep, this.recentItems.length - 1));
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
  // Como mucho una búsqueda por frame (o ≤ 50 ms sin requestAnimationFrame); las teclas que
  // actúan sobre los resultados la ejecutan antes con flushSearch().
  scheduleSearch() {
    if (this.pendingSearch) return;
    const run = () => {
      this.pendingSearch = null;
      this.updateResults();
    };
    if (typeof window.requestAnimationFrame === 'function') {
      const id = window.requestAnimationFrame(run);
      this.pendingSearch = { cancel: () => window.cancelAnimationFrame(id) };
    } else {
      const id = window.setTimeout(run, 50);
      this.pendingSearch = { cancel: () => window.clearTimeout(id) };
    }
  }

  cancelPendingSearch() {
    if (!this.pendingSearch) return;
    this.pendingSearch.cancel();
    this.pendingSearch = null;
  }

  flushSearch() {
    if (this.pendingSearch) this.updateResults();
  }

  invalidateSearchCache() {
    this.listedEntries = null;
    this.searchState = null;
  }

  // «Archivos excluidos» de Obsidian (API no documentada): ante cualquier fallo, el archivo cuenta como no excluido.
  isExcluded(file) {
    const cache = this.app.metadataCache;
    if (typeof cache?.isUserIgnored !== 'function') return false;
    try {
      return Boolean(cache.isUserIgnored(file.path));
    } catch (error) {
      return false;
    }
  }

  // Archivos listados (isListed ya aplicado, sin los excluidos) con su nombre visible y sus alias;
  // se reconstruye tras invalidar.
  getListedEntries() {
    if (!this.listedEntries) {
      const entries = [];
      for (const file of this.app.vault.getFiles()) {
        if (!isListed(file) || this.isExcluded(file)) continue;
        const aliases = file.extension === 'md' ? readAliases(this.app.metadataCache.getFileCache(file)?.frontmatter) : [];
        entries.push({ file, name: displayName(file), aliases });
      }
      this.listedEntries = entries;
    }
    return this.listedEntries;
  }

  // Recorre `pool` (en el orden del vault) y devuelve las mejores `limit` coincidencias, todas las
  // entradas que coinciden (candidatos de la siguiente búsqueda) y si alguna se llama (o tiene un alias)
  // exactamente `exactName`. Se prueba el nombre, luego cada alias y por último la ruta; un alias cuenta como el nombre.
  searchPool(pool, fuzzy, limit, exactName) {
    const top = [];
    const matched = [];
    let exact = false;
    for (const entry of pool) {
      let onName = true;
      let alias = null;
      let match = fuzzy(entry.name);
      if (!match) {
        for (const candidate of entry.aliases) {
          match = fuzzy(candidate);
          if (match) {
            alias = candidate;
            break;
          }
        }
      }
      if (!match) {
        onName = false;
        match = fuzzy(entry.file.path);
        if (!match) continue;
      }
      matched.push(entry);
      if (!exact && (entry.name.toLowerCase() === exactName || entry.aliases.some((a) => a.toLowerCase() === exactName))) exact = true;
      const opened = this.plugin.getLastOpened(entry.file.path) || 0;
      // Con la lista llena, solo entra quien supera estrictamente al último (los empates conservan el orden del vault).
      if (top.length >= limit && compareRank(onName, match.score, opened, entry.file.stat.mtime, top[limit - 1]) >= 0) continue;
      insertTop(top, { file: entry.file, name: entry.name, alias, onName, opened, match }, limit);
    }
    return { top, matched, exact };
  }

  updateResults() {
    this.cancelPendingSearch();
    const query = this.inputEl.value.trim();
    this.deselect(); // la selección de la lista anterior (resultados o recientes) no debe quedar marcada
    this.resultsEl.empty();
    this.items = [];
    this.selected = -1;
    this.hasQuery = query.length > 0;
    this.wrapEl.toggleClass('is-searching', this.hasQuery);
    if (!query) {
      this.searchState = null;
      this.syncAria();
      return;
    }

    // Si la consulta amplía la anterior, solo pueden coincidir los archivos que ya coincidían.
    const lowered = query.toLowerCase();
    const previous = this.searchState;
    const pool = previous && lowered.startsWith(previous.query) ? previous.pool : this.getListedEntries();
    const parsed = parseNoteInput(query);
    const { top: matches, matched, exact: sameName } = this.searchPool(
      pool,
      prepareFuzzySearch(query),
      this.plugin.settings.resultLimit,
      parsed.name.toLowerCase(),
    );
    this.searchState = { query: lowered, pool: matched };
    // Con carpetas, la coincidencia exacta es la nota en esa ruta; sin ellas, basta el nombre o un alias.
    const exact = parsed.folders.length
      ? this.findEntry(notePath(parsed.folders.join('/'), parsed.name)) instanceof TFile
      : sameName;

    for (const m of matches) {
      const el = this.resultsEl.createDiv('foyer__item');
      setIcon(el.createSpan('foyer__item-icon'), iconFor(m.file));
      const body = el.createDiv('foyer__item-body');
      const title = body.createSpan('foyer__item-title');
      const folder = folderOf(m.file);

      if (m.alias) {
        // Coincidencia por alias: se resalta el alias y debajo van el nombre real de la nota y su carpeta.
        renderMatches(title, m.alias, m.match.matches);
        body.createSpan({ cls: 'foyer__item-path', text: folder ? `${m.name} · ${folder}` : m.name });
      } else if (m.onName) {
        renderMatches(title, m.name, m.match.matches);
        if (folder) body.createSpan({ cls: 'foyer__item-path', text: folder });
      } else {
        title.setText(m.name);
        renderMatches(body.createSpan('foyer__item-path'), m.file.path, m.match.matches);
      }
      this.addItem(this.items, el, (mode) => this.openFile(m.file, mode), m.file);
    }

    if (matches.length) this.resultsEl.createDiv({ cls: 'foyer__divider', attr: { 'aria-hidden': 'true' } });

    const strings = STRINGS[this.plugin.getEffectiveLanguage()];
    const searchEl = this.actionItem('search', strings.searchContent(query), '⇧ ↵');
    this.addItem(this.items, searchEl, () => this.openGlobalSearch(query));

    if (!exact) {
      const createEl = this.actionItem('file-plus', strings.createNote(query), '');
      this.addItem(this.items, createEl, (mode) => this.createNote(query, mode));
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

  // Registra una fila como opción de `list` (resultados o recientes). Con `file`, al pasar el ratón
  // se muestra la vista previa de la nota.
  addItem(list, el, run, file) {
    const index = list.length;
    el.setAttribute('role', 'option');
    el.setAttribute('id', `${this.uid}-${list === this.items ? 'results' : 'recent'}-${index}`);
    el.setAttribute('aria-selected', 'false');
    list.push({ el, run });
    el.addEventListener('mousemove', () => { if (this.selected !== index) this.select(index); });
    el.addEventListener('click', (e) => {
      if (!this.suppressClick) run(Keymap.isModEvent(e));
    });
    el.addEventListener('auxclick', (e) => { if (e.button === 1) run('tab'); });
    if (file) {
      el.addEventListener('mouseover', (e) => {
        this.app.workspace.trigger('hover-link', {
          event: e,
          source: VIEW_TYPE,
          hoverParent: this,
          targetEl: el,
          linktext: file.path,
        });
      });
    }
  }

  // Lista sobre la que actúan las flechas y Enter: resultados con consulta, recientes sin ella.
  activeItems() {
    return this.hasQuery ? this.items : this.recentItems;
  }

  deselect() {
    const current = this.activeItems()[this.selected];
    if (!current) return;
    current.el.removeClass('is-selected');
    current.el.setAttribute('aria-selected', 'false');
  }

  select(i) {
    const list = this.activeItems();
    if (!list.length) return;
    const n = list.length;
    const next = ((i % n) + n) % n;
    this.deselect();
    this.selected = next;
    const el = list[next].el;
    el.addClass('is-selected');
    el.setAttribute('aria-selected', 'true');
    el.scrollIntoView({ block: 'nearest' });
    this.syncAria();
  }

  // Estado ARIA del combobox: qué lista controla, si hay algo desplegado y qué opción está activa.
  syncAria() {
    const list = this.activeItems();
    const listEl = this.hasQuery ? this.resultsEl : this.recentEl;
    this.inputEl.setAttribute('aria-controls', listEl.getAttribute('id'));
    this.inputEl.setAttribute('aria-expanded', list.length ? 'true' : 'false');
    const active = list[this.selected];
    if (active) this.inputEl.setAttribute('aria-activedescendant', active.el.getAttribute('id'));
    else this.inputEl.removeAttribute('aria-activedescendant');
  }

  onKeyDown(e) {
    if (e.isComposing) return;
    if (e.altKey && ARROW_KEYS.has(e.key) && this.moveSelectedCard(e)) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.flushSearch();
        this.select(this.selected + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.flushSearch();
        this.select(this.selected < 0 ? -1 : this.selected - 1); // sin selección, sube a la última fila
        break;
      case 'Enter': {
        e.preventDefault();
        const query = this.inputEl.value.trim();
        if (!query) {
          // Sin consulta, Enter abre la fila seleccionada de «Recientes» (si hay una).
          this.flushSearch();
          if (!this.hasQuery) this.recentItems[this.selected]?.run(Keymap.isModEvent(e));
          return;
        }
        if (e.shiftKey) {
          this.openGlobalSearch(query);
          return;
        }
        this.flushSearch(); // la búsqueda pendiente se resuelve antes de elegir
        const item = this.items[this.selected];
        if (item) item.run(Keymap.isModEvent(e));
        break;
      }
      case 'Delete':
        // Con la búsqueda vacía, Supr quita de Recientes la fila seleccionada (las fijadas no se quitan así).
        if (this.inputEl.value || !this.recentItems[this.selected]?.removePath) break;
        e.preventDefault();
        this.removeRecentAt(this.selected);
        break;
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

  // Archivo o carpeta en `path`; sin distinguir mayúsculas si la API de Obsidian lo ofrece.
  findEntry(path) {
    const vault = this.app.vault;
    const exact = vault.getAbstractFileByPath(path);
    if (exact || typeof vault.getAbstractFileByPathInsensitive !== 'function') return exact;
    return vault.getAbstractFileByPathInsensitive(path);
  }

  // Crea las carpetas que falten y devuelve la ruta real de la última. Una carpeta existente se reutiliza
  // con su mayúscula real, para no crear un duplicado que solo cambie de casing.
  async ensureFolders(folders) {
    let current = '';
    for (const part of folders) {
      const wanted = current ? `${current}/${part}` : part;
      const existing = this.findEntry(wanted);
      if (existing) {
        current = existing.path;
      } else {
        await this.app.vault.createFolder(wanted);
        current = wanted;
      }
    }
    return current;
  }

  async createNote(name, mode) {
    const { folders, name: clean } = parseNoteInput(name);
    if (!clean) return;
    try {
      let folder;
      if (folders.length) {
        // Con carpetas, la ruta es relativa a la raíz del vault; se crean las que falten.
        folder = await this.ensureFolders(folders);
      } else {
        // Respeta «Ubicación por defecto para notas nuevas» de Obsidian.
        const parent = this.app.fileManager.getNewFileParent(this.app.workspace.getActiveFile()?.path ?? '');
        folder = parent && !parent.isRoot() ? parent.path : '';
      }
      const path = notePath(folder, clean);
      const existing = this.findEntry(path);
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

    new Setting(containerEl)
      .setName(strings.settingsOpenOnStartup)
      .setDesc(strings.settingsOpenOnStartupDescription)
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.openOnStartup)
        .onChange((value) => this.plugin.updateSetting('openOnStartup', value)));

    new Setting(containerEl)
      .setName(strings.settingsReplaceNewTab)
      .setDesc(strings.settingsReplaceNewTabDescription)
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.replaceNewTab)
        .onChange((value) => this.plugin.updateSetting('replaceNewTab', value)));

    // Los deslizadores llaman a onChange en cada paso del arrastre: se guarda una vez, con el último valor (300 ms sin cambios).
    const saveRecentLimit = debounce((value) => this.plugin.updateSetting('recentLimit', value), 300, true);
    const saveResultLimit = debounce((value) => this.plugin.updateSetting('resultLimit', value), 300, true);

    new Setting(containerEl)
      .setName(strings.settingsRecentLimit)
      .setDesc(strings.settingsRecentLimitDescription)
      .addSlider((slider) => slider
        .setLimits(LIMIT_MIN, LIMIT_MAX, 1)
        .setValue(this.plugin.settings.recentLimit)
        .setDynamicTooltip()
        .onChange((value) => saveRecentLimit(value)));

    new Setting(containerEl)
      .setName(strings.settingsResultLimit)
      .setDesc(strings.settingsResultLimitDescription)
      .addSlider((slider) => slider
        .setLimits(LIMIT_MIN, LIMIT_MAX, 1)
        .setValue(this.plugin.settings.resultLimit)
        .setDynamicTooltip()
        .onChange((value) => saveResultLimit(value)));

    new Setting(containerEl)
      .setName(strings.settingsClearHistory)
      .setDesc(strings.settingsClearHistoryDescription)
      .addButton((button) => button
        .setButtonText(strings.clearHistoryButton)
        .onClick(() => this.plugin.clearHistory()));

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
    // El historial se guarda en el almacenamiento local del dispositivo, no en data.json.
    this.saveHistorySoon = debounce(() => saveOpenHistory(this.app, this.openHistory), 2000, true);
    this.register(() => this.saveHistorySoon.run?.());

    // Notas que el usuario quitó de «Recientes» y que el respaldo de Obsidian no debe volver a mostrar (solo en memoria).
    this.dismissedRecent = new Set();

    // Historial de aperturas: se registra antes que la vista para que ya esté al día al renderizar.
    const ws = this.app.workspace;
    this.registerEvent(ws.on('file-open', (file) => {
      if (!(file instanceof TFile)) return;
      this.dismissedRecent.delete(file.path);
      recordOpen(this.openHistory, file.path, Date.now());
      this.saveHistorySoon();
    }));
    this.registerEvent(this.app.vault.on('rename', async (file, oldPath) => {
      if (renameInHistory(this.openHistory, oldPath, file.path)) this.saveHistorySoon();
      const pinned = renameInPinned(this.settings.pinned, oldPath, file.path);
      if (pinned) await this.updateSetting('pinned', pinned);
    }));
    this.registerEvent(this.app.vault.on('delete', async (file) => {
      if (deleteFromHistory(this.openHistory, file.path)) this.saveHistorySoon();
      const pinned = deleteFromPinned(this.settings.pinned, file.path);
      if (pinned) await this.updateSetting('pinned', pinned);
    }));

    this.registerView(VIEW_TYPE, (leaf) => new HomeView(leaf, this));
    this.registerHoverLinkSource(VIEW_TYPE, { display: 'Foyer', defaultMod: true });

    this.addSettingTab(new HomeSettingTab(this.app, this));

    this.addRibbonIcon('home', STRINGS[this.getEffectiveLanguage()].openHome, () => this.openHome());
    this.addCommand({ id: 'open', name: STRINGS[this.getEffectiveLanguage()].openHome, callback: () => this.openHome() });
    // Cada comando de fijado solo aparece cuando se puede aplicar a la nota activa.
    const pinCommand = (id, name, applies, run) => this.addCommand({
      id,
      name,
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (!isListed(file) || !applies(this.isPinned(file.path))) return false;
        if (!checking) run(file.path);
        return true;
      },
    });
    const strings = STRINGS[this.getEffectiveLanguage()];
    pinCommand('pin-current', strings.commandPinCurrent, (pinned) => !pinned, (path) => this.pinFile(path));
    pinCommand('unpin-current', strings.commandUnpinCurrent, (pinned) => pinned, (path) => this.unpinFile(path));
    this.addCommand({ id: 'clear-history', name: strings.commandClearHistory, callback: () => this.clearHistory() });
    this.addCommand({ id: 'focus-search', name: strings.commandFocusSearch, callback: () => this.focusSearch() });
    this.addCommand({ id: 'open-new-tab', name: strings.commandOpenNewTab, callback: () => this.openHomeInNewTab() });
    // Menú contextual de archivos: una sola entrada, para fijar o para quitar.
    this.registerEvent(ws.on('file-menu', (menu, file) => {
      if (!isListed(file)) return;
      const pinned = this.isPinned(file.path);
      const current = STRINGS[this.getEffectiveLanguage()];
      menu.addItem((item) => item
        .setTitle(pinned ? current.unpinFromFoyer : current.pinToFoyer)
        .setIcon(pinned ? 'pin-off' : 'pin')
        .onClick(() => (pinned ? this.unpinFile(file.path) : this.pinFile(file.path))));
    }));

    this.app.workspace.onLayoutReady(async () => {
      // El archivo activo restaurado al arrancar cuenta como abierto ahora.
      const active = ws.getActiveFile();
      if (active instanceof TFile) {
        recordOpen(this.openHistory, active.path, Date.now());
        this.saveHistorySoon();
      }
      if (this.settings.openOnStartup) await this.openHome();
      // El manejador se registra una sola vez; scheduleReplace respeta el ajuste en cada llamada.
      this.registerEvent(this.app.workspace.on('layout-change', () => this.scheduleReplace()));
      this.register(() => window.clearTimeout(this.replaceTimer));
      this.scheduleReplace();
    });
  }

  getLastOpened(path) {
    return this.openHistory[path] || null;
  }

  getEffectiveLanguage() {
    return resolveLanguage(this.settings.language, getLanguage());
  }

  // Vuelve a pintar cada vista de Foyer abierta, conservando su búsqueda.
  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) leaf.view?.refreshSettings?.();
  }

  // Quita una nota de «Recientes» (solo la entrada del historial de este dispositivo, nunca el archivo).
  removeFromHistory(path) {
    const had = path in this.openHistory;
    delete this.openHistory[path];
    this.dismissedRecent.add(path);
    if (had) this.saveHistorySoon();
    this.refreshViews();
    return had;
  }

  // Vacía «Recientes» en este dispositivo. Las notas fijadas y los archivos no se tocan.
  clearHistory() {
    for (const path of this.app.workspace.getLastOpenFiles?.() ?? []) this.dismissedRecent.add(path);
    for (const path of Object.keys(this.openHistory)) delete this.openHistory[path];
    saveOpenHistory(this.app, this.openHistory);
    new Notice(STRINGS[this.getEffectiveLanguage()].historyCleared);
    this.refreshViews();
  }

  isPinned(path) {
    return this.settings.pinned.some((entry) => entry.path === path);
  }

  async pinFile(path) {
    if (this.isPinned(path)) return;
    await this.updateSetting('pinned', [...this.settings.pinned, { path, color: '' }]);
  }

  async unpinFile(path) {
    if (!this.isPinned(path)) return;
    await this.updateSetting('pinned', this.settings.pinned.filter((entry) => entry.path !== path));
  }

  // Color de una nota fijada: uno de PIN_COLORS o '' (sin color). Lo demás se ignora.
  async setPinColor(path, color) {
    if (color !== '' && !PIN_COLORS.includes(color)) return;
    const entry = this.settings.pinned.find((item) => item.path === path);
    if (!entry || entry.color === color) return;
    await this.updateSetting('pinned', this.settings.pinned.map((item) => (item === entry ? { ...item, color } : item)));
  }

  // Guarda el orden nuevo de las fijadas (ver reorderPinned). Solo se guarda el orden, no posiciones.
  async reorderPinned(order) {
    const pinned = reorderPinned(this.settings.pinned, order);
    if (pinned) await this.updateSetting('pinned', pinned);
  }

  async updateSetting(key, value) {
    await saveSettingAndRefresh(this, key, value);
    if (key === 'replaceNewTab') this.scheduleReplace();
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

  // Pone el cursor en la búsqueda de Foyer; si Foyer no es la vista activa, la abre o la trae al frente antes.
  async focusSearch() {
    const ws = this.app.workspace;
    if (!ws.getActiveViewOfType(HomeView)) await this.openHome();
    ws.getActiveViewOfType(HomeView)?.inputEl?.focus();
  }

  // Abre otro Foyer en una pestaña nueva, aunque ya haya uno abierto (openHome reutiliza el existente).
  async openHomeInNewTab() {
    const ws = this.app.workspace;
    const leaf = ws.getLeaf('tab');
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    await ws.revealLeaf(leaf);
    ws.setActiveLeaf(leaf, { focus: true });
  }

  // Convierte la pestaña vacía activa ("Nueva pestaña") en el inicio.
  // Con retardo y re-comprobación para no pisar archivos que se están abriendo.
  // Con el ajuste desactivado cancela cualquier conversión pendiente y no programa otra.
  scheduleReplace() {
    window.clearTimeout(this.replaceTimer);
    if (!this.settings.replaceNewTab) return;
    this.replaceTimer = window.setTimeout(() => {
      if (!this.settings.replaceNewTab) return;
      const ws = this.app.workspace;
      const leaf = ws.getMostRecentLeaf(ws.rootSplit);
      if (leaf && leaf.view?.getViewType() === 'empty') {
        leaf.setViewState({ type: VIEW_TYPE });
      }
    }, 120);
  }
};
