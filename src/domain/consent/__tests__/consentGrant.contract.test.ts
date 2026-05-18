import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertNoConsentGrantMetadataLeak,
  canRequestAiSummary,
  canUseConsentCapability,
  createConsentGrant,
  evaluateConsentCapability,
  isConsentGrantActive,
  isConsentGrantExpired,
  isConsentGrantRevoked,
  revokeConsentGrant,
  type ConsentCapability,
  type ConsentGrant,
  type ConsentPurpose,
  type ConsentRecipientActorType,
  type ConsentScope,
  type CreateConsentGrantInput,
} from "../consentGrant";

const issuedAtEpochMs = 1_800_000_000_000;
const expiresAtEpochMs = issuedAtEpochMs + 3_600_000;
const beforeExpiryEpochMs = issuedAtEpochMs + 60_000;
const atExpiryEpochMs = expiresAtEpochMs;

function baseInput(
  overrides: Partial<CreateConsentGrantInput> = {},
): CreateConsentGrantInput {
  return {
    grantId: "grant_01JAAA00000000000000000001",
    grantorPatientId: "patient_01JAAA00000000000000000001",
    recipientActorId: "doctor_01JAAA00000000000000000001",
    recipientActorType: "verified_doctor",
    scope: "recent_reports",
    capabilities: ["view_recent_reports"],
    purpose: "clinical_treatment",
    issuedAtEpochMs,
    expiresAtEpochMs,
    ...overrides,
  };
}

function createGrant(
  overrides: Partial<CreateConsentGrantInput> = {},
): ConsentGrant {
  return createConsentGrant(baseInput(overrides));
}

function expectCreateToThrow(
  overrides: Partial<CreateConsentGrantInput>,
  message: string,
): void {
  expect(() => createConsentGrant(baseInput(overrides))).toThrow(message);
}

