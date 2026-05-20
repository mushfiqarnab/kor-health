import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createAccessRequest,
  withdrawAccessRequest,
  type AccessRequest,
  type CreateAccessRequestInput,
} from "../../access-request/accessRequest";

import {
  type ConsentGrant,
} from "../../consent/consentGrant";

import {
  createConsentGrantFromApprovedAccessRequest,
  type CreateConsentGrantFromApprovedAccessRequestInput,
} from "../accessRequestConsentGrantTransition";

const requestCreatedAtEpochMs = 1_800_000_000_000;
const requestExpiresAtEpochMs = requestCreatedAtEpochMs + 600_000;
const approvedAtEpochMs = requestCreatedAtEpochMs + 60_000;
const grantExpiresAtEpochMs = approvedAtEpochMs + 3_600_000;

function createRequest(
  overrides: Partial<CreateAccessRequestInput> = {},
): AccessRequest {
  return createAccessRequest({
    accessRequestId: "access_req_01JAAA00000000000000000001",
    requesterActorId: "doctor_01JAAA00000000000000000001",
    requesterActorType: "verified_doctor",
    targetKorId: "kor_01JAAA00000000000000000001",
    requestedScope: "recent_reports",
    requestedCapabilities: ["view_recent_reports"],
    requestedPurpose: "clinical_treatment",
    createdAtEpochMs: requestCreatedAtEpochMs,
    expiresAtEpochMs: requestExpiresAtEpochMs,
    ...overrides,
  });
}

function baseInput(
  overrides: Partial<CreateConsentGrantFromApprovedAccessRequestInput> = {},
): CreateConsentGrantFromApprovedAccessRequestInput {
  return {
    grantId: "grant_01JAAA00000000000000000001",
    grantorPatientId: "patient_01JAAA00000000000000000001",
    approvingPatientKorId: "kor_01JAAA00000000000000000001",
    accessRequest: createRequest(),
    approvedAtEpochMs,
    grantExpiresAtEpochMs,
    ...overrides,
  };
}

function createGrant(
  overrides: Partial<CreateConsentGrantFromApprovedAccessRequestInput> = {},
): ConsentGrant {
  return createConsentGrantFromApprovedAccessRequest(baseInput(overrides));
}

function expectCreateToThrow(
  overrides: Partial<CreateConsentGrantFromApprovedAccessRequestInput>,
  message: string,
): void {
  expect(() =>
    createConsentGrantFromApprovedAccessRequest(baseInput(overrides)),
  ).toThrow(message);
}

