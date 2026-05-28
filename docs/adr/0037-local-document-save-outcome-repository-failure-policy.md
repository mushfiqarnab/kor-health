# ADR 0037: Local Document Save Outcome Repository Failure Policy

## Status

Accepted.

## Date

2026-05-23

## Context

Slices 34 through 36 introduced safe local document repository failure classification.

Slice 34 created a classifier that records only approved repository failure phases without inspecting thrown causes.

Slice 35 created a classify-and-rethrow helper that classifies a failure and rethrows the original cause unchanged.

Slice 36 integrated repository failure classification into saveLocalDocumentReferences while preserving original thrown-error behavior.

The local document save outcome wrapper still returns LocalDocumentSaveOutcome values only for completed saves and preflight rejections.

That behavior is correct.

Repository failures are different from preflight failures. Repository failures may contain sensitive adapter details, file paths, storage paths, database details, or cloud provider details in thrown causes. They must not be converted into LocalDocumentSaveOutcome values by default.

## Decision

Create:

src/application/local-document-save/localDocumentSaveOutcomeRepositoryFailurePolicy.ts

Create contract tests:

src/application/local-document-save/__tests__/localDocumentSaveOutcomeRepositoryFailurePolicy.contract.test.ts

The policy states:

- repository failures rethrow the original cause
- repository failures are not LocalDocumentSaveOutcome values
- repository failures may classify in-process only

The policy is a declarative application boundary. It does not catch errors, classify errors, import save use cases, or modify outcome behavior.

## Policy Constants

The policy module exposes:

- LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURE_POLICY_KIND
- LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_RETHROW
- LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_NOT_OUTCOMES
- LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_MAY_CLASSIFY_IN_PROCESS
- createLocalDocumentSaveOutcomeRepositoryFailurePolicy
- LocalDocumentSaveOutcomeRepositoryFailurePolicy

## Scope

This slice adds only:

- local document save outcome repository failure policy
- tests proving the policy is minimal, frozen, and import-free

This slice does not modify:

- localDocumentSaveOutcome.ts
- localDocumentSaveOutcomeUseCase.ts
- localDocumentSaveUseCase.ts
- repository failure classifier
- repository failure rethrow helper
- repository port
- in-memory repository adapter
- project state ledger
- package scripts
- source boundary scan script

This slice does not introduce:

- repository_failed outcome status
- repository failure result object
- catching repository failures in the outcome wrapper
- converting repository failures into rejected outcomes
- retry logic
- rollback
- transactions
- mutation logs
- idempotency keys
- durable persistence
- WatermelonDB
- SQLite
- filesystem storage
- Supabase
- sync
- OCR
- AI
- UI
- audit receipts
- log-safe receipts
- display-safe receipts
- cloud-safe receipts
- notification payloads
- telemetry
- analytics
- clinical metadata

## Boundary Rules

The policy module must not import anything.

It must not depend on:

- LocalDocumentRepositoryPort
- saveLocalDocumentReferences
- saveLocalDocumentReferencesWithOutcome
- prepareLocalDocumentSave
- repository failure classifier
- repository failure rethrow helper
- LocalDocumentSaveOutcome constructors
- LocalDocumentSaveResult constructors
- domain factories
- active-state helpers
- infrastructure adapters
- storage systems
- cloud systems
- sync systems
- crypto adapters
- AI systems
- OCR systems
- UI systems
- audit systems
- telemetry systems
- analytics systems

It must not inspect:

- error messages
- stack traces
- object keys
- object values
- object entries
- patient identifiers
- resource identifiers
- payload identifiers
- encrypted payload references
- filenames
- file paths
- storage paths
- storage URLs
- clinical labels
- database details
- cloud provider details

## Design Rationale

LocalDocumentSaveOutcome is intentionally narrow.

It represents:

- completed internal application saves
- rejected preflight decisions

It must not become a general error envelope.

Turning repository failures into outcome values would blur a critical architecture boundary. It could encourage future logging, display, sync, analytics, or cloud use of values derived from repository failures.

Repository failures may contain unsafe details in thrown causes. The safe path is:

- classify in-process when needed
- preserve the original thrown failure
- avoid outcome conversion
- require a future explicit slice before any audit, UI, sync, cloud, telemetry, or display use

This keeps failure handling honest and privacy-preserving.

## Test Coverage

Slice 37 increases the suite to:

- 37 test files
- 510 passing tests

New tests verify:

- the policy creates a frozen minimal object
- the policy exposes only approved keys
- the policy contains no sensitive details
- the policy makes no log-safe, audit-safe, sync-safe, cloud-safe, display-safe, or notification-safe claims
- the policy constants are explicit
- repository failures are not represented as outcome statuses
- localDocumentSaveOutcome.ts remains completed-or-preflight-rejected only
- localDocumentSaveOutcomeUseCase.ts does not catch repository failures or convert them into outcomes
- the policy module has no imports
- the policy module remains free from repository ports, save use cases, infrastructure, storage, cloud, sync, audit, crypto adapter, AI, OCR, UI, telemetry, analytics, and readable metadata concerns

## Consequences

Positive consequences:

- Outcome semantics remain narrow and safe.
- Repository failures stay outside LocalDocumentSaveOutcome values.
- Future developers get an explicit policy boundary.
- No runtime behavior changes are introduced.
- No infrastructure, storage, sync, AI, OCR, UI, telemetry, analytics, or audit behavior is introduced.

Trade-offs:

- The policy is not yet used by a caller.
- It does not produce user-facing messages.
- It does not create audit-safe receipts.
- It does not classify errors itself.
- Future slices must still decide whether and how repository failure classifications can feed audit, UI, sync, telemetry, cloud, or operational monitoring.

## Next Technical Target

After Slice 37 is locked, choose exactly one Slice 38 target.

Recommended next target:

Project KOr State Ledger Update Through Slice 37

Reason:

PROJECT_STATE.md currently lags behind the repository’s locked source state. Since Slices 34 through 37 created a coherent repository-failure boundary chain, the repo-backed state ledger should be refreshed in a dedicated documentation slice before starting durable persistence or mutation-log work.

Slice 38 must not introduce Supabase, WatermelonDB, SQLite, filesystem storage, sync, OCR, AI, UI, BM&DC verification, payments, audit receipts, cloud-safe receipts, notification payloads, telemetry, analytics, or readable clinical metadata before their gates.
