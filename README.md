# Dino Lab

A Windows desktop companion for **The Isle: EVRIMA**, built with Tauri 2, React and TypeScript. Species data and artwork are bundled locally; no web server or account is needed to use the app.

## Download

Get **[Dino Lab 0.1.10](https://github.com/Chucksterboy/dino-lab/releases/tag/v0.1.10)**:

- **[Windows installer](https://github.com/Chucksterboy/dino-lab/releases/download/v0.1.10/Dino-Lab-0.1.10-Windows-Setup.exe)** — install Dino Lab on your computer.
- **[Portable application](https://github.com/Chucksterboy/dino-lab/releases/download/v0.1.10/Dino-Lab-0.1.10-Windows-Portable.exe)** — run the executable directly.

## Features

- Profiles and artwork for 22 playable species, plus eight wildlife entries.
- Independent **Source 1 / Source 2** growth selections and **Prime / Frail** conditions.
- Growth charts, movement statistics, survival timers and attack analysis.
- Comparisons with up to six specimens, including different life stages of the same species.
- A sortable statistics table with independent source and growth settings for each row.
- A searchable catalog of 41 active mutations, grouped as Universal, Carnivore and Herbivore, with unlock requirements.
- Independent mutation scenarios for both combatants, including eligible damage bonuses, conditional resistance, starting health and bleeding.
- Continuous animated navigation, a bubbling laboratory flask and reduced-motion preferences.
- Favorites and saved comparison/table settings stored on your device.
- A GitHub version checker that links to new stable releases.

The opening animation lasts 3.5 seconds. **Ctrl K** opens species search, keyboard arrows adjust sliders, and Escape closes preferences.

**Minimize on close** is enabled by default: X and Alt+F4 send Dino Lab to the Windows tray. Click its tray icon or reopen the shortcut to restore it. Use **tray → Exit Dino Lab** to quit, or turn off Minimize on close in Preferences.

## Data and calculation model

Source 1 uses recorded dashboard growth rows from 25–100% for 21 playable species. Source 2 uses exact workbook keyframes from hatchling onward for all 22 workbook species. The two sources remain independent; intermediate values are not invented or averaged.

Attack counts are body-hit estimates. Selected mutation conditions and stacking assumptions affect the estimate; a complete fight, bleed damage over time, armor and changing conditions are outside the model. See [the numeric audit](docs/NUMERIC-AUDIT.md), [mutation sources](docs/MUTATIONS-SOURCES.md) and [the combat model](docs/MUTATION-COMBAT-MODEL.md).

Captured source records, formulas and source credits are preserved in the repository. The active app hides BabyBoar, BabyDeer and BabyGoat; adult wildlife remains available.

## Sources and credits

- [Species statistics dashboard](https://theisle-speciesdatadashboard.pages.dev/)
- [Species stat workbook](https://docs.google.com/spreadsheets/d/15aOvzrA6Wf5SORil4CQdplKLr6wsSGTE7uGitZlSDGM/edit)
- [Evrima Quick Guide mutations](https://www.evrimaquickguide.com/gameplay/health-statuses/mutations)
- Species artwork: Evrima Field Guide; per-image references are retained in [the artwork manifest](src/art-manifest.json).

Dino Lab is an independent fan companion for The Isle: EVRIMA.

## Development

On Windows, install Node.js, Rust, Microsoft C++ Build Tools and WebView2, then run:

```powershell
npm ci
npm run tauri dev
```

Validation and production packaging:

```powershell
npm test
npm run tauri -- build --features custom-protocol
```

The Tauri build validates and stages Vite output into an isolated `desktop-dist` snapshot. Do not mutate that folder during a native build. Generated binaries and local build/preview outputs are excluded from Git; Windows downloads are attached to Releases.

The browser development preview is available through `npm run dev` at `http://127.0.0.1:1420`.

## Releases and update checks

The app uses stable Releases from **[Chucksterboy/dino-lab](https://github.com/Chucksterboy/dino-lab)**. Newer published versions appear in the Updates dialog; checks require no GitHub sign-in. Downloads are opened in the browser and updates are installed manually.

See [the publishing guide](docs/UPDATES.md) and [Windows build verification](docs/NATIVE-VERIFICATION.md).
