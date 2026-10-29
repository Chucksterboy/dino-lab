# Windows build verification

## Current version 0.1.16

Built on 29 October 2026 with the same Emerald Lab background on the opening/loading screen. StartupScreen preserves the pulsating logo, title and loading/error copy above the shared scene. Saved/system reduced motion and hidden/minimized window state apply from the intro onward. Bootstrap readiness checks and its original 3.5-second duration/300ms fade are unchanged; there is no skip control. The covered App's canvas and CSS loops stay paused until the intro is removed, leaving one active background loop.

- Portable: `release/Dino Lab.exe`, **9,702,912 bytes**, ProductVersion **0.1.16**, SHA-256 `8F41B50C011515F39E3B1C7C9C16E290D5CDE596718FAF1E282468762D55AEA0`.
- Installer: `release/Dino Lab Setup.exe`, **6,111,602 bytes**, ProductVersion **0.1.16**, SHA-256 `71E16FFA7BC3E58E785E2660738252E98205BCA389B77EB0918D2EBB9ED772CA`.
- Versioned preview copies/report are retained under ignored `preview/`; canonical hashes match.
- Sequential production packaging passed TypeScript, Vite, isolated staging, Rust and NSIS. Rust compilation reported **1m 19s**; staging contains **34 files / 12,292,680 bytes**.
- The exact preview executable passed hidden early-exit `--verify-assets`: version 0.1.16, index present, all 34 assets, no missing files or hash mismatches.
- **138/138 existing nonvisual checks passed**. Independent source review confirmed foreground stacking, paragraph/loading layout, saved-motion initialization, lightweight startup dependencies, no duplicate active canvas and unchanged readiness/timer code. No visual or runtime timing acceptance is claimed.

Under the user's standing authorization, only canonical previous-app PID **13592** was stopped after artifact verification. The verified files were promoted and the canonical app reopened: PID **5584**, title **Dino Lab**, window handle **463145152**, Responding **true**, ProductVersion **0.1.16**, path `E:\Dino Lab\release\Dino Lab.exe`. These are read-only process observations after a local file-copy restart. No installer or update helper was executed.

No browser, headless-browser, screenshot, visual or game QA was performed. The user owns appearance review. GitHub publication is performed separately after these artifact checks.

## Historical version 0.1.15

Built on 29 October 2026 with the Source 1 sanctuary reference also available on Source 2 graphs, without changing Source 2 keyframes or statistics. Reference bands begin at observed coverage and clip to the plot; missing flags remain unknown. Visible unfocused windows now continue animating; native minimized/hidden state suspends the canvas and CSS loops, and saved/system reduced-motion preferences remain effective. The library footer and requested table/scatter explanation paragraphs are removed. Emerald Lab and both dinosaur artwork sizes remain animated.

- Portable: `release/Dino Lab.exe`, **9,702,400 bytes**, ProductVersion **0.1.15**, SHA-256 `64006475DE887FBCF6BA26A8743BE81415FD8E7ECDFE174C3F9FC1F7742E9C8D`.
- Installer: `release/Dino Lab Setup.exe`, **6,109,486 bytes**, ProductVersion **0.1.15**, SHA-256 `E38055067AE13B48BE33B8FD515C81ACA7DC8A0D0304C04CE1B067D5F7350C0B`.
- Byte-identical versioned preview and release-upload copies are retained in ignored output folders.
- Sequential production packaging passed TypeScript, Vite, isolated desktop staging, Rust and NSIS. Rust compilation reported **1m 22s**; staging contains **34 files / 12,291,734 bytes**.
- The exact preview executable passed hidden early-exit `--verify-assets`: version 0.1.15, index present, all 34 assets, no missing files or hash mismatches. Canonical and upload copies match the verified previews by SHA-256.
- **138/138 nonvisual tests passed**, including the new sanctuary attribution/coverage/clipping cases, visible-unfocused phase continuity and native window state query/subscription races and cleanup. Independent read-only reviews found no sanctuary-data or animation integration blocker. Default Tauri permissions were confirmed to include the two native read-only window-state getters; no native capability expansion was required.

Under the user's standing authorization, only previous canonical app PID **71396** was stopped after artifact verification. The verified app, installer and report were promoted; the canonical app was reopened as PID **35680**, title **Dino Lab**, window handle **960299820**, Responding **true**, ProductVersion **0.1.15**, path `E:\Dino Lab\release\Dino Lab.exe`. These are read-only process observations after a local file-copy restart. No Windows installer or update helper was executed.

No browser, headless-browser, screenshot, visual or game QA was performed. Appearance and native minimize/restore acceptance remain with the user's manual session. GitHub publication is performed separately by the release publisher after these artifact checks.

## Historical version 0.1.14

