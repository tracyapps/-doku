# Public game testing

Owner direction: November 10, 2026. Implementation is on the current production feature branch; publication status must be recorded separately from local checks.

## Player surface

`/testing/` is an accountless, unlinked public page. `/testing/results/` shows submitted ratings, written feedback and optional nicknames. Both request no indexing; this is not access control. Nothing is added to the main navigation.

The versioned `ringdoku-2026-11-v1` catalog includes **24 unique puzzles**, six each for linked halves 1–4, linked thirds 1–4, wide rings 1–8, and the original 4×4 as a later optional comparison. Each has two seeds at three clue-density presets. These are not calibrated human difficulty levels. Both independent solution counters verify each public puzzle; no answer arrays or Venndoku experiments are in the public catalog.

Linked halves have a purple vertical and amber horizontal divider. Linked thirds show six fixed boundaries, alternating primary purple and offset amber. Wide rings mark fixed two-spoke wedges, never rolling windows. Instructions distinguish whole rings, per-ring sections, spokes and curved groups.

Inspector is off initially. It is a separate mode: tapping only chooses an inspected cell, outlines **all** of its groups, and disables pen/notes, undo, erase, autofill and keyboard entry. Turning it off removes group highlights. Normal selection/value highlights remain game controls.

Each example has independent progress, notes and ratings in versioned browser-local storage. The compare view has its own draft and asks which directions the tester would play again. Written feedback and puzzle progress survive refresh; no existing production game saves are read or overwritten.

## Voice notes

Microphone permission is requested only when Record is pressed. Pause and Continue use one MediaRecorder instance and one combined recording; pauses do not count toward the five active minutes. Pausing disables the microphone tracks, finishing/removing/leaving releases them. Audio is locally drafted in IndexedDB, can be reviewed/downloaded, and is uploaded only on Send. Switching examples is blocked while an unfinished recording is active or paused. A restored, finished recording can be reviewed or removed; it cannot be appended after reload.

The cap is 2 MiB (and an automatic stop near 1.75 MB), so base64 JSON remains under Vercel's 4.5 MB function request limit. If microphone access, recording, or local audio storage is unavailable, written feedback remains usable. Real iOS/Android microphone and background behavior still needs physical-device testing; fake recorder lifecycle checks do not establish that.

The owner selected public recordings with separate explicit tester consent. Default `PLAYTEST_AUDIO_AUDIENCE=public`; an explicit `private` setting remains available for a future private round. Public results show consented public recordings with audio controls, and attachment existence for legacy private audio without exposing its bytes. Private playback requires `PLAYTEST_OWNER_KEY` in a Bearer header, entered through the collapsed owner section on the results page; the key is not persisted in browser storage or URLs. Configure this secret before collecting private recordings that the owner needs to review. The public form requires a second, initially unchecked audio-consent checkbox and the server rejects uploads without it. Existing private recordings retain their stored audience; this choice does not republish them. The stored consent/audience on a response controls future access even if configuration changes.

## Service and storage

`/api/playtesting/{config,ticket,responses,results,audio/:id}` is additive and uses separate tables from account/challenge storage:

- `doku_playtest_response`: versioned response metadata plus bounded audio bytes.
- `doku_playtest_limit`: durable hashed rate-limit buckets, no raw IPs stored.
- `doku_playtest_meta`: server-only HMAC ticket secret.

Tables live in the separate `doku_playtesting` schema and are created lazily and additively through the configured `DATABASE_URL`; no existing table is altered. This is a separate data namespace on the existing PostgreSQL service, not a separate physical database or database credential. On Vercel the service refuses ephemeral filesystem storage. Locally `PLAYTEST_DATA_FILE` selects an atomic JSON store. Keep it outside Git. The standalone tables intentionally avoid rewriting the existing challenge store's single JSON row with audio.

Spam controls: same-origin form submissions, hidden honeypot, signed/IP-bound short-lived tickets (minimum age 4 seconds, expiry 2 hours), a small browser proof of work, strict catalog/rating validation, text/audio limits, 80 tickets and 40 responses per hashed IP/hour, 200 responses/day globally, and a durable aggregate cap of 1,000 responses / 64 MiB audio. PostgreSQL admission uses a transaction advisory lock across instances. This discourages casual automation; it is not a CAPTCHA or guarantee of bot exclusion. Request bodies are capped at 3 MB, audio MIME and container signatures are validated, and feedback is rendered as escaped React text.

