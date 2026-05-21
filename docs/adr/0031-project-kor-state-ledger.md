# ADR 0031: Project KOr State Ledger

## Status

Accepted.

## Date

2026-05-21

## Context

Project KOr has reached Slice 30 with a growing set of locked domain, application, infrastructure, and documentation decisions.

The repository now contains ADRs 0001 through 0030 and 31 passing test files with 468 tests.

The project has also accumulated important locked state that was previously carried mostly through chat context:

- latest locked commit
- locked slice range
- current test state
- active architecture laws
- implemented foundations
- explicitly unavailable infrastructure
- forbidden premature work
- next candidate slices

Because Project KOr is a patient-sovereign, zero-knowledge, offline-first HealthTech platform, state drift is dangerous. The platform must not rely on chat memory to remember what is implemented, what is forbidden, or what the next safe slice may be.

Slice 31 adds a repository-backed state ledger.

## Decision

Create:

docs/project-kor/PROJECT_STATE.md

Create a documentation contract test under:

docs/project-kor/__tests__/projectState.contract.test.ts

The state ledger records:

- Branch: main
- Locked slices: Slice 8 through Slice 30
- Latest locked commit: a7926c1 feat: add local document save outcome wrapper
- Current test state: 31 test files, 468 tests
- Working tree: clean
- Remote: up to date with origin/main
- Latest ADR: docs/adr/0030-local-document-save-outcome-wrapper.md
- permanent product laws
- security laws
- architecture constraints
- slice workflow law
- built foundations through Slice 30
- current local document save architecture
- built access and sharing chain
- not implemented areas
- forbidden premature work
- candidate Slice 32 options
- state ledger update rules
- current stop rules

## Scope

This slice implements documentation only.

This slice adds:

- docs/project-kor/PROJECT_STATE.md
- docs/project-kor/__tests__/projectState.contract.test.ts

This slice does not modify:

- src/
- mobile/
- application source
- domain source
- infrastructure source
- production runtime behavior
- repository ports
- adapters
- cryptography
- persistence
- sync
- UI
- OCR
- AI
- Supabase
- WatermelonDB
- SQLite
- filesystem storage

## State Ledger Rule

PROJECT_STATE.md is a cockpit dashboard.

It is not a replacement for:

- architecture dossier
- ADRs
- tests
- source code
- security review
- slice gates

It must not claim future infrastructure is implemented.

It must not weaken architecture laws.

It must not describe internal output objects as safe for logs, analytics, UI display, notifications, cloud metadata, sync payloads, or audit receipts.

It must be updated only through a dedicated slice or when a later slice explicitly changes locked state.

## Documentation Contract

The documentation contract verifies that PROJECT_STATE.md records:

- current locked repository state
- permanent product laws
- security laws
- built foundations through Slice 30
- absence of false implementation claims
- forbidden premature work
- candidate Slice 32 options
- concise operational length
- absence of placeholder architecture language

## Design Rationale

Project KOr is now large enough that chat memory alone is not an acceptable state ledger.

The repository must carry its own current state so future slices can start from Git-backed evidence instead of conversational memory.

This improves continuity without introducing new runtime infrastructure.

The slice remains documentation-only because the purpose is state capture, not behavior change.

## Test Coverage

Slice 31 increases the suite to:

- 32 test files
- 474 passing tests

New tests verify:

- PROJECT_STATE.md exists
- current locked state is recorded
- product laws are recorded
- security laws are recorded
- built foundations are recorded
- unavailable infrastructure is not falsely claimed
- forbidden premature work is recorded
- candidate Slice 32 options are listed without being active or implemented
- state ledger avoids placeholder architecture language
- state ledger remains concise and operational

## Consequences

Positive consequences:

- Current Project KOr state now lives in Git.
- Future slices can start from a repo-backed dashboard.
- Prompt repetition can decrease without weakening gates.
- Architecture drift becomes easier to detect.
- Documentation-only slices can still be contract-tested.

Trade-offs:

- PROJECT_STATE.md must be maintained as locked state changes.
- The state ledger can become stale if future slices skip update discipline.
- The state ledger does not replace ADRs or source-level validation.

## Next Technical Target

After Slice 31 is locked, exactly one Slice 32 candidate may be selected.

Current candidates:

- Source Boundary Scan Script
- Local Document Repository Error Classification Decision
- Local Document Mutation Log Domain
- Local Persistence Readiness Decision

The next selected slice must preserve all KOr laws and must not introduce Supabase, WatermelonDB, SQLite, filesystem storage, sync, OCR, AI, UI, BM&DC verification, payments, audit receipts, cloud-safe receipts, notification payloads, or readable clinical metadata before their gates.
