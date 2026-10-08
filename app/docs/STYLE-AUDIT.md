# *doku style audit — October 7, 2026

Scope: every current app/public screen and major visual state, all twelve themes, and classic sudoku, huedoku, and jigsadoku. This is a local browser/style audit and corrective implementation. Native builds, physical devices, live providers, production deployment, and store submissions were not tested or changed.

## Coverage and evidence

Themes: Retro, Comic Book, Comic Dark, Doodle, Glass, Web 2.0, Web 2.0 Dark, Night, Paper, Blackboard, Contrast, Plum. Internal IDs match `themeOptions` in `src/Prototype.tsx`.

| Evidence set | Coverage | Cases |
| --- | --- | ---: |
| Main matrix (`scripts/qa/style-matrix.js`) | All themes at 390×844 and 1280×900: home/Today, setup and each selected variant, populated history/detail and solo results, profile/awards, how-to, roadmap unavailable, privacy, terms, leaderboard/player unavailable; all three medium boards with notes/errors/given selections; Settings upper/lower sections, input-order help, More, restart confirmation, empty friends results | 600 |
| Account/service fixtures (`style-fixtures.js`) | All themes/sizes: sign-in, signed profile/friends/requests, par admin, deletion confirmation, populated leaderboard with long names, player relationship states, configured roadmap, empty history, expanded development style guide | 288 |
| Results/compact edges (`style-edges.js`) | All themes/sizes/variants: completed group results and all-five-views-disabled fallback; all five Run/Radar/Tracks/Tape/Grid concepts; hard jigsaw at 320×568 with maximum value/note size | 156 |
| Device preview (`style-preview.js`) | All themes/variants at hard difficulty, maximum value/note sizes in both iPhone and Pixel 10 frames; lower Settings captured for all themes/devices | 72 plus 24 Settings captures |
| Palette/minimum text (`style-palette.js`) | All themes/variants at easy difficulty with minimum sizes; diagnostic board with all nine jigsaw regions × given/entry/selected/matching/error/note states, using Theme/Clean/Bookish/Monospace and Theme/Regular/Medium/Bold weights | 228 |

Total: **1,344 screen/configuration checks**, plus the preview Settings captures and six focused style-guide rechecks. The 192 synthetic palette configurations are diagnostic CSS probes, not playable games. Medium/hard screens use the real puzzle/session engine; easy probes also use the real engine. Engine tests separately prove all three difficulty levels/variants.

Screenshots and measurements are retained locally under `output/playwright/` (ignored by Git). `before/` records the initial baseline; `final/` contains the main matrix and fixture reruns; `edges/`, `preview/`, and `palette/` contain the supplemental evidence. Each JSON row identifies theme, size/state or device/variant. Run `python3 scripts/qa/build-style-index.py` to regenerate the local `index.html` screenshot browser. Do not treat earlier screenshots as evidence for a later patch.

Inspection combines rendered screenshots, CSS/source review, DOM measurements, and a contrast collector. An independent review covered every theme's public/app contact sheets, group-result concepts, lower Settings, notes, compact headers, long-name rows, and iPhone/Pixel jigsaw screens. Contrast findings were investigated and corrected rather than automatically equating a collector flag with a defect.

Final geometry checks show no document overflow or title/timer collision across the main/fixture/edge/palette sets. All 72 framed gameplay cases keep a square board and the keypad inside the device screen. The final all-region/minimum-font palette pass has **zero sampled text-contrast flags**. The main matrix retains only decorative wordmark flags. Two development-only note pairings flagged by the fixture matrix and a Doodle pairing found in the independent screenshot review were corrected and rechecked on phone/desktop in `final/focused.json` (six cases, zero sampled flags); those focused receipts supersede the earlier style-guide rows. This is not a claim of complete WCAG, screen-reader, or physical-device conformance.

## Corrections

