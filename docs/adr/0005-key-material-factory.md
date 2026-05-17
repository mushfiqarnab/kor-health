# ADR 0005: Key Material Factory

## Status

Accepted.

## Date

2026-05-18

## Context

Project KOr uses zero-knowledge, client-side encryption for sensitive health data. Previous slices established:

```text
Medication adherence domain rules
AES-GCM sealed envelope adapter
Keyring policy module
Encrypted keyring storage boundary