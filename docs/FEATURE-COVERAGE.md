# Dino Lab source coverage

This audit distinguishes **source-information completeness** from **identical workflow parity**. A checked item has automated evidence or an inspected implementation; it does not imply a native Windows performance measurement. Unchecked items and their practical impact are listed at the end.

**Current user scope (0.1.7):** The mutation catalog shows 41 active entries in Universal/Carnivore/Herbivore groups, with unlock requirements retained inside those groups. Historical entries, clarification panels and quality badges are hidden. Both attack loadouts expose all three active damage boosters with carnivore eligibility enforced; Tactile is omitted from the HP calculator. Baby wildlife entries are excluded from active workflows.

**Earlier UI simplification (0.1.2):** all import/export/download/copy-file/configuration controls, the global **Data & sources** page, species **Mechanics** and **Source data** tabs, the complete species footer and the **Field mechanics** overview card were explicitly removed. Those original parity requirements are withdrawn, not pending features. Each species now has **Overview, Movement, Survival and Attacks**, with **Source 1 / Source 2** labels and a source/growth-aware **Movement at a glance** card. Original source identities, grids and formulas remain in the repository and internal dataset. Current acceptance is recorded by `tools/test-ui.mjs`, `tools/test-readability.mjs` and their generated reports.

**Source-information result:** all observed information from both linked sources is preserved in the repository/internal dataset. All 22 source tabs, 3,214 records, 96 mechanics rows, 111 attack rows and 7,865 formulas are retained. No missing imported source field was identified. Raw-data inspection and other original workflows are intentionally absent from the current UI where the user requested their removal.

Sources inspected on 28 October 2026:

- SpeciesData dashboard: https://theisle-speciesdatadashboard.pages.dev/
- Dashboard Gamedata CSV: published workbook `2PACX-1vTOR_zO2ZMBY8oVfxRZL2qE21877cCts1Ujt2QCgP3ff9wSutZ99xnlXbpECmTLR5aC-ACNFALnztnD`, tab `574193446`.
- Dashboard Mechanics CSV: same published workbook, tab `2076452961`.
- Species stat workbook: https://docs.google.com/spreadsheets/d/15aOvzrA6Wf5SORil4CQdplKLr6wsSGTE7uGitZlSDGM/edit

## Evidence

- **Data:** `tests/data.test.ts` independently parses original CSVs, compares every imported record/column/numeric metric, checks all dashboard growth points and both workbook paths, native numeric precision, source formulas, null/zero distinction and species aliases.
- **Whole-grid bounds:** `docs/workbook-tail-audit.json` records a live connector read of rows 61 through each tab's actual final grid row, across its complete width. All 22 ranges returned no additional values, formulas, notes or hyperlinks.
- **Calculations:** `tests/calculations.test.ts` checks source-specific arithmetic and boundary cases. `tests/components.test.ts` renders Survival and Attacks for all 22 playable species and verifies important caveats.
- **Charts:** `tests/chart.test.ts` checks threshold ratios, growth unlocks, selected state, Prime sanctuary flags and finite SVG output for all 792 species/source/state/core-metric/scale combinations.
- **Browser UI:** `docs/UI-VERIFICATION.md` and `docs/ui-verification-results.json` record current isolated headless Edge checks: 44 loaded images, 84 Source 1 slider endpoints, 88 Source 2 endpoints, 516 displayed headline readings, 516 Movement at a glance readings, four-tab navigation, search, persistence, rapid switching and numeric entry. The generated reports provide the exact latest pass count.
- **Analysis workflows:** the updated `tools/test-analysis.mjs` verifies independent comparison sources/growth/state, repeated species, 22 playable and 11 wildlife table rows, scatter and absence of transfer/configuration controls. Earlier JSON/CSV/image captures under `test-results/` are historical evidence from before the user's removal request.
- **Code inspection:** App, SpeciesPage, Chart, Survival, Attacks, Mechanics, SourceData, AnalysisViews, bootstrap, styles and the local-data adapter. Source inspection establishes implemented behavior where the browser checks do not exercise every control.

## Source data completeness

- [x] Retain all 3,214 dashboard records and every original column, including rounded/unrounded values, flags, stage, kind, notes and unconfirmed fields.
- [x] Retain all 96 mechanics records with descriptions, chart, mode, value, unlock, color and original spelling.
- [x] Retain all 22 workbook tabs, including dashboard-absent Hypsilophodon.
- [x] Retain formatted grids, original entered numbers/strings, native effective values, 7,865 formulas, cell coordinates and available notes/hyperlinks.
- [x] Establish that no cell information exists outside the imported first 60 rows of any tab's full grid width.
- [x] Preserve patch/source identification. Workbook patch is `0.21.748`; the dashboard's current game patch is unspecified.
- [x] Preserve disagreements between the two sources without averaging or silently replacing values.
- [x] Preserve all original source-cell and record fields in the repository/internal dataset. Raw-data inspection UI and JSON export were removed at the user's request; the four research tabs present selected information.
- [x] Retain missing values as null and real zeros as zero. Unknown UI values use a dash; no dashboard survival data is invented for Hypsilophodon.
- [x] Retain exact authored Stage breakpoints, including Triceratops 62.4981% versus 62.5%, independently of rounded displayed percentages.

