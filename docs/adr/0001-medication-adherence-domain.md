# ADR 0001: Encrypted Medication Adherence Domain

## Status

Accepted.

## Date

2026-05-17

## Context

Project KOr begins with a Bangladesh-focused, offline-first medicine adherence and personal health vault MVP.

The first implemented vertical slice is the medication adherence domain. This module is intentionally pure domain logic. It does not depend on Supabase, WatermelonDB, Expo, SQLite, notifications, device storage, or cryptographic libraries.

The purpose of this domain is to define safe business behavior before infrastructure is introduced.

## Decision

The medication adherence domain supports:

1. Creating medication plans.
2. Recording dose events as append-only facts.
3. Projecting daily adherence state from dose events.
4. Preparing cloud-syncable payloads that contain ciphertext and minimal routing metadata only.

The domain receives time and ID generation through injected ports:

- `ClockPort`
- `IdGeneratorPort`

The domain receives encryption through an injected `EncryptionPort`.

This prevents the domain layer from knowing implementation details such as system time, random UUID generation, AES-GCM, secure key storage, Supabase, or SQLite.

## Security Rules

The following values are treated as medical data:

- medicine brand name,
- generic name,
- dose instruction,
- medication schedule,
- medication status,
- dose status,
- scheduled dose time,
- actual taken time,
- actor ID,
- actor role.

These values must not appear in cloud-syncable plaintext.

Medication plan cloud sync payloads may expose only:

- `id`,
- `patientId`,
- `sourceRecordId`,
- `ciphertext`,
- `schemaVersion`.

Dose event cloud sync payloads may expose only:

- `id`,
- `patientId`,
- `medicationPlanId`,
- `eventCategory`,
- `ciphertext`,
- `schemaVersion`.

Clinical timestamps such as `createdAt`, `scheduledAt`, and `actualAt` must not be casually synced as plaintext.

## Event Model

Dose events are immutable append-only facts.

The domain must not update a mutable `takenToday`, `missedToday`, or `lastTakenAt` field on a medication plan.

Daily adherence state is projected from dose events:

\[
DailyState = Project(DoseEvent_1, DoseEvent_2, ..., DoseEvent_n)
\]

This prevents silent overwrite bugs in offline-first synchronization.

## Clean Architecture Boundary

This module belongs to the Domain Layer.

Allowed:

- TypeScript types.
- Pure validation.
- Pure projection logic.
- Dependency-injected ports.

Forbidden:

- Supabase calls.
- WatermelonDB calls.
- SQLite queries.
- Expo APIs.
- notification scheduling.
- direct AES-GCM implementation.
- `new Date()` inside domain logic.
- `crypto.randomUUID()` inside domain logic.

## Consequences

Positive consequences:

- The medication adherence logic is deterministic and easy to test.
- Cloud payloads do not expose sensitive medicine or adherence data.
- The event model supports future offline conflict handling.
- Infrastructure can be replaced without rewriting business rules.

Trade-offs:

- The domain cannot run alone without infrastructure adapters for clock, ID generation, and encryption.
- More boilerplate is required than in a naive CRUD model.
- Future sync design must preserve the encrypted payload boundary.

## Next Technical Target

The next target is the infrastructure crypto adapter test contract.

Before any WatermelonDB or Supabase schema is introduced, we must define and test an AES-256-GCM encryption adapter interface that satisfies the domain's `EncryptionPort`.

No readable medication or dose data may cross this boundary.