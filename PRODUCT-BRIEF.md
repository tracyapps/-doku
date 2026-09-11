# *doku — initial product brief

Status: requirements captured from the September 11, 2026 conversation. This is a product brief, not an implemented game. Proposed defaults and sequencing below remain design decisions, not additional user requirements.

## Product idea

A beautiful, comfortable Sudoku family for solo play and friend challenges on separate boards of the same puzzle, with Discord Activities as the intended integration to explore. Unlimited play, no lives, and no punitive gameplay restrictions for mistakes. Challenge results recognize multiple kinds of accomplishment. Mobile readability and low-friction input are foundational.

The supplied screenshots are references for behavior and visual problems, not instructions to copy another product or execute the actions shown in its menus.

## Naming and screen flow — confirmed refinements

- The product name remains `*doku`, referring to a wildcard. `stardoku.app` is the intended domain, not a replacement brand name; registration is not confirmed here.
- Outside a game, the title is `*doku`. During a game, show the relevant name: `sudoku`, `huedoku`, or `jigsadoku` as illustrated by the user. Accent the `*`, `su`, `hue`, or `jigsa` prefix; render `doku` in the theme's primary text color.
- Header typography follows the selected theme. The chunky-font reference illustrates one theme, not a universal logo. The user will supply the official logo.
- Choose game type and difficulty before starting. During play, both are header information, not live selection toggles. No Numbers / Colors or Classic / Easy segmented controls on the board screen.
- Changing difficulty is an intentional restart action, available through a menu with clear reset consequences. Cancelling preserves the current game; confirming begins a fresh attempt. Theme and readability changes remain non-destructive.
- Keep the active board focused on playing. No prominent bottom challenge/results button during an unfinished puzzle. Put friends' results on a separate screen reached through More; a completion/results action may appear after solving.
- Add completed-puzzle history. Each entry opens its result card and can be used to challenge a friend to that puzzle. The recipient chooses their own difficulty before starting, recorded on their result card.
- Companion website and game belong in the same repository. The website includes an introduction, instructions, Discord setup, and support information, following Draw-tionary's useful content structure rather than copying its branding.

## Three independent choices

1. Puzzle rules: classic rectangular regions or jigsaw irregular regions.
2. Symbols: numbers, colors with distinct patterns, and eventually illustrated character sets.
3. Appearance: background, palette, typography, and themed board/keypad treatments.

Keep these independent so jigsaw can use colors, a notebook can use numbers, and switching appearance does not reset a puzzle. Internally, symbols can all represent the same nine values; region membership determines puzzle constraints.

This is an internal separation of rules, symbols, and appearance. The player's game type, including its symbol mode, is chosen before play and remains fixed for that attempt.

## Required interaction behavior

### Selection and matching

- Tapping a keypad value activates it and highlights matching entries on the board. Give the active keypad button an unmistakable outline or selected state too.
- Carry the same behavior across numbers, colors, patterns, and other symbol sets.
- Visually mute a keypad value when it is correctly represented in every region. Do not use raw counts alone: nine copies can still contain conflicts. Muting should remain readable and should not prevent using the value to inspect highlights or remove notes.
- Distinguish the selected cell, matching values, and conflict feedback. These cannot all rely on similar background colors.

### Input order

Use explanatory labels rather than the ambiguous “Number” and “Cell”:

| Setting | Helper text | Behavior |
| --- | --- | --- |
| Cell first | Choose a square, then choose a value. | Board taps select a cell; keypad taps enter a value in an editable selected cell. |
| Value first | Choose a value, then tap squares to place it. | Keypad taps activate a persistent value; board taps enter it in editable cells. |

“Value” works across symbol sets; the helper text may say number or color when appropriate. Show the current input mode near the controls, not only inside Settings.

Proposed default: cell first, with a brief explanation of value first. Selecting a given can highlight it but must never change it. Keypad taps without an editable selection can still activate matching highlights. In value-first mode, changing the active value must not write into a previously selected cell.

