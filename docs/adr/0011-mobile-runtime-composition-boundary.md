# ADR 0011: Mobile Runtime Composition Boundary

## Status

Accepted.

## Date

2026-05-18

## Context

Slice 10 created an Expo-shaped SecureStore driver boundary without importing real Expo packages. It allowed the system to inject a SecureStore-compatible module into the secure local secret driver.

Slice 11 creates the mobile runtime composition boundary. This boundary wires injected Expo-shaped SecureStore and LocalAuthentication modules into clean application-facing interfaces.

This slice does not install or import real Expo packages. It does not create UI, open the vault, start sync, call recovery, or introduce persistence.

## Decision

Create a mobile bootstrap boundary under:

src/mobile/bootstrap

This boundary exposes two safe runtime capabilities:

1. secureLocalSecretDriver
2. checkSecurityReadiness

The runtime is created through:

createMobileRuntime(...)

The readiness checker is implemented through:

checkMobileSecurityReadiness(...)

## Scope

This slice implements:

- injected SecureStore-shaped module support
- injected LocalAuthentication-shaped module support
- mobile security readiness checks
- mobile runtime composition root
- safe runtime object exposure
- default authentication prompt
- default keychain service
- mocked test contracts

This slice does not implement:

- real expo-secure-store import
- real expo-local-authentication import
- Expo package installation
- SQLite
- WatermelonDB
- Supabase
- Shamir
- recovery workflow
- vault opening
- background sync
- React UI
- password KDF
- device-tamper detection
- app attestation
- legal-compliance claim

## Readiness Model

Mobile readiness checks only runtime capability.

The readiness model is:

Ready = SecureStoreAvailable AND LocalAuthHardwarePresent AND LocalAuthEnrolled

Returned states:

- ready
- secure_store_unavailable
- local_auth_hardware_unavailable
- local_auth_not_enrolled
- runtime_unavailable

Unexpected native failures are mapped to runtime_unavailable.

The readiness checker does not inspect supported authentication types.

The readiness checker does not evaluate root, jailbreak, tamper, app integrity, or device integrity.

## Runtime Composition

The runtime object contains:

- secureLocalSecretDriver
- checkSecurityReadiness

The runtime object does not expose:

- raw SecureStore module
- raw LocalAuthentication module
- native errors
- stored local-unlock-v1 values
- K_local_unlock
- K_root
- K_recovery_wrap

## Dependency Boundary

The mobile bootstrap boundary may depend on:

- Slice 10 Expo-shaped SecureStore driver factory
- Slice 11 readiness checker

It must not import:

- expo-secure-store
- expo-local-authentication
- SQLite
- WatermelonDB
- Supabase
- Shamir
- recovery modules
- vault assembly modules
- background sync modules
- React UI modules

## Defaults

Default authentication prompt:

Unlock your health vault

Default keychain service:

kor.v1.local-unlock

These defaults match the secure local unlock driver boundary.

## Security Properties

The composition root keeps native runtime dependencies at the edge.

Application policy, vault assembly, keyring storage, local unlock policy, and future sync modules remain unaware of Expo runtime modules.

This prevents biometric prompts from leaking into background jobs, domain policy, vault assembly, or UI state.

## Test Coverage

Slice 11 increases the suite to:

- 12 test files
- 175 passing tests

New tests verify:

- ready readiness state
- SecureStore unavailable state
- local authentication hardware unavailable state
- local authentication not enrolled state
- runtime unavailable state
- no enrollment check when hardware check fails
- native module instances are not exposed in readiness results
- forbidden dependency imports are absent
- mobile runtime object is frozen
- default authentication prompt and keychain service are used
- explicit authentication prompt and keychain service overrides are allowed
- secure local secret driver stores through injected SecureStore module
- readiness uses injected SecureStore and LocalAuthentication modules
- runtime object does not expose raw native modules or stored values

## Consequences

Positive consequences:

- Mobile runtime wiring is now testable without Expo runtime.
- Native modules remain isolated at the composition edge.
- Readiness checks are explicit and safe.
- The app can later install real Expo packages without changing application policy.
- Background sync and vault assembly cannot accidentally trigger biometric prompts through this slice.

Trade-offs:

- This slice still does not use real Expo packages.
- Real device behavior must be verified later in the Expo mobile shell.
- Device integrity, app attestation, root detection, and jailbreak detection remain out of scope.
- UI state management remains out of scope.

## Next Technical Target

The next target is Slice 12: Unlock Session State Machine.

That slice should define one canonical application state machine for locked, unlocking, unlocked, relocking, unavailable, malformed, cancelled, and recovery-required states.

This state machine must sit above the secure local secret driver and below any future UI or sync workflow.
