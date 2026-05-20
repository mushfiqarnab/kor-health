import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createClinicalDocumentReference,
  isClinicalDocumentReferenceActive,
  revokeClinicalDocumentReference,
  type ClinicalDocumentReference,
  type CreateClinicalDocumentReferenceInput,
} from "../../../domain/clinical-document/clinicalDocumentReference";

import {
  createLocalEncryptedDocumentPayload,
  isLocalEncryptedDocumentPayloadActive,
  markLocalEncryptedDocumentPayloadDeleted,
  type CreateLocalEncryptedDocumentPayloadInput,
  type LocalEncryptedDocumentPayload,
} from "../../../domain/local-encrypted-payload/localEncryptedDocumentPayload";

import {
  LOCAL_DOCUMENT_REPOSITORY_PORT_VERSION,
  type LocalDocumentRepositoryPort,
} from "../localDocumentRepositoryPort";

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

function createInMemoryContractDouble(): LocalDocumentRepositoryPort {
  const references = new Map<string, ClinicalDocumentReference>();
  const payloads = new Map<string, LocalEncryptedDocumentPayload>();

  return {
    async saveClinicalDocumentReference(reference) {
      references.set(reference.referenceId, reference);
      return reference;
    },

    async saveLocalEncryptedDocumentPayload(payload) {
      payloads.set(payload.payloadId, payload);
      return payload;
    },

    async getClinicalDocumentReferenceByReferenceId(referenceId) {
      return references.get(referenceId);
    },

    async getLocalEncryptedDocumentPayloadByPayloadId(payloadId) {
      return payloads.get(payloadId);
    },

    async listClinicalDocumentReferencesForPatient(patientId) {
      return Array.from(references.values()).filter(
        (reference) => reference.patientId === patientId,
      );
    },

    async listActiveClinicalDocumentReferencesForPatient(patientId) {
      return Array.from(references.values()).filter(
        (reference) =>
          reference.patientId === patientId &&
          isClinicalDocumentReferenceActive(reference),
      );
    },

    async listLocalEncryptedDocumentPayloadsForPatient(patientId) {
      return Array.from(payloads.values()).filter(
        (payload) => payload.patientId === patientId,
      );
    },

    async listActiveLocalEncryptedDocumentPayloadsForPatient(patientId) {
      return Array.from(payloads.values()).filter(
        (payload) =>
          payload.patientId === patientId &&
          isLocalEncryptedDocumentPayloadActive(payload),
      );
    },
  };
}