Built on 29 October 2026 with the selected Emerald Lab animated backdrop across all workspaces. The persistent canvas draws particulate rotating DNA, scan rings, grids, changing decorative coordinates/gene sequences, telemetry and particles, plus a generated transparent wireframe skull. Dark text veils and container-based dimming preserve the existing opaque content surfaces. The scene remains outside page transitions and scrolling content. Original species data, attack calculations and Gallimimus speeds are unchanged; existing artwork motion remains included. See [implementation and verification scope](EMERALD-BACKGROUND.md) and [generated asset prompt/provenance](EMERALD-SKULL-PROMPT.md).

- Portable: `release/Dino Lab.exe`, **9,701,888 bytes**, ProductVersion **0.1.14**, SHA-256 `267756CCDF4AEF8DF9B04EAE215C06A20FFCC5D224EC2332BD4D74B39A7522F1`.
- Installer: `release/Dino Lab Setup.exe`, **6,110,356 bytes**, ProductVersion **0.1.14**, SHA-256 `A6DBD8910C905EEA66A96A4E027824D187C7A19A7260B39A0F8FFB71052F88B1`.
- Matching versioned previews and diagnostic report are retained under ignored `preview/`.
- Sequential production packaging passed TypeScript, Vite, isolated asset staging, Rust and NSIS. Rust release compilation reported **1m 36s**; staging contains **34 files / 12,291,419 bytes**, including the generated PNG.
- The exact preview executable passed hidden early-exit `--verify-assets`: version 0.1.14, index present, all 34 assets, no missing files or hash mismatches. The source and staged skull asset hashes match; decoded PNG inspection confirmed genuine transparency and visible content. Canonical portable, setup and report hashes match the verified previews.
- **128/128 nonvisual tests passed**, including 7 background-runtime cases and 4 renderer cases. Coverage includes reduced motion, hidden/focus pause, cleanup, 30fps cap, finite bounded backing allocation, deterministic valid canvas commands, context balance and bounded work through 4K/extreme inputs. Two independent code reviews found no blocker in integration, stacking, readability masks, scheduling or rendering. No native behavior changed in this revision.

The immediate pre-copy inventory found no canonical app process, so none was stopped. Under the user's standing authorization, the verified files were promoted and the canonical app opened: PID **71396**, title **Dino Lab**, main-window handle **2228300**, Responding **true**, ProductVersion **0.1.14**, path `E:\Dino Lab\release\Dino Lab.exe`. These are read-only process observations after a local file-copy update. No Windows installer or update helper was executed.

No browser, headless-browser, screenshot, visual, sustained-frame-rate or game QA was performed. The user owns appearance review. No GitHub publication was performed for this revision.

## Historical version 0.1.13

Built on 29 October 2026 with the same subtle species-specific idle motion on all 22 large species-page pictures and library cards. The shared SpeciesArtwork component uses independent transforms for the continuous wrapper motion and the existing 0.35-second hero image entrance. Hero image dimensions, filters, descriptive alt and stationary coordinate/caption labels are preserved; wildlife placeholders remain unchanged. Offscreen/hidden-document pausing, stable species timing and both reduced-motion preferences are shared across both artwork sizes. No species or combat data changed.

- Portable: `release/Dino Lab.exe`, **7,592,448 bytes**, ProductVersion **0.1.13**, SHA-256 `18B3A7E1DB6A002507C37EB95058B6A16B1B3EBDED436926ED8F893D83D335A9`.
- Installer: `release/Dino Lab Setup.exe`, **3,974,564 bytes**, ProductVersion **0.1.13**, SHA-256 `99D6A01FD734D8621984C34C9A12C92E5F14C3A5821365816BFFE7DB99FCCA08`.
- Matching versioned preview binaries and diagnostic report are retained under ignored `preview/`.
- Sequential production packaging passed TypeScript, Vite, isolated asset staging, Rust and NSIS. Rust compilation reported **1m 14s**; staging contains **33 files / 10,078,279 bytes**.
- The exact preview executable passed hidden early-exit `--verify-assets`: version 0.1.13, index present, all 33 assets, no missing files or hash mismatches. Canonical copies match the verified preview hashes.
- **117/117 existing nonvisual checks passed**. Independent read-only code review confirmed image sizing, label stacking, accessible alt, separate entrance/idle transforms, visibility cleanup and reduced-motion handling. No visual acceptance is claimed.

Under the user's standing authorization, only canonical previous-app PID **78376** was stopped after asset verification. The verified app, setup and report were promoted and the canonical app reopened: PID **68696**, title **Dino Lab**, window handle **364120168**, Responding **true**, ProductVersion **0.1.13**, path `E:\Dino Lab\release\Dino Lab.exe`. These are read-only process observations after a local file-copy restart. No browser, headless-browser, screenshot, visual or game QA was performed; no installer/update helper was executed and no GitHub publication was performed.

## Historical version 0.1.12

Built on 29 October 2026 with subtle continuous motion for all 22 species-library dinosaur pictures. Stable species-based timing varies breathing/sway; Pteranodon has a gentle hovering loop, and heavy or low silhouettes move less. Only each cutout wrapper transforms, preserving fixed card dimensions and the existing child-image hover lift. Offscreen and hidden-document loops pause; app and system reduced-motion settings disable/reset the movement. Artwork, original species data, Gallimimus speeds and Attacks behavior are unchanged from 0.1.11.

