# ADR 0010: Expo SecureStore Adapter Boundary

## Status

Accepted.

## Date

2026-05-18

## Context

Slice 9 introduced the Secure Local Unlock Material Boundary. It defined the SecureLocalSecretDriver port and modeled local unlock states without importing Expo SecureStore directly.

Slice 10 adds an Expo-shaped SecureStore adapter for that port.

This slice does not install or import expo-secure-store directly. Instead, it accepts an injected SecureStore-like module so the adapter can be tested in Vitest without a native Expo runtime.

## Decision

Create an infrastructure adapter:

src/infrastructure/local-unlock/expoSecureLocalSecretDriver.ts

The adapter implements SecureLocalSecretDriver using an injected SecureStore-compatible module with:

- isAvailableAsync
- setItemAsync
- getItemAsync
- deleteItemAsync

The adapter uses a stable keychainService and authentication-gated storage and retrieval for K_local_unlock material.

## Scope

This slice implements:

- mocked Expo-shaped SecureStore driver contract
- injected SecureStore module interface
- stable keychainService option handling
- authentication-gated setItem behavior
- authentication-gated getItem behavior
- non-authenticated deleteItem behavior
- SecureStore availability checks before set, get, and delete
- typed driver error mapping
- native error sanitization
- null return preservation

This slice does not implement:

- real expo-secure-store import
- package installation
- SQLite
- WatermelonDB
- Supabase
- Shamir recovery
- recovery workflow
- password KDFs
- vault assembly
- background sync
- UI prompts

## Adapter Options

The adapter uses:

- keychainService: kor.v1.local-unlock
- authenticationPrompt: Unlock your health vault

For setItemAsync:

- requireAuthentication: true
- authenticationPrompt included
- stable keychainService included

For getItemAsync:

- requireAuthentication: true
- authenticationPrompt included
- stable keychainService included

For deleteItemAsync:

- requireAuthentication: false
- stable keychainService included

## Rationale

K_local_unlock must not be stored as an ordinary app preference.

It must be protected behind the local secure secret boundary and released only after an explicit unlock path.

Storing and reading with requireAuthentication strengthens the local unlock gate and supports platform invalidation behavior when biometric material changes.

Delete does not return secret material, so it can remain unauthenticated in this boundary.

## Error Mapping

The adapter throws only SecureLocalSecretDriverError.

Mapped error states:

- SecureStore unavailable becomes unavailable
- cancellation-like native failures become authentication_cancelled
- biometric or key invalidation failures become authentication_changed
- unknown native failures become unknown

Raw native error messages must not propagate upward.

## Null Handling

If SecureStore returns null, the adapter returns null unchanged.

The higher secure local unlock store maps null to locked_missing.

The adapter does not regenerate K_local_unlock.

## Security Properties

The adapter must not expose:

- raw native stack traces
- local-unlock-v1 values
- native error messages containing secret material
- K_root
- K_master
- K_local_unlock
- K_recovery_wrap

The adapter must not import:

- expo-secure-store
- SQLite
- WatermelonDB
- Supabase
- Shamir
- recovery modules
- vault assembly modules

## Test Coverage

Slice 10 increases the suite to:

- 10 test files
- 154 passing tests

New tests verify:

- availability checks before set, get, and delete
- authentication-gated set options
- authentication-gated get options
- stable delete options
- null passthrough
- unavailable mapping
- cancellation mapping
- biometric/key invalidation mapping
- unknown error mapping
- native error sanitization
- empty authentication prompt rejection
- empty keychainService rejection
- forbidden dependency exclusion

## Consequences

Positive consequences:

- Expo SecureStore behavior is isolated behind the existing port.
- Application logic remains independent from native Expo runtime.
- Tests remain deterministic under Vitest.
- K_local_unlock handling is stricter than ordinary preference storage.
- Native errors are sanitized before reaching higher layers.

Trade-offs:

- This slice still does not execute real Expo SecureStore.
- Runtime platform behavior must still be validated in the future mobile shell.
- SecureStore null values remain ambiguous between missing and invalidated entries.
- A future slice may add a non-sensitive existence marker if needed.

## Next Technical Target

The next target is the Expo Mobile Runtime Wiring Slice.

That future slice should install expo-secure-store in the Expo app shell and provide a concrete adapter instance using the driver boundary defined here.
