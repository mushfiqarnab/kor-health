import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createClinicalDocumentReference,
  revokeClinicalDocumentReference,
  type ClinicalDocumentReference,
  type ClinicalDocumentResourceKind,
} from "../../clinical-document/clinicalDocumentReference";

import {
  createConsentGrant,
  type ConsentGrant,
  type CreateConsentGrantInput,
} from "../../consent/consentGrant";

import {
  createPatientSharePacket,
  type PatientSharePacket,
  type SharePacketResourceRef,
  type SharePacketType,
} from "../../share-packet/patientSharePacket";

import { selectClinicalDocumentReferencesForSharePacket } from "../sharePacketClinicalReferenceSelection";

const issuedAtEpochMs = 1_800_000_000_000;
const grantExpiresAtEpochMs = issuedAtEpochMs + 3_600_000;
const packetCreatedAtEpochMs = issuedAtEpochMs + 60_000;
const packetExpiresAtEpochMs = issuedAtEpochMs + 600_000;
const revokedAtEpochMs = packetCreatedAtEpochMs + 120_000;

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

function createPacket(input?: {
  readonly consentGrant?: ConsentGrant;
  readonly packetType?: SharePacketType;
  readonly resourceRefs?: readonly SharePacketResourceRef[];
}): PatientSharePacket {
  return createPatientSharePacket({
    packetId: "packet_01JAAA00000000000000000001",
    consentGrant: input?.consentGrant ?? createGrant(),
    packetType: input?.packetType ?? "recent_reports_packet",
    resourceRefs:
      input?.resourceRefs ??
      [
        {
          resourceId: "doc_01JAAA00000000000000000001",
          resourceKind: "report",
        },
      ],
    createdAtEpochMs: packetCreatedAtEpochMs,
    expiresAtEpochMs: packetExpiresAtEpochMs,
  });
}

function createSpecificDocumentPacket(
  resourceRefs: readonly SharePacketResourceRef[],
): PatientSharePacket {
  return createPacket({
    consentGrant: createGrant({
      scope: "specific_document_set",
      capabilities: ["view_recent_reports", "view_visit_packet"],
      resourceIds: resourceRefs.map((ref) => ref.resourceId),
    }),
    packetType: "specific_document_packet",
    resourceRefs,
  });
}

function createCaregiverMedicationPacket(
  resourceRefs: readonly SharePacketResourceRef[],
): PatientSharePacket {
  return createPacket({
    consentGrant: createGrant({
      recipientActorId: "caregiver_01JAAA00000000000000000001",
      recipientActorType: "caregiver",
      scope: "current_medications",
      capabilities: ["view_current_medications"],
      purpose: "caregiver_support",
    }),
    packetType: "caregiver_medication_packet",
    resourceRefs,
  });
}

function createReference(input?: {
  readonly referenceId?: string;
  readonly resourceId?: string;
  readonly resourceKind?: ClinicalDocumentResourceKind;
  readonly encryptedPayloadRef?: string;
}): ClinicalDocumentReference {
  return createClinicalDocumentReference({
    referenceId: input?.referenceId ?? "cdr_01JAAA00000000000000000001",
    patientId: "patient_01JAAA00000000000000000001",
    resourceId: input?.resourceId ?? "doc_01JAAA00000000000000000001",
    resourceKind: input?.resourceKind ?? "encrypted_report",
    encryptedPayloadRef:
      input?.encryptedPayloadRef ?? "payload_01JAAA00000000000000000001",
    documentSchemaVersion: 1,
    createdAtEpochMs: packetCreatedAtEpochMs,
  });
}

