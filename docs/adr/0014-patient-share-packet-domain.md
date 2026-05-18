# ADR 0014: Patient Share Packet Domain

## Status

Accepted.

## Date

2026-05-18

## Context

Slice 13 introduced patient-controlled consent grants. A consent grant defines what a recipient is allowed to access, but it does not define the exact resource references that will be prepared for viewing or future processing.

KOr Health needs a bounded metadata-only share packet between consent and future doctor portal or AI workflows.

A patient share packet must never contain decrypted medical content. It must contain only opaque resource references authorized by an active consent grant.

## Decision

Create a pure domain-layer patient share packet model under:

src/domain/share-packet

The share packet domain depends on:

src/domain/consent/consentGrant.ts

This dependency is allowed because share packets are created only from consent grants.

## Scope

This slice implements:

- patient share packet creation
- packet type validation
- resource reference validation
- packet expiry validation
- active consent validation
- packet capability validation
- packet resource-kind validation
- AI source-packet permission checks
- specific-document-set subset checks
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
- doctor portal UI
- patient portal UI
- BM&DC lookup
- emergency QR
- vault opening
- document decryption
- AI calls
- medical payload handling
- full-vault access

## Packet Types

Supported packet types:

- doctor_visit_packet
- recent_reports_packet
- current_medications_packet
- emergency_card_packet
- caregiver_medication_packet
- specific_document_packet
- ai_summary_source_packet

The ai_summary_source_packet does not contain an AI-generated summary. It contains source references that a future AI workflow may summarize only after consent validation.

## Resource Kinds

Supported resource kinds:

- emergency_card
- current_medications
- report
- visit_packet
- medication_adherence

Resource references are opaque.

Safe resource ID examples:

- doc_01JAAA00000000000000000001
- rec_01JAAA00000000000000000001
- med_01JAAA00000000000000000001
- emg_01JAAA00000000000000000001

Unsafe resource ID examples:

- hiv-report-2026
- mental-health-note
- pregnancy-ultrasound
- diabetes-lab

## Packet Model

A patient share packet contains:

- packetId
- consentGrantId
- grantorPatientId
- recipientActorId
- recipientActorType
- packetType
- resourceRefs
- createdAtEpochMs
- expiresAtEpochMs
- aiProcessingAllowed

A patient share packet must not contain:

- diagnosis text
- prescription text
- lab values
- report contents
- doctor notes
- AI output
- decrypted document payload
- raw key material
- sealed key envelopes
- patient NID
- phone number
- email

## Consent Rules

A packet cannot be created unless the consent grant is active at packet creation time.

A packet cannot outlive the consent grant that authorized it.

The rule is:

packet.expiresAtEpochMs <= consentGrant.expiresAtEpochMs

Expired or revoked grants deny packet creation.

## Capability Rules

Packet type to capability mapping:

- recent_reports_packet requires view_recent_reports
- current_medications_packet requires view_current_medications
- doctor_visit_packet requires view_visit_packet
- emergency_card_packet requires view_emergency_card
- caregiver_medication_packet requires manage_medication_adherence or view_current_medications
- specific_document_packet requires specific_document_set scope and view_recent_reports or view_visit_packet
- ai_summary_source_packet requires request_ai_summary and a source-view capability

The AI rule is intentionally strict. request_ai_summary alone is insufficient. The grant must also authorize access to the source category being packaged.

## Resource Kind Rules

Packet type to resource kind mapping:

- emergency_card_packet allows emergency_card only
- current_medications_packet allows current_medications only
- recent_reports_packet allows report only
- doctor_visit_packet allows visit_packet only
- caregiver_medication_packet allows current_medications or medication_adherence only
- specific_document_packet allows report or visit_packet only
- ai_summary_source_packet allows current_medications, report, or visit_packet

Emergency packets remain emergency-card-only.

## Specific Document Set Rule

If the consent grant scope is:

specific_document_set

then all packet resource IDs must be included in:

consentGrant.resourceIds

A packet may not include any resource ID outside the consent grant.

## AI Processing Rule

aiProcessingAllowed is true only when packetType is:

ai_summary_source_packet

For all other packet types, aiProcessingAllowed is false, even if the consent grant includes request_ai_summary.

This prevents ordinary document packets from silently becoming AI-processing packets.

## Security Properties

Patient share packets must not contain medical payloads or key material.

Forbidden packet metadata includes:

- raw key material
- K_root
- K_local_unlock
- local-unlock-v1 values
- sealed key envelopes
- diagnosis text
- prescription text
- lab values
- sensitive clinical labels
- NID
- phone number
- email

The packet is a bounded manifest, not a medical file.

## Test Coverage

Slice 14 increases the suite to:

- 15 test files
- 287 passing tests

New tests verify:

- frozen recent reports packet creation
- patient and recipient identity copied from consent grant
- packetId validation
- timestamp validation
- packet expiry validation
- packet expiry cannot exceed consent expiry
- expired grant rejection
- revoked grant rejection
- empty resourceRefs rejection
- duplicate resourceId rejection
- empty resourceId rejection
- unsupported resourceKind rejection
- unsupported packetType rejection
- sensitive resourceId rejection
- packet capability requirements
- caregiver medication packet rules
- AI source packet rules
- aiProcessingAllowed behavior
- emergency packet resource restrictions
- resource-kind compatibility
- specific-document-set scope requirement
- specific-document-set subset validation
- medical payload and key material leak prevention
- forbidden dependency exclusion

## Consequences

Positive consequences:

- Doctor portal viewing will be packet-scoped rather than vault-wide.
- Future AI summarization will receive only consent-scoped source references.
- Emergency access remains emergency-card-only.
- Specific-document sharing cannot include extra records.
- Packet expiry is bounded by consent expiry.
- The domain remains testable without database, cloud, UI, AI, or vault logic.

Trade-offs:

- This slice does not decrypt documents.
- This slice does not persist packets.
- This slice does not sync packets.
- This slice does not render doctor or patient UI.
- This slice does not call AI.
- Future slices must connect packets to encrypted document manifests and portal read models.

## Next Technical Target

The next target is Slice 15: Clinical Document Reference Domain.

That slice should define safe, metadata-minimized clinical document references that can later be included in share packets without exposing plaintext clinical content.
