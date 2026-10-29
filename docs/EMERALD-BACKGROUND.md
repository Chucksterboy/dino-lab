# Emerald Lab background

The chosen green research-console concept is implemented as a persistent scene behind the main workspace on every page. It is outside the keyed page-transition and scroll containers. Navigation, title bar, sidebars, cards, panels and dialogs keep their existing surfaces and controls.

The procedural canvas draws a rotating particulate DNA helix, scanning rings, instrument grids, changing decorative coordinates, A/C/G/T and binary sequences, histogram telemetry, motes and a slow scanner. These are decorative instrument marks, not game statistics. Time-zero produces a complete static scene. The transparent wireframe skull is generated artwork saved at public/backgrounds/emerald-skull.png; see [its exact prompt and provenance](EMERALD-SKULL-PROMPT.md).

## Motion and resource limits

- CSS-pixel rendering is independent of the canvas backing store. DPR is capped at 1.5, total backing pixels at 3 million and backing edge at 8192px.
- A requestAnimationFrame controller paints no more than 30 frames per second. Geometry changes resize only when needed.
- Hidden documents and minimized/hidden native windows cancel the loop. Visible unfocused windows continue without resetting their animation phase. The canvas running flag also pauses the skull's gentle CSS drift.
- Saved and system reduced-motion settings prevent the loop and render static scenery. Cleanup cancels frames and removes every observer/listener.
- A failed or unavailable canvas leaves the CSS gradient/decorative image usable and does not block application controls.
- All decorative layers are hidden from accessibility APIs and cannot intercept pointer input.

## Readability and scope

The scene has a dark header/center veil; container queries reduce intensity below 1280px and 900px of actual workspace width, accounting for the species sidebar. No data values, source snapshots, attack calculations or image motion settings change. The background remains fixed while the content scrolls.

Nonvisual tests validate frame scheduling, reduced motion, visibility/minimization, cleanup, capped finite allocation, deterministic and finite renderer commands, balanced canvas state and bounded drawing work. TypeScript and native asset packaging are checked separately. Visual quality, sustained frame pacing on the user's hardware and appearance at each window size remain the user's manual review; no browser, screenshot or headless QA is performed.

## Opening scene

The same scene is imported directly by StartupScreen, so it can animate before the main application/data module has loaded. The pulsating logo, title and loading status sit above the decorative background. Saved reduced motion and native window visibility apply to the intro itself. Bootstrap retains its original readiness checks, 3.5-second timing and 300ms fade; the covered App scene stays static until the intro is removed to avoid duplicate active backgrounds.
