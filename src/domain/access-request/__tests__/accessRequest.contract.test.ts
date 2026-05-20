import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertNoAccessRequestMetadataLeak,
  createAccessRequest,
  evaluateAccessRequestStatus,
  isAccessRequestExpired,
  isAccessRequestPending,
  isAccessRequestWithdrawn,
  withdrawAccessRequest,
  type AccessRequest,
  type AccessRequestCapability,
  type AccessRequestPurpose,
  type AccessRequestRequesterActorType,
  type AccessRequestScope,
  type CreateAccessRequestInput,
} from "../accessRequest";

const createdAtEpochMs = 1_800_000_000_000;
const expiresAtEpochMs = createdAtEpochMs + 600_000;
const beforeExpiryEpochMs = createdAtEpochMs + 60_000;
const atExpiryEpochMs = expiresAtEpochMs;
const withdrawnAtEpochMs = createdAtEpochMs + 120_000;

function baseInput(
  overrides: Partial<CreateAccessRequestInput> = {},
): CreateAccessRequestInput {
  return {
    accessRequestId: "access_req_01JAAA00000000000000000001",
    requesterActorId: "doctor_01JAAA00000000000000000001",
    requesterActorType: "verified_doctor",
    targetKorId: "kor_01JAAA00000000000000000001",
    requestedScope: "recent_reports",
    requestedCapabilities: ["view_recent_reports"],
    requestedPurpose: "clinical_treatment",
    createdAtEpochMs,
    expiresAtEpochMs,
    ...overrides,
  };
}

function createRequest(
  overrides: Partial<CreateAccessRequestInput> = {},
): AccessRequest {
  return createAccessRequest(baseInput(overrides));
}

function expectCreateToThrow(
  overrides: Partial<CreateAccessRequestInput>,
  message: string,
): void {
  expect(() => createAccessRequest(baseInput(overrides))).toThrow(message);
}