## Entry and navigation

- [ ] Validate the packaged Windows executable/installer opening without browser chrome. Native packaging and launch are pending the main build's separate verification.
- [x] Implement the pulsating startup, startup-to-app crossfade and Skip/Escape control. Active animation was observed in the browser test.
- [ ] Establish measured native animation frame pacing on target Windows hardware.
- [x] Initial picker contains all 22 playable species and names; all 22 gallery pictures and 22 species-page pictures loaded.
- [x] Search, clear search, empty state, keyboard focus and Ctrl K work. Species selectors are native buttons supporting keyboard activation by implementation.
- [x] Selecting a species opens its own informative profile and image.
- [x] Implement fade transitions; rapid three-species switching was exercised and settled on the latest selection.
- [x] Respect system reduced motion in CSS/Motion and provide an app preference; preference state and app class were exercised.
- [ ] Provide a deliberate image-error placeholder/retry path for missing or corrupt artwork. Every current bundled playable image passed loading checks.

## Species growth and state

- [x] All 21 dashboard species expose 25–100% growth in Prime and Frail states. All 84 boundary combinations were checked through the actual UI; every integer point is checked in the data layer.
- [x] All 22 workbook species expose their exact 0–100% authored keyframes in both states. All 88 boundary combinations were checked through the actual UI; every authored column is selectable in the data layer.
- [x] Workbook controls select authored keyframes and their original formula results rather than inventing arbitrary-growth values.
- [x] Growth controls use native range inputs with keyboard/pointer behavior and exact numeric entry. Home/End were exercised on every species; numeric entry is implemented with blur/Enter commit.
- [x] Prime/Frail paths and original stage labels remain distinct and reachable.
- [x] Growth, selected condition and selected source are displayed; dashboard nearest-row lookup retains deterministic ties.
- [x] Weight, primary damage and sprint speed follow the selected record: 516 actual displayed readings matched their source values.
- [x] Stage and Prime-versus-Frail weight difference are bound to the chosen source/state by implementation.
- [x] Display rounding is separate from preserved source text/native values. Original native values and formulas remain in the repository snapshots.
- [x] Source-only species show an explicit unavailable dashboard state.
- [x] The active UI uses anonymous Source 1/2 labels, including source selectors/captions, comparison/table options and scatter accessibility labels; original source IDs remain unchanged internally.
- [x] Movement at a glance shows selected-source/growth sprint, trot and fast-swim values and opens the Movement tab through Explore.
- [x] Exactly four species tabs remain. The old Mechanics/Source data tabs, Field mechanics card and complete species bottom footer were removed by instruction.

## Charts and comparisons

- [x] Weight, bite and movement growth curves, optional other-condition curve and selected-growth markers are implemented.
- [x] Linear/log scales, positive-value filtering, empty curves and finite coordinates are covered by chart tests.
- [x] Sanctuary uses Prime flags, shows the last-FALSE/first-TRUE uncertainty window and handles first-row TRUE as never allowed.
- [x] Peak uses the source flag then the source's normalized composite fallback; its interpretation is explained.
- [x] Threshold bands use selected stat × ratio; multiplier lines use stat curves × ratio. Growth unlocks, visibility controls and independent source handling are implemented and regression-tested.
- [x] Multiple comparison slots retain independent source, state and growth; repeated species are supported.
- [x] Comparison entries can be added, removed and cleared, with up to six independent slots.
- [x] Side-by-side numbers and signed metric-specific percentage differences are available.
- [x] Movement values are included in the comparison grid at each slot's own selected growth.
- [x] One comparison chart metric/gait selector applies to all specimen panes; sprint mechanics are not applied to unrelated gaits.
- [x] Speed-versus-weight scatter supports individual peaks and logarithmic weight; scatter presence and interaction controls were inspected/exercised.
- [x] Sortable all-species table has independent source/state/growth or exact-keyframe controls per row.
- [ ] Reproduce the original dashboard's general panel-collapse behavior while preserving all transient calculator inputs. Dino Lab uses tabs and selected expanders instead.

## Movement, survival and recovery

