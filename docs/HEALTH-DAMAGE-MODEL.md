# Health-dependent combat damage

The user supplied in-game displayed bite-force measurements for four Frail dinosaurs on 30 October 2026 and explicitly selected a shared percentage model for all playable dinosaurs. The user also confirmed no further bite-force reduction below 10% HP.

For remaining health percentage `H`, the model is:

`health multiplier = min(1, max(0.5, 0.375 + 0.0125 × H))`

| HP | Reduction from healthy damage |
| --- | --- |
| 50% or above | 0% |
| 49% | 1.25% |
| 40% | 12.50% |
| 30% | 25% |
| 20% | 37.50% |
| 10% or below | 50% |

## Supplied measurements

These are preserved observations, including the remaining discrepancies; the implementation uses the requested percentage rule rather than replacing observations to fit it.

| Frail species | Healthy bite | 49% HP | 40% HP | 30% HP | 20% HP | 10% HP |
| --- | --- | --- | --- | --- | --- | --- |
| Hypsilophodon | 1.4 | 1.39 | 1.21 | 1.05 | 0.88 | 0.70 |
| Ceratosaurus | 97.5 | 94.28 | 85.34 | 73.15 | 60.94 | 48.75 |
| Carnotaurus | 90 | 88.88 | 78.77 | 67.50 | 56.25 | 45 |
| Diabloceratops | 165 | 162.94 | 144.42 | 123.79 | 103.15 | 82.53 |

The user corrected Carno's 30% reading from 65.50 to 67.50, and Cera's 49% reading from 49.28 to 94.28. Cera at 49% remains below the model prediction of 96.28125; Hypsi at 40% remains below the prediction of 1.225. The Hypsi screenshot shows Poor Diet and no mutations were reported for that test. Growth, exact HP control, stamina and modifier settings were not independently measured by the app. This is a user-selected empirical model, not a claim of recovered engine code or independent validation of every species, condition and secondary attack.

## Integration

The health multiplier applies once to a playable attacker's unrounded selected base damage before outgoing mutation bonuses and the recipient's defense. Reversing combatant roles applies the target's own health to incoming damage. Recipient health separately controls remaining HP and the existing Prey Drive threshold. The selected attacker health stays fixed throughout each one-sided event-count estimate; this is not a reciprocal fight simulation. The “Without mutations” baseline retains the health penalty.

Both health controls show primary bite force after the health penalty and the percentage reduction. Those compact readings exclude mutation modifiers; the main results include selected attack and mutation scenarios. Healthy source values remain the inputs and are never overwritten or pre-scaled, avoiding a double penalty.

Source 1 remains the default matchup source. Only a playable species with **zero Source 1 samples** uses its Source 2 primary bite and weight/HP together. This currently covers Hypsilophodon, including selection as the target. Existing Source 1 profiles never borrow missing individual fields from Source 2. Hypsi Frail at 100% uses its captured Source 2 bite of 1.4 and weight/HP of 20; at 10% HP its bite is 0.7 and remaining HP is 2. Unknown special-attack values remain unknown. Raw source records are unchanged.

Wildlife damage remains its original reference value; no measured dinosaur wound curve is inferred for AI animals. Existing tick and unverified venom classifications and calculation caveats remain in the scenario UI. The Source 1 modifier panel, Source 2 reference panel and bottom primary-damage notice are removed at the user's request, while their captured data remains available to the model and source audits.
