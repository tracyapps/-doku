# Mobile notes and visual circle puzzles

November 9, 2026 follow-up. The owner considers phone translation a deciding factor for additional variants. She solves primarily through visual placement patterns and wants *doku to welcome different solving styles. Circle/ring/Venn exploration is requested; no circular game name or production ruleset has been selected.

## Notes before decorations

[The mobile notes study](prototypes/mobile-notes-lab.html) compares three layouts with deliberately dense candidates. It supports 320/375/390/430px width budgets, short/tall height budgets, six rule presentations, dark/paper ink, value highlighting, note editing, full/sparse candidate density and an enlarged selected-cell view. Stress notes are intentional typography fixtures, not claims about valid puzzle candidates.

1. **Shared corner:** exposes the collision between a sum total and the top-left note. Avoid this for production sum cages.
2. **Taller cell tabs:** a 10px cell header preserves the note area's original height but adds 90px over nine rows. This may be viable on tall phones/tablets; it is not a universal phone solution.
3. **Reserved clue space:** a small top gutter keeps totals away from candidates within square cells. One combined selected-clue/notes strip enlarges information. This is a candidate direction, not an accepted final design.

The first 375×667 study overflowed by 18px with shared corners, 108px with tabs, and 78px with reserved space plus a separate clue strip. Combining selected clue information with the magnifier removed that duplicate strip; compact helper copy and spacing reduced the remaining overhead. Final 375×667 measurements: shared corner 0px overflow, tabs 87px, reserved clue space 0px; square cells are approximately 39×39px and tabbed cells 39×49px. The numeric note font is approximately 9.3px, with 15px notes in the enlarged view. These are study measurements; the production player still needs safe-area and actual-theme validation. Shrinking the entire board until it fits can defeat the note-readability goal.

Keep candidate slots stable (1–9 in their familiar 3×3 positions); never pack only present candidates into a moving sequence. A readable selected-cell magnifier supplements the whole-board pattern rather than replacing it. Match highlighting must preserve the other notes' contrast. Full Roman notes reach roughly 7px at a 375px width in the study; physical fit is not adequate readability. The study offers optional numeric notes while pen values remain Roman, for comparison. No production Roman-note default is selected.

## Variant-specific gate

| Variant | Mobile approach to prove |
| --- | --- |
| Xdoku | Quiet diagonal geometry behind notes, explicit group membership and selected-note contrast |
| Adddoku | Dedicated total position, inset cage lines independent of Sudoku region lines, readable selected-group total/remaining sum; no overlap with candidate slots |
| Consecutive | Dots centered on shared edges, distinct against both surfaces; touching a cell explains its neighbors without hiding negative constraints |
| Thermo | Bulb/path visible behind values and notes; a path cannot erase or wash out candidates |
| Arrow | Circle/shaft geometry avoids note positions; selected equation is enlarged outside the board |
| IXdoku | VIII in cells, keys and full notes at minimum width; compare Roman versus optional numeric notes and enlargement |
| MiniDoku | Four fixed note slots and correctly sized keys; first region proposal remains 2×2 |

Before a production candidate passes: full and sparse notes, empty/given/entered/selected/matching/error states, both input orders, each existing theme, narrow/short safe-area layouts and larger-text/assistive-technology behavior need evidence. Geometry/path semantics must carry to the native shared renderer. This task does not modify production board/note CSS.

## Two circles that actually have rules

[The circle lab](prototypes/circle-lab.html) contains two authored playable fixtures. Both support value-first placement/highlighting, fixed givens, notes, candidate penciling, erasing, undo, reset, selected-group highlighting and a guided first deduction. State is in memory; production saves/history are not touched.

**Orbit — familiar pattern, new geometry.** Four rings × four spokes; each ring, spoke and curved 2×2 region uses 1–4 once. This is MiniDoku's constraint structure in polar coordinates, not a new logical game. The center hole avoids tiny center wedges. Two-by-two note slots remain upright, instead of rotating text with the wedges. It demonstrates the user's pie-slice idea while keeping a familiar elimination pattern. A 9×9 wheel is not proposed: inner-ring density is an unresolved mobile problem.

