# ADR 0042: Local Document Mutation Intent Creation Policy

## Status

Accepted.

## Date

2026-06-02

## Context

Slice 40 introduced LocalDocumentMutationIntent as a pure domain value for describing an opaque local document mutation intent.

Slice 41 introduced LocalDocumentMutationIntentResult as a narrow accepted or rejected result boundary.

Project KOr now needs a pure domain policy that maps raw caller-provided input into those accepted or rejected results without leaking raw validation details, unsafe opaque values, messages, stack traces, causes, filenames, patient identifiers, clinical labels, storage details, sync details, audit details, or cloud details.

Without this policy, future application code could duplicate validation decisions and invent unsafe result shapes before persistence, storage, sync, audit, telemetry, analytics, or UI boundaries exist.

## Decision

Introduce a pure domain module:

src/domain/local-document-mutation-intent/localDocumentMutationIntentCreationPolicy.ts

Introduce its contract test:

src/domain/local-document-mutation-intent/__tests__/localDocumentMutationIntentCreationPolicy.contract.test.ts

The creation policy exports:

createLocalDocumentMutationIntentFromInput

The policy accepts raw caller-provided input and returns LocalDocumentMutationIntentResult.

For valid input, it returns an accepted result containing a validated LocalDocumentMutationIntent and caller-provided acceptedAtEpochMs.

For invalid input, it returns a rejected result with exactly one approved rejection reason.

Approved rejection reasons remain:

- invalid_intent
- unsafe_opaque_value
- unsupported_operation
- invalid_timestamp

## Scope

This slice modifies only:

- src/domain/local-document-mutation-intent/localDocumentMutationIntentCreationPolicy.ts
- src/domain/local-document-mutation-intent/__tests__/localDocumentMutationIntentCreationPolicy.contract.test.ts
- docs/adr/0042-local-document-mutation-intent-creation-policy.md

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
- generated identifiers
- generated timestamps
- clinical metadata
- filenames
- file paths
- storage paths
- patient identifiers
- doctor identifiers
- BM&DC identifiers

## Policy Rules

The creation policy is pure domain logic.

It may:

- check that input is an object
- check required raw fields
- check supported mutation operation
- check caller-provided epoch timestamps
- create a LocalDocumentMutationIntent using the existing domain constructor
- validate the created intent with the existing type guard
- return an accepted LocalDocumentMutationIntentResult
- return a rejected LocalDocumentMutationIntentResult

It must not:

- persist
- enqueue
- replay
- synchronize
- upload
- download
- encrypt
- decrypt
- display
- log
- notify
- audit
- generate timestamps
- generate identifiers
- use randomness
- throw raw errors
- return messages
- return stacks
- return causes
- inspect clinical content
- accept filenames or file paths as domain fields

## Rejection Mapping

Malformed input maps to:

invalid_intent

Unsafe opaque values map to:

unsafe_opaque_value

Unsupported operation maps to:

unsupported_operation

Invalid createdAtEpochMs or acceptedAtEpochMs maps to:

invalid_timestamp

The policy must not expose the rejected input value in its result.

The policy must not create database, storage, sync, audit, cloud, patient, doctor, clinical, filename, path, message, or stack-shaped rejection reasons.

## Security and Privacy Rules

The policy must not expose:

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
- storage errors
- sync errors
- audit errors
- cloud errors
- telemetry details
- analytics details
- stack traces
- exception messages
- causes

The policy is not log-safe, audit-safe, sync-safe, cloud-safe, analytics-safe, telemetry-safe, notification-safe, or display-safe.

## Test Coverage

The contract verifies that the creation policy:

- accepts valid raw input as a frozen accepted mutation intent result
- rejects malformed input as invalid_intent without raw error details
- rejects unsafe opaque values without exposing unsafe values
- rejects unsupported operation without creating sync, audit, storage, or clinical error reasons
- rejects invalid created or accepted timestamps without generating timestamps
- remains free from persistence, sync, audit, logging, display, cloud, AI, OCR, telemetry, analytics, and clinical metadata

Slice 42 increases the suite to:

- 40 test files
- 528 passing tests

## Consequences

Positive consequences:

- Future application code can request mutation-intent creation through one policy instead of duplicating validation decisions.
- Raw input is mapped into narrow, non-sensitive accepted or rejected results.
- The mutation-intent foundation now has value, result, and creation-policy boundaries.
- Future persistence and sync work will have clearer domain laws to obey.

Trade-offs:

- The policy intentionally returns broad rejection reasons rather than detailed validation diagnostics.
- The policy does not persist or queue accepted intents.
- The policy does not produce user-facing messages.
- Future slices must still define collection boundaries, persistence readiness, storage contracts, sync contracts, and audit domains separately.

## Next Technical Target

After Slice 42 is locked, choose exactly one Slice 43 target.

Recommended default:

Local Document Mutation Intent Collection Boundary

Reason:

A collection boundary can define how multiple accepted mutation intents are grouped or ordered in memory without persistence, queues, replay, sync, storage, or audit behavior.

Alternative:

Project KOr State Ledger Update

Reason:

PROJECT_STATE.md now lags behind the locked repo by several slices. A dedicated ledger update slice may be useful before moving deeper toward persistence foundations.
