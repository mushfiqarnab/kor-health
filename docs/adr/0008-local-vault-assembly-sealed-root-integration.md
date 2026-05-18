# ADR 0008: Local Vault Assembly Integration with Sealed Root Keys

## Status

Accepted.

## Date

2026-05-18

## Context

Slice 6 introduced the local vault assembly workflow, but it used placeholder descriptors such as:

sealed:root-version:1:scope:ks_01

Those descriptors were intentionally temporary. Slice 7 introduced the AES-GCM sealed key envelope boundary, which can seal raw root key material under explicit wrapping keys with authenticated AAD.

Slice 8 integrates Slice 6 and Slice 7 by replacing placeholder descriptors with real sealed root-key envelopes.

## Decision

The first patient vault assembly now creates:

- one local root_key record sealed under K_local_unlock
- one backup root_key record sealed under K_recovery_wrap
- one payload_encryption record that references the root key
- one blind_index record that references the root key
- one sealed-in 32-byte patient derivation salt inside keyring plaintext

The payload_encryption and blind_index records do not store duplicate sealed copies of K_root_v1. They reference the root record using:

root-ref:root-key-001:v1

This avoids sealed-root duplication and makes future key rotation cleaner.

## Scope

This slice implements:

- sealed root-key integration in local vault assembly
- sealed root-key integration in backup keyring assembly
- sealed-key envelope serialization and deserialization helpers
- keyring record support for root_key records
- keyring record support for materialKind
- keyring record support for rootKeyRef and rootVersion
- sealed-in derivationSalt inside KeyringPlaintextV1
- verification of local and backup sealed root keys
- verification of payload_encryption and blind_index derivation from unsealed K_root_v1 plus derivationSalt
- lifecycle-purpose verification for local_keyring_root and recovery_backup_root
- best-effort cleanup of temporary root, salt, and derived key buffers

This slice does not implement:

- SecureStore
- SQLite
- WatermelonDB
- Supabase
- Argon2
- PBKDF2
- Shamir Secret Sharing
- caregiver access
- emergency card flows
- doctor verification
- audit hash-chaining
- UI

## Keyring Plaintext Shape

The local and backup keyring plaintext now include:

- keyringSchemaVersion
- patientId
- keyringId
- derivationSalt
- records
- rotationState

The derivationSalt uses:

salt-v1:<base64url-encoded-32-byte-salt>

The derivation salt is stored inside the encrypted keyring plaintext. It is not stored in outer plaintext metadata.

## First Vault Record Set

The first vault keyring must contain exactly three records in this order:

1. root_key
2. payload_encryption
3. blind_index

The root_key record uses:

materialKind: sealed_root_key

The dependent records use:

materialKind: root_derived_ref

## Local Root Key

The local keyring root record contains K_root_v1 sealed under K_local_unlock.

Its sealed key envelope must use:

sealPurpose: local_keyring_root

## Backup Root Key

The backup keyring root record contains K_root_v1 sealed under K_recovery_wrap.

Its sealed key envelope must use:

sealPurpose: recovery_backup_root

## Purpose Separation

A local keyring must not accept a recovery-purpose sealed root envelope.

A backup keyring must not accept a local-purpose sealed root envelope.

The workflow verifies sealed root purpose before unsealing raw root material.

## Derivation Salt Requirement

K_root_v1 alone is not enough to restore deterministic derived keys.

The workflow requires:

- K_root_v1
- derivationSalt
- keyScopeId
- keyVersion
- purpose

The keyring must preserve derivationSalt inside the encrypted keyring plaintext so that payload_encryption and blind_index can be re-derived during future vault reopening.

## Metadata Leakage Policy

The following must not appear in local or backup keyring plaintext metadata:

- raw K_root
- raw K_master
- raw K_local_unlock
- raw K_recovery_wrap
- raw payload key
- raw blind-index key
- domain/general
- domain/mental
- mental
- mental-health
- psychiatric
- reproductive
- oncology
- HIV
- diabetes
- NID
- e-TIN
- phone
- email
- DOB

Opaque sealed-key envelopes and derivation salt values are redacted before forbidden-token scanning to avoid random ciphertext false positives.

## Verification

The workflow verifies:

- local keyring opens under K_local_unlock
- backup keyring opens under K_recovery_wrap
- local and backup keyrings share patientId, keyringId, derivationSalt, rotationState, and dependent records
- local root envelope uses local_keyring_root
- backup root envelope uses recovery_backup_root
- local and backup unsealed roots match
- payload_encryption derives to 32 bytes
- blind_index derives to 32 bytes
- payload_encryption and blind_index derived keys differ
- caregiver and emergency records are not created during first vault assembly

## Test Coverage

Slice 8 increased the test suite to:

- 7 test files
- 112 passing tests

The local vault assembly contract now verifies:

- one sealed root record and two dependent derived scope records
- placeholder root descriptors are removed
- derivation salt is stored only inside opened keyring plaintext
- local and backup root envelopes are purpose-bound
- local and backup root keys unseal and match
- payload and blind-index keys re-derive from unsealed root and derivation salt
- local keyring rejects a backup-purpose sealed root envelope
- semantic keyScopeId values are rejected
- transient initialization secrets remain non-enumerable

## Consequences

Positive consequences:

- Slice 6 no longer relies on placeholder sealed material.
- K_root_v1 can now be sealed and later recovered through explicit local and backup paths.
- Derived key records do not duplicate sealed root material.
- Rotation design remains clean.
- The derivation salt needed for deterministic restoration is preserved securely.
- Lifecycle-purpose confusion is blocked.

Trade-offs:

- This slice still does not persist the keyring.
- This slice still exposes transient initialization secrets directly for testable in-memory assembly.
- JavaScript cannot guarantee physical memory zeroization, so cleanup remains best-effort.
- Final SecureStore and recovery-shard lifecycle handling remain future slices.

## Next Technical Target

The next target is Secure Local Unlock Material Boundary.

That future slice should define how K_local_unlock is protected by platform-specific secure storage without introducing SQLite, Supabase, or Shamir recovery prematurely.
