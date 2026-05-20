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
  saveLocalDocumentReferences,
  type SaveLocalDocumentReferencesInput,
} from "../localDocumentSaveUseCase";

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

function baseInput(
  overrides: Partial<SaveLocalDocumentReferencesInput> = {},
): SaveLocalDocumentReferencesInput {
  return {
    repository: createInMemoryLocalDocumentRepository(),
    clinicalDocumentReference: createReference(),
    localEncryptedDocumentPayload: createPayload(),
    ...overrides,
  };
}

async function saveReferences(
  overrides: Partial<SaveLocalDocumentReferencesInput> = {},
) {
  return saveLocalDocumentReferences(baseInput(overrides));
}

function createNoopRepository(
  overrides: Partial<LocalDocumentRepositoryPort> = {},
): LocalDocumentRepositoryPort {
  return {
    async saveClinicalDocumentReference(reference) {
      return reference;
    },

    async saveLocalEncryptedDocumentPayload(payload) {
      return payload;
    },

    async getClinicalDocumentReferenceByReferenceId() {
      return undefined;
    },

    async getLocalEncryptedDocumentPayloadByPayloadId() {
      return undefined;
    },

    async listClinicalDocumentReferencesForPatient() {
      return [];
    },

    async listActiveClinicalDocumentReferencesForPatient() {
      return [];
    },

    async listLocalEncryptedDocumentPayloadsForPatient() {
      return [];
    },

    async listActiveLocalEncryptedDocumentPayloadsForPatient() {
      return [];
    },

    ...overrides,
  };
}