- Portable: `release/Dino Lab.exe`, **7,592,448 bytes**, ProductVersion **0.1.12**, SHA-256 `7024EE829C9183610D84A70A16FC9A8F56653248BEE6F94FD1DEC43E85BC6FA4`.
- Installer: `release/Dino Lab Setup.exe`, **3,974,494 bytes**, ProductVersion **0.1.12**, SHA-256 `98CD3E035B1EC685BCDD17F5FFFD80FE55E9D0E76CEDE6A9740F6CD550F7AB86`.
- Versioned preview binaries and the diagnostic report are retained under ignored `preview/` and match the canonical copies by SHA-256.
- Sequential production packaging passed TypeScript, Vite, isolated asset staging, Rust and NSIS. Rust release compilation reported **1m 13s**; staging contains **33 files / 10,078,077 bytes**.
- The exact preview executable passed hidden early-exit `--verify-assets`: version 0.1.12, index present, all 33 expected files, no missing assets or hash mismatches. Static staged-output inspection confirmed the new animation classes/keyframes and the absence of discarded headshot controls.
- **117/117 existing nonvisual JavaScript checks passed**. Independent read-only code review found no blocker in transform composition, stable timing, visibility pause/cleanup or reduced-motion behavior. No visual acceptance is claimed.

Under the user's standing authorization, only canonical previous-app PID **67640** was stopped after artifact verification. The verified app, setup and report were copied to their canonical paths, and the app was reopened: PID **78376**, title **Dino Lab**, window handle **60884050**, Responding **true**, ProductVersion **0.1.12**, path `E:\Dino Lab\release\Dino Lab.exe`. These are read-only process observations after a local file-copy restart.

No browser, headless-browser, screenshot, visual or game QA was performed. No Windows installer or update helper was executed. No GitHub publication was performed for this revision.

## Historical version 0.1.11

Built on 29 October 2026 with the explicit Update now installer workflow. Available-update notices and the bottom-left panel offer download/verification progress, retry on preparation errors, full process exit and a cached helper that waits for exit before opening normal Windows setup. Launch-time checks remain read-only. Gallimimus data is unchanged.

- Portable: `release/Dino Lab.exe`, **7,591,424 bytes**, ProductVersion **0.1.11**, SHA-256 `BE3D0F3DC06FFB926959272F4B04863C52660A66A49D9B689EA497E20F87A7A6`.
- Installer: `release/Dino Lab Setup.exe`, **3,973,365 bytes**, ProductVersion **0.1.11**, SHA-256 `CFCFF926192056721CEF760F6860E567E78B799DABB398CE3C2283E3F5243582`.
- Identical versioned preview copies and the diagnostic report are retained under ignored `preview/`.
- Sequential production packaging passed TypeScript, Vite, isolated desktop staging, Rust and NSIS. Rust release compilation reported 1m 28s. Staging contained **33 files / 10,075,175 bytes**.
- The exact packaged executable passed hidden `--verify-assets`: index.html present, version 0.1.11, all 33 files, no missing files or hash mismatches. The report was copied to `release/embedded-assets-report.json`.
- **117/117 JavaScript tests** and **28 native unit tests** passed. Coverage includes explicit-install-only behavior, deduplication, progress subscription/cleanup, retry, installer selection, repository/version/digest/size/header validation, Windows writer denial while the installer is read-locked, parent-handle/ready ordering and injected post-exit failure notification. Independent code review found no remaining high-priority blocker.
- The opt-in read-only native network check passed separately after the 0.1.11 bump. It read the real stable 0.1.10 feed and correctly returned current for installed 0.1.11, without downloading or installing anything.

Under the user’s explicit standing authorization to close and restart Dino Lab, root stopped only the canonical 0.1.10 app (PID **73464**) after the new artifacts were verified, promoted the byte-identical portable/installer/report, and launched the canonical 0.1.11 app. Read-only observations confirmed PID **40468**, title **Dino Lab**, main-window handle **535169666**, `Responding: true` and the canonical release path. This was a local file-copy restart, not an execution of the new installer handoff.

No visual/browser/headless QA, actual Windows setup, update-helper launch or native error dialog was executed during verification. End-to-end installation was not exercised on the user’s machine. Older app versions through 0.1.10 require one manual installer upgrade to gain the new button; future newer releases can then use it.

## Historical version 0.1.10

Built on 29 October 2026 after removing the species-library count callout and changing both combat mutation selectors to Default, Entombed 1 and Entombed 2. The fourth repeated maximum is not offered. Existing percentages, raw references, mutation catalog data and all Gallimimus speeds remain unchanged; the Galli investigation is paused at the user’s request.

