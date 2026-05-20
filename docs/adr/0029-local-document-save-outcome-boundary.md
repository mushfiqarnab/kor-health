# ADR 0029: Local Document Save Outcome Boundary

## Status

Accepted.

## Date

2026-05-21

## Context

Slice 25 introduced the Local Document Save Use Case.

Slice 26 introduced the Local Document Save Preflight Decision.

Slice 27 refactored saveLocalDocumentReferences so save eligibility validation delegates to prepareLocalDocumentSave.

Slice 28 introduced LocalDocumentSaveResult as a named internal application-layer completed result.

After Slice 28, the application layer had a completed result type but no small outcome boundary for representing either:

- a completed save outcome
- a rejected preflight outcome

Slice 29 introduces that outcome boundary.

This boundary is internal application output only. It is not a transaction receipt, audit receipt, log-safe object, sync-safe object, cloud-safe object, notification payload, or display view model.

The outcome boundary must not introduce storage, persistence, sync, cloud upload, transactionality, rollback, idempotency, mutation logs, encryption, decryption, OCR, AI, UI, or readable clinical metadata.

## Decision

Create an application-layer outcome module under:

src/application/local-document-save/localDocumentSaveOutcome.ts

The module exposes:

- LOCAL_DOCUMENT_SAVE_OUTCOME_COMPLETED_STATUS
- LOCAL_DOCUMENT_SAVE_OUTCOME_REJECTED_STATUS
- CreateCompletedLocalDocumentSaveOutcomeInput
- CreateRejectedLocalDocumentSaveOutcomeInput
- LocalDocumentSaveOutcome
- createCompletedLocalDocumentSaveOutcome
- createRejectedLocalDocumentSaveOutcome

The completed outcome includes exactly:

- status
- result

The rejected outcome includes exactly:

- status
- rejectionReason

The completed status value is:

- completed

The rejected status value is:

- rejected

Both outcome objects are frozen.

## Internal Outcome Rule

LocalDocumentSaveOutcome is internal application output.

It must not be treated as:

- audit receipt
- log-safe object
- sync receipt
- cloud receipt
- notification payload
- display view model
- transaction receipt
- rollback receipt
- analytics event
- telemetry event

Future slices that need audit, UI, sync, cloud, or notification behavior must create separate privacy-reviewed types.

## Rejection Rule

Rejected outcomes may contain only approved LocalDocumentSavePreflightFailureReason values:

- patient_id_mismatch
- encrypted_payload_ref_mismatch
- clinical_document_reference_inactive
- local_encrypted_document_payload_inactive

Rejected outcomes must not include:

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
- MIME types
- clinical labels
- clinical exclusion details
- debug data

## Completed Rule

Completed outcomes wrap LocalDocumentSaveResult.

They do not create a new save result, persistence receipt, audit receipt, sync mutation, transaction marker, or storage locator.

Completed outcomes must not claim durable transactionality, sync completion, cloud upload, audit persistence, or UI-safe disclosure.

## Scope

This slice implements:

- completed local document save outcome
- rejected local document save outcome
- frozen outcome objects
- safe preflight rejection reasons
- internal-only outcome semantics
- boundary tests excluding repositories, infrastructure, persistence, save use case imports, cloud, sync, transaction, crypto adapter, AI, OCR, UI, receipt, audit, display, and readable metadata concerns

This slice does not implement:

- save use case integration
- new public save behavior
- transaction boundaries
- rollback
- idempotency keys
- mutation logs
- durable persistence
- WatermelonDB adapter
- SQLite schema
- database migrations
- filesystem storage
- Supabase persistence
- cloud upload
- sync
- encryption
- decryption
- crypto adapter calls
- vault opening
- clinical document reference creation
- local encrypted payload creation
- patient share packet creation
- audit trail
- notification payloads
- UI view models
- OCR
- AI calls
- doctor portal UI
- patient portal UI
- analytics
- telemetry
- file upload
- WebRTC
- payment flows

