# *doku variant exploration — November 9, 2026

This is a proposal and a local teaching sampler, not a shipped feature list. The existing player remains classic/hue/jigsaw. The owner's reference is an eight-board overlapping puzzle; explore its rules independently first. Recreating the entire overlapping ring would need a different board, navigation and puzzle model and is outside this first expansion.

## Confirmed direction

- Aim for roughly 8–10 player-facing choices; prefer real rule differences over symbol substitutions.
- MiniDoku starts at 4×4. A standard 2×2-region board is the proposal; 6×6 can wait.
- Keep IXdoku (Roman numerals), recognizing it as a symbol mode rather than a separate rule engine.
- Existing Jigsadoku covers the reference's strange boxes.
- Exclude Offset; its color dependence conflicts with the theme direction.
- Avoid kill/killer in player-facing names. Adddoku can cover sum-cage play at multiple levels.
- Consecutive and inequality need clearer, quieter markings than the reference. The owner remains open to trying them, rather than committing to either layout.
- Refine the current purple grid/burst home-screen icon.

## Proposed shelf

| Choice | What changes | Recommendation / engineering scope |
| --- | --- | --- |
| Classic | Existing numeric Sudoku | Keep |
| Huedoku | Existing symbol/color presentation | Keep; acknowledge shared numeric rules |
| Jigsadoku | Existing irregular regions | Keep |
| MiniDoku | 4×4 geometry, symbols 1–4 | Requested; geometry, codecs, generation, input, results and server assumptions need adaptation |
| IXdoku | I–IX representation of 1–9 | Requested; shared generator, deliberate symbol-mode persistence and narrow-screen notes |
| Xdoku | Both long diagonals are additional all-different groups | Strong next rule candidate; bounded peer/checker changes, new constrained generation/uniqueness and explanation work |
| Adddoku | Connected sum cages; distinct digits inside each cage | Strong next rule candidate; constraint-aware solving/generation, sum notes/hints and readable clue layout |
| Consecutive | Neighbor relationships supply positive and negative information | Trial candidate; dot layout, complete marking policy and constraint-aware solving/generation |
| Thermo | Digits strictly increase along bulb-to-tip paths | Proposed ninth choice; new order deductions without arithmetic |
| Arrow | Shaft digits total the circled digit | Proposed tenth choice; a second visual sum style, with higher annotation density |

