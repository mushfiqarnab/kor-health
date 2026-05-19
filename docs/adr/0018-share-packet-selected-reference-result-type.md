# ADR 0018: Share Packet Selected-Reference Result Type

## Status

Accepted.

## Date

2026-05-20

## Context

Slice 17 created a pure domain selector that returns ClinicalDocumentReference[] for a PatientSharePacket and readonly candidate ClinicalDocumentReference objects.

That raw array remains useful for direct selection. Slice 18 adds a small result envelope for future application orchestration where non-sensitive aggregate counts are useful.

The result type must not become a reason-reporting surface. Exclusion reasons, unmatched resource IDs, clinical categories, filenames, titles, diagnosis fields, OCR text, AI summaries, and patient identifiers remain forbidden because they may create metadata leakage or clinical inference risk.

This slice formalizes selected-reference output without loading, decrypting, syncing, persisting, or processing medical content.

## Decision

Create a pure domain-layer result wrapper under:

src/domain/share-packet-reference

The wrapper imports:

src/domain/share-packet/patientSharePacket.ts
src/domain/clinical-document/clinicalDocumentReference.ts
src/domain/share-packet-reference/sharePacketClinicalReferenceSelection.ts

The wrapper exposes:

selectClinicalDocumentReferencesForSharePacketResult

The wrapper returns:

SharePacketClinicalReferenceSelectionResult

The result includes only:

- selectedReferences
- selectedReferenceCount
- packetResourceRefCount
- candidateReferenceCount
- unmatchedPacketResourceRefCount

The wrapper calls the Slice 17 selector and does not import the Slice 16 compatibility bridge directly.

## Scope

This slice implements:

- selected-reference result envelope creation
- non-sensitive selected reference count
- non-sensitive packet resource-ref count
- non-sensitive candidate reference count
- non-sensitive unmatched packet resource-ref count
- mutation-free result creation
- contract tests for safe counts, no reason leakage, no resource ID leakage, dependency direction, and forbidden dependency exclusion

This slice does not implement:

- exclusion reason reporting
- unmatched resource ID reporting
- denied reference lists
- clinical category counts
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

## Result Shape

The result shape is:

- selectedReferences: readonly ClinicalDocumentReference[]
- selectedReferenceCount: number
- packetResourceRefCount: number
- candidateReferenceCount: number
- unmatchedPacketResourceRefCount: number

The result must not include:

- exclusionReasons
- excludedResourceIds
- unmatchedResourceIds
- revokedReferenceCount
- resourceKindMismatchCount
- clinical labels
- filenames
- report titles
- diagnosis fields
- OCR output
- AI output
- patient identifiers

## Count Rule

unmatchedPacketResourceRefCount is calculated as:

packet.resourceRefs.length - selectedReferences.length

This calculation depends on the Slice 17 invariant that the selector returns at most one selected ClinicalDocumentReference per packet resource ref.

If a future slice changes that invariant, this result type must be revisited with a new ADR.

## Dependency Rule

The result wrapper must depend on the Slice 17 selector:

selectClinicalDocumentReferencesForSharePacket

The result wrapper must not directly import:

canAttachDocumentReferenceToPacket

This keeps compatibility law centralized in Slice 16 and selection law centralized in Slice 17. Slice 18 only describes the selected output with safe aggregate counts.

## Security Properties

The result wrapper must not expose or process:

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
- unmatched resource IDs
- clinical exclusion reasons

The result wrapper must not import:

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

Slice 18 increases the suite to:

- 19 test files
- 353 passing tests

New tests verify:

- selected references are returned with non-sensitive selection counts
- unmatched packet resource refs are counted without exposing exclusion reasons or resource IDs
- zero-match behavior returns an empty selectedReferences array and safe counts
- packet and candidate references are not mutated
- the wrapper imports the Slice 17 selector instead of directly importing the Slice 16 compatibility bridge
- infrastructure, UI, AI, OCR, sync, storage, portal, and vault-opening imports are excluded

## Consequences

Positive consequences:

- Future application orchestration can use safe aggregate counts without re-running selection logic.
- Selected-reference output becomes explicit without replacing the raw Slice 17 selector.
- Slice 16 remains the compatibility authority.
- Slice 17 remains the selection authority.
- Slice 18 remains a small result-description layer.
- The result type avoids clinical exclusion reasons and unmatched resource identifiers.

Trade-offs:

- The result does not explain why packet resource refs were unmatched.
- The result does not list excluded candidates.
- The result does not expose denied resource IDs.
- Future audit, debugging, or UI explanation features will require separate ADRs and stronger privacy analysis.
- The unmatched count depends on the Slice 17 one-reference-per-packet-ref invariant.

## Next Technical Target

The next target is Slice 19: Access Request Domain.

That slice should model KOr ID access requests and enforce the platform law that KOr ID creates an access request, never access.