- Portable: `release/Dino Lab.exe`, **7,498,752 bytes**, ProductVersion **0.1.10**, SHA-256 `14C1616F23F57B31E8C0C68FAA9581CC2CB4E0688D2868D842B1893B37583D8A`.
- Installer: `release/Dino Lab Setup.exe`, **3,944,247 bytes**, ProductVersion **0.1.10**, SHA-256 `BD3B9DADF981DD0167A7292D150473D65FF848F685F1EF0570C836B54D10E2B8`.
- Identical versioned review copies are under `preview/` with version 0.1.10 in their names.
- Sequential production packaging passed TypeScript, Vite, isolated desktop staging, Rust compilation and NSIS. Rust release compilation reported 1m 27s. The staged snapshot contains **33 files / 10,069,045 bytes**.
- The exact preview executable passed hidden `--verify-assets` diagnostics: version 0.1.10, index.html present, all 33 expected assets, no missing assets or hash mismatches. Its report was copied to `release/embedded-assets-report.json`.
- The full nonvisual JavaScript suite passed **110/110 tests**. Focused handler tests cover both selectors’ exact three options and damage/hit-count behavior at all three levels. No browser, screenshot or visual QA was performed.

The user confirmed exiting the prior app before promotion. The immediate process guard found no Dino Lab process; canonical portable/installer hashes match the verified previews. The desktop shortcut still targets `E:\Dino Lab\release\Dino Lab.exe`. The updated canonical app was launched at the user’s request: PID **73464**, title **Dino Lab**, nonzero main-window handle **186713768**, `Responding: true`, ProductVersion **0.1.10**. These are read-only process observations, not a visual review. No user process was stopped, no installer was run and no GitHub publication was performed for this update.

## Historical version 0.1.9

Built on 28 October 2026 from the frozen icon-code update. The source implements larger 31px glyphs in fixed 52px buttons, a 17-frame multicolour DNA rotation, opening/flipping book pages, a holographic comparison concept, live statistics bars and a brighter flask. **The user explicitly requested no visual QA for this revision. No UI, browser, headless-browser, screenshot or visual checks were performed. Appearance and animation quality are left to the user.**

- Portable: `release/Dino Lab.exe`, **7,498,752 bytes**, Windows ProductVersion **0.1.9**, SHA-256 `CB892C7240B75E6408CD45A8F11B6F3FAE3450B84E335CFAEC0AEC78815B2B29`. Identical preview: `preview/Dino Lab 0.1.9 Verified.exe`.
- Installer: `release/Dino Lab Setup.exe`, **3,943,068 bytes**, Windows ProductVersion **0.1.9**, SHA-256 `8550361261C8E6DA2387F26F672D0AFBA348672E52D29AADFB39D65D13BCBA11`. Identical preview: `preview/Dino Lab Setup 0.1.9.exe`.
- The existing **109/109 nonvisual Node unit tests** passed on the frozen sources. TypeScript checking passed. No additional visual test was substituted for the user's requested manual review.
- One sequential custom-protocol production build passed TypeScript, Vite, isolated asset staging, Rust compilation and NSIS packaging. Rust release compilation reported **1m 06s**. The frozen snapshot contains **33 files / 10,069,297 bytes** before native compression.
- The exact preview executable ran in hidden early-exit `--verify-assets` mode and exited **0** in **275 ms**. Its version is **0.1.9**; `index.html` and all **33** expected assets are present, with no missing files or hash mismatches. This diagnostic does not create or inspect a GUI. `release/embedded-assets-report.json` matches `preview/embedded-assets-report-0.1.9.json`. HTML presence is checked separately because Tauri injects its content security policy.

The user's 0.1.8 process, PID **21176**, was preserved during preparation/build. The immediate final pre-copy inventory was empty, so the verified portable, installer and report were safely promoted to their canonical release paths. Canonical and preview hashes/ProductVersions match. The existing desktop shortcut still targets `E:\Dino Lab\release\Dino Lab.exe`, with `E:\Dino Lab\release` as its working directory. Packaging did not launch a visible application, send GUI input, stop a user process, run an installer or publish a GitHub release. The parent agent owns the separately authorized launch and will record its process evidence; this revision makes no visual acceptance claim.

After promotion, the parent agent launched the canonical executable at the user's request. Read-only process observations confirmed PID **73936**, title **Dino Lab**, nonzero main-window handle **1657864344**, `Responding: true`, ProductVersion **0.1.9**, the canonical release path and the portable SHA-256 above. No visual QA or GUI input was performed; appearance review is left to the user.


## Historical version 0.1.8

Built on 28 October 2026 from the frozen motion/comparison update. All four navigation icons and the large flask now animate continuously while motion is enabled, without requiring hover. System and app reduced-motion preferences are respected. The unwanted empty-comparison sentence is removed and Clear all → Add remains functional.