**Overlap — intersecting possibilities.** Three overlapping circles each contain 1–6 once. A cell at an intersection belongs to every circle containing its center. There are 13 cells, including the shared center. In the teaching fixture, the circles' missing sets are {3,4}, {4,6}, and {4,5}; their common center must be 4. There are no hidden row/column rules and no arithmetic. This provides a real visual deduction rather than a decorative circular skin.

The independent all-different group solver finds exactly one completion for each original fixture and accepts both full solutions. Overlap's shared-center solve was completed through browser controls. This establishes that these examples are coherent; it does not establish a scalable generator, a difficulty ladder or long-term solving depth. Further authored examples with more overlap deductions should precede any production commitment. Treat both names as working labels and do not infer achievement/scoring/daily rules.

## Immediate player change

More → **Reset puzzle** clears entries, notes, undo/redo and the displayed timer on the same puzzle, retaining givens, seed, variant, difficulty, session/challenge identity, original start timestamp and first-entry/assistance provenance. The confirmation names the retained result history; reset cannot be undone. It is available on unfinished daily and free-play/challenge games. Completed sessions stay immutable; prior history and parked games are untouched.

More → **Change level** is separate and absent on daily games. It opens the existing same-family setup with the current level selected. Starting the replacement retains the existing level-change behavior. The pure reset helper appends ordinary zero-value actions for cleared entries so the existing challenge replay contract understands the reset without a new event/schema or API version.

Native impact: carry the reset helper, menu availability, confirmation and provenance semantics into the maintained shared paths when the native lane is initialized; CSS import or ancestry alone does not prove parity. No native branch/ledger is created on the production slice.

## Approved icon packaging

The owner approved the existing refined purple-grid/burst image. `public/assets/brand/doku-app-icon-master.png` retains that 1254×1254 master. Deterministic size exports provide regular 192/512px PNGs, a 180px Apple touch PNG and separately padded maskable 192/512px PNGs. The Apple link and web manifest now use those versioned asset paths; the original small brand/favicon mark remains available.

Maskable export recipe: resize the master to 368×368, center on a 512×512 opaque `#1b021e` canvas, then export its 192px counterpart. Bright artwork pixels in these outputs are within approximately 0.35 of the image width from the center; this is below the [manifest specification's 0.4-radius safe circle](https://w3c.github.io/manifest/#icon-masks). That pixel threshold checks colored artwork, not every subtle dark-border pixel. Visual round/square masks and actual phone installation remain separate evidence.

Only sizing, opaque backgrounds and mask padding were applied to the approved raster; the logo was not regenerated. The original generation prompt/provenance remains in [VARIANT-EXPLORATION.md](VARIANT-EXPLORATION.md). Its earlier draft/unwired statements describe the first exploration and are superseded by this follow-up's local asset wiring. Local changes are not a deployed icon update; do not clear browser storage/history to refresh an installed icon.

## Evidence and remaining gates

Focused session/reset and server-replay tests passed. The full game suite passed 33 tests; five packaging/API-route checks, typecheck, runtime integrity, preview build and web build passed. Builds retain existing dynamic-import/chunk-size warnings. Browser checks used a fresh local origin, separate from the owner's saved game origin. Daily notes were penciled and cleared, cancellation preserved them, reset retained the givens, and reload showed cleared notes. Free-play exposes both controls; Change level preserves the selected difficulty. The notes study's width/height/design switches, note editing, numeric/Roman comparison, match highlighting and paper treatment were exercised. Circle conflicts, undo, candidate notes, selected-group highlighting and the complete Overlap fixture were exercised; both original fixtures have exactly one completion under the independent solver.

Captures: [notes study](prototypes/mobile-notes-preview.jpg), [circle experiment](prototypes/circle-preview.jpg), [reset confirmation](prototypes/reset-confirmation.jpg). These are browser captures, not physical-device or assistive-technology evidence.

No deployment, live account/provider change, public roadmap issue, new-game registration or native implementation is part of this follow-up. No commit or push is implied. Physical phone installation, assistive technology and all-theme note parity remain unverified.
