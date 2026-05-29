# ADR 0039: Source Boundary Contract Timeout Stabilization

## Status

Accepted.

## Date

2026-05-29

## Context

The source boundary scan script contract validates scripts/check-source-boundary.ps1.

The script test suite repeatedly spawns PowerShell subprocesses. On Windows, PowerShell process startup can be slow enough that the full Vitest suite may approach or exceed the default 5000 ms test timeout.

Before Slice 39, the source-boundary contract passed most runs, but it had shown timeout risk during full-suite execution.

The script behavior itself was correct:

- it accepted SourcePath, RequiredToken, and ForbiddenToken inputs
- it reported MISSING_REQUIRED for missing required tokens
- it reported FOUND_FORBIDDEN for forbidden tokens
- it failed closed for unreadable source paths
- it stayed free from runtime infrastructure, cloud, sync, AI, OCR, UI, and clinical metadata assumptions

The instability was in test timing, not script behavior.

## Decision

Modify only:

scripts/__tests__/checkSourceBoundary.contract.test.ts

Do not modify:

scripts/check-source-boundary.ps1
package.json
src/
mobile/
docs/project-kor/PROJECT_STATE.md
runtime code
application code
domain code
infrastructure code

Slice 39 adds an explicit timeout budget constant:

POWERSHELL_BOUNDARY_SCAN_TEST_TIMEOUT_MS = 15_000

That timeout is applied only to the five tests that spawn PowerShell through runBoundaryScan.

The timeout is not applied to pure source-inspection tests.

## Timeout Scope Rule

Only tests that invoke runBoundaryScan may use POWERSHELL_BOUNDARY_SCAN_TEST_TIMEOUT_MS.

The following tests receive the timeout budget:

- exits successfully with no output when required tokens exist and forbidden tokens are absent
- prints MISSING_REQUIRED and exits non-zero when required tokens are absent
- prints FOUND_FORBIDDEN and exits non-zero when forbidden tokens are present
- can report required and forbidden failures in the same run
- fails closed when SourcePath is missing or unreadable

The following tests do not receive the timeout budget:

- declares an explicit timeout budget for PowerShell-spawning boundary scan tests
- exists as a PowerShell validation script without modifying package scripts
- keeps the script free from runtime infrastructure, cloud, sync, AI, OCR, UI, and clinical metadata assumptions

## Guardrails

The test contract now verifies:

- the timeout constant exists
- the timeout marker appears exactly five times
- the five PowerShell-spawning tests are named explicitly
- concurrent test execution is not introduced
- global timeout mutation is not introduced
- package scripts are not changed
- the PowerShell script remains free from runtime infrastructure assumptions

The contract forbids:

- it.concurrent
- describe.concurrent
- setTimeout
- vi.setConfig
- vitest.setTimeout
- package script changes
- modifying scripts/check-source-boundary.ps1 as part of this slice

## Scope

This slice is a tooling-stability slice.

It does not introduce:

- Supabase
- SQLite
- WatermelonDB
- filesystem storage
- sync
- OCR
- AI
- UI
- telemetry
- analytics
- audit receipts
- mutation logs
- clinical metadata
- package script changes

It does not change product behavior.

It does not change validation semantics.

It does not alter the source boundary scan script.

## Test Coverage

Slice 39 increases the suite to:

- 37 test files
- 512 passing tests

The source boundary contract now contains 8 tests.

New coverage verifies that timeout stabilization remains narrow and explicit.

## Consequences

Positive consequences:

- PowerShell-spawning boundary tests are less likely to fail from Windows process startup slowness.
- The timeout budget is explicit and reviewable.
- The script behavior remains unchanged.
- The package test command remains unchanged.
- Future slices are less likely to be blocked by timing noise in this tooling contract.

Trade-offs:

- The source-boundary test file can still take several seconds because it intentionally launches PowerShell multiple times.
- This slice does not optimize subprocess count.
- A future tooling-performance slice may be justified if the suite becomes too slow.

## Next Technical Target

After Slice 39 is locked, choose exactly one Slice 40 target.

Recommended default:

Local Document Mutation Log Domain

Reason:

A mutation-log domain can prepare future persistence and sync without introducing storage, SQLite, WatermelonDB, Supabase, filesystem storage, cloud upload, telemetry, analytics, audit receipts, or sync behavior.

Alternative:

Local Persistence Readiness Decision

Reason:

If mutation-log design risks implying persistence too early, define readiness gates before any WatermelonDB, SQLite, or filesystem work begins.
