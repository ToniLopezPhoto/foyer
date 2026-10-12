# Lab Home

A minimal, theme-native home page for [Obsidian](https://obsidian.md).
Open it on startup or in every new tab and get straight to your notes: a fuzzy search bar, your recently opened notes and a personal greeting.

> 🇪🇸 [Resumen en español](#español) más abajo.

## Features

- **Fuzzy search** over note names and paths, with keyboard navigation.
  - `↵` open · `Ctrl/⌘ ↵` open in a new tab · `⇧ ↵` search in note contents (core *Search* plugin).
  - If no note matches exactly, create it right away (it goes to your *Default location for new notes*).
- **Recent notes** with the real *last opened* time ("5 minutes ago"), kept up to date while the page is open and preserved across renames and moves.
- **Greeting** that changes with the time of day, optionally with your name.
- **Hero image**: pick one from your vault or upload it from your computer (it is copied into your attachments folder). Without an image, a small spark in your accent color is shown.
- **English and Spanish** UI, following Obsidian's language or set manually.
- **Theme-native**: all styling comes from your theme's CSS variables, so it works in light and dark mode and with any theme.
- Opens on startup and replaces empty *New tab* pages.

## Settings

| Setting | Description |
| --- | --- |
| Greeting name | Name shown after the greeting. Leave it blank for no name. |
| Language | Automatic (Obsidian's language), Español or English. |
| Hero image | Upload from your computer or choose from the vault (PNG, JPEG, GIF, WebP, AVIF, BMP). The settings page shows a live preview of where it appears. |

## Installation

### From the community plugins directory

*Coming soon.* Once published: **Settings → Community plugins → Browse**, search for **Lab Home**, install and enable.

### With BRAT (beta)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat).
2. Run **BRAT: Add a beta plugin for testing** and paste `ToniLopezPhoto/lab-home-obsidian`.
3. Enable **Lab Home** in **Settings → Community plugins**.

### Manual

1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/ToniLopezPhoto/lab-home-obsidian/releases/latest).
2. Copy them to `<your vault>/.obsidian/plugins/lab-home/`.
3. Reload Obsidian and enable **Lab Home** in **Settings → Community plugins**.

Requires Obsidian **1.8.7** or newer. Works on desktop and mobile.

## Privacy

Lab Home works completely offline. It makes no network requests and collects no telemetry.
It stores your settings and a local history of when you opened each note (path + timestamp, at most 200 entries) in `.obsidian/plugins/lab-home/data.json` inside your vault. Nothing leaves your device.

## Development

The plugin is plain JavaScript with no build step: `main.js` is the source.

1. Clone this repo into `<test vault>/.obsidian/plugins/lab-home/` (or copy the three files there).
2. Edit `main.js` / `styles.css` and reload the plugin (disable/enable it, or use the *Hot Reload* plugin).
3. `node --check main.js` catches syntax errors.

### Releasing

1. Bump `version` in `manifest.json` and add it to `versions.json` (`"<version>": "<minAppVersion>"`).
2. Commit, then tag with the exact version (no `v` prefix) and push the tag:
   ```sh
   git tag 1.0.1 && git push origin 1.0.1
   ```
3. GitHub Actions creates a **draft** release with `main.js`, `manifest.json` and `styles.css`. Review it and publish.

## Contributing

Issues and pull requests are welcome. Please keep the plugin dependency-free and theme-native (use Obsidian CSS variables, not hardcoded colors).

## License

[MIT](LICENSE) © Toni López

---

## Español

**Lab Home** es una página de inicio minimalista para Obsidian: barra de búsqueda difusa, notas abiertas recientemente (con la hora real de la última apertura), saludo según la hora del día con tu nombre, e imagen principal que puedes elegir del vault o subir desde tu equipo. La interfaz está en español e inglés y hereda los colores y la tipografía de tu tema.

Instalación manual: copia `main.js`, `manifest.json` y `styles.css` de la [última versión](https://github.com/ToniLopezPhoto/lab-home-obsidian/releases/latest) en `<tu vault>/.obsidian/plugins/lab-home/` y actívalo en **Ajustes → Plugins de la comunidad**.

Funciona sin conexión y no envía datos a ningún sitio; solo guarda tus ajustes y el historial de aperturas en `data.json` dentro de tu vault.