describe("Consent grant domain contract", () => {
  it("creates a frozen consent grant with scoped capabilities", () => {
    const grant = createGrant();

    expect(grant).toEqual({
      grantId: "grant_01JAAA00000000000000000001",
      grantorPatientId: "patient_01JAAA00000000000000000001",
      recipientActorId: "doctor_01JAAA00000000000000000001",
      recipientActorType: "verified_doctor",
      scope: "recent_reports",
      capabilities: ["view_recent_reports"],
      purpose: "clinical_treatment",
      issuedAtEpochMs,
      expiresAtEpochMs,
    });
    expect(Object.isFrozen(grant)).toBe(true);
    expect(Object.isFrozen(grant.capabilities)).toBe(true);
  });

  it("creates a frozen specific document set grant with opaque resource IDs", () => {
    const grant = createGrant({
      scope: "specific_document_set",
      capabilities: ["view_recent_reports"],
      resourceIds: ["doc_01JAAA00000000000000000001"],
    });

    expect(grant.resourceIds).toEqual(["doc_01JAAA00000000000000000001"]);
    expect(Object.isFrozen(grant.resourceIds)).toBe(true);
  });

  it("rejects empty grantId", () => {
    expectCreateToThrow({ grantId: "   " }, "grantId must not be empty");
  });

  it("rejects empty grantorPatientId", () => {
    expectCreateToThrow(
      { grantorPatientId: "   " },
      "grantorPatientId must not be empty",
    );
  });

  it("rejects empty recipientActorId", () => {
    expectCreateToThrow(
      { recipientActorId: "   " },
      "recipientActorId must not be empty",
    );
  });

  it("rejects zero or negative issuedAtEpochMs", () => {
    expectCreateToThrow(
      { issuedAtEpochMs: 0 },
      "issuedAtEpochMs must be a positive integer",
    );
    expectCreateToThrow(
      { issuedAtEpochMs: -1 },
      "issuedAtEpochMs must be a positive integer",
    );
  });

  it("rejects unsafe non-integer timestamps", () => {
    expectCreateToThrow(
      { issuedAtEpochMs: 1.5 },
      "issuedAtEpochMs must be a positive integer",
    );
    expectCreateToThrow(
      { expiresAtEpochMs: 1.5 },
      "expiresAtEpochMs must be a positive integer",
    );
  });

  it("rejects expiry before issue time", () => {
    expectCreateToThrow(
      { expiresAtEpochMs: issuedAtEpochMs - 1 },
      "expiresAtEpochMs must be after issuedAtEpochMs",
    );
  });

  it("rejects expiry equal to issue time", () => {
    expectCreateToThrow(
      { expiresAtEpochMs: issuedAtEpochMs },
      "expiresAtEpochMs must be after issuedAtEpochMs",
    );
  });

  it("rejects empty capabilities", () => {
    expectCreateToThrow(
      { capabilities: [] },
      "capabilities must not be empty",
    );
  });

  it("rejects duplicate capabilities", () => {
    expectCreateToThrow(
      {
        capabilities: ["view_recent_reports", "view_recent_reports"],
      },
      "capabilities must be unique",
    );
  });

  it("rejects unsupported recipient actor type", () => {
    expectCreateToThrow(
      {
        recipientActorType:
          "future_ai_processor" as ConsentRecipientActorType,
      },
      "unsupported recipient actor type",
    );
  });

  it("rejects unsupported scope", () => {
    expectCreateToThrow(
      {
        scope: "mental_health" as ConsentScope,
      },
      "unsupported consent scope",
    );
  });

  it("rejects unsupported purpose", () => {
    expectCreateToThrow(
      {
        purpose: "general_use" as ConsentPurpose,
      },
      "unsupported consent purpose",
    );
  });

  it("rejects unsupported capability at runtime", () => {
    expectCreateToThrow(
      {
        capabilities: ["view_everything" as ConsentCapability],
      },
      "unsupported consent capability",
    );
  });

  it("rejects full-vault capability", () => {
    expectCreateToThrow(
      {
        capabilities: ["view_full_vault" as ConsentCapability],
      },
      "unsupported consent capability",
    );
  });

  it("rejects decrypt-document capability", () => {
    expectCreateToThrow(
      {
        capabilities: ["decrypt_document" as ConsentCapability],
      },
      "unsupported consent capability",
    );
  });

  it("rejects export-all-records capability", () => {
    expectCreateToThrow(
      {
        capabilities: ["export_all_records" as ConsentCapability],
      },
      "unsupported consent capability",
    );
  });

  it("reports active grant before expiry", () => {
    const grant = createGrant();

    expect(isConsentGrantActive(grant, beforeExpiryEpochMs)).toBe(true);
    expect(isConsentGrantExpired(grant, beforeExpiryEpochMs)).toBe(false);
    expect(isConsentGrantRevoked(grant)).toBe(false);
  });

  it("reports expired grant at expiresAtEpochMs", () => {
    const grant = createGrant();

    expect(isConsentGrantExpired(grant, atExpiryEpochMs)).toBe(true);
    expect(isConsentGrantActive(grant, atExpiryEpochMs)).toBe(false);
  });

  it("reports revoked grant as inactive", () => {
    const grant = createGrant();
    const revoked = revokeConsentGrant(grant, issuedAtEpochMs + 10_000);

    expect(isConsentGrantRevoked(revoked)).toBe(true);
    expect(isConsentGrantActive(revoked, beforeExpiryEpochMs)).toBe(false);
  });

  it("revokes grant without mutating original grant", () => {
    const grant = createGrant();
    const revokedAtEpochMs = issuedAtEpochMs + 10_000;

    const revoked = revokeConsentGrant(grant, revokedAtEpochMs);

    expect(grant.revokedAtEpochMs).toBeUndefined();
    expect(revoked.revokedAtEpochMs).toBe(revokedAtEpochMs);
    expect(Object.isFrozen(revoked)).toBe(true);
  });

  it("revocation is idempotent", () => {
    const grant = createGrant();
    const revoked = revokeConsentGrant(grant, issuedAtEpochMs + 10_000);
    const secondRevocation = revokeConsentGrant(
      revoked,
      issuedAtEpochMs + 20_000,
    );

    expect(secondRevocation).toBe(revoked);
    expect(secondRevocation.revokedAtEpochMs).toBe(issuedAtEpochMs + 10_000);
  });

  it("rejects revocation before issue time", () => {
    const grant = createGrant();

    expect(() =>
      revokeConsentGrant(grant, issuedAtEpochMs - 1),
    ).toThrow("revokedAtEpochMs cannot be before issuedAtEpochMs");
  });

  it("allows granted capability while active", () => {
    const grant = createGrant();

    expect(
      canUseConsentCapability(
        grant,
        "view_recent_reports",
        beforeExpiryEpochMs,
      ),
    ).toBe(true);
    expect(
      evaluateConsentCapability(
        grant,
        "view_recent_reports",
        beforeExpiryEpochMs,
      ),
    ).toEqual({ allowed: true });
  });

  it("denies capability not listed in grant", () => {
    const grant = createGrant();

    expect(
      canUseConsentCapability(
        grant,
        "view_visit_packet",
        beforeExpiryEpochMs,
      ),
    ).toBe(false);
    expect(
      evaluateConsentCapability(
        grant,
        "view_visit_packet",
        beforeExpiryEpochMs,
      ),
    ).toEqual({
      allowed: false,
      reason: "capability_not_granted",
    });
  });

  it("denies granted capability after expiry with reason expired", () => {
    const grant = createGrant();

    expect(
      evaluateConsentCapability(
        grant,
        "view_recent_reports",
        atExpiryEpochMs,
      ),
    ).toEqual({
      allowed: false,
      reason: "expired",
    });
  });

  it("denies granted capability after revocation with reason revoked", () => {
    const grant = createGrant();
    const revoked = revokeConsentGrant(grant, issuedAtEpochMs + 10_000);

    expect(
      evaluateConsentCapability(
        revoked,
        "view_recent_reports",
        beforeExpiryEpochMs,
      ),
    ).toEqual({
      allowed: false,
      reason: "revoked",
    });
  });

  it("allows AI summary only with explicit request_ai_summary capability", () => {
    const grant = createGrant({
      scope: "visit_packet",
      capabilities: ["view_visit_packet", "request_ai_summary"],
    });

    expect(canRequestAiSummary(grant, beforeExpiryEpochMs)).toBe(true);
    expect(
      canUseConsentCapability(
        grant,
        "request_ai_summary",
        beforeExpiryEpochMs,
      ),
    ).toBe(true);
  });

  it("denies AI summary when only document-view capability exists", () => {
    const grant = createGrant({
      scope: "visit_packet",
      capabilities: ["view_visit_packet"],
    });

    expect(canRequestAiSummary(grant, beforeExpiryEpochMs)).toBe(false);
    expect(
      evaluateConsentCapability(
        grant,
        "request_ai_summary",
        beforeExpiryEpochMs,
      ),
    ).toEqual({
      allowed: false,
      reason: "capability_not_granted",
    });
  });

  it("restricts emergency_viewer to emergency card only", () => {
    const grant = createGrant({
      recipientActorId: "emergency_01JAAA00000000000000000001",
      recipientActorType: "emergency_viewer",
      scope: "emergency_card",
      capabilities: ["view_emergency_card"],
      purpose: "emergency_care",
    });

    expect(
      canUseConsentCapability(
        grant,
        "view_emergency_card",
        beforeExpiryEpochMs,
      ),
    ).toBe(true);
  });

  it("rejects emergency_card scope with AI summary capability", () => {
    expectCreateToThrow(
      {
        recipientActorType: "emergency_viewer",
        scope: "emergency_card",
        capabilities: ["view_emergency_card", "request_ai_summary"],
        purpose: "emergency_care",
      },
      "emergency_card scope only allows view_emergency_card",
    );
  });

  it("rejects emergency_card scope with recent reports capability", () => {
    expectCreateToThrow(
      {
        recipientActorType: "emergency_viewer",
        scope: "emergency_card",
        capabilities: ["view_emergency_card", "view_recent_reports"],
        purpose: "emergency_care",
      },
      "emergency_card scope only allows view_emergency_card",
    );
  });

  it("rejects emergency_viewer outside emergency_card scope", () => {
    expectCreateToThrow(
      {
        recipientActorType: "emergency_viewer",
        scope: "recent_reports",
        capabilities: ["view_recent_reports"],
        purpose: "emergency_care",
      },
      "emergency_viewer may only use emergency_card scope",
    );
  });

  it("allows caregiver medication management", () => {
    const grant = createGrant({
      recipientActorId: "caregiver_01JAAA00000000000000000001",
      recipientActorType: "caregiver",
      scope: "medication_adherence",
      capabilities: ["manage_medication_adherence"],
      purpose: "caregiver_support",
    });

    expect(
      canUseConsentCapability(
        grant,
        "manage_medication_adherence",
        beforeExpiryEpochMs,
      ),
    ).toBe(true);
  });

  it("rejects caregiver AI summary capability", () => {
    expectCreateToThrow(
      {
        recipientActorId: "caregiver_01JAAA00000000000000000001",
        recipientActorType: "caregiver",
        scope: "current_medications",
        capabilities: ["view_current_medications", "request_ai_summary"],
        purpose: "caregiver_support",
      },
      "recipient actor type cannot use capability",
    );
  });

  it("rejects verified doctor caregiver-only medication management capability", () => {
    expectCreateToThrow(
      {
        recipientActorType: "verified_doctor",
        scope: "medication_adherence",
        capabilities: ["manage_medication_adherence"],
        purpose: "clinical_treatment",
      },
      "recipient actor type cannot use capability",
    );
  });

  it("requires resourceIds for specific_document_set", () => {
    expectCreateToThrow(
      {
        scope: "specific_document_set",
        capabilities: ["view_recent_reports"],
      },
      "specific_document_set requires resourceIds",
    );
  });

  it("rejects resourceIds outside specific_document_set", () => {
    expectCreateToThrow(
      {
        scope: "recent_reports",
        capabilities: ["view_recent_reports"],
        resourceIds: ["doc_01JAAA00000000000000000001"],
      },
      "resourceIds are allowed only for specific_document_set",
    );
  });

  it("rejects duplicate resourceIds", () => {
    expectCreateToThrow(
      {
        scope: "specific_document_set",
        capabilities: ["view_recent_reports"],
        resourceIds: [
          "doc_01JAAA00000000000000000001",
          "doc_01JAAA00000000000000000001",
        ],
      },
      "resourceIds must be unique",
    );
  });

  it("rejects empty resourceIds", () => {
    expectCreateToThrow(
      {
        scope: "specific_document_set",
        capabilities: ["view_recent_reports"],
        resourceIds: ["   "],
      },
      "resourceIds must not contain empty values",
    );
  });

  it("rejects sensitive labels in resourceIds", () => {
    expectCreateToThrow(
      {
        scope: "specific_document_set",
        capabilities: ["view_recent_reports"],
        resourceIds: ["hiv-report-2026"],
      },
      "forbidden consent grant metadata",
    );
  });

  it("rejects sensitive clinical labels in consent metadata", () => {
    expectCreateToThrow(
      {
        grantId: "mental-health-grant",
      },
      "forbidden consent grant metadata",
    );

    expectCreateToThrow(
      {
        recipientActorId: "doctor-hiv-special-note",
      },
      "forbidden consent grant metadata",
    );
  });

  it("does not serialize key material, medical payload, prescriptions, diagnoses, or lab values", () => {
    const grant = createGrant({
      scope: "specific_document_set",
      capabilities: ["view_recent_reports"],
      resourceIds: ["doc_01JAAA00000000000000000001"],
    });

    const serialized = JSON.stringify(grant).toLowerCase();

    expect(serialized).not.toContain("rawkeybytes");
    expect(serialized).not.toContain("k_root");
    expect(serialized).not.toContain("k_local_unlock");
    expect(serialized).not.toContain("local-unlock-v1");
    expect(serialized).not.toContain("sealed-key-envelope");
    expect(serialized).not.toContain("diagnosis");
    expect(serialized).not.toContain("prescription");
    expect(serialized).not.toContain("lab value");
    expect(serialized).not.toContain("hbA1c".toLowerCase());

    expect(() => assertNoConsentGrantMetadataLeak(grant)).not.toThrow();
  });

  it("rejects unsafe consent grant objects during explicit leak assertion", () => {
    const unsafeGrant = {
      grantId: "grant_unsafe",
      diagnosis: "private diagnosis text",
      prescription: "raw prescription text",
      rawKeyBytes: new Uint8Array(32).fill(1),
    };

    expect(() => assertNoConsentGrantMetadataLeak(unsafeGrant)).toThrow(
      "forbidden consent grant metadata",
    );
  });

  it("does not import Supabase, persistence, portal, AI service, BMDC, vault opening, sync, UI, or SecureStore modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/domain/consent/consentGrant.ts",
    );
    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    const forbiddenImports = [
      "supabase",
      "sqlite",
      "watermelondb",
      "bmdc",
      "vault-assembly",
      "localvaultassembly",
      "vault-open",
      "open-vault",
      "doctor-portal",
      "patient-portal",
      "ai-summary-service",
      "openai",
      "anthropic",
      "llm",
      "background-sync",
      "sync-engine",
      "securestore",
      "expo-secure-store",
      "from \"react\"",
      "from 'react'",
      "react-native",
      ".tsx",
    ];

    for (const token of forbiddenImports) {
      expect(source).not.toContain(token);
    }
  });
});