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
  type SharePacketResourceKind,
  type SharePacketResourceRef,
  type SharePacketType,
} from "../../share-packet/patientSharePacket";

import {
  assertNoPacketDocumentCompatibilityMetadataLeak,
  canAttachDocumentReferenceToPacket,
  evaluatePacketDocumentReferenceCompatibility,
} from "../sharePacketDocumentReferenceCompatibility";

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
  readonly resourceRef?: SharePacketResourceRef;
}): PatientSharePacket {
  const resourceRef =
    input?.resourceRef ??
    ({
      resourceId: "doc_01JAAA00000000000000000001",
      resourceKind: "report",
    } satisfies SharePacketResourceRef);

  return createPatientSharePacket({
    packetId: "packet_01JAAA00000000000000000001",
    consentGrant: input?.consentGrant ?? createGrant(),
    packetType: input?.packetType ?? "recent_reports_packet",
    resourceRefs: [resourceRef],
    createdAtEpochMs: packetCreatedAtEpochMs,
    expiresAtEpochMs: packetExpiresAtEpochMs,
  });
}

function createReference(input?: {
  readonly resourceId?: string;
  readonly resourceKind?: ClinicalDocumentResourceKind;
}): ClinicalDocumentReference {
  return createClinicalDocumentReference({
    referenceId: "cdr_01JAAA00000000000000000001",
    patientId: "patient_01JAAA00000000000000000001",
    resourceId: input?.resourceId ?? "doc_01JAAA00000000000000000001",
    resourceKind: input?.resourceKind ?? "encrypted_report",
    encryptedPayloadRef: "payload_01JAAA00000000000000000001",
    documentSchemaVersion: 1,
    createdAtEpochMs: packetCreatedAtEpochMs,
  });
}

function firstPacketRef(packet: PatientSharePacket): SharePacketResourceRef {
  return packet.resourceRefs[0];
}