| Finding | Corrective behavior/files |
| --- | --- |
| Comic Dark chosen game type/level used pale text on yellow (description near 1.07:1) | Explicit `--accent-soft-ink`/`--accent-soft-muted` pair gives chosen controls dark ink; notices/share links/achievements on white also receive dark ink. `base.css`, `comic-dark.css` |
| Web 2.0 Dark jigsaw neon regions hid white values (roughly 1.29–3.47:1) | Nine distinct deeper region hues, visible region lines, readable selected/matching/pencil states. `rounded-dark.css` |
| Glass/Web 2.0 erased jigsaw bands or borders with shorthand/`!important` | Use `background-color` for cell fills; zero-border rules apply only outside jigsaw. Irregular piece edges survive highlights. `glass.css`, `rounded.css`, `rounded-dark.css` |
| Retro yellow surfaces inherited cream text, including portal controls and roadmap cards | Add surface foreground pairs throughout shared controls/cards/inputs; darker primary/keypad ink, dark navigation/social context, readable roadmap actions. `base.css`, `retro.css`, `social/social.css` |
| Pencil/given/error text lost contrast in selected/matching or midtone regions | Pair pencil ink to the actual selected/matching surface; preserve quieter givens at rest and full ink when selected/matching; darken Glass highlight mixes, adjust small error ink; Comic/Retro errors retain a stable light backing and wavy underline. Shared and affected theme files |
| Small functional red/orange links/status text was dim in Comic/Retro; selected Paper text and Web 2.0 muted copy were borderline | Separate `--link-ink` from decorative accent; pair destructive actions; adjust Paper/Web 2.0 foregrounds. `base.css`, `comic*.css`, `retro.css`, `paper.css`, `rounded.css` |
| Wide uppercase jigsadoku masthead collided with timer/actions on narrow screens | Responsive title/timer/action spacing at 390px/320px and explicit phone-sized preview title even in a wide desktop host. `base.css` |
| Long player names escaped leaderboard columns in every theme | Make name/handle blocks shrink and ellipsize while reserving the score column. Full identity remains on the linked player page. `social/social.css` |
| Development samples omitted several risky states | Add chosen type/level/surface samples, all nine hue patterns, selected/matching notes, and a populated jigsaw reference without its former narrow wrapper. `Prototype.tsx` |

No puzzle rules, account/provider contracts, service schemas, production routes, or protected device runtime files were changed.

## Remaining evidence and preview limitation

**Protected preview chrome:** black status icons/time and the iOS home indicator remain hard to see on dark game themes. `AGENTS.md`'s editing boundary explicitly says: “Do not edit, replace, remove, or recreate them unless the user explicitly asks to change the mobile runtime itself.” The listed protected files include `src/mobile/`, device/status assets, and runtime styles. This audit preserves that contract; a separate runtime change can make the simulated chrome theme-aware. Native apps must use and test real theme-aware OS system bars/safe areas, as specified in `NATIVE-APPS.md`.

The collector samples computed text foregrounds over composited ancestor background colors, uses 4.5:1 for small text and 3:1 for large text, and excludes hidden/disabled copy. It skips ordinary gradient backgrounds and does not fully model pseudo-elements, text strokes, SVG motifs, filters, backdrop blur, or native select popups. Jigsaw center text can be sampled because its gradients are thin edge bands. Decorative wordmarks are assessed as branding rather than small functional copy. Screenshots are captured before inspection to flush inherited style changes after selection/theme updates; earlier collector flags from incomplete style flushes are not final findings.

Social/account/roadmap/group visual states use **local intercepted API fixtures**. They establish layout, not actual email delivery, passkey/provider login, moderation, network persistence, or production account deletion. Missing local `/api` responses are expected in the unavailable-state matrix. All QA uses separate local origins so existing browser progress is preserved.

Native VoiceOver/TalkBack, hardware-keyboard navigation, real touch, large accessibility text, store-signed builds, and installed-update save preservation remain gates for the native work. Do not infer those from preview frames or browser tests.

## Repeating the audit

Use isolated origins, never the player's usual running origin. The collectors clear QA localStorage and several intercept `/api/**`.

1. Start `dev:web` on port 5186 and framed `dev` on 5187 (or edit the collector origins consistently).
2. Open an isolated Playwright CLI browser session. Use separate sessions for concurrent collectors; never operate the same page concurrently. Select the installed browser executable if Chrome is unavailable.
3. Create `output/playwright/final`, `edges`, `preview`, and `palette` directories. Before running matrix/fixtures, navigate to the QA origin with `?audit=final` so their output phase is correct.
4. Run `playwright-cli --session=<isolated-session> run-code --filename=scripts/qa/<collector>.js` from `app/`. Each file is a CLI function expression, not a Node program or CI Playwright spec. Review its screenshots and JSON together.
5. Recheck only affected states after a narrow patch; rerun the relevant matrix after shared layout/state changes. Keep visual fixture evidence separate from live service tests.

Validation for this change: `check:runtime` passes for all 28 protected files; typecheck, web build, preview/Sites build, 31 game/service tests, 8 mobile runtime tests, and 5 packaging/route tests pass. Builds retain existing large-chunk/dynamic-import warnings. Account tests print schema-bootstrap warnings while constructing their temporary fixture databases and still pass; that is not production migration proof. One keyboard-dismissal runtime check timed out during a concurrent audit run; its focused repeat and the final full eight-test suite passed. The cause was not established, and no runtime or test assertions were changed.

## Native handoff

The October 7 request compared preserving this interface with native controls. On October 8, the owner selected long-term maintainability, seamless account/history/save continuity and full platform integration over implementation speed. [The updated native plan](NATIVE-APPS.md) now targets React Native/RN macOS with RN Web for the shared browser/Discord player, one core/theme system and explicit platform adapters. It retains this visual baseline and proposes compatibility, migration/sync, platform, automation and store gates. Native compatibility and cross-device continuity remain unimplemented and unverified.