### Notes

- Explicit Pen / Notes toggle.
- Manual notes toggle the chosen candidate on or off in the cell.
- Candidates occupy fixed positions matching the 3 × 3 keypad: 1–3, 4–6, 7–9. Never compact remaining candidates together.
- Autofill Notes computes currently legal candidates from rows, columns, and regions; it does not peek at the solution. Treat it as a deliberate action with undo.
- Hide Notes changes visibility only; showing notes restores the same stored notes.
- Offer automatic removal of peer notes after an entry, following the Apple reference.
- Proposed behavior: entering a pen value clears that cell’s notes, with undo restoring both. Typing a note into a filled cell does not silently erase its value.
- Color/pattern notes use one colored shape from their pattern, in the same stable candidate position: for example, a single red triangle for red triangles or a single orange circle for orange circles. Do not shrink a repeated texture into a note. Test shape recognition at real phone size.

### Forgiving play and assistance

- No lives, daily play restrictions, paid retries, or gameplay lockouts for mistakes. Accuracy can contribute to challenge results without restricting continued play.
- Undo should recover entries, erasures, and note changes. Redo is a proposed companion.
- Separate “Show conflicts” (duplicates under the rules) from “Check answers” (comparison with the solution).
- Use the reference menus to organize timer visibility, matching highlights, conflicts, automatic note removal, optional automatic answer checking, autofill/hide notes, hint, check cell, check puzzle, reveal, and restart.
- Proposed default: automatic answer checking off. Make checking and hints available without punishment.
- Restart and broad reveal need protection from accidental taps; ordinary entries should remain quick and reversible.

### Timer and small celebrations

- A saved preference controls whether the timer is shown by default in a new game.
- Tapping the timer switches between visible elapsed time and a compact hidden-time control that can be tapped again. This is a per-game view toggle; change the default in Settings.
- Hiding time does not pause or reset time measurement and does not change scoring. Give the control clear accessible labels for Show timer / Hide timer.
- Briefly animate a row, column, or region when it becomes complete under the puzzle rules. A filled unit with duplicates must not celebrate. Avoid leaking solution correctness through celebrations when answer checking is off.
- Celebrate the newly completed unit without blocking input or covering values with a modal. Multiple units completed by one move can animate together. Do not replay celebrations on reload or initial render.
- Proposed accessibility behavior: respect reduced motion, with a short static highlight instead of a moving sweep, and offer a celebration setting. Undo/redo must not accumulate achievements from repeated completion of the same unit.

## Readability and personalization

- Light and dark modes, alternate backgrounds and gradients, and high-contrast themes.
- Independent value and note size controls, plus font and weight choices.
- Preserve readability of givens, user entries, notes, selection, muted keys, and region borders in every theme.
- Keep the keypad in a stable 3 × 3 spatial arrangement so it continues to match notes.
- Proposed starting point: large controls, a board-first phone layout, and settings in a sheet. On wider screens, place controls alongside the board when that provides more space.
- Validate with actual narrow mobile viewports, larger text, keyboard navigation, and screen-reader labels. A nine-column board makes cell targets inherently constrained; do not promise arbitrary text enlargement without designing overflow or zoom behavior.

## Color and pattern mode

Use nine distinguishable color-plus-pattern identities, consistent on the board, keypad, matching highlights, and notes. Patterns must remain recognizable without hue. Begin with simple, substantially different motifs, then test at their smallest rendered size before choosing the final set.

Each identity has a recognizable base shape. Full-size cells and keys can repeat that shape as a pattern; notes show a single colored instance. Red triangles and orange circles are user-provided examples, not a finalized nine-symbol palette. Choose all nine shapes for distinction at note size, including without hue; retain visible contrast against both light and dark backgrounds. The provided pattern sheet is inspiration, not a requirement to use intricate textures. Optional numeric labels may offer an additional aid.

