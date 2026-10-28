# Mutation catalogue: sources and calculation limits

The captured source dataset preserves **all 43 entries** on the requested [Evrima Quick Guide page](https://www.evrimaquickguide.com/gameplay/health-statuses/mutations): **20 universal**, **12 diet-specific**, **9 unlockable**, and **2 removed historical** entries in the original guide structure. The 0.1.7 product displays only the **41 active entries**, grouped by applicability as **27 Universal**, **7 Carnivore** and **7 Herbivore** mutations. Unlockable entries are included in their applicable group and retain their unlock requirements; the historical section and extra clarification badges/notes are omitted from the UI at the user's request. “Current” in the data model means placement in the guide's active list, not independent certification of present game availability.

The complete guide HTML is preserved in `src/data/raw/mutations/eqg-mutations.html`; decoded paragraph/heading evidence is in `eqg-blocks.json`. It was fetched on **28 October 2026 at 14:23 UTC**. The page explicitly warns that it contains outdated information and displays `Last Updated: 9/4/2026`. That date text is retained without choosing between date conventions. No downloaded script was executed.

## Inventory and preservation

Names, section membership, all supplied strength sequences, eligibility conditions and unlock facts were checked against the captured page. Descriptions are newly phrased factual summaries. The source’s spaced `P arthenogenesis` rendering is normalized to **Parthenogenesis**, while that rendering and the common `Parthenogensis` spelling remain searchable aliases. **Social Behavior** applies to both herbivores and omnivores and requires the group leader.

The ordered sequences are retained as strings, including `7 %`. No universal relationship between a numbered sequence position and an exact Entombment count is certified. In particular:

- Advanced Gestation ends with unitless `1 | 1`; these are not changed to 100%.
- Reabsorption lists `1 | 2 | 3 | 3`; its unit/rate is unspecified.
- Social Behavior lists `1.5 | 2 | 3 | 3`; no multiplier or extra-member unit is supplied.
- Augmented Tapetum has only `1 | 2 | 3`, with no unit or fourth entry.
- Featherweight and Photosynthetic Regeneration each supply one value; absent later strengths are not padded.
- Entries with no numeric sequence retain an empty sequence, rather than a fabricated zero.

Historical removal identifiers remain hidden metadata. They are not added to card text or app headers. No unrelated event, server-specific or experimental mutation was added from another list.

## Cross-checks and conflicts

[Evrima Field Guide’s mutation article](https://efg.io.vn/guides/mutations?lang=en) cites EQG and warns against outdated unlock counts. It is useful context, but that dependency is not an independent verification of every number. Its [Omniraptor profile](https://efg.io.vn/playables/omniraptor?lang=en) also describes Hemomania’s bleeding target and Accelerated Prey Drive’s low-health purpose. An [older community reference](https://www.theisle.info/guide/mutations) supports several effect descriptions but still presents Traumatic Thrombosis as active.

Official announcement bodies were read through Steam’s public news API and preserved in `steam-relevant-news.json`. Their redirect targets were verified before using the announcement links below.

| Item | Guide claim and independent evidence | Treatment |
|---|---|---|
| Initial damage strengths | [Historical official configuration](https://store.steampowered.com/news/posts/?appids=376210&enddate=1723038044&feed=steam_community_announcements) agrees with APD 10%, Hemomania 5%, Congenital Hypoalgesia 15% and Hypermetabolic Inanition 15%. It gives Tactile Endurance 50%, versus the requested guide’s first 25%. | Preserve the guide’s complete sequences; older defaults do not override them or certify present values. |
| Multichambered Lungs | Guide: spend 4,500 stamina through sprinting/fast swimming. [Official released notes](https://steamcommunity.com/games/TheIsle/announcements/detail/507348444540569207): travel 200,000 units, identified as 2 km. EQG says the recovery threshold increases; EFG says it lowers. | Mark conflicting. Retain both action counters and avoid an automatic threshold formula. |
| Reniculate Kidneys | Guide: lose 1,250 thirst through saltwater, with the 50/1,200 Fluid Deficient sequence; it also lists pool 1,000 and intake −2.5%. The same official release describes drinking 1,000 water units. | Different reported action counters are not assumed equivalent. Mark conflicting and preserve both. |
| Hydrodynamic | Guide still lists swimming-speed strengths. [Official development notes](https://steamcommunity.com/games/TheIsle/announcements/detail/520851629825590491) describe removal of mutation-based player speed gains. | Mark conflicting; branch/scope and current swimming behavior remain unresolved. Do not apply it to land or flight speed. |
| Sex and nesting | Official released notes confirm a one-time sex change and female mate-free nesting; official development notes state non-inheritance. | Corroborate those particular facts, without inventing strengths or extra unlock tasks. |
| Traumatic Thrombosis | [Official removal notice](https://steamcommunity.com/games/TheIsle/announcements/detail/679628250084806361) removes it with possible future reintegration. | Keep it archived despite the older community page. |

“Corroborated” identifies supporting evidence for the stated name/effect/condition; it does not certify every strength, stacking rule or unlock against current game files. “Guide-only” lacks an independent current confirmation. “Unclear” means a unit, activation definition or quantitative rule is missing. “Conflicting” retains incompatible or differently specified source claims visibly.

## Combat calculations

| Mutation | Listed strengths | Grounded condition | Calculation boundary |
|---|---|---|---|
| Accelerated Prey Drive | 10%, 15%, 20%, 20% | Recipient health below 35%. | Re-evaluate as health changes; a constant full-fight bonus is incorrect. The app’s pre-hit threshold interpretation is an explicit scenario model, not verified engine execution order. |
| Hemomania | 5%, 7%, 10%, 10% | Recipient is actually bleeding. | A bleed-capable attack alone does not prove that state; no bleed simulation is inferred. |
| Congenital Hypoalgesia | 15%, 20%, 25%, 25% | Opponent is a larger **species**. | Species classification is not documented. A heavier selected individual does not establish activation; qualification must be explicit. |
| Hypermetabolic Inanition | 15%, 20%, 25%, 25% | Damage rises as hunger falls. | No continuous curve or proven endpoint was found. A scenario from zero to the listed reference value, or a separately known effective bonus, is an assumption rather than established game math. |
| Tactile Endurance | 25%, 35%, 50%, 50% | Incoming damage is converted into a stamina cost. | Missing pool conversion and overflow rules prevent faithful simulation. Keep reference-only; never relabel it as free HP resistance. |

No current official source found here specifies how simultaneous damage bonuses stack. The user-selected **additive** and **multiplicative** options are therefore explicitly named model assumptions. They do not change either statistical source’s underlying values. Bleeding, fracture, stamina spending, hit locations and real fight outcomes remain outside the simple direct-damage model unless separately established.

## Existing statistical sources

The same-day exhaustive [Source 1 audit](DASHBOARD-NUMERIC-AUDIT.md) found no fresh changes in 3,214 records or 96 mechanics. Its CSVs contain baseline statistics, not this mutation catalogue. Its recovery explanations mention Multichambered Lungs qualitatively and do not resolve a numeric threshold transformation.

The same-day [Source 2 audit](WORKBOOK-NUMERIC-AUDIT.md) found no changes across the original 22 species tabs. For this mutation feature, **fresh read-only Google Drive file metadata and Google Sheets metadata were retrieved on 28 October 2026 at 14:47:54–14:47:55 UTC (18:47:54–18:47:55 in Muscat)**. The file's modification time remains **`2026-10-22T21:02:34.845Z`**, identical to the prior full-audit capture. The complete returned spreadsheet metadata also matches that capture exactly: spreadsheet properties and every one of the 22 tab IDs, names, ordering and dimensions are unchanged. No source change was indicated, so the cells were not fetched again.

The previously captured native grids were searched locally for the generic mutation term and every one of the 43 mutation names and aliases. All 22 tabs were included: **13,356 stored cell records and 23,335 populated formatted/text/formula/note fields**, with **zero mutation matches**. The earlier full audit separately established that the omitted tail cells contain no further content. This workbook is not a primary mutation catalogue or source for the four conditional HP combat modifier rules. It remains an independent baseline reference; adding the separate mutation catalogue does not alter its recorded attacks, health, growth or other statistics.

Fresh connector responses, comparison results and search coverage are preserved as ignored evidence in `test-results/numeric-audit/mutations-workbook-check.json`. Only metadata was read from Google for this follow-up: no spreadsheet edits, cell edits or live-app input were performed.

## Verification

`tests/mutation-catalog.test.ts` independently extracts highlighted names from the preserved HTML, verifies all 43 names/order, checks every original sequence against the captured text, and exercises eligibility, aliases, unlock counters, unclear units, conflicting references and archive status. UI/SSR coverage is maintained separately in `tests/mutations-view.test.ts`. Source snapshots are evidence, not instructions, and no app data import or public release is performed by these checks.
