# ADR 0040: Local Document Mutation Intent Domain

## Status

Accepted.

## Date

2026-05-29

## Context

Project KOr needs future foundations for offline-first local persistence and later sync, but those foundations must not introduce storage, cloud behavior, audit receipts, telemetry, analytics, or readable medical metadata before their gates.

Earlier slices established the local document save boundary:

- local encrypted document payload boundary
- clinical document reference boundary
- local document repository port
- local document save use case
- local document save preflight decision
- local document save result type
- local document save outcome boundary
- local document save outcome wrapper
- local document repository failure classification
- local document repository failure rethrow helper
- local document save repository failure classification integration
- local document save outcome repository failure policy

Those foundations preserve this rule:

- preflight rejection is not repository failure
- repository failure is not a LocalDocumentSaveOutcome value
- repository failure rethrows the original cause

The next foundation needs a safe way to describe a local document change request without claiming that a durable mutation log, sync queue, replay system, storage adapter, audit trail, or cloud upload exists.

The term "mutation log" is intentionally avoided in the implementation because "log" can imply durability, auditability, replay, or sync.

## Decision

Introduce a pure domain module:

src/domain/local-document-mutation-intent/localDocumentMutationIntent.ts

Introduce its contract test:

src/domain/local-document-mutation-intent/__tests__/localDocumentMutationIntent.contract.test.ts

The domain creates immutable LocalDocumentMutationIntent values with:

- kind
- schemaVersion
- targetKind
- intentId
- targetRef
- operation
- createdAtEpochMs
- optional idempotencyKey

The approved target kind is:

- local_document_reference

The approved operation is:

- save_local_document_reference

All identifiers are opaque strings.

The implementation validates opaque values defensively and rejects semantic or sensitive fragments such as patient, doctor, diagnosis, prescription, filename, filepath, storage path, Supabase, SQLite, sync, replay, audit, telemetry, analytics, notification, display, cloud, plaintext, ciphertext, and MIME type markers.

## Scope

This slice modifies only:

- src/domain/local-document-mutation-intent/localDocumentMutationIntent.ts
- src/domain/local-document-mutation-intent/__tests__/localDocumentMutationIntent.contract.test.ts
- docs/adr/0040-local-document-mutation-intent-domain.md

This slice does not modify:

- src/application/
- src/infrastructure/
- src/mobile/
- docs/project-kor/
- scripts/
- package.json

This slice does not introduce:

- persistence
- SQLite
- WatermelonDB
- Supabase
- filesystem storage
- sync
- replay
- upload
- download
- audit receipts
- telemetry
- analytics
- UI
- notifications
- OCR
- AI
- clinical metadata
- filenames
- file paths
- storage paths
- patient identifiers
- doctor identifiers
- BM&DC identifiers

## Domain Rules

LocalDocumentMutationIntent is an internal domain value.

It is not:

- a durable log
- an audit receipt
- a sync event
- a replay command
- a telemetry event
- an analytics event
- a UI display model
- a cloud metadata record
- a notification payload
- a storage adapter record

The domain does not generate timestamps, random identifiers, or cryptographic identifiers.

Callers must provide opaque identifiers and createdAtEpochMs.

The domain does not persist, enqueue, replay, upload, download, encrypt, decrypt, display, log, or notify.

## Opaque Value Policy

The domain accepts only string values that are:

- strings
- between 8 and 96 characters
- limited to ASCII letters, numbers, underscore, and hyphen
- free from known semantic or sensitive fragments

The following values are rejected:

- empty strings
- patient-like identifiers
- diagnosis-like labels
- filename-like labels
- storage-path-like labels
- cloud-provider labels
- database labels
- sync or replay labels
- audit labels
- telemetry or analytics labels
- display or notification labels
- plaintext or ciphertext labels

This policy is intentionally defensive. It does not prove a value is globally safe, but it blocks obvious semantic leakage inside this domain boundary.

## Test Coverage

The contract verifies that the domain:

- creates frozen opaque mutation intent values
- supports omission of idempotencyKey
- rejects invalid and non-opaque inputs
- exposes only approved schema, kind, target kind, and operation constants
- remains free from imports, side effects, infrastructure calls, and clinical metadata fields
- includes defensive forbidden-fragment checks without claiming those fragments as domain behavior

Slice 40 increases the suite to:

- 38 test files
- 517 passing tests

## Consequences

Positive consequences:

- KOr now has a pure internal domain value for local document mutation intent.
- Future persistence and sync slices can reference a safer precursor without inventing semantics later.
- The term "intent" avoids prematurely claiming durable logs, auditability, replay, or sync.
- The domain preserves opaque references and blocks obvious sensitive fragments.
- No runtime infrastructure is introduced.

Trade-offs:

- The opaque value validation is intentionally conservative and may reject some technically opaque strings if they contain forbidden fragments.
- The domain does not solve ordering, persistence, sync, replay, or audit.
- A future slice must decide whether mutation intent records need a result type, collection boundary, persistence readiness policy, or storage adapter contract.

## Next Technical Target

After Slice 40 is locked, choose exactly one Slice 41 target.

Recommended default:

Local Document Mutation Intent Result Boundary

Reason:

Before persistence or storage, KOr should decide how mutation-intent creation failures or acceptance are represented without logging sensitive details.

Alternative:

Local Persistence Readiness Decision

Reason:

If mutation intent feels sufficient for now, define readiness gates before any SQLite, WatermelonDB, filesystem, or Supabase-related work begins.
