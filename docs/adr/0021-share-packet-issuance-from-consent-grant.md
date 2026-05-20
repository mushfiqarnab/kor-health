# ADR 0021: Share Packet Issuance from Consent Grant

## Status

Accepted.

## Date

2026-05-20

## Context

Slice 20 created the approval transition from an access request to a consent grant.

Slice 21 connects consent grants to patient share packet issuance.

The patient share packet domain already owns packet law:

- active consent grant validation
- packet expiry validation
- packet type validation
- resource ref validation
- packet capability validation
- specific document subset validation
- AI source packet permission validation
- metadata leak prevention
- frozen packet output

Slice 21 must not duplicate that law. It creates a narrow issuance boundary that delegates packet construction to createPatientSharePacket.

The platform law remains:

Patient share packets are metadata-only manifests of opaque authorized resource refs.

## Decision

Create a pure domain wrapper under:

src/domain/share-packet-issuance

The wrapper exposes:

issuePatientSharePacketFromConsentGrant

The wrapper input includes:

- packetId
- consentGrant
- packetType
- resourceRefs
- issuedAtEpochMs
- expiresAtEpochMs

The wrapper returns:

PatientSharePacket

The wrapper delegates to:

createPatientSharePacket

The wrapper maps:

- issuedAtEpochMs -> createdAtEpochMs
- expiresAtEpochMs -> expiresAtEpochMs
- packetId -> packetId
- consentGrant -> consentGrant
- packetType -> packetType
- resourceRefs -> resourceRefs

## Scope

This slice implements:

- share packet issuance from a consent grant
- packetId metadata leak pre-check
- delegated packet creation
- issuedAtEpochMs to createdAtEpochMs mapping
- preservation of existing patient share packet domain law
- contract tests for recent report packets, caregiver medication packets, AI source packets, specific document packets, expired/revoked consent rejection, expiry limits, incompatible resource refs, metadata rejection, delegation, and forbidden dependencies

This slice does not implement:

- access request creation
- access request approval
- consent grant creation
- consent re-checking outside packet law
- clinical document reference selection
- selected-reference result creation
- document loading
- vault opening
- document decryption
- document encryption
- OCR
- AI calls
- Supabase persistence
- SQLite persistence
- WatermelonDB persistence
- encrypted payload storage
- cloud upload
- sync
- audit trail
- notifications
- doctor portal UI
- patient portal UI
- file upload
- WebRTC
- payment flows

## Issuance Rules

The issuance function must:

- accept an existing ConsentGrant
- accept already-authorized opaque resourceRefs
- call createPatientSharePacket
- return a PatientSharePacket
- avoid mutating the consent grant or resource refs
- avoid selecting or inspecting document references
- avoid loading or opening clinical content
- avoid duplicating patient share packet validation logic

## Security Properties

The issuance wrapper must not import:

- access request domain
- access request to consent transition domain
- clinical document reference domain
- share packet reference selectors
- selected-reference result types
- Supabase
- SQLite
- WatermelonDB
- SecureStore
- Expo SecureStore
- Expo Local Authentication
- BM&DC lookup
- vault assembly
- document loading
- document decryption
- OCR
- AI providers
- doctor portal UI
- patient portal UI
- file upload
- background sync
- React
- React Native

The issuance wrapper must not expose or process:

- decrypted payloads
- report text
- diagnosis text
- prescription text
- lab values
- OCR output
- AI output
- filenames
- report titles
- document bodies
- key material
- sealed key envelopes

## Test Coverage

Slice 21 increases the suite to:

- 22 test files
- 394 passing tests

New tests verify:

- metadata-only recent reports packet issuance
- frozen packet output
- source consent grant and resource refs are not mutated
- caregiver medication packet issuance
- AI summary source packet issuance without AI output
- specific document packet issuance only for granted opaque refs
- expired consent grant rejection
- revoked consent grant rejection
- packet expiry after consent grant expiry rejection
- unsupported packet type rejection
- incompatible resource ref rejection
- unsafe issuance metadata rejection before packet creation
- delegation to createPatientSharePacket
- forbidden access request, consent transition, document reference, selected reference, infrastructure, UI, AI, OCR, portal, sync, and storage imports are excluded

## Consequences

Positive consequences:

- Consent grants can now issue safe patient share packets.
- Packet law remains centralized in the patient share packet domain.
- Slice 21 avoids duplicating locked packet validation rules.
- The issuance boundary remains pure TypeScript.
- No vault, cloud, sync, AI, OCR, or UI boundary is introduced.

Trade-offs:

- Slice 21 does not choose resource refs.
- Slice 21 does not select clinical document references.
- Slice 21 does not verify document compatibility.
- Slice 21 does not load encrypted payloads.
- Slice 21 does not persist or sync packets.
- Slice 21 does not write audit records.

## Next Technical Target

The next target is Slice 22: Local Encrypted Document Payload Boundary.

That slice should define how encrypted local payload references are represented without introducing cloud upload, sync, document decryption, OCR, AI, UI, or readable clinical metadata.
