# ADR 0003: Keyring Policy Module

## Status

Accepted.

## Date

2026-05-17

## Context

Project KOr uses client-side application-layer encryption for sensitive health data. The AES-GCM envelope adapter can encrypt and decrypt payloads, but it receives key material from outside. Before implementing SecureStore, SQLite keyrings, Supabase sync, or recovery flows, the system needs a pure policy module that defines safe key-scope behavior.

This module does not generate real keys, store keys, derive HKDF subkeys, use SecureStore, use Supabase, or use WatermelonDB. It only enforces key-management policy.

## Decision

We implemented a keyring policy module at:

```text
src/application/key-management/keyringPolicy.ts