An eight-choice first target stops at Consecutive. Thermo and Arrow earn the last two places through playtesting. Inequality is a reserve, not an extra required launch game. Names for Consecutive, Thermo, Arrow and Inequality remain working labels. Mahjong and Braille retain their separate later briefs. Anti-knight (equal digits cannot be a chess knight's move apart) is another low-ink reserve if edge/path clutter proves unsuitable, but needs its own understandable peer highlighting and constrained generator.

This is a player-choice count, not ten independent rule engines. Keep rules, board geometry, symbols and themes separate, with explicit supported combinations. Initial variants are standalone; do not silently make all combinations playable.

## Adddoku: a gentle way into sum cages

Use one invariant: ordinary Sudoku plus connected outlined groups, each reaching its printed total with no repeated digit. Starter puzzles can retain more givens, feature two/three-cell groups and approachable combinations (two cells totaling 3 contain 1 and 2). More demanding puzzles can reduce givens and require interactions between groups and Sudoku units. Clue-free grids are an advanced presentation, not a guarantee of difficulty.

The reference's Addition Sudoku instead highlights selected cells that total a marked target cell. That is a different sum relation; it is not automatically an easier sum-cage puzzle. If explored later, specify exactly which cells contribute, whether the target is an ordinary Sudoku cell, and repetition rules. Start with the single consistent Adddoku ruleset to reduce teaching and maintenance overhead.

Difficulty must come from human solving techniques and playtest evidence, not just clue count. The current generator labels difficulty through clue density; new variants need their own calibration. Optional combination guidance is assistance with recorded provenance if it influences scoring. Keep advanced Adddoku within the same game rather than reintroducing an unwanted name.

## Quieter rule presentation

- **Adddoku:** quiet inset dashed group outlines, one corner total, large selected-group equation/remaining sum. Avoid rainbow cage fills. A production board must reserve separate positions for totals and pencil notes, including Comic and Web 2.0 geometry.
- **Consecutive:** small hollow dots at cell edges, contrasting against both adjoining surfaces. The reference marks every consecutive orthogonal pair, so an unmarked edge forbids consecutive digits. Sparse “marked pairs only” play is a different ruleset: fewer dots mean different information. Prototype the full-marking rule first. Optional focus dims other marks; it must not conceal the existence or meaning of unmarked constraints.
- **Inequality:** sparse edge chevrons with correct orientation and a large selected comparison in words. Reducing clue count requires a new uniquely solvable puzzle, not hiding necessary relations. A direction arrow is not an adequate substitute for an inequality symbol.
- **Xdoku:** quiet diagonal treatment plus an explicit explanation and accessible membership labels. A tint alone is insufficient.
- **Thermo/Arrow:** subdued paths beneath values with clearly distinguishable bulb/circle endpoints. Theme-state and note-placement review determine whether they remain readable.

All rule markings need semantic light/dark/selected/error treatments independent of hue symbols and jigsaw fills. The lab's three study appearances only explore readability; they do not prove twelve-theme parity or screen-reader accessibility in the actual player.

## Local rule sampler

[prototypes/rule-lab.html](prototypes/rule-lab.html) is a single in-memory HTML exploration, with MiniDoku, IXdoku, Xdoku, Adddoku, Consecutive, Thermo, Arrow and Inequality examples. Open the file directly, or serve `app/` with a local static server and visit `/docs/prototypes/rule-lab.html`. It uses no production origin, storage, account, generator, scores or daily rotation. Each sample is a nearly completed teaching board, with input, conflict feedback, erase, undo, reset, single-cell reveal, and valid/conflicting move walkthrough buttons. It is not a difficulty benchmark, production engine, or certification of full puzzle uniqueness.

Questions to answer: are the selected clue explanations understandable? Are dots easier to read than bridges? Do sum labels remain legible at phone width? Does VIII fit? Is Thermo interesting enough to occupy a shelf slot? Record the owner's playtest verdict before implementing a production candidate. After that verdict, archive the throwaway prototype on an exploration branch and carry only validated behavior into production slices.

## Practical sequence, alongside native work

1. **Icon and current web experience.** Refine the existing mark; preview at 32/48/180px and under platform masks. Then prepare an opaque Apple touch icon plus properly padded 192/512px regular and maskable Android/PWA assets. The current manifest has only a 512px `purpose:any` PNG and uses that same image as the Apple touch icon. Do not call an image mock a completed manifest/install update. Verify on a newly installed home-screen instance; an existing installation may retain its old icon.
2. **Choose the teaching experience and freeze compatibility fixtures.** Review the sampler; record the supported rules/geometry/symbol combinations. Capture existing seeds, givens, solutions, regions, saves, links, dailies and result fixtures before changing the engine. Map the versioned descriptor, including cage/path/edge metadata and full-marking policies. A number permutation preserves classic Sudoku and Xdoku but can break sums, consecutive relationships, inequalities and thermometer order; do not reuse that generator transformation blindly.
3. **Small production slices.** IXdoku exercises symbol-mode contracts; MiniDoku exercises geometry; Xdoku exercises extra all-different groups. Adddoku and Consecutive follow after rule-aware uniqueness and human-solving difficulty work. Keep shipping them through the production lane in [GIT-WORKFLOW.md](GIT-WORKFLOW.md), without waiting for all ten.
4. **Start native with a proof, in parallel with those web slices.** First land the existing planning baseline through the reviewed workflow; inspect clean worktree attachments, refresh refs and initialize the native lane/parity ledger when implementation starts. Prove the exact React/RN/RN-macOS/RN-Web/module matrix on iOS, Android, Mac, browser and the Discord Activity. The same hard themed board must demonstrate notes, errors, keyboard/focus, accessible cells, save/relaunch and sharing. Do not pin versions from old examples in this document.
5. **Shared contracts and continuity.** Extract the shared Sudoku core/geometry and portable theme/UI definitions incrementally; add account-owned local storage, full detailed history/session/settings sync, safe guest import, provider linking, conflict recovery and version-aware unsupported-game handling. Use 4×4, Roman VIII, diagonal constraints and a sum clue as portability probes. Keep new rules' metadata through save/resume, challenges and server validation.
6. **Complete shared player, beta and stores.** Port all themes and options; automate builds for all targets early, then add signing and installed-update/device checks. Account continuity, offline play, accessibility and migration are release gates. Store submissions remain separate authorized actions. [NATIVE-APPS.md](NATIVE-APPS.md) remains the detailed acceptance contract.

The framework direction is already chosen; the first native milestone is evidence that the chosen renderer/modules can carry this product. Microsoft requires matching RN/RN-macOS minor versions and still describes Expo-module support on Mac as experimental. This reinforces proving Mac early rather than assuming a mobile setup covers it. No native project, package installation, branch initialization, pipeline, deployment or store submission is established by this exploration.

## Sources checked November 9

- Owner-supplied `IMG_1792.JPG`: visual/rule reference only; the overlapping puzzle itself is not copied into the teaching fixtures.
- [GM Puzzles: sum-cage rules](https://www.gmpuzzles.com/blog/category/sudoku/killer-sudoku/), [Consecutive](https://www.gmpuzzles.com/blog/category/sudoku/consecutive-sudoku/), [Consecutive Pairs](https://www.gmpuzzles.com/blog/category/sudoku/consecutive-pairs-sudoku/): the latter explicitly permits arbitrary unmarked relationships, unlike the full-marking reference.
- [GM Puzzles: Thermo](https://www.gmpuzzles.com/blog/category/sudoku/thermo-sudoku/) and [Arrow](https://www.gmpuzzles.com/blog/category/sudoku/arrow-sudoku/): rule semantics; their puzzle grids/art are not reused.
- [RN macOS setup](https://microsoft.github.io/react-native-macos/docs/getting-started) and [Expo modules on Mac](https://microsoft.github.io/react-native-macos/docs/guides/installing-expo-modules): matrix and experimental-support boundaries, not proof of compatibility for this repository.

Store policies were not re-audited in this exploration; the dated policy section in the native plan requires a fresh check before submission.

## Exploration evidence and icon provenance

On November 9 the standalone sampler was opened in the Codex in-app browser. Valid/conflicting move and undo paths were exercised across all eight examples; rule-specific conflicting moves were checked for cages, consecutive dots, thermometer order, arrow totals and inequalities. Erase, reset and consecutive-clue focus were exercised. The 390px browser viewport showed a 343px board without horizontal overflow, including IXdoku's VIII; Paper and High Contrast study appearances were inspected. This is browser evidence, not physical-device, assistive-technology, production-generation or twelve-theme validation. The protected runtime check passed for all 28 protected files; the standalone JavaScript parsed. No production game code changed and no production test-suite result is claimed.

[Sampler capture](prototypes/rule-lab-preview.jpg) and [refined icon draft](prototypes/doku-icon-refined.png) are saved alongside the HTML. The icon was generated with the built-in image tool using `app/public/assets/brand/doku-icon.png` as its edit target. The output was inspected at large size and in 48px rounded-square / 32px circle previews. Those simple masks are visual checks, not platform installation evidence. It remains a draft: the manifest, favicon, Apple touch icon and approved source artwork have not been replaced.

Final generation prompt:

> Use case: precise-object-edit. Edit target: attached existing *doku app icon. Refine for a crisp mobile home-screen app icon, keeping the EXACT recognizable identity: purple 3 by 3 tilted Sudoku grid behind the existing six-armed asterisk/burst with magenta through orange to yellow gradient and bold dark outline. Preserve the six-arm asterisk anatomy (not a star), orientation, playful graphic style, purple palette and gradient. Improve small-size readability with cleaner consistent dark strokes, reduce the fuzzy heavy shadow, slightly simplify purple shading. Center the complete mark with generous safe padding, all grid corners comfortably inside the central 78 percent of a square canvas. Add a flat opaque very dark plum background filling the entire square. No text, no additional symbols, no rounded outer corners, no mockup, no lighting, no phone. One square icon only, 1024 by 1024.

The generated draft is 1254×1254 rather than the requested 1024×1024. Production asset preparation must export the required platform sizes from a selected final master. No branch, commit, push, public issue or deployment was created by this task; pre-existing uncommitted planning files were retained.