- Portable: `release/Dino Lab.exe`, **7,496,192 bytes**, Windows ProductVersion **0.1.8**, SHA-256 `7A69C2F7876E9490C4AD90D08607A5F6D929A41C3CDC7BAF6DB21FDEDAEB1147`. The versioned preview `preview/Dino Lab 0.1.8 Verified.exe` is identical.
- Installer: `release/Dino Lab Setup.exe`, **3,942,032 bytes**, Windows ProductVersion **0.1.8**, SHA-256 `567114DDB7FFA72B9866F7FC80A93F12B767B4DB68F9604EC35DB0E034D0E366`. The versioned preview `preview/Dino Lab Setup 0.1.8.exe` is identical.
- One sequential production build passed TypeScript, Vite, isolated asset staging, Rust compilation and NSIS packaging. Rust release compilation reported **1m 09s**. The frozen snapshot contains **33 files / 10,059,952 bytes** before native compression.
- The exact preview executable ran in hidden `--verify-assets` mode and exited **0** in **274 ms**. `preview/embedded-assets-report-0.1.8.json` identifies **0.1.8**, `index.html` present, all **33** expected assets, no missing files and no hash mismatches. Its canonical copy is `release/embedded-assets-report.json`. HTML presence is checked separately because Tauri injects its content security policy.
- The complete JavaScript suite passed **109/109 tests**, and TypeScript checking passed. Final fresh-context isolated Edge checks at **1440×960** and **1100×760** confirmed continuous motion in all five icons, 33 animated SVG-part loops, visible changes over 1.2 seconds without hover, stable hit areas, both reduced-motion settings, the comparison flow and no horizontal overflow or runtime errors. These checks were against the frozen frontend, not input to the user's native session.

At preview verification, canonical PID **68108** still ran version **0.1.7**, so packaging initially left its release files untouched. After the user confirmed tray Exit and authorized update/launch, the parent agent's immediate pre-copy inventory was empty. The parent promoted the verified portable, installer and asset report to their canonical release paths; both binary hashes and ProductVersion **0.1.8** match the previews. The desktop shortcut still targets `E:\Dino Lab\release\Dino Lab.exe`, with `E:\Dino Lab\release` as its working directory.

The parent visibly launched that exact canonical executable at the user's request. Final read-only Windows observations confirmed PID **21176**, title **Dino Lab**, main-window handle **984155510**, `Responding: true`, version **0.1.8**, the canonical executable path and SHA-256 `7A69C2F7876E9490C4AD90D08607A5F6D929A41C3CDC7BAF6DB21FDEDAEB1147`. No GUI input was sent, no user process was stopped, no installer was run and no GitHub release was published. This records successful promotion and the requested launch; new native visual/animation acceptance is not claimed beyond the isolated frozen-frontend checks above.

## Historical version 0.1.7

Built on 28 October 2026 from the frozen calculator/catalogue update. The attack calculator no longer contains the Tactile reference panel. Both combatants show all three documented active outgoing damage controls, with selectable carnivore controls and explicit disabled eligibility reasons for other diets. The mutation page directly groups its 41 active entries into Universal (27), Carnivore (7) and Herbivore (7), with all nine unlock requirements retained in their applicable groups. The raw 43-entry source reference still preserves its two removed historical entries; those labels are not active catalogue cards.

- Portable: `release/Dino Lab.exe`, **7,494,144 bytes**, Windows ProductVersion **0.1.7**, SHA-256 `C5F0440E0F2F0C9B0DC6C746C62E93CAA215E157A4B94D9FCCA098D28CDBCF33`.
- Installer: `release/Dino Lab Setup.exe`, **3,939,905 bytes**, Windows ProductVersion **0.1.7**, SHA-256 `B683E2D4503FFB238CC6FFB9D67B5DF0F2AA15C21C4BA301EDE95930D0BED034`.
- Identical versioned review copies: `preview/Dino Lab 0.1.7 Verified.exe` and `preview/Dino Lab Setup 0.1.7.exe`.
- One sequential production build passed TypeScript, Vite, isolated asset staging, Rust compilation and NSIS packaging. Rust release compilation reported **1m 07s**. The frozen snapshot contains **33 files / 10,050,114 bytes** before native compression.
- The exact versioned executable ran in hidden `--verify-assets` mode and exited **0** in **278 ms**. Its report identifies **0.1.7**, `index.html` present, all **33** expected assets, no missing files and no hash mismatches. `release/embedded-assets-report.json` matches the versioned preview report. HTML is checked present separately because Tauri injects its content security policy.
- The complete JavaScript suite passed **109/109 tests**, and TypeScript checking passed. The focused 27-test combat suite includes active-damage catalogue completeness, enabled/disabled controls on both sides, outgoing and reverse effects, ranges/manual values, Tactile absence and the unchanged 1,807,936-case baseline.
- Isolated Edge checks at **1440×960** and **1100×760** verified all three direct groups (27/7/7), 41 active cards and nine unlock requirements, both carnivore panes, disabled herbivore choices, no Tactile calculator panel, actual Hemomania damage **175→183.75**, aligned headings, sticky feedback, and no horizontal overflow or runtime errors. These checks used an isolated browser rather than the user's native application.