describe("Local document repository port contract", () => {
  it("exposes a stable port version marker", () => {
    expect(LOCAL_DOCUMENT_REPOSITORY_PORT_VERSION).toBe(
      "local_document_repository_port_v1",
    );
  });

  it("allows clinical document references and encrypted payload references to be saved and retrieved by opaque ids", async () => {
    const repository = createInMemoryContractDouble();
    const reference = createReference();
    const payload = createPayload();

    const savedReference =
      await repository.saveClinicalDocumentReference(reference);
    const savedPayload =
      await repository.saveLocalEncryptedDocumentPayload(payload);

    expect(savedReference).toBe(reference);
    expect(savedPayload).toBe(payload);

    await expect(
      repository.getClinicalDocumentReferenceByReferenceId(
        "cdr_01JAAA00000000000000000001",
      ),
    ).resolves.toBe(reference);

    await expect(
      repository.getLocalEncryptedDocumentPayloadByPayloadId(
        "payload_01JAAA00000000000000000001",
      ),
    ).resolves.toBe(payload);
  });

  it("returns undefined for missing opaque ids instead of fabricating records", async () => {
    const repository = createInMemoryContractDouble();

    await expect(
      repository.getClinicalDocumentReferenceByReferenceId(
        "cdr_01JBBB00000000000000000002",
      ),
    ).resolves.toBeUndefined();

    await expect(
      repository.getLocalEncryptedDocumentPayloadByPayloadId(
        "payload_01JBBB00000000000000000002",
      ),
    ).resolves.toBeUndefined();
  });

  it("lists local references and payloads by opaque patient id without clinical content", async () => {
    const repository = createInMemoryContractDouble();

    const patientOneReference = createReference();
    const patientTwoReference = createReference({
      referenceId: "cdr_01JBBB00000000000000000002",
      patientId: "patient_01JBBB00000000000000000002",
      resourceId: "doc_01JBBB00000000000000000002",
      encryptedPayloadRef: "payload_01JBBB00000000000000000002",
    });

    const patientOnePayload = createPayload();
    const patientTwoPayload = createPayload({
      payloadId: "payload_01JBBB00000000000000000002",
      patientId: "patient_01JBBB00000000000000000002",
      ciphertextRef: "ciphertext_01JBBB00000000000000000002",
      encryptionEnvelopeRef: "envelope_01JBBB00000000000000000002",
    });

    await repository.saveClinicalDocumentReference(patientOneReference);
    await repository.saveClinicalDocumentReference(patientTwoReference);
    await repository.saveLocalEncryptedDocumentPayload(patientOnePayload);
    await repository.saveLocalEncryptedDocumentPayload(patientTwoPayload);

    await expect(
      repository.listClinicalDocumentReferencesForPatient(
        "patient_01JAAA00000000000000000001",
      ),
    ).resolves.toEqual([patientOneReference]);

    await expect(
      repository.listLocalEncryptedDocumentPayloadsForPatient(
        "patient_01JAAA00000000000000000001",
      ),
    ).resolves.toEqual([patientOnePayload]);
  });

  it("defines active-only listing methods for revoked references and deleted payloads", async () => {
    const repository = createInMemoryContractDouble();

    const activeReference = createReference();
    const revokedReference = revokeClinicalDocumentReference(
      createReference({
        referenceId: "cdr_01JBBB00000000000000000002",
        resourceId: "doc_01JBBB00000000000000000002",
        encryptedPayloadRef: "payload_01JBBB00000000000000000002",
      }),
      laterEpochMs,
    );

    const activePayload = createPayload();
    const deletedPayload = markLocalEncryptedDocumentPayloadDeleted(
      createPayload({
        payloadId: "payload_01JBBB00000000000000000002",
        ciphertextRef: "ciphertext_01JBBB00000000000000000002",
        encryptionEnvelopeRef: "envelope_01JBBB00000000000000000002",
      }),
      laterEpochMs,
    );

    await repository.saveClinicalDocumentReference(activeReference);
    await repository.saveClinicalDocumentReference(revokedReference);
    await repository.saveLocalEncryptedDocumentPayload(activePayload);
    await repository.saveLocalEncryptedDocumentPayload(deletedPayload);

    await expect(
      repository.listActiveClinicalDocumentReferencesForPatient(
        "patient_01JAAA00000000000000000001",
      ),
    ).resolves.toEqual([activeReference]);

    await expect(
      repository.listActiveLocalEncryptedDocumentPayloadsForPatient(
        "patient_01JAAA00000000000000000001",
      ),
    ).resolves.toEqual([activePayload]);
  });

  it("does not require or expose clinical content, filenames, paths, URLs, MIME types, payload bytes, or AI/OCR output", async () => {
    const repository = createInMemoryContractDouble();
    const reference = createReference();
    const payload = createPayload();

    await repository.saveClinicalDocumentReference(reference);
    await repository.saveLocalEncryptedDocumentPayload(payload);

    const serializedReference = JSON.stringify(reference).toLowerCase();
    const serializedPayload = JSON.stringify(payload).toLowerCase();

    const forbiddenSerializedTokens = [
      "diagnosis",
      "prescription",
      "lab value",
      "hba1c",
      "filename",
      "filepath",
      "storagepath",
      "storageurl",
      "fileuri",
      "contenturi",
      "mimetype",
      "plaintextbytes",
      "ciphertextbytes",
      "ocr",
      "aioutput",
      "aisummary",
      "rawkeybytes",
      "sealed-key-envelope",
    ];

    for (const token of forbiddenSerializedTokens) {
      expect(serializedReference).not.toContain(token);
      expect(serializedPayload).not.toContain(token);
    }
  });

  it("defines only a port and does not import persistence, filesystem, cloud, sync, crypto adapter, AI, OCR, UI, portal, or adapter modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/application/local-document-repository/localDocumentRepositoryPort.ts",
    );
    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    const forbiddenSourceTokens = [
      "supabase",
      "sqlite",
      "watermelondb",
      "filesystem",
      "expo-file-system",
      "securestore",
      "expo-secure-store",
      "expo-local-authentication",
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
      "createclinicaldocumentreference",
      "createlocalencrypteddocumentpayload",
      "createpatientsharepacket",
    ];

    for (const token of forbiddenSourceTokens) {
      expect(source).not.toContain(token);
    }
  });
});
