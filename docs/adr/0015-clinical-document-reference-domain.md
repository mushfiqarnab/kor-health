# ADR 0015: Clinical Document Reference Domain

## Status

Accepted.

## Date

2026-05-18

## Context

KOr Health requires a safe way to reference encrypted clinical documents without exposing medical meaning in metadata.

Previous slices created consent grants and patient share packets. Those packets contain opaque resource references. Slice 15 defines the domain object behind those references: a metadata-minimized clinical document reference.

A clinical document reference points to encrypted clinical payloads but never contains decrypted medical content.

## Decision

Create a pure domain-layer clinical document reference model under:

src/domain/clinical-document

The reference domain is standalone in this slice and has no dependency on storage, sync, share packets, AI, or portal code.

## Scope

This slice implements:

- clinical document reference creation
- broad encrypted resource-kind validation
- opaque reference metadata validation
- encrypted payload reference validation
- schema version validation
- created/updated/revoked timestamp validation
- active/revoked state helpers
- shareability helper
- idempotent revocation
- metadata leak assertion
- contract tests

This slice does not implement:

- Supabase
- SQLite
- WatermelonDB
- SecureStore
- Expo
- persistence
- sync
- vault opening
- document decryption
- OCR
- AI
- doctor portal UI
- patient portal UI
- BM&DC lookup
- file upload
- report title storage
- diagnosis storage
- prescription text storage
- lab value storage

## Domain Model

A ClinicalDocumentReference contains:

- referenceId
- patientId
- resourceId
- resourceKind
- encryptedPayloadRef
- documentSchemaVersion
- createdAtEpochMs
- updatedAtEpochMs
- revokedAtEpochMs

A ClinicalDocumentReference must not contain:

- report title
- diagnosis text
- prescription text
- lab values
- doctor notes
- patient NID
- phone number
- email
- clinic name
- decrypted document payload
- raw key material
- sealed key envelopes

## Resource Kinds

Supported broad operational resource kinds:

- encrypted_report
- encrypted_visit_packet
- encrypted_medication_snapshot
- encrypted_emergency_card

Rejected semantic clinical kinds include:

- hiv_report
- mental_health_note
- pregnancy_scan
- diabetes_report
- oncology_summary
- psychiatric_prescription

Resource kinds must describe encrypted resource shape, not clinical meaning.

## Opaque Metadata Rule

Identifiers and payload references must be opaque.

Safe examples:

- cdr_01JAAA00000000000000000001
- patient_01JAAA00000000000000000001
- doc_01JAAA00000000000000000001
- payload_01JAAA00000000000000000001

Unsafe examples:

- mental-health-reference
- hiv-report-reference
- diabetes-lab-2026
- pregnancy-ultrasound
- reports/hiv/patient-rahim.pdf
- diabetes/hba1c-result.pdf

Metadata must not whisper what the encrypted payload contains.

## Revocation

Clinical document reference revocation is idempotent.

If revokeClinicalDocumentReference is called on an already revoked reference, the same reference is returned unchanged.

Revoked references are inactive and must not be newly shared.

## Shareability

canReferenceBeShared returns true only when the reference is active.

This helper does not create share packets and does not evaluate consent. It only enforces the local reference state.

## Security Properties

Clinical document references must not contain:

- K_root
- K_local_unlock
- rawKeyBytes
- local-unlock-v1 values
- sealed key envelopes
- diagnosis text
- prescription text
- lab values
- sensitive clinical labels
- NID
- phone number
- email

The reference is a pointer to encrypted data, not the data itself.

## Test Coverage

Slice 15 increases the suite to:

- 16 test files
- 318 passing tests

New tests verify:

- frozen encrypted report reference creation
- frozen encrypted emergency card reference creation
- updatedAtEpochMs handling
- empty identifier rejection
- unsupported resource kind rejection
- clinically semantic resource kind rejection
- schema version validation
- createdAtEpochMs validation
- updatedAtEpochMs validation
- revokedAtEpochMs validation
- active and revoked state helpers
- immutable revocation
- idempotent revocation
- revoked references become inactive
- shareability only for active references
- sensitive label rejection in referenceId
- sensitive label rejection in patientId
- sensitive label rejection in resourceId
- sensitive label rejection in encryptedPayloadRef
- raw URL-style clinical payload path rejection
- medical payload and key material leak prevention
- unsafe object leak assertion
- forbidden dependency exclusion

## Consequences

Positive consequences:

- Clinical document references can be used without exposing clinical meaning.
- Share packets can later reference encrypted documents safely.
- Revoked references cannot be newly shared.
- Metadata remains category-blind.
- Future storage and sync layers can persist references without cloud-readable medical content.

Trade-offs:

- This slice does not upload files.
- This slice does not encrypt or decrypt payloads.
- This slice does not store document titles.
- This slice does not classify clinical document contents.
- Future UI must derive human-readable titles only after local decryption.

## Next Technical Target

The next target is Slice 16: Share Packet Document Reference Compatibility.

That slice should connect patient share packets to clinical document references and ensure packets include only active, compatible, consent-scoped document references.
