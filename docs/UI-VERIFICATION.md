# UI verification

Run: 2026-10-28T01:40:16.219Z

Target: http://127.0.0.1:1420, isolated headless msedge, 1440 × 960. No existing user browser profile was used.

Result: **292 checks passed, 0 failed.**

- 22/22 playable species pages opened.
- 22/22 gallery images and 22/22 species images loaded with nonzero image dimensions.
- 84/84 Source 1 slider endpoints verified: 21 species × Prime/Frail × 25/100%.
- 88/88 Source 2 endpoints verified: 22 species × Prime/Frail × first/last exact source keyframe.
- 516/516 displayed weight, primary damage and sprint-speed readings checked against the independent local source snapshot.
- 516/516 Movement at a glance readings checked against their selected source and growth.
- 67 visits to the four information tabs: Overview, Movement, Survival and Attacks. Retired tabs, field-mechanics overview card and bottom footer are absent on all species.
- Rapid switching, typed hunger percentages, favorite persistence, search/empty state, keyboard search and reduced-motion preference exercised.
- 0 uncaught page errors; 0 failed requests.

The startup test held one application-module response for 650ms solely to observe the actual loading screen and confirm active CSS animation. This does not add a wait to application startup. Headless checks establish control/data behavior; they do not establish native Windows frame pacing, appearance or installer behavior. Native desktop visual checks and the separate comparison/table smoke test are recorded by the main build workflow.

All requested checks in this script passed.

Full machine-readable results: [ui-verification-results.json](ui-verification-results.json).
