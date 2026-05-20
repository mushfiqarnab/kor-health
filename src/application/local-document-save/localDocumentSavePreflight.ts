import {
  isClinicalDocumentReferenceActive,
  type ClinicalDocumentReference,
} from "../../domain/clinical-document/clinicalDocumentReference";

import {
  isLocalEncryptedDocumentPayloadActive,
  type LocalEncryptedDocumentPayload,
} from "../../domain/local-encrypted-payload/localEncryptedDocumentPayload";

export const LOCAL_DOCUMENT_SAVE_ORDER = Object.freeze([
  "local_encrypted_document_payload",
  "clinical_document_reference",
] as const);

export interface LocalDocumentSavePreflightInput {
  readonly clinicalDocumentReference: ClinicalDocumentReference;
  readonly localEncryptedDocumentPayload: LocalEncryptedDocumentPayload;
}

export type LocalDocumentSavePreflightFailureReason =
  | "patient_id_mismatch"
  | "encrypted_payload_ref_mismatch"
  | "clinical_document_reference_inactive"
  | "local_encrypted_document_payload_inactive";

export type LocalDocumentSavePreflightDecision =
  | {
      readonly ready: true;
      readonly saveOrder: typeof LOCAL_DOCUMENT_SAVE_ORDER;
    }
  | {
      readonly ready: false;
      readonly reason: LocalDocumentSavePreflightFailureReason;
    };

export function prepareLocalDocumentSave(
  input: LocalDocumentSavePreflightInput,
): LocalDocumentSavePreflightDecision {
  if (
    input.clinicalDocumentReference.patientId !==
    input.localEncryptedDocumentPayload.patientId
  ) {
    return {
      ready: false,
      reason: "patient_id_mismatch",
    };
  }

  if (
    input.clinicalDocumentReference.encryptedPayloadRef !==
    input.localEncryptedDocumentPayload.payloadId
  ) {
    return {
      ready: false,
      reason: "encrypted_payload_ref_mismatch",
    };
  }

  if (!isClinicalDocumentReferenceActive(input.clinicalDocumentReference)) {
    return {
      ready: false,
      reason: "clinical_document_reference_inactive",
    };
  }

  if (!isLocalEncryptedDocumentPayloadActive(input.localEncryptedDocumentPayload)) {
    return {
      ready: false,
      reason: "local_encrypted_document_payload_inactive",
    };
  }

  return {
    ready: true,
    saveOrder: LOCAL_DOCUMENT_SAVE_ORDER,
  };
}
