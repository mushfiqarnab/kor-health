import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createConsentGrant,
  revokeConsentGrant,
  type ConsentGrant,
  type CreateConsentGrantInput,
} from "../../consent/consentGrant";

import {
  type PatientSharePacket,
  type SharePacketResourceRef,
  type SharePacketType,
} from "../../share-packet/patientSharePacket";

import {
  issuePatientSharePacketFromConsentGrant,
  type IssuePatientSharePacketFromConsentGrantInput,
} from "../sharePacketIssuance";

const grantIssuedAtEpochMs = 1_800_000_000_000;
const grantExpiresAtEpochMs = grantIssuedAtEpochMs + 3_600_000;
const packetIssuedAtEpochMs = grantIssuedAtEpochMs + 60_000;
const packetExpiresAtEpochMs = grantIssuedAtEpochMs + 600_000;

function createGrant(
  overrides: Partial<CreateConsentGrantInput> = {},
): ConsentGrant {
  return createConsentGrant({
    grantId: "grant_01JAAA00000000000000000001",
    grantorPatientId: "patient_01JAAA00000000000000000001",
    recipientActorId: "doctor_01JAAA00000000000000000001",
    recipientActorType: "verified_doctor",
    scope: "recent_reports",
    capabilities: ["view_recent_reports"],
    purpose: "clinical_treatment",
    issuedAtEpochMs: grantIssuedAtEpochMs,
    expiresAtEpochMs: grantExpiresAtEpochMs,
    ...overrides,
  });
}

function reportRefs(
  overrides: Partial<SharePacketResourceRef> = {},
): readonly SharePacketResourceRef[] {
  return [
    {
      resourceId: "doc_01JAAA00000000000000000001",
      resourceKind: "report",
      ...overrides,
    },
  ];
}

function baseInput(
  overrides: Partial<IssuePatientSharePacketFromConsentGrantInput> = {},
): IssuePatientSharePacketFromConsentGrantInput {
  return {
    packetId: "packet_01JAAA00000000000000000001",
    consentGrant: createGrant(),
    packetType: "recent_reports_packet",
    resourceRefs: reportRefs(),
    issuedAtEpochMs: packetIssuedAtEpochMs,
    expiresAtEpochMs: packetExpiresAtEpochMs,
    ...overrides,
  };
}

function issuePacket(
  overrides: Partial<IssuePatientSharePacketFromConsentGrantInput> = {},
): PatientSharePacket {
  return issuePatientSharePacketFromConsentGrant(baseInput(overrides));
}

function expectIssueToThrow(
  overrides: Partial<IssuePatientSharePacketFromConsentGrantInput>,
  message: string,
): void {
  expect(() => issuePatientSharePacketFromConsentGrant(baseInput(overrides))).toThrow(
    message,
  );
}

