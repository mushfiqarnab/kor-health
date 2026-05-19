import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createClinicalDocumentReference,
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

import { selectClinicalDocumentReferencesForSharePacketResult } from "../sharePacketClinicalReferenceSelectionResult";

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

describe("Share packet clinical reference selection result contract", () => {
  it("returns selected references with non-sensitive selection counts", () => {
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

    const result = selectClinicalDocumentReferencesForSharePacketResult({
      packet,
      candidateReferences: [reportReference, visitReference],
    });

    expect(result).toEqual({
      selectedReferences: [visitReference, reportReference],
      selectedReferenceCount: 2,
      packetResourceRefCount: 2,
      candidateReferenceCount: 2,
      unmatchedPacketResourceRefCount: 0,
    });
  });

  it("counts unmatched packet resource refs without exposing exclusion reasons or resource ids", () => {
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

    const result = selectClinicalDocumentReferencesForSharePacketResult({
      packet,
      candidateReferences: [reportReference],
    });

    expect(result.selectedReferences).toEqual([reportReference]);
    expect(result.selectedReferenceCount).toBe(1);
    expect(result.packetResourceRefCount).toBe(2);
    expect(result.candidateReferenceCount).toBe(1);
    expect(result.unmatchedPacketResourceRefCount).toBe(1);

    expect(Object.keys(result).sort()).toEqual([
      "candidateReferenceCount",
      "packetResourceRefCount",
      "selectedReferenceCount",
      "selectedReferences",
      "unmatchedPacketResourceRefCount",
    ]);
    expect("exclusionReasons" in result).toBe(false);
    expect("excludedResourceIds" in result).toBe(false);
    expect("unmatchedResourceIds" in result).toBe(false);
  });

  it("returns zero selected references and safe counts when nothing matches", () => {
    const packet = createPacket();

    const result = selectClinicalDocumentReferencesForSharePacketResult({
      packet,
      candidateReferences: [],
    });

    expect(result).toEqual({
      selectedReferences: [],
      selectedReferenceCount: 0,
      packetResourceRefCount: 1,
      candidateReferenceCount: 0,
      unmatchedPacketResourceRefCount: 1,
    });
  });

  it("does not mutate packet or candidate references", () => {
    const packet = createPacket();
    const candidateReferences = [createReference()];
    const packetSnapshot = JSON.stringify(packet);
    const candidatesSnapshot = JSON.stringify(candidateReferences);

    const result = selectClinicalDocumentReferencesForSharePacketResult({
      packet,
      candidateReferences,
    });

    expect(result.selectedReferences).toEqual(candidateReferences);
    expect(JSON.stringify(packet)).toBe(packetSnapshot);
    expect(JSON.stringify(candidateReferences)).toBe(candidatesSnapshot);
  });

  it("wraps the Slice 17 selector instead of importing the Slice 16 compatibility bridge directly", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/domain/share-packet-reference/sharePacketClinicalReferenceSelectionResult.ts",
    );
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toMatch(
      /import\s*\{\s*selectClinicalDocumentReferencesForSharePacket\s*\}\s*from\s*["']\.\/sharePacketClinicalReferenceSelection["'];/,
    );
    expect(source).not.toContain("canAttachDocumentReferenceToPacket");
  });

  it("does not import infrastructure, UI, AI, OCR, sync, storage, portal, or vault-opening modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/domain/share-packet-reference/sharePacketClinicalReferenceSelectionResult.ts",
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

