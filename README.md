# Foyer

<p align="center">
  <img src="https://raw.githubusercontent.com/ToniLopezPhoto/foyer/main/manifest.json" width="0" height="0" alt="" />
  <em>A beautiful, minimal start page for your notes.</em>
</p>

<p align="center">
  <a href="https://github.com/ToniLopezPhoto/foyer/releases/latest"><img src="https://img.shields.io/github/v/release/ToniLopezPhoto/foyer?color=7c3aed&label=Release&style=flat-square" alt="Latest Release"></a>
  <a href="https://github.com/obsidianmd/obsidian-releases"><img src="https://img.shields.io/badge/Obsidian-%E2%89%A5%201.8.7-purple?style=flat-square" alt="Obsidian Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="License"></a>
  <a href="#español"><img src="https://img.shields.io/badge/Idioma-ES%20%2F%20EN-emerald?style=flat-square" alt="Languages"></a>
</p>

---

**Foyer** transforms your new tabs and vault startup into an inviting, distraction-free foyer. Search instantly across your entire vault, pick up right where you left off with accurate last-opened tracking, and greet each session with warmth and focus.

> 🇪🇸 **[Leer resumen en español](#español)**

---

## ✨ Features

- 🔍 **Instant Fuzzy Search**
  Search titles and relative paths seamlessly with keyboard-first ergonomics.
  - `↵` to open immediately.
  - `Ctrl` / `Cmd` + `↵` to open in a new split tab.
  - `Shift` + `↵` to launch core full-text search across content.
  - Quick note creation when no exact title exists (honors your vault’s *Default location for new notes*).

- 🕒 **True Recent History**
  Tracks when you *actually opened* your notes (not just when they were last modified on disk).
  - Relative live timestamps (*"5 minutes ago"*).
  - Automatically updates every 30 seconds while open.
  - Intelligently survives file renames, folder moves, and deletions.

- 🌅 **Adaptive Greeting & Time-of-Day Context**
  Dynamic greetings tailored to morning, afternoon, or evening, with an optional customizable user name and localized calendar dates.

- 🖼️ **Hero Image or Ambient Accent Spark**
  - **Upload from Computer**: Select any image from your computer; Foyer imports it safely into your vault's attachment directory.
  - **Vault Picker**: Choose an existing image within your notes.
  - Supports PNG, JPEG, GIF, WebP, AVIF, and BMP.
  - Interactive live preview & layout infographic right inside settings.
  - Fallback to an elegant theme-accented geometric spark when no image is selected.

- 🎨 **100% Theme-Native**
  Constructed strictly with Obsidian CSS variables. Inherits typography, contrast levels, and accents effortlessly across Light/Dark modes and custom themes (Minimal, AnuPpuccin, etc.).

---

## 🛠️ Settings & Customization

| Option | Description |
| :--- | :--- |
| **Greeting Name** | Displayed alongside the greeting (e.g. *"Good morning, Toni"*). Leave empty for clean impersonal greetings. |
| **Language** | Choose between `Automatic (Obsidian)`, `Español`, or `English`. |
| **Hero Image** | Upload directly or choose from vault. An intuitive visual miniature mock-up illustrates how it renders on your homepage. |

---

## 📦 Installation

### Option 1: Community Plugins (*Pending submission*)
Once accepted into the Obsidian Community Plugins directory:
1. Open **Obsidian Settings** → **Community plugins**.
2. Turn off *Restricted mode*.
3. Click **Browse** and search for **Foyer**.
4. Click **Install**, then **Enable**.

### Option 2: Via BRAT (Testing & Instant Updates)
1. Install the [Obsidian42 - BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.
2. In Obsidian, open the command palette (`Ctrl/Cmd + P`) and run:
   ```text
   BRAT: Add a beta plugin for testing
   ```
3. Enter repository URL: `ToniLopezPhoto/foyer`
4. Confirm installation, then enable **Foyer** in **Community plugins**.

### Option 3: Manual Installation
1. Go to the [Latest Release](https://github.com/ToniLopezPhoto/foyer/releases/latest).
2. Download `main.js`, `manifest.json`, and `styles.css`.
3. Create a folder named `foyer` in your vault at `.obsidian/plugins/foyer/`.
4. Place the downloaded files into that directory.
5. Reload Obsidian and toggle **Foyer** on in **Community plugins**.

> **Compatibility**: Requires Obsidian `v1.8.7` or higher. Fully compatible with Desktop & Mobile.

---

## 🔒 Privacy & Local Philosophy

Foyer is proudly local-first:
- **Zero Network Traffic**: No external requests, telemetry, or third-party analytics.
- **Local Storage**: Preferences and open timestamps are maintained strictly inside your local `.obsidian/plugins/foyer/data.json`.
- **Vault Security**: Uploaded images stay entirely within your local vault storage.

---

## 💻 Development

Foyer is cleanly architected in modern Vanilla JavaScript and CSS with no heavy compilation dependencies.

```bash
# Clone directly into your test vault
git clone https://github.com/ToniLopezPhoto/foyer.git .obsidian/plugins/foyer

# Validate syntax
node --check main.js
```

### Creating Releases
1. Bump `"version"` in `manifest.json` and append to `versions.json`.
2. Commit and push a tag matching the version string:
   ```bash
   git tag 1.0.0
   git push origin 1.0.0
   ```
3. GitHub Actions builds the verified draft release with release assets ready for publishing.

---

## 🇪🇸 Español

**Foyer** es una página de inicio minimalista, elegante y nativa para Obsidian:
- ⚡ **Búsqueda difusa ultrarrápida**: Navegación ágil por teclado (`↵` abrir, `Ctrl/Cmd + ↵` nueva pestaña, `Shift + ↵` búsqueda global).
- 🕒 **Historial real de notas recientes**: Muestra cuándo abriste una nota por última vez (no solo cuándo se editó el archivo), adaptándose a cambios de nombre y carpetas.
- 🌅 **Saludo contextual**: Se adapta a la hora del día (mañana, tarde, noche) con tu nombre opcional y fecha en tu idioma.
- 🖼️ **Imagen de cabecera**: Sube una foto desde tu ordenador con un solo clic o elígela de tu vault, con previsualización maquetada en ajustes.
- 🎨 **100% integrado**: Utiliza exclusivamente las variables CSS de Obsidian, luciendo perfecto en cualquier tema (modo claro u oscuro).

---

## 📄 License

Distributed under the [MIT License](LICENSE).  
Created with care by [Toni López](https://github.com/ToniLopezPhoto).
