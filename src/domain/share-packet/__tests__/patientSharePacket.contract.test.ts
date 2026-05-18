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
  assertNoPatientSharePacketMetadataLeak,
  createPatientSharePacket,
  isPatientSharePacketActive,
  isPatientSharePacketExpired,
  type CreatePatientSharePacketInput,
  type PatientSharePacket,
  type SharePacketResourceKind,
  type SharePacketType,
} from "../patientSharePacket";

const issuedAtEpochMs = 1_800_000_000_000;
const grantExpiresAtEpochMs = issuedAtEpochMs + 3_600_000;
const packetCreatedAtEpochMs = issuedAtEpochMs + 60_000;
const packetExpiresAtEpochMs = issuedAtEpochMs + 600_000;

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
    issuedAtEpochMs,
    expiresAtEpochMs: grantExpiresAtEpochMs,
    ...overrides,
  });
}

function basePacketInput(
  overrides: Partial<CreatePatientSharePacketInput> = {},
): CreatePatientSharePacketInput {
  return {
    packetId: "packet_01JAAA00000000000000000001",
    consentGrant: createGrant(),
    packetType: "recent_reports_packet",
    resourceRefs: [
      {
        resourceId: "doc_01JAAA00000000000000000001",
        resourceKind: "report",
      },
    ],
    createdAtEpochMs: packetCreatedAtEpochMs,
    expiresAtEpochMs: packetExpiresAtEpochMs,
    ...overrides,
  };
}

function createPacket(
  overrides: Partial<CreatePatientSharePacketInput> = {},
): PatientSharePacket {
  return createPatientSharePacket(basePacketInput(overrides));
}

function expectCreateToThrow(
  overrides: Partial<CreatePatientSharePacketInput>,
  message: string,
): void {
  expect(() => createPatientSharePacket(basePacketInput(overrides))).toThrow(
    message,
  );
}

