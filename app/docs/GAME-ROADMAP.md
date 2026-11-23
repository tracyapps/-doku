# New *doku games and symbol modes

Owner direction captured **October 8, 2026**. MiniDoku and IXdoku are requested additions. Mahjong-inspired play and a Braille version are later concepts. This records implementation boundaries and decisions; no new game is shipped by this document. Production work may proceed while native migration continues under [GIT-WORKFLOW.md](GIT-WORKFLOW.md).

## Shared requirements

Keep puzzle rules, symbol representation and theme independent. Add each new capability to versioned puzzle/session/result/link contracts so saves keep their meaning across browser, Discord and store versions. Old clients preserve unsupported game data and offer a compatible update path; they must not reinterpret it as classic Sudoku. Keep existing game/achievement IDs stable and legacy 9×9 seeds/boards unchanged.

Every addition needs game selection, instructions, both input orders where applicable, notes/undo where appropriate, save/resume, history/results, theme states, accessibility labels and challenge/server validation. Define difficulty/scoring/achievement eligibility explicitly rather than inheriting 9×9 assumptions. Do not change the daily rotation or grant new badges without a separate product decision. Existing settings and all themes carry forward where meaningful; explain game-specific capabilities clearly.

Production-ready changes land on `main`; native integration imports and tracks their shared implementation/port evidence. The future shared core owns these behaviors once. Feature discovery and build automation must include new game/symbol IDs; a native client with older bundled code cannot be presumed to support a freshly deployed web feature.

## IXdoku — requested

Roman-numeral Sudoku: **I, II, III, IV, V, VI, VII, VIII, IX** represent the existing values 1–9. Recommended implementation is a Sudoku symbol mode/selection preset, not a second copy of generation, checking or scoring. The player-facing game name is IXdoku; preserve its selected mode in sessions, history and links. Roman numeral display must not alter puzzle identity or count the same completed session twice.

The production model currently uses `classic | hue | jigsaw` as its variant discriminator. Introduce a deliberate backward-compatible symbol-mode field/preset rather than treating one extra string in that union as the entire feature. Decode legacy payloads to their existing symbol behavior. Initial proposed scope is classic 9×9 Roman-numeral play; combinations with jigsaw or MiniDoku are future decisions, not automatically enabled.

First files to inspect: `app/src/game/engine.ts`, `session.ts`, `records.ts`, `app/src/Prototype.tsx` symbol/keypad/notes/Brand rendering, `app/server/app.ts` challenge validation and corresponding tests. On native, the owning equivalents become Sudoku codecs/rules plus shared symbol presentation in `packages/ui`/`design`.

Acceptance: numeric values remain canonical; VIII fits keys/cells/notes without shifting layout, including narrow screens and each theme; selection/errors/givens stay clear; keyboard mappings and accessible spoken labels are deliberate; save/reload/history/challenge preserve mode; existing classic/hue/jigsaw fixtures remain unchanged. Scoring remains the same for the same Sudoku rules/difficulty unless explicitly changed.

## MiniDoku — requested, first size selected

A smaller Sudoku board is required. On **November 9, 2026**, the owner selected **4×4** as the first size; use **2×2 regions** for the initial standard MiniDoku proposal. The region treatment and difficulty approach still need review before production generation or theme-parity claims. 6×6 remains a possible later expansion. MiniDoku does not automatically mean children-only play or reduced features.

Fresh source inspection: `engine.ts` fixes nine symbols/81 cells and 9×9 generation; `session.ts` creates 81-entry notes/first-entry arrays; the player, scoring, history, challenge validation and assistance paths must be inspected for matching assumptions. A small board needs a validated descriptor (dimensions, symbol count, region membership and rules/generator version) inside the Sudoku family. Do not make every game a grid merely to support this.

Separate the geometry extraction from adding a new generator. Freeze existing 9×9 seed/solution/clue/region fixtures first; decode old saves as the legacy descriptor. Adapt candidates, uniqueness checks, peers, completion, input/notes layout, statistics denominators and server validation to the selected size. Difficulty and par times need their own evidence; fewer cells are not proof that a board is easy. Preserve current dailies rather than regenerating them through new defaults.

