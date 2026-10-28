# Source 1 dashboard numeric audit

Audited 2026-10-28T14:47:34.739Z. This is an independent comparison with the public [Species Dashboard](https://theisle-speciesdatadashboard.pages.dev/) and its current published CSV endpoints, not a claim that every source value matches the game. Downloaded HTML was parsed as data and was not executed. App data and the running app were not changed.

## Coverage

| Check | Coverage |
|---|---:|
| Gamedata records | 3,214 |
| Playable species / wildlife species | 21 / 11 |
| Playable growth/state points (25–100, Prime/Frail) | 3,192 |
| Fixed wildlife/state points | 22 |
| Original Gamedata columns / normalized metrics | 47 / 33 |
| Source snapshot cell comparisons, including mechanics | 151,826 |
| Exact normalized raw Gamedata cell comparisons | 151,058 |
| Normalized numeric-or-null comparisons | 106,062 |
| Non-null / null metric checks | 93,052 / 13,010 |
| Sample identity, flag and kind comparisons | 16,070 |
| Mechanics rows | 96 |
| Mechanics raw cell / normalized field checks | 768 / 768 |
| Metric mapping/unit/group checks | 99 |
| Current-versus-preserved rule declarations | 33 |

CSV parsing uses Python's standard-library reader, independently of the application's JavaScript importer. Values are keyed by species, condition and recorded growth; every metric is checked against a separately declared expected source-column map. Empty cells remain null, and source strings, original numbers, rounded headline columns, flags and aliases are checked separately.

## Results

- Fresh source changes versus preserved CSV: **0**.
- Import/mapping discrepancies against the preserved source: **0**.
- Source schema, cardinality or coverage anomalies: **1**.
- CSV row-width anomalies: **0**.
- Changed or missing focused rule declarations: **0**.

The fresh CSV records match the preserved snapshots cell for cell.
Every checked normalized number, null, flag, source string and mechanic matches its preserved source.
All focused calculation/data-rule declarations match the preserved dashboard after conservative whitespace/comment normalization.

The 22nd playable entry, Hypsilophodon, is workbook-only and correctly has no Source 1 samples. Beipiosaurus retains Beipiaosaurus as an explicit cross-source alias. Wildlife uses explicit source HP and absolute attacks; absent attacks remain unknown.

The source variance is Boar's unrounded SprintSpeed (KM/h): **21.6** in Prime and **21.589** in Frail. Both rounded R Speed (KM/h) entries are **21.6**. Dino Lab preserves these values exactly. This is inherited source data requiring source-owner confirmation, not an importer discrepancy; no number was silently replaced.

The fresh and preserved complete HTML hashes also match, so no website calculation-rule change was found. This includes documented nearest-row selection, source peaks/sanctuary flags, body-hit arithmetic, growth-scaled sprint duration, unscaled swim durations, blood-scaled stamina recovery, food/water-to-empty timers and the existing uncertainty qualifications.

## Rounded versus original source numbers

| Metric | Rows where source rounded/original differ | Largest absolute difference |
|---|---:|---:|
| growth | 0 | 0 |
| weight | 1,348 | 0.5 |
| bite | 2,572 | 0.05 |
| speed | 2,975 | 0.05 |

Those differences are source-defined, not discrepancies to repair by substituting original columns. Dashboard headline values use R Growth, R Weight, R Biteforce and R Speed. All original columns remain preserved.

## Evidence and limits

Fresh HTML/CSV files, request timestamps, hashes, per-species growth/peak/sanctuary coverage, wildlife numbers and every concrete issue are in the ignored folder `test-results/numeric-audit/dashboard/`; `report.json` is the detailed result. Reproduce with `node tools/audit-dashboard.mjs`, or use `--offline` to compare the saved audit snapshot again. Focused rule text comparison is conservative, not a proof of semantic equivalence or of game correctness.

Source URLs: [Gamedata CSV](https://docs.google.com/spreadsheets/d/e/2PACX-1vTOR_zO2ZMBY8oVfxRZL2qE21877cCts1Ujt2QCgP3ff9wSutZ99xnlXbpECmTLR5aC-ACNFALnztnD/pub?gid=574193446&single=true&output=csv), [Mechanics CSV](https://docs.google.com/spreadsheets/d/e/2PACX-1vTOR_zO2ZMBY8oVfxRZL2qE21877cCts1Ujt2QCgP3ff9wSutZ99xnlXbpECmTLR5aC-ACNFALnztnD/pub?gid=2076452961&single=true&output=csv). A changing source can differ after the recorded audit time. This audit verifies import fidelity; underlying balance accuracy, live-game behavior and frontend presentation require separate evidence.
