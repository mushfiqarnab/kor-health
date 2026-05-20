# ADR 0028: Local Document Save Result Type

## Status

Accepted.

## Date

2026-05-21

## Context

Slice 25 introduced the Local Document Save Use Case.

Slice 26 introduced the Local Document Save Preflight Decision.

Slice 27 refactored saveLocalDocumentReferences so save eligibility validation delegates to prepareLocalDocumentSave.

After Slice 27, the save use case still returned an inline result shape. Slice 28 formalizes that result as a named application-layer result type.

This result type is internal application output. It is not a log-safe, audit-safe, sync-safe, cloud-safe, notification-safe, or display-safe receipt.

The result may contain saved domain references. Those references are opaque and do not contain decrypted clinical payloads, but they still include identifiers and must not be exposed through logs, analytics, notifications, cloud metadata, UI labels, filenames, storage paths, AI prompts, or audit receipts.

This slice does not introduce storage, sync, transactions, rollback, idempotency, mutation logs, Supabase, SQLite, WatermelonDB, filesystem access, encryption, decryption, OCR, AI, UI, or clinical metadata.

## Decision

Create an application-layer result module under:

src/application/local-document-save/localDocumentSaveResult.ts

The module exposes:

- LOCAL_DOCUMENT_SAVE_RESULT_STATUS
- LocalDocumentSaveResultInput
- LocalDocumentSaveResult
- createCompletedLocalDocumentSaveResult

The completed result includes exactly:

- status
- savedClinicalDocumentReference
- savedLocalEncryptedDocumentPayload

The status value is:

- completed

The result object is frozen.

saveLocalDocumentReferences now returns LocalDocumentSaveResult instead of defining an inline SaveLocalDocumentReferencesResult interface.

## Internal Output Rule

LocalDocumentSaveResult is internal application output.

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

Callers must not log, upload, display, index, notify, or sync this result as-is.

Future slices that need audit, UI, sync, or cloud behavior must create separate privacy-reviewed types.

## Result Shape Rule

The result type must not add top-level fields for:

- transactionId
- rollbackId
- idempotencyKey
- mutationId
- syncId
- storagePath
- storageUrl
- filePath
- fileUri
- contentUri
- mimeType
- diagnosis
- prescription
- lab values
- OCR text
- AI summary
- error
- reason
- debug
- audit
- receipt
- log-safe claim
- display-safe claim
- cloud-safe claim
- sync-safe claim
- notification payload
- analytics
- telemetry

## Scope

This slice implements:

- formal LocalDocumentSaveResult type
- completed status constant
- frozen completed result factory
- save use case return-type migration
- preservation of saved domain object identity
- preservation of payload-first save order
- preservation of existing validation and repository error behavior
- tests proving the result is internal application output, not a safe receipt

This slice does not implement:

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

The result module may import:

- ClinicalDocumentReference type
- LocalEncryptedDocumentPayload type

The result module must not import:

- LocalDocumentRepositoryPort
- repository implementations
- in-memory local document repository adapter
- domain factory functions
- preflight module
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

The result module must not create or process:

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

## Design Rationale

The result type belongs in the application layer because it describes the output of an application use case.

The domain layer owns document and payload validity.

The preflight module owns save eligibility.

The save use case owns orchestration.

The repository port owns persistence shape.

Infrastructure adapters own storage behavior.

A named result type prevents the save use case from carrying an anonymous result shape, while avoiding premature transaction, sync, or audit semantics.

The completed status is intentionally narrow. It only confirms that the use case completed and returned saved domain references. It does not prove durable transactionality, cloud upload, sync, audit persistence, or UI-safe disclosure.

## Test Coverage

Slice 28 increases the suite to:

- 29 test files
- 455 passing tests

New and updated tests verify:

- completed save result is frozen
- completed save result exposes only approved top-level keys
- saved domain object identity is preserved
- saved domain objects are not mutated
- result does not model audit, sync, storage, cloud, notification, display, transaction, rollback, debug, OCR, or AI metadata
- saveLocalDocumentReferences returns the formalized completed result
- save use case imports LocalDocumentSaveResult
- save use case imports createCompletedLocalDocumentSaveResult
- save use case no longer defines an inline SaveLocalDocumentReferencesResult interface
- result module remains free from repository, infrastructure, persistence, cloud, sync, transaction, crypto adapter, AI, OCR, UI, receipt, audit, display, and readable metadata concerns

## Consequences

Positive consequences:

- Local document save output now has a named application-layer type.
- The completed result shape is explicit and frozen.
- The save use case becomes more stable for future callers.
- Future transaction, sync, audit, or UI slices can build separate privacy-reviewed outputs instead of reusing this internal result unsafely.
- The slice keeps storage and sync out of scope.

Trade-offs:

- The result still contains saved domain references and is therefore not safe for logs, notifications, cloud metadata, or UI display.
- No transaction boundary is introduced.
- No rollback behavior is introduced.
- No idempotency key is introduced.
- No mutation log is introduced.
- No persistence durability is added.
- No sync behavior is added.

## Next Technical Target

The next target is Slice 29: Local Document Save Outcome Boundary or Transaction Readiness Decision.

That slice should decide whether the save path needs a structured outcome boundary, idempotency marker, or transaction-readiness abstraction before durable persistence is introduced.

It must not introduce WatermelonDB, SQLite, filesystem storage, Supabase, sync, encryption, decryption, OCR, AI, UI, audit receipts, cloud-safe receipts, or readable clinical metadata.
