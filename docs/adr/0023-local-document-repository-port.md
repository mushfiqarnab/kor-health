# ADR 0023: Local Document Repository Port

## Status

Accepted.

## Date

2026-05-21

## Context

Slice 22 introduced the local encrypted document payload boundary.

Project KOr now has two locked metadata-safe document primitives:

- ClinicalDocumentReference
- LocalEncryptedDocumentPayload

The next step is to define how application use cases will depend on local document storage without choosing a storage implementation.

This slice creates a repository port only.

It does not implement WatermelonDB, SQLite, filesystem storage, Supabase persistence, cloud upload, sync, encryption, decryption, OCR, AI, or UI.

The platform laws remain:

- The device is the vault.
- The cloud is blind.
- Clinical document references are opaque pointers to encrypted payloads, never medical content.
- Local encrypted payload references must not expose filenames, paths, URLs, MIME types, clinical labels, payload bytes, OCR output, AI output, or key material.

## Decision

Create an application-layer port under:

src/application/local-document-repository

The port exposes:

- LOCAL_DOCUMENT_REPOSITORY_PORT_VERSION
- LocalDocumentRepositoryPort

The version marker is:

local_document_repository_port_v1

The port references locked domain types:

- ClinicalDocumentReference
- LocalEncryptedDocumentPayload

The port contains only async method signatures. It does not provide an implementation.

## Port Methods

The port defines:

- saveClinicalDocumentReference
- saveLocalEncryptedDocumentPayload
- getClinicalDocumentReferenceByReferenceId
- getLocalEncryptedDocumentPayloadByPayloadId
- listClinicalDocumentReferencesForPatient
- listActiveClinicalDocumentReferencesForPatient
- listLocalEncryptedDocumentPayloadsForPatient
- listActiveLocalEncryptedDocumentPayloadsForPatient

The methods operate on opaque identifiers:

- referenceId
- payloadId
- patientId

Missing lookup results return undefined.

The port does not fabricate records.

## Scope

This slice implements:

- a stable local document repository port version marker
- a pure application-layer TypeScript interface
- methods for saving clinical document references
- methods for saving local encrypted payload references
- lookup by opaque reference ID
- lookup by opaque payload ID
- list-by-patient methods
- active-only list-by-patient methods
- contract tests using an in-memory test double
- dependency boundary tests excluding infrastructure and adapter concerns

This slice does not implement:

- WatermelonDB adapter
- SQLite schema
- database migrations
- table definitions
- indexes
- filesystem storage
- Expo FileSystem
- encrypted blob storage
- Supabase persistence
- cloud upload
- sync
- mutation logs
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
- analytics
- notifications
- file upload
- WebRTC
- payment flows

## Boundary Rules

The port must not import:

- Supabase
- SQLite
- WatermelonDB
- filesystem APIs
- Expo FileSystem
- SecureStore
- Expo SecureStore
- Expo Local Authentication
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

The port must not expose or process:

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

The repository port belongs in the application layer because it is a dependency boundary for future use cases.

The domain layer owns document and payload law.

The infrastructure layer will later implement this port using a storage adapter.

This separation prevents WatermelonDB, SQLite, filesystem APIs, Supabase, sync, or encryption adapters from leaking into domain logic.

## Test Coverage

Slice 23 increases the suite to:

- 24 test files
- 417 passing tests

New tests verify:

- stable port version marker
- clinical document references and encrypted payload references can be saved and retrieved by opaque IDs through the port shape
- missing opaque IDs return undefined
- references and payloads can be listed by opaque patient ID
- active-only list methods exclude revoked clinical document references and deleted local encrypted payloads
- serialized domain objects do not require or expose clinical content, filenames, paths, URLs, MIME types, payload bytes, OCR output, AI output, or key material
- the port source excludes persistence, filesystem, cloud, sync, crypto adapter, AI, OCR, UI, portal, adapter, schema, SQL, migration, and factory concerns

## Consequences

Positive consequences:

- Application use cases can depend on a stable local document repository contract.
- Future infrastructure adapters can be built without changing application orchestration.
- Storage technology remains undecided until the correct adapter slice.
- Clinical document and encrypted payload laws remain centralized in their domains.
- The repository boundary remains metadata-safe.

Trade-offs:

- No records are persisted in this slice.
- No database schema is defined.
- No filesystem layout is defined.
- No encrypted payload bytes are stored.
- No sync behavior is introduced.
- No physical deletion behavior is implemented.
- Future adapters must preserve the same metadata and dependency constraints.

## Next Technical Target

The next target is Slice 24: Local Document Repository In-Memory Adapter.

That slice may introduce a test-friendly in-memory adapter for the LocalDocumentRepositoryPort only if needed for application use-case testing.

It must not introduce WatermelonDB, SQLite, filesystem storage, Supabase, sync, encryption, decryption, OCR, AI, UI, or readable clinical metadata.