describe("Access request domain contract", () => {
  it("creates a frozen pending access request without granting access", () => {
    const request = createRequest();

    expect(request).toEqual({
      accessRequestId: "access_req_01JAAA00000000000000000001",
      requesterActorId: "doctor_01JAAA00000000000000000001",
      requesterActorType: "verified_doctor",
      targetKorId: "kor_01JAAA00000000000000000001",
      requestedScope: "recent_reports",
      requestedCapabilities: ["view_recent_reports"],
      requestedPurpose: "clinical_treatment",
      createdAtEpochMs,
      expiresAtEpochMs,
    });

    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.requestedCapabilities)).toBe(true);
    expect(isAccessRequestPending(request, beforeExpiryEpochMs)).toBe(true);
    expect(evaluateAccessRequestStatus(request, beforeExpiryEpochMs)).toBe(
      "pending",
    );

    expect("consentGrantId" in request).toBe(false);
    expect("grantId" in request).toBe(false);
    expect("sharePacketId" in request).toBe(false);
    expect("resourceIds" in request).toBe(false);
    expect("approvedAtEpochMs" in request).toBe(false);
    expect("deniedAtEpochMs" in request).toBe(false);
  });

  it("rejects empty identifiers", () => {
    expectCreateToThrow(
      { accessRequestId: "   " },
      "accessRequestId must not be empty",
    );
    expectCreateToThrow(
      { requesterActorId: "   " },
      "requesterActorId must not be empty",
    );
    expectCreateToThrow(
      { targetKorId: "   " },
      "targetKorId must not be empty",
    );
  });

  it("rejects zero, negative, non-integer, or non-forward timestamps", () => {
    expectCreateToThrow(
      { createdAtEpochMs: 0 },
      "createdAtEpochMs must be a positive integer",
    );
    expectCreateToThrow(
      { expiresAtEpochMs: -1 },
      "expiresAtEpochMs must be a positive integer",
    );
    expectCreateToThrow(
      { createdAtEpochMs: 1.5 },
      "createdAtEpochMs must be a positive integer",
    );
    expectCreateToThrow(
      { expiresAtEpochMs: createdAtEpochMs },
      "expiresAtEpochMs must be after createdAtEpochMs",
    );
    expectCreateToThrow(
      { expiresAtEpochMs: createdAtEpochMs - 1 },
      "expiresAtEpochMs must be after createdAtEpochMs",
    );
  });

  it("rejects unsupported actor type, scope, purpose, and capability", () => {
    expectCreateToThrow(
      {
        requesterActorType:
          "unverified_doctor" as AccessRequestRequesterActorType,
      },
      "unsupported access request actor type",
    );

    expectCreateToThrow(
      {
        requestedScope: "specific_document_set" as AccessRequestScope,
      },
      "unsupported access request scope",
    );

    expectCreateToThrow(
      {
        requestedPurpose: "general_browsing" as AccessRequestPurpose,
      },
      "unsupported access request purpose",
    );

    expectCreateToThrow(
      {
        requestedCapabilities: ["view_full_vault" as AccessRequestCapability],
      },
      "unsupported access request capability",
    );
  });

  it("rejects empty or duplicate requested capabilities", () => {
    expectCreateToThrow(
      { requestedCapabilities: [] },
      "requestedCapabilities must not be empty",
    );

    expectCreateToThrow(
      {
        requestedCapabilities: [
          "view_recent_reports",
          "view_recent_reports",
        ],
      },
      "requestedCapabilities must be unique",
    );
  });

  it("enforces requester actor capability compatibility", () => {
    expectCreateToThrow(
      {
        requesterActorType: "caregiver",
        requesterActorId: "caregiver_01JAAA00000000000000000001",
        requestedScope: "recent_reports",
        requestedCapabilities: ["view_recent_reports"],
        requestedPurpose: "caregiver_support",
      },
      "requester actor type cannot request capability",
    );

    expectCreateToThrow(
      {
        requesterActorType: "verified_doctor",
        requestedScope: "medication_adherence",
        requestedCapabilities: ["manage_medication_adherence"],
        requestedPurpose: "clinical_treatment",
      },
      "requester actor type cannot request capability",
    );
  });

  it("enforces requested scope capability compatibility", () => {
    expectCreateToThrow(
      {
        requestedScope: "recent_reports",
        requestedCapabilities: ["view_visit_packet"],
      },
      "requested scope does not allow capability",
    );

    expectCreateToThrow(
      {
        requestedScope: "current_medications",
        requestedCapabilities: ["view_recent_reports"],
      },
      "requested scope does not allow capability",
    );
  });

  it("restricts emergency viewer requests to emergency card only", () => {
    const request = createRequest({
      accessRequestId: "access_req_01JEMG00000000000000001",
      requesterActorId: "emergency_01JAAA00000000000000000001",
      requesterActorType: "emergency_viewer",
      requestedScope: "emergency_card",
      requestedCapabilities: ["view_emergency_card"],
      requestedPurpose: "emergency_care",
    });

    expect(request.requesterActorType).toBe("emergency_viewer");
    expect(request.requestedScope).toBe("emergency_card");

    expectCreateToThrow(
      {
        requesterActorId: "emergency_01JAAA00000000000000000001",
        requesterActorType: "emergency_viewer",
        requestedScope: "recent_reports",
        requestedCapabilities: ["view_recent_reports"],
        requestedPurpose: "emergency_care",
      },
      "emergency_viewer may only request emergency_card scope",
    );

    expectCreateToThrow(
      {
        requesterActorId: "emergency_01JAAA00000000000000000001",
        requesterActorType: "emergency_viewer",
        requestedScope: "emergency_card",
        requestedCapabilities: ["view_emergency_card", "request_ai_summary"],
        requestedPurpose: "emergency_care",
      },
      "emergency_card requests only allow view_emergency_card",
    );
  });

  it("allows doctor AI summary requests only with a source-view capability", () => {
    const request = createRequest({
      requestedScope: "recent_reports",
      requestedCapabilities: ["view_recent_reports", "request_ai_summary"],
      requestedPurpose: "clinical_treatment",
    });

    expect(request.requestedCapabilities).toEqual([
      "view_recent_reports",
      "request_ai_summary",
    ]);

    expectCreateToThrow(
      {
        requestedScope: "recent_reports",
        requestedCapabilities: ["request_ai_summary"],
        requestedPurpose: "clinical_treatment",
      },
      "AI summary requests require source-view capability",
    );
  });

  it("allows caregiver medication access requests without granting access", () => {
    const request = createRequest({
      requesterActorId: "caregiver_01JAAA00000000000000000001",
      requesterActorType: "caregiver",
      requestedScope: "medication_adherence",
      requestedCapabilities: ["manage_medication_adherence"],
      requestedPurpose: "caregiver_support",
    });

    expect(request.requesterActorType).toBe("caregiver");
    expect(request.requestedScope).toBe("medication_adherence");
    expect("consentGrantId" in request).toBe(false);
  });

  it("reports expired requests at expiresAtEpochMs", () => {
    const request = createRequest();

    expect(isAccessRequestExpired(request, beforeExpiryEpochMs)).toBe(false);
    expect(isAccessRequestExpired(request, atExpiryEpochMs)).toBe(true);
    expect(isAccessRequestPending(request, atExpiryEpochMs)).toBe(false);
    expect(evaluateAccessRequestStatus(request, atExpiryEpochMs)).toBe(
      "expired",
    );
  });

  it("withdraws a request without mutating the original request", () => {
    const request = createRequest();
    const withdrawn = withdrawAccessRequest(request, withdrawnAtEpochMs);

    expect(request.withdrawnAtEpochMs).toBeUndefined();
    expect(withdrawn.withdrawnAtEpochMs).toBe(withdrawnAtEpochMs);
    expect(Object.isFrozen(withdrawn)).toBe(true);
    expect(Object.isFrozen(withdrawn.requestedCapabilities)).toBe(true);
    expect(isAccessRequestWithdrawn(withdrawn)).toBe(true);
    expect(isAccessRequestPending(withdrawn, beforeExpiryEpochMs)).toBe(false);
    expect(evaluateAccessRequestStatus(withdrawn, beforeExpiryEpochMs)).toBe(
      "withdrawn",
    );
  });

  it("withdrawal is idempotent", () => {
    const request = createRequest();
    const withdrawn = withdrawAccessRequest(request, withdrawnAtEpochMs);
    const secondWithdrawal = withdrawAccessRequest(
      withdrawn,
      withdrawnAtEpochMs + 10_000,
    );

    expect(secondWithdrawal).toBe(withdrawn);
    expect(secondWithdrawal.withdrawnAtEpochMs).toBe(withdrawnAtEpochMs);
  });

  it("rejects withdrawal before request creation", () => {
    const request = createRequest();

    expect(() =>
      withdrawAccessRequest(request, createdAtEpochMs - 1),
    ).toThrow("withdrawnAtEpochMs cannot be before createdAtEpochMs");
  });

  it("rejects sensitive labels and identifiers in access request metadata", () => {
    expectCreateToThrow(
      {
        accessRequestId: "access_req_hiv_report",
      },
      "forbidden access request metadata",
    );

    expectCreateToThrow(
      {
        targetKorId: "kor_phone_01700000000",
      },
      "forbidden access request metadata",
    );

    expectCreateToThrow(
      {
        requesterActorId: "doctor_nid_123456",
      },
      "forbidden access request metadata",
    );
  });

  it("rejects unsafe access request objects during explicit metadata leak assertion", () => {
    const unsafeRequest = {
      accessRequestId: "access_req_unsafe",
      diagnosis: "private diagnosis text",
      prescription: "raw prescription text",
      resourceIds: ["doc_01JAAA00000000000000000001"],
      rawKeyBytes: new Uint8Array(32).fill(1),
    };

    expect(() => assertNoAccessRequestMetadataLeak(unsafeRequest)).toThrow(
      "forbidden access request metadata",
    );
  });

  it("rejects unsafe identity and clinical key shapes without rejecting safe request id fields", () => {
    const unsafeIdentityMetadata = {
      accessRequestId: "access_req_01JAAA00000000000000000001",
      patientNid: "opaque",
    };

    const unsafeContactMetadata = {
      accessRequestId: "access_req_01JAAA00000000000000000001",
      phoneNumber: "opaque",
    };

    const unsafeClinicalMetadata = {
      accessRequestId: "access_req_01JAAA00000000000000000001",
      diagnosisText: "opaque",
    };

    const safeRequestIdOnly = {
      accessRequestId: "access_req_01JAAA00000000000000000001",
    };

    expect(() =>
      assertNoAccessRequestMetadataLeak(unsafeIdentityMetadata),
    ).toThrow("forbidden access request metadata");
    expect(() =>
      assertNoAccessRequestMetadataLeak(unsafeContactMetadata),
    ).toThrow("forbidden access request metadata");
    expect(() =>
      assertNoAccessRequestMetadataLeak(unsafeClinicalMetadata),
    ).toThrow("forbidden access request metadata");
    expect(() => assertNoAccessRequestMetadataLeak(safeRequestIdOnly)).not.toThrow();
  });

  it("does not import consent grants, share packets, document references, Supabase, persistence, SecureStore, Expo, BMDC, AI service, vault opening, sync, UI, or portal modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/domain/access-request/accessRequest.ts",
    );
    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    const forbiddenImports = [
      "../consent",
      "consentgrant",
      "../share-packet",
      "patientsharepacket",
      "../clinical-document",
      "clinicaldocumentreference",
      "sharepacketclinicalreferenceselection",
      "supabase",
      "sqlite",
      "watermelondb",
      "securestore",
      "expo-secure-store",
      "expo-local-authentication",
      "bmdc",
      "vault-assembly",
      "localvaultassembly",
      "vault-open",
      "open-vault",
      "decrypt",
      "document-decryption",
      "doctor-portal",
      "patient-portal",
      "ai-summary-service",
      "openai",
      "anthropic",
      "llm",
      "background-sync",
      "sync-engine",
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

