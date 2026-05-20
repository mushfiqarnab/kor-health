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

import {
  LOCAL_DOCUMENT_SAVE_ORDER,
  prepareLocalDocumentSave,
  type LocalDocumentSavePreflightDecision,
  type LocalDocumentSavePreflightInput,
} from "../localDocumentSavePreflight";

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
  overrides: Partial<LocalDocumentSavePreflightInput> = {},
): LocalDocumentSavePreflightInput {
  return {
    clinicalDocumentReference: createReference(),
    localEncryptedDocumentPayload: createPayload(),
    ...overrides,
  };
}

function expectDecisionToExposeOnlySafeKeys(
  decision: LocalDocumentSavePreflightDecision,
): void {
  const keys = Object.keys(decision).sort();

  if (decision.ready) {
    expect(keys).toEqual(["ready", "saveOrder"]);
    return;
  }

  expect(keys).toEqual(["ready", "reason"]);
}

function expectDecisionToExposeNoIdentifiers(
  decision: LocalDocumentSavePreflightDecision,
): void {
  const serializedDecision = JSON.stringify(decision).toLowerCase();

  const forbiddenIdentifierFragments = [
    "patient_01",
    "payload_01",
    "cdr_01",
    "doc_01",
    "ciphertext_01",
    "envelope_01",
    "01jaaa",
    "01jbbb",
  ];

  const forbiddenUnsafeFieldNames = [
    "referenceid",
    "patientid",
    "resourceid",
    "payloadid",
    "encryptedpayloadref",
    "ciphertextref",
    "encryptionschem",
    "diagnosis",
    "prescription",
    "hba1c",
    "filename",
    "filepath",
    "storagepath",
    "storageurl",
    "fileuri",
    "contenturi",
    "mimetype",
  ];

  for (const fragment of [
    ...forbiddenIdentifierFragments,
    ...forbiddenUnsafeFieldNames,
  ]) {
    expect(serializedDecision).not.toContain(fragment);
  }
}

