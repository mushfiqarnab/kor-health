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

import {
  createCompletedLocalDocumentSaveResult,
  type LocalDocumentSaveResult,
} from "../localDocumentSaveResult";

import {
  createCompletedLocalDocumentSaveOutcome,
  createRejectedLocalDocumentSaveOutcome,
  LOCAL_DOCUMENT_SAVE_OUTCOME_COMPLETED_STATUS,
  LOCAL_DOCUMENT_SAVE_OUTCOME_REJECTED_STATUS,
  type LocalDocumentSaveOutcome,
} from "../localDocumentSaveOutcome";

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

function createCompletedResult(): LocalDocumentSaveResult {
  return createCompletedLocalDocumentSaveResult({
    savedClinicalDocumentReference: createReference(),
    savedLocalEncryptedDocumentPayload: createPayload(),
  });
}

function expectOutcomeToAvoidReceiptExposureFields(
  outcome: LocalDocumentSaveOutcome,
): void {
  const topLevelKeys = Object.keys(outcome).map((key) => key.toLowerCase());

  const forbiddenTopLevelKeys = [
    "transactionid",
    "rollbackid",
    "idempotencykey",
    "mutationid",
    "syncid",
    "storagepath",
    "storageurl",
    "filepath",
    "fileuri",
    "contenturi",
    "mimetype",
    "diagnosis",
    "prescription",
    "hba1c",
    "ocrtext",
    "aisummary",
    "error",
    "debug",
    "audit",
    "auditid",
    "auditreceipt",
    "receipt",
    "receiptid",
    "logsafe",
    "auditsafe",
    "displaysafe",
    "notificationsafe",
    "cloudsafe",
    "syncsafe",
    "displaylabel",
    "displaymessage",
    "notificationpayload",
    "analytics",
    "telemetry",
  ];

  for (const key of forbiddenTopLevelKeys) {
    expect(topLevelKeys).not.toContain(key);
  }
}

describe("Local document save outcome boundary contract", () => {
  it("creates a frozen completed outcome around the internal completed result", () => {
    const result = createCompletedResult();

    const outcome = createCompletedLocalDocumentSaveOutcome({ result });

    expect(outcome).toEqual({
      status: "completed",
      result,
    });

    expect(outcome.status).toBe(LOCAL_DOCUMENT_SAVE_OUTCOME_COMPLETED_STATUS);
    expect(LOCAL_DOCUMENT_SAVE_OUTCOME_COMPLETED_STATUS).toBe("completed");
    expect(Object.keys(outcome).sort()).toEqual(["result", "status"]);
    expect(Object.isFrozen(outcome)).toBe(true);
    expect(outcome.result).toBe(result);
    expectOutcomeToAvoidReceiptExposureFields(outcome);
  });

  it("creates a frozen rejected outcome using only a safe preflight rejection reason", () => {
    const outcome = createRejectedLocalDocumentSaveOutcome({
      rejectionReason: "patient_id_mismatch",
    });

    expect(outcome).toEqual({
      status: "rejected",
      rejectionReason: "patient_id_mismatch",
    });

    expect(outcome.status).toBe(LOCAL_DOCUMENT_SAVE_OUTCOME_REJECTED_STATUS);
    expect(LOCAL_DOCUMENT_SAVE_OUTCOME_REJECTED_STATUS).toBe("rejected");
    expect(Object.keys(outcome).sort()).toEqual([
      "rejectionReason",
      "status",
    ]);
    expect(Object.isFrozen(outcome)).toBe(true);
    expectOutcomeToAvoidReceiptExposureFields(outcome);
  });

  it("supports every approved preflight rejection reason without exposing identifiers", () => {
    const outcomes = [
      createRejectedLocalDocumentSaveOutcome({
        rejectionReason: "patient_id_mismatch",
      }),
      createRejectedLocalDocumentSaveOutcome({
        rejectionReason: "encrypted_payload_ref_mismatch",
      }),
      createRejectedLocalDocumentSaveOutcome({
        rejectionReason: "clinical_document_reference_inactive",
      }),
      createRejectedLocalDocumentSaveOutcome({
        rejectionReason: "local_encrypted_document_payload_inactive",
      }),
    ];

    expect(outcomes).toEqual([
      {
        status: "rejected",
        rejectionReason: "patient_id_mismatch",
      },
      {
        status: "rejected",
        rejectionReason: "encrypted_payload_ref_mismatch",
      },
      {
        status: "rejected",
        rejectionReason: "clinical_document_reference_inactive",
      },
      {
        status: "rejected",
        rejectionReason: "local_encrypted_document_payload_inactive",
      },
    ]);

    for (const outcome of outcomes) {
      expect(Object.isFrozen(outcome)).toBe(true);
      expectOutcomeToAvoidReceiptExposureFields(outcome);

      const serializedOutcome = JSON.stringify(outcome).toLowerCase();

      const forbiddenIdentifierFragments = [
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
      ];

      for (const fragment of forbiddenIdentifierFragments) {
        expect(serializedOutcome).not.toContain(fragment);
      }
    }
  });

  it("models internal application outcome, not a transaction, audit, log, sync, cloud, notification, or display receipt", () => {
    const outcomes = [
      createCompletedLocalDocumentSaveOutcome({
        result: createCompletedResult(),
      }),
      createRejectedLocalDocumentSaveOutcome({
        rejectionReason: "local_encrypted_document_payload_inactive",
      }),
    ];

    for (const outcome of outcomes) {
      expectOutcomeToAvoidReceiptExposureFields(outcome);

      const serializedOutcome = JSON.stringify(outcome).toLowerCase();

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
      ];

      for (const claim of forbiddenClaims) {
        expect(serializedOutcome).not.toContain(claim);
      }
    }
  });

  it("keeps the outcome module free from repository, infrastructure, persistence, save-use-case, cloud, sync, transaction, crypto adapter, AI, OCR, UI, receipt, audit, display, and readable metadata concerns", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/application/local-document-save/localDocumentSaveOutcome.ts",
    );

    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    expect(source).toContain("object.freeze");
    expect(source).toContain("localdocumentsaveresult");
    expect(source).toContain("localdocumentsavepreflightfailurereason");

    const forbiddenSourceTokens = [
      "localdocumentrepositoryport",
      "repository",
      "inmemorylocaldocumentrepository",
      "createinmemorylocaldocumentrepository",
      "createclinicaldocumentreference",
      "createlocalencrypteddocumentpayload",
      "savelocaldocumentreferences",
      "patientsharepacket",
      "sharepacket",
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
      "localvaultassembly",
      "vault-open",
      "open-vault",
      "aesgcmenvelopeadapter",
      "cryptosubtle",
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
      "syncsafe",
      "displaylabel",
      "displaymessage",
      "notificationpayload",
      "analytics",
      "telemetry",
      "date.now",
      "new date",
    ];

    for (const token of forbiddenSourceTokens) {
      expect(source).not.toContain(token);
    }
  });
});
