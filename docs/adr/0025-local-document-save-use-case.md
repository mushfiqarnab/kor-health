# ADR 0025: Local Document Save Use Case

## Status

Accepted.

## Date

2026-05-21

## Context

Slice 23 introduced the LocalDocumentRepositoryPort.

Slice 24 introduced a deterministic in-memory implementation of that port for tests and application composition.

Slice 25 introduces an application use case for saving an already-created ClinicalDocumentReference and an already-created LocalEncryptedDocumentPayload through LocalDocumentRepositoryPort.

This slice does not create clinical document references. It does not create local encrypted payload references. It does not encrypt, decrypt, read files, write files, use WatermelonDB, use SQLite, use Supabase, sync, upload, OCR, call AI, or build UI.

The platform laws remain:

- The device is the vault.
- The cloud is blind.
- Clinical document references are opaque pointers to encrypted payloads, never medical content.
- Local encrypted payload references must not expose filenames, paths, URLs, MIME types, clinical labels, payload bytes, OCR output, AI output, or key material.
- Application use cases orchestrate locked domain objects and repository ports without becoming infrastructure adapters.

## Decision

Create an application-layer use case under:

src/application/local-document-save

The use case exposes:

- SaveLocalDocumentReferencesInput
- SaveLocalDocumentReferencesResult
- saveLocalDocumentReferences

The input includes:

- repository
- clinicalDocumentReference
- localEncryptedDocumentPayload

The result includes:

- savedClinicalDocumentReference
- savedLocalEncryptedDocumentPayload

The repository type is:

LocalDocumentRepositoryPort

The use case references locked domain types:

- ClinicalDocumentReference
- LocalEncryptedDocumentPayload

The use case uses locked domain helpers:

- isClinicalDocumentReferenceActive
- isLocalEncryptedDocumentPayloadActive

The use case does not inspect revokedAtEpochMs or deletedAtEpochMs directly.

## Application Rules

Before saving, the use case must verify:

1. clinicalDocumentReference.patientId equals localEncryptedDocumentPayload.patientId.
2. clinicalDocumentReference.encryptedPayloadRef equals localEncryptedDocumentPayload.payloadId.
3. clinicalDocumentReference is active.
4. localEncryptedDocumentPayload is active.

The save order is:

1. saveLocalEncryptedDocumentPayload
2. saveClinicalDocumentReference

This order prevents a dangling-reference window where a ClinicalDocumentReference exists before its encrypted payload reference has been saved.

## Error Behavior

If validation fails, the use case throws before repository writes.

If saving the local encrypted payload fails, the clinical document reference must not be saved.

If saving the clinical document reference fails after the payload is saved, the error is propagated.

This slice does not implement rollback. Durable rollback, transactionality, retry, idempotency, and conflict handling belong to future persistence and sync slices.

## Scope

This slice implements:

- application-level save orchestration for already-created domain objects
- patientId consistency validation
- encryptedPayloadRef-to-payloadId consistency validation
- active-state validation using domain helpers
- payload-first save ordering
- repository error propagation
- non-mutation of source domain objects
- dependency boundary tests

This slice does not implement:

- ClinicalDocumentReference creation
- LocalEncryptedDocumentPayload creation
- local encrypted payload byte storage
- filesystem storage
- Expo FileSystem
- WatermelonDB adapter
- SQLite schema
- database migrations
- table definitions
- indexes
- Supabase persistence
- cloud upload
- sync
- mutation logs
- encryption
- decryption
- crypto adapter calls
- vault opening
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

The use case must not import:

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

The use case must not expose or process:

- decrypted payloads
- plaintext bytes
- ciphertext bytes
- report text
- diagnosis text
- prescription text
- lab values
- OCR output
- AI output
- filenames
- file paths
- storage paths
- storage URLs
- file URIs
- content URIs
- MIME types
- report titles
- raw key material
- sealed key envelopes

## Design Rationale

The use case belongs in the application layer because it coordinates a repository port and locked domain objects.

The domain layer owns document and payload validity.

The infrastructure layer owns concrete storage implementations.

The use case intentionally accepts already-created domain objects. This prevents it from becoming a factory, encryption boundary, file importer, persistence adapter, or metadata construction point.

Payload-first save order reduces the chance of a reference pointing to a missing payload in non-transactional adapters.

## Test Coverage

Slice 25 increases the suite to:

- 26 test files
- 437 passing tests

New tests verify:

- active matching ClinicalDocumentReference and LocalEncryptedDocumentPayload are saved
- payload is saved before reference
- mismatched patient IDs are rejected before saving
- mismatched encryptedPayloadRef and payloadId are rejected before saving
- revoked clinical document references are rejected before saving
- deleted local encrypted payloads are rejected before saving
- source domain objects are not mutated
- payload-save errors are propagated and prevent reference save
- reference-save errors are propagated after payload save
- the use case source excludes infrastructure adapters, domain factories, persistence, filesystem, cloud, sync, crypto adapter, AI, OCR, UI, portal, schema, migration, and readable metadata concerns

## Consequences

Positive consequences:

- Application orchestration can now save paired document metadata safely through a repository port.
- The use case preserves payload-reference consistency before storage.
- The use case remains infrastructure-free.
- Future adapters can implement durable storage without changing this orchestration contract.
- The save path still avoids readable clinical metadata.

Trade-offs:

- This slice does not provide transactional rollback.
- This slice does not store encrypted bytes.
- This slice does not create references or payloads.
- This slice does not define local database schema.
- This slice does not define filesystem layout.
- This slice does not sync or upload.
- A future durable persistence slice must revisit atomicity and rollback behavior.

## Next Technical Target

The next target is Slice 26: Local Document Save Result Type or Transaction Boundary Decision.

Before adding real storage, the project should decide whether local document save orchestration needs an explicit result/status type, idempotency key, or transaction boundary abstraction.

That slice must remain application-level and must not introduce WatermelonDB, SQLite, filesystem storage, Supabase, sync, encryption, decryption, OCR, AI, UI, or readable clinical metadata.
