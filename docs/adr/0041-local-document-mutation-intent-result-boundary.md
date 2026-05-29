# ADR 0041: Local Document Mutation Intent Result Boundary

## Status

Accepted.

## Date

2026-05-29

## Context

Slice 40 introduced LocalDocumentMutationIntent as a pure domain value for describing an opaque local document mutation intent.

That value intentionally does not claim durability, persistence, sync, replay, auditability, telemetry, analytics, cloud behavior, UI display, or notification behavior.

Before any future application, persistence, queue, replay, sync, or storage work can consume mutation intents, Project KOr needs a small result boundary that represents whether a mutation intent is accepted or rejected without leaking raw errors or creating display-safe, log-safe, audit-safe, sync-safe, or cloud-safe receipts.

Without this boundary, future code could invent ad hoc result objects containing raw messages, stack traces, storage details, clinical labels, filenames, patient identifiers, or sync/audit terminology.

## Decision

Introduce a pure domain module:

src/domain/local-document-mutation-intent/localDocumentMutationIntentResult.ts

Introduce its contract test:

src/domain/local-document-mutation-intent/__tests__/localDocumentMutationIntentResult.contract.test.ts

The result boundary supports exactly two statuses:

- accepted
- rejected

Accepted results contain:

- kind
- status
- intent
- acceptedAtEpochMs

Rejected results contain:

- kind
- status
- reason

Approved rejection reasons are:

- invalid_intent
- unsafe_opaque_value
- unsupported_operation
- invalid_timestamp

The boundary imports only the existing LocalDocumentMutationIntent type guard and type from the same domain.

## Scope

This slice modifies only:

- src/domain/local-document-mutation-intent/localDocumentMutationIntentResult.ts
- src/domain/local-document-mutation-intent/__tests__/localDocumentMutationIntentResult.contract.test.ts
- docs/adr/0041-local-document-mutation-intent-result-boundary.md

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
- queues
- cloud upload
- cloud metadata
- audit receipts
- telemetry
- analytics
- UI
- notifications
- OCR
- AI
- logs
- raw errors
- clinical metadata
- filenames
- file paths
- storage paths
- patient identifiers
- doctor identifiers
- BM&DC identifiers

## Result Boundary Rules

LocalDocumentMutationIntentResult is an internal domain result.

It is not:

- a durable mutation record
- a mutation log
- a sync event
- a replay command
- an audit receipt
- a telemetry event
- an analytics event
- a UI display model
- a cloud metadata record
- a notification payload
- an error wrapper
- a storage adapter response

Accepted results must contain a validated LocalDocumentMutationIntent and a caller-provided acceptedAtEpochMs.

Rejected results must contain only one approved rejection reason.

The result boundary does not generate timestamps, random identifiers, cryptographic identifiers, messages, stacks, causes, or display text.

The result boundary does not persist, enqueue, replay, upload, download, encrypt, decrypt, display, log, notify, audit, or synchronize.

## Security and Privacy Rules

The boundary must not expose:

- patient identifiers
- doctor identifiers
- BM&DC identifiers
- diagnosis labels
- prescription labels
- OCR text
- AI summaries
- filenames
- file paths
- storage paths
- MIME types
- plaintext markers
- ciphertext markers
- database errors
- sync errors
- audit errors
- storage errors
- cloud errors
- stack traces
- exception messages
- causes

The rejection reason enum is intentionally narrow. It gives future callers enough control flow information without becoming a logging or display surface.

## Test Coverage

The contract verifies that the result boundary:

- creates frozen accepted results for validated mutation intents
- creates frozen rejected results with approved rejection reasons only
- rejects malformed accepted and rejected shapes
- exposes only approved status and rejection reason constants
- remains free from persistence, sync, audit, logging, display, cloud, AI, OCR, telemetry, analytics, and clinical metadata

Slice 41 increases the suite to:

- 39 test files
- 522 passing tests

## Consequences

Positive consequences:

- Future application code can consume mutation intent acceptance or rejection without inventing unsafe result shapes.
- Rejection reasons remain narrow and non-sensitive.
- Accepted results preserve the validated intent without adding persistence or sync meaning.
- The architecture gains another small privacy-safe boundary before persistence work.

Trade-offs:

- This result boundary does not explain why a low-level validator failed beyond approved categories.
- It is not suitable for logs, UI display, audit receipts, sync payloads, or cloud metadata.
- Future slices must still define collection boundaries, readiness checks, or persistence contracts before any storage implementation.

## Next Technical Target

After Slice 41 is locked, choose exactly one Slice 42 target.

Recommended default:

Local Document Mutation Intent Creation Policy

Reason:

A creation policy can map raw creation inputs into accepted or rejected mutation-intent results without exposing sensitive validation details, while remaining pure domain code.

Alternative:

Local Persistence Readiness Decision

Reason:

If mutation intent foundations feel sufficient for now, define readiness gates before any SQLite, WatermelonDB, filesystem, or Supabase-related work begins.
