# Ringdoku and Venndoku: size, interlock and difficulty

November 9, 2026. The owner prefers these circle experiments over Arrow/Thermo, suggests Ringdoku for the rings and tentatively Venndoku for overlaps, and requests a broad computational sample rather than assuming which structures can work. Names, production rule configurations and difficulty ratings are not finalized by this exploration.

Open [the expanded gallery](prototypes/circle-gallery.html). It contains **15 models and 135 playable samples**, selected from **3,900 generated candidates**. Each model has Guided, Pattern hunt and Sparse/stretch presets, with three samples per preset. Each playable sample has exactly one completion under both a cell-based bit-mask search and a separately implemented exact-cover counter. Complete stored answers and overlap-node memberships were also checked against every actual shape/group. Empty-board and contradictory-given controls returned multiple/zero completions respectively in both counters for every model.

The [computation report](prototypes/CIRCLE-COMPUTATION.md), [sample bank](prototypes/circle-samples.json), [model/solver code](prototypes/circle-models.mjs) and [reproduction script](prototypes/build-circle-samples.mjs) are local prototype artifacts. Serve `app/` on a separate local origin; the gallery fetches its JSON/module from the same origin. It never reads the production player's local storage, APIs, history, scores or daily seeds.

## Ring directions

| Direction | Cells / values | What the sample establishes |
| --- | --- | --- |
| Standard 4×4 rings | 16 / 1–4 | Familiar visual scanning; current sample audit uses single-candidate placements |
| Standard 6×6 rings | 36 / 1–6 | Selected sparse examples include group intersections/pairs; one goes beyond the limited explanation engine |
| Standard 8×8 rings | 64 / 1–8 | More involved selected deductions, including pairs/triples; full notes become extremely thin in the radial layers |
| Wide six | 18 / 1–6 | Three rings and two-spoke six-cell wedges preserve larger cells; no individual-spoke 1–6 rule |
| Wide eight | 32 / 1–8 | Four rings and two-spoke eight-cell wedges avoid eight radial layers; full notes still need closer review |
| Two independent halves | 32 / 1–4 | Precisely two small puzzles in one circular drawing; there are two disconnected constraint components |
| Linked halves | 32 / 1–4 | Four-cell bands cross both seams; seven of nine selected samples lose uniqueness if the bridge groups are removed |
| Three linked sections | 48 / 1–4 | Three small sectors communicate through bridges; seven of nine selected samples need those bridges for uniqueness |

In the current geometry estimates at a 360px board, the standard four, wide six, linked halves and linked thirds support approximately 10.3px candidate fonts. Standard six is approximately 6.2px and standard eight approximately 3.2px for a complete upright note block inside the narrowest wedge. These are estimates from fitting candidate rectangles, not a claim of measured text accessibility. The 6×6 and 8×8 wheels therefore remain stress comparisons rather than preferred unzoomed phone defaults. A selected-cell magnifier supplements whole-board notes; it does not make tiny global notes readable.

The linked 1–4 directions offer stronger cross-section deductions while retaining four candidate slots. Current sparse examples use hidden singles as well as direct singles; this demonstrates interdependence, not an established expert tier. The gallery lets players inspect the actual ring, spoke, region and bridge groups from each cell.

Wide six/eight change the rule structure instead of merely stretching classic Sudoku. Two cells at a ring/wedge intersection have identical memberships, so at least one must be given. Their structural clue floors are 9 of 18 and 16 of 32 respectively. Roomier cells come with a different balance of givens and deductions.

## Overlap directions

| Direction | Cells / values | What changes |
| --- | --- | --- |
| Three circles | 13 / 1–6 | Original membership structure, varied clue layouts |
| Three circles, eight values | 19 / 1–8 | More exclusive cells, but not automatically deeper overlap reasoning |
| Four-circle clover | 9 / 1–4 | More shared groups with a small symbol set; selected examples remain approachable |
| Four-circle mesh | 12 / 1–6 | Pairwise and triple intersections, only one exclusive cell per circle; selected sparse examples use group-only placements |
| Five-petal mandala | 11 / 1–4 | Five circles, neighboring shared cells and one common center; selected examples still solve through direct singles |
| Three ovals | 13 / 1–6 | Same memberships, givens and answers as the three-circle samples; outline-only comparison |
| Three triangles | 13 / 1–6 | Same controlled puzzle data; pointed boundaries make some shared areas tighter |

