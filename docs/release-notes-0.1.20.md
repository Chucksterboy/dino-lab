# Dino Lab 0.1.20

- Linked both combat health sliders to outgoing damage and hit counts using the recorded health penalty: no reduction at 50% HP or above, a linear reduction below 50%, and a maximum 50% reduction at 10% HP and below.
- Added live bite-force and damage-reduction readings beside the health controls for every playable dinosaur.
- Included Hypsilophodon in both combatant positions using its existing Source 2 bite and weight data when no Source 1 profile exists.
- Kept health effects separate from mutation bonuses, with unrounded damage used for hit counts.
- Removed the Source 1 attack-modifier panel, Source 2 attack-reference panel and bottom primary-damage notice from the Attacks tab.