Acceptance: uniquely solvable boards at the chosen size, correctly sized notes/keypad and readable theme geometry; assistance/undo and completion respect the new regions; stable puzzle/version/link identity; migration and reload preserve old and new sessions; history/results label size; scores/achievements do not unintentionally award legacy 9×9-specific badges to MiniDoku.

## Mahjong-inspired game — later concept

Working names: **mahdoku / mahjodoku**. Name and rules are not selected. Determine whether the intended game is solitaire tile matching, traditional multiplayer Mahjong, or a Sudoku hybrid before choosing architecture, scoring, networking or art. These represent materially different games.

If independent of Sudoku, add a real game module with its own actions/state/validation and shared presentation registration. Reuse accounts/friends/sync/history/design primitives; do not force tile stacks, matching rules or multiplayer turns into 81-cell Sudoku state. Confirm tile art rights, readable theme treatment, input accessibility and result metrics in its own brief before implementation.

## Braille version — later concept

Record the intended Braille experience before implementation: a visual Braille-symbol Sudoku mode, accessible nonvisual play, and physical refreshable Braille-device integration are distinct scopes. A dot font alone does not establish accessible play. Name, encoding/convention and supported input/output remain open; verify them with appropriate primary references and Braille users when this slice starts.

For a visual symbol mode, keep numeric values canonical and label symbols, coordinates, givens, notes and conflicts meaningfully. For nonvisual play, design navigable board/keypad semantics and feedback, then verify VoiceOver/TalkBack/desktop screen-reader behavior. Any physical Braille-display promise requires actual compatible hardware/OS evidence. Themes and larger text must not obscure dots or state distinctions. Accessibility/symbol preferences must not reduce a player's score.

## Sequence and integration gates

1. IXdoku is the smaller first production slice after mode/link/save contracts are mapped. It exercises the rules/symbol separation.
2. Use the selected 4×4 MiniDoku size, confirm its region/difficulty approach, then extract Sudoku geometry with legacy parity and add its generation/UI as separate slices. It supplies a real second geometry requirement for the native core.
3. Import each production slice into the native lane immediately through the merge/parity process. Before extraction, production owns the current implementation; after extraction, native maps it to the owning shared packages. Avoid creating independent native-only game rules.
4. Scope Mahjong and Braille later with their own briefs, without blocking current games or native foundations. No deadline or implementation order between those later concepts is chosen.

This internal roadmap does not create public GitHub issues or alter the public roadmap. Public issues/listings and shipped claims require separate actions and evidence.

## November 9 variant exploration

See [VARIANT-EXPLORATION.md](VARIANT-EXPLORATION.md) for the proposed eight-to-ten-choice shelf, Adddoku naming and difficulty approach, quieter clue treatments, the standalone teaching sampler and the native starting sequence. Xdoku, Adddoku and Consecutive are exploration candidates; Thermo and Arrow are proposed extensions. None is shipped by this roadmap. Offset is excluded at the owner's request. Keep new rules out of existing dailies, saves and scoring until their own production slices pass the shared requirements above.

Mobile notes are now an explicit selection gate. [MOBILE-NOTES-AND-CIRCLES.md](MOBILE-NOTES-AND-CIRCLES.md) records the follow-up layout studies and two circular puzzle sketches. Orbit is a polar presentation of MiniDoku's rules; Overlap is a different all-different group structure. These working names and authored examples are exploration only: they have no registered production IDs, daily rotation, scores or achievement eligibility. IXdoku's full Roman notes and any sum/path annotations must pass phone-sized candidate-density checks before production rollout.

The subsequent owner feedback prioritizes **Ringdoku** and tentative **Venndoku** over Arrow and Thermo for the ninth/tenth choices. [RINGDOKU-VENNDOKU.md](RINGDOKU-VENNDOKU.md) explores 4/6/8-value rings, independent/linked sections, more overlapping circles, ovals and triangles. Treat these as configurations within two candidate families, not fifteen new shipped games. Larger boards are not automatically harder; record solving-technique and mobile evidence before selecting a difficulty ladder. Adddoku's preferred layout is taller cell tabs with a very faint divider; Consecutive's is reserved space with balanced padding on all four sides. Production implementation, game IDs, scores, achievements and daily participation remain separate decisions.