describe("Local document save preflight decision contract", () => {
  it("returns a safe ready decision with explicit payload-first save order", () => {
    const decision: LocalDocumentSavePreflightDecision =
      prepareLocalDocumentSave(baseInput());

    expect(decision).toEqual({
      ready: true,
      saveOrder: [
        "local_encrypted_document_payload",
        "clinical_document_reference",
      ],
    });

    expect(LOCAL_DOCUMENT_SAVE_ORDER).toEqual([
      "local_encrypted_document_payload",
      "clinical_document_reference",
    ]);

    expect(Object.isFrozen(LOCAL_DOCUMENT_SAVE_ORDER)).toBe(true);
    expectDecisionToExposeOnlySafeKeys(decision);
    expectDecisionToExposeNoIdentifiers(decision);
  });

  it("rejects mismatched patient ids without exposing identifiers", () => {
    const decision = prepareLocalDocumentSave(
      baseInput({
        localEncryptedDocumentPayload: createPayload({
          patientId: "patient_01JBBB00000000000000000002",
        }),
      }),
    );

    expect(decision).toEqual({
      ready: false,
      reason: "patient_id_mismatch",
    });

    expectDecisionToExposeOnlySafeKeys(decision);
    expectDecisionToExposeNoIdentifiers(decision);
  });

  it("rejects mismatched encrypted payload refs without exposing resource ids", () => {
    const decision = prepareLocalDocumentSave(
      baseInput({
        clinicalDocumentReference: createReference({
          encryptedPayloadRef: "payload_01JBBB00000000000000000002",
        }),
      }),
    );

    expect(decision).toEqual({
      ready: false,
      reason: "encrypted_payload_ref_mismatch",
    });

    expectDecisionToExposeOnlySafeKeys(decision);
    expectDecisionToExposeNoIdentifiers(decision);
  });

  it("rejects revoked clinical document references using the domain active-state helper", () => {
    const decision = prepareLocalDocumentSave(
      baseInput({
        clinicalDocumentReference: revokeClinicalDocumentReference(
          createReference(),
          laterEpochMs,
        ),
      }),
    );

    expect(decision).toEqual({
      ready: false,
      reason: "clinical_document_reference_inactive",
    });

    expectDecisionToExposeOnlySafeKeys(decision);
    expectDecisionToExposeNoIdentifiers(decision);
  });

  it("rejects deleted local encrypted payloads using the domain active-state helper", () => {
    const decision = prepareLocalDocumentSave(
      baseInput({
        localEncryptedDocumentPayload: markLocalEncryptedDocumentPayloadDeleted(
          createPayload(),
          laterEpochMs,
        ),
      }),
    );

    expect(decision).toEqual({
      ready: false,
      reason: "local_encrypted_document_payload_inactive",
    });

    expectDecisionToExposeOnlySafeKeys(decision);
    expectDecisionToExposeNoIdentifiers(decision);
  });

  it("uses deterministic validation precedence", () => {
    const decision = prepareLocalDocumentSave(
      baseInput({
        clinicalDocumentReference: revokeClinicalDocumentReference(
          createReference({
            encryptedPayloadRef: "payload_01JBBB00000000000000000002",
          }),
          laterEpochMs,
        ),
        localEncryptedDocumentPayload: markLocalEncryptedDocumentPayloadDeleted(
          createPayload({
            patientId: "patient_01JBBB00000000000000000002",
          }),
          laterEpochMs,
        ),
      }),
    );

    expect(decision).toEqual({
      ready: false,
      reason: "patient_id_mismatch",
    });
  });

  it("returns only approved non-clinical failure reasons", () => {
    const decisions = [
      prepareLocalDocumentSave(
        baseInput({
          localEncryptedDocumentPayload: createPayload({
            patientId: "patient_01JBBB00000000000000000002",
          }),
        }),
      ),
      prepareLocalDocumentSave(
        baseInput({
          clinicalDocumentReference: createReference({
            encryptedPayloadRef: "payload_01JBBB00000000000000000002",
          }),
        }),
      ),
      prepareLocalDocumentSave(
        baseInput({
          clinicalDocumentReference: revokeClinicalDocumentReference(
            createReference(),
            laterEpochMs,
          ),
        }),
      ),
      prepareLocalDocumentSave(
        baseInput({
          localEncryptedDocumentPayload:
            markLocalEncryptedDocumentPayloadDeleted(
              createPayload(),
              laterEpochMs,
            ),
        }),
      ),
    ];

    expect(decisions).toEqual([
      {
        ready: false,
        reason: "patient_id_mismatch",
      },
      {
        ready: false,
        reason: "encrypted_payload_ref_mismatch",
      },
      {
        ready: false,
        reason: "clinical_document_reference_inactive",
      },
      {
        ready: false,
        reason: "local_encrypted_document_payload_inactive",
      },
    ]);

    for (const decision of decisions) {
      expectDecisionToExposeOnlySafeKeys(decision);
      expectDecisionToExposeNoIdentifiers(decision);
    }
  });

  it("does not mutate source domain objects", () => {
    const clinicalDocumentReference = createReference();
    const localEncryptedDocumentPayload = createPayload();

    const referenceSnapshot = JSON.stringify(clinicalDocumentReference);
    const payloadSnapshot = JSON.stringify(localEncryptedDocumentPayload);

    prepareLocalDocumentSave({
      clinicalDocumentReference,
      localEncryptedDocumentPayload,
    });

    expect(JSON.stringify(clinicalDocumentReference)).toBe(referenceSnapshot);
    expect(JSON.stringify(localEncryptedDocumentPayload)).toBe(payloadSnapshot);
    expect(Object.isFrozen(clinicalDocumentReference)).toBe(true);
    expect(Object.isFrozen(localEncryptedDocumentPayload)).toBe(true);
  });

  it("does not import repository ports, infrastructure adapters, domain factories, persistence, filesystem, cloud, sync, crypto adapter, AI, OCR, UI, portal, schema, migration, or readable metadata modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/application/local-document-save/localDocumentSavePreflight.ts",
    );
    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    expect(source).toContain("isclinicaldocumentreferenceactive");
    expect(source).toContain("islocalencrypteddocumentpayloadactive");
    expect(source).not.toContain("revokedatepochms");
    expect(source).not.toContain("deletedatepochms");

    const forbiddenSourceTokens = [
      "localdocumentrepositoryport",
      "repository",
      "inmemorylocaldocumentrepository",
      "createinmemorylocaldocumentrepository",
      "createclinicaldocumentreference",
      "createlocalencrypteddocumentpayload",
      "patientsharepacket",
      "sharepacket",
      "resourceid",
      "resourceids",
      "referenceid",
      "selectedreferences",
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

