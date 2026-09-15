# Theme & style editing guide

For anyone who knows CSS/SCSS well and doesn't want to touch the React/TypeScript logic. Everything in this doc has been checked against the actual code as of Sep 2026.

## The 30-second version

1. In a terminal: `cd app && npm run dev:web`
2. Open the URL it prints (usually `http://127.0.0.1:5173/`)
3. Click through the homepage footer to **Style guide** — a dev-only page showing every board/cell/keypad/note state, for every theme, on one screen
4. Use the **Preview theme** dropdown at the top of that page to pick the theme you're editing
5. Open the file for that theme in `src/themes/` (see the table below), make a change, hit save — the browser updates in under a second, no manual refresh, and nothing on the page resets

That style guide page already exists in the codebase for exactly this purpose ("FOR DEV REFERENCE... for spotting regressions and designing new themes"). You don't need to build a preview tool — just use it.

## How themes actually work

**Each theme is its own file:** `src/prototype.css` no longer holds any rules itself — it's just a manifest of `@import` lines pointing at `src/themes/*.css`. Shared, non-theme-specific stuff (layout, board/keypad structure, dialogs, settings sheet, style guide chrome, media queries, keyframes) lives in `src/themes/base.css`. Everything else is one file per theme:

| File | Theme |
|---|---|
| `src/themes/base.css` | *(shared layout, not a theme)* |
| `src/themes/night.css` | Night (the default) |
| `src/themes/paper.css` | Paper |
| `src/themes/contrast.css` | Contrast |
| `src/themes/plum.css` | Plum |
| `src/themes/retro.css` | Retro |
| `src/themes/comic.css` | Comic Book |
| `src/themes/doodle.css` | Doodle |
| `src/themes/glass.css` | Glass |
| `src/themes/rounded.css` | Web 2.0 ("rounded") |

Each theme file is self-contained — every rule in `retro.css`, for example, is scoped to `[data-theme=retro]` (or `.theme-retro` / `.theme-peek-retro` for the small swatch/preview chips), so it can never affect any other theme regardless of import order. You will do the vast majority of your work by opening one file in `src/themes/` and editing just that.

There's still no SCSS build step — these are plain CSS files, imported via native CSS `@import`, which Vite resolves and hot-reloads exactly like a single file used to.

**One React file only needs tiny edits, and only when adding a brand-new theme:** `src/Prototype.tsx`. This file is 3000+ lines of app logic, but the theme-related parts are two short lists near the top (a type declaration and an array of `{ id, label }` objects). You never need to write real logic here — see Recipe C below.

**Two tiers of theme** — decide which you're making before you start:

| Tier | Current examples | What it takes |
|---|---|---|
| Palette theme | Night (default), Paper, Contrast, Plum | One block of ~12 color variables. Everything else (board, keypad, buttons) inherits the shared layout in `base.css` and just repaints with your colors. |
| Expressive skin | Retro, Comic Book, Doodle, Glass, Web 2.0 ("rounded") | The same color block, *plus* 60–120 lines of overrides for board geometry, corner radii, shadows, keypad shape, fonts, and feedback animation. Each is a from-scratch redesign of the surface. |

Nothing stops a palette theme from growing into an expressive one later — start simple, add overrides only where you want a theme to feel different structurally, not just recolored.

### The token vocabulary

Every theme sets the same set of CSS custom properties; components read from these instead of hardcoded colors. Search for the property name to see everywhere it's used.

| Token | Controls |
|---|---|
| `--bg` | Page background |
| `--surface` / `--surface-soft` | Card/button backgrounds, alternating board regions |
| `--text` / `--muted` | Primary and secondary text |
| `--accent` / `--accent-ink` / `--accent-soft` | The theme's signature color, and the text color that sits on top of it |
| `--grid-line` / `--region-line` | Board borders (region-line is the bolder 3×3 box divider) |
| `--error` | Error/wavy-underline text color |
| `--dialog-bg` | Modal and bottom-sheet background |
| `--theme-value-font` / `--theme-value-weight` | The theme's default number/keypad typeface and weight (a player's explicit Settings choice overrides this) |
| `--selected-note-color` | Note color used when a selected cell/key is a dark fill (needed for contrast) |
| `--active-key-bg` / `--active-key-ink` | Active keypad button color (defaults to accent; Doodle overrides it) |
| `--jigsaw-0` … `--jigsaw-8` | The 9 region fill colors used only in the jigsaw board variant |

