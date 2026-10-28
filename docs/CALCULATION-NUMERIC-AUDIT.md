# Calculation and species-view numerical audit

Audit date: 2026-10-28. Scope: every 22 playable species and 11 wildlife entries, with Prime/Frail kept separate. This is an audit of the supplied sources and Dino Lab's arithmetic/presentation, not a claim that every number is correct in the current game.

Subsequent visibility update: the user removed BabyBoar, BabyDeer and BabyGoat from the active application. The raw 33-species capture remains available to independent source audits through `sourceDataset`; the visible catalog is 22 playable species and eight wildlife entries. The original counts below record the complete captured source. The current visibility-aware Wildlife replay passes all **25,664** active actor-record/visible-target combinations (3,208 records × eight wildlife targets), with no mismatches. Mutation scenarios are documented separately in `MUTATION-COMBAT-MODEL.md`; the captured source values are not replaced by those scenarios.

## Independent method

Run `node --import tsx tools/audit-calculations.mjs` from the project root. It uses no browser, native app, network request or application build.

The tool extracts and executes the preserved Source 1 JavaScript functions `survLeft`, `updateFactChips`, `getRowAt`, `getPeakGrowth`, `compositePeak`, `getSanctuaryLimit`, `killHits` and related helpers in an isolated context. `updateFactChips` is executed against every stored record at every reachable blood-slider setting; only its output DOM is stubbed. This is an independent reference implementation from the original source, rather than a copy of Dino Lab's calculation helpers. The numeric bindings are checked against preserved `sample.raw` fields; separate source-import audits establish those fields against fresh CSV/native workbook snapshots.

The original `updateWildCard` and its attack/HP helpers are also executed directly. Every lethal-threat flag is compared with actual server-rendered `WildlifeEncounters` output, including all playable records and fixed wildlife actors. `--wildlife-only` replays this 35,354-case matrix independently when the HP binding changes.

Hit-count integer boundaries receive a second, independent check using exact decimal rational arithmetic (`BigInt`) on stored bite, mechanic multiplier, and target HP. This detected an arithmetic error shared by the source's JavaScript and the original app. The auditor now expects the corrected exact-decimal ceiling at those boundaries and records intentional differences from legacy source JavaScript separately.

React server rendering checks the entire growth chart's SVG path vertices and finite coordinates for both conditions, both sources, all selectable core/movement metrics, and linear/log scales. Survival and Attacks are server-rendered at every Source 1 record. This does not exercise a live browser or the user's running application.

## Exhaustive coverage

| Check | Cases | Result before corrections |
| --- | ---: | --- |
| Source 1 records | 3,214 | All included: 21 playable × 76 growth points × 2 conditions, plus 11 wildlife × 2 fixed-condition records |
| Numeric metric-to-raw-column bindings | 106,062 | Match |
| Hunger/thirst reserve levels, 0–100% | 649,228 | Match original `survLeft` |
| Sprint/swim/rest/standing source chip equations | 16,070 | Match original `updateFactChips` |
| Resting stamina at 5–100% blood | 308,544 | Match |
| Standing stamina from 20% at 5–100% blood | 308,544 | Match |
| Sprint distances | 3,214 | Match km/h ÷ 3.6 × duration |
| Fast-swim distances | 3,214 | Match; missing speeds stay unknown |
| Oxygen duration/refill bindings | 6,428 | Match |
| Wildlife threat flags against original `updateWildCard` | 35,354 | Match after explicit HP correction, including all playable and fixed wildlife records |
| Source 1 nearest-growth lookups, including integer/midpoint/out-of-range inputs | 13,530 | Match; lower record wins ties |
| Source 2 row selections at exact keyframes/midpoints/adjacent values | 42,474 | Match; no interpolation |
| Source 2 canonical core/movement reads | 2,315 | Match mapped rows; absent data stays unknown |
| Peak markers | 33 | Match Prime source flag, then original composite fallback |
| Sanctuary markers | 33 | Match Prime FALSE→TRUE window; first TRUE means never allowed |
| Attack damage states | 17,056 | Match stored multiplier/flat damage |
| Locked attack states | 150 | Three Troodon venom modifiers × 25 locked growths × 2 conditions |
| Attacker/attack/target/growth/condition body-hit combinations | 54,747,276 | Match legacy Source 1 JS, including its floating-point ceiling defect |
| Exact decimal hit-count boundaries | 969,439 | Found 15,286 legacy ceiling errors; see below |
| Growth chart SVG renders/vertex-count checks | 3,432 | Finite coordinates; correct recorded-point counts |
| Survival / Attacks server renders | 3,214 each | No `NaN` output |
| Source 2 attack reference text checks in those renders | 16,568 | Preserved source text, including multi-hit/per-second wording |

