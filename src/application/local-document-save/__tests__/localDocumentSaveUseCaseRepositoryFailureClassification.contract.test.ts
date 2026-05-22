import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createClinicalDocumentReference,
  type ClinicalDocumentReference,
  type CreateClinicalDocumentReferenceInput,
} from "../../../domain/clinical-document/clinicalDocumentReference";

import {
  createLocalEncryptedDocumentPayload,
  type CreateLocalEncryptedDocumentPayloadInput,
  type LocalEncryptedDocumentPayload,
} from "../../../domain/local-encrypted-payload/localEncryptedDocumentPayload";

import type { LocalDocumentRepositoryPort } from "../../local-document-repository/localDocumentRepositoryPort";

import {
  LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND,
  LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE,
  LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE,
  type LocalDocumentRepositoryFailureClassification,
} from "../localDocumentRepositoryFailureClassification";

import { saveLocalDocumentReferences } from "../localDocumentSaveUseCase";

const createdAtEpochMs = 1_800_000_000_000;

function createReference(
  overrides: Partial<CreateClinicalDocumentReferenceInput> = {},
): ClinicalDocumentReference {
  return createClinicalDocumentReference({
    referenceId: "cdr_01JAAA00000000000000000001",
    patientId: "patient_01JAAA00000000000000000001",
    resourceId: "doc_01JAAA00000000000000000001",
    resourceKind: "encrypted_report",
    encryptedPayloadRef: "payload_01JAAA00000000000000000001",
    documentSchemaVersion: 1,
    createdAtEpochMs,
    ...overrides,
  });
}

function createPayload(
  overrides: Partial<CreateLocalEncryptedDocumentPayloadInput> = {},
): LocalEncryptedDocumentPayload {
  return createLocalEncryptedDocumentPayload({
    payloadId: "payload_01JAAA00000000000000000001",
    patientId: "patient_01JAAA00000000000000000001",
    ciphertextRef: "ciphertext_01JAAA00000000000000000001",
    encryptionEnvelopeRef: "envelope_01JAAA00000000000000000001",
    encryptionScheme: "aes_256_gcm_v1",
    payloadSchemaVersion: 1,
    createdAtEpochMs,
    ...overrides,
  });
}

function expectClassificationToExposeNoSensitiveDetails(
  classification: LocalDocumentRepositoryFailureClassification,
): void {
  const serialized = JSON.stringify(classification).toLowerCase();

  const forbiddenFragments = [
    "patient_01",
    "payload_01",
    "cdr_01",
    "doc_01",
    "ciphertext_01",
    "envelope_01",
    "01jaaa",
    "referenceid",
    "patientid",
    "resourceid",
    "payloadid",
    "encryptedpayloadref",
    "ciphertextref",
    "encryptionenveloperef",
    "filename",
    "filepath",
    "storagepath",
    "storageurl",
    "fileuri",
    "contenturi",
    "mimetype",
    "diagnosis",
    "prescription",
    "hba1c",
    "supabase",
    "sqlite",
    "watermelondb",
    "openai",
    "ocr",
    "stack",
    "message",
    "cause",
    "debug",
  ];

  for (const fragment of forbiddenFragments) {
    expect(serialized).not.toContain(fragment);
  }
}

function expectClassificationDoesNotClaimReceiptSafety(
  classification: LocalDocumentRepositoryFailureClassification,
): void {
  const serialized = JSON.stringify(classification).toLowerCase();

  const forbiddenClaims = [
    "logsafe",
    "log-safe",
    "auditsafe",
    "audit-safe",
    "syncsafe",
    "sync-safe",
    "cloudsafe",
    "cloud-safe",
    "displaysafe",
    "display-safe",
    "notificationsafe",
    "notification-safe",
    "receiptid",
    "auditreceipt",
    "transactionid",
    "rollbackid",
    "mutationid",
    "syncid",
    "storagepath",
    "storageurl",
    "displaylabel",
    "displaymessage",
    "notificationpayload",
    "analytics",
    "telemetry",
  ];

  for (const claim of forbiddenClaims) {
    expect(serialized).not.toContain(claim);
  }
}

