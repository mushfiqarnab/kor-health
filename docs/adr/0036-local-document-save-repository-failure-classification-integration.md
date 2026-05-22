# ADR 0036: Local Document Save Repository Failure Classification Integration

## Status

Accepted.

## Date

2026-05-23

## Context

Slice 34 introduced a safe repository failure classifier for local document save failures.

Slice 35 introduced a classify-and-rethrow helper that classifies a repository failure phase, optionally notifies an in-process callback, and always rethrows the original cause unchanged.

Before Slice 36, saveLocalDocumentReferences propagated repository failures directly without using the classifier or rethrow helper.

That behavior was safe but left no structured internal seam for future persistence, observability, or durable-failure handling decisions.

Slice 36 integrates the classify-and-rethrow helper into saveLocalDocumentReferences while preserving existing thrown-error behavior.

Repository failures remain exceptional.

Repository failures are not preflight rejections.

Repository failures are not completed or rejected save outcomes.

## Decision

Modify:

src/application/local-document-save/localDocumentSaveUseCase.ts

Add contract tests:

src/application/local-document-save/__tests__/localDocumentSaveUseCaseRepositoryFailureClassification.contract.test.ts

The save use case now accepts an optional in-process callback:

onRepositoryFailureClassification

When payload save fails:

- classify the failure as local_encrypted_document_payload_save
- call the optional classification callback
- rethrow the original cause unchanged

When reference save fails:

- classify the failure as clinical_document_reference_save
- call the optional classification callback
- rethrow the original cause unchanged

When preflight validation fails:

- do not classify anything as a repository failure
- preserve existing preflight error behavior

## Behavior Preservation Rule

saveLocalDocumentReferences must continue to:

- run preflight validation before repository calls
- throw preflight validation errors for ineligible saves
- save local encrypted payload before clinical document reference
- rethrow original repository causes unchanged
- return completed LocalDocumentSaveResult on success

Slice 36 does not convert repository failures into:

- preflight rejections
- LocalDocumentSaveOutcome rejected values
- completed results
- audit receipts
- log-safe objects
- display-safe messages
- notification payloads
- telemetry events
- cloud-safe receipts
- sync-safe receipts

## Classification Callback Rule

onRepositoryFailureClassification is in-process only.

It may receive:

- kind
- phase

It must not receive:

- thrown cause
- error message
- stack trace
- patient IDs
- reference IDs
- resource IDs
- payload IDs
- encrypted payload refs
- ciphertext refs
- encryption envelope refs
- filenames
- file paths
- storage paths
- storage URLs
- clinical labels
- adapter details
- database details
- cloud provider details

If the callback throws, the original repository cause still wins.

## Scope

This slice modifies only:

- local document save use case
- local document save repository failure classification integration contract

This slice does not modify:

- saveLocalDocumentReferencesWithOutcome
- LocalDocumentRepositoryPort
- in-memory local document repository adapter
- local document save preflight decision
- local document save result
- local document save outcome
- repository failure classifier
- repository failure rethrow helper
- project state ledger
- package scripts
- source boundary scan script

This slice does not introduce:

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

The save use case may import:

- classifyAndRethrowLocalDocumentRepositoryFailure
- LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE
- LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE
- LocalDocumentRepositoryFailureClassification type

The save use case must not inspect, serialize, stringify, log, or expose thrown repository causes.

The save use case must not read:

- .message
- .stack
- Object.keys
- Object.values
- Object.entries
- JSON.stringify
- String

The save use case must not introduce:

- console logging
- logger calls
- cloud references
- sync references
- storage paths
- clinical metadata
- UI display messages
- audit receipt claims
- telemetry
- analytics

## Design Rationale

Repository failures can contain sensitive adapter details.

A future durable persistence layer may throw errors containing filenames, file paths, database details, storage paths, cloud provider details, patient identifiers, or other unsafe fragments.

The application layer needs a safe way to classify failure phase without exposing the thrown cause.

The classify-and-rethrow helper already guarantees original-cause preservation.

Integrating it into the save use case creates a narrow internal seam while preserving public behavior.

This allows future slices to make explicit decisions about durable persistence and failure handling without inventing ad hoc error wrapping.

## Test Coverage

Slice 36 increases the suite to:

- 36 test files
- 504 passing tests

New tests verify:

- payload-save repository failures are classified as local_encrypted_document_payload_save
- reference-save repository failures are classified as clinical_document_reference_save
- original repository causes are rethrown unchanged
- preflight failures are not classified as repository failures
- repository failure propagation still works without a callback
- callback failures do not replace original repository failures
- classifications remain separate from save results, save outcomes, and preflight rejections
- save use case source uses the rethrow helper
- save use case source remains free from logging, cloud, sync, audit, UI, AI, OCR, telemetry, analytics, storage, and readable metadata concerns

## Consequences

Positive consequences:

- Repository failure classification is now integrated into the save use case.
- Original thrown-error behavior is preserved.
- Preflight validation remains separate from repository failure handling.
- Future durable persistence work has a safer failure-classification seam.
- No logging, telemetry, cloud, sync, UI, or persistence expansion is introduced.

Trade-offs:

- The optional callback is still internal only.
- The callback is not log-safe, audit-safe, sync-safe, cloud-safe, display-safe, or notification-safe by default.
- The save use case still does not retry, roll back, persist, or audit repository failures.
- Future slices must decide explicitly whether classifications may be used by audit, UI, sync, cloud, or telemetry layers.

## Next Technical Target

After Slice 36 is locked, choose exactly one Slice 37 target.

Recommended next target:

Local Document Save Repository Failure Classification Outcome Boundary Decision

Reason:

The save use case now classifies repository failures while preserving thrown-error behavior. The next safe decision is whether the outcome wrapper should remain preflight-only or whether a separate internal failure-reporting boundary is needed.

Slice 37 must not introduce Supabase, WatermelonDB, SQLite, filesystem storage, sync, OCR, AI, UI, BM&DC verification, payments, audit receipts, cloud-safe receipts, notification payloads, telemetry, analytics, or readable clinical metadata before their gates.
