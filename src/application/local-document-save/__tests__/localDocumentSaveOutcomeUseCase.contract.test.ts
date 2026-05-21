import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createClinicalDocumentReference,
  revokeClinicalDocumentReference,
  type ClinicalDocumentReference,
  type CreateClinicalDocumentReferenceInput,
} from "../../../domain/clinical-document/clinicalDocumentReference";

import {
  createLocalEncryptedDocumentPayload,
  markLocalEncryptedDocumentPayloadDeleted,
  type CreateLocalEncryptedDocumentPayloadInput,
  type LocalEncryptedDocumentPayload,
} from "../../../domain/local-encrypted-payload/localEncryptedDocumentPayload";

import type { LocalDocumentRepositoryPort } from "../../local-document-repository/localDocumentRepositoryPort";

import { createInMemoryLocalDocumentRepository } from "../../../infrastructure/local-document-repository/inMemoryLocalDocumentRepository";

import {
  LOCAL_DOCUMENT_SAVE_OUTCOME_COMPLETED_STATUS,
  LOCAL_DOCUMENT_SAVE_OUTCOME_REJECTED_STATUS,
  type LocalDocumentSaveOutcome,
} from "../localDocumentSaveOutcome";

import { saveLocalDocumentReferencesWithOutcome } from "../localDocumentSaveOutcomeUseCase";

const createdAtEpochMs = 1_800_000_000_000;
const laterEpochMs = createdAtEpochMs + 60_000;

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

function createThrowingRepository(): LocalDocumentRepositoryPort {
  return {
    async saveLocalEncryptedDocumentPayload(): Promise<LocalEncryptedDocumentPayload> {
      throw new Error("repository payload save must not be called");
    },

    async saveClinicalDocumentReference(): Promise<ClinicalDocumentReference> {
      throw new Error("repository reference save must not be called");
    },
  };
}

function expectOutcomeToExposeOnlyApprovedTopLevelKeys(
  outcome: LocalDocumentSaveOutcome,
): void {
  if (outcome.status === "completed") {
    expect(Object.keys(outcome).sort()).toEqual(["result", "status"]);
    return;
  }

  expect(Object.keys(outcome).sort()).toEqual([
    "rejectionReason",
    "status",
  ]);
}

function expectRejectedOutcomeToExposeNoIdentifiers(
  outcome: LocalDocumentSaveOutcome,
): void {
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
    "encryptionenveloperef",
  ];

  for (const fragment of forbiddenIdentifierFragments) {
    expect(serializedOutcome).not.toContain(fragment);
  }
}

function expectOutcomeDoesNotClaimReceiptSafety(
  outcome: LocalDocumentSaveOutcome,
): void {
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
    "storagepath",
    "storageurl",
    "filename",
    "filepath",
    "fileuri",
    "contenturi",
    "mimetype",
    "diagnosis",
    "prescription",
    "hba1c",
    "ocrtext",
    "aisummary",
    "displaylabel",
    "displaymessage",
    "notificationpayload",
    "analytics",
    "telemetry",
  ];

  for (const claim of forbiddenClaims) {
    expect(serializedOutcome).not.toContain(claim);
  }
}

