# *doku — result-display brand spec

Extracted from the live game (`games/*doku/app/src/themes/*.css`, `src/game/session.ts`,
`src/game/network.ts`) on 2026-09-26. These are observed values, not invented ones.
The shareable result display must consume this exact token contract so it inherits
whatever skin the player has chosen.

## One-sentence system

A calm, high-legibility puzzle surface built on a dark navy default, a single pastel
accent per skin, rounded-but-not-bubbly geometry, and Outfit headlines over DM Sans
body text — the same contract in every one of the twelve skins.

## Token contract (what every skin defines)

| Token | Role |
| --- | --- |
| `--bg` | Page / board base |
| `--surface` | Raised controls, cards |
| `--surface-soft` | Inset cells, alternate regions |
| `--text` | Primary text (maps to craft `--fg`) |
| `--muted` | Secondary text, labels |
| `--accent` | The one accent: selection, active, CTA |
| `--accent-ink` | Text drawn on top of `--accent` |
| `--accent-soft` | Low-emphasis accent fill |
| `--grid-line` | Hairlines, dividers (maps to craft `--border`) |
| `--region-line` | Strong board / region outline |
| `--error` | Conflicts, reveals |
| `--dialog-bg` | Sheets and modals |

## Anchor palettes (measured)

**Dark anchor — `night` (default).** `--bg` `#0d1928` · `--surface` `#1c2a3b` ·
`--surface-soft` `#142233` · `--text` `#f5f6fa` · `--muted` `#a9bbd2` ·
`--accent` `#9bf0c4` · `--accent-ink` `#102f25` · `--accent-soft` `#203e3c` ·
`--grid-line` `#35465b` · `--region-line` `#a7bbd4` · `--error` `#ff9eaa` ·
`--dialog-bg` `#172536`.

**Light anchor — `paper`.** `--bg` `#faf7f1` · `--surface` `#eee9e3` ·
`--surface-soft` `#f5f0e9` · `--text` `#242938` · `--muted` `#626775` ·
`--accent` `#705caf` · `--accent-ink` `#fff` · `--accent-soft` `#e7def8` ·
`--grid-line` `#d2cbd3` · `--region-line` `#666375` · `--error` `#b71e45`.

Other shipped skins observed: `contrast` (`#ffe96b` on `#050505`), `plum`, `retro`,
`comic` / `comic-dark`, `doodle`, `glass`, `rounded` / `rounded-dark`.

**Blackboard** is intended as the dark counterpart to `doodle` (the game ships it as an
unfinished copy of the light doodle file). Target palette for the result display:
`--bg` `#1b2723` · `--surface` `#334139` · `--surface-soft` `#23302a` · `--text` `#eef3ea` ·
`--muted` `#a6b6a8` · `--accent` `#efd98a` (chalk) · `--accent-ink` `#1f2a22` ·
`--grid-line` `#46544c` · `--region-line` `#ccd8cb` · `--error` `#f0a29e`. Display type is a
chalk/handwriting stack (`"Chalkboard SE", "Chalkboard", "Marker Felt", "Bradley Hand", cursive`);
body stays DM Sans. The surface carries a chalk-dust grain plus half-erased doodles in the
outer gutters.

## Typography (observed)

- Display: `"Outfit", sans-serif` — weights 800–900, tight tracking (`-0.025em` to `-0.065em`).
- Body: `"DM Sans", sans-serif` — weight 400–700.
- Numerals: tabular (`font-variant-numeric: tabular-nums`) for timers.
- Comic/doodle skins substitute `"Comic Sans MS", "Bradley Hand", cursive`.
- No monospace token exists; a system mono stack is introduced for the share-tape.

## Observed rules that define the visual language

1. **One accent per skin.** Accent marks selection, active keys, and the primary CTA —
   never decoration.
2. **Difficulty is spelled out, never color-only.** The game names levels in text
   (`easy` · `medium` · `hard`) and pairs them with a chosen-state outline.
3. **Completion is celebrated, not scored into a single number.** Category recognition
   is preferred over one opaque total; a total, if added, must publish its formula.
4. **Metrics stay separate.** Time, first-entry accuracy, hints, checks, reveals, and
   autofills are recorded independently; assistance attribution is never folded into accuracy.
5. **Round, chunky, soft-shadowed geometry.** Controls are pill / large-radius with a
   visible border in `--grid-line`; comic and retro skins add hard offset shadows.
6. **Every state pairs foreground and background.** Active key = `--accent` on
   `--accent-ink`; selected cell = `--accent-soft` fill with a `--accent` inset ring.

## Measured metric vocabulary (from `stats()`)

`seconds`, `accuracy` (0–100 or null), `evaluated` (cell count), `hints`, `reveals`,
`checks`, `autofills`, `assisted` (bool). Result payload also carries
`difficulty`, `variant`, `completedAt`, `verification: "self-reported"`.
