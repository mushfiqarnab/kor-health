# ADR 0022: Local Encrypted Document Payload Boundary

## Status

Accepted.

## Date

2026-05-20

## Context

Slice 21 created share packet issuance from consent grants.

Slice 22 defines the local encrypted document payload boundary.

Project KOr requires a safe domain representation for encrypted local document payloads before any local persistence, filesystem adapter, cloud upload, sync, OCR, AI, or clinical document loading is introduced.

The platform law remains:

The device is the vault.

This slice does not store payload bytes. It does not perform encryption or decryption. It does not touch a filesystem. It only defines a metadata-safe reference to a sealed local encrypted payload.

Clinical document references already point to encrypted payloads, but this slice models the local encrypted payload boundary itself. The boundary must remain opaque and must not expose filenames, paths, URLs, MIME types, report titles, diagnosis fields, OCR text, AI output, patient identifiers, or key material.

## Decision

Create a pure domain model under:

src/domain/local-encrypted-payload

The domain exposes:

- LocalEncryptedDocumentPayload
- CreateLocalEncryptedDocumentPayloadInput
- LocalEncryptedDocumentPayloadEncryptionScheme
- createLocalEncryptedDocumentPayload
- markLocalEncryptedDocumentPayloadDeleted
- isLocalEncryptedDocumentPayloadDeleted
- isLocalEncryptedDocumentPayloadActive
- assertNoLocalEncryptedDocumentPayloadMetadataLeak

The supported encryption scheme is:

- aes_256_gcm_v1

This is a scheme label only. This slice does not implement cryptography.

## Fields

LocalEncryptedDocumentPayload includes:

- payloadId
- patientId
- ciphertextRef
- encryptionEnvelopeRef
- encryptionScheme
- payloadSchemaVersion
- createdAtEpochMs
- updatedAtEpochMs, optional
- deletedAtEpochMs, optional

The boundary intentionally avoids:

- fileName
- filePath
- storagePath
- storageUrl
- fileUri
- contentUri
- url
- uri
- mimeType
- title
- documentType
- diagnosis
- prescription
- lab values
- OCR text
- AI output
- plaintextBytes
- ciphertextBytes
- rawKeyBytes

## Scope

This slice implements:

- metadata-only encrypted local payload reference creation
- supported encryption scheme validation
- schema version validation
- lifecycle timestamp validation
- immutable deletion marking
- idempotent deletion
- active/deleted state helpers
- metadata leak detection across string values and object keys
- rejection of clinical labels, patient identifiers, key-material labels, path-like refs, filename-like refs, URL-like keys, and URI-like keys
- dependency boundary tests

This slice does not implement:

- encrypted blob storage
- filesystem access
- Expo FileSystem access
- SQLite persistence
- WatermelonDB persistence
- Supabase persistence
- cloud upload
- sync
- encryption
- decryption
- crypto adapter calls
- vault opening
- clinical document reference creation
- patient share packet creation
- consent checking
- document loading
- OCR
- AI calls
- doctor portal UI
- patient portal UI
- analytics
- notifications
- file upload
- WebRTC
- payment flows

## Metadata Safety

The metadata leak guard rejects unsafe string values and unsafe object key shapes.

Forbidden metadata includes clinical and identity-sensitive terms such as:

- mental health terms
- HIV and STI terms
- pregnancy and reproductive terms
- diagnosis
- prescription
- lab value
- HbA1c
- diabetes
- oncology
- cancer
- NID
- phone
- email
- filenames
- file paths
- storage paths
- storage URLs
- URLs
- URIs
- MIME types
- titles
- plaintext markers
- ciphertext byte markers
- raw key markers
- sealed key envelope markers

This prevents the payload boundary from leaking clinical meaning even when the encrypted bytes remain unreadable.

## Lifecycle Rules

A payload is active when deletedAtEpochMs is absent.

A payload is deleted when deletedAtEpochMs is present.

Deletion is immutable and idempotent:

- marking an active payload as deleted returns a frozen copy with deletedAtEpochMs
- marking an already deleted payload returns the same object
- deletion before creation is rejected

This slice does not physically delete payload bytes. Physical deletion belongs to a later storage adapter slice.

## Security Properties

The local encrypted payload domain must not import:

- clinical document reference domain
- patient share packet domain
- consent domain
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
- file upload
- background sync
- React
- React Native

The domain must not expose or process:

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
- URLs
- URIs
- MIME types
- report titles
- raw key material
- sealed key envelopes

## Test Coverage

Slice 22 increases the suite to:

- 23 test files
- 410 passing tests

New tests verify:

- frozen metadata-only local encrypted payload reference creation
- active/deleted state helpers
- updatedAtEpochMs support
- empty opaque reference rejection
- unsupported encryption scheme rejection
- invalid schema version and timestamp rejection
- updatedAtEpochMs and deletedAtEpochMs cannot be before creation
- immutable deletion marking
- idempotent deletion
- deletion before creation rejection
- clinical label and patient identifier rejection in opaque refs
- path-like and filename-like ciphertextRef rejection
- safe serialization without clinical content, filenames, key material, or payload bytes
- unsafe object rejection during explicit metadata leak assertion
- URL and URI key-shape rejection
- forbidden infrastructure, filesystem, crypto adapter, clinical document, share packet, consent, AI, OCR, sync, upload, portal, and UI imports are excluded

## Consequences

Positive consequences:

- KOr now has a safe domain boundary for sealed local encrypted document payloads.
- Future repository and storage slices can reference encrypted payloads without inventing unsafe metadata fields.
- The domain prevents filename, path, URL, URI, title, MIME, and clinical-label leakage.
- The implementation remains pure TypeScript.
- Storage, filesystem, cryptography, OCR, AI, and sync remain outside this slice.

Trade-offs:

- Slice 22 does not store encrypted bytes.
- Slice 22 does not verify ciphertext integrity.
- Slice 22 does not define local database schema.
- Slice 22 does not create clinical document references.
- Slice 22 does not define filesystem layout.
- Slice 22 does not perform physical deletion.
- Future storage and repository slices must preserve this metadata boundary.

## Next Technical Target

The next target is Slice 23: Local Document Repository Port.

That slice should define a pure application/domain-facing repository interface for local encrypted payload references and clinical document references without choosing WatermelonDB, SQLite, filesystem storage, cloud upload, sync, OCR, AI, or UI.