A palette theme only needs to define the first block (`--bg` through `--dialog-bg`) plus `color-scheme: light` or `dark`. Everything else falls back to sane defaults defined once in `base.css`.

### A note on Night

Night is the default theme, so historically its colors lived only as the bare, un-prefixed fallback values in the shared stylesheet rather than as their own explicit `[data-theme=night]` block. `src/themes/night.css` now exists as a first-class file with its own explicit rules (mirroring those same values), so you can edit Night exactly like any other theme.

One caveat: the un-themed style guide chrome (the outer page around the style guide itself, which deliberately renders with no `data-theme` set) still reads its colors from the bare fallback block in `base.css`, not from `night.css`. If you ever change Night's default colors, update both files, or the style guide's own chrome will drift out of sync with the Night theme it's meant to match.

### Finding your way around a theme file

Each file in `src/themes/` has been run through Prettier, so rules are on their own lines and indented normally — no more hunting through one giant minified line. Open the file for the theme you're editing and everything relevant to it is right there, in one place: color tokens, structural overrides, swatch chip, jigsaw palette, typography tokens, and homepage gallery preview.

`base.css` (the shared file) is the one exception, since it's not a single theme — it's organized with a header comment plus section comments to jump to: `.site-header {`, `.keypad {`, `.dialog-overlay {`, `.setting-row {`, `.styleguide-page`. Search for these strings, or just search a selector you already know (e.g. `.game-heading`).

## Recipe A — tweak an existing theme

1. Open that theme's file directly: `src/themes/<name>.css`.
2. Change colors, radii, shadows, whatever you want. Palette-level changes (colors, fonts) are near the top of the file, in the token block; structural changes (shapes, spacing, layout) are in the per-selector overrides further down.
3. Save. Watch it update live in the style guide with your theme selected in the preview dropdown.
4. If you want a change to apply to *every* theme instead of just one, it doesn't belong in a theme file at all — put it in `src/themes/base.css` on the relevant un-prefixed base rule (e.g. plain `.cell{...}`) instead.

## Recipe B — adjust game layout (header size, spacing, etc.)

The in-game puzzle header, timer, and similar chrome are **not theme-specific** — they're shared layout, so they live in `src/themes/base.css`, and changing them affects every theme at once unless you scope the change to one `[data-theme=x]`.

Key selectors, found under the `Compact game masthead` comment and nearby in `base.css`:

| What | Selector | Current value |
|---|---|---|
| Puzzle title on the game screen | `.game-heading h1` | `font-size: clamp(44px, 6.5vw, 58px)` — fluid, scales with viewport width between those two limits |
| Same, inside the phone-frame preview | `.in-preview .game-heading h1` | `font-size: clamp(42px, 12vw, 50px)` |
| Same, on narrow/mobile web | `.game-heading h1` inside `@media (max-width: 700px)` | `font-size: 54px` |
| Space below the header | `.game-header` | `margin-bottom: 20px` (12px in preview/mobile) |
| In-game compact timer chip | `.doku .game-meta .timer` | `min-height: 27px; padding: 3px 7px; font-size: 11px` |
| Round icon buttons (back, settings) | `.icon-button` | `46×46px` (39px preview, 41px mobile) |
| Page titles elsewhere (history, settings, etc.) | `.page-title` | `font: 800 38px/1.1 Outfit` (34px mobile, 32px preview) |
| Marketing homepage headline | `.home-hero h1` | `font-size: clamp(44px, 5vw, 68px)` |

Note there are two rules for `.game-heading h1` in `base.css` — an older fixed-size one near the top, and the `clamp()` one under the masthead comment. The later one wins (same specificity, later in the file), so that's the one actually controlling size — edit that one.

