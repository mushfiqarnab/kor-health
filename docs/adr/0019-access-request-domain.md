# ADR 0019: Access Request Domain

## Status

Accepted.

## Date

2026-05-20

## Context

Project KOr requires a domain model for access requests.

The platform law is:

KOr ID creates an access request, never access.

A requester may use a KOr ID to ask a patient for access. The request must not become authorization, consent, resource selection, document loading, vault opening, or share packet issuance.

Earlier slices established:

- consent grants as explicit, scoped, time-limited, revocable authorization records
- patient share packets as metadata-only manifests derived from consent grants
- clinical document references as opaque pointers to encrypted payloads
- share packet reference compatibility and selected-reference output

Slice 19 adds the access request domain before any request-to-consent transition. This keeps request creation separate from patient approval.

## Decision

Create a pure domain model under:

src/domain/access-request

The domain exposes:

- AccessRequest
- CreateAccessRequestInput
- AccessRequestRequesterActorType
- AccessRequestCapability
- AccessRequestScope
- AccessRequestPurpose
- AccessRequestStatus
- createAccessRequest
- withdrawAccessRequest
- isAccessRequestExpired
- isAccessRequestWithdrawn
- evaluateAccessRequestStatus
- isAccessRequestPending
- assertNoAccessRequestMetadataLeak

The access request includes:

- accessRequestId
- requesterActorId
- requesterActorType
- targetKorId
- requestedScope
- requestedCapabilities
- requestedPurpose
- createdAtEpochMs
- expiresAtEpochMs
- withdrawnAtEpochMs only after explicit withdrawal

The access request does not include:

- consentGrantId
- grantId
- sharePacketId
- resourceIds
- document references
- selected references
- approvedAtEpochMs
- deniedAtEpochMs
- patient medical content
- filenames
- report titles
- diagnosis fields
- OCR output
- AI output

## Scope

This slice implements:

- pending access request creation
- request expiry evaluation
- request withdrawal
- idempotent withdrawal
- requester actor type validation
- requested scope validation
- requested capability validation
- requested purpose validation
- requester actor capability compatibility
- requested scope capability compatibility
- emergency viewer request restrictions
- AI summary request precondition requiring a source-view capability
- metadata leak detection
- pure domain contract tests
- forbidden dependency tests

This slice does not implement:

- access approval
- access denial
- consent grant creation
- consent grant transition
- share packet creation
- clinical document reference creation
- selected-reference creation
- patient resource selection
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

## Request Lifecycle

A new access request is born pending.

A request becomes expired when nowEpochMs is greater than or equal to expiresAtEpochMs.

A request becomes withdrawn only through withdrawAccessRequest.

Withdrawal is idempotent. Withdrawing an already withdrawn request returns the same request object.

The create input does not accept withdrawnAtEpochMs. This prevents a request from being created already withdrawn.

## Actor and Capability Rules

verified_doctor may request:

- view_current_medications
- view_recent_reports
- view_visit_packet
- request_ai_summary

caregiver may request:

- view_current_medications
- upload_report
- manage_medication_adherence

emergency_viewer may request:

- view_emergency_card only

request_ai_summary may be requested only when at least one source-view capability is requested:

- view_current_medications
- view_recent_reports
- view_visit_packet

Requesting AI capability does not call AI and does not grant AI processing permission. It only records the request.

## Scope Rules

emergency_card allows:

- view_emergency_card only

current_medications allows:

- view_current_medications
- request_ai_summary

recent_reports allows:

- view_recent_reports
- request_ai_summary

visit_packet allows:

- view_visit_packet
- view_current_medications
- view_recent_reports
- request_ai_summary

medication_adherence allows:

- view_current_medications
- upload_report
- manage_medication_adherence

specific_document_set is intentionally excluded from Slice 19. A requester should not target internal resource IDs through a KOr ID request. Patient resource selection belongs to later approval or share-packet issuance flows.

## Metadata Safety

The access request must not expose:

- clinical labels
- diagnosis text
- prescription text
- lab values
- OCR output
- AI output
- NID
- phone number
- email
- resource IDs
- filenames
- report titles
- key material
- sealed key envelope terms

The metadata leak guard scans string values for forbidden terms.

Object keys are checked with normalized full-key and safe word-segment matching. This catches unsafe shapes such as patientNid, phoneNumber, diagnosisText, resourceIds, and rawKeyBytes without rejecting safe keys such as accessRequestId.

## Security Properties

The access request domain must not import:

- consent grant domain
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

## Test Coverage

Slice 19 increases the suite to:

- 20 test files
- 371 passing tests

New tests verify:

- frozen pending access request creation
- KOr ID request does not grant access
- consent grant IDs are not present
- share packet IDs are not present
- resource IDs are not present
- approval and denial timestamps are not present
- empty identifiers are rejected
- invalid timestamps are rejected
- unsupported actor type, scope, purpose, and capability are rejected
- empty and duplicate requested capabilities are rejected
- actor-capability compatibility is enforced
- scope-capability compatibility is enforced
- emergency viewer requests are limited to emergency card access
- AI summary requests require source-view capability
- caregiver medication requests can be modeled without granting access
- request expiry is evaluated
- withdrawal does not mutate the original request
- withdrawal is idempotent
- withdrawal before creation is rejected
- sensitive labels and identifiers in metadata are rejected
- unsafe identity and clinical key shapes are rejected
- forbidden infrastructure, UI, AI, OCR, sync, storage, portal, consent, share packet, and document-reference imports are excluded

## Consequences

Positive consequences:

- KOr ID can safely initiate an access request.
- Access request creation remains separate from authorization.
- Patient consent remains the authority.
- Request lifecycle is explicit and testable.
- The domain remains pure TypeScript.
- Later Slice 20 can transform a valid patient-approved request into a consent grant without retrofitting request semantics.

Trade-offs:

- Slice 19 does not approve or deny access.
- Slice 19 does not create consent grants.
- Slice 19 does not create share packets.
- Slice 19 does not support specific document requests.
- Slice 19 does not verify doctor identity.
- Slice 19 does not notify the patient.
- Slice 19 does not write an audit trail.

## Next Technical Target

The next target is Slice 20: Access Request to Consent Grant Transition.

That slice should model how a patient decision converts an access request into a scoped consent grant, while preserving the law that KOr ID itself never grants access.
