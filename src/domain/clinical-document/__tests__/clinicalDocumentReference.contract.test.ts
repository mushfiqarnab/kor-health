import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertNoClinicalDocumentReferenceMetadataLeak,
  canReferenceBeShared,
  createClinicalDocumentReference,
  isClinicalDocumentReferenceActive,
  isClinicalDocumentReferenceRevoked,
  revokeClinicalDocumentReference,
  type ClinicalDocumentReference,
  type ClinicalDocumentResourceKind,
  type CreateClinicalDocumentReferenceInput,
} from "../clinicalDocumentReference";

const createdAtEpochMs = 1_800_000_000_000;
const updatedAtEpochMs = createdAtEpochMs + 60_000;
const revokedAtEpochMs = createdAtEpochMs + 120_000;

function baseInput(
  overrides: Partial<CreateClinicalDocumentReferenceInput> = {},
): CreateClinicalDocumentReferenceInput {
  return {
    referenceId: "cdr_01JAAA00000000000000000001",
    patientId: "patient_01JAAA00000000000000000001",
    resourceId: "doc_01JAAA00000000000000000001",
    resourceKind: "encrypted_report",
    encryptedPayloadRef: "payload_01JAAA00000000000000000001",
    documentSchemaVersion: 1,
    createdAtEpochMs,
    ...overrides,
  };
}

function createReference(
  overrides: Partial<CreateClinicalDocumentReferenceInput> = {},
): ClinicalDocumentReference {
  return createClinicalDocumentReference(baseInput(overrides));
}

function expectCreateToThrow(
  overrides: Partial<CreateClinicalDocumentReferenceInput>,
  message: string,
): void {
  expect(() => createClinicalDocumentReference(baseInput(overrides))).toThrow(
    message,
  );
}

