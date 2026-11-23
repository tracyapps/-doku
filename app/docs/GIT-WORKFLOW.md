# Production and native development without losing changes

Decision date: **October 8, 2026**. Production development continues while shared-core/native migration runs in isolation. This runbook defines the intended process; it creates no branches, commits, PRs, repository settings, scheduled jobs or deployments.

Inspected local baseline: `main` at `03ce2e98109b4b9c95590022acf16136802b23c2` (theme audit), matching the locally cached `origin/main`; remote default is `main`. No native branch exists in the inspected checkout. Refresh remote refs when implementation starts; these observations are not a live remote-state guarantee.

## Branches and direction

| Branch | Purpose | Integration |
| --- | --- | --- |
| `main` | Production-ready web/Discord fixes, new themes, games/options and achievements | Production feature/fix PRs target `main` |
| `codex/<topic>` | Short production slice, based on current `main` | Tested PR to `main`; squash is acceptable for this ordinary feature PR |
| `codex/native` | Persistent integration branch for the native/shared-core migration | Receives native slices and real merges from `main`; remains unpublished as production until cutover gates pass |
| `codex/native-<topic>` | Short native/core slice based on current `codex/native` | Tested PR to `codex/native`; keep scope bounded |
| `codex/native-sync-<ticket>` | Integrate a specific production snapshot, based on current `codex/native` | Merge that `main` snapshot, reconcile parity, PR to `codex/native` using **merge commit**, never squash/rebase |

Use isolated worktrees so the production checkout remains available. In Codex Desktop prefer managed worktree tools and reuse existing suitable attachments; pass the intended ref explicitly because their default may otherwise be the remote default branch. Commit/backup intentional work before switching context; never stash another task's changes as a convenience. Each write surface has one active owner; parallel work uses separate branches/worktrees with a defined integration owner.

Normal direction is **production → native**. Do not cherry-pick every production commit as the routine sync method; that obscures ancestry and repeats conflict work. Do not rebase or force-push the persistent native branch. Native slice branches may be rebased before sharing, with clean work and authorization; this does not rewrite integration history.

When native implementation is authorized, first land these planning instructions on `main` through the normal reviewed process. Refresh refs and create `codex/native` from that production tip in its own worktree, recording the full baseline SHA and feature inventory in the parity ledger. Publish the branch/protection setup only with authorization. The first native slice then branches from that baseline; do not start from an older style-audit commit that omits these instructions. Existing attachments/local branches must be inspected before creating duplicates.

A generally useful fix discovered during native work should have an independent production PR from `main`, implemented against the current production paths. Merge that PR first, then import it through the normal sync. A narrowly isolated commit may be cherry-picked onto that production feature branch if it applies safely; record its origin and do not repeatedly pick the whole native stack. Native-only rendering/toolchain work remains on the native lane. Production must not depend on unfinished native code.

## Commit and PR contract

Separate behavior-preserving file extraction from behavior changes, theme ports and toolchain changes. Each coherent commit/PR should state what changed, affected surfaces, compatibility/data impact and fresh verification. Avoid mixing a rename, new rules, save-schema rewrite and visual restyling in one unexplained change.

Production PR descriptions include:

- Observable behavior and affected rules/theme/game/achievement IDs.
- Save/API/generator compatibility, including intentional version changes.
- Tests and visual evidence appropriate to the change.
- Native impact: already shared, adaptation required, or no impact with a reason.

Native PR descriptions include the production base last integrated, old-path → shared-path mapping, parity ledger entries addressed, target checks and any unverified host/device evidence. Native game/theme implementations reference the production issue/PR or stable IDs so related work stays traceable.

Use meaningful messages such as `fix(comic-dark): make game-type labels readable`, `feat(ixdoku): render Roman numeral symbols`, `refactor(core): extract session actions without behavior changes`, and `native(theme): port Comic Dark control states`. A prefix is useful but the compatibility and parity description is the actual contract.

## Production-to-native sync runbook

Sync after each production merge when practical, before starting a native slice touching the same behavior, and before any native milestone/beta/cutover. If several small changes accumulate, import them together with a complete change list. Production shipping can continue while a native port is pending; pending work must not disappear from tracking.

1. Confirm clean isolated checkouts, existing authorizations and no other owner editing the same integration branch. Fetch current remote refs. Pin the production tip SHA and native base SHA in the sync task; do not use an unrecorded moving target.
2. Create `codex/native-sync-<ticket>` from the current native integration tip. List production commits since the previous integrated production SHA and inspect their changed paths/behavior. Include indirect consumers, tests, migrations and assets.
3. Merge the pinned production SHA with a real merge commit. Resolve every conflict with the original behavior/tests and extraction mapping in view. A rename conflict needs the fix in its new shared home, not just the old imported file. Never use blanket `ours`/`theirs`, regenerate all native projects, or delete a failing regression to make the merge pass.
4. Reconcile every production change in the parity ledger. For already-shared logic, exercise its consumers. For CSS/screens/assets, implement the equivalent shared native treatment or record a specific pending port. Check seed stability, legacy save decoding, new symbol/board modes, score/achievement definitions and challenge/API compatibility.
5. Run the existing web/game/runtime checks and every established native lane affected by shared changes. Capture failures/unavailable device checks truthfully. A pending port can coexist with a successful Git merge, but cannot be marked verified parity. An incompatible merge stays on the sync branch until fixed; production continues independently.
6. PR to `codex/native` with the pinned SHAs, commit list, resolutions, ledger and evidence. **Merge, do not squash or rebase this PR.** After integration, confirm the pinned production commit is an ancestor of the actual native integration tip. Revalidate if the target branch moved concurrently; serialize sync integrations.
7. Record the new imported production SHA and native integration commit. Keep unresolved semantic entries open across later syncs. If production advanced meanwhile, create the next sync; do not claim the moving latest production tip was imported.

