# ADR 0004: Encrypted Local Keyring Storage Boundary

## Status

Accepted.

## Date

2026-05-18

## Context

Project KOr uses client-side application-layer encryption for sensitive health data. The AES-GCM sealed envelope adapter can encrypt payloads, and the keyring policy module can enforce safe key-scope behavior. However, the application still needs a safe boundary for preparing keyring material for persistence.

This decision defines the encrypted keyring storage boundary. It does not implement Expo SecureStore, WatermelonDB, Supabase, Shamir recovery, or real device storage.

The goal is to produce sealed keyring envelopes that can later be stored locally or backed up remotely without exposing raw keys, clinical domain labels, HKDF info strings, or recovery secrets.

## Decision

We implemented the encrypted keyring storage boundary at:

```text
src/infrastructure/keyring-storage/encryptedKeyringStore.ts