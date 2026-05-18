# ADR 0013: Consent Grant Domain

## Status

Accepted.

## Date

2026-05-18

## Context

KOr Health requires a consent-first access model before implementing doctor portals, caregiver access, emergency access, document sharing, or AI summarization.

A patient KOr ID must never grant access to medical records. It may only allow a recipient to request access.

Consent must be modeled as a scoped, time-limited, revocable domain object. This protects patients from broad record exposure and creates the foundation for future doctor access, caregiver access, emergency access, and AI summarization workflows.

## Decision

Create a pure domain-layer consent model under:

src/domain/consent

The consent grant domain defines:

- grantor patient identity
- recipient actor identity
- recipient actor type
- scoped capabilities
- optional opaque resource IDs
- purpose
- issue time
- expiry time
- revocation time
- access evaluation
- denial reasons
- metadata leak protection

## Scope

This slice implements:

- consent grant creation
- supported recipient actor validation
- supported capability validation
- supported scope validation
- supported purpose validation
- expiry checks
- revocation checks
- idempotent revocation
- capability evaluation
- AI-summary permission separation
- emergency-card-only restrictions
- caregiver capability restrictions
- specific-document-set resource ID rules
- sensitive-label rejection
- forbidden metadata leak assertion
- contract tests

This slice does not implement:

- Supabase
- SQLite
- WatermelonDB
- persistence
- sync
- doctor portal UI
- patient portal UI
- BM&DC lookup
- caregiver identity verification
- emergency QR
- vault opening
- document decryption
- AI calls
- sensitive-folder sharing
- full-vault access

## Actors

Supported recipient actor types:

- verified_doctor
- caregiver
- emergency_viewer

AI is not modeled as a recipient actor in this slice.

AI summarization is modeled as an explicit capability:

- request_ai_summary

This prevents document-view permission from silently becoming AI-processing permission.

## Capabilities

Supported capabilities:

- view_emergency_card
- view_current_medications
- view_recent_reports
- view_visit_packet
- upload_report
- manage_medication_adherence
- request_ai_summary

Rejected capabilities include:

- view_full_vault
- decrypt_document
- export_all_records

Full-vault access is intentionally excluded from this slice.

## Scopes

Supported scopes:

- emergency_card
- current_medications
- recent_reports
- visit_packet
- medication_adherence
- specific_document_set

Sensitive scopes are not supported in this slice.

Examples of excluded sensitive categories:

- mental health
- reproductive health
- HIV/STI
- psychiatric records
- domestic violence notes
- fertility records

Sharing sensitive folders must be handled in a future explicit slice.

## Resource IDs

The specific_document_set scope requires resourceIds.

Rules:

- resourceIds are required for specific_document_set
- resourceIds are forbidden for non-document-set scopes
- resourceIds must be non-empty
- resourceIds must be unique
- resourceIds must be opaque
- resourceIds must not contain clinical labels

Safe examples:

- doc_01JAAA00000000000000000001
- rec_01JAAA00000000000000000001

Unsafe examples:

- hiv-report-2026
- mental-health-note
- pregnancy-ultrasound
- diabetes-lab

## Emergency Rules

Emergency access is intentionally narrow.

For emergency_viewer:

- scope must be emergency_card
- capability must be view_emergency_card
- purpose should be emergency_care

Emergency access must not allow:

- recent reports
- visit packets
- AI summary
- report upload
- medication management
- full vault access

Emergency mode is a minimal safety disclosure, not a vault key.

## Caregiver Rules

Caregiver grants may support:

- view_current_medications
- upload_report
- manage_medication_adherence

Caregiver grants must not imply access to sensitive folders.

Caregiver grants must not allow AI summarization in this slice.

## Doctor Rules

Verified doctor grants may support:

- view_current_medications
- view_recent_reports
- view_visit_packet
- request_ai_summary

A verified doctor still receives no access unless a patient-created consent grant authorizes the capability.

Knowing a patient KOr ID creates an access request, not record access.

## AI Summary Rule

AI summarization requires explicit capability:

- request_ai_summary

The following capabilities do not imply AI permission:

- view_current_medications
- view_recent_reports
- view_visit_packet
- view_emergency_card

Future AI workflows must evaluate consent before processing any patient data.

## Revocation

Revocation is idempotent.

If a grant is already revoked, calling revokeConsentGrant again returns the same grant unchanged.

This supports offline-first retry behavior and prevents revocation timestamp drift.

## Denial Reasons

Capability evaluation returns safe denial reasons:

- expired
- revoked
- capability_not_granted
- scope_does_not_allow_capability
- recipient_type_not_allowed

These reasons are safe for future UI and audit logging because they do not expose medical payloads.

## Security Properties

Consent grants must not contain:

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

Consent grants contain authorization metadata only.

## Test Coverage

Slice 13 increases the suite to:

- 14 test files
- 248 passing tests

New tests verify:

- frozen grant creation
- specific document set resource IDs
- empty ID rejection
- timestamp validation
- expiry validation
- empty capability rejection
- duplicate capability rejection
- unsupported actor rejection
- unsupported scope rejection
- unsupported purpose rejection
- unsupported capability rejection
- full-vault capability rejection
- decrypt-document capability rejection
- export-all-records capability rejection
- active grant evaluation
- expired grant evaluation
- revoked grant evaluation
- immutable revocation
- idempotent revocation
- revocation timestamp validation
- granted capability access
- ungranted capability denial
- expired capability denial reason
- revoked capability denial reason
- explicit AI summary permission
- AI denial when only document view exists
- emergency viewer restrictions
- emergency-card-only scope restrictions
- caregiver medication management
- caregiver AI rejection
- doctor caregiver-only capability rejection
- resource ID requirements
- resource ID uniqueness
- empty resource ID rejection
- sensitive resource ID rejection
- sensitive metadata rejection
- medical payload leak rejection
- forbidden dependency exclusion

## Consequences

Positive consequences:

- Doctor portal access will be consent-first.
- AI summarization cannot run without explicit patient permission.
- Emergency access is limited to emergency-card disclosure.
- Caregiver capabilities are constrained.
- Sensitive labels are blocked from consent metadata.
- Future portal, sync, and AI workflows can consume one canonical authorization model.

Trade-offs:

- This slice does not persist grants.
- This slice does not sync revocations.
- This slice does not verify doctor identity.
- This slice does not implement caregiver verification.
- This slice does not create patient or doctor UI.
- This slice does not decrypt documents or build share packets.

## Next Technical Target

The next target is Slice 14: Patient Share Packet Domain.

That slice should define how consent-scoped records are grouped into a safe share packet for doctor viewing or future AI summarization, without decrypting documents or calling AI.
