# Readability and control-removal verification

2026-10-28T01:40:25.645Z

Isolated headless Microsoft Edge contexts at 1440×960 and 1100×760. **689 checks passed; 0 failed.**

Checks cover all 22 playable profiles and their four information tabs, a wildlife profile, comparison, tables, scatter and preferences. They verify removal of export/import/download/copy/configuration/file-input controls and the global Data & sources navigation/footer link. Mechanics and Source data tabs, the Field mechanics overview card and the entire species footer are absent. Source 1/2 selectors and the Movement at a glance card remain. Rendered body text, title/aria-label attributes and SVG tooltips were scanned across the four tabs, comparison, table/bulk menu and scatter; no original provider names remain. Every one of the 22 table-row source menus and the bulk menu uses Source 1/2 labels. Applying Source 2 updated all 22 rows, and scatter captions/accessibility names were checked in both source modes.

The script measures brand/logo size and representative text sizes, outer document/main-pane horizontal overflow and clipped controls/gallery names. Inner data tables are deliberately allowed their own horizontal scrolling. This verifies layout geometry and computed styles, not subjective visual quality or native animation frame pacing.

All focused acceptance checks passed.

Full measurements: [readability-verification-results.json](readability-verification-results.json).