describe("Local document save repository failure classification integration contract", () => {
  it("classifies payload-save repository failures and still rethrows the original cause unchanged", async () => {
    const cause = new Error(
      "payload write failed for patient_01JAAA00000000000000000001 at C:\\records\\hba1c.pdf using supabase storage",
    );

    const classifications: LocalDocumentRepositoryFailureClassification[] = [];

    const repository: LocalDocumentRepositoryPort = {
      async saveLocalEncryptedDocumentPayload(): Promise<LocalEncryptedDocumentPayload> {
        throw cause;
      },

      async saveClinicalDocumentReference(): Promise<ClinicalDocumentReference> {
        throw new Error("reference save must not be called");
      },
    };

    await expect(
      saveLocalDocumentReferences({
        repository,
        clinicalDocumentReference: createReference(),
        localEncryptedDocumentPayload: createPayload(),
        onRepositoryFailureClassification(classification) {
          classifications.push(classification);
        },
      }),
    ).rejects.toBe(cause);

    expect(classifications).toEqual([
      {
        kind: LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND,
        phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE,
      },
    ]);

    expect(Object.isFrozen(classifications[0])).toBe(true);
    expect(Object.keys(classifications[0]).sort()).toEqual(["kind", "phase"]);
    expectClassificationToExposeNoSensitiveDetails(classifications[0]);
    expectClassificationDoesNotClaimReceiptSafety(classifications[0]);
  });

  it("classifies reference-save repository failures after payload save succeeds and rethrows the original cause unchanged", async () => {
    const payload = createPayload();

    const cause = Object.freeze({
      patientId: "patient_01JAAA00000000000000000001",
      referenceId: "cdr_01JAAA00000000000000000001",
      resourceId: "doc_01JAAA00000000000000000001",
      filename: "diagnosis-report.pdf",
      message: "reference persistence failed",
    });

    const classifications: LocalDocumentRepositoryFailureClassification[] = [];

    const repository: LocalDocumentRepositoryPort = {
      async saveLocalEncryptedDocumentPayload(): Promise<LocalEncryptedDocumentPayload> {
        return payload;
      },

      async saveClinicalDocumentReference(): Promise<ClinicalDocumentReference> {
        throw cause;
      },
    };

    await expect(
      saveLocalDocumentReferences({
        repository,
        clinicalDocumentReference: createReference(),
        localEncryptedDocumentPayload: payload,
        onRepositoryFailureClassification(classification) {
          classifications.push(classification);
        },
      }),
    ).rejects.toBe(cause);

    expect(classifications).toEqual([
      {
        kind: LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND,
        phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE,
      },
    ]);

    expect(Object.isFrozen(classifications[0])).toBe(true);
    expect(Object.keys(classifications[0]).sort()).toEqual(["kind", "phase"]);
    expectClassificationToExposeNoSensitiveDetails(classifications[0]);
    expectClassificationDoesNotClaimReceiptSafety(classifications[0]);
  });

  it("does not classify preflight failures as repository failures", async () => {
    const classifications: LocalDocumentRepositoryFailureClassification[] = [];

    const repository: LocalDocumentRepositoryPort = {
      async saveLocalEncryptedDocumentPayload(): Promise<LocalEncryptedDocumentPayload> {
        throw new Error("repository must not be called");
      },

      async saveClinicalDocumentReference(): Promise<ClinicalDocumentReference> {
        throw new Error("repository must not be called");
      },
    };

    await expect(
      saveLocalDocumentReferences({
        repository,
        clinicalDocumentReference: createReference(),
        localEncryptedDocumentPayload: createPayload({
          patientId: "patient_01JBBB00000000000000000002",
        }),
        onRepositoryFailureClassification(classification) {
          classifications.push(classification);
        },
      }),
    ).rejects.toThrow(
      "clinical document reference and encrypted payload patientId must match",
    );

    expect(classifications).toEqual([]);
  });

  it("preserves repository failure propagation even when no classification callback is provided", async () => {
    const cause = new Error("payload persistence failed");

    const repository: LocalDocumentRepositoryPort = {
      async saveLocalEncryptedDocumentPayload(): Promise<LocalEncryptedDocumentPayload> {
        throw cause;
      },

      async saveClinicalDocumentReference(): Promise<ClinicalDocumentReference> {
        throw new Error("reference save must not be called");
      },
    };

    await expect(
      saveLocalDocumentReferences({
        repository,
        clinicalDocumentReference: createReference(),
        localEncryptedDocumentPayload: createPayload(),
      }),
    ).rejects.toBe(cause);
  });

  it("does not let classification callback failures replace the original repository failure", async () => {
    const cause = new Error("reference persistence failed");
    const observerFailure = new Error("observer failed");
    const payload = createPayload();

    const repository: LocalDocumentRepositoryPort = {
      async saveLocalEncryptedDocumentPayload(): Promise<LocalEncryptedDocumentPayload> {
        return payload;
      },

      async saveClinicalDocumentReference(): Promise<ClinicalDocumentReference> {
        throw cause;
      },
    };

    await expect(
      saveLocalDocumentReferences({
        repository,
        clinicalDocumentReference: createReference(),
        localEncryptedDocumentPayload: payload,
        onRepositoryFailureClassification() {
          throw observerFailure;
        },
      }),
    ).rejects.toBe(cause);
  });

  it("keeps repository failure classification separate from save results, save outcomes, and preflight rejections", async () => {
    const cause = new Error("payload persistence failed");
    const classifications: LocalDocumentRepositoryFailureClassification[] = [];

    const repository: LocalDocumentRepositoryPort = {
      async saveLocalEncryptedDocumentPayload(): Promise<LocalEncryptedDocumentPayload> {
        throw cause;
      },

      async saveClinicalDocumentReference(): Promise<ClinicalDocumentReference> {
        throw new Error("reference save must not be called");
      },
    };

    await expect(
      saveLocalDocumentReferences({
        repository,
        clinicalDocumentReference: createReference(),
        localEncryptedDocumentPayload: createPayload(),
        onRepositoryFailureClassification(classification) {
          classifications.push(classification);
        },
      }),
    ).rejects.toBe(cause);

    const serialized = JSON.stringify(classifications[0]).toLowerCase();

    const forbiddenOutcomeTerms = [
      "completed",
      "rejected",
      "result",
      "rejectionreason",
      "patient_id_mismatch",
      "encrypted_payload_ref_mismatch",
      "clinical_document_reference_inactive",
      "local_encrypted_document_payload_inactive",
    ];

    for (const term of forbiddenOutcomeTerms) {
      expect(serialized).not.toContain(term);
    }
  });

  it("wires the save use case to the rethrow helper without adding logging, cloud, sync, audit, UI, AI, OCR, or metadata concerns", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/application/local-document-save/localDocumentSaveUseCase.ts",
    );

    const source = readFileSync(sourcePath, "utf8");
    const lowerSource = source.toLowerCase();

    expect(source).toContain(
      "classifyAndRethrowLocalDocumentRepositoryFailure",
    );
    expect(source).toContain(
      "LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE",
    );
    expect(source).toContain(
      "LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE",
    );
    expect(source).toContain("onRepositoryFailureClassification");
    expect(source).toContain("throw new Error(toSavePreflightErrorMessage");

    const forbiddenSourceTokens = [
      "console.",
      "logger",
      "log(",
      "warn(",
      "console.error(",
      ".message",
      ".stack",
      "String(",
      "JSON.stringify",
      "Object.keys",
      "Object.values",
      "Object.entries",
      "supabase",
      "sqlite",
      "watermelondb",
      "filesystem",
      "expo-file-system",
      "securestore",
      "expo-secure-store",
      "expo-local-authentication",
      "localstorage",
      "sessionstorage",
      "asyncstorage",
      "indexeddb",
      "mmkv",
      "vault-assembly",
      "localVaultAssembly",
      "vault-open",
      "open-vault",
      "aesGcmEnvelopeAdapter",
      "cryptoSubtle",
      "encrypt(",
      "decrypt(",
      "document-decryption",
      "transaction",
      "rollback",
      "idempotency",
      "mutation",
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
      "schema",
      "sql",
      "migration",
      "table",
      "index",
      "filename",
      "filepath",
      "storagepath",
      "storageurl",
      "fileuri",
      "contenturi",
      "mimetype",
      "plaintextbytes",
      "ciphertextbytes",
      "diagnosis",
      "prescription",
      "hba1c",
      "audit",
      "receipt",
      "logsafe",
      "auditsafe",
      "displaysafe",
      "notificationsafe",
      "cloudsafe",
      "displaylabel",
      "displaymessage",
      "notificationpayload",
      "analytics",
      "telemetry",
      "date.now",
      "new date",
    ];

    for (const token of forbiddenSourceTokens) {
      expect(lowerSource).not.toContain(token.toLowerCase());
    }
  });
});


