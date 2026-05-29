# Project KOr State Ledger

## Status

Active project state ledger.

This file records the current engineering state of Project KOr inside the repository. It is not a replacement for the architecture dossier, ADRs, or tests. It is the cockpit dashboard for the next slice.

## Current Locked Repository State

Branch: main

Locked slices: Slice 8 through Slice 37

Latest locked commit: 063f9db docs: correct ADR 0037 date

Latest locked source commit: 50c8ff1 feat: add local document save outcome repository failure policy

Current test state: 37 test files, 510 tests

Working tree: clean

Remote: up to date with origin/main

Latest ADR: docs/adr/0037-local-document-save-outcome-repository-failure-policy.md

## Permanent Product Laws

- The patient is the authority.
- The device is the vault.
- The cloud is blind.
- The doctor is verified.
- The AI is permissioned.
- The system is audited.
- The architecture does not blink.

## Security Laws

- No readable ePHI in Supabase rows.
- No readable ePHI in Supabase storage paths.
- No readable ePHI in logs.
- No readable ePHI in analytics.
- No readable ePHI in error messages.
- No readable ePHI in filenames.
- No readable ePHI in search indexes.
- No readable ePHI in push notifications.
- No readable ePHI in AI calls.
- Patient medical data must be encrypted on-device before any cloud upload.
- Metadata must not expose clinical meaning.
- Resource IDs must be opaque.
- Clinical document references are opaque pointers to encrypted payloads, never medical content.
- Patient share packets are metadata-only manifests of opaque authorized resource refs.
- KOr ID creates an access request, never access.
- Consent grants are explicit, scoped, time-limited, revocable, and auditable.
- AI summaries require explicit request_ai_summary permission.
- Clinical content must not be inspected, inferred, logged, or exposed unless a current slice explicitly permits it.

## Architecture Constraints

- Mobile stack: Expo React Native.
- Future local persistence target: WatermelonDB over SQLite.
- Future cloud target: Supabase Free Tier for auth, encrypted metadata, encrypted storage, and signaling.
- Future web hosting target: Vercel.
- Domain logic must remain pure TypeScript.
- Domain code must not import Expo, Supabase, SQLite, WatermelonDB, SecureStore, OCR, AI clients, WebRTC, UI components, filesystem APIs, or analytics.
- Do not introduce infrastructure before the correct slice.
- Do not build UI, sync, OCR, AI, BM&DC, portals, payments, telemetry, analytics, audit receipts, mutation logs, or cloud persistence before their foundations are locked.

## Slice Workflow Law

Every slice must follow:

1. Phase 1: Conceptualization and reasoning.
2. Phase 2: Plan crystallization.
3. Phase 3: Test-first Red contract.
4. Phase 4: Guided implementation.
5. Phase 5: Security and systems validation.
6. Phase 6: ADR/docs/commit/merge/push.

A slice is not complete until tests, validation, documentation decision, commit guidance, push, and clean repo evidence are complete.

## Built Foundations Through Slice 37

- Medication adherence domain.
- AES-GCM envelope adapter.
- keyring policy.
- encrypted local keyring storage.
- key material factory.
- local vault assembly.
- sealed key envelope lifecycle.
- local vault assembly sealed-root integration.
- secure local unlock material boundary.
- Expo SecureStore adapter.
- mobile runtime composition boundary.
- unlock session state machine.
- consent grant domain.
- patient share packet domain.
- clinical document reference domain.
- share packet document reference compatibility.
- share packet clinical reference selection.
- share packet selected-reference result type.
- access request domain.
- access request to consent grant transition.
- share packet issuance from consent grant.
- local encrypted document payload boundary.
- local document repository port.
- in-memory local document repository adapter.
- local document save use case.
- local document save preflight decision.
- local document save use case preflight delegation.
- local document save result type.
- local document save outcome boundary.
- local document save outcome wrapper.
- local document repository failure classification.
- local document repository failure rethrow helper.
- local document save repository failure classification integration.
- local document save outcome repository failure policy.
- Project KOr state ledger.
- source boundary scan script.

## Current Local Document Save Architecture

The local document save path now has these application-layer boundaries:

- local encrypted payload references describe opaque encrypted payload metadata only.
- clinical document references point to encrypted payloads without exposing clinical content.
- local document repository port defines save behavior without durable storage.
- in-memory local document repository adapter exists for test and boundary use only.
- save preflight decides whether a clinical document reference and local encrypted payload may be saved together.
- save use case performs payload-first repository writes and preserves repository error propagation.
- save result type formalizes completed internal application output.
- save outcome boundary models completed versus preflight-rejected internal application outcomes.
- save outcome wrapper returns rejected outcomes for preflight rejection while preserving repository error propagation.
- repository failure classification identifies safe failure phase without exposing thrown causes.
- repository failure rethrow helper classifies and rethrows original causes unchanged.
- save use case integration classifies repository write failures while preserving original thrown causes.
- outcome repository failure policy keeps repository failures outside LocalDocumentSaveOutcome values.

The outcome wrapper is internal application output. It is not a log-safe, audit-safe, sync-safe, cloud-safe, notification-safe, telemetry-safe, analytics-safe, or display-safe receipt.

