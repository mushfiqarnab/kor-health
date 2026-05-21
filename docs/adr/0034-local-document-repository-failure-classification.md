# ADR 0034: Local Document Repository Failure Classification

## Status

Accepted.

## Date

2026-05-22

## Context

The local document save path now has a repository port, an in-memory repository adapter, a save use case, preflight validation, a completed result type, a completed-versus-rejected outcome boundary, and an outcome-producing wrapper.

Before Slice 34, repository write failures were propagated directly by the save use case.

That behavior remains correct. Repository failures are not preflight rejections, and they must not be converted into safe rejected outcomes.

However, before durable persistence, mutation logs, retry logic, transaction boundaries, or sync behavior are introduced, the application layer needs a small internal classification boundary for repository failures.

The boundary must identify the safe failure phase without serializing or inspecting thrown error details.

## Decision

Create:

src/application/local-document-save/localDocumentRepositoryFailureClassification.ts

Create contract tests:

src/application/local-document-save/__tests__/localDocumentRepositoryFailureClassification.contract.test.ts

The classifier exposes:

- LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND
- LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE
- LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE
- LOCAL_DOCUMENT_REPOSITORY_FAILURE_UNKNOWN_PHASE
- classifyLocalDocumentRepositoryFailure
- LocalDocumentRepositoryFailureClassification
- LocalDocumentRepositoryFailurePhase
- ClassifyLocalDocumentRepositoryFailureInput

The classifier accepts:

- phase: unknown
- cause: unknown

The classifier returns a frozen object:

- kind: local_document_repository_failure
- phase: one approved repository failure phase

The classifier ignores cause.

The classifier sanitizes unapproved phase values to:

- unknown_repository_failure

## Approved Failure Phases

The only approved phases are:

- local_encrypted_document_payload_save
- clinical_document_reference_save
- unknown_repository_failure

## Cause Handling Rule

The classifier must not inspect, serialize, stringify, log, or expose thrown causes.

It must not read:

- error message
- stack trace
- cause fields
- object keys
- object values
- object entries
- nested properties
- patient IDs
- reference IDs
- resource IDs
- payload IDs
- encrypted payload refs
- ciphertext refs
- encryption envelope refs
- filenames
- file paths
- storage paths
- storage URLs
- MIME types
- clinical labels
- adapter details
- database details
- cloud provider details

The input cause exists only so future callers can pass a thrown value without the classifier leaking it.

## Scope

This slice adds only:

- local repository failure classification
- tests proving classification is safe, frozen, and minimal

This slice does not modify:

- saveLocalDocumentReferences
- saveLocalDocumentReferencesWithOutcome
- LocalDocumentRepositoryPort
- in-memory local document repository adapter
- local document save preflight decision
- local document save result
- local document save outcome
- project state ledger
- package scripts
- source boundary scan script

This slice does not introduce:

- catching repository errors
- retry logic
- rollback
- transactions
- mutation logs
- idempotency keys
- durable persistence
- WatermelonDB
- SQLite
- filesystem storage
- Supabase
- sync
- OCR
- AI
- UI
- audit receipts
- log-safe receipts
- display-safe receipts
- cloud-safe receipts
- notification payloads
- telemetry
- analytics
- clinical metadata

## Boundary Rules

The classifier module must not import anything.

It must not depend on:

- repository ports
- save use cases
- preflight logic
- outcome types
- result types
- domain factories
- active-state helpers
- infrastructure adapters
- storage systems
- cloud systems
- sync systems
- crypto adapters
- AI systems
- OCR systems
- UI systems
- audit systems
- telemetry systems
- analytics systems

It must not inspect clinical content or semantic metadata.

## Design Rationale

Repository failures are different from preflight rejections.

Preflight rejection means the requested save is not eligible based on safe, approved validation law.

Repository failure means an attempted save operation failed.

Those failures may contain sensitive information in thrown messages or adapter-specific error objects.

Therefore, Slice 34 creates a small classifier that records only the safe failure phase and ignores the thrown cause.

This prepares the architecture for later durable persistence and failure handling without changing current save behavior.

## Test Coverage

Slice 34 increases the suite to:

- 34 test files
- 489 passing tests

New tests verify:

- payload-save failures classify as local_encrypted_document_payload_save
- reference-save failures classify as clinical_document_reference_save
- unknown phase strings sanitize to unknown_repository_failure
- non-Error thrown values are accepted without inspection or serialization
- classifications expose only kind and phase
- classifications are frozen
- classifications do not expose sensitive identifiers, file paths, storage paths, clinical labels, adapter details, database details, cloud details, messages, stacks, causes, or debug data
- repository failures remain separate from preflight rejections and completed save outcomes
- classifier does not mutate thrown cause objects
- only approved phases are exposed
- classifier source remains free from imports, repository ports, save use cases, preflight logic, infrastructure, storage, cloud, sync, audit, crypto adapter, AI, OCR, UI, and readable metadata concerns

## Consequences

Positive consequences:

- Repository failure phases can now be represented safely.
- Thrown causes are not leaked through classification output.
- Preflight rejections remain separate from repository failures.
- Save use case behavior remains unchanged.
- The architecture gains a small seam for future durable persistence error handling.

Trade-offs:

- The classifier does not catch errors yet.
- The classifier does not retry, roll back, or persist failure state.
- The classifier does not provide user-facing error messages.
- The classifier does not produce audit-safe, log-safe, sync-safe, cloud-safe, display-safe, or notification-safe receipts.
- Human review remains required before any future caller uses classifications in logs, UI, sync, audit, or cloud behavior.

## Next Technical Target

After Slice 34 is locked, choose exactly one Slice 35 target.

Recommended next target:

Local Document Save Repository Failure Classification Integration

Reason:

The classifier exists, but the save use case and outcome wrapper do not yet use it. The next safe slice can decide whether and where repository failures should be classified without converting them into preflight rejected outcomes or swallowing thrown failures.

Slice 35 must not introduce Supabase, WatermelonDB, SQLite, filesystem storage, sync, OCR, AI, UI, BM&DC verification, payments, audit receipts, cloud-safe receipts, notification payloads, telemetry, analytics, or readable clinical metadata before their gates.
