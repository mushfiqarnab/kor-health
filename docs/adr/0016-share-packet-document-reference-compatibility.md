# ADR 0016: Share Packet Document Reference Compatibility

## Status

Accepted.

## Date

2026-05-18

## Context

Slice 14 created patient share packets. Slice 15 created clinical document references.

A patient share packet contains opaque resourceRefs. A clinical document reference points to encrypted clinical payloads. The system needs a pure domain bridge to verify that a packet resource reference may safely attach to a clinical document reference.

This slice connects the two domains without loading, decrypting, syncing, persisting, or processing medical content.

## Decision

Create a pure domain-layer compatibility bridge under:

src/domain/share-packet-reference

The bridge imports:

src/domain/share-packet/patientSharePacket.ts
src/domain/clinical-document/clinicalDocumentReference.ts

The bridge does not import consent grants, persistence, UI, AI, sync, or vault-opening logic.

## Scope

This slice implements:

- packet resource membership validation
- resourceId equality validation
- active clinical document reference validation
- packet resource-kind to clinical resource-kind mapping
- unsupported medication_adherence handling
- safe compatibility denial reasons
- metadata leak assertion
- contract tests

This slice does not implement:

- consent grant re-checking
- patient share packet creation
- clinical document reference creation
- database persistence
- sync
- payload fetching
- document loading
- vault opening
- document decryption
- OCR
- AI calls
- doctor portal UI
- patient portal UI
- BM&DC lookup
- file upload
- medical payload handling

## Compatibility Rules

A packet resource reference is compatible with a clinical document reference only when:

- the packet resource reference exists inside packet.resourceRefs
- packetResourceRef.resourceId equals documentReference.resourceId
- the clinical document reference is active
- the packet resource kind maps to the clinical document resource kind
- the input bundle contains no forbidden metadata

## Resource Kind Mapping

Allowed mappings:

- report maps to encrypted_report
- visit_packet maps to encrypted_visit_packet
- current_medications maps to encrypted_medication_snapshot
- emergency_card maps to encrypted_emergency_card

Unsupported in this slice:

- medication_adherence

Medication adherence may later become an event stream or separate reference domain. It is not treated as a clinical document reference in this slice.

## Denial Reasons

The bridge returns safe denial reasons:

- resource_ref_not_in_packet
- resource_id_mismatch
- reference_revoked
- resource_kind_mismatch
- unsupported_packet_resource_kind
- forbidden_metadata

These reasons are safe for future UI and audit behavior because they do not expose medical payloads.

## Security Properties

The bridge must not expose or process:

- decrypted document payloads
- report text
- diagnosis text
- prescription text
- lab values
- OCR output
- AI output
- raw key material
- sealed key envelopes
- patient NID
- phone number
- email
- semantic clinical labels

Forbidden metadata includes:

- mental
- psychiatric
- reproductive
- HIV/STI
- domestic violence
- fertility
- diagnosis
- prescription
- lab value
- HbA1c
- diabetes
- pregnancy
- oncology
- cancer
- doctor notes
- clinic
- NID
- phone
- email
- rawKeyBytes
- K_root
- K_local_unlock
- local-unlock-v1
- sealed-key-envelope

## Test Coverage

Slice 16 increases the suite to:

- 17 test files
- 338 passing tests

New tests verify:

- report packet refs attach only to encrypted_report references
- visit packet refs attach only to encrypted_visit_packet references
- current medication refs attach only to encrypted_medication_snapshot references
- emergency card refs attach only to encrypted_emergency_card references
- packetResourceRef must exist in packet.resourceRefs
- resourceId mismatch denial
- revoked reference denial
- resource kind mismatch denial
- medication_adherence unsupported denial
- boolean compatibility helper behavior
- safe denial reasons
- sensitive packet resourceId rejection
- sensitive document reference resourceId rejection
- sensitive encryptedPayloadRef rejection
- unsafe compatibility object leak assertion
- forbidden dependency exclusion

## Consequences

Positive consequences:

- Patient share packets cannot attach arbitrary clinical document references.
- Revoked document references cannot be newly attached.
- Emergency packets cannot smuggle reports.
- Medication adherence is not falsely modeled as a clinical document.
- Future doctor portal and AI workflows can rely on this compatibility bridge before loading any data.

Trade-offs:

- This slice does not fetch encrypted payloads.
- This slice does not verify consent grants again.
- This slice does not create share packets.
- This slice does not create document references.
- Future integration slices must connect compatible references to encrypted payload loading.

## Next Technical Target

The next target is Slice 17: Share Packet Clinical Reference Selection.

That slice should select compatible active clinical document references for a patient share packet without loading, decrypting, or syncing document payloads.