## Current Local Document Save Failure Boundary

Repository failures are not preflight rejections.

Repository failures are not LocalDocumentSaveOutcome values.

Repository failures rethrow the original cause.

Repository failure classifications may be observed in-process only.

The outcome wrapper remains preflight-rejection-only.

The outcome policy is not a log-safe, audit-safe, sync-safe, cloud-safe, notification-safe, telemetry-safe, analytics-safe, or display-safe receipt.

Repository failure classifications expose only approved phase-level internal information.

Repository failure classifications must not expose messages, stacks, patient identifiers, resource identifiers, payload identifiers, filenames, file paths, storage paths, clinical labels, adapter details, database details, or cloud provider details.

## Current Validation Tooling

The source boundary scan script exists as repository tooling only.

It reads one source file, checks required tokens, checks forbidden tokens, prints explicit validation findings, and exits non-zero when a violation exists.

The script is not runtime code. It is not application logic. It is not domain logic. It is not infrastructure logic. It does not replace human architecture review, ADRs, or tests.

## Built Access and Sharing Chain

The access and sharing path now supports:

- KOr ID creating access requests, never access.
- patient-approved access requests transitioning into consent grants.
- consent grants issuing share packets.
- share packets selecting compatible active clinical document references.
- selected-reference result type preserving opaque reference behavior.

No doctor portal, patient portal, cloud sync, BM&DC verification, AI summary, OCR flow, telemetry flow, analytics flow, audit receipt flow, or payment flow is active.

## Not Implemented Yet

WatermelonDB adapter is not implemented.

SQLite schema is not implemented.

Supabase sync is not implemented.

Cloud upload is not implemented.

Filesystem encrypted blob storage is not implemented.

OCR is not implemented.

AI summaries are not implemented.

Doctor portal is not implemented.

Patient portal is not implemented.

BM&DC verification is not implemented.

Payments are not implemented.

Emergency access is not implemented.

Family or caregiver delegation is not implemented beyond narrow access-request and medication-scope foundations.

Key recovery is not implemented.

Consent receipts are not implemented.

Access audit trail is not implemented.

Diagnostic center signed payload ingestion is not implemented.

Bangla locale and language domain is not implemented.

Telemetry is not implemented.

Analytics are not implemented.

Audit receipts are not implemented.

Mutation logs are not implemented.

## Forbidden Premature Work

Do not introduce Supabase persistence yet.

Do not introduce WatermelonDB yet.

Do not introduce SQLite schemas yet.

Do not introduce filesystem storage yet.

Do not introduce sync yet.

Do not introduce OCR yet.

Do not introduce AI summaries yet.

Do not introduce doctor portal UI yet.

Do not introduce patient portal UI yet.

Do not introduce BM&DC verification yet.

Do not introduce payment flows yet.

Do not introduce telemetry yet.

Do not introduce analytics yet.

Do not introduce audit receipts yet.

Do not introduce mutation logs yet.

Do not introduce emergency access yet.

Do not introduce key recovery yet.

Do not introduce cloud upload yet.

Do not introduce readable clinical metadata yet.

## Current Candidate Slice 39 Options

Candidate Slice 39: Local Document Mutation Log Domain

Candidate Slice 39: Local Persistence Readiness Decision

Candidate Slice 39: Project KOr Architecture Laws Documentation

Candidate Slice 39: Local Document Save Failure Boundary Documentation Hardening

Only one candidate may become active after Slice 38 is locked.

The selected candidate must be justified by current repository state and must preserve all architecture laws.

## Immediate Next Gate

After Slice 38 is locked, choose exactly one Slice 39 target.

The default recommendation is Local Document Mutation Log Domain if the next foundation should prepare for future persistence and sync without introducing storage, cloud, database, or sync infrastructure.

The alternative recommendation is Local Persistence Readiness Decision if the next foundation should define readiness gates before WatermelonDB, SQLite, or filesystem storage work begins.

## State Ledger Update Rule

This state ledger records the latest locked baseline known at the start of a state-ledger update slice.

Slice 38 records the locked baseline through Slice 37.

This state ledger must be updated only through a dedicated slice or when a later slice explicitly changes locked state.

It must not claim the current update slice as locked before that slice has passed tests, validation, ADR, commit, push, and clean-tree evidence.

It must not claim future infrastructure as implemented.

It must not weaken architecture laws.

It must not replace ADRs.

It must not describe internal output objects as safe for logs, analytics, UI display, notifications, cloud metadata, sync payloads, telemetry, or audit receipts.

## Current Stop Rules

Stop if the working tree is not clean before starting a slice.

Stop if tests fail.

Stop if source code changes appear during a documentation-only slice.

Stop if a proposed slice introduces infrastructure before its gate.

Stop if a proposed slice exposes clinical content, readable ePHI, semantic clinical metadata, filenames, paths, notifications, AI calls, logs, analytics, telemetry, or cloud metadata.

Stop if a proposed slice treats KOr ID as access.

Stop if a proposed slice treats AI summaries as allowed without explicit request_ai_summary permission.

Stop if a proposed slice converts repository failures into preflight rejections or LocalDocumentSaveOutcome values.
