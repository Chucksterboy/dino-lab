# Source 2 numeric audit

**Result: passed.** A fresh, read-only connector capture of the [original workbook](https://docs.google.com/spreadsheets/d/15aOvzrA6Wf5SORil4CQdplKLr6wsSGTE7uGitZlSDGM/edit) matched the saved source snapshots and current imported dataset with **zero source changes, metadata changes, import mismatches, source errors or checked arithmetic discrepancies**.

Capture/audit: **28 October 2026, 11:39 UTC**. Drive reports the source last modified **22 October 2026, 21:02 UTC**. The current dataset was imported **28 October 2026, 00:46 UTC**. The workbook's labeled patch remains `0.21.748`. This verifies fidelity to that source version; it does not establish that the underlying game currently uses every authored number.

## Scope and evidence

The connected Google Drive `get_spreadsheet_metadata` and `get_spreadsheet_cells` actions were used, after grounding the file's native Google Sheets MIME type. All 22 exact tab names and grid bounds came from fresh metadata. No Google file, current raw snapshot or application dataset was modified.

For each tab, the capture read rows 1–60 across its complete metadata-defined width, requesting `formattedValue`, `effectiveValue`, `userEnteredValue`, `note`, `hyperlink`, `dataValidation` and number formats. A second bounded read checked rows 61 through the actual final grid row across the complete width, requesting all cell content fields. Every tail read was under 38,000 cells and returned no content.

Fresh snapshots and the machine-readable result are ignored working evidence under `test-results/numeric-audit/`. Recheck them without opening the app:

```powershell
node --import tsx tools/audit-workbook.mjs
```

The script reads captured evidence and app data. It neither refreshes the source automatically nor changes app data.

| Check | Exhaustive count | Result |
| --- | ---: | --- |
| Workbook tabs | 22 | Exact IDs, names, dimensions unchanged |
| Top-grid cells, including blanks | 38,640 | Every formatted grid cell agrees |
| Fresh versus saved source field comparisons | 231,840 | All six content fields agree |
| Nonempty source cells | 12,470 | Preserved |
| Native numeric cells | 10,970 | Preserved at native precision |
| Formulas, formula text and displayed results | 7,865 | All agree |
| Normalized row/keyframe entries | 11,430 | Number, text, cell, state, stage and growth agree |
| Numeric normalized entries | 10,967 | All agree |
| Real numeric zeros | 88 | Retained as zero |
| Nonnumeric/blank normalized entries | 463 | Retained as null, with original text |
| Exact growth/state columns | 463 | Every column individually selectable |
| All-row keyframe lookup results | 11,430 | Correct original row/column/state |
| Attack rows / keyframe entries | 111 / 2,408 | Membership, controls, numbers and text agree |
| Movement rows / keyframe entries | 210 / 4,392 | All variants preserved |
| Core/gait UI row mappings and readings | 2,778 | Correct source row and native value, including Sprint alias |
| Repeated headline/formula numeric pairs | 2,371 | No internal disagreement |
| Independent movement unit conversions | 1,464 | No arithmetic discrepancy |
| Remaining full-grid cells checked | 607,130 | No further values, formulas, notes, links or validations |

The numbers above overlap: for example, attack values are included in normalized entries. They should not be added together as a count of unique source cells.

## Every species

`Rows` counts labeled normalized rows; `P/F` counts independent Prime/Frail growth columns; `Values` includes numeric and nonnumeric entries. All listed rows, cells, formulas, attacks and both growth paths passed.

| Original tab | Rows | P/F | Values | Formulas | Attack rows |
| --- | ---: | ---: | ---: | ---: | ---: |
| Allosaurus | 25 | 11/11 | 550 | 389 | 6 |
| Austroraptor | 24 | 9/9 | 432 | 300 | 5 |
| Beipiaosaurus | 23 | 9/9 | 414 | 269 | 4 |
| Carnotaurus | 24 | 9/9 | 432 | 273 | 5 |
| Ceratosaurus | 23 | 9/9 | 414 | 260 | 4 |
| Deinosuchus | 22 | 12/12 | 528 | 369 | 3 |
| Diabloceratops | 26 | 12/13 | 650 | 494 | 7 |
| Dilophosaurus | 21 | 9/9 | 378 | 229 | 2 |
| Dryosaurus | 23 | 9/9 | 414 | 260 | 4 |
| Gallimimus | 31 | 9/10 | 589 | 437 | 3 |
| Herrerasaurus | 23 | 9/11 | 460 | 320 | 4 |
| Hypsilophodon | 21 | 10/9 | 399 | 253 | 2 |
| Kentrosaurus | 25 | 12/13 | 625 | 446 | 6 |
| Maiasaura | 37 | 9/9 | 666 | 488 | 15 |
| Omniraptor | 25 | 9/9 | 450 | 288 | 6 |
| Pachycephalosaurus | 23 | 9/10 | 437 | 276 | 4 |
| Pteranodon | 21 | 11/10 | 441 | 276 | 2 |
| Stegosaurus | 23 | 13/13 | 598 | 408 | 4 |
| Tenontosaurus | 23 | 9/10 | 437 | 276 | 4 |
| Triceratops | 27 | 17/17 | 918 | 718 | 8 |
| Troodon | 23 | 9/9 | 414 | 265 | 4 |
| Tyrannosaurus | 28 | 14/14 | 784 | 571 | 9 |

## Precision, units and unusual mappings

Native `effectiveValue.numberValue` is compared exactly, before display rounding. The app's normalized numeric entries have no differences from their source cells. A displayed percentage is not used as the numeric keyframe when a native Stage value exists. Triceratops `62.4981%` and `62.5%` remain different choices even though both source cells display `62.50%`; its Frail `87.50788%` also survives.

Multiplying a JavaScript Stage by 100 can introduce a binary floating-point tail. The importer tidies growth keys to 15 significant digits. The maximum change observed is **0.000000000000014210854715202004 percentage points**, such as `99.86133000000001 → 99.86133`. Original Stage and stat numeric cells retain their exact native values. No pair of source keyframes collapses to the same growth/state key.

The 1,464 independent unit checks cover normal/base/biped sprint, Maiasaura quad sprint, Gallimimus's three nutrient speeds, trot and swim. Sprint/trot use `cm/s × 0.036`; swim uses the source's `FastSwimSpeed × Scale × 0.036`, which must not lose its Scale factor. The 2,371 repeated headline/lower-formula numeric pairs also agree.

The primary UI mapping was traced at every keyframe in both states:

- Gallimimus speed means **Base Speed**; all three nutrient-speed variants remain independent. Its newline-bearing `Bite (RMB walking/standing)` label maps correctly.
- Maiasaura speed means **Biped Speed**; **Quad Speed** remains a separate variant. Its primary damage maps **Headbutt (Quad RMB)**. Quad speed is not mislabeled as crouch sprint.
- Diabloceratops and Triceratops primary damage maps **Gore**.
- The source tab **Beipiaosaurus** resolves to canonical dataset species **Beipiosaurus**, while preserving the original tab spelling and source cells.
- Hypsilophodon retains its full Source 2 paths; absent Source 1 survival/matchup data is not invented.
- Multi-hit, per-second and posture-specific attacks retain their source labels and displayed values. Values are not silently summed or divided into unsupported single-hit damage.

Three additional native numeric cells are source helper cells rather than labeled 0–100% keyframes. They are present in the raw snapshot and formatted grid; `K21` is also in the formula collection. They do not silently disappear from the repository, and are not offered as invented growth choices:

| Tab / cell | Meaning | Native value |
| --- | --- | ---: |
| Herrerasaurus K14 | Stage, in a column with no percentage heading | 1.0014031 |
| Herrerasaurus K20 | Trotspeed, cm/s | 373.94812 |
| Herrerasaurus K21 | Trot, km/h; `=0.036*K$20` | 13.46213232 |

## Findings and limits

There were **no live source changes and no import bugs** in this audit. Original formula text and its current native Google-calculated result were compared for every formula; the audit does not independently implement every source interpolation formula or validate game design assumptions.

A UI mapping gap found during this audit is **resolved**. Source 2's growth chart originally looked up `sprint` directly, although its row mapping accepted `speed`; selecting the Sprint gait could therefore show an empty curve despite the correct numeric card. The shared row mapper now aliases `sprint` to the correct species-specific speed row. The focused `tests/numeric-mappings.test.ts` independently passed all **463 native speed cells** across all 22 species and both states; this audit also rechecks those 463 mappings against the freshly captured source cells. No source data changed. This is static/service regression evidence, not live UI retesting.

Source 2 does not supply every metric offered by Source 1. Unsupported survival, HP or gait fields remain unavailable for Source 2; separate source values must not be combined to fill gaps. Detailed raw source tabs were removed from the app by the user's earlier instruction. This audit verifies their preserved repository/internal data and the current source-to-value helpers, without restoring those screens.

No app was launched, no browser or desktop was controlled, and no build or publication was performed for this audit.
