# ADR 0027: Local Document Save Use Case Preflight Delegation

## Status

Accepted.

## Date

2026-05-21

## Context

Slice 25 introduced the Local Document Save Use Case.

Slice 26 introduced the Local Document Save Preflight Decision.

After Slice 26, the save use case still contained its own validation logic for patientId consistency, encryptedPayloadRef-to-payloadId consistency, and active-state checks.

That created duplicated validation law.

Slice 27 refactors the save use case so that saveLocalDocumentReferences delegates save eligibility validation to prepareLocalDocumentSave before repository writes.

This slice preserves the existing public behavior from Slice 25.

It does not introduce new storage, persistence, sync, cloud upload, encryption, decryption, OCR, AI, UI, or clinical metadata handling.

## Decision

Refactor:

src/application/local-document-save/localDocumentSaveUseCase.ts

The use case now imports:

- prepareLocalDocumentSave
- LocalDocumentSavePreflightFailureReason

from:

./localDocumentSavePreflight

The use case no longer imports:

- isClinicalDocumentReferenceActive
- isLocalEncryptedDocumentPayloadActive

The use case no longer owns direct validation helpers:

- assertPatientIdsMatch
- assertPayloadReferenceMatches
- assertReferencesAreActive

Instead, it calls prepareLocalDocumentSave before repository writes.

If the preflight decision is not ready, the use case maps the safe preflight failure reason to the existing public error message.

## Preserved Public Error Messages

The existing Slice 25 thrown error messages are preserved:

- clinical document reference and encrypted payload patientId must match
- clinical document reference encryptedPayloadRef must match encrypted payload payloadId
- clinical document reference must be active
- local encrypted document payload must be active

This preserves the public contract while centralizing validation law.

## Save Order

The save order remains unchanged:

1. saveLocalEncryptedDocumentPayload
2. saveClinicalDocumentReference

This preserves the payload-first rule and avoids a dangling reference window.

## Repository Error Behavior

Repository error behavior remains unchanged:

- if payload save fails, reference save is not attempted
- if reference save fails after payload save, the reference-save error is propagated
- no rollback is introduced in this slice

Rollback, transactionality, idempotency, retry, and conflict handling remain future concerns.

## Scope

This slice implements:

- delegation from saveLocalDocumentReferences to prepareLocalDocumentSave
- mapping from safe preflight failure reasons to existing public error messages
- removal of duplicated direct validation helpers from the save use case
- preservation of payload-first save order
- preservation of repository error propagation
- preservation of non-mutation behavior
- source-boundary tests verifying delegation and dependency hygiene

This slice does not implement:

- new public save behavior
- new failure reasons
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
- OCR
- AI calls
- doctor portal UI
- patient portal UI
- browser storage
- mobile storage
- analytics
- notifications
- file upload
- WebRTC
- payment flows

## Boundary Rules

The save use case may import:

- LocalDocumentRepositoryPort
- ClinicalDocumentReference type
- LocalEncryptedDocumentPayload type
- prepareLocalDocumentSave
- LocalDocumentSavePreflightFailureReason

The save use case must not import:

- isClinicalDocumentReferenceActive
- isLocalEncryptedDocumentPayloadActive
- in-memory local document repository adapter
- domain factory functions
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
- OCR
- AI providers
- doctor portal UI
- patient portal UI
- BM&DC lookup
- upload services
- background sync
- React
- React Native

The save use case must not directly inspect:

- revokedAtEpochMs
- deletedAtEpochMs

The save use case must not duplicate direct comparison logic for:

- patientId mismatch
- encryptedPayloadRef-to-payloadId mismatch

Those rules belong to the preflight decision.

## Design Rationale

The save use case belongs in the application layer because it coordinates validation and repository writes.

The preflight decision now owns save eligibility.

The save use case now owns save orchestration.

The repository port owns persistence shape.

Infrastructure adapters own storage behavior.

This separation prevents validation law from splitting across multiple application modules.

## Test Coverage

Slice 27 increases the suite to:

- 28 test files
- 448 passing tests

New and updated tests verify:

- saveLocalDocumentReferences delegates validation to prepareLocalDocumentSave
- the save use case imports LocalDocumentSavePreflightFailureReason
- direct active-state helper imports are removed from the save use case
- old direct validation helper functions are removed
- direct patientId and encryptedPayloadRef comparison logic is removed
- existing save-use-case behavior remains intact
- existing public error messages remain intact
- payload-first save order remains intact
- repository error propagation remains intact
- production source remains free from infrastructure, storage, cloud, sync, crypto adapter, AI, OCR, UI, portal, schema, migration, and readable metadata concerns

## Consequences

Positive consequences:

- Local document save eligibility now has one authority.
- The save use case is simpler and more orchestration-focused.
- Future transaction and idempotency slices can rely on the preflight decision.
- Existing behavior remains stable.
- The slice keeps storage and sync out of scope.

Trade-offs:

- The save use case still throws public errors instead of returning a structured result.
- No transaction boundary is introduced.
- No rollback behavior is introduced.
- No persistence durability is added.
- No sync behavior is added.

## Next Technical Target

The next target is Slice 28: Local Document Save Result Type or Transaction Boundary Decision.

That slice should decide whether saveLocalDocumentReferences needs a structured result type, idempotency marker, or transaction-boundary abstraction before durable persistence is introduced.

It must not introduce WatermelonDB, SQLite, filesystem storage, Supabase, sync, encryption, decryption, OCR, AI, UI, or readable clinical metadata.