Jigsaw boundaries must remain obvious when cells are already colored. Use strong region outlines rather than relying solely on region background fills.

## Theme backlog

- Clean modern foundation, including light, dark, and high contrast.
- Retro phone keypad; a rotary-inspired treatment needs special care because the required note/keypad spatial mapping must remain consistent.
- Sci-fi phone and time-machine-inspired board.
- Liquid glass, gradient orbs.
- Television remote and old tube television board.
- Lined paper, hand-drawn grid, and peripheral doodles.
- Comic-book burst outlines around keys.
- Illustrated creature symbols, including the user's Whodoku idea.

Treat these as future art directions, not selected designs. Decorative treatments should leave the board, notes, and active controls legible and should not alter input rules.

## Proposed delivery sequence

1. Interaction design and playable local core: classic 9 × 9, both input orders, matching highlights, completed-value muting, manual/autofill/hidden notes, undo, checking, saved progress, and baseline readability settings. Validate generated puzzles for a unique solution.
2. Symbols and regions: patterned color mode and genuine jigsaw puzzles, with region-aware candidates, checks, generation, and clear boundaries. Preserve the shared interaction model.
3. Friend challenges and Discord: independent boards of the same puzzle, with multidimensional results. Define scoring and attempt tracking before choosing synchronization and hosting architecture. Verify current Discord requirements with official documentation during technical discovery, and test an early integration before extensive theme work.
4. Expanded themes: add art directions after the basic board and controls work comfortably on phones.

The Discord integration is part of the intended product exploration, not something considered complete by making a solo web page. No SDK, hosting provider, authentication approach, or multiplayer backend has been selected yet.

## Friend challenges — confirmed direction

Friends challenge each other with the same puzzle, each playing their own board. Entries, notes, undo, and progress belong to each player. A player's actions never fill or erase a friend's cells. Personal appearance and accessibility settings remain independent.

Recipients may choose their own difficulty. Proposed implementation: a challenge identifies a puzzle family with a fixed solution and region layout; each difficulty has its own validated, uniquely solvable clue layout. Players choosing the same difficulty receive identical givens; different difficulties can have different givens. Difficulty must be rated by solving requirements, not assumed from clue count alone. This replaces the earlier requirement for identical givens across all players.

History-based challenges support playing later. A synchronized live-start option remains a future decision. Reconnects should resume the same attempt and its recorded metrics. Sharing a challenge must not expose the sender's completed solution.

### Multidimensional accomplishment — confirmed requirement

Time alone must not determine success. Results account for time, mode, hints used, accuracy percentage, and assistance such as automatic answer checking. A slower, accurate, unassisted solve should feel as worthy of recognition as a fast solve.

Proposed result card:

- Completion and solve time.
- Accuracy percentage, with an explanation of how it is measured.
- Hint and reveal usage, separately recorded.
- Assistance used during the attempt, including automatic answer checking, manual checks, and autofill notes.
- Puzzle variant and difficulty, symbol mode, and input mode as context.
- Each player's selected difficulty, prominently visible when comparing a shared puzzle family across levels. Proposed default: compare speed rankings within the same level and celebrate achievements across levels; do not imply equal difficulty or invent an untested normalization formula.
- Separate recognition such as fastest solve, highest accuracy, and unassisted completion. Allow ties and multiple achievements per person.

Proposed starting approach: present these dimensions together and recognize category achievements rather than making one opaque weighted total the only result. If an overall score is added, publish its formula and retain the individual dimensions. Exact weights, accuracy definition, and which tools count as assistance remain to be tested and agreed; no formula is finalized.

### Proposed measurement rules to evaluate

