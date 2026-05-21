# ADR 0033: Project State Ledger Slice 32 Update

## Status

Accepted.

## Date

2026-05-22

## Context

Slice 31 introduced docs/project-kor/PROJECT_STATE.md as a repo-backed state ledger.

Slice 32 introduced scripts/check-source-boundary.ps1 as a source boundary scan script, plus a contract test for that script.

After Slice 32 was locked, PROJECT_STATE.md still reflected the older Slice 30 baseline:

- locked slices through Slice 30
- latest locked commit a7926c1
- 31 test files
- 468 tests
- latest ADR 0030
- Candidate Slice 32 options

That made the ledger stale.

Slice 33 updates the Project KOr state ledger so it reflects the locked baseline through Slice 32.

## Decision

Update:

docs/project-kor/PROJECT_STATE.md

Update its documentation contract:

docs/project-kor/__tests__/projectState.contract.test.ts

The updated state ledger records:

- Branch: main
- Locked slices: Slice 8 through Slice 32
- Latest locked commit: 6c7899a test: add source boundary scan script
- Current test state: 33 test files, 481 tests
- Working tree: clean
- Remote: up to date with origin/main
- Latest ADR: docs/adr/0032-source-boundary-scan-script.md
- Project KOr state ledger as a built foundation
- source boundary scan script as a built foundation
- source boundary scan script as repository tooling only
- Candidate Slice 34 options
- the rule that only one candidate may become active after Slice 33 is locked

## Reflected Baseline Rule

PROJECT_STATE.md records the latest locked baseline known at the start of the state-ledger update slice.

For Slice 33, that baseline is Slice 32 and commit 6c7899a.

The ledger does not attempt to record the future hash of the Slice 33 commit before that commit exists.

This prevents self-referential commit metadata and keeps the file honest.

Future state-ledger updates must either:

- record the latest previously locked baseline, or
- use a dedicated post-lock state update slice if exact current HEAD metadata is required inside PROJECT_STATE.md.

## Scope

This slice modifies only:

- docs/project-kor/PROJECT_STATE.md
- docs/project-kor/__tests__/projectState.contract.test.ts
- docs/adr/0033-project-state-ledger-slice-32-update.md

This slice does not modify:

- src/
- mobile/
- application source
- domain source
- infrastructure source
- scripts/
- package.json
- runtime behavior
- build behavior
- Expo configuration
- persistence
- sync
- cloud
- UI
- OCR
- AI
- cryptography

## Boundary Rules

PROJECT_STATE.md must not claim that future infrastructure is implemented.

It must not claim:

- WatermelonDB adapter is implemented
- SQLite schema is implemented
- Supabase sync is implemented
- cloud upload is implemented
- filesystem encrypted blob storage is implemented
- OCR is implemented
- AI summaries are implemented
- doctor portal is implemented
- patient portal is implemented
- BM&DC verification is implemented
- payments are implemented

PROJECT_STATE.md must keep KOr laws intact:

- patient authority
- device vault
- blind cloud
- verified doctor
- permissioned AI
- audited system
- architecture discipline
- no readable ePHI in cloud, logs, analytics, filenames, push notifications, or AI calls
- no automatic access from KOr ID
- explicit consent grants
- explicit request_ai_summary permission

## Candidate Slice Rule

Slice 33 replaces stale Candidate Slice 32 entries with Candidate Slice 34 entries.

Candidate Slice 34 options are:

- Local Document Repository Error Classification Decision
- Local Document Mutation Log Domain
- Local Persistence Readiness Decision
- Project KOr Architecture Laws Documentation

Only one candidate may become active after Slice 33 is locked.

A candidate listed in PROJECT_STATE.md is not implemented, active, or locked.

## Design Rationale

The state ledger exists to reduce reliance on chat memory.

A stale state ledger creates governance risk because future slices may start from old assumptions.

Updating the ledger after Slice 32 keeps the repo-backed dashboard aligned with the latest locked baseline before choosing the next implementation target.

This is intentionally documentation-only.

## Test Coverage

Slice 33 keeps the suite at:

- 33 test files
- 481 passing tests

Updated tests verify:

- PROJECT_STATE.md reflects locked slices through Slice 32
- latest locked baseline commit is 6c7899a
- test state is 33 test files and 481 tests
- latest ADR is ADR 0032
- source boundary scan script is recorded as built tooling
- stale Slice 30 state is absent
- stale Candidate Slice 32 entries are absent
- Candidate Slice 34 entries are present
- Candidate Slice 34 is not claimed as implemented or locked
- unavailable infrastructure is not falsely claimed
- placeholder architecture language is absent

## Consequences

Positive consequences:

- PROJECT_STATE.md now reflects Slice 32 rather than Slice 30.
- Future slice selection starts from a more accurate repo-backed dashboard.
- Source boundary scan script is recorded as built tooling.
- Candidate Slice 34 options are visible without becoming active.
- Documentation-only changes remain contract-tested.

Trade-offs:

- PROJECT_STATE.md still requires disciplined future updates.
- The ledger records a reflected baseline, not the future commit hash of its own update slice.
- The state ledger does not replace ADRs, tests, source review, or architecture review.

## Next Technical Target

After Slice 33 is locked, choose exactly one Slice 34 target.

Recommended next target:

Local Document Repository Error Classification Decision

Reason:

Before durable persistence, mutation logs, or local persistence readiness, the local save architecture should decide how repository failures are represented internally without leaking sensitive details or incorrectly converting persistence failures into safe preflight outcomes.

Slice 34 must not introduce Supabase, WatermelonDB, SQLite, filesystem storage, sync, OCR, AI, UI, BM&DC verification, payments, audit receipts, cloud-safe receipts, notification payloads, or readable clinical metadata before their gates.
