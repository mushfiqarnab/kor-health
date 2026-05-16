# ADR 0002: AES-GCM Sealed Envelope Adapter

## Status

Accepted.

## Date

2026-05-17

## Context

Project KOr uses application-layer encryption before any sensitive health data is synchronized to cloud infrastructure.

The medication adherence domain already requires an `EncryptionPort`, but the first test adapter used fake encryption. Before introducing WatermelonDB, Supabase, sync queues, or UI, the system requires a real sealed-envelope encryption boundary.

The adapter must protect medication plans, dose events, clinical timestamps, actor information, and future medical record payloads from readable cloud exposure.

## Decision

We implemented an infrastructure crypto adapter at:

```text
src/infrastructure/crypto/aesGcmEnvelopeAdapter.ts