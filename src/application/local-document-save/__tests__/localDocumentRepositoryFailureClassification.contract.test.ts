import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  classifyLocalDocumentRepositoryFailure,
  LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND,
  LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE,
  LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE,
  LOCAL_DOCUMENT_REPOSITORY_FAILURE_UNKNOWN_PHASE,
  type LocalDocumentRepositoryFailureClassification,
} from "../localDocumentRepositoryFailureClassification";

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

describe("Local document repository failure classification contract", () => {
  it("classifies local encrypted payload save failures without exposing the thrown cause", () => {
    const cause = new Error(
      "payload write failed for patient_01JAAA00000000000000000001 at C:\\records\\hba1c.pdf using supabase storage",
    );

    const classification = classifyLocalDocumentRepositoryFailure({
      phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE,
      cause,
    });

    expect(classification).toEqual({
      kind: LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND,
      phase: "local_encrypted_document_payload_save",
    });

    expect(Object.isFrozen(classification)).toBe(true);
    expectOnlyApprovedClassificationKeys(classification);
    expectClassificationToExposeNoSensitiveDetails(classification);
    expectClassificationDoesNotClaimReceiptSafety(classification);
  });

  it("classifies clinical document reference save failures without exposing the thrown cause", () => {
    const cause = new Error(
      "reference write failed for cdr_01JAAA00000000000000000001 and doc_01JAAA00000000000000000001",
    );

    const classification = classifyLocalDocumentRepositoryFailure({
      phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE,
      cause,
    });

    expect(classification).toEqual({
      kind: LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND,
      phase: "clinical_document_reference_save",
    });

    expect(Object.isFrozen(classification)).toBe(true);
    expectOnlyApprovedClassificationKeys(classification);
    expectClassificationToExposeNoSensitiveDetails(classification);
    expectClassificationDoesNotClaimReceiptSafety(classification);
  });

  it("sanitizes unknown failure phases instead of echoing untrusted phase strings", () => {
    const classification = classifyLocalDocumentRepositoryFailure({
      phase:
        "payload_save_failed_for_patient_01JBBB00000000000000000002_using_supabase_storage",
      cause: {
        message:
          "diagnosis and prescription path leaked through a repository adapter",
        stack: "C:\\unsafe\\storagepath\\patient_01JBBB",
      },
    });

    expect(classification).toEqual({
      kind: LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND,
      phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_UNKNOWN_PHASE,
    });

    expect(Object.isFrozen(classification)).toBe(true);
    expectOnlyApprovedClassificationKeys(classification);
    expectClassificationToExposeNoSensitiveDetails(classification);
    expectClassificationDoesNotClaimReceiptSafety(classification);
  });

  it("accepts non-Error thrown values without serializing or inspecting them", () => {
    const cause = Object.freeze({
      patientId: "patient_01JAAA00000000000000000001",
      encryptedPayloadRef: "payload_01JAAA00000000000000000001",
      filename: "lab-report-hba1c.pdf",
      nested: {
        storageUrl: "https://example.invalid/patient/report",
      },
    });

    const classification = classifyLocalDocumentRepositoryFailure({
      phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE,
      cause,
    });

    expect(classification).toEqual({
      kind: LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND,
      phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE,
    });

    expect(Object.isFrozen(classification)).toBe(true);
    expectClassificationToExposeNoSensitiveDetails(classification);
  });

  it("keeps repository failures separate from preflight rejections and completed save outcomes", () => {
    const classification = classifyLocalDocumentRepositoryFailure({
      phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE,
      cause: new Error("reference persistence failed"),
    });

    const serialized = JSON.stringify(classification).toLowerCase();

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

  it("does not mutate the original thrown cause object", () => {
    const cause = {
      message: "payload persistence failed",
      attempts: 1,
    };

    const before = JSON.stringify(cause);

    classifyLocalDocumentRepositoryFailure({
      phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE,
      cause,
    });

    expect(JSON.stringify(cause)).toBe(before);
    expect(cause).toEqual({
      message: "payload persistence failed",
      attempts: 1,
    });
  });

  it("exposes only the approved repository failure phases", () => {
    const approvedPhases = [
      LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE,
      LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE,
      LOCAL_DOCUMENT_REPOSITORY_FAILURE_UNKNOWN_PHASE,
    ];

    expect(approvedPhases).toEqual([
      "local_encrypted_document_payload_save",
      "clinical_document_reference_save",
      "unknown_repository_failure",
    ]);
  });

  it("keeps the classifier free from repository ports, save use cases, preflight logic, infrastructure, storage, cloud, sync, audit, crypto adapter, AI, OCR, UI, and readable metadata concerns", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/application/local-document-save/localDocumentRepositoryFailureClassification.ts",
    );

    const source = readFileSync(sourcePath, "utf8");
    const lowerSource = source.toLowerCase();

    expect(source).toContain("LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND");
    expect(source).toContain(
      "LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE",
    );
    expect(source).toContain(
      "LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE",
    );
    expect(source).toContain(
      "LOCAL_DOCUMENT_REPOSITORY_FAILURE_UNKNOWN_PHASE",
    );
    expect(source).toContain("classifyLocalDocumentRepositoryFailure");
    expect(source).toContain("Object.freeze");

    const forbiddenSourceTokens = [
      "from \"",
      "from '",
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