The user's existing canonical process, PID **75532**, was preserved during compilation and exited naturally before promotion. The immediate pre-copy inventory found no Dino Lab application or installer processes. The verified portable, installer and report were then safely copied to their canonical release paths; all canonical/preview hashes match. The existing desktop shortcut still targets `E:\Dino Lab\release\Dino Lab.exe` and uses `E:\Dino Lab\release` as its working directory.

After promotion, the parent agent launched that canonical executable visibly at the user's explicit request. Read-only Windows observations confirmed PID **68108**, title **Dino Lab**, a nonzero main-window handle, `Responding: true`, the canonical path, ProductVersion **0.1.7** and the portable SHA-256 above. No GUI input was sent. This confirms the requested launch and process identity; it is not a claim of a new native visual/content review. No user process was stopped, no installer was run and no GitHub release was published.

## Historical version 0.1.6

Built on 28 October 2026 from the frozen mutation/reference update. The application now includes the complete 43-entry mutation catalogue, separate combatant loadouts and conditions, explicit stacking scenarios, stepped Prey Drive counting, Hypermetabolic ranges/manual effective bonuses, and a reference-only Tactile stamina effect. The active species catalog has 22 playable species and eight wildlife entries; BabyBoar, BabyDeer and BabyGoat are excluded from active navigation, search and selectors. Full original source captures remain available to independent source audits.

- Portable: `release/Dino Lab.exe`, **7,495,680 bytes**, Windows ProductVersion **0.1.6**, SHA-256 `74B5D2608E90D98E3F246A38DB9D57B6E7491B595CF14C92A255D24E42E47FC3`.
- Installer: `release/Dino Lab Setup.exe`, **3,940,456 bytes**, Windows ProductVersion **0.1.6**, SHA-256 `7B8E64CDBE834D1C7693499612A6FB49F7EE04FC4A8BD445E1B1610D94006B97`.
- Identical versioned review copies: `preview/Dino Lab 0.1.6 Verified.exe` and `preview/Dino Lab Setup 0.1.6.exe`.
- One sequential production build passed TypeScript, Vite, isolated asset staging, Rust compilation and NSIS packaging. The frozen snapshot contains 33 files totaling **10,057,845 bytes** before native compression.
- The actual versioned executable ran only in hidden `--verify-assets` diagnostic mode. It exited **0**, reported version **0.1.6**, found `index.html` and all **33** expected assets, and reported no missing assets or hash mismatches. `release/embedded-assets-report.json` and its versioned preview copy are identical. HTML is checked present separately because Tauri rewrites its content security policy.
- The complete JavaScript suite passed **106/106 tests**, and TypeScript checking passed. The no-mutation path preserved **1,807,936** captured attack/representative-HP combinations; **1,344** exact-decimal per-event simulations and a separate review's **6,300** cases checked Prey Drive. The visibility-aware Wildlife replay passed **25,664** actor-record/visible-target flags. See `MUTATION-COMBAT-MODEL.md` and `CALCULATION-NUMERIC-AUDIT.md` for scope and limits.
- Isolated Edge checks at **1440×960** and **1100×760** verified actual outgoing/incoming mutation controls, search/filter behavior, sticky result feedback, legible layout and no horizontal overflow or runtime errors. These were isolated browser checks, not input to the user's running app. Fresh Source 1 audit requests found no source changes; workbook metadata was unchanged against the same-day full captures.

The read-only process check at build start found the user's canonical 0.1.5 process (PID 69844). It was preserved during compilation. The final pre-copy inventory found **no Dino Lab application or installer processes**, so the canonical portable, installer and diagnostic report were safely promoted from the verified artifacts. Every canonical/preview copy hash matches. The existing shortcut remains `C:\Users\MOBPC\Desktop\Dino Lab.lnk`, targeting `E:\Dino Lab\release\Dino Lab.exe` with `E:\Dino Lab\release` as its working directory.

No visible native application was launched, no app input was sent, no user process was stopped, no installer was run and no GitHub release was published for this update. The hidden diagnostic establishes executable asset/version integrity; it does not claim a new manual native visual review or independent verification of all current game mechanics.

## Historical version 0.1.5

Built on 28 October 2026 after the complete numerical audit. The update corrects decimal hit-count boundaries, source/keyframe labels, fractional chart selection, wildlife HP/known attacks, small-value formatting and attack-event units. Native close-to-tray, saved Minimize on close, single-instance restore and the update checker remain included.