**The interchangeable-position limit matters.** Two blank cells that belong to exactly the same shapes can swap different values without breaking any rule. Of k such cells, at least k−1 must therefore be givens for a unique completion. The three-circle/eight-value model has five exclusive cells in each circle: at least **12 of its 19 cells** must be given just to distinguish those positions. In the selected batch, that model is larger but its explanations still use direct singles. More digits alone are not a compelling hard-mode strategy here.

The mesh has no identical-membership clue floor and needs more cross-group reasoning in the selected sparse examples. Clover and petals offer visual variety but have not established a deep difficulty ladder. Additional overlap groups must add real constraints; extra outlines or stretched shapes alone do not change logical difficulty. The original circle, oval and triangle group graphs are deliberately equivalent to make that distinction visible.

Every overlap node's center was checked against the actual circle/ellipse/polygon geometry. The rule is membership by **cell center**, which is stated in the gallery. The four-circle mesh has approximately 51px minimum node-center separation at a 360px board; the eight-value three-circle model is closer to 41px. These are center distances, not certified hit targets. Narrow triple intersections, node hit areas and the clarity of a boundary behind a note circle remain physical-phone review items.

## What difficulty evidence does—and does not—mean

The audit implements naked singles, hidden singles, locked candidates across intersecting groups, naked pairs and naked triples. It records counts per sample and the first deductions. The gallery's next-deduction helper uses the current public clues/group rules, not the stored answer. Some uniquely solvable sparse 6/8-value ring samples outlast this limited engine; that is not proof that guessing is necessary.

Guided/Pattern/Sparse are teaching/clue presets, **not calibrated easy/medium/hard labels**. Clue count, board size, search-node count and number of circles are insufficient difficulty ratings. Human playtests must establish learning burden, scan length, group-switching effort, candidate complexity and enjoyment. A later production generator needs accepted technique bounds, puzzle identity/versioning and broader sampling/rejection evidence.

Distinct clue-position masks are counted in the report, but rotations, symbol relabelings and repeated deduction structures can relate samples. The finite batch demonstrates working varied examples, not unlimited non-equivalent puzzle supply or uniform random generation. No score, achievement, daily rotation, production game registry or native renderer is changed.

## Chosen annotation refinements

The owner selected **Adddoku's taller cell tabs**. Their divider now uses only 12% of the normal line color, keeping the clue header visually attached to its cell. The 10px header still adds 90px across nine rows; the choice is retained and the short-phone fitting problem remains explicit rather than substituting a different design.

The owner selected **Consecutive's reserved clue space** with symmetrical margins. Candidate padding is now **7px on top, bottom, left and right**. Switching to Adddoku or Consecutive in [the notes study](prototypes/mobile-notes-lab.html) selects the respective preferred design automatically; the other designs remain available for comparison. These are prototype changes, not completed production variant ports.

## Verification and next decision

The generation/audit command completed successfully and checked all 135 fixtures with both counters, all complete answers, shape membership, and positive/negative counter controls. Browser verification covered all 45 model/preset combinations, sample selection and complete solves of linked-half and mesh fixtures through the public controls. Runtime integrity passed for the protected files. Production source was not edited in this turn.

The narrow-view check exercises a 347px board inside a 390px browser viewport, including all four note slots in the 48-cell linked-thirds layout. A gallery-card minimum-width overflow found during that check was corrected. This is browser evidence, not physical-device or assistive-technology certification. The notes study's computed divider color has alpha 0.12 and its Consecutive candidate paddings are 7px on all four sides.

