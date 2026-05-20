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

import { createInMemoryLocalDocumentRepository } from "../../../infrastructure/local-document-repository/inMemoryLocalDocumentRepository";

import {
  createCompletedLocalDocumentSaveResult,
  LOCAL_DOCUMENT_SAVE_RESULT_STATUS,
  type LocalDocumentSaveResult,
  type LocalDocumentSaveResultInput,
} from "../localDocumentSaveResult";

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

function createResultInput(
  overrides: Partial<LocalDocumentSaveResultInput> = {},
): LocalDocumentSaveResultInput {
  return {
    savedClinicalDocumentReference: createReference(),
    savedLocalEncryptedDocumentPayload: createPayload(),
    ...overrides,
  };
}

function expectResultToExposeOnlyApprovedTopLevelKeys(
  result: LocalDocumentSaveResult,
): void {
  expect(Object.keys(result).sort()).toEqual([
    "savedClinicalDocumentReference",
    "savedLocalEncryptedDocumentPayload",
    "status",
  ]);
}

function expectResultDoesNotAddReceiptOrExposureFields(
  result: LocalDocumentSaveResult,
): void {
  const topLevelKeys = Object.keys(result).map((key) => key.toLowerCase());

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
    "reason",
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

describe("Local document save result contract", () => {
  it("creates a frozen completed save result with only approved top-level keys", () => {
    const input = createResultInput();

    const result = createCompletedLocalDocumentSaveResult(input);

    expect(result).toEqual({
      status: "completed",
      savedClinicalDocumentReference: input.savedClinicalDocumentReference,
      savedLocalEncryptedDocumentPayload:
        input.savedLocalEncryptedDocumentPayload,
    });

    expect(result.status).toBe(LOCAL_DOCUMENT_SAVE_RESULT_STATUS);
    expect(LOCAL_DOCUMENT_SAVE_RESULT_STATUS).toBe("completed");
    expect(Object.isFrozen(result)).toBe(true);
    expectResultToExposeOnlyApprovedTopLevelKeys(result);
    expectResultDoesNotAddReceiptOrExposureFields(result);
  });

  it("preserves saved domain object identity without mutating the source objects", () => {
    const savedClinicalDocumentReference = createReference();
    const savedLocalEncryptedDocumentPayload = createPayload();

    const referenceSnapshot = JSON.stringify(savedClinicalDocumentReference);
    const payloadSnapshot = JSON.stringify(savedLocalEncryptedDocumentPayload);

    const result = createCompletedLocalDocumentSaveResult({
      savedClinicalDocumentReference,
      savedLocalEncryptedDocumentPayload,
    });

    expect(JSON.stringify(savedClinicalDocumentReference)).toBe(
      referenceSnapshot,
    );
    expect(JSON.stringify(savedLocalEncryptedDocumentPayload)).toBe(
      payloadSnapshot,
    );

    expect(result.savedClinicalDocumentReference).toBe(
      savedClinicalDocumentReference,
    );
    expect(result.savedLocalEncryptedDocumentPayload).toBe(
      savedLocalEncryptedDocumentPayload,
    );
    expect(Object.isFrozen(savedClinicalDocumentReference)).toBe(true);
    expect(Object.isFrozen(savedLocalEncryptedDocumentPayload)).toBe(true);
  });

  it("models internal application output, not a log-safe audit, sync, storage, cloud, notification, or display receipt", () => {
    const result = createCompletedLocalDocumentSaveResult(createResultInput());

    expect(result.status).toBe("completed");
    expectResultToExposeOnlyApprovedTopLevelKeys(result);
    expectResultDoesNotAddReceiptOrExposureFields(result);

    const serializedResult = JSON.stringify(result).toLowerCase();

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
      expect(serializedResult).not.toContain(claim);
    }
  });

  it("does not add transaction, rollback, sync, storage, file, cloud, diagnostic, OCR, AI, debug, or display metadata", () => {
    const result = createCompletedLocalDocumentSaveResult(createResultInput());

    expectResultDoesNotAddReceiptOrExposureFields(result);
  });

  it("saveLocalDocumentReferences returns the formalized completed save result", async () => {
    const repository = createInMemoryLocalDocumentRepository();
    const savedClinicalDocumentReference = createReference();
    const savedLocalEncryptedDocumentPayload = createPayload();

    const result = await saveLocalDocumentReferences({
      repository,
      clinicalDocumentReference: savedClinicalDocumentReference,
      localEncryptedDocumentPayload: savedLocalEncryptedDocumentPayload,
    });

    expect(result).toEqual(
      createCompletedLocalDocumentSaveResult({
        savedClinicalDocumentReference,
        savedLocalEncryptedDocumentPayload,
      }),
    );

    expect(result.status).toBe("completed");
    expect(Object.isFrozen(result)).toBe(true);
    expectResultToExposeOnlyApprovedTopLevelKeys(result);
    expectResultDoesNotAddReceiptOrExposureFields(result);
  });

  it("keeps the result module free from repository, infrastructure, persistence, cloud, sync, transaction, crypto adapter, AI, OCR, UI, receipt, audit, display, and readable metadata concerns", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/application/local-document-save/localDocumentSaveResult.ts",
    );

    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    expect(source).toContain("object.freeze");
    expect(source).toContain("clinicaldocumentreference");
    expect(source).toContain("localencrypteddocumentpayload");

    const forbiddenSourceTokens = [
      "localdocumentrepositoryport",
      "repository",
      "inmemorylocaldocumentrepository",
      "createinmemorylocaldocumentrepository",
      "createclinicaldocumentreference",
      "createlocalencrypteddocumentpayload",
      "preparelocaldocumentsave",
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

  it("save use case imports the formal result type instead of defining an inline result interface", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/application/local-document-save/localDocumentSaveUseCase.ts",
    );

    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("createCompletedLocalDocumentSaveResult");
    expect(source).toContain("LocalDocumentSaveResult");
    expect(source).toContain("./localDocumentSaveResult");

    expect(source).not.toContain(
      "export interface SaveLocalDocumentReferencesResult",
    );
  });
});