- Portable: `release/Dino Lab.exe`, 7,482,880 bytes, Windows ProductVersion 0.1.5, SHA-256 `20A0BA3129726385CEB769F805C9095D7219AA6DF0129AFA230B8C4FCAB0C508`.
- Installer: `release/Dino Lab Setup.exe`, 3,928,537 bytes, Windows ProductVersion 0.1.5, SHA-256 `99E52E3840FE4D99D66B8E2E2D1F72F703D778EB45C0547A09E141177CB1C23D`.
- Matching versioned review copies: `preview/Dino Lab 0.1.5 Verified.exe` and `preview/Dino Lab Setup 0.1.5.exe`.
- The final sequential Tauri production build passed TypeScript, Vite, isolated asset staging, Rust compilation and NSIS packaging. The frozen snapshot contains 33 files totaling 10,001,469 bytes before native compression.
- The actual versioned executable ran only in its early-exit `--verify-assets` diagnostic mode, with a hidden process. It exited 0 and reported version 0.1.5, `index.html` present, all 33 expected files, no missing assets and no hash mismatches. The report is `release/embedded-assets-report.json`, with an identical versioned preview copy.
- The independent calculation replay passed 54,747,276 body-hit combinations and 969,439 exact decimal boundaries, including 15,286 intended corrections to the legacy source's floating-point ceiling. All 35,354 original-source Wildlife card threat flags passed, preserving its explicit HP convention separately from the rounded-weight attack estimate. Source arithmetic, nearest-record selection, sub-unit readings and 3,432 chart render checks passed. The integrated JavaScript suite passed 70 tests; see `CALCULATION-NUMERIC-AUDIT.md` for coverage and qualifications.

Immediately before promotion, the read-only process inventory found no Dino Lab application or installer processes. The canonical portable, installer and diagnostic report were copied from the verified review artifacts; all copied SHA-256 hashes match. The existing desktop shortcut still targets `E:\Dino Lab\release\Dino Lab.exe` and uses `E:\Dino Lab\release` as its working directory. No visible application was launched, no GUI input was sent, no user process was stopped, no installer was run and no GitHub release was published for this update. Windows visual acceptance remains with the user's manual session.

## Historical version 0.1.4

Built on 28 October 2026. The update adds native close-to-tray, saved Minimize on close, explicit tray Open/Exit and single-instance restore. The user is performing the Windows visual checks; no automated UI input or visible app launch was performed for this update.

- Portable preview: `preview/Dino Lab 0.1.4 Verified.exe`, 7,481,344 bytes, SHA-256 `58E92531B76BA39A459C9F9BA4FE89F9B44F799F6D8E7104CB3331C680CECCAB`.
- Installer preview: `preview/Dino Lab Setup 0.1.4.exe`, 3,927,438 bytes, SHA-256 `4604D505AA3EBB8F8B9F27BF0959288DD45A3C5C1CAE484FB4596B2E89C364E3`.
- Native unit checks: 18 passed, including seven close-policy and persistence cases; one optional network check ignored.
- JavaScript unit checks: 51 passed, including nine desktop-preference service cases. TypeScript build passed.
- Actual executable asset diagnostic: exit 0, version 0.1.4, all 33 expected assets present, no missing files or hash mismatches.
- Two static reviews found no blocking issue in persistence, close interception, tray recovery or explicit Exit.

The user's running 0.1.3 session was preserved during packaging. After the user closed it and authorized application of the update, the canonical release/Dino Lab.exe, release/Dino Lab Setup.exe and release/embedded-assets-report.json were updated to 0.1.4. Both copied binaries match the verified preview hashes and report ProductVersion 0.1.4. The desktop shortcut still targets E:\Dino Lab\release\Dino Lab.exe. No visible app launch or GUI input was performed after promotion. See CLOSE-TO-TRAY.md for the user's manual checks.

## Historical version 0.1.3

Historical verification on 28 October 2026. The delivered files at that point were:

- `release/Dino Lab.exe`: 7,285,760 bytes; Windows ProductVersion 0.1.3; SHA-256 `3E5C473FBA3943DEEB0E69A35E9C661C689894E2EEB11781C93CDACA03369898`.
- `release/Dino Lab Setup.exe`: 3,872,245 bytes; Windows ProductVersion 0.1.3; SHA-256 `3BB508683E26E465AA4E44E992AC18C3AA6B925F4A6825674FEF41490A38E576`.

The verified preview, built executable and canonical portable copy have identical hashes. The installer copy matches the built NSIS installer. The desktop shortcut `C:\Users\MOBPC\Desktop\Dino Lab.lnk` still targets `E:\Dino Lab\release\Dino Lab.exe`, with `E:\Dino Lab\release` as its working directory.

The actual 0.1.3 executable was launched in its embedded-asset diagnostic mode. It exited with code 0 and reported version 0.1.3, `index.html` present, all 33 expected files embedded, no missing files and no SHA-256 mismatches. HTML is checked present separately because Tauri injects its content security policy. The resulting report is `release/embedded-assets-report.json`.

The native backend passed 11 unit tests, covering version precedence, release/asset validation, response size limits, rate-limit handling, trusted URLs and source-opening guards. Before the repository visibility change, an additional opt-in live test exercised the exact native HTTP checker against the private `Chucksterboy/dino-lab` repository. It returned `unavailable` in 0.99 seconds, with installed version 0.1.3 and no claimed latest version or release URL. A private or missing feed is not reported as up to date. No authentication token is included in the application.

