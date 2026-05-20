# ADR 0026: Local Document Save Preflight Decision

## Status

Accepted.

## Date

2026-05-21

## Context

Slice 25 introduced the Local Document Save Use Case.

That use case saves an already-created ClinicalDocumentReference and an already-created LocalEncryptedDocumentPayload through LocalDocumentRepositoryPort.

Before future slices introduce transaction boundaries, idempotency, mutation logs, durable persistence, or sync behavior, the application layer needs a safe preflight decision that can evaluate whether a paired reference and payload are eligible for save.

This slice introduces that decision without saving anything.

The preflight decision must not expose raw identifiers, clinical content, filenames, paths, URLs, MIME types, storage locations, decrypted payloads, ciphertext bytes, OCR output, AI output, or infrastructure details.

This slice does not introduce WatermelonDB, SQLite, filesystem storage, Supabase, sync, encryption, decryption, OCR, AI, UI, or repository access.

## Decision

Create an application-layer preflight decision module under:

src/application/local-document-save

The module exposes:

- LOCAL_DOCUMENT_SAVE_ORDER
- LocalDocumentSavePreflightInput
- LocalDocumentSavePreflightFailureReason
- LocalDocumentSavePreflightDecision
- prepareLocalDocumentSave

The input includes:

- clinicalDocumentReference
- localEncryptedDocumentPayload

The ready decision includes:

- ready: true
- saveOrder

The failure decision includes:

- ready: false
- reason

The save order is:

1. local_encrypted_document_payload
2. clinical_document_reference

The save order constant is frozen.

## Failure Reasons

The approved non-clinical failure reasons are:

- patient_id_mismatch
- encrypted_payload_ref_mismatch
- clinical_document_reference_inactive
- local_encrypted_document_payload_inactive

These reasons are intentionally broad and non-identifying.

They must not include:

- referenceId
- patientId
- resourceId
- payloadId
- encryptedPayloadRef
- ciphertextRef
- encryptionEnvelopeRef
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
- decrypted payloads
- ciphertext bytes
- raw key material
- sealed key envelopes

## Validation Order

The preflight decision uses deterministic validation precedence:

1. patientId mismatch
2. encryptedPayloadRef-to-payloadId mismatch
3. inactive clinical document reference
4. inactive local encrypted document payload
5. ready decision

This precedence avoids unstable failure behavior when multiple issues are present.

## Scope

This slice implements:

- a pure application-level preflight decision
- payload-first save order declaration
- safe ready and failure result shapes
- patientId consistency check
- encryptedPayloadRef-to-payloadId consistency check
- clinical document reference active-state check through domain helper
- local encrypted payload active-state check through domain helper
- deterministic validation precedence
- non-mutation of source domain objects
- boundary tests excluding repositories, infrastructure, persistence, cloud, sync, crypto adapter, AI, OCR, UI, portal, schema, migration, and readable metadata concerns

This slice does not implement:

- repository saving
- use-case delegation to preflight
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

The preflight module must not import:

- LocalDocumentRepositoryPort
- repository implementations
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

The preflight module must not directly inspect:

- revokedAtEpochMs
- deletedAtEpochMs

It must use locked domain helpers:

- isClinicalDocumentReferenceActive
- isLocalEncryptedDocumentPayloadActive

## Design Rationale

The preflight decision belongs in the application layer because it evaluates whether two already-created domain objects are eligible for a save orchestration path.

The domain layer owns object validity and lifecycle helpers.

The repository port owns persistence shape.

Infrastructure adapters own storage behavior.

The preflight decision intentionally does not import repository ports. It is not a save use case and it must not create side effects.

A safe preflight decision creates a foundation for later transaction, idempotency, mutation-log, sync, and UI-safe status slices without leaking raw identifiers or clinical semantics.

## Test Coverage

Slice 26 increases the suite to:

- 27 test files
- 446 passing tests

New tests verify:

- ready decision returns explicit payload-first save order
- save order constant is frozen
- mismatched patient IDs return a safe non-identifying failure reason
- mismatched encrypted payload refs return a safe non-identifying failure reason
- revoked clinical document references are rejected through the domain active-state helper
- deleted local encrypted payloads are rejected through the domain active-state helper
- validation precedence is deterministic
- only approved non-clinical failure reasons are returned
- source domain objects are not mutated
- the preflight source excludes repository ports, infrastructure adapters, domain factories, persistence, filesystem, cloud, sync, crypto adapter, AI, OCR, UI, portal, schema, migration, and readable metadata concerns

## Consequences

Positive consequences:

- Application code can now ask whether a reference/payload pair is eligible for save without performing writes.
- Failure decisions are safe to inspect without exposing raw IDs or clinical details.
- Payload-first save order is now explicit and reusable.
- Future transaction and idempotency decisions have a clean preflight primitive.
- The slice keeps storage and sync out of scope.

Trade-offs:

- The save use case does not yet delegate to this preflight decision.
- No rollback behavior is introduced.
- No transaction boundary is introduced.
- No persistence durability is added.
- No sync behavior is added.
- A future slice should decide whether the existing save use case should delegate to this preflight module.

## Next Technical Target

The next target is Slice 27: Local Document Save Use Case Preflight Delegation.

That slice should refactor saveLocalDocumentReferences to call prepareLocalDocumentSave before writing, while preserving the existing Slice 25 public error behavior and save order.

It must not introduce WatermelonDB, SQLite, filesystem storage, Supabase, sync, encryption, decryption, OCR, AI, UI, or readable clinical metadata.