## Boundary Rules

The outcome module may import:

- LocalDocumentSaveResult type
- LocalDocumentSavePreflightFailureReason type

The outcome module must not import:

- LocalDocumentRepositoryPort
- repository implementations
- in-memory local document repository adapter
- domain factory functions
- saveLocalDocumentReferences
- patient share packet domain
- Supabase
- SQLite
- WatermelonDB
- filesystem APIs
- Expo FileSystem
- SecureStore
- Expo SecureStore
- Expo Local Authentication
- localStorage
- sessionStorage
- AsyncStorage
- IndexedDB
- MMKV
- vault assembly
- crypto adapters
- document decryption services
- transaction modules
- rollback modules
- idempotency modules
- mutation-log modules
- sync modules
- OCR
- AI providers
- doctor portal UI
- patient portal UI
- BM&DC lookup
- upload services
- background sync
- React
- React Native

The outcome module must not create or process:

- decrypted payloads
- plaintext bytes
- ciphertext bytes
- filenames
- file paths
- storage paths
- storage URLs
- file URIs
- content URIs
- MIME types
- diagnosis text
- prescription text
- lab values
- OCR output
- AI output
- raw key material
- sealed key envelopes
- audit receipts
- log-safe claims
- display-safe claims
- notification payloads
- cloud-safe claims
- sync-safe claims

## Design Rationale

The outcome boundary belongs in the application layer because it describes the result of application-level save eligibility and completion decisions.

The preflight module owns save eligibility.

The result module owns completed save result shape.

The outcome module owns completed-versus-rejected application outcome shape.

The save use case remains unchanged in this slice.

The repository port owns persistence shape.

Infrastructure adapters own storage behavior.

This separation keeps outcome modeling small while avoiding premature transaction, sync, audit, storage, or UI semantics.

## Test Coverage

Slice 29 increases the suite to:

- 30 test files
- 460 passing tests

New tests verify:

- completed outcomes wrap LocalDocumentSaveResult
- rejected outcomes carry only approved preflight rejection reasons
- both outcome shapes are frozen
- completed outcomes expose only status and result
- rejected outcomes expose only status and rejectionReason
- rejected outcomes do not expose raw identifiers
- outcome objects do not model transaction, rollback, sync, storage, cloud, notification, display, audit, receipt, analytics, telemetry, OCR, AI, debug, or clinical metadata concerns
- outcome module remains free from repository, infrastructure, persistence, save use case imports, cloud, sync, transaction, crypto adapter, AI, OCR, UI, receipt, audit, display, and readable metadata concerns

## Consequences

Positive consequences:

- Local document save now has a small completed-versus-rejected outcome boundary.
- Rejected outcomes use safe preflight failure reasons only.
- Completed outcomes reuse the formal internal result type.
- Future application flows can distinguish completed and rejected paths without inventing storage, sync, transaction, audit, or UI semantics.
- The slice keeps durable persistence and sync out of scope.

Trade-offs:

- The save use case does not yet return LocalDocumentSaveOutcome.
- No transaction boundary is introduced.
- No rollback behavior is introduced.
- No idempotency key is introduced.
- No mutation log is introduced.
- No persistence durability is added.
- No sync behavior is added.
- The outcome is still internal application output and must not be logged, displayed, uploaded, notified, indexed, or audited as-is.

## Next Technical Target

The next target is Slice 30: Local Document Save Outcome Integration Decision.

That slice should decide whether saveLocalDocumentReferences should return LocalDocumentSaveOutcome or whether a separate orchestration wrapper should produce outcomes while preserving existing thrown-error behavior.

It must not introduce WatermelonDB, SQLite, filesystem storage, Supabase, sync, encryption, decryption, OCR, AI, UI, audit receipts, cloud-safe receipts, notification payloads, or readable clinical metadata.