After the user explicitly selected the same repository as the public release feed and its anonymous repository endpoint returned 200, the exact native live test was repeated. It passed in 0.11 seconds with `status: unpublished`, `currentVersion: 0.1.3`, and null latest-version, release-URL, release-name and publication-date fields. Its message was "No stable version has been published to GitHub Releases yet." The configured owner/repository did not change, so no application or installer rebuild was required. The canonical executable retains the SHA-256 recorded above.

The release helper was run without `-Publish`, using version 0.1.3, repository `Chucksterboy/dino-lab` and `docs/release-notes-0.1.3.md`. Local version, PE-header, asset and SHA-256 validation passed. The helper made no GitHub requests or writes. The repository was subsequently made public at the user's explicit request and is now the selected release feed. No GitHub release was published during these checks.

Before the public-feed transition, the canonical 0.1.3 portable executable was launched visibly in Windows and inspected through screenshots and the accessibility tree at `http://tauri.localhost/`. The complete species library and artwork rendered, the version reads 0.1.3, and the new Updates icon appears above Preferences at the bottom-left. Its App updates dialog showed the installed version and the expected unavailable result for the then-private repository. A manual Check again displayed the checking state and returned to unavailable without a false current claim; closing the dialog returned to the library. The larger typography and simplified profile were also checked in the preceding 0.1.2 native review. The 3.5-second intro and no-bypass behavior retain the timing verification documented in UI-VERIFICATION.md.

Following the public-feed transition, the canonical 0.1.3 executable was opened again in Windows. Its startup update status read "No release published yet". The visible Updates dialog showed installed version 0.1.3, latest version "—", and "No release published yet". Closing the dialog returned to the species library. This confirmed the new public-feed result in the actual application without rebuilding or republishing the binary.

The newer-release notice, all six statuses, keyboard containment/context, reduced-motion support and two supported desktop sizes passed 42 integration scenarios using an isolated browser with mocked native transport; see UPDATE-CHECKER-VERIFICATION.md. No fake public release was published for testing. The installer was built but was not installed during this verification.

## Version 0.1.1 update

At this historical verification, `release/Dino Lab.exe` and its installer were version 0.1.1. The executable's embedded-file diagnostic confirmed its version, index.html and all 33 assets, with no missing files or SHA-256 mismatches. The updated executable was opened visibly in Windows: the larger Dino Lab branding, larger species library text/artwork and the sidebar without Data & sources were confirmed. Automated input stopped when user interaction was detected in the updated window. The development server was then stopped.

All download/export/import/clipboard-transfer controls and the global SourcesView are removed, together with the native save command and its dependency. Automatic local comparison persistence remains. The focused readability/removal suite passed 775 checks at 1440×960 and 1100×760; 33 existing data/chart/calculation/staging tests passed. See READABILITY-VERIFICATION.md. The earlier verification below describes the original 0.1.0 build and its historical hash, not the current executable.

## Original 0.1.0 verification

Verified on 28 October 2026.

The first preview opened with `asset not found: index.html`. Two concurrent build operations allowed the native asset walker to observe an incomplete Vite output folder. The production build now embeds a separately staged and validated `desktop-dist` snapshot. Regression tests reject missing entry files and dangling bundle references and check that subsequent browser output changes do not alter that snapshot.

The replacement executable was run with its embedded-asset diagnostic:

- Verification exit code: 0.
- `index.html` is embedded.
- All 33 expected files are embedded.
- No missing files or SHA-256 mismatches.
- HTML is checked present separately because Tauri injects its content security policy.

The exact binary was then launched visibly in Windows and inspected through the Windows accessibility tree and window screenshots:

- The complete 22-species library rendered with artwork.
- Selecting Allosaurus opened the species profile, artwork, source/condition controls, stats and growth chart.
- Setting the native growth slider to 100% Prime produced 3,672 kg, 140 primary damage and 35.6 km/h.
- Selecting Frail at 100% produced 2,593 kg, 105 primary damage and 33.6 km/h.
- The application served its bundled interface through `http://tauri.localhost/`, rather than the development server URL. The development server was stopped after these checks.
- Further automated input was stopped when user input was detected in the app window.

Portable deliverable: `release/Dino Lab.exe`.

SHA-256: `4D3CDBFA45EDAE93C6CDE31FED4864FB5CB56952A09B242322B9A980C176462D`.

The copy launched for inspection and the portable deliverable have identical hashes. The installer was built successfully but was not installed during verification. Native Save As and source-opening argument validation passed their Rust tests; their full interactive dialogs, clipboard behavior and sustained frame pacing remain separate acceptance items.

Automated coverage: 33 data/calculation/component/chart/staging tests passed; 314 browser UI checks passed, including all 22 species pages, both growth paths, 516 displayed source values and all artwork. A separate comparison/table smoke test exercised independent sources, repeated specimens, numeric entry, configuration JSON, scatter plots and CSV export.