**Testing without exact target sizes:** since the header already uses `clamp(min, preferred, max)`, you can just resize your browser window (or drag with DevTools' device toolbar open) while the dev server is running and watch the header scale live, then dial in `clamp()` values instead of guessing a single fixed size. This works for any size you're adding, not just existing ones.

To make a layout change theme-specific instead of global, don't touch `base.css` — add it to that theme's own file instead: `.doku[data-theme=comic] .game-heading h1{font-size:70px}` in `src/themes/comic.css`.

## Recipe C — create a brand-new theme

This is the one recipe that touches `Prototype.tsx`, but it's two mechanical list edits, not programming.

1. Pick a lowercase, one-word id (e.g. `sunset`) and a display label (e.g. "Sunset").
2. In `src/Prototype.tsx`, search for `type Theme =`. Add your id as a new line in that list:
   ```ts
   type Theme =
     | "night"
     | "paper"
     | "retro"
     | "comic"
     | "doodle"
     | "glass"
     | "rounded"
     | "contrast"
     | "plum"
     | "sunset";   // ← add this
   ```
3. Search for `const themeOptions`. Add a matching entry (its position sets its order in every theme picker):
   ```ts
   { id: "sunset", label: "Sunset" },
   ```
4. Save — Vite hot-reloads `.tsx` edits automatically too, no restart needed.
5. **Duplicate the file of whichever existing theme is closest to what you want** — a palette theme like `src/themes/plum.css` for a simple recolor, or an expressive theme like `src/themes/retro.css` if you want a full structural redesign — and rename the copy `src/themes/sunset.css`.
6. Add the new file to the import list in `src/prototype.css` (order doesn't affect behavior between themes, but keeping it alphabetical-ish is easier to scan):
   ```css
   @import "./themes/sunset.css";
   ```
7. Inside your new `sunset.css`, find-and-replace every occurrence of the old theme's id with `sunset` (e.g. `[data-theme=plum]` → `[data-theme=sunset]`, `.theme-plum` → `.theme-sunset`, `.theme-peek-plum` → `.theme-peek-sunset`), then edit the actual color/shape values to taste.
8. That alone gives you a fully working theme, visible immediately in the style guide and Settings, including its swatch chip.

## Guardrails

`AGENTS.md` marks these files as protected runtime — don't edit them for theme/style work, and don't need to: `src/App.tsx`, `src/main.tsx`, `src/styles.css`, everything in `src/mobile/`, `public/assets/iphone/`, `public/assets/android/`, `public/assets/status/`, `vite.config.ts`, `worker/index.js`, `scripts/prepare-sites-build.mjs`. Those are the phone-frame device chrome (status bar, home indicator, etc.), not the game or its themes. If you can see something in the style guide or the in-game Settings sheet, it's fair game in `src/themes/`; if it's part of the simulated phone body itself, it's out of scope for a CSS tweak.

`npm run dev` (and `npm run build`) automatically run `npm run check:runtime` first, which will error loudly if a protected file got touched — a useful safety net, not something to work around. (`src/prototype.css` and everything in `src/themes/` are not protected — they're exactly the files this doc is about editing.)

## Quick answers

- **Will editing CSS break anything?** No — Vite just swaps the stylesheet live; nothing reloads or resets app state. A manual browser refresh always clears up anything that looks stuck.
- **Do I need `npm run dev:api` running too?** No, not for appearance work. That only powers the challenge-sharing backend; the style guide and Settings preview work without it.
- **`npm run dev` vs `npm run dev:web`?** `dev` opens the phone-frame mobile prototype (no footer/Style-guide link — but `/styleguide/` still works if you type it directly into the address bar). `dev:web` opens the plain desktop site, matching what's actually published, with the Style guide link clickable from the homepage footer. Either hot-reloads theme CSS the same way; use whichever view you're actually designing for.
- **Contrast reminder:** the focus ring, error text, and several component states pull directly from `--accent` and `--error`, so a new theme's accent/error colors should stay legible against its `--bg`/`--surface` the same way the existing themes do — the style guide's error/selected/matching states are the fastest way to eyeball this per theme.
- **What happened to the old single `prototype.css`?** It's been split into `src/themes/*.css` (one file per theme, plus `base.css` for shared layout); `prototype.css` itself is now just a 10-line list of `@import`s. A full backup of the old file was kept at `src/prototype.css.pre-split.bak` in case you ever want to diff against it — safe to delete once you're comfortable with the new structure.
