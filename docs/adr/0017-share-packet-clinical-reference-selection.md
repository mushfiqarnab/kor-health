# ADR 0017: Share Packet Clinical Reference Selection

## Status

Accepted.

## Date

2026-05-20

## Context

Slice 16 created the share packet document-reference compatibility bridge.

Slice 17 needed a pure domain selector that takes an existing PatientSharePacket and a readonly list of ClinicalDocumentReference objects, then returns only the active compatible clinical document references that belong in the packet.

A patient share packet is the patient-authorized disclosure manifest. Candidate clinical document references are merely available opaque pointers to encrypted payloads. Therefore, selection order must follow packet.resourceRefs, not candidate input order, database order, resourceId sort order, or any future sync timestamp.

This slice converts the Slice 16 compatibility bridge into a deterministic selection policy without loading, decrypting, syncing, persisting, or processing medical content.

## Decision

Create a pure domain-layer selector under:

src/domain/share-packet-reference

The selector imports:

src/domain/share-packet/patientSharePacket.ts
src/domain/clinical-document/clinicalDocumentReference.ts
src/domain/share-packet-reference/sharePacketDocumentReferenceCompatibility.ts

The selector exposes:

selectClinicalDocumentReferencesForSharePacket

The selector returns:

ClinicalDocumentReference[]

The selector does not create a result envelope in this slice. Result formalization is reserved for Slice 18 if non-sensitive counts become necessary.

## Scope

This slice implements:

- packet resource-ref ordered clinical reference selection
- first compatible active candidate selection per packet resource ref
- at most one selected document reference per packet resource ref
- empty-array behavior when no compatible active references exist
- mutation-free selection
- delegation to the Slice 16 compatibility bridge
- contract tests for selection, exclusion, ordering, deduplication, mutation safety, and forbidden dependency exclusion

This slice does not implement:

- selected-reference result envelopes
- exclusion reason reporting
- consent grant re-checking
- access request modeling
- patient share packet creation
- clinical document reference creation
- database persistence
- sync
- payload fetching
- document loading
- vault opening
- document decryption
- document encryption
- OCR
- AI calls
- doctor portal UI
- patient portal UI
- BM&DC lookup
- file upload
- medical payload handling

## Selection Rules

The selector follows these rules:

- Walk packet.resourceRefs in packet order.
- For each packet resource ref, scan candidateReferences in candidate input order.
- Use canAttachDocumentReferenceToPacket from Slice 16 for compatibility.
- Select the first compatible active candidate.
- Return at most one ClinicalDocumentReference per packet resource ref.
- Return an empty array when no compatible active references exist.
- Do not mutate the packet.
- Do not mutate candidate references.
- Do not inspect clinical content or semantic metadata.

## Ordering Rule

Selected references follow packet.resourceRefs order.

This is intentional because the patient share packet is the patient-authorized disclosure manifest. Candidate references are available inputs, not the ordering authority.

The selector must not order by:

- candidate reference input order
- resourceId sort order
- referenceId sort order
- createdAtEpochMs
- sync timestamps
- database IDs
- repository lookup order

## Duplicate Candidate Rule

If multiple active compatible candidates exist for the same packet resource ref, the selector chooses the first compatible active candidate from candidateReferences.

This avoids introducing version clocks, latest-wins behavior, database lookups, repository ordering, or sync semantics into a pure domain slice.

## Compatibility Delegation

The selector must not duplicate Slice 16 compatibility logic.

It must not manually reimplement:

- packet resource membership validation
- resourceId equality validation
- active clinical document reference validation
- packet resource-kind to clinical resource-kind mapping
- unsupported medication_adherence handling
- metadata leak checks

All compatibility behavior remains centralized in canAttachDocumentReferenceToPacket.

## Security Properties

The selector must not expose or process:

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
- filenames
- report titles
- doctor note content
- semantic clinical labels

The selector must not import:

- Supabase
- SQLite
- WatermelonDB
- SecureStore
- Expo SecureStore
- Expo Local Authentication
- vault assembly
- document loading
- document decryption
- OCR
- AI providers
- doctor portal UI
- patient portal UI
- BM&DC lookup
- file upload
- background sync
- React
- React Native

## Test Coverage

Slice 17 increases the suite to:

- 18 test files
- 347 passing tests

New tests verify:

- active compatible references are selected in packet resource-ref order
- inactive document references are excluded
- document references not present in packet refs are excluded
- incompatible broad resource kinds are excluded through the Slice 16 bridge
- medication_adherence remains excluded through Slice 16 compatibility behavior
- duplicate compatible candidates resolve to the first active compatible candidate
- empty candidate lists return an empty array
- packet and candidate references are not mutated
- forbidden infrastructure, UI, AI, OCR, portal, sync, and vault-opening imports are excluded

## Consequences

Positive consequences:

- Patient-authorized packet order becomes the deterministic selection order.
- Future doctor portal, share rendering, and AI-permission workflows can consume selected references without duplicating compatibility logic.
- Selection remains pure and testable.
- The selector does not open the vault or touch encrypted payloads.
- Slice 16 remains the single compatibility authority.
- medication_adherence remains unsupported for clinical document compatibility until a dedicated privacy-preserving domain exists.

Trade-offs:

- This slice returns a raw ClinicalDocumentReference[].
- This slice does not expose non-sensitive counts.
- This slice does not report exclusion reasons.
- This slice does not create access requests.
- This slice does not transition access requests into consent grants.
- This slice does not issue share packets from consent grants.
- Future integration slices must connect selected opaque references to encrypted payload loading only after the proper storage, sync, and authorization boundaries exist.

## Next Technical Target

The next target is Slice 18: Share Packet Selected-Reference Result Type.

That slice may formalize selected-reference output if a raw array becomes insufficient. It must avoid infrastructure and must not expose clinical exclusion reasons.
