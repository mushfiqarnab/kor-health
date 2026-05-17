# ADR 0006: Local Vault Assembly Workflow

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

The project now needs an application-layer workflow that assembles the first patient vault initialization package in memory.

This workflow connects the Key Material Factory, Keyring Policy, AES-GCM Adapter, and Encrypted Keyring Storage Boundary. It does not persist data and does not call platform storage.

## Decision

We implemented the Local Vault Assembly Workflow at:

src/application/vault-assembly/localVaultAssembly.ts

The module creates a first-vault initialization package containing:

- patientId
- keyringId
- backupId
- initial opaque key scopes
- local_keyring envelope
- keyring_backup envelope
- verification result
- transient initialization secrets for this test-stage workflow

The workflow immediately verifies that both keyring envelopes can be opened with the correct transient keys.

## Scope

This slice is application-layer orchestration only.

It does not implement:

- Expo SecureStore
- SQLite
- WatermelonDB
- Supabase
- Shamir Secret Sharing
- caregiver grants
- emergency cards
- doctor access
- BM&DC verification
- medicine reminders
- DGDA catalog
- UI

## First Vault Bootstrapping

The workflow performs the following sequence:

1. Validate patientId, keyringId, backupId, and opaque key scope identifiers.
2. Generate K_root_v1 randomly.
3. Generate patientSalt randomly.
4. Generate K_local_unlock randomly.
5. Generate K_recovery_wrap randomly.
6. Derive payload_encryption from K_root_v1 using HKDF.
7. Derive blind_index from K_root_v1 using HKDF.
8. Build a safe KeyringPlaintextV1 object.
9. Seal the local_keyring envelope using K_local_unlock.
10. Seal the keyring_backup envelope using K_recovery_wrap.
11. Immediately open and verify both envelopes.
12. Return a frozen assembly result.

## Random vs HKDF Boundary

Randomly generated:

- K_root_v1
- patientSalt
- K_local_unlock
- K_recovery_wrap

HKDF-derived from K_root_v1:

- payload_encryption
- blind_index

Not derived from K_root_v1:

- local_keyring
- keyring_backup
- caregiver_adherence
- emergency_card

This preserves isolated blast radius and prevents circular dependencies.

## Opaque Key Scope Policy

Initial scope IDs must be opaque.

Accepted examples:

- ks_01
- ks_02
- ks_10
- ks_20

Rejected examples:

- ks_mental_health
- domain/general/v1
- reproductive-health-scope
- psychiatric-scope

Clinical meaning must not be encoded in keyScopeId.

## Opaque Sealed Material Descriptors

This slice uses opaque sealed material descriptors inside the initial keyring records.

Example:

sealed:root-version:1:scope:ks_01

These descriptors are not final production key wrapping.

This slice intentionally does not implement root-key wrapping or full key lifecycle management. A future dedicated key wrapping and lifecycle slice must replace these descriptors with real wrapped key material.

## Local Keyring Envelope

The local keyring envelope uses:

- storageKind = local_keyring
- AAD purpose = local_keyring
- wrapping key = K_local_unlock

This envelope is future local persistence material.

The workflow does not write it to SecureStore, SQLite, or WatermelonDB.

## Backup Keyring Envelope

The backup keyring envelope uses:

- storageKind = keyring_backup
- AAD purpose = keyring_backup
- wrapping key = K_recovery_wrap

This envelope is future cloud-backup material.

The workflow does not upload it to Supabase.

## Transient Initialization Secrets

The workflow temporarily returns:

- localUnlockKey
- recoveryWrapKey

These exist only because the SecureStore and recovery modules do not exist yet.

To reduce accidental leakage, transientInitializationSecrets is frozen and its key properties are non-enumerable. Therefore:

- direct test-stage access still works
- JSON.stringify(assembly) does not expose rawKeyBytes
- Object.keys(transientInitializationSecrets) returns an empty array

This is a guardrail, not final key lifecycle security.

A future key lifecycle module must define memory lifetime, secure wrapping, storage handoff, and best-effort key clearing.

## Forbidden Leakage

The workflow must not serialize or log:

- raw K_root
- raw K_master
- raw K_local_unlock
- raw K_recovery_wrap
- raw payload key
- raw blind-index key
- semantic clinical labels
- domain/general
- domain/mental
- mental-health
- psychiatric
- reproductive
- oncology
- HIV
- diabetes
- NID
- e-TIN
- phone number
- caregiver_adherence records during first-vault creation
- emergency_card records during first-vault creation

## Verification Rules

Vault assembly fails closed if:

- patientId is empty
- keyringId is empty
- backupId is empty
- any keyScopeId is semantic
- HKDF derivation fails
- local_keyring sealing fails
- keyring_backup sealing fails
- local_keyring verification fails
- keyring_backup verification fails
- tampered local envelope metadata is detected
- tampered backup envelope metadata is detected
- forbidden plaintext is detected

## Test Coverage

The contract test verifies:

- first-vault assembly package creation
- random local unlock key generation
- random recovery wrap key generation
- different random capability keys across assemblies
- local_keyring AAD purpose
- keyring_backup AAD purpose
- immediate local envelope verification
- immediate backup envelope verification
- only payload_encryption and blind_index initial records
- no caregiver_adherence during first-vault creation
- no emergency_card during first-vault creation
- opaque sealed material descriptors
- no semantic clinical labels in scope metadata
- no raw initialization secrets in serialized envelopes
- semantic keyScopeId rejection
- empty identifier rejection
- tampered local envelope rejection
- tampered backup envelope rejection
- frozen assembly result
- non-enumerable transient initialization secrets

## Consequences

Positive consequences:

- first-vault initialization is now explicitly modeled
- local and backup envelope creation are coordinated safely
- random-vs-HKDF key boundaries remain intact
- no persistence is introduced prematurely
- transient secrets are less likely to leak through JSON serialization

Trade-offs:

- final root-key wrapping is not implemented
- SecureStore handoff is not implemented
- local database persistence is not implemented
- recovery shards are not implemented
- transient secrets still exist in memory during test-stage orchestration

## Next Technical Target

The next target is the Key Wrapping and Lifecycle Boundary.

That slice should replace opaque sealed material descriptors with real wrapped key material and define how transient raw keys are handed off, wrapped, and cleared as safely as JavaScript and Expo allow.
