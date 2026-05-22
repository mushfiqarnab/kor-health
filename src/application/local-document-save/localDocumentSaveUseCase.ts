import type { ClinicalDocumentReference } from "../../domain/clinical-document/clinicalDocumentReference";

import type { LocalEncryptedDocumentPayload } from "../../domain/local-encrypted-payload/localEncryptedDocumentPayload";

import type { LocalDocumentRepositoryPort } from "../local-document-repository/localDocumentRepositoryPort";

import {
  prepareLocalDocumentSave,
  type LocalDocumentSavePreflightFailureReason,
} from "./localDocumentSavePreflight";

import {
  LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE,
  LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE,
  type LocalDocumentRepositoryFailureClassification,
} from "./localDocumentRepositoryFailureClassification";

import { classifyAndRethrowLocalDocumentRepositoryFailure } from "./localDocumentRepositoryFailureRethrow";

import {
  createCompletedLocalDocumentSaveResult,
  type LocalDocumentSaveResult,
} from "./localDocumentSaveResult";

export interface SaveLocalDocumentReferencesInput {
  readonly repository: LocalDocumentRepositoryPort;
  readonly clinicalDocumentReference: ClinicalDocumentReference;
  readonly localEncryptedDocumentPayload: LocalEncryptedDocumentPayload;
  readonly onRepositoryFailureClassification?: (
    classification: LocalDocumentRepositoryFailureClassification,
  ) => void;
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
): Promise<LocalDocumentSaveResult> {
  assertLocalDocumentSavePreflightReady(input);

  const savedLocalEncryptedDocumentPayload = await input.repository
    .saveLocalEncryptedDocumentPayload(input.localEncryptedDocumentPayload)
    .catch((cause: unknown) =>
      classifyAndRethrowLocalDocumentRepositoryFailure({
        phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE,
        cause,
        onClassification: input.onRepositoryFailureClassification,
      }),
    );

  const savedClinicalDocumentReference = await input.repository
    .saveClinicalDocumentReference(input.clinicalDocumentReference)
    .catch((cause: unknown) =>
      classifyAndRethrowLocalDocumentRepositoryFailure({
        phase: LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE,
        cause,
        onClassification: input.onRepositoryFailureClassification,
      }),
    );

  return createCompletedLocalDocumentSaveResult({
    savedClinicalDocumentReference,
    savedLocalEncryptedDocumentPayload,
  });
}