Hypsilophodon has no Source 1 records; its Source 2 keyframes are included. Wildlife does not acquire synthetic growth stages. Repeated Prime/Frail records and multiple attacks with identical damage count as distinct supported UI combinations, not distinct observations from the game.

## Corrections and evidence

The implementation corrects the floating-point ceiling edge case; preserves tiny positive hit ratios as one event and overflow as unknown; uses known wildlife flat Bite damage without inventing absent damage; distinguishes hit/tick/unverified venom event units; exposes unrounded damage; and preserves exact recorded chart selection with five-decimal growth labels. Tests exercise the actual chart mouse handlers and attack selector handlers through React server render-phase updates, without opening a browser or app. Root integration also qualifies the independent wildlife model, uses explicit wildlife HP, identifies the actual opposite-condition keyframe, and connects the adaptive number/duration formatting and explicit baseline labels.

Final post-correction replay: **0 failures**. All **54,747,276** body-hit combinations pass, including **969,439** exact decimal boundaries and **15,286** intentional corrections to legacy JavaScript ceiling. All **35,354** wildlife threat flags match the original Wildlife card. All **2,315** positive Source 2 canonical core/movement readings remain visibly positive, and all **152** negative slow-swim durations retain their time magnitude. The source equations, nearest-keyframe checks, SVG checks and Survival/Attacks render checks in the coverage table also pass after integration. The focused calculation/combat/chart suite passes 24 tests; the integrated JavaScript suite passes 70 tests and TypeScript checking passes.

All findings below are resolved. Rounded event damage remains an intentional display choice with exact-value tooltips: after adaptive formatting and correct ceiling, 912,012 of the 54,747,276 supported combinations would still yield a different count if a reader recomputed using only the rounded display. The calculator uses precise stored damage, and now says so explicitly.

No source numeric records, stored attack multipliers or workbook formulas are changed by these corrections. The findings below preserve their original proof and explain why each correction is necessary. Display rounding remains deliberate; exact-value tooltips keep it distinct from the arithmetic inputs.

### P1: binary floating point can add one required hit

`hitsToKill(153, 10.2)` returns 16 because JavaScript computes `153 / 10.2` as `15.000000000000002`. Exact decimal arithmetic is 15. A real example is Allosaurus Frail at 33% growth, primary damage 10.2, against Gallimimus at 43%, HP 153. The original dashboard makes the same mistake.

The exact rational boundary check found 15,286 affected attacker/target combinations. A candidate correction `ceil(q − 4 × Number.EPSILON × q)` agreed with exact rational results at all 969,439 near-integer boundaries, with no false correction in the shipped dataset. The shipped helper uses a safer equivalent: normalize only to a nearby positive integer, and otherwise use ceiling. Positive underflow still means one event; division overflow remains unknown. Genuine source-multiplier truncation remains: damage `175 × 1.428571 = 249.999925` against 1,000 HP still requires 5 source-model events, not 4.

### P1: wildlife threat compares selected wildlife weight instead of HP

The Overview encounter table uses selected `weight` for incoming lethal-hit checks. Boar is 125 kg but has explicit 350 HP; another boar's known 175-damage attack is incorrectly marked a one-hit threat. Attacks already uses explicit wildlife HP correctly. Recommendation: use wildlife HP in the Overview check as well.

The original source has two distinct conventions: `updateKillCard` intentionally uses rounded `R Weight` as the playable body-hit estimate, while `updateWildCard` prefers the explicit `HP` field for every actor and falls back to `R Weight`. There are 1,334 playable records where explicit HP differs from rounded displayed weight, with eight wildlife one-hit flags affected at the current known attack values. For example, Beipiaosaurus at 39% has 25.2 HP and rounded weight 25; BabyBoar's 25-damage attack is not a one-hit kill. The corrected Wildlife card uses explicit HP, shows that HP reference in its caption, and passes all 35,354 original-source flag checks. The separate Attacks estimate retains and explains the original rounded-weight convention. Generic HP formatting now preserves two decimals and has exact-value tooltips, rather than presenting fractional HP as an integer.

### P1/P2: unqualified encounter numbers under Source 2 use Source 1

Overview's wildlife encounter table uses Source 1 attacker stats even when Source 2 is selected. Across 463 workbook columns × 11 wildlife targets, 924 of 5,093 displayed hit estimates differ from calculations using the visible Source 2 primary attack. For example, Allosaurus Prime at Source 2 0% shows 0.175 damage, but the table uses Source 1 25% damage 5.2: BabyBoar's 30 HP is displayed as 6 hits rather than 172.

