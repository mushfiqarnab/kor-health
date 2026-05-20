# ADR 0024: In-Memory Local Document Repository Adapter

## Status

Accepted.

## Date

2026-05-21

## Context

Slice 23 introduced the LocalDocumentRepositoryPort.

The port defines how application use cases can depend on local document reference and encrypted payload reference storage without selecting a persistence technology.

Slice 24 introduces a test-friendly in-memory adapter for this port.

This adapter is not production persistence. It is a deterministic infrastructure adapter for tests, local composition, and future application use-case development.

It must not introduce WatermelonDB, SQLite, filesystem storage, Supabase persistence, cloud upload, sync, encryption, decryption, OCR, AI, UI, browser storage, mobile storage, schemas, migrations, or readable clinical metadata.

## Decision

Create an infrastructure adapter under:

src/infrastructure/local-document-repository

The adapter exposes:

createInMemoryLocalDocumentRepository

The adapter returns:

LocalDocumentRepositoryPort

The adapter uses in-memory Map instances scoped inside the factory function.

The adapter references locked domain types:

- ClinicalDocumentReference
- LocalEncryptedDocumentPayload

The adapter uses locked domain helpers:

- isClinicalDocumentReferenceActive
- isLocalEncryptedDocumentPayloadActive

The adapter does not inspect revokedAtEpochMs or deletedAtEpochMs directly.

## Adapter Behavior

The adapter implements all LocalDocumentRepositoryPort methods:

- saveClinicalDocumentReference
- saveLocalEncryptedDocumentPayload
- getClinicalDocumentReferenceByReferenceId
- getLocalEncryptedDocumentPayloadByPayloadId
- listClinicalDocumentReferencesForPatient
- listActiveClinicalDocumentReferencesForPatient
- listLocalEncryptedDocumentPayloadsForPatient
- listActiveLocalEncryptedDocumentPayloadsForPatient

Save methods return the same frozen domain object supplied by the caller.

Lookup methods return undefined for missing opaque IDs.

List methods return fresh arrays.

List methods preserve Map insertion order.

Saving a record with an existing opaque ID replaces the old record without duplicating list results.

If a replacement record has a different patientId, the record appears only under the replacement patient list.

Each repository instance owns isolated in-memory Maps.

## Scope

This slice implements:

- a test-friendly in-memory implementation of LocalDocumentRepositoryPort
- opaque ID lookup
- patient ID list filtering
- active-only filtering through domain helpers
- same-ID replacement semantics
- repository instance isolation
- fresh list array returns
- dependency boundary tests

This slice does not implement:

- production local persistence
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
- browser storage
- mobile storage
- analytics
- notifications
- file upload
- WebRTC
- payment flows

## Boundary Rules

The adapter must not import:

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
- domain factory functions

The adapter must not expose or process:

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

The adapter belongs in infrastructure because it implements an application port.

The adapter remains in-memory only because production local persistence is not yet allowed.

Using domain active-state helpers keeps lifecycle law centralized in the domain objects.

Using Map preserves deterministic insertion order and simple replacement semantics.

The adapter deliberately avoids timestamps, random IDs, schemas, migrations, and storage APIs.

## Test Coverage

Slice 24 increases the suite to:

- 25 test files
- 427 passing tests

New tests verify:

- the adapter implements the LocalDocumentRepositoryPort
- clinical document references and encrypted payload references can be saved and retrieved by opaque IDs
- missing opaque IDs return undefined
- references and payloads can be listed by opaque patient ID in insertion order
- active-only list methods exclude revoked clinical document references and deleted local encrypted payloads through domain helpers
- same-ID saves replace records without duplicate list results
- same-ID replacement with a different patientId moves the record to the replacement patient list
- separate repository instances remain isolated
- list methods return fresh arrays
- stored frozen domain objects are not mutated
- the adapter source excludes persistence, filesystem, cloud, sync, crypto adapter, AI, OCR, UI, portal, browser storage, mobile storage, schema, migration, SQL, table, index, domain factory, Date.now, and new Date concerns

## Consequences

Positive consequences:

- Application tests can now use a real LocalDocumentRepositoryPort implementation.
- Future application use cases can be developed without choosing production storage.
- The adapter preserves domain lifecycle rules by using domain helpers.
- Storage technology remains gated for later slices.
- No readable clinical metadata is introduced.

Trade-offs:

- Data is lost when the repository instance is discarded.
- No persistence durability is provided.
- No database constraints are provided.
- No filesystem behavior is modeled.
- No sync or conflict resolution is modeled.
- No encryption or decryption is performed.
- This adapter must not be treated as production storage.

## Next Technical Target

The next target is Slice 25: Local Document Save Use Case.

That slice should define an application use case for saving an already-created ClinicalDocumentReference and LocalEncryptedDocumentPayload through LocalDocumentRepositoryPort.

It must not create document references, create payloads, encrypt, decrypt, read files, write files, use WatermelonDB, use SQLite, sync, upload, OCR, AI, or expose readable clinical metadata.