describe("Local document save outcome use case wrapper contract", () => {
  it("returns a completed outcome when the local document save succeeds", async () => {
    const repository = createInMemoryLocalDocumentRepository();
    const clinicalDocumentReference = createReference();
    const localEncryptedDocumentPayload = createPayload();

    const outcome = await saveLocalDocumentReferencesWithOutcome({
      repository,
      clinicalDocumentReference,
      localEncryptedDocumentPayload,
    });

    expect(outcome.status).toBe(LOCAL_DOCUMENT_SAVE_OUTCOME_COMPLETED_STATUS);
    expect(outcome.status).toBe("completed");

    if (outcome.status !== "completed") {
      throw new Error("expected completed local document save outcome");
    }

    expect(outcome.result.status).toBe("completed");
    expect(outcome.result.savedClinicalDocumentReference).toBe(
      clinicalDocumentReference,
    );
    expect(outcome.result.savedLocalEncryptedDocumentPayload).toBe(
      localEncryptedDocumentPayload,
    );

    expect(Object.isFrozen(outcome)).toBe(true);
    expect(Object.isFrozen(outcome.result)).toBe(true);
    expectOutcomeToExposeOnlyApprovedTopLevelKeys(outcome);
    expectOutcomeDoesNotClaimReceiptSafety(outcome);
  });

  it("returns a rejected outcome for mismatched patient ids without calling the repository", async () => {
    const outcome = await saveLocalDocumentReferencesWithOutcome({
      repository: createThrowingRepository(),
      clinicalDocumentReference: createReference(),
      localEncryptedDocumentPayload: createPayload({
        patientId: "patient_01JBBB00000000000000000002",
      }),
    });

    expect(outcome).toEqual({
      status: "rejected",
      rejectionReason: "patient_id_mismatch",
    });

    expect(outcome.status).toBe(LOCAL_DOCUMENT_SAVE_OUTCOME_REJECTED_STATUS);
    expect(Object.isFrozen(outcome)).toBe(true);
    expectOutcomeToExposeOnlyApprovedTopLevelKeys(outcome);
    expectRejectedOutcomeToExposeNoIdentifiers(outcome);
    expectOutcomeDoesNotClaimReceiptSafety(outcome);
  });

  it("returns a rejected outcome for mismatched encrypted payload refs without calling the repository", async () => {
    const outcome = await saveLocalDocumentReferencesWithOutcome({
      repository: createThrowingRepository(),
      clinicalDocumentReference: createReference({
        encryptedPayloadRef: "payload_01JBBB00000000000000000002",
      }),
      localEncryptedDocumentPayload: createPayload(),
    });

    expect(outcome).toEqual({
      status: "rejected",
      rejectionReason: "encrypted_payload_ref_mismatch",
    });

    expect(Object.isFrozen(outcome)).toBe(true);
    expectOutcomeToExposeOnlyApprovedTopLevelKeys(outcome);
    expectRejectedOutcomeToExposeNoIdentifiers(outcome);
    expectOutcomeDoesNotClaimReceiptSafety(outcome);
  });

  it("returns a rejected outcome for inactive clinical document references without calling the repository", async () => {
    const outcome = await saveLocalDocumentReferencesWithOutcome({
      repository: createThrowingRepository(),
      clinicalDocumentReference: revokeClinicalDocumentReference(
        createReference(),
        laterEpochMs,
      ),
      localEncryptedDocumentPayload: createPayload(),
    });

    expect(outcome).toEqual({
      status: "rejected",
      rejectionReason: "clinical_document_reference_inactive",
    });

    expect(Object.isFrozen(outcome)).toBe(true);
    expectOutcomeToExposeOnlyApprovedTopLevelKeys(outcome);
    expectRejectedOutcomeToExposeNoIdentifiers(outcome);
    expectOutcomeDoesNotClaimReceiptSafety(outcome);
  });

  it("returns a rejected outcome for inactive local encrypted payloads without calling the repository", async () => {
    const outcome = await saveLocalDocumentReferencesWithOutcome({
      repository: createThrowingRepository(),
      clinicalDocumentReference: createReference(),
      localEncryptedDocumentPayload: markLocalEncryptedDocumentPayloadDeleted(
        createPayload(),
        laterEpochMs,
      ),
    });

    expect(outcome).toEqual({
      status: "rejected",
      rejectionReason: "local_encrypted_document_payload_inactive",
    });

    expect(Object.isFrozen(outcome)).toBe(true);
    expectOutcomeToExposeOnlyApprovedTopLevelKeys(outcome);
    expectRejectedOutcomeToExposeNoIdentifiers(outcome);
    expectOutcomeDoesNotClaimReceiptSafety(outcome);
  });

  it("preserves repository payload-save error propagation instead of converting repository failures into rejected outcomes", async () => {
    const repository: LocalDocumentRepositoryPort = {
      async saveLocalEncryptedDocumentPayload(): Promise<LocalEncryptedDocumentPayload> {
        throw new Error("payload persistence failed");
      },

      async saveClinicalDocumentReference(): Promise<ClinicalDocumentReference> {
        throw new Error("reference save must not be called");
      },
    };

    await expect(
      saveLocalDocumentReferencesWithOutcome({
        repository,
        clinicalDocumentReference: createReference(),
        localEncryptedDocumentPayload: createPayload(),
      }),
    ).rejects.toThrow("payload persistence failed");
  });

  it("preserves repository reference-save error propagation after payload save succeeds", async () => {
    const payload = createPayload();

    const repository: LocalDocumentRepositoryPort = {
      async saveLocalEncryptedDocumentPayload(): Promise<LocalEncryptedDocumentPayload> {
        return payload;
      },

      async saveClinicalDocumentReference(): Promise<ClinicalDocumentReference> {
        throw new Error("reference persistence failed");
      },
    };

    await expect(
      saveLocalDocumentReferencesWithOutcome({
        repository,
        clinicalDocumentReference: createReference(),
        localEncryptedDocumentPayload: payload,
      }),
    ).rejects.toThrow("reference persistence failed");
  });

  it("keeps the outcome wrapper free from infrastructure adapters, storage, cloud, sync, transaction, audit, crypto adapter, AI, OCR, UI, and readable metadata concerns", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/application/local-document-save/localDocumentSaveOutcomeUseCase.ts",
    );

    const source = readFileSync(sourcePath, "utf8");
    const lowerSource = source.toLowerCase();

    expect(source).toContain("prepareLocalDocumentSave");
    expect(source).toContain("saveLocalDocumentReferences");
    expect(source).toContain("createCompletedLocalDocumentSaveOutcome");
    expect(source).toContain("createRejectedLocalDocumentSaveOutcome");
    expect(source).toContain("LocalDocumentSaveOutcome");

    const forbiddenSourceTokens = [
      "inMemoryLocalDocumentRepository",
      "createInMemoryLocalDocumentRepository",
      "createClinicalDocumentReference",
      "createLocalEncryptedDocumentPayload",
      "isClinicalDocumentReferenceActive",
      "isLocalEncryptedDocumentPayloadActive",
      "patientId !==",
      "encryptedPayloadRef !==",
      "localEncryptedDocumentPayload.payloadId",
      "revokedAtEpochMs",
      "deletedAtEpochMs",
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
      "syncid",
      "syncsafe",
      "sync-safe",
      "background-sync",
      "sync-engine",
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
