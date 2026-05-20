# ADR 0020: Access Request to Consent Grant Transition

## Status

Accepted.

## Date

2026-05-20

## Context

Slice 19 introduced the access request domain.

The Slice 19 law is:

KOr ID creates an access request, never access.

An access request is only a patient-facing ask. It contains requester identity, target KOr ID, requested scope, requested capabilities, requested purpose, creation time, expiry time, and optional withdrawal time. It does not contain consent grant IDs, share packet IDs, resource IDs, document references, selected references, approval timestamps, denial timestamps, or medical content.

Slice 20 creates the narrow approval transition from a valid pending access request to a consent grant.

This transition must preserve the platform law that access is never granted by KOr ID alone. A consent grant may be created only when the patient-side approval context supplies the matching patient KOr ID and a grantor patient ID.

This slice does not create share packets. Share packet issuance remains the next technical target.

## Decision

Create a pure domain transition under:

src/domain/access-request-consent

The transition exposes:

createConsentGrantFromApprovedAccessRequest

The transition input includes:

- grantId
- grantorPatientId
- approvingPatientKorId
- accessRequest
- approvedAtEpochMs
- grantExpiresAtEpochMs

The transition returns:

ConsentGrant

The transition imports:

- AccessRequest and evaluateAccessRequestStatus from the access request domain
- createConsentGrant and ConsentGrant from the consent domain

The transition delegates consent validation to createConsentGrant.

## Scope

This slice implements:

- approval-only transition from pending access request to consent grant
- approving patient KOr ID match validation
- approval timestamp validation
- request pending-state validation
- rejection of expired requests
- rejection of withdrawn requests
- transition metadata leak detection for grantId, grantorPatientId, and approvingPatientKorId
- field mapping from access request to consent grant
- contract tests for doctor requests, caregiver medication requests, AI-summary capability mapping, non-mutation, expiry rejection, withdrawal rejection, metadata rejection, and forbidden dependency exclusion

This slice does not implement:

- access denial
- denial reason records
- approval status storage
- access request mutation
- share packet creation
- clinical document reference creation
- selected-reference creation
- resource selection
- specific document selection
- doctor verification
- BM&DC lookup
- Supabase persistence
- SQLite persistence
- WatermelonDB persistence
- encrypted payload storage
- cloud upload
- sync
- audit trail
- notifications
- OCR
- AI calls
- doctor portal UI
- patient portal UI
- file upload
- WebRTC
- payment flows

## Transition Rules

The transition follows these rules:

- grantId must not be empty.
- grantorPatientId must not be empty.
- approvingPatientKorId must not be empty.
- approvedAtEpochMs must be a positive integer.
- approvingPatientKorId must match accessRequest.targetKorId.
- approvedAtEpochMs cannot be before accessRequest.createdAtEpochMs.
- accessRequest must be pending at approvedAtEpochMs.
- grantExpiresAtEpochMs must be after approvedAtEpochMs through createConsentGrant validation.
- metadata in transition identifiers must not expose clinical labels, patient identifiers, or key material terms.
- consent grant creation must be delegated to createConsentGrant.

## Mapping Rules

The transition maps:

- grantId -> ConsentGrant.grantId
- grantorPatientId -> ConsentGrant.grantorPatientId
- accessRequest.requesterActorId -> ConsentGrant.recipientActorId
- accessRequest.requesterActorType -> ConsentGrant.recipientActorType
- accessRequest.requestedScope -> ConsentGrant.scope
- accessRequest.requestedCapabilities -> ConsentGrant.capabilities
- accessRequest.requestedPurpose -> ConsentGrant.purpose
- approvedAtEpochMs -> ConsentGrant.issuedAtEpochMs
- grantExpiresAtEpochMs -> ConsentGrant.expiresAtEpochMs

The transition does not map:

- accessRequestId
- targetKorId
- sharePacketId
- resourceIds
- document references
- selected references
- approvedAtEpochMs as a stored approval field
- deniedAtEpochMs
- AI output
- OCR output
- filenames
- report titles
- diagnosis fields

## Consent Delegation

Slice 20 must not duplicate consent grant law.

The transition must delegate to createConsentGrant so that the consent domain remains the single authority for:

- recipient actor type validation
- capability validation
- scope validation
- purpose validation
- actor-capability compatibility
- scope-capability compatibility
- emergency rules
- consent expiry rules
- consent metadata leak detection
- frozen consent grant output

## Security Properties

The transition must not import:

- patient share packet domain
- clinical document reference domain
- share packet reference selectors
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

The transition must not expose or process:

- decrypted payloads
- report text
- diagnosis text
- prescription text
- lab values
- OCR output
- AI output
- filenames
- report titles
- resource IDs
- document IDs
- selected references
- key material
- sealed key envelopes

## Test Coverage

Slice 20 increases the suite to:

- 21 test files
- 383 passing tests

New tests verify:

- consent grant creation from a patient-approved pending access request
- frozen consent grant output
- source access request is not mutated
- caregiver medication request field mapping
- AI-summary request capability mapping without AI execution
- approving patient KOr ID mismatch rejection
- approval before request creation rejection
- expired access request rejection
- withdrawn access request rejection
- empty transition identifiers rejection
- invalid approval timestamp rejection
- invalid grant expiry rejection through consent validation
- sensitive transition identifier metadata rejection before consent creation
- forbidden share packet, document reference, resource selection, selected-reference, infrastructure, UI, AI, OCR, portal, sync, and storage imports are excluded

## Consequences

Positive consequences:

- Access requests can now become scoped consent grants only through explicit patient approval.
- KOr ID remains a request locator, not an access credential.
- Consent law remains centralized in the consent domain.
- Share packet issuance remains separate.
- The transition remains pure TypeScript and infrastructure-free.
- Future Slice 21 can consume consent grants without needing to reinterpret access requests.

Trade-offs:

- Denial is not modeled in this slice.
- Approval status is not stored on the access request.
- No audit trail is written.
- No notification is sent.
- No share packet is issued.
- No document-specific access is supported.
- No doctor verification is performed.

## Next Technical Target

The next target is Slice 21: Share Packet Issuance from Consent Grant.

That slice should create metadata-only patient share packets from active consent grants without opening the vault, loading documents, selecting document references, syncing, or exposing clinical content.
