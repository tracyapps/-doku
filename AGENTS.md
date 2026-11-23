# *doku repository agent instructions

Read [app/AGENTS.md](app/AGENTS.md) before app/native planning or implementation; its protected preview runtime rules remain binding. Read [the Git workflow](app/docs/GIT-WORKFLOW.md) before branching, implementing or integrating production/native work, and [the native plan](app/docs/NATIVE-APPS.md) for shared-core changes.

## Production and native work

- `main` stays open for production fixes, themes, options, games and achievements. The planned persistent native integration branch is `codex/native`; native slices branch from it as `codex/native-<topic>`. Production slices branch from `main` as `codex/<topic>`. Use separate worktrees for concurrent lanes; inspect existing attachments first and reuse a suitable managed worktree.
- Land production-ready behavior on `main` first. Regularly merge production into `codex/native` through a reviewed sync branch. Preserve merge ancestry: no squash/rebase of production-to-native syncs, no force-pushing the persistent branch, and no merging unfinished native work into production.
- Every production import needs both Git ancestry and semantic parity evidence. Track changed rules, themes, game options, achievements, links, saves and API contracts in the native parity ledger specified by the workflow. Imported CSS alone is not a completed native theme port. Pending entries remain visible and block the parity/release claim.
- During file moves, map old paths to shared modules and carry fixes into the maintained implementation. Never resolve a conflict by blanket choosing one branch's version. Keep old saves, generator behavior, stable IDs and backward-compatible service contracts intact.
- Branch creation, commits, pushes, PRs, deployment and store submission follow the user's authorization for the task. A request to document a process does not execute those actions. The workflow is a runbook, not evidence that branches, protections or CI automation already exist.

## Planned games

The owner requested **MiniDoku** and **IXdoku** (Roman-numeral Sudoku) on October 8, 2026, and selected **4×4** as MiniDoku's first size on November 9. Mahjong-inspired play (working names mahdoku/mahjodoku) and a Braille version are later concepts. Read [GAME-ROADMAP.md](app/docs/GAME-ROADMAP.md) before implementation. These are planned, not shipped; Mahjong/Braille behavior remains open. Preserve separate rules, symbols and themes; never silently change existing puzzles/dailies or infer new achievement/scoring rules.
