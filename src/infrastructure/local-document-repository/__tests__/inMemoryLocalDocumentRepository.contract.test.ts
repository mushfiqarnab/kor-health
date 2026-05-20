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

import type { LocalDocumentRepositoryPort } from "../../../application/local-document-repository/localDocumentRepositoryPort";

import { createInMemoryLocalDocumentRepository } from "../inMemoryLocalDocumentRepository";

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

function createRepository(): LocalDocumentRepositoryPort {
  return createInMemoryLocalDocumentRepository();
}

describe("In-memory local document repository adapter contract", () => {
  it("implements the local document repository port", async () => {
    const repository = createRepository();
    const reference = createReference();
    const payload = createPayload();

    await expect(
      repository.saveClinicalDocumentReference(reference),
    ).resolves.toBe(reference);

    await expect(
      repository.saveLocalEncryptedDocumentPayload(payload),
    ).resolves.toBe(payload);
  });

  it("saves and retrieves clinical document references and encrypted payload references by opaque ids", async () => {
    const repository = createRepository();
    const reference = createReference();
    const payload = createPayload();

    await repository.saveClinicalDocumentReference(reference);
    await repository.saveLocalEncryptedDocumentPayload(payload);

    await expect(
      repository.getClinicalDocumentReferenceByReferenceId(reference.referenceId),
    ).resolves.toBe(reference);

    await expect(
      repository.getLocalEncryptedDocumentPayloadByPayloadId(payload.payloadId),
    ).resolves.toBe(payload);
  });

  it("returns undefined for missing opaque ids", async () => {
    const repository = createRepository();

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

  it("lists references and payloads by opaque patient id in insertion order", async () => {
    const repository = createRepository();

    const firstReference = createReference({
      referenceId: "cdr_01JAAA00000000000000000001",
      resourceId: "doc_01JAAA00000000000000000001",
      encryptedPayloadRef: "payload_01JAAA00000000000000000001",
    });
    const secondReference = createReference({
      referenceId: "cdr_01JAAA00000000000000000002",
      resourceId: "doc_01JAAA00000000000000000002",
      encryptedPayloadRef: "payload_01JAAA00000000000000000002",
    });
    const otherPatientReference = createReference({
      referenceId: "cdr_01JBBB00000000000000000003",
      patientId: "patient_01JBBB00000000000000000002",
      resourceId: "doc_01JBBB00000000000000000003",
      encryptedPayloadRef: "payload_01JBBB00000000000000000003",
    });

    const firstPayload = createPayload({
      payloadId: "payload_01JAAA00000000000000000001",
      ciphertextRef: "ciphertext_01JAAA00000000000000000001",
      encryptionEnvelopeRef: "envelope_01JAAA00000000000000000001",
    });
    const secondPayload = createPayload({
      payloadId: "payload_01JAAA00000000000000000002",
      ciphertextRef: "ciphertext_01JAAA00000000000000000002",
      encryptionEnvelopeRef: "envelope_01JAAA00000000000000000002",
    });
    const otherPatientPayload = createPayload({
      payloadId: "payload_01JBBB00000000000000000003",
      patientId: "patient_01JBBB00000000000000000002",
      ciphertextRef: "ciphertext_01JBBB00000000000000000003",
      encryptionEnvelopeRef: "envelope_01JBBB00000000000000000003",
    });

    await repository.saveClinicalDocumentReference(firstReference);
    await repository.saveClinicalDocumentReference(otherPatientReference);
    await repository.saveClinicalDocumentReference(secondReference);

    await repository.saveLocalEncryptedDocumentPayload(firstPayload);
    await repository.saveLocalEncryptedDocumentPayload(otherPatientPayload);
    await repository.saveLocalEncryptedDocumentPayload(secondPayload);

    await expect(
      repository.listClinicalDocumentReferencesForPatient(
        "patient_01JAAA00000000000000000001",
      ),
    ).resolves.toEqual([firstReference, secondReference]);

    await expect(
      repository.listLocalEncryptedDocumentPayloadsForPatient(
        "patient_01JAAA00000000000000000001",
      ),
    ).resolves.toEqual([firstPayload, secondPayload]);
  });

  it("uses domain active-state helpers to exclude revoked references and deleted payloads", async () => {
    const repository = createRepository();

    const activeReference = createReference({
      referenceId: "cdr_01JAAA00000000000000000001",
      resourceId: "doc_01JAAA00000000000000000001",
      encryptedPayloadRef: "payload_01JAAA00000000000000000001",
    });
    const revokedReference = revokeClinicalDocumentReference(
      createReference({
        referenceId: "cdr_01JAAA00000000000000000002",
        resourceId: "doc_01JAAA00000000000000000002",
        encryptedPayloadRef: "payload_01JAAA00000000000000000002",
      }),
      laterEpochMs,
    );

    const activePayload = createPayload({
      payloadId: "payload_01JAAA00000000000000000001",
      ciphertextRef: "ciphertext_01JAAA00000000000000000001",
      encryptionEnvelopeRef: "envelope_01JAAA00000000000000000001",
    });
    const deletedPayload = markLocalEncryptedDocumentPayloadDeleted(
      createPayload({
        payloadId: "payload_01JAAA00000000000000000002",
        ciphertextRef: "ciphertext_01JAAA00000000000000000002",
        encryptionEnvelopeRef: "envelope_01JAAA00000000000000000002",
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

  it("replaces records saved with the same opaque id without duplicating list results", async () => {
    const repository = createRepository();

    const originalReference = createReference();
    const updatedReference = createReference({
      updatedAtEpochMs: laterEpochMs,
    });

    const originalPayload = createPayload();
    const updatedPayload = createPayload({
      updatedAtEpochMs: laterEpochMs,
    });

    await repository.saveClinicalDocumentReference(originalReference);
    await repository.saveClinicalDocumentReference(updatedReference);
    await repository.saveLocalEncryptedDocumentPayload(originalPayload);
    await repository.saveLocalEncryptedDocumentPayload(updatedPayload);

    await expect(
      repository.getClinicalDocumentReferenceByReferenceId(
        originalReference.referenceId,
      ),
    ).resolves.toBe(updatedReference);

    await expect(
      repository.getLocalEncryptedDocumentPayloadByPayloadId(
        originalPayload.payloadId,
      ),
    ).resolves.toBe(updatedPayload);

    await expect(
      repository.listClinicalDocumentReferencesForPatient(
        "patient_01JAAA00000000000000000001",
      ),
    ).resolves.toEqual([updatedReference]);

    await expect(
      repository.listLocalEncryptedDocumentPayloadsForPatient(
        "patient_01JAAA00000000000000000001",
      ),
    ).resolves.toEqual([updatedPayload]);
  });

  it("moves replaced records to the replacement patient list for the same opaque id", async () => {
    const repository = createRepository();

    const originalReference = createReference();
    const replacementReference = createReference({
      patientId: "patient_01JBBB00000000000000000002",
      resourceId: "doc_01JBBB00000000000000000002",
      encryptedPayloadRef: "payload_01JBBB00000000000000000002",
      updatedAtEpochMs: laterEpochMs,
    });

    const originalPayload = createPayload();
    const replacementPayload = createPayload({
      patientId: "patient_01JBBB00000000000000000002",
      ciphertextRef: "ciphertext_01JBBB00000000000000000002",
      encryptionEnvelopeRef: "envelope_01JBBB00000000000000000002",
      updatedAtEpochMs: laterEpochMs,
    });

    await repository.saveClinicalDocumentReference(originalReference);
    await repository.saveClinicalDocumentReference(replacementReference);
    await repository.saveLocalEncryptedDocumentPayload(originalPayload);
    await repository.saveLocalEncryptedDocumentPayload(replacementPayload);

    await expect(
      repository.listClinicalDocumentReferencesForPatient(
        "patient_01JAAA00000000000000000001",
      ),
    ).resolves.toEqual([]);

    await expect(
      repository.listClinicalDocumentReferencesForPatient(
        "patient_01JBBB00000000000000000002",
      ),
    ).resolves.toEqual([replacementReference]);

    await expect(
      repository.listLocalEncryptedDocumentPayloadsForPatient(
        "patient_01JAAA00000000000000000001",
      ),
    ).resolves.toEqual([]);

    await expect(
      repository.listLocalEncryptedDocumentPayloadsForPatient(
        "patient_01JBBB00000000000000000002",
      ),
    ).resolves.toEqual([replacementPayload]);
  });

  it("keeps separate in-memory repository instances isolated", async () => {
    const firstRepository = createRepository();
    const secondRepository = createRepository();

    const reference = createReference();
    const payload = createPayload();

    await firstRepository.saveClinicalDocumentReference(reference);
    await firstRepository.saveLocalEncryptedDocumentPayload(payload);

    await expect(
      secondRepository.getClinicalDocumentReferenceByReferenceId(
        reference.referenceId,
      ),
    ).resolves.toBeUndefined();

    await expect(
      secondRepository.getLocalEncryptedDocumentPayloadByPayloadId(
        payload.payloadId,
      ),
    ).resolves.toBeUndefined();
  });

  it("returns fresh list arrays without mutating stored domain objects", async () => {
    const repository = createRepository();
    const reference = createReference();
    const payload = createPayload();

    await repository.saveClinicalDocumentReference(reference);
    await repository.saveLocalEncryptedDocumentPayload(payload);

    const firstReferenceList =
      await repository.listClinicalDocumentReferencesForPatient(
        "patient_01JAAA00000000000000000001",
      );
    const secondReferenceList =
      await repository.listClinicalDocumentReferencesForPatient(
        "patient_01JAAA00000000000000000001",
      );

    const firstPayloadList =
      await repository.listLocalEncryptedDocumentPayloadsForPatient(
        "patient_01JAAA00000000000000000001",
      );
    const secondPayloadList =
      await repository.listLocalEncryptedDocumentPayloadsForPatient(
        "patient_01JAAA00000000000000000001",
      );

    expect(firstReferenceList).not.toBe(secondReferenceList);
    expect(firstPayloadList).not.toBe(secondPayloadList);
    expect(firstReferenceList).toEqual([reference]);
    expect(firstPayloadList).toEqual([payload]);
    expect(Object.isFrozen(reference)).toBe(true);
    expect(Object.isFrozen(payload)).toBe(true);
  });

  it("does not import persistence, filesystem, cloud, sync, crypto adapter, AI, OCR, UI, portal, browser storage, mobile storage, schema, migration, or domain factory modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/infrastructure/local-document-repository/inMemoryLocalDocumentRepository.ts",
    );
    const source = readFileSync(sourcePath, "utf8");
    const lowerSource = source.toLowerCase();

    expect(source).toContain("isClinicalDocumentReferenceActive");
    expect(source).toContain("isLocalEncryptedDocumentPayloadActive");
    expect(lowerSource).not.toContain("revokedatepochms");
    expect(lowerSource).not.toContain("deletedatepochms");

    const forbiddenSourceTokens = [
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
      "createclinicaldocumentreference",
      "createlocalencrypteddocumentpayload",
      "createpatientsharepacket",
      "date.now",
      "new date",
    ];

    for (const token of forbiddenSourceTokens) {
      expect(lowerSource).not.toContain(token);
    }
  });
});
