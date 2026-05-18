# ADR 0012: Unlock Session State Machine

## Status

Accepted.

## Date

2026-05-18

## Context

Slices 8 through 11 established the cryptographic and mobile runtime foundation for KOr Health.

Slice 8 integrated sealed root key envelopes into local vault assembly.

Slice 9 created the secure local unlock material boundary.

Slice 10 created the Expo-shaped SecureStore driver boundary.

Slice 11 created the mobile runtime composition boundary.

Slice 12 defines the application-layer unlock session state machine that coordinates safe unlock lifecycle decisions without storing secrets or performing infrastructure work.

## Decision

Create a pure application-layer unlock session reducer under:

src/application/unlock-session

The state machine consumes already-sanitized readiness and unlock results:

- MobileSecurityReadinessResult
- LocalUnlockLoadResult

It emits safe session states and helper decisions.

## Scope

This slice implements:

- unlock session statuses
- unlock session events
- pure reducer transitions
- safe retry rules
- recovery-required mapping
- vault-read guard
- background-sync guard
- unlock-attempt guard
- explicit secret-leak assertion
- contract tests

This slice does not implement:

- Expo
- SecureStore calls
- SQLite
- WatermelonDB
- Supabase
- Shamir
- recovery workflow
- vault opening
- root-key unsealing
- UI
- doctor portal
- patient portal
- AI
- background sync implementation

## State Model

The state machine supports these statuses:

- booting
- runtime_unavailable
- locked_ready
- unlocking
- unlocked
- locked_missing
- locked_cancelled
- locked_unavailable
- locked_malformed
- locked_auth_changed
- relocking
- relocked
- recovery_required

The state object contains only:

- status
- revision
- lastTransitionReason

It must not contain raw key material, serialized unlock values, sealed envelopes, native errors, medical records, or patient data.

## Transition Rules

Runtime readiness:

- ready becomes locked_ready
- secure_store_unavailable becomes runtime_unavailable
- local_auth_hardware_unavailable becomes runtime_unavailable
- local_auth_not_enrolled becomes runtime_unavailable
- runtime_unavailable remains runtime_unavailable

Unlock request:

- locked_ready becomes unlocking
- other states ignore unlock_requested

Unlock result:

- unlocked becomes unlocked
- locked_cancelled becomes locked_cancelled
- locked_unavailable becomes locked_unavailable
- locked_missing becomes recovery_required
- locked_malformed becomes recovery_required
- locked_auth_changed becomes recovery_required

Retry behavior:

- locked_cancelled may reset to locked_ready
- locked_unavailable may reset to locked_ready
- relocked may reset to locked_ready
- recovery_required may not reset to locked_ready

Relock behavior:

- unlocked becomes relocking
- relocking becomes relocked

## Recovery Mapping

The following states route to recovery_required:

- locked_missing
- locked_malformed
- locked_auth_changed

The system must never regenerate K_local_unlock when local unlock material is missing, malformed, or invalidated by authentication changes.

## Access Guards

canReadVault returns true only when status is:

- unlocked

canRunBackgroundSync returns true only when status is:

- unlocked

canAttemptUnlock returns true only when status is:

- locked_ready
- locked_cancelled
- locked_unavailable
- relocked

requiresRecovery returns true only when status is:

- recovery_required

## Security Properties

The state machine is a lifecycle controller, not a key container.

It must never store:

- K_local_unlock
- K_root
- K_master
- K_recovery_wrap
- rawKeyBytes
- local-unlock-v1 serialized values
- sealed key envelopes
- clinical data
- prescriptions
- diagnoses
- native error objects

## Test Coverage

Slice 12 increases the suite to:

- 13 test files
- 202 passing tests

New tests verify:

- booting initial state
- runtime readiness transitions
- unlock request transitions
- successful unlock transition
- retryable cancellation
- retryable local unavailability
- missing unlock material recovery mapping
- malformed unlock material recovery mapping
- authentication-changed recovery mapping
- recovery_required cannot reset to locked_ready
- relock flow
- vault-read guard
- background-sync guard
- unlock-attempt guard
- recovery guard
- secret-leak assertion
- forbidden dependency exclusion

## Consequences

Positive consequences:

- All future UI, sync, portal, and vault workflows can rely on one canonical session state.
- Background sync is explicitly blocked unless the session is unlocked.
- Recovery-required conditions cannot be dismissed into normal unlock.
- The state machine remains testable without mobile runtime, database, cloud, or UI.
- Secret material never enters session state.

Trade-offs:

- This slice does not open the vault.
- This slice does not wipe active vault material.
- This slice does not implement recovery.
- Future slices must connect this state machine to real unlock workflows.

## Next Technical Target

The next target is Slice 13: Consent Grant Domain.

That slice should define how a patient grants scoped, time-limited access to doctors or caregivers before any doctor portal or AI summarization work begins.
