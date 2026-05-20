import {
  isClinicalDocumentReferenceActive,
  type ClinicalDocumentReference,
} from "../../domain/clinical-document/clinicalDocumentReference";

import {
  isLocalEncryptedDocumentPayloadActive,
  type LocalEncryptedDocumentPayload,
} from "../../domain/local-encrypted-payload/localEncryptedDocumentPayload";

import type { LocalDocumentRepositoryPort } from "../local-document-repository/localDocumentRepositoryPort";

export interface SaveLocalDocumentReferencesInput {
  readonly repository: LocalDocumentRepositoryPort;
  readonly clinicalDocumentReference: ClinicalDocumentReference;
  readonly localEncryptedDocumentPayload: LocalEncryptedDocumentPayload;
}

export interface SaveLocalDocumentReferencesResult {
  readonly savedClinicalDocumentReference: ClinicalDocumentReference;
  readonly savedLocalEncryptedDocumentPayload: LocalEncryptedDocumentPayload;
}

function assertPatientIdsMatch(input: SaveLocalDocumentReferencesInput): void {
  if (
    input.clinicalDocumentReference.patientId !==
    input.localEncryptedDocumentPayload.patientId
  ) {
    throw new Error(
      "clinical document reference and encrypted payload patientId must match",
    );
  }
}

function assertPayloadReferenceMatches(
  input: SaveLocalDocumentReferencesInput,
): void {
  if (
    input.clinicalDocumentReference.encryptedPayloadRef !==
    input.localEncryptedDocumentPayload.payloadId
  ) {
    throw new Error(
      "clinical document reference encryptedPayloadRef must match encrypted payload payloadId",
    );
  }
}

function assertReferencesAreActive(input: SaveLocalDocumentReferencesInput): void {
  if (!isClinicalDocumentReferenceActive(input.clinicalDocumentReference)) {
    throw new Error("clinical document reference must be active");
  }

  if (!isLocalEncryptedDocumentPayloadActive(input.localEncryptedDocumentPayload)) {
    throw new Error("local encrypted document payload must be active");
  }
}

export async function saveLocalDocumentReferences(
  input: SaveLocalDocumentReferencesInput,
): Promise<SaveLocalDocumentReferencesResult> {
  assertPatientIdsMatch(input);
  assertPayloadReferenceMatches(input);
  assertReferencesAreActive(input);

  const savedLocalEncryptedDocumentPayload =
    await input.repository.saveLocalEncryptedDocumentPayload(
      input.localEncryptedDocumentPayload,
    );

  const savedClinicalDocumentReference =
    await input.repository.saveClinicalDocumentReference(
      input.clinicalDocumentReference,
    );

  return {
    savedClinicalDocumentReference,
    savedLocalEncryptedDocumentPayload,
  };
}
