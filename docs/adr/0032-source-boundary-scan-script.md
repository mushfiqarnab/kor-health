# ADR 0032: Source Boundary Scan Script

## Status

Accepted.

## Date

2026-05-21

## Context

Project KOr uses strict Phase 5 validation for every slice.

Many recent slices required manual source-boundary scans to prove that a file did not import or reference forbidden infrastructure, cloud, sync, AI, OCR, UI, clinical metadata, audit receipt, log-safe, or storage concerns.

Manual scans are useful but repetitive. They increase typo risk and slow validation.

Slice 32 introduces a small PowerShell validation script that standardizes source-boundary checks without changing runtime behavior.

This script is tooling only. It is not product logic, application logic, domain logic, infrastructure logic, sync logic, cloud logic, storage logic, UI logic, AI logic, OCR logic, or cryptographic logic.

## Decision

Create:

scripts/check-source-boundary.ps1

Create a contract test:

scripts/__tests__/checkSourceBoundary.contract.test.ts

The script accepts:

- SourcePath
- RequiredToken
- ForbiddenToken

The script behavior is:

1. Read exactly one source file.
2. Print `SOURCE_UNREADABLE: <path>` and exit non-zero if the source file is missing or unreadable.
3. Print `MISSING_REQUIRED: <token>` for required tokens that are absent.
4. Print `FOUND_FORBIDDEN: <token>` for forbidden tokens that are present.
5. Exit non-zero if any violation is found.
6. Exit zero with no output when all required tokens exist and all forbidden tokens are absent.

## Scope

This slice adds only:

- scripts/check-source-boundary.ps1
- scripts/__tests__/checkSourceBoundary.contract.test.ts

This slice does not modify:

- package.json
- src/
- mobile/
- application source
- domain source
- infrastructure source
- docs/project-kor/PROJECT_STATE.md
- runtime behavior
- build scripts
- Expo configuration
- persistence
- sync
- cloud
- UI
- OCR
- AI
- cryptography

## Boundary Rules

The script may:

- read one file using Get-Content
- test whether one file path exists
- write validation findings to stdout
- exit zero or non-zero

The script must not:

- write files
- append files
- delete files
- create files
- copy files
- move files
- call network commands
- install packages
- run Git commands
- launch child processes
- assume Supabase
- assume WatermelonDB
- assume SQLite
- assume Expo runtime
- assume React Native runtime
- assume AI providers
- assume OCR
- assume BM&DC
- assume clinical metadata

## Design Rationale

The script keeps Phase 5 validation strict while reducing repeated hand-written scan blocks.

It does not replace human architecture review.

It does not replace ADRs.

It does not replace tests.

It does not decide which tokens are required or forbidden. Each slice still owns its own boundary rule set.

This keeps the tool small and prevents it from becoming a second architecture constitution.

## Test Coverage

Slice 32 increases the suite to:

- 33 test files
- 481 passing tests

New tests verify:

- the script exists
- package.json scripts remain unchanged
- safe files pass with no output
- missing required tokens produce MISSING_REQUIRED
- forbidden tokens produce FOUND_FORBIDDEN
- mixed violations report both missing and forbidden findings
- unreadable source files fail closed
- the script source does not contain runtime infrastructure, cloud, sync, AI, OCR, UI, clinical metadata, network, file-write, file-delete, file-copy, file-move, or package-install assumptions

## Consequences

Positive consequences:

- Future Phase 5 scans become more consistent.
- Boundary validation becomes less typo-prone.
- The repo gains reusable validation tooling.
- No runtime behavior changes.
- No package script changes.
- No infrastructure is introduced.

Trade-offs:

- The script is intentionally simple and token-based.
- It can produce false positives or false negatives if a slice chooses poor tokens.
- Human review remains mandatory.
- The script must not be treated as full static analysis.

## Next Technical Target

After Slice 32 is locked, choose exactly one Slice 33 target.

Current reasonable candidates:

- Local Document Repository Error Classification Decision
- Local Document Mutation Log Domain
- Local Persistence Readiness Decision
- Project KOr Architecture Laws Documentation

The next selected slice must preserve all KOr laws and must not introduce Supabase, WatermelonDB, SQLite, filesystem storage, sync, OCR, AI, UI, BM&DC verification, payments, audit receipts, cloud-safe receipts, notification payloads, or readable clinical metadata before their gates.