describe("Access request to consent grant transition contract", () => {
  it("creates a frozen consent grant from a patient-approved pending access request", () => {
    const grant = createGrant();

    expect(grant).toEqual({
      grantId: "grant_01JAAA00000000000000000001",
      grantorPatientId: "patient_01JAAA00000000000000000001",
      recipientActorId: "doctor_01JAAA00000000000000000001",
      recipientActorType: "verified_doctor",
      scope: "recent_reports",
      capabilities: ["view_recent_reports"],
      purpose: "clinical_treatment",
      issuedAtEpochMs: approvedAtEpochMs,
      expiresAtEpochMs: grantExpiresAtEpochMs,
    });

    expect(Object.isFrozen(grant)).toBe(true);
    expect(Object.isFrozen(grant.capabilities)).toBe(true);
    expect("accessRequestId" in grant).toBe(false);
    expect("targetKorId" in grant).toBe(false);
    expect("sharePacketId" in grant).toBe(false);
    expect("resourceIds" in grant).toBe(false);
    expect("selectedReferences" in grant).toBe(false);
    expect("approvedAtEpochMs" in grant).toBe(false);
    expect("deniedAtEpochMs" in grant).toBe(false);
  });

  it("does not mutate the source access request", () => {
    const accessRequest = createRequest();
    const snapshot = JSON.stringify(accessRequest);

    const grant = createGrant({ accessRequest });

    expect(grant.recipientActorId).toBe(accessRequest.requesterActorId);
    expect(JSON.stringify(accessRequest)).toBe(snapshot);
  });

  it("maps caregiver medication request fields into a consent grant without granting document access", () => {
    const accessRequest = createRequest({
      requesterActorId: "caregiver_01JAAA00000000000000000001",
      requesterActorType: "caregiver",
      requestedScope: "medication_adherence",
      requestedCapabilities: ["manage_medication_adherence"],
      requestedPurpose: "caregiver_support",
    });

    const grant = createGrant({ accessRequest });

    expect(grant.recipientActorId).toBe(
      "caregiver_01JAAA00000000000000000001",
    );
    expect(grant.recipientActorType).toBe("caregiver");
    expect(grant.scope).toBe("medication_adherence");
    expect(grant.capabilities).toEqual(["manage_medication_adherence"]);
    expect("sharePacketId" in grant).toBe(false);
    expect("resourceIds" in grant).toBe(false);
  });

  it("maps explicit AI summary request capability without calling AI", () => {
    const accessRequest = createRequest({
      requestedScope: "recent_reports",
      requestedCapabilities: ["view_recent_reports", "request_ai_summary"],
      requestedPurpose: "clinical_treatment",
    });

    const grant = createGrant({ accessRequest });

    expect(grant.capabilities).toEqual([
      "view_recent_reports",
      "request_ai_summary",
    ]);
    expect("aiSummary" in grant).toBe(false);
    expect("aiOutput" in grant).toBe(false);
  });

  it("rejects approval when the approving patient KOr ID does not match the request target KOr ID", () => {
    expectCreateToThrow(
      {
        approvingPatientKorId: "kor_01JBBB00000000000000000002",
      },
      "approvingPatientKorId must match access request targetKorId",
    );
  });

  it("rejects approval before request creation", () => {
    expectCreateToThrow(
      {
        approvedAtEpochMs: requestCreatedAtEpochMs - 1,
      },
      "approvedAtEpochMs cannot be before access request createdAtEpochMs",
    );
  });

  it("rejects expired access requests", () => {
    expectCreateToThrow(
      {
        approvedAtEpochMs: requestExpiresAtEpochMs,
      },
      "access request is not pending",
    );
  });

  it("rejects withdrawn access requests", () => {
    const withdrawnRequest = withdrawAccessRequest(
      createRequest(),
      requestCreatedAtEpochMs + 10_000,
    );

    expectCreateToThrow(
      {
        accessRequest: withdrawnRequest,
      },
      "access request is not pending",
    );
  });

  it("rejects empty grant and patient identifiers", () => {
    expectCreateToThrow(
      { grantId: "   " },
      "grantId must not be empty",
    );

    expectCreateToThrow(
      { grantorPatientId: "   " },
      "grantorPatientId must not be empty",
    );

    expectCreateToThrow(
      { approvingPatientKorId: "   " },
      "approvingPatientKorId must not be empty",
    );
  });

  it("rejects invalid approval timestamps and consent expiry through transition validation", () => {
    expectCreateToThrow(
      { approvedAtEpochMs: 0 },
      "approvedAtEpochMs must be a positive integer",
    );

    expectCreateToThrow(
      { approvedAtEpochMs: 1.5 },
      "approvedAtEpochMs must be a positive integer",
    );

    expectCreateToThrow(
      { grantExpiresAtEpochMs: approvedAtEpochMs },
      "expiresAtEpochMs must be after issuedAtEpochMs",
    );

    expectCreateToThrow(
      { grantExpiresAtEpochMs: approvedAtEpochMs - 1 },
      "expiresAtEpochMs must be after issuedAtEpochMs",
    );
  });

  it("rejects sensitive metadata in transition identifiers before consent creation", () => {
    expectCreateToThrow(
      {
        grantId: "grant_hiv_report",
      },
      "forbidden access request consent transition metadata",
    );

    expectCreateToThrow(
      {
        approvingPatientKorId: "kor_phone_01700000000",
      },
      "forbidden access request consent transition metadata",
    );

    expectCreateToThrow(
      {
        grantorPatientId: "patient_nid_123456",
      },
      "forbidden access request consent transition metadata",
    );
  });

  it("does not import share packets, document references, Supabase, persistence, SecureStore, Expo, BMDC, AI service, vault opening, sync, UI, portal, resource selection, or selected-reference modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/domain/access-request-consent/accessRequestConsentGrantTransition.ts",
    );
    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    const forbiddenImports = [
      "../share-packet",
      "patientsharepacket",
      "../clinical-document",
      "clinicaldocumentreference",
      "sharepacketclinicalreferenceselection",
      "resourceids",
      "selectedreferences",
      "selectedreference",
      "documentreferences",
      "documentreferenceids",
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
