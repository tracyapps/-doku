# Venndoku frontier — local exploration only

These are new, uncalibrated prototypes. Nothing in this bank ships in the public playtest.

Changing outlines or switching numbers to letters does not itself add deduction depth. The woven network changes memberships: every node belongs to three independently crossing groups. Its constraint graph is standard rectangular Sudoku re-expressed as intersecting ovals; it is not a newly invented mathematical puzzle. The original three-circle study had interchangeable exclusive nodes that forced many givens.

| Model | Nodes / symbols | Selected examples | Logical evidence |
| --- | --- | --- | --- |
| Woven ovals · 1–6 | 36 / 6 | 11, 10, 9 givens | {"single":0,"hidden":5,"intersection":0,"pair":1,"triple":0} stalls with 20 blanks; {"single":26,"hidden":0,"intersection":0,"pair":0,"triple":0} completes; {"single":27,"hidden":0,"intersection":0,"pair":0,"triple":0} completes |
| Woven ovals · 1–9 | 81 / 9 | 24, 24, 23 givens | {"single":6,"hidden":10,"intersection":3,"pair":3,"triple":2} stalls with 41 blanks; {"single":48,"hidden":9,"intersection":1,"pair":0,"triple":0} completes; {"single":58,"hidden":0,"intersection":0,"pair":0,"triple":0} completes |
| Woven ovals · A–L | 144 / 12 | 49, 47, 45 givens | {"single":6,"hidden":38,"intersection":6,"pair":0,"triple":2} stalls with 51 blanks; {"single":33,"hidden":33,"intersection":6,"pair":0,"triple":0} stalls with 31 blanks; {"single":67,"hidden":32,"intersection":0,"pair":0,"triple":0} completes |
| Sum bridges · 1–6 | 36 / 6 | 6 givens | Sum-aware counters agree; ordinary constraints allow 2+ completions |

All 9 non-math examples have exactly one completion under two independent algorithms (cell-first bitmask and constraint-first exact cover). Every oval outline was checked against every node center. The math example uses two sum counters: one prunes incomplete sums, the second checks sums only at completed boards. Both return one. “2” without sums means at least two, because counting stops at two.

The technique engine attempts singles, hidden singles, intersections, pairs and triples. A stall is a reason for human playtesting, not a claim that guessing is necessary or a calibrated hard rating. Across 178 bounded clue-removal trials, the selected samples span the highest, middle and lowest measured technique load in that batch, not a guarantee of broad subjective difficulty.

Phone gate: 6 is the first candidate; 9 needs a selected-node note shelf; 12 letters is a desktop/tablet exploration because 144 nodes shrink touch targets. A letter alphabet adds no arithmetic.

Other directions worth a later prototype: two smaller oval networks sharing a seam (longer cross-board chains while keeping six symbols); bounded inequality links between existing nodes (positional logic with no sums); and target sums confined to a few shared nodes (optional math mode). Adding decorative circles, triangles or oblongs with unchanged memberships should remain a visual skin comparison, not a difficulty tier.