describe("Share packet issuance from consent grant contract", () => {
  it("issues a frozen metadata-only recent reports packet from an active consent grant", () => {
    const packet = issuePacket();

    expect(packet).toEqual({
      packetId: "packet_01JAAA00000000000000000001",
      consentGrantId: "grant_01JAAA00000000000000000001",
      grantorPatientId: "patient_01JAAA00000000000000000001",
      recipientActorId: "doctor_01JAAA00000000000000000001",
      recipientActorType: "verified_doctor",
      packetType: "recent_reports_packet",
      resourceRefs: [
        {
          resourceId: "doc_01JAAA00000000000000000001",
          resourceKind: "report",
        },
      ],
      createdAtEpochMs: packetIssuedAtEpochMs,
      expiresAtEpochMs: packetExpiresAtEpochMs,
      aiProcessingAllowed: false,
    });

    expect(Object.isFrozen(packet)).toBe(true);
    expect(Object.isFrozen(packet.resourceRefs)).toBe(true);
    expect(Object.isFrozen(packet.resourceRefs[0])).toBe(true);
  });

  it("does not mutate the source consent grant or resource refs", () => {
    const consentGrant = createGrant();
    const resourceRefs = reportRefs();
    const grantSnapshot = JSON.stringify(consentGrant);
    const refsSnapshot = JSON.stringify(resourceRefs);

    const packet = issuePacket({ consentGrant, resourceRefs });

    expect(packet.consentGrantId).toBe(consentGrant.grantId);
    expect(JSON.stringify(consentGrant)).toBe(grantSnapshot);
    expect(JSON.stringify(resourceRefs)).toBe(refsSnapshot);
  });

  it("maps caregiver medication consent into a caregiver medication packet", () => {
    const consentGrant = createGrant({
      recipientActorId: "caregiver_01JAAA00000000000000000001",
      recipientActorType: "caregiver",
      scope: "medication_adherence",
      capabilities: ["manage_medication_adherence"],
      purpose: "caregiver_support",
    });

    const packet = issuePacket({
      consentGrant,
      packetType: "caregiver_medication_packet",
      resourceRefs: [
        {
          resourceId: "med_01JAAA00000000000000000001",
          resourceKind: "medication_adherence",
        },
      ],
    });

    expect(packet.recipientActorType).toBe("caregiver");
    expect(packet.packetType).toBe("caregiver_medication_packet");
    expect(packet.resourceRefs).toEqual([
      {
        resourceId: "med_01JAAA00000000000000000001",
        resourceKind: "medication_adherence",
      },
    ]);
  });

  it("issues an AI summary source packet only as a permissioned source packet without AI output", () => {
    const consentGrant = createGrant({
      scope: "recent_reports",
      capabilities: ["view_recent_reports", "request_ai_summary"],
    });

    const packet = issuePacket({
      consentGrant,
      packetType: "ai_summary_source_packet",
    });

    expect(packet.packetType).toBe("ai_summary_source_packet");
    expect(packet.aiProcessingAllowed).toBe(true);
    expect("aiSummary" in packet).toBe(false);
    expect("aiOutput" in packet).toBe(false);
  });

  it("allows specific document packet only for granted opaque resource refs", () => {
    const consentGrant = createGrant({
      scope: "specific_document_set",
      capabilities: ["view_recent_reports"],
      resourceIds: [
        "doc_01JAAA00000000000000000001",
        "doc_01JAAA00000000000000000002",
      ],
    });

    const packet = issuePacket({
      consentGrant,
      packetType: "specific_document_packet",
      resourceRefs: [
        {
          resourceId: "doc_01JAAA00000000000000000002",
          resourceKind: "report",
        },
      ],
    });

    expect(packet.packetType).toBe("specific_document_packet");
    expect(packet.resourceRefs).toEqual([
      {
        resourceId: "doc_01JAAA00000000000000000002",
        resourceKind: "report",
      },
    ]);
  });

  it("rejects expired and revoked consent grants through packet issuance", () => {
    const expiredGrant = createGrant({
      expiresAtEpochMs: packetIssuedAtEpochMs,
    });

    expectIssueToThrow(
      { consentGrant: expiredGrant },
      "consent grant is not active",
    );

    const revokedGrant = revokeConsentGrant(
      createGrant(),
      packetIssuedAtEpochMs - 1,
    );

    expectIssueToThrow(
      { consentGrant: revokedGrant },
      "consent grant is not active",
    );
  });

  it("rejects packet expiry after consent grant expiry", () => {
    expectIssueToThrow(
      { expiresAtEpochMs: grantExpiresAtEpochMs + 1 },
      "packet expiry cannot exceed consent grant expiry",
    );
  });

  it("rejects unsupported packet types and incompatible resource refs through delegated packet validation", () => {
    expectIssueToThrow(
      { packetType: "full_vault_packet" as SharePacketType },
      "unsupported share packet type",
    );

    expectIssueToThrow(
      {
        packetType: "recent_reports_packet",
        resourceRefs: [
          {
            resourceId: "med_01JAAA00000000000000000001",
            resourceKind: "current_medications",
          },
        ],
      },
      "packet type does not allow resource kind",
    );
  });

  it("rejects unsafe packet issuance metadata before packet creation", () => {
    expectIssueToThrow(
      { packetId: "packet_hiv_report" },
      "forbidden share packet issuance metadata",
    );
  });

  it("delegates packet creation to the patient share packet domain instead of duplicating packet law", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/domain/share-packet-issuance/sharePacketIssuance.ts",
    );
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toMatch(
      /import\s*\{\s*createPatientSharePacket[\s\S]*\}\s*from\s*["']\.\.\/share-packet\/patientSharePacket["'];/,
    );
  });

  it("does not import access requests, consent transition, clinical document references, selected references, Supabase, persistence, SecureStore, Expo, BMDC, AI service, vault opening, sync, UI, or portal modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/domain/share-packet-issuance/sharePacketIssuance.ts",
    );
    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    const forbiddenImports = [
      "../access-request",
      "../access-request-consent",
      "../clinical-document",
      "clinicaldocumentreference",
      "sharepacketclinicalreferenceselection",
      "selectedreference",
      "selectedreferences",
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
