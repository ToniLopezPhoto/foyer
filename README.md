<p align="center">
  <img src="assets/foyer-banner.svg" alt="Foyer — A quieter way into Obsidian" width="100%">
</p>

<p align="center">
  <strong>Your notes, one quiet starting point.</strong><br>
  A minimal, personal home screen for <a href="https://obsidian.md/">Obsidian</a>.
  Open a new tab, find what matters, and pick up where you left off.
</p>

<p align="center">
  <a href="https://github.com/ToniLopezPhoto/foyer/releases/latest">Download</a>
  &nbsp;·&nbsp;
  <a href="#installation">Installation</a>
  &nbsp;·&nbsp;
  <a href="#features">Features</a>
  &nbsp;·&nbsp;
  <a href="#español">Español</a>
</p>

<p align="center">
  <a href="https://github.com/ToniLopezPhoto/foyer/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/ToniLopezPhoto/foyer?style=flat-square&color=77717e"></a>
  <img alt="Obsidian 1.8.7 or newer" src="https://img.shields.io/badge/Obsidian-1.8.7%2B-77717e?style=flat-square">
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-77717e?style=flat-square"></a>
</p>

---

Most start pages want to be a dashboard. **Foyer is simply a place to begin.**

It replaces Obsidian's empty new tabs with a welcoming space that feels like a natural part of your vault. There are no widgets to configure, no feeds to follow, and no extra services to connect: just search, recently opened notes, and a little room to breathe.

<p align="center">
  <img src="assets/foyer-preview.svg" alt="Illustrative Foyer interface showing search, greeting and recent notes in dark and light themes" width="100%">
</p>
<p align="center"><sub>Interface illustration, not an application screenshot. Foyer inherits the colors and typography of your active Obsidian theme.</sub></p>

## Features

### Find a thought, instantly

Search note titles and file paths with fuzzy matching. Use the keyboard to move between matches, open a note, search within content, or create a new note directly from a query.

### Continue where you left off

Your recent notes reflect **when you actually opened them**, not when they were last edited. Relative timestamps stay fresh while Foyer is open, and history follows notes when you rename or move them.

### Make the space yours

A greeting changes with the time of day and can include your name. Add a personal image from your vault or upload one from your computer; leave it unset for a small accent-colored symbol instead.

### Fit right into Obsidian

Foyer uses the active theme's colors and typography, works in light and dark modes, and supports English and Spanish. It opens at startup and fills otherwise empty new tabs. Desktop and mobile are supported.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `↑` / `↓` | Move through search results |
| `Enter` | Open the selected note |
| `Ctrl/Cmd + Enter` | Open in a new tab |
| `Shift + Enter` | Search note content with Obsidian's core Search plugin |

If your query does not match an existing note, Foyer also offers to create it in your vault's configured default location for new notes.

## Installation

Foyer requires **Obsidian 1.8.7 or newer**.

### Using BRAT

The simplest way to try Foyer while it is not yet available in the Community Plugins directory:

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Obsidian's Community Plugins.
2. Run **BRAT: Add a beta plugin for testing** from the command palette.
3. Enter `ToniLopezPhoto/foyer`.
4. Enable **Foyer** in **Settings → Community plugins**.

### Manual installation

1. Open the [latest release](https://github.com/ToniLopezPhoto/foyer/releases/latest).
2. Download `main.js`, `manifest.json`, and `styles.css`.
3. Create the folder `.obsidian/plugins/foyer/` inside your vault.
4. Place the three files in that folder, reload Obsidian, and enable **Foyer** in Community plugins.

### Community Plugins directory

A directory listing is planned. Until Foyer is accepted, install it using BRAT or manually.

## Personalization

Open **Settings → Community plugins → Foyer** to adjust:

| Setting | What it does |
| --- | --- |
| Greeting name | Adds your name to the greeting; optional |
| Language | Follows Obsidian automatically, or uses English or Spanish |
| Hero image | Selects an existing vault image or imports one into your attachments folder |

The hero image supports PNG, JPEG, GIF, WebP, AVIF, and BMP. Its position is shown in the settings preview. Without an image, Foyer displays a subtle symbol in your theme's accent color.

## Privacy, by design

Foyer runs locally. It makes no network requests, includes no analytics, and does not send your notes or preferences anywhere.

Settings and a small, local last-opened history (up to 200 entries) are saved in `.obsidian/plugins/foyer/data.json` inside your vault. Images you import stay in your vault as well.

## Development and contributions

Foyer is intentionally lightweight: plain JavaScript and CSS, with no build step or runtime dependencies beyond Obsidian.

```bash
# From your test vault
git clone https://github.com/ToniLopezPhoto/foyer.git .obsidian/plugins/foyer

# Check JavaScript syntax
node --check .obsidian/plugins/foyer/main.js
```

After changing the plugin, reload it in Obsidian to test. Please keep contributions dependency-free and theme-native, using Obsidian's CSS variables for appearance.

Issues, bug reports, and pull requests are welcome via [GitHub Issues](https://github.com/ToniLopezPhoto/foyer/issues).

---

## Español

**Foyer** es una página de inicio minimalista para Obsidian. Sustituye las pestañas vacías por un espacio personal desde el que puedes buscar tus notas y retomar tu trabajo sin distracciones.

- **Búsqueda rápida:** encuentra notas por nombre o ruta, navega con el teclado y crea notas nuevas cuando lo necesites.
- **Recientes de verdad:** muestra las notas que has abierto, con tiempos relativos independientes de la última modificación del archivo.
- **Un inicio personal:** saludo según la hora del día, nombre opcional e imagen de cabecera a tu elección.
- **Integración natural:** hereda colores y tipografías del tema de Obsidian, funciona en escritorio y móvil, y no necesita conexión a Internet.

**Instalación:** utiliza [BRAT](https://github.com/TfTHacker/obsidian42-brat) e introduce `ToniLopezPhoto/foyer`, o descarga `main.js`, `manifest.json` y `styles.css` de la [última versión](https://github.com/ToniLopezPhoto/foyer/releases/latest) y colócalos en `.obsidian/plugins/foyer/`.

Los ajustes y el historial de apertura se almacenan únicamente en tu vault. Foyer no recopila telemetría ni envía datos a servicios externos.

## License

Foyer is released under the [MIT License](LICENSE). Created by [Toni López](https://github.com/ToniLopezPhoto).