- Measure accuracy from the solve process, not final-board correctness: every successfully completed board would otherwise show 100%.
- A possible baseline is first-entry accuracy: the percentage of player-entered cells whose first committed pen value was correct. Exclude givens, notes, erasures, and revealed cells; show the evaluated cell count. This avoids inflating accuracy by repeatedly entering known correct values. Validate the treatment of accidental taps before adopting it.
- Keep assistance attribution separate from accuracy. A correct value entered after a hint should not be presented as equivalent to an unassisted deduction.
- Record assistance when used, or while automatic checking is enabled; turning it off before finishing does not erase its use. Undo restores the board without erasing the attempt's hint/check history.
- Do not reveal correctness during play when checking is off just because accuracy is being recorded. Results can summarize accuracy afterward.
- Font size, contrast, shape cues, theme, hidden timer, and input order should not reduce scores. Record relevant modes for context without treating accessibility preferences as assistance.
- Establish timing, pause/background behavior, restarts, repeat attempts, and reveal-heavy completions before publishing competitive rankings. First attempts and practice replays should be distinguishable.
- Challenge metrics should eventually be validated by the service rather than trusted solely from a player's browser.

These proposals support the user's goal: Sue can celebrate speed while another player celebrates precision or solving without hints. They must not turn mistakes into a limited-lives system.

## Acceptance examples for the first build

- Activate 2: board 2s and the keypad 2 are visibly selected.
- Value first: activate 2, tap three editable cells, and place 2 in each without reselecting it. Undo remains available even if entries conflict.
- Cell first: selecting an empty cell does not enter the previously active value.
- Notes containing 1 and 9 appear top-left and bottom-right. Hide/show leaves both intact; Notes input can remove either.
- Autofill respects irregular region membership when playing jigsaw.
- A value with nine conflicting placements is not marked completed.
- A completed keypad value stays readable and can still be selected for inspection.
- A color-mode puzzle can be interpreted without differentiating its hues.
- Changing a theme or text size preserves puzzle progress and notes.
- No incorrect entry exhausts lives or blocks continued play.
- A red-triangle candidate renders as one red triangle in its fixed note position, not a miniature field of triangles.
- Two friends choosing the same level receive identical puzzle givens. Friends choosing different levels share the puzzle family with distinct clue layouts and clearly labeled levels. Editing one board never changes another.
- A slower unassisted solve receives visible recognition alongside a faster assisted solve.
- Using a hint and then undoing or disabling assistance does not mislabel the attempt as unassisted.
- A completed board does not automatically receive 100% process accuracy simply because its final values are correct.
- Outside a game, show `*doku`; inside classic, show `sudoku` with only `su` accented, plus the selected difficulty.
- Game type and level do not appear as live toggles. Confirmed difficulty changes reset the attempt; cancelling does not.
- During an unfinished game, challenge results are reachable through More without a prominent exit-like button below the keypad.
- Completed-puzzle history can create a challenge whose recipient chooses a level before play.
- Tapping the timer twice hides then restores elapsed time without resetting it or changing the saved default.
- Completing a valid row, column, or region triggers a brief non-blocking celebration; an invalid filled unit does not.

## Reference map

- IMG_2974.PNG: matching values on board, 3 × 3 keypad, primary controls.
- IMG_2975.PNG: gameplay assistance menu.
- IMG_2977.PNG: fixed note positions and keypad correspondence.
- IMG_2976.PNG: gameplay settings and explanations.
- September 10 screenshots at 11:58:09 and 11:58:13 PM: ambiguous number/cell input setting.
- September 11 screenshot at 12:09:45 AM: irregular jigsaw regions.
- September 11 screenshot at 12:11:34 AM: color Sudoku reference, including a 6 × 6 example. Additional board sizes are not yet a confirmed requirement.
- September 11 screenshot at 12:13:17 AM: pattern inspiration.
- September 11 screenshot at 1:37:16 AM: wildcard naming, accented prefixes, and a chunky theme font example.
- September 11 screenshots at 1:47:06 and 1:49:44 AM: static difficulty information, selected-value and note highlighting. Hearts and limited hints in these third-party references are explicitly not requirements.
- September 11 screenshot at 1:54:14 AM: completion celebration inspiration.