describe("Clinical document reference domain contract", () => {
  it("creates a frozen encrypted report reference", () => {
    const reference = createReference();

    expect(reference).toEqual({
      referenceId: "cdr_01JAAA00000000000000000001",
      patientId: "patient_01JAAA00000000000000000001",
      resourceId: "doc_01JAAA00000000000000000001",
      resourceKind: "encrypted_report",
      encryptedPayloadRef: "payload_01JAAA00000000000000000001",
      documentSchemaVersion: 1,
      createdAtEpochMs,
    });
    expect(Object.isFrozen(reference)).toBe(true);
  });

  it("creates a frozen encrypted emergency card reference", () => {
    const reference = createReference({
      resourceId: "emg_01JAAA00000000000000000001",
      resourceKind: "encrypted_emergency_card",
      encryptedPayloadRef: "payload_01JEMG00000000000000000001",
    });

    expect(reference.resourceKind).toBe("encrypted_emergency_card");
    expect(Object.isFrozen(reference)).toBe(true);
  });

  it("creates a reference with updatedAtEpochMs", () => {
    const reference = createReference({ updatedAtEpochMs });

    expect(reference.updatedAtEpochMs).toBe(updatedAtEpochMs);
  });

  it("rejects empty referenceId", () => {
    expectCreateToThrow(
      { referenceId: "   " },
      "referenceId must not be empty",
    );
  });

  it("rejects empty patientId", () => {
    expectCreateToThrow({ patientId: "   " }, "patientId must not be empty");
  });

  it("rejects empty resourceId", () => {
    expectCreateToThrow(
      { resourceId: "   " },
      "resourceId must not be empty",
    );
  });

  it("rejects empty encryptedPayloadRef", () => {
    expectCreateToThrow(
      { encryptedPayloadRef: "   " },
      "encryptedPayloadRef must not be empty",
    );
  });

  it("rejects unsupported resourceKind", () => {
    expectCreateToThrow(
      {
        resourceKind: "encrypted_diagnosis_note" as ClinicalDocumentResourceKind,
      },
      "unsupported clinical document resource kind",
    );
  });

  it("rejects clinically semantic resourceKind", () => {
    expectCreateToThrow(
      {
        resourceKind: "hiv_report" as ClinicalDocumentResourceKind,
      },
      "unsupported clinical document resource kind",
    );

    expectCreateToThrow(
      {
        resourceKind: "mental_health_note" as ClinicalDocumentResourceKind,
      },
      "unsupported clinical document resource kind",
    );
  });

  it("rejects zero or negative documentSchemaVersion", () => {
    expectCreateToThrow(
      { documentSchemaVersion: 0 },
      "documentSchemaVersion must be a positive integer",
    );
    expectCreateToThrow(
      { documentSchemaVersion: -1 },
      "documentSchemaVersion must be a positive integer",
    );
  });

  it("rejects non-integer documentSchemaVersion", () => {
    expectCreateToThrow(
      { documentSchemaVersion: 1.5 },
      "documentSchemaVersion must be a positive integer",
    );
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

  it("rejects non-integer createdAtEpochMs", () => {
    expectCreateToThrow(
      { createdAtEpochMs: 1.5 },
      "createdAtEpochMs must be a positive integer",
    );
  });

  it("rejects updatedAtEpochMs before createdAtEpochMs", () => {
    expectCreateToThrow(
      { updatedAtEpochMs: createdAtEpochMs - 1 },
      "updatedAtEpochMs cannot be before createdAtEpochMs",
    );
  });

  it("rejects non-integer updatedAtEpochMs", () => {
    expectCreateToThrow(
      { updatedAtEpochMs: 1.5 },
      "updatedAtEpochMs must be a positive integer",
    );
  });

  it("rejects revokedAtEpochMs before createdAtEpochMs", () => {
    expectCreateToThrow(
      { revokedAtEpochMs: createdAtEpochMs - 1 },
      "revokedAtEpochMs cannot be before createdAtEpochMs",
    );
  });

  it("rejects non-integer revokedAtEpochMs", () => {
    expectCreateToThrow(
      { revokedAtEpochMs: 1.5 },
      "revokedAtEpochMs must be a positive integer",
    );
  });

  it("reports new reference as active and not revoked", () => {
    const reference = createReference();

    expect(isClinicalDocumentReferenceActive(reference)).toBe(true);
    expect(isClinicalDocumentReferenceRevoked(reference)).toBe(false);
    expect(canReferenceBeShared(reference)).toBe(true);
  });

  it("revokes reference without mutating original", () => {
    const reference = createReference();

    const revoked = revokeClinicalDocumentReference(
      reference,
      revokedAtEpochMs,
    );

    expect(reference.revokedAtEpochMs).toBeUndefined();
    expect(revoked.revokedAtEpochMs).toBe(revokedAtEpochMs);
    expect(Object.isFrozen(revoked)).toBe(true);
  });

  it("revocation is idempotent", () => {
    const reference = createReference();
    const revoked = revokeClinicalDocumentReference(
      reference,
      revokedAtEpochMs,
    );

    const secondRevocation = revokeClinicalDocumentReference(
      revoked,
      revokedAtEpochMs + 60_000,
    );

    expect(secondRevocation).toBe(revoked);
    expect(secondRevocation.revokedAtEpochMs).toBe(revokedAtEpochMs);
  });

  it("rejects revocation before createdAtEpochMs", () => {
    const reference = createReference();

    expect(() =>
      revokeClinicalDocumentReference(reference, createdAtEpochMs - 1),
    ).toThrow("revokedAtEpochMs cannot be before createdAtEpochMs");
  });

  it("revoked reference is inactive", () => {
    const reference = createReference();
    const revoked = revokeClinicalDocumentReference(
      reference,
      revokedAtEpochMs,
    );

    expect(isClinicalDocumentReferenceRevoked(revoked)).toBe(true);
    expect(isClinicalDocumentReferenceActive(revoked)).toBe(false);
  });

  it("canReferenceBeShared returns true only for active references", () => {
    const reference = createReference();
    const revoked = revokeClinicalDocumentReference(
      reference,
      revokedAtEpochMs,
    );

    expect(canReferenceBeShared(reference)).toBe(true);
    expect(canReferenceBeShared(revoked)).toBe(false);
  });

  it("rejects sensitive labels in referenceId", () => {
    expectCreateToThrow(
      { referenceId: "mental-health-reference" },
      "forbidden clinical document reference metadata",
    );
  });

  it("rejects sensitive labels in patientId", () => {
    expectCreateToThrow(
      { patientId: "patient-phone-01700000000" },
      "forbidden clinical document reference metadata",
    );
  });

  it("rejects sensitive labels in resourceId", () => {
    expectCreateToThrow(
      { resourceId: "diabetes-lab-2026" },
      "forbidden clinical document reference metadata",
    );

    expectCreateToThrow(
      { resourceId: "pregnancy-ultrasound" },
      "forbidden clinical document reference metadata",
    );
  });

  it("rejects sensitive labels in encryptedPayloadRef", () => {
    expectCreateToThrow(
      { encryptedPayloadRef: "payload/hiv/report.pdf" },
      "forbidden clinical document reference metadata",
    );
  });

  it("rejects raw URL-style payload paths with clinical labels", () => {
    expectCreateToThrow(
      {
        encryptedPayloadRef:
          "https://storage.example.test/reports/hba1c-result.pdf",
      },
      "forbidden clinical document reference metadata",
    );
  });

  it("does not serialize key material, medical payload, diagnoses, prescriptions, lab values, or patient contact data", () => {
    const reference = createReference();

    const serialized = JSON.stringify(reference).toLowerCase();

    expect(serialized).not.toContain("rawkeybytes");
    expect(serialized).not.toContain("k_root");
    expect(serialized).not.toContain("k_local_unlock");
    expect(serialized).not.toContain("local-unlock-v1");
    expect(serialized).not.toContain("sealed-key-envelope");
    expect(serialized).not.toContain("diagnosis");
    expect(serialized).not.toContain("prescription");
    expect(serialized).not.toContain("lab value");
    expect(serialized).not.toContain("hba1c");
    expect(serialized).not.toContain("phone");
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("nid");

    expect(() =>
      assertNoClinicalDocumentReferenceMetadataLeak(reference),
    ).not.toThrow();
  });

  it("rejects unsafe reference objects during explicit leak assertion", () => {
    const unsafeReference = {
      referenceId: "cdr_unsafe",
      diagnosis: "private diagnosis text",
      prescription: "raw prescription text",
      rawKeyBytes: new Uint8Array(32).fill(1),
    };

    expect(() =>
      assertNoClinicalDocumentReferenceMetadataLeak(unsafeReference),
    ).toThrow("forbidden clinical document reference metadata");
  });

  it("does not import Supabase, persistence, SecureStore, Expo, vault opening, document decryption, OCR, AI, portal, BMDC, file upload, sync, or React modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/domain/clinical-document/clinicalDocumentReference.ts",
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