The app intentionally keeps Survival and Attacks' Source 1 models independent and explicitly says so. Recommendation: make the encounter table equally explicit about Source 1 and its nearest recorded growth, or intentionally make the entire calculation source-aware. Do not silently merge source models.

### P1/P2: positive hatchling values round to literal zero

Overview, generic metric formatting and chart readings use zero decimals for kg. Fourteen Source 2 keyframes display 0 kg despite positive weights: Hypsilophodon 0.02, Troodon 0.06, Pteranodon 0.0879, Beipiaosaurus 0.09, Dryosaurus 0.11, Herrerasaurus 0.18 and Gallimimus 0.43, each in both conditions. Deinosuchus 0.5 kg displays 1 kg. Hypsilophodon's 0.002 primary damage also displays 0 under two-decimal formatting.

Recommendation: adaptive precision for sub-unit values and an exact-value tooltip where other readings are rounded. The source reference rows already preserve the original displayed text.

### P2: baseline durations need explicit qualifiers

Source 1 `Sprint (s)` is the adult baseline; the original dashboard scales it by `clamp((growth−25)/50, 0.1, 1)` before presenting endurance. The Survival calculator does so correctly. Generic metrics in Complete survival values, comparisons and tables retain the raw baseline under an ambiguous sprint-duration label.

The source's standing file duration is a 0–100% full-bar equivalent. The live standing calculation correctly uses 80% of that time for the observed 20% floor and then divides by the blood fraction. Label raw columns as baselines/full-bar equivalents rather than changing source values.

### P2: negative swim formatting hides a recorded magnitude

All 152 Deinosuchus records have slow-swim duration −303 seconds. Generic `formatDuration` reduces that to only `Replenishes`, losing the 303-second magnitude. Survival's main movement card correctly displays 5m 3s and a refill qualifier. Show the duration magnitude with the refill qualifier consistently.

### P2: rounded damage can look inconsistent with exact hits

Before corrections, in 1,125,245 attacker/target combinations, computing with the displayed two-decimal damage would give a different hit count from computing with the stored multiplier. For example, Allosaurus 25% claw damage 7.4285692 displays 7.43; against 104 HP the source-model result is 15 hits, whereas the displayed rounded value implies 14. The corrected UI keeps precise arithmetic, exposes exact damage, and explicitly explains display rounding.

### P2: Source 2 sprint chart alias

The Movement numeric card aliases `sprint` to the workbook's Speed row, but GrowthChart passes `sprint` directly to `sheetRow`, whose map contains `speed`. The result is an empty sprint curve for all 22 workbook species. Recommendation: centralize the `sprint`→`speed` alias, with regression coverage. Other unsupported workbook gait metrics correctly remain unavailable; nutrient speeds and Maia biped/quad variants retain their original labels separately.

### P2: opposite-condition growth labels and event units

Forty-five of 463 workbook columns compare weight against an opposite-condition keyframe at a different growth, for example Prime 87.5% versus Frail 87.5079%. The original label said “at this growth.” The corrected label identifies the actual nearest opposite growth. Chart hover/selected growth now uses five decimals. Chart click now emits the exact nearest recorded point shown by hover; the previous whole-number rounding could choose the wrong adjacent fractional workbook keyframe, or the upper integer at a Source 1 tie where hover showed the lower record.

Eight Source 1 loop modifiers are damage per tick. Three selectable Troodon venom modifiers are explicitly unverified community models, including a five-tick DoT assumption. The generic “damage / hit” and “excluding venom” matchup wording needs to reflect the selected source event, and should not imply those events are interchangeable single body hits. Boar/BabyBoar should default to their known absolute Bite rather than the absent bite-force field; other wildlife damage must remain unknown.

## Limits and protected semantics

- Source 1 hunger/thirst timers stop at an empty bar. They do not predict subsequent damage, and growing hunger excludes additional server-dependent growth cost.
- Sprint alone uses the source's juvenile scaling. Swim duration remains the source's adult baseline; species-specific juvenile swim behavior is unresolved.
- Blood scales stamina recovery only. Oxygen, stamina drain and blood recovery are not given a new blood multiplier.
- Standing's 20% floor is observational in the supplied source. Health recovery and mud-walking figures remain marked unverified; no new live model is asserted.
- Multiplier precision is retained from the supplied mechanics CSV; descriptions quoting a rounded balance-row value do not authorize replacing its multiplier with a new ratio.
- Source 2 numbers are exact source keyframes, not an interpolation or an asserted equivalence to Source 1's patch/conditions.
- No running user application, window, native session or GitHub release was changed during this audit.
