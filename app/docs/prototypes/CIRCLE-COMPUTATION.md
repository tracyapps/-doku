# Circle sample computation — November 9, 2026

Searched 3900 generated candidates and selected 135 playable fixtures across 15 models, 3 samples per profile. Each playable fixture has one completion under both the cell-based bit-mask solver and an independently implemented exact-cover counter. Equivalent ovals/triangles reuse the three-circle givens and answers for a controlled shape comparison.

Profiles are clue-density/teaching presets, not calibrated easy/medium/hard ratings. The technique audit attempts naked singles, hidden singles, locked candidates across intersecting groups, naked pairs and naked triples. A stall means this limited explanation engine needs more techniques; it does not prove guessing is necessary. Search node counts are not used as human difficulty scores.

| Model | Cells / symbols | Givens range | Unique samples | Distinct masks | Logic completes | Min notes at 360px | Forced clue floor | Components |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ringdoku · 4 × 4 | 16 / 4 | 4–9 | 9 | 9 | 9/9 | ~10.3px | 0 | 1 |
| Ringdoku · 6 × 6 | 36 / 6 | 9–20 | 9 | 9 | 8/9 | ~6.2px | 0 | 1 |
| Ringdoku · 8 × 8 | 64 / 8 | 19–36 | 9 | 9 | 8/9 | ~3.2px | 0 | 1 |
| Wide rings · 1–6 | 18 / 6 | 9–13 | 9 | 9 | 9/9 | ~10.3px | 9 | 1 |
| Wide rings · 1–8 | 32 / 8 | 16–23 | 9 | 9 | 8/9 | ~7.4px | 16 | 1 |
| Two independent 1–4 halves | 32 / 4 | 8–18 | 9 | 9 | 9/9 | ~10.3px | 0 | 2 |
| Linked halves · 1–4 | 32 / 4 | 4–18 | 9 | 9 | 9/9 | ~10.3px | 0 | 1 |
| Three linked sections · 1–4 | 48 / 4 | 6–27 | 9 | 9 | 9/9 | ~10.3px | 0 | 1 |
| Venndoku · three circles / 1–6 | 13 / 6 | 7–10 | 9 | 9 | 9/9 | ~10.3px | 6 | 1 |
| Venndoku · three circles / 1–8 | 19 / 8 | 12–16 | 9 | 9 | 9/9 | ~8.6px | 12 | 1 |
| Four-circle clover · 1–4 | 9 / 4 | 3–5 | 9 | 9 | 9/9 | ~10.3px | 0 | 1 |
| Four-circle mesh · 1–6 | 12 / 6 | 5–8 | 9 | 9 | 9/9 | ~10.3px | 0 | 1 |
| Five-petal mandala · 1–4 | 11 / 4 | 3–7 | 9 | 9 | 9/9 | ~10.3px | 0 | 1 |
| Three ovals · 1–6 | 13 / 6 | 7–10 | 9 | 9 | 9/9 | ~10.3px | 6 | 1 |
| Three triangles · 1–6 | 13 / 6 | 7–10 | 9 | 9 | 9/9 | ~10.3px | 6 | 1 |

The forced clue floor is a structural lower bound from identical membership signatures: if two blank cells belong to exactly the same groups, swapping their different values gives a second solution. At least k−1 of k such interchangeable cells must therefore be givens. This is a lower bound, not an assertion that the bound is attainable or that these givens alone establish uniqueness.

Distinct masks count clue positions only, not independently proven classes of solving experience. Digit relabeling, symmetry and repeated logical structures can still relate samples. This finite batch does not prove an unlimited generator, uniform sampling or a stable difficulty ladder.

Counter controls also passed for every model: both methods return at least two completions (capped at two) for an empty board and zero completions for a board with a repeated given inside a group. All stored complete answers satisfy every group.

The note-size estimates fit an upright candidate block inside each ring wedge. They are geometric font budgets, not measured text legibility or screen-reader/touch validation. The overlap node-spacing metric is center-to-center distance at a 360px board, not a certified touch-target size.

Ovals and triangles intentionally retain the three-circle membership graph. Their independent clue samples vary, but the change of outline is not a new logical constraint. Their geometry can still change reading difficulty.

Computation completed in 1.25 seconds. Run node app/docs/prototypes/build-circle-samples.mjs to reproduce the bounded sample bank. No production files, persistence, scores or daily rotation are read or changed.