Saved views: [all fifteen models](prototypes/circle-gallery-overview.jpg), [linked-thirds playtest](prototypes/ringdoku-linked-thirds.jpg), [phone-width full-note stress](prototypes/ringdoku-phone.jpg), [faint Adddoku tabs](prototypes/adddoku-tabs-refined.jpg), and [balanced Consecutive spacing](prototypes/consecutive-spacing-refined.jpg).

Recommended next playtests: linked halves → linked thirds for Ringdoku; four-circle mesh → clover/petals for Venndoku. Compare all-note stress layouts at 320/360px and try the sparse examples before selecting game configurations or a real difficulty ladder. Keep the standard 6/8 wheels and shape-only equivalents as useful comparisons. No commit, push, deployment or store action is part of this exploration.

## November 10: testing shortlist and deeper Venndoku

The owner selected linked halves as the strongest direction, linked thirds conditional on showing both fixed wedge sets, wide rings for comparison with clear fixed two-spoke boundaries, and original 4×4 only as a later optional comparison. See [PLAYTESTING.md](PLAYTESTING.md) for the separate public testing implementation, Inspector contract and publication gates.

The previous overlap boards were subjectively too easy for the owner; do not advertise them as medium/hard. The new **local-only** [Venndoku frontier](prototypes/venn-frontier.html) has ten examples: three each of 6-symbol / 9-symbol / A–L woven oval networks, plus one optional sum-bridge board. [The computation report](prototypes/VENN-FRONTIER.md) distinguishes actual pair/triple/stall evidence from uncalibrated human difficulty. Woven ovals deliberately reuse standard Sudoku membership graphs, so this is a visual/rule-family exploration, not a claim to have invented a new mathematical puzzle. All outline/node memberships were checked. A change of shape or alphabet alone still adds no logical depth.


## November 11 irregular overlap samples

The local overlap lab opens with **Short and long ovals**. The three new directions scatter circles across rotated ovals with different lengths and varying membership counts. A circle counts in every oval that contains its center. The linked clusters have four groups with cells on both sides of the board. The deeper layout has circles that belong to four groups.

| Direction | Symbols | Circles | Ovals | Clues, more / fewer | Cross-oval eliminations in fewer-clue audit |
| --- | ---: | ---: | ---: | ---: | ---: |
| Short and long ovals | 5 | 20 | 8 | 10 / 6 | 2 |
| Linked clusters | 5 | 24 | 10 | 11 / 7 | 4 |
| Deep overlaps | 6 | 27 | 12 | 11 / 6 | 17 |

Both solution counters found exactly one completion for all six samples. The generator checks each outline against its circle memberships. The technique counts describe the solver's path through these examples. Human difficulty and physical phone readability still need playtesting.

Run `node app/docs/prototypes/build-venn-overlaps.mjs` from the repository root to regenerate the local bank.

## Linked thirds in the player

On November 23, the owner selected linked thirds 1–4 for the first player implementation. The four groups per cell match the playtest's fixed wedges, shifted wedges, spokes, and curved regions. **Outlines** layers the selected cell's group borders without changing number or note matches. **Rules** opens the interactive example, and **Feedback** accepts accountless written comments with public-results consent.

The geometry and rule definition live in `src/game/ringdoku.ts`. `defineRingLayout` builds the cells and the group memberships from the dimensions, symbols, region shape and shift. `src/ringdoku/geometry.ts` converts ring and spoke spans into drawing paths. The live player, interactive example and result chart share that geometry. Rule types can be edited in `defineRingLayout`, and their line styles are in `src/ringdoku/ringdoku.css`.

Keep the published rule and generator version addressable by its seed prefix when adding a new layout. For example, two or four sections can use the same engine by changing the division count in a new descriptor. Every group can contain at most one of each symbol. When it has one cell per symbol, that also requires every symbol to appear. Generation checks puzzle uniqueness as clues are removed. Levels describe clue density; Ringdoku currently has no calibrated par times, daily rotation entry, or achievement eligibility.