- [x] All available dashboard gaits and every original workbook movement variant are reachable, including nutrient speeds and biped/quad rows.
- [x] Positive sprint endurance uses the measured source growth scaling; unsupported juvenile swim scaling is not inferred.
- [x] Deinosuchus negative slow-swim duration displays the refill magnitude and refill label.
- [x] Distance uses selected gait speed / 3.6 × duration.
- [x] Blood slider range is 5–100%; stamina refill time scales inversely with blood.
- [x] Resting-to-full and standing-from-20% use distinct source formulas; full-bar standing equivalence is labeled separately.
- [x] Rest-ramp start, ceiling multiplier and ceiling time are visible. Standing resets its bonus; the baseline 20% standing floor is identified as observational.
- [ ] Reproduce the original detailed flat/ramp/full-speed rest-phase presentation. Current numeric fields preserve its inputs and results.
- [x] Blood rest/stand fields remain visible, unconfirmed and unscaled by current blood.
- [x] Health-recovery and mud-walking fields remain available with uncertainty labels and are not promoted into authoritative calculators.
- [x] Hunger/thirst inputs allow 0–100%, preserve partial typing, and calculate time to empty rather than time to death. Typing 1 then 100 was exercised.
- [x] Growing hunger warns about server-dependent extra food use.
- [x] Deinosuchus and both Beipi spellings receive the land-only thirst/rehydration qualification.
- [x] Oxygen dive/refill use the original source durations without unsupported modifiers.
- [ ] Retain edited food/water/blood levels when leaving and remounting the Survival tab. Current component-local values reset to 100 on remount.

## Attacks, mechanics and wildlife

- [x] All dashboard mechanics and all 111 workbook attack rows are reachable with original labels, controls and per-second/multi-hit wording.
- [x] Multiplier attacks use bite × multiplier; wildlife absolute attacks use flat damage.
- [x] Attack unlocks use that attacker's growth; stale selected attack IDs fall back safely.
- [x] Incoming/outgoing body-hit estimates use ceiling division, with the simplified playable HP=weight assumption stated.
- [x] Wildlife species retain explicit HP, sprint and known attack data, with no invented growth stages.
- [x] Encounter information identifies faster wildlife and known one-hit threats.
- [x] Missing wildlife damage remains unknown in source data and attack selection; no zero-damage assumption is invented.
- [ ] Include maximum known wildlife hit as its own column in the single encounter table. Exact known attack values remain accessible through wildlife Mechanics and incoming-attack selection.
- [x] Original imported mechanics remain intact. The mechanics editor has no active UI entry because its tab was removed by instruction.
- [x] Remove the active-species mechanics CSV control and its file-generation handler at the user's request.
- [x] Retire per-row revert, changes-only export and editor workflow parity requirements after the user's instruction to remove the Mechanics tab. Legacy override code/data is retained internally.

## Persistence, exports and source inspection

- [x] Favorites and app preferences save locally; favorite persistence after reload was exercised.
- [x] Comparison selections continue to persist automatically on the device. User-facing JSON configuration/import/export controls were removed.
- [x] Remove comparison/table image export, clipboard-copy, file-input and download controls and their handlers at the user's request.
- [x] Remove source-grid, dashboard-row, mechanics and all-species CSV/JSON transfer controls at the user's request.
- [x] Keep source-specific calculator qualifications and selected-source patch/growth captions. Full reference URLs, original labels and provenance remain in the repository/internal dataset; the global overview and raw-data inspector were deliberately removed.
- [x] Data, fonts and all current playable artwork are bundled locally; there is no runtime fetch dependency on either upstream source.
- [ ] Exercise the packaged native application fully offline after installation.
- [ ] Implement automatic upstream data refresh/reconciliation. This build deliberately presents a dated offline snapshot; importing refreshed data is a development-tool workflow.

## Remaining gaps and honest delivery claim

**Source information:** no missing observed source record, tab, column, formula or attack row was identified in the repository/internal dataset. Complete source preservation and source-specific slider/card values are verified. This is not a claim that raw source grids/formulas are still displayed in the UI: the user expressly removed their tab. The preservation claim applies to the captured snapshot, not future upstream edits or an unspecified game patch.

**Native verification still pending for the current revision:** packaged launch/install, native frame pacing and offline installed operation require the main build's checks. Browser functional success cannot stand in for those results. File/image transfer testing is no longer applicable because those controls were removed.

**Secondary workflow differences:** tabs replace general panel-collapse behavior; Survival's editable reserve levels reset on tab remount; the detailed rest-phase timeline and a dedicated encounter-table maximum-hit column are absent, though their original data remains in the dataset. Import/export/download/configuration workflows, global source overview, raw-data inspector, mechanics editor and species footer were removed by the user's explicit instruction and are not remaining gaps.

**Robustness and maintenance:** every current playable picture loaded, but missing-image recovery is not implemented. Upstream refresh is manual. The startup intentionally has a short 1.1-second minimum brand interval unless skipped, followed by a 300ms fade; it is not an immediate readiness-only dismissal. The app's manual reduced-motion class covers the application, while the startup overlay currently relies on the system reduced-motion CSS rule.

A suitable claim is: **“Captured source data is preserved internally, all species growth profiles are available, and the four selected research/calculator views are working and tested.”** Do not claim that retired raw-data views remain visible, identical original feature parity, live synchronization, measured frame-rate guarantees or completed native packaging until their separate evidence exists.