describe("Share packet document reference compatibility contract", () => {
  it("allows report packet ref to attach to active encrypted_report reference with same resourceId", () => {
    const packet = createPacket();
    const documentReference = createReference();

    expect(
      evaluatePacketDocumentReferenceCompatibility({
        packet,
        packetResourceRef: firstPacketRef(packet),
        documentReference,
      }),
    ).toEqual({ compatible: true });
  });

  it("allows visit_packet ref to attach to encrypted_visit_packet reference", () => {
    const consentGrant = createGrant({
      scope: "visit_packet",
      capabilities: ["view_visit_packet"],
    });
    const packet = createPacket({
      consentGrant,
      packetType: "doctor_visit_packet",
      resourceRef: {
        resourceId: "visit_01JAAA00000000000000000001",
        resourceKind: "visit_packet",
      },
    });
    const documentReference = createReference({
      resourceId: "visit_01JAAA00000000000000000001",
      resourceKind: "encrypted_visit_packet",
    });

    expect(
      evaluatePacketDocumentReferenceCompatibility({
        packet,
        packetResourceRef: firstPacketRef(packet),
        documentReference,
      }),
    ).toEqual({ compatible: true });
  });

  it("allows current_medications ref to attach to encrypted_medication_snapshot reference", () => {
    const consentGrant = createGrant({
      scope: "current_medications",
      capabilities: ["view_current_medications"],
    });
    const packet = createPacket({
      consentGrant,
      packetType: "current_medications_packet",
      resourceRef: {
        resourceId: "med_01JAAA00000000000000000001",
        resourceKind: "current_medications",
      },
    });
    const documentReference = createReference({
      resourceId: "med_01JAAA00000000000000000001",
      resourceKind: "encrypted_medication_snapshot",
    });

    expect(
      evaluatePacketDocumentReferenceCompatibility({
        packet,
        packetResourceRef: firstPacketRef(packet),
        documentReference,
      }),
    ).toEqual({ compatible: true });
  });

  it("allows emergency_card ref to attach to encrypted_emergency_card reference", () => {
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
      resourceRef: {
        resourceId: "emg_01JAAA00000000000000000001",
        resourceKind: "emergency_card",
      },
    });
    const documentReference = createReference({
      resourceId: "emg_01JAAA00000000000000000001",
      resourceKind: "encrypted_emergency_card",
    });

    expect(
      evaluatePacketDocumentReferenceCompatibility({
        packet,
        packetResourceRef: firstPacketRef(packet),
        documentReference,
      }),
    ).toEqual({ compatible: true });
  });

  it("denies packetResourceRef that is not present in packet.resourceRefs", () => {
    const packet = createPacket();
    const documentReference = createReference();

    expect(
      evaluatePacketDocumentReferenceCompatibility({
        packet,
        packetResourceRef: {
          resourceId: "doc_01JAAA00000000000000000002",
          resourceKind: "report",
        },
        documentReference,
      }),
    ).toEqual({
      compatible: false,
      reason: "resource_ref_not_in_packet",
    });
  });

  it("denies resourceId mismatch", () => {
    const packet = createPacket();
    const documentReference = createReference({
      resourceId: "doc_01JAAA00000000000000000002",
    });

    expect(
      evaluatePacketDocumentReferenceCompatibility({
        packet,
        packetResourceRef: firstPacketRef(packet),
        documentReference,
      }),
    ).toEqual({
      compatible: false,
      reason: "resource_id_mismatch",
    });
  });

  it("denies revoked clinical document reference", () => {
    const packet = createPacket();
    const documentReference = revokeClinicalDocumentReference(
      createReference(),
      packetCreatedAtEpochMs + 1,
    );

    expect(
      evaluatePacketDocumentReferenceCompatibility({
        packet,
        packetResourceRef: firstPacketRef(packet),
        documentReference,
      }),
    ).toEqual({
      compatible: false,
      reason: "reference_revoked",
    });
  });

  it("denies report ref attached to encrypted_emergency_card reference", () => {
    const packet = createPacket();
    const documentReference = createReference({
      resourceKind: "encrypted_emergency_card",
    });

    expect(
      evaluatePacketDocumentReferenceCompatibility({
        packet,
        packetResourceRef: firstPacketRef(packet),
        documentReference,
      }),
    ).toEqual({
      compatible: false,
      reason: "resource_kind_mismatch",
    });
  });

  it("denies emergency_card ref attached to encrypted_report reference", () => {
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
      resourceRef: {
        resourceId: "emg_01JAAA00000000000000000001",
        resourceKind: "emergency_card",
      },
    });
    const documentReference = createReference({
      resourceId: "emg_01JAAA00000000000000000001",
      resourceKind: "encrypted_report",
    });

    expect(
      evaluatePacketDocumentReferenceCompatibility({
        packet,
        packetResourceRef: firstPacketRef(packet),
        documentReference,
      }),
    ).toEqual({
      compatible: false,
      reason: "resource_kind_mismatch",
    });
  });

  it("denies visit_packet ref attached to encrypted_report reference", () => {
    const consentGrant = createGrant({
      scope: "visit_packet",
      capabilities: ["view_visit_packet"],
    });
    const packet = createPacket({
      consentGrant,
      packetType: "doctor_visit_packet",
      resourceRef: {
        resourceId: "visit_01JAAA00000000000000000001",
        resourceKind: "visit_packet",
      },
    });
    const documentReference = createReference({
      resourceId: "visit_01JAAA00000000000000000001",
      resourceKind: "encrypted_report",
    });

    expect(
      evaluatePacketDocumentReferenceCompatibility({
        packet,
        packetResourceRef: firstPacketRef(packet),
        documentReference,
      }),
    ).toEqual({
      compatible: false,
      reason: "resource_kind_mismatch",
    });
  });

  it("denies current_medications ref attached to encrypted_report reference", () => {
    const consentGrant = createGrant({
      scope: "current_medications",
      capabilities: ["view_current_medications"],
    });
    const packet = createPacket({
      consentGrant,
      packetType: "current_medications_packet",
      resourceRef: {
        resourceId: "med_01JAAA00000000000000000001",
        resourceKind: "current_medications",
      },
    });
    const documentReference = createReference({
      resourceId: "med_01JAAA00000000000000000001",
      resourceKind: "encrypted_report",
    });

    expect(
      evaluatePacketDocumentReferenceCompatibility({
        packet,
        packetResourceRef: firstPacketRef(packet),
        documentReference,
      }),
    ).toEqual({
      compatible: false,
      reason: "resource_kind_mismatch",
    });
  });

  it("denies medication_adherence ref as unsupported for clinical document compatibility", () => {
    const consentGrant = createGrant({
      recipientActorId: "caregiver_01JAAA00000000000000000001",
      recipientActorType: "caregiver",
      scope: "medication_adherence",
      capabilities: ["manage_medication_adherence"],
      purpose: "caregiver_support",
    });
    const packet = createPacket({
      consentGrant,
      packetType: "caregiver_medication_packet",
      resourceRef: {
        resourceId: "adh_01JAAA00000000000000000001",
        resourceKind: "medication_adherence",
      },
    });
    const documentReference = createReference({
      resourceId: "adh_01JAAA00000000000000000001",
      resourceKind: "encrypted_medication_snapshot",
    });

    expect(
      evaluatePacketDocumentReferenceCompatibility({
        packet,
        packetResourceRef: firstPacketRef(packet),
        documentReference,
      }),
    ).toEqual({
      compatible: false,
      reason: "unsupported_packet_resource_kind",
    });
  });

  it("canAttachDocumentReferenceToPacket returns true for compatible refs", () => {
    const packet = createPacket();
    const documentReference = createReference();

    expect(
      canAttachDocumentReferenceToPacket({
        packet,
        packetResourceRef: firstPacketRef(packet),
        documentReference,
      }),
    ).toBe(true);
  });

  it("canAttachDocumentReferenceToPacket returns false for incompatible refs", () => {
    const packet = createPacket();
    const documentReference = createReference({
      resourceId: "doc_01JAAA00000000000000000002",
    });

    expect(
      canAttachDocumentReferenceToPacket({
        packet,
        packetResourceRef: firstPacketRef(packet),
        documentReference,
      }),
    ).toBe(false);
  });

  it("returns safe denial reasons without exposing medical data", () => {
    const packet = createPacket();
    const documentReference = createReference({
      resourceKind: "encrypted_emergency_card",
    });

    const result = evaluatePacketDocumentReferenceCompatibility({
      packet,
      packetResourceRef: firstPacketRef(packet),
      documentReference,
    });

    expect(result).toEqual({
      compatible: false,
      reason: "resource_kind_mismatch",
    });

    const serialized = JSON.stringify(result).toLowerCase();

    expect(serialized).not.toContain("diagnosis");
    expect(serialized).not.toContain("prescription");
    expect(serialized).not.toContain("lab value");
    expect(serialized).not.toContain("hba1c");
    expect(serialized).not.toContain("k_root");
    expect(serialized).not.toContain("local-unlock-v1");
  });

    it("rejects sensitive labels in packet resourceId", () => {
    const packet = {
      ...createPacket(),
      resourceRefs: [
        {
          resourceId: "hiv-report-2026",
          resourceKind: "report",
        },
      ],
    } as PatientSharePacket;

    const documentReference = {
      ...createReference(),
      resourceId: "hiv-report-2026",
    } as ClinicalDocumentReference;

    expect(
      evaluatePacketDocumentReferenceCompatibility({
        packet,
        packetResourceRef: packet.resourceRefs[0],
        documentReference,
      }),
    ).toEqual({
      compatible: false,
      reason: "forbidden_metadata",
    });
  });

  it("rejects sensitive labels in document reference resourceId", () => {
    const packet = createPacket();

    const documentReference = {
      ...createReference(),
      resourceId: "diabetes-lab-2026",
    } as ClinicalDocumentReference;

    expect(
      evaluatePacketDocumentReferenceCompatibility({
        packet,
        packetResourceRef: firstPacketRef(packet),
        documentReference,
      }),
    ).toEqual({
      compatible: false,
      reason: "forbidden_metadata",
    });
  });

  it("rejects sensitive labels in encryptedPayloadRef", () => {
    const packet = createPacket();
    const documentReference = {
      ...createReference(),
      encryptedPayloadRef: "payload/hba1c-result.pdf",
    } as ClinicalDocumentReference;

    expect(
      evaluatePacketDocumentReferenceCompatibility({
        packet,
        packetResourceRef: firstPacketRef(packet),
        documentReference,
      }),
    ).toEqual({
      compatible: false,
      reason: "forbidden_metadata",
    });
  });

  it("rejects unsafe compatibility objects during explicit metadata leak assertion", () => {
    const unsafe = {
      packetResourceRef: {
        resourceId: "mental-health-note",
        resourceKind: "report",
      },
      documentReference: {
        encryptedPayloadRef: "payload/hiv/report.pdf",
      },
      rawKeyBytes: new Uint8Array(32).fill(1),
    };

    expect(() =>
      assertNoPacketDocumentCompatibilityMetadataLeak(unsafe),
    ).toThrow("forbidden packet document compatibility metadata");
  });

  it("does not import Supabase, persistence, SecureStore, Expo, vault opening, document loading, document decryption, OCR, AI, portal, BMDC, file upload, sync, or React modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/domain/share-packet-reference/sharePacketDocumentReferenceCompatibility.ts",
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