Results show the latest 300 responses. Direction summaries combine explicit play-again ratings and per-example enjoyment, with that meaning stated in the UI; repeated testers are not deduplicated, and a tiny sample is not a representative poll. The storage cap spans all rounds until an explicitly authorized retention/export process is implemented; no automatic response deletion occurs.

## Verification and publishing

Run `npm run typecheck`, `npm run test:game`, `node --test tests/playtest-catalog.test.mjs`, `npm run test:sites`, `npm run check:runtime`, and both builds. Exercise a browser submission and results read on an isolated origin/data file. Research in `docs/` is excluded by `.vercelignore`; only the approved ring catalog is bundled.

Publish through the repository's production workflow. Before hosting, verify the project/team, fresh source snapshot, storage configuration and owner audio access. Do not run unrelated account migrations just to publish this testing surface. Vercel preview protection does not provide an accountless friend-testing URL; the public path needs an authorized deployment to the production custom domain or a separately configured public test host. No project-wide protection changes are implied.

## Standalone friend-testing deployment

`node scripts/prepare-playtesting-preview.mjs` creates an allowlisted, testing-only upload directory and a SHA-256 source manifest. It contains only the testing UI/catalog, feedback service, dependencies and icon; its API exposes no production account, challenge or player routes. It skips unrelated account migrations. Deploy that directory to the existing project's **Preview** environment, never promote this stripped-down build to production. A deployment-specific public-access override can make this newly created testing surface accountless while retaining project-wide and live-player protection settings. The eventual main-site path still follows the normal production integration workflow.

Legacy private voice review is configured with a preview-only owner secret. The local owner copy is `.data/playtesting-owner-key.txt` (mode 0600, ignored by Git). Open Owner access to private recordings on results and paste that key; do not share it with testers or put it in a URL.

## Published November 10, 2026

Public test: https://doku-playtesting-tracyapps-projects.vercel.app/testing/

Public written results: https://doku-playtesting-tracyapps-projects.vercel.app/testing/results/

Preview deployment `dpl_6BXzXE4ArBknYENC5Eq47TTCHc9Z` is READY. This is an allowlisted, testing-only snapshot of the uncommitted feature branch, with a deployment-specific public-access override and stable testing alias. **Do not promote this stripped build to production.** The production deployment and main navigation were not changed; the permanent main-site path awaits normal integration. No commit or push was made. Source hashes and hosted-check evidence are under `docs/qa/`, excluded from deployment.

Fresh verification: 42 game/service tests, 7 packaging/catalog checks, typecheck, both builds and the 28-file runtime lock passed. Hosted checks through both deployment URL and stable alias confirmed accountless access, signed submission, PostgreSQL metadata/audio round trip, duplicate retry protection, private audio denial, authorized owner playback and exclusion of setup responses from public ratings. Owner-authorized `setupCheck: true` submissions exercise the normal save path but are not listed as tester opinions; they are retained under the same storage cap. Public results were empty after these checks.

No runtime errors were returned in the final deployment's scoped log scan. Earlier failed preview builds remain protected; the temporary project automation-bypass credential created by the CLI was revoked. No project-wide protection was disabled. Voice lifecycle was checked with a simulated recorder and synthetic WAV upload, not a physical phone microphone.

### Owner consent choice applied

After the initial preview, the owner chose public ratings, notes and recordings with separate explicit tester consent. Updated preview `dpl_8hPvEGPHVvPK35o5uQMNWHPhPX31` is READY and replaces the earlier preview at the same testing alias. The page explains the audio audience before recording, audio consent starts unchecked, and uploads without consent are rejected by the server. Existing private recordings are not republished. The targeted 10-test suite, all 43 game/service tests, typecheck, web build and runtime lock passed. The hosted check verified the public policy and rejected missing consent before saving its owner-only setup recording.

### Conflict clarity follow-up

Repeated entries now have a stronger localized fill/outline and underlined digits. A persistent Number conflict panel names the repeated value, each affected group and the exact cell locations, plus an instruction to change or erase an editable entry. Only duplicate cells are marked. The local gallery uses the same conflict calculation, and undo/erase clear the explanation as soon as the conflict is resolved. Inspector activation and group-highlighting rules are unchanged.

The conflict-clarity preview `dpl_3hVzp5bCDoTKc3h75qd5U9ZUo5Fs` is READY at the same testing alias. Fresh checks: 44 game/service tests, 7 packaging/catalog checks, typecheck, web build and runtime lock pass. Browser checks in isolated tabs verified conflict text, exactly two marked duplicate cells, and error removal after Undo in both the local gallery and hosted player. Existing browser game progress was not used for QA.