describe("Local document save use case contract", () => {
  it("saves an already-created active clinical document reference and matching encrypted payload", async () => {
    const repository = createInMemoryLocalDocumentRepository();
    const clinicalDocumentReference = createReference();
    const localEncryptedDocumentPayload = createPayload();

    const result = await saveReferences({
      repository,
      clinicalDocumentReference,
      localEncryptedDocumentPayload,
    });

    expect(result).toEqual({
      savedClinicalDocumentReference: clinicalDocumentReference,
      savedLocalEncryptedDocumentPayload: localEncryptedDocumentPayload,
    });

    await expect(
      repository.getClinicalDocumentReferenceByReferenceId(
        clinicalDocumentReference.referenceId,
      ),
    ).resolves.toBe(clinicalDocumentReference);

    await expect(
      repository.getLocalEncryptedDocumentPayloadByPayloadId(
        localEncryptedDocumentPayload.payloadId,
      ),
    ).resolves.toBe(localEncryptedDocumentPayload);
  });

  it("saves payload before reference to avoid a dangling reference window", async () => {
    const calls: string[] = [];

    const repository = createNoopRepository({
      async saveClinicalDocumentReference(reference) {
        calls.push(`reference:${reference.referenceId}`);
        return reference;
      },

      async saveLocalEncryptedDocumentPayload(payload) {
        calls.push(`payload:${payload.payloadId}`);
        return payload;
      },
    });

    await saveReferences({ repository });

    expect(calls).toEqual([
      "payload:payload_01JAAA00000000000000000001",
      "reference:cdr_01JAAA00000000000000000001",
    ]);
  });

  it("rejects mismatched patient ids before saving", async () => {
    const repository = createInMemoryLocalDocumentRepository();

    await expect(
      saveReferences({
        repository,
        localEncryptedDocumentPayload: createPayload({
          patientId: "patient_01JBBB00000000000000000002",
        }),
      }),
    ).rejects.toThrow(
      "clinical document reference and encrypted payload patientId must match",
    );

    await expect(
      repository.listClinicalDocumentReferencesForPatient(
        "patient_01JAAA00000000000000000001",
      ),
    ).resolves.toEqual([]);

    await expect(
      repository.listLocalEncryptedDocumentPayloadsForPatient(
        "patient_01JBBB00000000000000000002",
      ),
    ).resolves.toEqual([]);
  });

  it("rejects mismatched encrypted payload refs before saving", async () => {
    const repository = createInMemoryLocalDocumentRepository();

    await expect(
      saveReferences({
        repository,
        clinicalDocumentReference: createReference({
          encryptedPayloadRef: "payload_01JBBB00000000000000000002",
        }),
      }),
    ).rejects.toThrow(
      "clinical document reference encryptedPayloadRef must match encrypted payload payloadId",
    );

    await expect(
      repository.listClinicalDocumentReferencesForPatient(
        "patient_01JAAA00000000000000000001",
      ),
    ).resolves.toEqual([]);

    await expect(
      repository.listLocalEncryptedDocumentPayloadsForPatient(
        "patient_01JAAA00000000000000000001",
      ),
    ).resolves.toEqual([]);
  });

  it("rejects revoked clinical document references before saving", async () => {
    const repository = createInMemoryLocalDocumentRepository();

    await expect(
      saveReferences({
        repository,
        clinicalDocumentReference: revokeClinicalDocumentReference(
          createReference(),
          laterEpochMs,
        ),
      }),
    ).rejects.toThrow("clinical document reference must be active");

    await expect(
      repository.listClinicalDocumentReferencesForPatient(
        "patient_01JAAA00000000000000000001",
      ),
    ).resolves.toEqual([]);
  });

  it("rejects deleted local encrypted payloads before saving", async () => {
    const repository = createInMemoryLocalDocumentRepository();

    await expect(
      saveReferences({
        repository,
        localEncryptedDocumentPayload: markLocalEncryptedDocumentPayloadDeleted(
          createPayload(),
          laterEpochMs,
        ),
      }),
    ).rejects.toThrow("local encrypted document payload must be active");

    await expect(
      repository.listLocalEncryptedDocumentPayloadsForPatient(
        "patient_01JAAA00000000000000000001",
      ),
    ).resolves.toEqual([]);
  });

  it("does not mutate source domain objects", async () => {
    const clinicalDocumentReference = createReference();
    const localEncryptedDocumentPayload = createPayload();

    const referenceSnapshot = JSON.stringify(clinicalDocumentReference);
    const payloadSnapshot = JSON.stringify(localEncryptedDocumentPayload);

    await saveReferences({
      clinicalDocumentReference,
      localEncryptedDocumentPayload,
    });

    expect(JSON.stringify(clinicalDocumentReference)).toBe(referenceSnapshot);
    expect(JSON.stringify(localEncryptedDocumentPayload)).toBe(payloadSnapshot);
    expect(Object.isFrozen(clinicalDocumentReference)).toBe(true);
    expect(Object.isFrozen(localEncryptedDocumentPayload)).toBe(true);
  });

  it("propagates repository payload-save errors and prevents saving reference", async () => {
    const calls: string[] = [];
    const error = new Error("payload save failed");

    const repository = createNoopRepository({
      async saveLocalEncryptedDocumentPayload(payload) {
        calls.push(`payload:${payload.payloadId}`);
        throw error;
      },

      async saveClinicalDocumentReference(reference) {
        calls.push(`reference:${reference.referenceId}`);
        return reference;
      },
    });

    await expect(
      saveLocalDocumentReferences({
        repository,
        clinicalDocumentReference: createReference(),
        localEncryptedDocumentPayload: createPayload(),
      }),
    ).rejects.toThrow("payload save failed");

    expect(calls).toEqual([
      "payload:payload_01JAAA00000000000000000001",
    ]);
  });

  it("propagates repository reference-save errors after payload is saved", async () => {
    const calls: string[] = [];
    const error = new Error("reference save failed");

    const repository = createNoopRepository({
      async saveLocalEncryptedDocumentPayload(payload) {
        calls.push(`payload:${payload.payloadId}`);
        return payload;
      },

      async saveClinicalDocumentReference(reference) {
        calls.push(`reference:${reference.referenceId}`);
        throw error;
      },
    });

    await expect(
      saveLocalDocumentReferences({
        repository,
        clinicalDocumentReference: createReference(),
        localEncryptedDocumentPayload: createPayload(),
      }),
    ).rejects.toThrow("reference save failed");

    expect(calls).toEqual([
      "payload:payload_01JAAA00000000000000000001",
      "reference:cdr_01JAAA00000000000000000001",
    ]);
  });

  it("does not import infrastructure adapters, domain factories, persistence, filesystem, cloud, sync, crypto adapter, AI, OCR, UI, portal, schema, migration, or readable metadata modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/application/local-document-save/localDocumentSaveUseCase.ts",
    );
    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    expect(source).toContain("isclinicaldocumentreferenceactive");
    expect(source).toContain("islocalencrypteddocumentpayloadactive");
    expect(source).not.toContain("revokedatepochms");
    expect(source).not.toContain("deletedatepochms");

    const forbiddenSourceTokens = [
      "inmemorylocaldocumentrepository",
      "createinmemorylocaldocumentrepository",
      "createclinicaldocumentreference",
      "createlocalencrypteddocumentpayload",
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
      "date.now",
      "new date",
    ];

    for (const token of forbiddenSourceTokens) {
      expect(source).not.toContain(token);
    }
  });
});
