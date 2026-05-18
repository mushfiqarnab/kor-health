# ADR 0007: Key Sealing and Lifecycle Boundary

## Status

Accepted.

## Date

2026-05-18

## Context

Project KOr uses a zero-knowledge, offline-first architecture for sensitive health data. Previous slices established:

- Medication adherence domain rules
- AES-GCM sealed envelope adapter
- Keyring policy module
- Encrypted keyring storage boundary
- Key Material Factory
- Local Vault Assembly Workflow

Slice 6 used opaque sealed material descriptors such as:

sealed:root-version:1:scope:ks_01

Those descriptors were intentionally honest placeholders. They were not real key wrapping. Slice 7 introduces the cryptographic primitive that can replace those descriptors in a future integration slice.

## Decision

We implemented the Key Sealing and Lifecycle Boundary at:

src/infrastructure/key-sealing/sealedKeyEnvelope.ts

This slice implements AES-GCM sealed key envelopes, not formal AES-KW.

The purpose is to seal raw key material under explicit wrapping keys using authenticated encryption and opaque AAD. The first target is K_root_v1, because future sessions need K_root_v1 to derive payload_encryption and blind_index keys through the Key Material Factory.

## Scope

This slice implements:

- sealing raw root key material
- unsealing raw root key material
- local_keyring_root seal purpose
- recovery_backup_root seal purpose
- opaque AAD binding
- forbidden metadata checks
- generic authentication failure behavior
- best-effort temporary key-copy clearing

This slice does not implement:

- SecureStore
- SQLite
- WatermelonDB
- Supabase
- Argon2
- PBKDF2
- Shamir Secret Sharing
- caregiver grants
- emergency card keys
- doctor envelopes
- audit signing
- UI

## Sealed Key Envelope Shape

A sealed key envelope contains:

- sealedKeyEnvelopeVersion
- cryptoSuite
- patientId
- keyringId
- sealedKeyId
- sealedKeyType
- sealedKeyScopeId
- sealedKeyVersion
- sealingKeyScopeId
- sealingKeyVersion
- sealPurpose
- iv
- tag
- ciphertext
- aad

The ciphertext is the AES-GCM encryption of raw key bytes.

No raw key bytes appear in envelope metadata.

## Supported Sealed Key Type

Slice 7 supports:

- root_key

Future slices may add:

- capability_dek

Capability DEKs are not implemented in this slice because the first priority is preserving K_root_v1 for future deterministic derivation.

## Supported Seal Purposes

Slice 7 supports:

- local_keyring_root
- recovery_backup_root

local_keyring_root means K_root_v1 is sealed under K_local_unlock for future local vault reopening.

recovery_backup_root means K_root_v1 is sealed under K_recovery_wrap for future encrypted backup recovery.

These purposes are not interchangeable. A local-sealed root must not be accepted as a recovery-sealed root.

## AAD Binding

The sealed key AAD binds:

- sealedKeyEnvelopeVersion
- cryptoSuite
- patientId
- keyringId
- sealedKeyId
- sealedKeyType
- sealedKeyScopeId
- sealedKeyVersion
- sealingKeyScopeId
- sealingKeyVersion
- sealPurpose

This prevents context-swapping attacks such as:

- moving a root key from patient-001 to patient-999
- relabeling root version 1 as root version 2
- using a local-sealed root as a recovery-sealed root
- swapping one sealed key scope into another keyring record
- unsealing with a wrong wrapping key without detection

## Forbidden Metadata

Sealed key metadata must never contain:

- raw K_root
- raw K_master
- raw payload key
- raw blind-index key
- raw K_local_unlock
- raw K_recovery_wrap
- NID
- e-TIN
- phone
- email
- DOB
- mental-health
- mental
- psychiatric
- reproductive
- oncology
- HIV
- diabetes
- domain/general
- domain/mental
- care-category labels

Metadata must remain functional and opaque.

## Failure Behavior

Structural invalidity throws:

malformed sealed key envelope

Examples:

- missing ciphertext
- empty IV
- empty tag
- unsupported envelope version
- unsupported crypto suite
- invalid key length

Authentication or context failure throws:

sealed key authentication failed

Examples:

- wrong sealing key
- tampered patientId
- tampered keyringId
- tampered sealedKeyVersion
- tampered sealPurpose
- GCM tag failure
- sealing key scope mismatch

No partial key material may be returned after failure.

## Memory Lifetime Policy

Raw key material remains Uint8Array.

The implementation must not convert raw keys to strings.

Temporary copies used during sealing are zero-filled in a finally block after encryption succeeds or fails.

This is best-effort containment only. JavaScript and Expo do not provide guaranteed secure physical memory zeroization.

## Test Coverage

The contract test verifies:

- K_root_v1 sealing under local_keyring_root
- K_root_v1 sealing under recovery_backup_root
- valid local root unseal
- valid recovery root unseal
- fresh IV and different ciphertext for repeated sealing
- wrong sealing key rejection
- tampered patientId AAD rejection
- tampered keyringId AAD rejection
- tampered sealedKeyVersion AAD rejection
- local root relabeled as recovery root rejection
- malformed missing ciphertext rejection
- unsupported sealed key type rejection
- no raw K_root or sealing key leakage in serialized envelope
- forbidden clinical label rejection
- semantic sealed key scope rejection
- frozen sealed envelope and frozen AAD
- no partial key material after authentication failure

## Consequences

Positive consequences:

- Slice 6 descriptors now have a real future replacement.
- K_root_v1 can be protected under local and recovery wrapping keys.
- Sealed key material is cryptographically bound to patient, keyring, scope, version, and purpose.
- Unseal failures fail closed.
- Metadata remains non-clinical and opaque.

Trade-offs:

- This slice does not yet integrate with Local Vault Assembly.
- This slice does not persist sealed key envelopes.
- This slice does not implement final key lifecycle handoff.
- This slice cannot guarantee true memory zeroization in JavaScript.

## Next Technical Target

The next target is Local Vault Assembly Integration with Sealed Root Keys.

That slice should replace opaque descriptor strings in the first-vault keyring with real sealed K_root_v1 envelopes produced by this Slice 7 primitive.
