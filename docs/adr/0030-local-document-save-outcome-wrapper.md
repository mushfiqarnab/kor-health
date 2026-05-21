# ADR 0030: Local Document Save Outcome Use Case Wrapper

## Status

Accepted.

## Date

2026-05-21

## Context

Slice 25 introduced the Local Document Save Use Case.

Slice 26 introduced the Local Document Save Preflight Decision.

Slice 27 refactored saveLocalDocumentReferences so save eligibility validation delegates to prepareLocalDocumentSave.

Slice 28 introduced LocalDocumentSaveResult as a named internal application-layer completed result.

Slice 29 introduced LocalDocumentSaveOutcome as an internal completed-versus-rejected outcome boundary.

After Slice 29, the application layer had an outcome boundary but no wrapper use case that returned outcomes while preserving the locked behavior of saveLocalDocumentReferences.

Slice 30 introduces a separate outcome-producing wrapper:

saveLocalDocumentReferencesWithOutcome

This wrapper does not change saveLocalDocumentReferences.

The wrapper returns rejected outcomes for preflight rejection and completed outcomes for successful saves.

Repository failures still propagate as thrown errors. Repository failures are not converted into rejected outcomes because rejected outcomes are reserved for safe preflight rejection only.

This slice does not introduce storage, persistence, sync, cloud upload, transactionality, rollback, idempotency, mutation logs, encryption, decryption, OCR, AI, UI, audit receipts, notification payloads, cloud-safe receipts, display models, or readable clinical metadata.

## Decision

Create an application-layer wrapper module under:

src/application/local-document-save/localDocumentSaveOutcomeUseCase.ts

The module exposes:

- saveLocalDocumentReferencesWithOutcome

The wrapper accepts:

- SaveLocalDocumentReferencesInput

The wrapper returns:

- Promise<LocalDocumentSaveOutcome>

The wrapper behavior is:

1. Call prepareLocalDocumentSave.
2. If the preflight decision is not ready, return createRejectedLocalDocumentSaveOutcome with the safe preflight rejection reason.
3. If the preflight decision is ready, call saveLocalDocumentReferences.
4. Wrap the completed LocalDocumentSaveResult with createCompletedLocalDocumentSaveOutcome.
5. Let repository errors propagate.

## Public Behavior Preservation

saveLocalDocumentReferences remains unchanged.

It still:

- validates through prepareLocalDocumentSave
- throws existing validation errors
- saves payload before reference
- propagates repository errors
- returns LocalDocumentSaveResult on success

Slice 30 adds a separate wrapper instead of changing this locked behavior.

## Rejection Rule

saveLocalDocumentReferencesWithOutcome may return rejected outcomes only for preflight rejection reasons:

- patient_id_mismatch
- encrypted_payload_ref_mismatch
- clinical_document_reference_inactive
- local_encrypted_document_payload_inactive

Rejected outcomes must not expose:

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

## Repository Error Rule

Repository errors are not preflight rejections.

The wrapper must preserve repository error propagation:

- if payload save fails, the payload-save error is thrown
- if reference save fails after payload save succeeds, the reference-save error is thrown

No rollback, transaction, retry, mutation log, sync handling, or persistence receipt is introduced.

## Internal Output Rule

LocalDocumentSaveOutcome remains internal application output.

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

## Scope

This slice implements:

- saveLocalDocumentReferencesWithOutcome
- preflight rejection to rejected outcome mapping
- successful save result to completed outcome mapping
- preservation of saveLocalDocumentReferences behavior
- preservation of repository error propagation
- source-boundary tests proving the wrapper avoids infrastructure, storage, cloud, sync, transaction, audit, crypto adapter, AI, OCR, UI, and readable metadata concerns

This slice does not implement:

- changes to saveLocalDocumentReferences
- new public save behavior for existing callers
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

The wrapper module may import:

- prepareLocalDocumentSave
- saveLocalDocumentReferences
- SaveLocalDocumentReferencesInput type
- createCompletedLocalDocumentSaveOutcome
- createRejectedLocalDocumentSaveOutcome
- LocalDocumentSaveOutcome type

The wrapper module must not import:

- in-memory repository adapter
- domain factory functions
- direct active-state helpers
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

The wrapper module must not directly inspect:

- patientId mismatch logic
- encryptedPayloadRef-to-payloadId mismatch logic
- revokedAtEpochMs
- deletedAtEpochMs

Those rules remain owned by prepareLocalDocumentSave.

## Design Rationale

The wrapper belongs in the application layer because it composes existing application primitives:

- preflight decision
- save use case
- outcome boundary

The wrapper does not own validation law.

The preflight module owns save eligibility.

The save use case owns write orchestration.

The result module owns completed result shape.

The outcome module owns completed-versus-rejected shape.

The repository port owns persistence shape.

Infrastructure adapters own storage behavior.

This separation lets future callers choose outcome-based orchestration without breaking existing saveLocalDocumentReferences behavior.

## Test Coverage

Slice 30 increases the suite to:

- 31 test files
- 468 passing tests

New tests verify:

- completed save returns completed outcome
- completed outcome wraps the completed result
- rejected preflight returns rejected outcome without calling repository
- mismatched patient IDs produce patient_id_mismatch
- mismatched encrypted payload refs produce encrypted_payload_ref_mismatch
- inactive clinical document references produce clinical_document_reference_inactive
- inactive local encrypted payloads produce local_encrypted_document_payload_inactive
- repository payload-save errors propagate
- repository reference-save errors propagate
- rejected outcomes do not expose raw identifiers
- outcomes do not model transaction, rollback, sync, storage, cloud, notification, display, audit, receipt, analytics, telemetry, OCR, AI, debug, or clinical metadata concerns
- wrapper source remains free from infrastructure adapters, storage, cloud, sync, transaction, audit, crypto adapter, AI, OCR, UI, and readable metadata concerns

## Consequences

Positive consequences:

- Outcome-based save orchestration now exists without changing the locked save use case.
- Preflight rejections can be represented as safe outcomes.
- Repository failures remain exceptional and visible.
- The wrapper provides a clean future bridge for UI or workflow layers without making the outcome UI-safe.
- The slice keeps durable persistence and sync out of scope.

Trade-offs:

- The wrapper runs preflight, then saveLocalDocumentReferences runs preflight again.
- No transaction boundary is introduced.
- No rollback behavior is introduced.
- No idempotency key is introduced.
- No mutation log is introduced.
- No persistence durability is added.
- No sync behavior is added.
- The outcome is still internal application output and must not be logged, displayed, uploaded, notified, indexed, or audited as-is.

## Next Technical Target

The next target is Slice 31: Local Document Save Repository Error Classification Decision or Project State Documentation.

Slice 31 should either:

1. decide whether repository failures need an internal classification boundary before durable persistence, or
2. add repo-backed Project KOr state documentation to reduce prompt repetition and strengthen continuity.

It must not introduce WatermelonDB, SQLite, filesystem storage, Supabase, sync, encryption, decryption, OCR, AI, UI, audit receipts, cloud-safe receipts, notification payloads, or readable clinical metadata.
