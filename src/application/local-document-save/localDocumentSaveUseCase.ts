import type { ClinicalDocumentReference } from "../../domain/clinical-document/clinicalDocumentReference";

import type { LocalEncryptedDocumentPayload } from "../../domain/local-encrypted-payload/localEncryptedDocumentPayload";

import type { LocalDocumentRepositoryPort } from "../local-document-repository/localDocumentRepositoryPort";

import {
  prepareLocalDocumentSave,
  type LocalDocumentSavePreflightFailureReason,
} from "./localDocumentSavePreflight";

export interface SaveLocalDocumentReferencesInput {
  readonly repository: LocalDocumentRepositoryPort;
  readonly clinicalDocumentReference: ClinicalDocumentReference;
  readonly localEncryptedDocumentPayload: LocalEncryptedDocumentPayload;
}

export interface SaveLocalDocumentReferencesResult {
  readonly savedClinicalDocumentReference: ClinicalDocumentReference;
  readonly savedLocalEncryptedDocumentPayload: LocalEncryptedDocumentPayload;
}

function toSavePreflightErrorMessage(
  reason: LocalDocumentSavePreflightFailureReason,
): string {
  if (reason === "patient_id_mismatch") {
    return "clinical document reference and encrypted payload patientId must match";
  }

  if (reason === "encrypted_payload_ref_mismatch") {
    return "clinical document reference encryptedPayloadRef must match encrypted payload payloadId";
  }

  if (reason === "clinical_document_reference_inactive") {
    return "clinical document reference must be active";
  }

  if (reason === "local_encrypted_document_payload_inactive") {
    return "local encrypted document payload must be active";
  }

  const exhaustiveReason: never = reason;
  return exhaustiveReason;
}

function assertLocalDocumentSavePreflightReady(
  input: SaveLocalDocumentReferencesInput,
): void {
  const decision = prepareLocalDocumentSave({
    clinicalDocumentReference: input.clinicalDocumentReference,
    localEncryptedDocumentPayload: input.localEncryptedDocumentPayload,
  });

  if (!decision.ready) {
    throw new Error(toSavePreflightErrorMessage(decision.reason));
  }
}

export async function saveLocalDocumentReferences(
  input: SaveLocalDocumentReferencesInput,
): Promise<SaveLocalDocumentReferencesResult> {
  assertLocalDocumentSavePreflightReady(input);

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
