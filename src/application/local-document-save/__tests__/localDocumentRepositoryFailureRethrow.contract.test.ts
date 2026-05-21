import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND,
  LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE,
  LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE,
  LOCAL_DOCUMENT_REPOSITORY_FAILURE_UNKNOWN_PHASE,
  type LocalDocumentRepositoryFailureClassification,
} from "../localDocumentRepositoryFailureClassification";

import {
  classifyAndRethrowLocalDocumentRepositoryFailure,
  type ClassifyAndRethrowLocalDocumentRepositoryFailureInput,
} from "../localDocumentRepositoryFailureRethrow";

function captureThrownCause(
  input: ClassifyAndRethrowLocalDocumentRepositoryFailureInput,
): unknown {
  try {
    classifyAndRethrowLocalDocumentRepositoryFailure(input);
  } catch (cause) {
    return cause;
  }

  throw new Error("expected repository failure cause to be rethrown");
}

function expectOnlyApprovedClassificationKeys(
  classification: LocalDocumentRepositoryFailureClassification,
): void {
  expect(Object.keys(classification).sort()).toEqual(["kind", "phase"]);
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
    "01jbbb",
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

describe("Local document repository failure rethrow helper contract", () => {
  it("classifies payload-save failure phase and rethrows the original Error unchanged", () => {
    const cause = new Error(
      "payload write failed for patient_01JAAA00000000000000000001 at C:\\records\\hba1c.pdf using supabase storage",
    );

    const classifications: LocalDocumentRepositoryFailureClassification[] = [];

    const thrown = captureThrownCause({
      phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE,
      cause,
      onClassification(classification) {
        classifications.push(classification);
      },
    });

    expect(thrown).toBe(cause);
    expect(classifications).toHaveLength(1);
    expect(classifications[0]).toEqual({
      kind: LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND,
      phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE,
    });

    expect(Object.isFrozen(classifications[0])).toBe(true);
    expectOnlyApprovedClassificationKeys(classifications[0]);
    expectClassificationToExposeNoSensitiveDetails(classifications[0]);
    expectClassificationDoesNotClaimReceiptSafety(classifications[0]);
  });

  it("classifies reference-save failure phase and rethrows the original non-Error cause unchanged", () => {
    const cause = Object.freeze({
      patientId: "patient_01JAAA00000000000000000001",
      referenceId: "cdr_01JAAA00000000000000000001",
      resourceId: "doc_01JAAA00000000000000000001",
      filename: "diagnosis-report.pdf",
      message: "reference persistence failed",
    });

    const classifications: LocalDocumentRepositoryFailureClassification[] = [];

    const thrown = captureThrownCause({
      phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE,
      cause,
      onClassification(classification) {
        classifications.push(classification);
      },
    });

    expect(thrown).toBe(cause);
    expect(classifications).toEqual([
      {
        kind: LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND,
        phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE,
      },
    ]);

    expect(Object.isFrozen(classifications[0])).toBe(true);
    expectClassificationToExposeNoSensitiveDetails(classifications[0]);
    expectClassificationDoesNotClaimReceiptSafety(classifications[0]);
  });

  it("sanitizes unknown phases before rethrowing the original cause", () => {
    const cause = {
      message: "repository failed for diagnosis, prescription, and hba1c path",
      stack: "C:\\unsafe\\patient_01JBBB\\storagepath",
    };

    const classifications: LocalDocumentRepositoryFailureClassification[] = [];

    const thrown = captureThrownCause({
      phase:
        "payload_save_failed_for_patient_01JBBB00000000000000000002_using_supabase_storage",
      cause,
      onClassification(classification) {
        classifications.push(classification);
      },
    });

    expect(thrown).toBe(cause);
    expect(classifications).toEqual([
      {
        kind: LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND,
        phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_UNKNOWN_PHASE,
      },
    ]);

    expect(Object.isFrozen(classifications[0])).toBe(true);
    expectClassificationToExposeNoSensitiveDetails(classifications[0]);
  });

  it("rethrows the original cause even when no classification callback is provided", () => {
    const cause = new Error("payload persistence failed");

    const thrown = captureThrownCause({
      phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE,
      cause,
    });

    expect(thrown).toBe(cause);
  });

  it("does not let classification callback failures replace the original repository failure", () => {
    const cause = new Error("reference persistence failed");
    const observerFailure = new Error("observer failed");

    const thrown = captureThrownCause({
      phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE,
      cause,
      onClassification() {
        throw observerFailure;
      },
    });

    expect(thrown).toBe(cause);
    expect(thrown).not.toBe(observerFailure);
  });

  it("does not mutate the original thrown cause object", () => {
    const cause = {
      message: "payload persistence failed",
      attempts: 1,
      nested: {
        filename: "lab-report-hba1c.pdf",
      },
    };

    const before = JSON.stringify(cause);

    const thrown = captureThrownCause({
      phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE,
      cause,
      onClassification() {
        return undefined;
      },
    });

    expect(thrown).toBe(cause);
    expect(JSON.stringify(cause)).toBe(before);
    expect(cause).toEqual({
      message: "payload persistence failed",
      attempts: 1,
      nested: {
        filename: "lab-report-hba1c.pdf",
      },
    });
  });

  it("keeps repository failure classification separate from preflight rejections and save outcomes", () => {
    const classifications: LocalDocumentRepositoryFailureClassification[] = [];

    captureThrownCause({
      phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE,
      cause: new Error("reference persistence failed"),
      onClassification(classification) {
        classifications.push(classification);
      },
    });

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

  it("keeps the rethrow helper free from save use cases, repository ports, infrastructure, storage, cloud, sync, audit, crypto adapter, AI, OCR, UI, logging, telemetry, and readable metadata concerns", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/application/local-document-save/localDocumentRepositoryFailureRethrow.ts",
    );

    const source = readFileSync(sourcePath, "utf8");
    const lowerSource = source.toLowerCase();

    expect(source).toContain("classifyLocalDocumentRepositoryFailure");
    expect(source).toContain("LocalDocumentRepositoryFailureClassification");
    expect(source).toContain("throw input.cause");

    const allowedImport = `from "./localDocumentRepositoryFailureClassification";`;

    const importLines = source
      .split(/\r?\n/u)
      .filter((line) => line.includes("from "));

    expect(importLines).toEqual([
      `} ${allowedImport}`,
    ]);

    const forbiddenSourceTokens = [
      "LocalDocumentRepositoryPort",
      "saveLocalDocumentReferences",
      "saveLocalDocumentReferencesWithOutcome",
      "prepareLocalDocumentSave",
      "LocalDocumentSaveOutcome",
      "createCompletedLocalDocumentSaveOutcome",
      "createRejectedLocalDocumentSaveOutcome",
      "createCompletedLocalDocumentSaveResult",
      "createClinicalDocumentReference",
      "createLocalEncryptedDocumentPayload",
      "saveLocalEncryptedDocumentPayload",
      "saveClinicalDocumentReference",
      "isClinicalDocumentReferenceActive",
      "isLocalEncryptedDocumentPayloadActive",
      "patient_id_mismatch",
      "encrypted_payload_ref_mismatch",
      "clinical_document_reference_inactive",
      "local_encrypted_document_payload_inactive",
      "patientId",
      "referenceId",
      "resourceId",
      "payloadId",
      "encryptedPayloadRef",
      "ciphertextRef",
      "encryptionEnvelopeRef",
      "instanceof",
      ".message",
      ".stack",
      "String(",
      "JSON.stringify",
      "Object.keys",
      "Object.values",
      "Object.entries",
      "console.",
      "logger",
      "log(",
      "warn(",
      "error(",
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
      "sync",
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
