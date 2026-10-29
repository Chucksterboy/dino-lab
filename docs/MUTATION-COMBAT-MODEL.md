# Combat mutation scenarios

The standalone **Combat Arena** keeps the captured Source 1 attack/body-hit model as its baseline. Selecting no mutations and leaving starting health at 100% reproduces the existing Source 1 result. A species with no Source 1 samples uses its Source 2 primary bite and weight/HP together; existing Source 1 profiles never borrow missing individual fields. The detailed source attack panels are removed, and original captured values remain unchanged.

The mutation percentages come from the [requested community guide](https://www.evrimaquickguide.com/gameplay/health-statuses/mutations), cross-checked with `src/data/mutations.ts`. The guide warns that some information may be outdated. Historical official configuration supports several base percentages but does not establish the current stacking, hunger curve or every attack-type interaction. `MUTATIONS-SOURCES.md` records those qualifications.

## Separate combatants and conditions

Combat Arena replaces the Attacks tab in species profiles and has its own main navigation entry. Each side has the same animated artwork used by the library, a species selector, independent growth and Prime/Frail controls, then a health bar connected to that actor's mutation scenario. Changing species updates the portrait and values, resets that side's attack and mutation/health loadout, and clears the other side's larger-species assumption. The opposite side's remaining settings persist. Saved mechanics overrides are resolved independently for both species. All 22 playable dinosaurs and eight adult wildlife entries remain selectable; wildlife uses a fixed reference and an icon/name fallback because the bundled artwork catalog contains playable dinosaurs only.

The general stacking explanation and calculation/HP-assumption paragraphs at the bottom of Combat Arena are removed from the interface. The model below, its controls and numeric results remain unchanged; attack-specific tick and unverified-venom notices still appear when those event types are selected.

Source 1 actors use recorded growth from 25–100%. Hypsilophodon's whole-profile Source 2 fallback supports 0–100% and fractional growth entry; values still use the nearest captured keyframe without interpolation. Number entry commits on blur or Enter so partially typed percentages are not clamped per keystroke. Each side has exactly one health slider beneath growth; mutation controls do not duplicate it.

Each combatant has its own mutation level, selections, starting health, bleeding state and larger-species condition. Outgoing damage uses your bonuses and the recipient's defense; reverse damage exchanges those roles. Both panes show every supported active HP damage/defense control. Wildlife controls are disabled. The three documented damage boosters are carnivore-only in the supplied source, so herbivore/omnivore controls remain visible with an explicit disabled eligibility reason; they are not silently hidden or incorrectly made universal.

Congenital Hypoalgesia requires an explicit statement that the opponent is a larger **species**. Current growth/weight does not infer it. The same species cannot satisfy that condition, only one side of a pair can be marked as the smaller species, and changing opponent clears the prior size assumption. Starting health affects remaining HP and the dinosaur's own outgoing damage, independently of mutation selection. The user-recorded health curve gives full damage at 50% HP and above, interpolates down to half damage at 10% HP, and stays at half below 10%. See [the empirical model and measurements](HEALTH-DAMAGE-MODEL.md).

The calculator offers **Default**, **Entombed 1** and **Entombed 2**, following the requested product labels. These select the first three listed percentages. The source's fourth repeated maximum is retained internally for reference but is not a selectable calculator level. Slot restrictions are shown where supplied; this is a combat scenario, not an unlock/inheritance/slot validator.

## Damage model

| Mutation | Default / Entombed 1 / Entombed 2 | Model condition |
| --- | --- | --- |
| Accelerated Prey Drive | 10%, 15%, 20% | Carnivore attacker; recipient strictly below 35% HP before an event |
| Hemomania | 5%, 7%, 10% | Carnivore attacker; recipient marked bleeding |
| Hypermetabolic Inanition | 15%, 20%, 25% | Carnivore attacker; unknown curve gives a 0–listed-value scenario range, or a manually entered effective bonus |
| Congenital Hypoalgesia | 15%, 20%, 25% | Recipient selected it and the attacking species is explicitly larger |

For outgoing bonuses `b`, the default scenario adds them: `health-adjusted base damage × (1 + sum(b))`. The alternate scenario multiplies them: `health-adjusted base damage × product(1 + b)`. Both are labeled **stacking assumptions**. Conditional Congenital reduction is applied afterward, multiplying by `1 − reduction`. Neither choice is presented as a verified game stacking law. The selected attacker health remains fixed throughout its event-count sequence. “Without mutations” counts keep the same health penalty.

Hypermetabolic does not turn a hunger percentage into a fabricated linear bonus. Its default result is a range between zero and the listed reference bonus. An informed user may switch to a manual effective percentage within that range. The smaller required-event bound uses higher damage and vice versa. These are bounds within the chosen scenario, not validated engine caps.

Tactile Endurance is omitted entirely from the attack calculator at the user's request. It remains in the standalone mutation catalogue. Its stamina wording does not establish HP resistance or a conversion cost, so it does not discount HP damage or change HP hit counts.

The supported active direct-HP damage boosters are Accelerated Prey Drive, Hemomania and Hypermetabolic Inanition. A coverage test matches this list against all current `combatRole: damage` catalogue entries. Congenital Hypoalgesia is incoming defense. Historical Intraspecific Aggression stays removed and is not added as an active option. No additional active outgoing HP-damage mutation with established numeric rules was found in the supplied references.

## Prey Drive event counting

The model checks remaining HP before each event. At exactly 35%, the event uses ordinary damage. After crossing strictly below 35%, subsequent events use the low-health damage. This event-order convention is explicit; the guide does not document engine order beyond the health condition.

For maximum HP `H`, starting HP `S`, ordinary damage `D` and low-health damage `L`, the model counts ordinary events until `remaining HP < 0.35H`, then applies `ceil(remaining HP / L)`. It stops at death, so a killing event does not trigger an additional bonus event. A closed form avoids a potentially huge loop; near-integer quotient normalization corrects floating-point representation noise while preserving real source remainders. No mutation-selected path rounds source damage before counting.

Bleeding and species-size conditions stay fixed during the modeled events. The calculator does not simulate bleeding health loss, healing, armor, event timing, changing hunger or stamina. Tick and unverified venom events keep their existing unit/caveat labels; applying percentage scenarios to them does not validate their engine interactions.

## Checks

- 1,807,936 captured source attack/representative-target combinations preserve the unmodified baseline.
- 1,344 independent exact-decimal `BigInt` per-event simulations agree with the closed-form Prey Drive count, including the strict threshold and fractional source damage.
- A separate review's 6,300 rational event simulations also passed.
- Actual React event-handler tests cover both combatants, all conditions, strength changes, ranges/manual values, reset, unknown values, disabled diets/wildlife, mutually exclusive size conditions and the requested text removals.
- Tests verify that one result block precedes the controls; sticky styling keeps feedback visible without duplicating it.

Run `node --import tsx --test tests/mutations-combat.test.ts tests/mutations-ui.test.ts tests/combat-numeric.test.ts` for the focused suite. No live application or game validation is claimed.
