# ADR 0035: Local Document Repository Failure Rethrow Helper

## Status

Accepted.

## Date

2026-05-22

## Context

Slice 34 introduced local document repository failure classification.

That classifier can safely classify repository failure phase without inspecting or exposing thrown causes.

After Slice 34, the classifier existed but no helper existed to combine classification with preservation of existing thrown-error behavior.

The local document save use case still propagates repository failures directly.

That behavior remains correct.

Slice 35 introduces a small helper that classifies a repository failure, optionally notifies an in-process callback with the safe classification, and always rethrows the original cause unchanged.

This creates a safe seam for future integration without changing save behavior.

## Decision

Create:

src/application/local-document-save/localDocumentRepositoryFailureRethrow.ts

Create contract tests:

src/application/local-document-save/__tests__/localDocumentRepositoryFailureRethrow.contract.test.ts

The helper exposes:

- classifyAndRethrowLocalDocumentRepositoryFailure
- ClassifyAndRethrowLocalDocumentRepositoryFailureInput

The helper accepts:

- phase
- cause
- optional onClassification callback

The helper behavior is:

1. Call classifyLocalDocumentRepositoryFailure.
2. Pass the safe classification to onClassification if provided.
3. If the callback throws, ignore the callback failure.
4. Always rethrow the original cause unchanged.

## Original Cause Preservation Rule

The original repository failure must remain the thrown value.

The helper must not replace it with:

- classification object
- observer error
- wrapped error
- sanitized error
- stringified error
- rejected outcome
- completed result
- audit receipt
- log-safe receipt
- display-safe receipt
- cloud-safe receipt
- notification payload

Repository failures are still exceptional failures.

They are not preflight rejections.

They are not successful save outcomes.

## Classification Callback Rule

The optional callback is in-process only.

It may receive:

- kind
- phase

It must not receive:

- thrown cause
- message
- stack
- patient IDs
- reference IDs
- resource IDs
- payload IDs
- encrypted payload refs
- filenames
- file paths
- storage paths
- storage URLs
- clinical metadata
- adapter details
- database details
- cloud provider details

If the callback fails, the helper must still rethrow the original repository cause.

## Scope

This slice adds only:

- local repository failure rethrow helper
- tests proving original cause preservation and safe classification callback behavior

This slice does not modify:

- saveLocalDocumentReferences
- saveLocalDocumentReferencesWithOutcome
- LocalDocumentRepositoryPort
- in-memory local document repository adapter
- local document save preflight decision
- local document save result
- local document save outcome
- project state ledger
- package scripts
- source boundary scan script

This slice does not introduce:

- catching repository errors inside the save use case
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

The helper may import only:

- classifyLocalDocumentRepositoryFailure
- ClassifyLocalDocumentRepositoryFailureInput
- LocalDocumentRepositoryFailureClassification

from:

src/application/local-document-save/localDocumentRepositoryFailureClassification.ts

The helper must not import:

- repository ports
- save use cases
- preflight logic
- result types
- outcome types
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

The helper must not inspect:

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
- clinical labels
- storage paths
- cloud provider details

## Design Rationale

The helper creates a narrow bridge between repository failure classification and future integration points.

It does not change current save behavior.

It prevents future callers from inventing ad hoc classification and rethrow behavior.

It also guarantees that observer or callback failures cannot hide the original repository failure.

This keeps the failure chain honest while preserving privacy.

## Test Coverage

Slice 35 increases the suite to:

- 35 test files
- 497 passing tests

New tests verify:

- payload-save failures are classified and the original Error is rethrown unchanged
- reference-save failures are classified and non-Error causes are rethrown unchanged
- unknown phase strings are sanitized before rethrow
- original cause is rethrown even when no callback is provided
- callback failures do not replace the original repository failure
- original thrown cause objects are not mutated
- repository failure classifications remain separate from preflight rejections and save outcomes
- helper source imports only the classifier module
- helper source remains free from save use cases, repository ports, infrastructure, storage, cloud, sync, audit, crypto adapter, AI, OCR, UI, logging, telemetry, and readable metadata concerns

## Consequences

Positive consequences:

- Future integration can classify repository failures without leaking causes.
- Original repository failure propagation remains intact.
- Callback failures cannot mask the original failure.
- The save use case remains unchanged.
- The architecture gains a safe seam for later durable persistence and observability decisions.

Trade-offs:

- The helper is not yet used by saveLocalDocumentReferences.
- The helper does not retry, roll back, persist, or audit failures.
- The callback is not log-safe, audit-safe, sync-safe, cloud-safe, display-safe, or notification-safe by default.
- Human review remains mandatory before any future integration uses classifications in logs, UI, sync, audit, cloud, or telemetry.

## Next Technical Target

After Slice 35 is locked, choose exactly one Slice 36 target.

Recommended next target:

Local Document Save Repository Failure Classification Integration Contract

Reason:

The classifier and rethrow helper now exist. The next safe slice can decide whether saveLocalDocumentReferences should use the helper while preserving public thrown-error behavior and avoiding outcome conversion.

Slice 36 must not introduce Supabase, WatermelonDB, SQLite, filesystem storage, sync, OCR, AI, UI, BM&DC verification, payments, audit receipts, cloud-safe receipts, notification payloads, telemetry, analytics, or readable clinical metadata before their gates.
