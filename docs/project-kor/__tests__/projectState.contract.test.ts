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
  it("records the current locked repository state without relying on chat memory", () => {
    const state = readProjectState();

    expect(state).toContain("# Project KOr State Ledger");
    expect(state).toContain("Branch: main");
    expect(state).toContain("Locked slices: Slice 8 through Slice 30");
    expect(state).toContain(
      "Latest locked commit: a7926c1 feat: add local document save outcome wrapper",
    );
    expect(state).toContain("Current test state: 31 test files, 468 tests");
    expect(state).toContain("Working tree: clean");
    expect(state).toContain("Remote: up to date with origin/main");
    expect(state).toContain(
      "Latest ADR: docs/adr/0030-local-document-save-outcome-wrapper.md",
    );
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
      "No readable ePHI in push notifications",
      "No readable ePHI in AI calls",
      "Patient medical data must be encrypted on-device before any cloud upload.",
      "Resource IDs must be opaque.",
      "KOr ID creates an access request, never access.",
      "AI summaries require explicit request_ai_summary permission.",
    ];

    for (const token of requiredSecurityTokens) {
      expect(state).toContain(token);
    }
  });

  it("records what has actually been built through Slice 30 without claiming unavailable infrastructure", () => {
    const state = readProjectState();

    const requiredBuiltTokens = [
      "Medication adherence domain",
      "AES-GCM envelope adapter",
      "keyring policy",
      "encrypted local keyring storage",
      "key material factory",
      "local vault assembly",
      "sealed key envelope lifecycle",
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
      "local document save result type",
      "local document save outcome boundary",
      "local document save outcome wrapper",
    ];

    for (const token of requiredBuiltTokens) {
      expect(state).toContain(token);
    }

    const forbiddenClaims = [
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
    ];

    for (const claim of forbiddenClaims) {
      expect(state).not.toContain(claim);
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
    ];

    for (const token of forbiddenPrematureWorkTokens) {
      expect(state).toContain(token);
    }
  });

  it("records the next candidate slices without making them active or implemented", () => {
    const state = readProjectState();

    const candidateTokens = [
      "Candidate Slice 32: Source Boundary Scan Script",
      "Candidate Slice 32: Local Document Repository Error Classification Decision",
      "Candidate Slice 32: Local Document Mutation Log Domain",
      "Candidate Slice 32: Local Persistence Readiness Decision",
    ];

    for (const token of candidateTokens) {
      expect(state).toContain(token);
    }

    expect(state).toContain(
      "Only one candidate may become active after Slice 31 is locked.",
    );
    expect(state).not.toContain("Slice 32 is implemented");
    expect(state).not.toContain("Slice 32 is locked");
  });

  it("keeps the state ledger concise, operational, and free from placeholder architecture", () => {
    const state = readProjectState();

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

    expect(state.length).toBeGreaterThan(2_500);
    expect(state.length).toBeLessThan(16_000);
  });
});
