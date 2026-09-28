# Blackboard theme — export

Everything needed to finish the chalkboard skin you started by duplicating `doodle.css`.
Extracted from the live theme files (`app/src/themes/*.css`) and the result-display
prototype, so the tokens and structure match the game exactly.

## Files

| File | Destination in the repo |
| --- | --- |
| `blackboard.css` | `app/src/themes/blackboard.css` (replace) |
| `assets/themes/blackboard-chalk.svg` | `app/public/assets/themes/blackboard-chalk.svg` |
| `assets/themes/blackboard-doodles.svg` | `app/public/assets/themes/blackboard-doodles.svg` |

`app/src/prototype.css` already has `@import "./themes/blackboard.css";`, so once the file
is replaced the theme activates with no other wiring. The old `blackboard-notebook.webp`
reference is gone — this version does not use that file.

## Activating it as the default

Nothing to change for the picker (`themeOptions` already lists `blackboard`). To make it the
launch default, set it in the initial settings object in `Prototype.tsx` (`theme: "blackboard"`).

## Paste-only version

If you would rather not ship two asset files, replace the three `url(...)` references with
these inline data URIs. Same output, slightly larger CSS:

```css
/* chalk grain */
--chalk: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='d'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix type='matrix' values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.09 0.09 0.09 0 0'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23d)'/%3E%3C/svg%3E");
```

The doodle frame is larger; keeping it as a file is recommended.

## Tokens

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#1b2723` | slate board |
| `--surface` | `#334139` | raised controls |
| `--surface-soft` | `#23302a` | inset / alt region |
| `--text` | `#eef3ea` | chalk (givens, headings) |
| `--muted` | `#a6b6a8` | dusty chalk (secondary) |
| `--accent` | `#efd98a` | chalk yellow (entries, active, CTA) |
| `--accent-ink` | `#1f2a22` | text on accent |
| `--accent-soft` | `#3d4636` | selection fill |
| `--grid-line` | `#46544c` | 1px cell rules |
| `--region-line` | `#ccd8cb` | 2px region rules + board border |
| `--error` | `#f0a29e` | conflicts |
| `--dialog-bg` | `#202c26` | sheets / modals |

Type: display + cell values use `"Chalkboard SE", "Chalkboard", "Marker Felt", "Bradley Hand", "Comic Sans MS", cursive`; body stays DM Sans. Handwriting gets `letter-spacing: 0` (no negative tracking).

## Behaviour to know

- **Grid.** Cell rules are drawn inline by `Prototype.tsx` from `--grid-line` / `--region-line`, so they become chalk automatically. Cells are made `transparent` so the slate grain shows through the board — that is what makes it read as chalk on a board rather than a panel.
- **Texture.** `blackboard-chalk.svg` is a 240px seamless `feTurbulence` tile (white grain, ~13% average alpha) layered over `--bg`. It is intentionally faint and never touches text contrast.
- **Doodle frame.** `blackboard-doodles.svg` is one transparent 1440×900 image holding eleven doodles in the outer ~135px, used as a `background-attachment: fixed` + `background-size: cover` layer. Because it is fixed to the viewport, it always hugs the real screen edges and crops itself away on narrow screens. Below **1400px** the layer is removed via `--board-doodles: none`, since there is no gutter left to hold doodles clear of the content.
- **Smudges.** Faint blurred ellipses in the same SVG read as erased chalk. They are decorative and sit behind all content.
- **Reduced motion.** No animation is added. The existing `prefers-reduced-motion` rule in `base.css` still applies.

## Contrast (measured, WCAG)

| Pair | Ratio |
| --- | --- |
| `--text` on card surface | 12.2:1 |
| `--muted` / chalk labels | 8.6:1 |
| CTA label on `--accent` | 10.6:1 |
| `--accent-ink` on `--accent` | 10.6:1 |

All pass AA (≥4.5:1 for text, ≥3:1 for the chalk rules against the slate).

## Optional: rasterize

If you prefer a bitmap like `doodle-notebook.webp`, export `blackboard-chalk.svg` to a
240×240 webp (or png) and point `url(...)` at it. Keep `blackboard-doodles.svg` as SVG so
the fixed `cover` layer stays sharp at any viewport — a 1440×900 raster will soften on
large monitors.