Illustrative commands, run only in an authorized, clean native integration checkout. Replace `PRODUCTION_SHA` with the recorded full SHA and the example branch suffix `issue-123` with a unique task name:

```bash
git fetch origin
git switch -c codex/native-sync-issue-123 origin/codex/native
git merge --no-ff PRODUCTION_SHA
```

After the PR is integrated, the mechanical ancestry check is:

```bash
git merge-base --is-ancestor PRODUCTION_SHA origin/codex/native
```

Refresh `origin/codex/native` before that check. Exit 0 proves commit inclusion, **not visual or behavioral parity**. Do not execute placeholders literally. Resolve/test/commit a conflicted merge before publication; do not claim these commands supply review or test evidence.

## Native parity ledger and automation

At native-branch initialization, create **`app/docs/NATIVE-PARITY.md` on that branch**. It is the native integration owner's durable record, not a production release blocker. Start with all production features/themes/options/achievements at the chosen baseline; a new ledger must not pretend the current player has already been ported. Add one row per subsequent production PR or distinct behavior, including removals and deliberate contract changes.

| Production PR/full SHA | Behavior or stable ID | Production → native/shared paths | Status | Adaptation commit | Evidence / next owner/action |
| --- | --- | --- | --- | --- | --- |
| Initial pinned baseline | All current player features and themes | Inventory existing `app/src` → proposed packages | Pending inventory/port | — | Compatibility and parity work not implemented |

Statuses: `pending`, `implemented—unverified`, `verified`, or `not applicable` with an explicit reason. Record **imported production SHA** separately from **last production snapshot with full verified parity**. The former can advance while pending ports remain; ancestry never clears those rows automatically. Verified parity at a snapshot requires all baseline and intervening applicable rows verified. Keep removed/changed IDs in migration/link compatibility tests where old saves reference them.

Implement automation in native Phase 2, without auto-resolving conflicts or publishing production:

- Extend PR/push checks to `codex/native` and native sync branches; current CI only has push-to-`main` plus PR checks. Required checks must apply to both PR targets.
- Add a read-only ancestry/status command comparing the imported SHA with a pinned production tip and printing outstanding parity entries. Validate ledger references/status/evidence and prevent unnoticed production changes from being omitted. A migration PR may retain explicit pending ports; beta/cutover checks require no applicable pending rows at the chosen production snapshot.
- Generate a changed-path/commit report for each sync. Stable catalogs/contracts can enforce parity for theme, game option and achievement IDs once both implementations expose them; human visual/behavior review still matters.
- Run web/Discord and established Android/iOS/Mac compilation lanes for shared-core/design/UI/contracts changes. Use lockfile/toolchain-aware caches; no changed-path rule may skip shared consumers.
- A manually invoked sync job may prepare a branch/report/PR when authorized. It must stop on conflicts or failures and report them; no automatic merge, deployment, signing or store submission is implied.

Repository settings to establish when authorized: protect `main` and `codex/native` against force-push/deletion; require checks and resolved discussions; permit merge commits for sync PRs. Do not require a second human reviewer if that makes solo development impossible. Enforce the sync merge method with review/automation; disabling all squash globally is unnecessary.

## Data, environments and release boundaries

Keep `main` as the hosting production branch. Verify hosting branch selection when configuring it; Git branch names alone are not a deployment guarantee. Native/feature previews use isolated backend/database/auth callback configuration and synthetic test users, never production data for migration experiments. Do not store credentials or signing material in either lane. CI build jobs do not run production migrations.

Service changes needed by native clients are additive/versioned and compatible with current production clients. Bring a production-ready service slice to `main` separately, behind capability checks where needed, before clients rely on it. Deployment/migration needs its own authorization and evidence. Never drop old tables, legacy payload readers or generator versions because the native branch stopped using them. Rollback to an older client must not overwrite newer saves.

Tags/releases identify the exact source SHA and per-target build/schema versions. A tag does not substitute for a reviewed integration. Actual provider sessions, signed builds, device updates and store acceptance retain their own gates.

## Eventual cutover and one shared trunk

The long-lived native branch is temporary migration isolation. After compatibility, continuity, complete theme/feature parity and platform checks pass:

1. Pin a production release candidate; import it into native and clear all applicable ledger entries. Freeze only the short integration window, not production development throughout the project.
2. Open the reviewed final integration PR from native to `main`. Reconcile any production changes added meanwhile and repeat affected checks. Preserve merge ancestry; do not squash the full migration stack. A reversible staged player rollout may keep the current renderer available briefly while saves/services stay compatible.
3. After authorized rollout and verification, make `main` the shared web/Discord/native trunk. Features then modify shared modules once, with short branches and all-target checks. Any later store stabilization branches accept scoped fixes from `main` and publish from recorded SHAs; store delays do not create a permanent second implementation.

Do not claim successful cutover from Git inclusion alone. The acceptance scenarios in [NATIVE-APPS.md](NATIVE-APPS.md) and the ledger are release requirements.
