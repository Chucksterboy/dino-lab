# Dino Lab numeric audit — 28 October 2026

The complete imported dataset matches fresh reads of both supplied sources. No source numeric value, formula, original snapshot or import timestamp was changed. The audit found calculation and presentation defects, corrected for version 0.1.5.

## Complete source coverage

| Area | Coverage | Result |
| --- | ---: | --- |
| Species | 22 playable dinosaurs and 11 wildlife entries | All included |
| Source 1 | 3,214 records, all 33 normalized metrics, 96 mechanics | Zero fresh-source or import mismatches |
| Source 1 sliders | Every integer growth 25–100 in both conditions for all 21 supported dinosaurs | All 3,192 points retained |
| Source 2 | All 22 tabs, 10,970 native numeric cells, 7,865 formulas | Zero fresh-source or import mismatches |
| Source 2 sliders | 463 independent growth/condition columns, including precise fractional breakpoints | All retained |
| Source 2 attacks | 111 rows and 2,408 authored keyframe entries | Numbers, controls and event descriptions retained |
| Source 2 remaining grid | 607,130 cells beyond the imported top 60 rows | No further cell content |
| Comparison/table selectors | 141,215 checks, including 121,341 metric-cell readings | Correct source, growth, column and condition |
| Body-hit arithmetic | 54,747,276 supported matchup combinations | Pass after floating-point correction |
| Exact decimal hit boundaries | 969,439 checked boundaries | 15,286 legacy overcounts corrected, no false correction in these data |
| Food/water reserves | 649,228 cases | Source formulas match |
| Blood/stamina recovery | 617,088 cases | Source formulas match |
| Wildlife incoming-threat checks | 35,354 actor/target cases | Match the original explicit-HP rule |
| Chart render checks | 3,432 server-rendered SVG cases | Finite coordinates and correct point counts |

These counts overlap and include combinations of the same underlying observations. They must not be added together as unique measured game values. Hypsilophodon has Source 2 data only; unsupported Source 1 figures remain unavailable.

## Corrections included in 0.1.5

- **Hit-count rounding:** mathematical `153 ÷ 10.2 = 15` previously became 16 hits because the JavaScript quotient was `15.000000000000002`. Only rounding noise near a positive integer is normalized. A genuinely truncated multiplier still requires the extra event: 1,000 HP divided by 249.999925 damage remains five.
- **Tiny positive values:** 0.02 kg, 0.5 kg and 0.002 damage remain visible as nonzero values. Exact source readings are available in relevant value tooltips.
- **Source 2 Sprint curves:** the Sprint metric now resolves to the authored speed row for every dinosaur and both conditions.
- **Chart selection:** clicking uses the exact hovered source record, preserving nearby fractional keyframes and the source's tie behavior. Growth readings retain five decimal places when needed.
- **Condition comparisons:** when the other condition uses a different nearest keyframe, the weight comparison names that actual growth. No interpolation is invented to make the frames appear equal.
- **Wildlife matchups:** the Overview table identifies its Source 1 model and actual nearest growth. Wildlife incoming-hit checks use explicit HP rather than body mass, including fractional playable HP. HP readouts preserve decimals. The separate Attacks model retains its declared rounded-weight assumption. Known absolute Bite damage is available without inventing bite force.
- **Refill duration:** negative source swim durations retain their numeric magnitude, such as `5m 3s · refills`. Percent differences between refill and drain durations are suppressed because they describe different events.
- **Timing and attack meanings:** raw adult sprint and full-bar standing baselines are labeled. Tick attacks and unverified venom models retain their event units and qualifications rather than being presented as ordinary physical hits.

Four dataset metric label strings changed; all remaining dataset content has the same protected fingerprint as before these changes. Both original datasets remain independent. The removed data/source screens and transfer controls remain removed.

## Independent evidence and reproduction

- [Source 1 report](DASHBOARD-NUMERIC-AUDIT.md): independently parsed live CSVs and the current dashboard HTML.
- [Source 2 report](WORKBOOK-NUMERIC-AUDIT.md): fresh native Google Sheets numbers, formulas, source cells, keyframes and complete grid tails.
- [Calculation report](CALCULATION-NUMERIC-AUDIT.md): source-rule comparisons, exact decimal boundary checks, source selections and server-rendered numerical output.

```powershell
node tools/audit-dashboard.mjs --offline
node --import tsx tools/audit-workbook.mjs
node --import tsx tools/audit-selection-numbers.mjs
node --import tsx tools/audit-calculations.mjs
npm test
```

The live-capture audits use the read-only evidence saved under ignored `test-results/numeric-audit`; the source reports describe how those captures were obtained. The repository's raw snapshots and ordinary unit tests remain available independently.

The complete JavaScript/SSR suite passed **70 tests**, and TypeScript compilation passed. No desktop GUI or live browser was controlled for this audit; the user is performing the visual checks.

## Source limits retained

This verifies the supplied sources and the app's use of them, rather than establishing every value against the current game. Source 2 still labels patch `0.21.748`; Source 1 does not declare a game patch. Their uncertainties and differing numbers remain separate.

Boar's original raw sprint speed differs slightly by condition: 21.6 Prime versus 21.589 Frail km/h, with rounded headlines of 21.6 for both. Both original values are preserved. Three unlabeled Herrerasaurus helper cells are also preserved internally; they are not invented 0–100% growth choices. The individual source reports document these cases.
