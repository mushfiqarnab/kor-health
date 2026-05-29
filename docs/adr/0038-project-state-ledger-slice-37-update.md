# ADR 0038: Project State Ledger Update for Slice 37

## Status

Accepted.

## Date

2026-05-29

## Context

Slice 37 locked the local document save outcome repository failure policy.

After Slice 37, the repository state was:

- Locked slices: Slice 8 through Slice 37
- Latest locked commit: 063f9db docs: correct ADR 0037 date
- Latest locked source commit: 50c8ff1 feat: add local document save outcome repository failure policy
- Current locked test state: 37 test files, 510 tests
- Latest ADR: docs/adr/0037-local-document-save-outcome-repository-failure-policy.md

However, docs/project-kor/PROJECT_STATE.md still reflected the older Slice 32 baseline.

That stale ledger created risk because future slices could rely on chat memory rather than repository-backed state.

Slice 38 updates the Project KOr state ledger through the locked Slice 37 baseline.

## Decision

Modify:

docs/project-kor/PROJECT_STATE.md

Modify contract tests:

docs/project-kor/__tests__/projectState.contract.test.ts

The state ledger now records:

- current locked branch
- locked slices through Slice 37
- latest locked commit
- latest locked source commit
- locked Slice 37 test count
- latest ADR through ADR 0037
- permanent product laws
- security laws
- architecture constraints
- slice workflow law
- built foundations through Slice 37
- current local document save architecture
- current local document save failure boundary
- current validation tooling
- built access and sharing chain
- not implemented foundations
- forbidden premature work
- candidate Slice 39 options
- state ledger update rule
- current stop rules

## Reflected-Baseline Rule

Slice 38 records the locked baseline through Slice 37.

It does not claim Slice 38 itself is locked inside PROJECT_STATE.md.

This is intentional.

A state-ledger update slice must not self-certify its own lock status before that slice has passed tests, validation, ADR creation, commit, push, and final clean-tree evidence.

Therefore, PROJECT_STATE.md records:

- Locked slices: Slice 8 through Slice 37
- Current test state: 37 test files, 510 tests

During Slice 38 implementation, the in-progress test suite may show:

- 37 test files, 511 tests

That higher count belongs to the in-progress Slice 38 contract and must not be recorded as the locked baseline until a later state-ledger slice chooses to reflect it.

## Scope

This slice modifies only repository documentation governance:

- docs/project-kor/PROJECT_STATE.md
- docs/project-kor/__tests__/projectState.contract.test.ts
- docs/adr/0038-project-state-ledger-slice-37-update.md

This slice does not modify:

- src/
- scripts/
- mobile/
- package.json
- runtime code
- domain code
- application code
- infrastructure code
- tests outside docs/project-kor

This slice does not introduce:

- Supabase persistence
- WatermelonDB
- SQLite schema
- filesystem storage
- sync
- OCR
- AI summaries
- doctor portal UI
- patient portal UI
- BM&DC verification
- payments
- telemetry
- analytics
- audit receipts
- mutation logs
- cloud upload
- readable clinical metadata

## Local Document Save Failure Boundary Recorded

The ledger now records the failure-boundary architecture produced by Slices 34 through 37:

- Repository failures are not preflight rejections.
- Repository failures are not LocalDocumentSaveOutcome values.
- Repository failures rethrow the original cause.
- Repository failure classifications may be observed in-process only.
- The outcome wrapper remains preflight-rejection-only.
- The outcome policy is not a log-safe, audit-safe, sync-safe, cloud-safe, notification-safe, telemetry-safe, analytics-safe, or display-safe receipt.

This protects the distinction between safe validation rejection and unsafe execution failure.

## Built Foundations Recorded

The ledger now records foundations through Slice 37, including:

- local document repository failure classification
- local document repository failure rethrow helper
- local document save repository failure classification integration
- local document save outcome repository failure policy

It also preserves earlier foundations, including:

- local encrypted document payload boundary
- local document repository port
- in-memory local document repository adapter
- local document save use case
- local document save preflight decision
- local document save result type
- local document save outcome boundary
- local document save outcome wrapper
- share packet clinical reference selection
- access request to consent grant transition
- share packet issuance from consent grant
- source boundary scan script

## Not Implemented Claims

The ledger explicitly states that the following are not implemented:

- WatermelonDB adapter
- SQLite schema
- Supabase sync
- cloud upload
- filesystem encrypted blob storage
- OCR
- AI summaries
- doctor portal
- patient portal
- BM&DC verification
- payments
- telemetry
- analytics
- audit receipts
- mutation logs

This prevents roadmap pressure from being mistaken for implementation progress.

## Candidate Slice 39 Options

The ledger records these as candidates only:

- Local Document Mutation Log Domain
- Local Persistence Readiness Decision
- Project KOr Architecture Laws Documentation
- Local Document Save Failure Boundary Documentation Hardening

Only one candidate may become active after Slice 38 is locked.

No Slice 39 candidate is implemented by Slice 38.

## Test Coverage

Slice 38 increases the in-progress suite to:

- 37 test files
- 511 passing tests

The Project State contract now verifies:

- locked repository state through Slice 37
- permanent product laws
- security laws
- built foundations through Slice 37
- local document save failure-boundary architecture
- forbidden premature work
- candidate Slice 39 options
- operational state-ledger rules
- absence of placeholder architecture

## Consequences

Positive consequences:

- The repository now contains an up-to-date state ledger through Slice 37.
- Future slice planning no longer depends on chat memory for the locked baseline.
- The local document save failure-boundary architecture is explicitly recorded.
- The reflected-baseline rule prevents the ledger from claiming future or in-progress locked state.
- No runtime code or infrastructure is changed.

Trade-offs:

- PROJECT_STATE.md will intentionally lag by one update slice.
- Future state changes still require dedicated ledger updates or explicit documentation gates.
- The ledger remains a cockpit dashboard, not a replacement for ADRs, tests, or the architecture dossier.

## Next Technical Target

After Slice 38 is locked, choose exactly one Slice 39 target.

Recommended default:

Local Document Mutation Log Domain

Reason:

A mutation-log domain can prepare future persistence and sync without introducing storage, SQLite, WatermelonDB, Supabase, filesystem storage, cloud upload, telemetry, analytics, audit receipts, or sync behavior.

Alternative:

Local Persistence Readiness Decision

Reason:

If storage risks feel too sharp, define readiness gates before any WatermelonDB, SQLite, or filesystem work begins.
