import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const projectStatePath = resolve(
  process.cwd(),
  "docs/project-kor/PROJECT_STATE.md",
);

function readProjectState(): string {
  return readFileSync(projectStatePath, "utf8");
}

describe("Project KOr state ledger contract", () => {
  it("records the current locked repository state through Slice 37 without relying on chat memory", () => {
    const state = readProjectState();

    const requiredStateTokens = [
      "# Project KOr State Ledger",
      "Branch: main",
      "Locked slices: Slice 8 through Slice 37",
      "Latest locked commit: 063f9db docs: correct ADR 0037 date",
      "Latest locked source commit: 50c8ff1 feat: add local document save outcome repository failure policy",
      "Current test state: 37 test files, 510 tests",
      "Working tree: clean",
      "Remote: up to date with origin/main",
      "Latest ADR: docs/adr/0037-local-document-save-outcome-repository-failure-policy.md",
    ];

    for (const token of requiredStateTokens) {
      expect(state).toContain(token);
    }

    expect(state).not.toContain("Locked slices: Slice 8 through Slice 38");
    expect(state).not.toContain("Latest ADR: docs/adr/0038");
  });

  it("records the permanent product laws and security laws that future slices must obey", () => {
    const state = readProjectState();

    const requiredProductLawTokens = [
      "The patient is the authority.",
      "The device is the vault.",
      "The cloud is blind.",
      "The doctor is verified.",
      "The AI is permissioned.",
      "The system is audited.",
      "The architecture does not blink.",
    ];

    for (const token of requiredProductLawTokens) {
      expect(state).toContain(token);
    }

    const requiredSecurityTokens = [
      "No readable ePHI in Supabase rows",
      "No readable ePHI in Supabase storage paths",
      "No readable ePHI in logs",
      "No readable ePHI in analytics",
      "No readable ePHI in error messages",
      "No readable ePHI in filenames",
      "No readable ePHI in search indexes",
      "No readable ePHI in push notifications",
      "No readable ePHI in AI calls",
      "Patient medical data must be encrypted on-device before any cloud upload.",
      "Metadata must not expose clinical meaning.",
      "Resource IDs must be opaque.",
      "Clinical document references are opaque pointers to encrypted payloads, never medical content.",
      "Patient share packets are metadata-only manifests of opaque authorized resource refs.",
      "KOr ID creates an access request, never access.",
      "Consent grants are explicit, scoped, time-limited, revocable, and auditable.",
      "AI summaries require explicit request_ai_summary permission.",
    ];

    for (const token of requiredSecurityTokens) {
      expect(state).toContain(token);
    }
  });

  it("records what has actually been built through Slice 37 without claiming unavailable infrastructure", () => {
    const state = readProjectState();

    const requiredBuiltTokens = [
      "Medication adherence domain",
      "AES-GCM envelope adapter",
      "keyring policy",
      "encrypted local keyring storage",
      "key material factory",
      "local vault assembly",
      "sealed key envelope lifecycle",
      "local vault assembly sealed-root integration",
      "secure local unlock material boundary",
      "Expo SecureStore adapter",
      "mobile runtime composition boundary",
      "unlock session state machine",
      "consent grant domain",
      "patient share packet domain",
      "clinical document reference domain",
      "share packet document reference compatibility",
      "share packet clinical reference selection",
      "share packet selected-reference result type",
      "access request domain",
      "access request to consent grant transition",
      "share packet issuance from consent grant",
      "local encrypted document payload boundary",
      "local document repository port",
      "in-memory local document repository adapter",
      "local document save use case",
      "local document save preflight decision",
      "local document save use case preflight delegation",
      "local document save result type",
      "local document save outcome boundary",
      "local document save outcome wrapper",
      "local document repository failure classification",
      "local document repository failure rethrow helper",
      "local document save repository failure classification integration",
      "local document save outcome repository failure policy",
      "Project KOr state ledger",
      "source boundary scan script",
    ];

    for (const token of requiredBuiltTokens) {
      expect(state).toContain(token);
    }

    const forbiddenImplementedClaims = [
      "WatermelonDB adapter is implemented",
      "SQLite schema is implemented",
      "Supabase sync is implemented",
      "cloud upload is implemented",
      "OCR is implemented",
      "AI summaries are implemented",
      "doctor portal is implemented",
      "patient portal is implemented",
      "BM&DC verification is implemented",
      "payments are implemented",
      "telemetry is implemented",
      "analytics are implemented",
      "audit receipts are implemented",
      "mutation logs are implemented",
      "filesystem encrypted blob storage is implemented",
    ];

    for (const claim of forbiddenImplementedClaims) {
      expect(state.toLowerCase()).not.toContain(claim.toLowerCase());
    }
  });

  it("records the current local document save failure-boundary architecture without weakening outcome rules", () => {
    const state = readProjectState();

    const requiredFailureBoundaryTokens = [
      "Repository failures are not preflight rejections.",
      "Repository failures are not LocalDocumentSaveOutcome values.",
      "Repository failures rethrow the original cause.",
      "Repository failure classifications may be observed in-process only.",
      "The outcome wrapper remains preflight-rejection-only.",
      "The outcome policy is not a log-safe, audit-safe, sync-safe, cloud-safe, notification-safe, telemetry-safe, analytics-safe, or display-safe receipt.",
      "Repository failure classifications expose only approved phase-level internal information.",
      "Repository failure classifications must not expose messages, stacks, patient identifiers, resource identifiers, payload identifiers, filenames, file paths, storage paths, clinical labels, adapter details, database details, or cloud provider details.",
    ];

    for (const token of requiredFailureBoundaryTokens) {
      expect(state).toContain(token);
    }

    const forbiddenFailureBoundaryClaims = [
      "repository_failed outcome",
      "repository failure outcome",
      "repository failures are rejected outcomes",
      "repository failures are display-safe",
      "repository failures are log-safe",
      "repository failures are audit-safe",
      "repository failures are cloud-safe",
      "repository failures are sync-safe",
      "repository failures are notification-safe",
      "repository failures are telemetry-safe",
      "repository failures are analytics-safe",
    ];

    for (const claim of forbiddenFailureBoundaryClaims) {
      expect(state.toLowerCase()).not.toContain(claim.toLowerCase());
    }
  });

  it("records what must not be built yet so roadmap pressure cannot skip gates", () => {
    const state = readProjectState();

    const forbiddenPrematureWorkTokens = [
      "Do not introduce Supabase persistence yet.",
      "Do not introduce WatermelonDB yet.",
      "Do not introduce SQLite schemas yet.",
      "Do not introduce filesystem storage yet.",
      "Do not introduce sync yet.",
      "Do not introduce OCR yet.",
      "Do not introduce AI summaries yet.",
      "Do not introduce doctor portal UI yet.",
      "Do not introduce patient portal UI yet.",
      "Do not introduce BM&DC verification yet.",
      "Do not introduce payment flows yet.",
      "Do not introduce telemetry yet.",
      "Do not introduce analytics yet.",
      "Do not introduce audit receipts yet.",
      "Do not introduce mutation logs yet.",
      "Do not introduce emergency access yet.",
      "Do not introduce key recovery yet.",
      "Do not introduce cloud upload yet.",
      "Do not introduce readable clinical metadata yet.",
    ];

    for (const token of forbiddenPrematureWorkTokens) {
      expect(state).toContain(token);
    }
  });

  it("records the next candidate slices after Slice 38 without making them active or implemented", () => {
    const state = readProjectState();

    const candidateTokens = [
      "Candidate Slice 39: Local Document Mutation Log Domain",
      "Candidate Slice 39: Local Persistence Readiness Decision",
      "Candidate Slice 39: Project KOr Architecture Laws Documentation",
      "Candidate Slice 39: Local Document Save Failure Boundary Documentation Hardening",
    ];

    for (const token of candidateTokens) {
      expect(state).toContain(token);
    }

    expect(state).toContain(
      "Only one candidate may become active after Slice 38 is locked.",
    );

    expect(state).not.toContain("Candidate Slice 34:");
    expect(state).not.toContain("Slice 39 is implemented");
    expect(state).not.toContain("Slice 39 is locked");
  });

  it("keeps the state ledger concise, operational, and free from placeholder architecture", () => {
    const state = readProjectState();

    const requiredOperationalTokens = [
      "Slice 38 records the locked baseline through Slice 37.",
      "It must not claim the current update slice as locked before that slice has passed tests, validation, ADR, commit, push, and clean-tree evidence.",
      "It must not claim future infrastructure as implemented.",
      "It must not describe internal output objects as safe for logs, analytics, UI display, notifications, cloud metadata, sync payloads, telemetry, or audit receipts.",
      "Stop if the working tree is not clean before starting a slice.",
      "Stop if tests fail.",
      "Stop if source code changes appear during a documentation-only slice.",
      "Stop if a proposed slice converts repository failures into preflight rejections or LocalDocumentSaveOutcome values.",
    ];

    for (const token of requiredOperationalTokens) {
      expect(state).toContain(token);
    }

    const forbiddenPlaceholders = [
      "TODO",
      "TBD",
      "coming soon",
      "placeholder",
      "we will figure this out later",
      "temporary architecture",
      "quick hack",
      "for now only",
    ];

    for (const token of forbiddenPlaceholders) {
      expect(state.toLowerCase()).not.toContain(token.toLowerCase());
    }

    expect(state.length).toBeGreaterThan(3_500);
    expect(state.length).toBeLessThan(20_000);
  });
});