describe("Share packet clinical reference selection contract", () => {
  it("selects active compatible references in packet resource-ref order", () => {
    const visitResourceId = "visit_01JAAA00000000000000000001";
    const reportResourceId = "doc_01JAAA00000000000000000001";

    const packet = createSpecificDocumentPacket([
      {
        resourceId: visitResourceId,
        resourceKind: "visit_packet",
      },
      {
        resourceId: reportResourceId,
        resourceKind: "report",
      },
    ]);

    const reportReference = createReference({
      referenceId: "cdr_report_01JAAA00000000000000001",
      resourceId: reportResourceId,
      resourceKind: "encrypted_report",
      encryptedPayloadRef: "payload_report_01JAAA00000000000001",
    });
    const visitReference = createReference({
      referenceId: "cdr_visit_01JAAA00000000000000001",
      resourceId: visitResourceId,
      resourceKind: "encrypted_visit_packet",
      encryptedPayloadRef: "payload_visit_01JAAA00000000000001",
    });

    const selected = selectClinicalDocumentReferencesForSharePacket({
      packet,
      candidateReferences: [reportReference, visitReference],
    });

    expect(selected).toEqual([visitReference, reportReference]);
  });

  it("excludes inactive document references", () => {
    const packet = createPacket();
    const revokedReference = revokeClinicalDocumentReference(
      createReference(),
      revokedAtEpochMs,
    );

    const selected = selectClinicalDocumentReferencesForSharePacket({
      packet,
      candidateReferences: [revokedReference],
    });

    expect(selected).toEqual([]);
  });

  it("excludes document references not present in packet refs", () => {
    const packet = createPacket();
    const unrelatedReference = createReference({
      referenceId: "cdr_other_01JAAA00000000000000001",
      resourceId: "doc_01JAAA00000000000000000099",
      encryptedPayloadRef: "payload_other_01JAAA00000000000001",
    });

    const selected = selectClinicalDocumentReferencesForSharePacket({
      packet,
      candidateReferences: [unrelatedReference],
    });

    expect(selected).toEqual([]);
  });

  it("excludes incompatible broad resource kinds through the compatibility bridge", () => {
    const packet = createPacket();
    const incompatibleReference = createReference({
      referenceId: "cdr_emg_01JAAA000000000000000001",
      resourceKind: "encrypted_emergency_card",
      encryptedPayloadRef: "payload_emg_01JAAA000000000000001",
    });

    const selected = selectClinicalDocumentReferencesForSharePacket({
      packet,
      candidateReferences: [incompatibleReference],
    });

    expect(selected).toEqual([]);
  });

  it("excludes medication_adherence through Slice 16 compatibility behavior", () => {
    const adherenceResourceId = "adh_01JAAA00000000000000000001";
    const packet = createCaregiverMedicationPacket([
      {
        resourceId: adherenceResourceId,
        resourceKind: "medication_adherence",
      },
    ]);
    const candidateReference = createReference({
      referenceId: "cdr_adh_01JAAA000000000000000001",
      resourceId: adherenceResourceId,
      resourceKind: "encrypted_medication_snapshot",
      encryptedPayloadRef: "payload_adh_01JAAA000000000000001",
    });

    const selected = selectClinicalDocumentReferencesForSharePacket({
      packet,
      candidateReferences: [candidateReference],
    });

    expect(selected).toEqual([]);
  });

  it("chooses the first compatible active candidate when duplicates exist", () => {
    const packet = createPacket();
    const firstReference = createReference({
      referenceId: "cdr_first_01JAAA0000000000000001",
      encryptedPayloadRef: "payload_first_01JAAA000000000001",
    });
    const secondReference = createReference({
      referenceId: "cdr_second_01JAAA000000000000001",
      encryptedPayloadRef: "payload_second_01JAAA00000000001",
    });

    const selected = selectClinicalDocumentReferencesForSharePacket({
      packet,
      candidateReferences: [firstReference, secondReference],
    });

    expect(selected).toEqual([firstReference]);
  });

  it("returns an empty array when no compatible active references exist", () => {
    const packet = createPacket();

    const selected = selectClinicalDocumentReferencesForSharePacket({
      packet,
      candidateReferences: [],
    });

    expect(selected).toEqual([]);
  });

  it("does not mutate packet or candidate references", () => {
    const packet = createPacket();
    const candidateReferences = [createReference()];
    const packetSnapshot = JSON.stringify(packet);
    const candidatesSnapshot = JSON.stringify(candidateReferences);

    const selected = selectClinicalDocumentReferencesForSharePacket({
      packet,
      candidateReferences,
    });

    expect(selected).toEqual(candidateReferences);
    expect(JSON.stringify(packet)).toBe(packetSnapshot);
    expect(JSON.stringify(candidateReferences)).toBe(candidatesSnapshot);
  });

  it("does not import Supabase, persistence, SecureStore, Expo, vault opening, document loading, document decryption, OCR, AI, portal, BMDC, file upload, sync, or React modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/domain/share-packet-reference/sharePacketClinicalReferenceSelection.ts",
    );
    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    const forbiddenImports = [
      "supabase",
      "sqlite",
      "watermelondb",
      "securestore",
      "expo-secure-store",
      "expo-local-authentication",
      "vault-assembly",
      "localvaultassembly",
      "vault-open",
      "open-vault",
      "load-document",
      "document-loader",
      "decrypt",
      "document-decryption",
      "ocr",
      "ai-summary",
      "openai",
      "anthropic",
      "llm",
      "doctor-portal",
      "patient-portal",
      "bmdc",
      "file-upload",
      "upload-service",
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