describe("Patient share packet domain contract", () => {
  it("creates a frozen recent reports packet from an active grant", () => {
    const packet = createPacket();

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
      createdAtEpochMs: packetCreatedAtEpochMs,
      expiresAtEpochMs: packetExpiresAtEpochMs,
      aiProcessingAllowed: false,
    });
    expect(Object.isFrozen(packet)).toBe(true);
    expect(Object.isFrozen(packet.resourceRefs)).toBe(true);
    expect(Object.isFrozen(packet.resourceRefs[0])).toBe(true);
  });

  it("copies patient and recipient identity from the consent grant", () => {
    const consentGrant = createGrant({
      grantorPatientId: "patient_01JBBB00000000000000000002",
      recipientActorId: "doctor_01JBBB00000000000000000002",
    });

    const packet = createPacket({ consentGrant });

    expect(packet.consentGrantId).toBe(consentGrant.grantId);
    expect(packet.grantorPatientId).toBe(consentGrant.grantorPatientId);
    expect(packet.recipientActorId).toBe(consentGrant.recipientActorId);
    expect(packet.recipientActorType).toBe(consentGrant.recipientActorType);
  });

  it("rejects empty packetId", () => {
    expectCreateToThrow({ packetId: "   " }, "packetId must not be empty");
  });

  it("rejects zero or negative createdAtEpochMs", () => {
    expectCreateToThrow(
      { createdAtEpochMs: 0 },
      "createdAtEpochMs must be a positive integer",
    );
    expectCreateToThrow(
      { createdAtEpochMs: -1 },
      "createdAtEpochMs must be a positive integer",
    );
  });

  it("rejects zero or negative expiresAtEpochMs", () => {
    expectCreateToThrow(
      { expiresAtEpochMs: 0 },
      "expiresAtEpochMs must be a positive integer",
    );
    expectCreateToThrow(
      { expiresAtEpochMs: -1 },
      "expiresAtEpochMs must be a positive integer",
    );
  });

  it("rejects unsafe non-integer timestamps", () => {
    expectCreateToThrow(
      { createdAtEpochMs: 1.5 },
      "createdAtEpochMs must be a positive integer",
    );
    expectCreateToThrow(
      { expiresAtEpochMs: 1.5 },
      "expiresAtEpochMs must be a positive integer",
    );
  });

  it("rejects expiry before createdAtEpochMs", () => {
    expectCreateToThrow(
      { expiresAtEpochMs: packetCreatedAtEpochMs - 1 },
      "expiresAtEpochMs must be after createdAtEpochMs",
    );
  });

  it("rejects expiry equal to createdAtEpochMs", () => {
    expectCreateToThrow(
      { expiresAtEpochMs: packetCreatedAtEpochMs },
      "expiresAtEpochMs must be after createdAtEpochMs",
    );
  });

  it("rejects packet expiry after grant expiry", () => {
    expectCreateToThrow(
      { expiresAtEpochMs: grantExpiresAtEpochMs + 1 },
      "packet expiry cannot exceed consent grant expiry",
    );
  });

  it("rejects packet creation from expired grant", () => {
    const consentGrant = createGrant({
      expiresAtEpochMs: packetCreatedAtEpochMs,
    });

    expectCreateToThrow(
      { consentGrant },
      "consent grant is not active",
    );
  });

  it("rejects packet creation from revoked grant", () => {
    const consentGrant = revokeConsentGrant(
      createGrant(),
      packetCreatedAtEpochMs - 1,
    );

    expectCreateToThrow(
      { consentGrant },
      "consent grant is not active",
    );
  });

  it("rejects empty resourceRefs", () => {
    expectCreateToThrow(
      { resourceRefs: [] },
      "resourceRefs must not be empty",
    );
  });

  it("rejects duplicate resourceIds", () => {
    expectCreateToThrow(
      {
        resourceRefs: [
          {
            resourceId: "doc_01JAAA00000000000000000001",
            resourceKind: "report",
          },
          {
            resourceId: "doc_01JAAA00000000000000000001",
            resourceKind: "report",
          },
        ],
      },
      "resourceIds must be unique",
    );
  });

  it("rejects empty resourceId", () => {
    expectCreateToThrow(
      {
        resourceRefs: [
          {
            resourceId: "   ",
            resourceKind: "report",
          },
        ],
      },
      "resourceId must not be empty",
    );
  });

  it("rejects unsupported resourceKind", () => {
    expectCreateToThrow(
      {
        resourceRefs: [
          {
            resourceId: "doc_01JAAA00000000000000000001",
            resourceKind: "diagnosis_note" as SharePacketResourceKind,
          },
        ],
      },
      "unsupported share packet resource kind",
    );
  });

  it("rejects unsupported packetType", () => {
    expectCreateToThrow(
      {
        packetType: "full_vault_packet" as SharePacketType,
      },
      "unsupported share packet type",
    );
  });

  it("rejects sensitive labels in resourceIds", () => {
    expectCreateToThrow(
      {
        resourceRefs: [
          {
            resourceId: "hiv-report-2026",
            resourceKind: "report",
          },
        ],
      },
      "forbidden patient share packet metadata",
    );
  });

  it("requires view_recent_reports for recent_reports_packet", () => {
    const consentGrant = createGrant({
      scope: "visit_packet",
      capabilities: ["view_visit_packet"],
    });

    expectCreateToThrow(
      { consentGrant },
      "consent grant does not allow packet capability",
    );
  });

  it("requires view_current_medications for current_medications_packet", () => {
    const consentGrant = createGrant({
      scope: "recent_reports",
      capabilities: ["view_recent_reports"],
    });

    expectCreateToThrow(
      {
        consentGrant,
        packetType: "current_medications_packet",
        resourceRefs: [
          {
            resourceId: "med_01JAAA00000000000000000001",
            resourceKind: "current_medications",
          },
        ],
      },
      "consent grant does not allow packet capability",
    );
  });

  it("requires view_visit_packet for doctor_visit_packet", () => {
    const consentGrant = createGrant({
      scope: "recent_reports",
      capabilities: ["view_recent_reports"],
    });

    expectCreateToThrow(
      {
        consentGrant,
        packetType: "doctor_visit_packet",
        resourceRefs: [
          {
            resourceId: "visit_01JAAA00000000000000000001",
            resourceKind: "visit_packet",
          },
        ],
      },
      "consent grant does not allow packet capability",
    );
  });

  it("requires view_emergency_card for emergency_card_packet", () => {
    const consentGrant = createGrant({
      scope: "recent_reports",
      capabilities: ["view_recent_reports"],
    });

    expectCreateToThrow(
      {
        consentGrant,
        packetType: "emergency_card_packet",
        resourceRefs: [
          {
            resourceId: "emg_01JAAA00000000000000000001",
            resourceKind: "emergency_card",
          },
        ],
      },
      "consent grant does not allow packet capability",
    );
  });

  it("requires caregiver medication capability for caregiver_medication_packet", () => {
    const consentGrant = createGrant({
      recipientActorId: "caregiver_01JAAA00000000000000000001",
      recipientActorType: "caregiver",
      scope: "current_medications",
      capabilities: ["view_current_medications"],
      purpose: "caregiver_support",
    });

    const packet = createPacket({
      consentGrant,
      packetType: "caregiver_medication_packet",
      resourceRefs: [
        {
          resourceId: "med_01JAAA00000000000000000001",
          resourceKind: "current_medications",
        },
      ],
    });

    expect(packet.packetType).toBe("caregiver_medication_packet");
  });

  it("rejects caregiver_medication_packet without medication capability", () => {
    const consentGrant = createGrant({
      scope: "recent_reports",
      capabilities: ["view_recent_reports"],
    });

    expectCreateToThrow(
      {
        consentGrant,
        packetType: "caregiver_medication_packet",
        resourceRefs: [
          {
            resourceId: "med_01JAAA00000000000000000001",
            resourceKind: "current_medications",
          },
        ],
      },
      "consent grant does not allow packet capability",
    );
  });

  it("rejects AI source packet without request_ai_summary", () => {
    const consentGrant = createGrant({
      scope: "recent_reports",
      capabilities: ["view_recent_reports"],
    });

    expectCreateToThrow(
      {
        consentGrant,
        packetType: "ai_summary_source_packet",
      },
      "consent grant does not allow AI summary packet",
    );
  });

  it("rejects AI source packet when request_ai_summary exists but no source-view capability exists", () => {
    const consentGrant = createGrant({
      scope: "recent_reports",
      capabilities: ["request_ai_summary"],
    });

    expectCreateToThrow(
      {
        consentGrant,
        packetType: "ai_summary_source_packet",
      },
      "AI summary packet requires source-view capability",
    );
  });

  it("allows AI source packet with explicit request_ai_summary and source-view capability", () => {
    const consentGrant = createGrant({
      scope: "recent_reports",
      capabilities: ["view_recent_reports", "request_ai_summary"],
    });

    const packet = createPacket({
      consentGrant,
      packetType: "ai_summary_source_packet",
    });

    expect(packet.packetType).toBe("ai_summary_source_packet");
    expect(packet.aiProcessingAllowed).toBe(true);
  });

  it("sets aiProcessingAllowed true only for ai_summary_source_packet", () => {
    const consentGrant = createGrant({
      scope: "recent_reports",
      capabilities: ["view_recent_reports", "request_ai_summary"],
    });

    const packet = createPacket({
      consentGrant,
      packetType: "ai_summary_source_packet",
    });

    expect(packet.aiProcessingAllowed).toBe(true);
  });

  it("sets aiProcessingAllowed false for normal document packets even when grant has AI permission", () => {
    const consentGrant = createGrant({
      scope: "recent_reports",
      capabilities: ["view_recent_reports", "request_ai_summary"],
    });

    const packet = createPacket({
      consentGrant,
      packetType: "recent_reports_packet",
    });

    expect(packet.aiProcessingAllowed).toBe(false);
  });

  it("emergency_card_packet allows only emergency_card refs", () => {
    const consentGrant = createGrant({
      grantId: "grant_01JEMG00000000000000000001",
      recipientActorId: "emergency_01JAAA00000000000000000001",
      recipientActorType: "emergency_viewer",
      scope: "emergency_card",
      capabilities: ["view_emergency_card"],
      purpose: "emergency_care",
    });

    const packet = createPacket({
      consentGrant,
      packetType: "emergency_card_packet",
      resourceRefs: [
        {
          resourceId: "emg_01JAAA00000000000000000001",
          resourceKind: "emergency_card",
        },
      ],
    });

    expect(packet.packetType).toBe("emergency_card_packet");
  });

  it("rejects emergency_card_packet with report refs", () => {
    const consentGrant = createGrant({
      grantId: "grant_01JEMG00000000000000000001",
      recipientActorId: "emergency_01JAAA00000000000000000001",
      recipientActorType: "emergency_viewer",
      scope: "emergency_card",
      capabilities: ["view_emergency_card"],
      purpose: "emergency_care",
    });

    expectCreateToThrow(
      {
        consentGrant,
        packetType: "emergency_card_packet",
        resourceRefs: [
          {
            resourceId: "doc_01JAAA00000000000000000001",
            resourceKind: "report",
          },
        ],
      },
      "packet type does not allow resource kind",
    );
  });

  it("rejects recent_reports_packet with medication refs", () => {
    expectCreateToThrow(
      {
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

  it("rejects current_medications_packet with report refs", () => {
    const consentGrant = createGrant({
      scope: "current_medications",
      capabilities: ["view_current_medications"],
    });

    expectCreateToThrow(
      {
        consentGrant,
        packetType: "current_medications_packet",
        resourceRefs: [
          {
            resourceId: "doc_01JAAA00000000000000000001",
            resourceKind: "report",
          },
        ],
      },
      "packet type does not allow resource kind",
    );
  });

  it("rejects doctor_visit_packet with report refs", () => {
    const consentGrant = createGrant({
      scope: "visit_packet",
      capabilities: ["view_visit_packet"],
    });

    expectCreateToThrow(
      {
        consentGrant,
        packetType: "doctor_visit_packet",
        resourceRefs: [
          {
            resourceId: "doc_01JAAA00000000000000000001",
            resourceKind: "report",
          },
        ],
      },
      "packet type does not allow resource kind",
    );
  });

  it("requires specific_document_packet to use specific_document_set grant scope", () => {
    const consentGrant = createGrant({
      scope: "recent_reports",
      capabilities: ["view_recent_reports"],
    });

    expectCreateToThrow(
      {
        consentGrant,
        packetType: "specific_document_packet",
      },
      "specific_document_packet requires specific_document_set scope",
    );
  });

  it("specific_document_packet allows only granted resourceIds", () => {
    const consentGrant = createGrant({
      scope: "specific_document_set",
      capabilities: ["view_recent_reports"],
      resourceIds: [
        "doc_01JAAA00000000000000000001",
        "doc_01JAAA00000000000000000002",
      ],
    });

    const packet = createPacket({
      consentGrant,
      packetType: "specific_document_packet",
      resourceRefs: [
        {
          resourceId: "doc_01JAAA00000000000000000001",
          resourceKind: "report",
        },
      ],
    });

    expect(packet.resourceRefs).toEqual([
      {
        resourceId: "doc_01JAAA00000000000000000001",
        resourceKind: "report",
      },
    ]);
  });

  it("specific_document_packet rejects resourceIds outside grant.resourceIds", () => {
    const consentGrant = createGrant({
      scope: "specific_document_set",
      capabilities: ["view_recent_reports"],
      resourceIds: [
        "doc_01JAAA00000000000000000001",
        "doc_01JAAA00000000000000000002",
      ],
    });

    expectCreateToThrow(
      {
        consentGrant,
        packetType: "specific_document_packet",
        resourceRefs: [
          {
            resourceId: "doc_01JAAA00000000000000000003",
            resourceKind: "report",
          },
        ],
      },
      "packet resourceIds must be included in consent grant resourceIds",
    );
  });

  it("packet cannot serialize medical content or key material", () => {
    const packet = createPacket();

    const serialized = JSON.stringify(packet).toLowerCase();

    expect(serialized).not.toContain("rawkeybytes");
    expect(serialized).not.toContain("k_root");
    expect(serialized).not.toContain("k_local_unlock");
    expect(serialized).not.toContain("local-unlock-v1");
    expect(serialized).not.toContain("sealed-key-envelope");
    expect(serialized).not.toContain("diagnosis");
    expect(serialized).not.toContain("prescription");
    expect(serialized).not.toContain("lab value");
    expect(serialized).not.toContain("hba1c");

    expect(() => assertNoPatientSharePacketMetadataLeak(packet)).not.toThrow();
  });

  it("rejects unsafe packet objects during explicit metadata leak assertion", () => {
    const unsafePacket = {
      packetId: "packet_unsafe",
      diagnosis: "private diagnosis text",
      prescription: "raw prescription text",
      rawKeyBytes: new Uint8Array(32).fill(1),
    };

    expect(() => assertNoPatientSharePacketMetadataLeak(unsafePacket)).toThrow(
      "forbidden patient share packet metadata",
    );
  });

  it("does not import Supabase, persistence, SecureStore, Expo, BMDC, AI service, vault opening, document decryption, sync, UI, or portal modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/domain/share-packet/patientSharePacket.ts",
    );
    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    const forbiddenImports = [
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