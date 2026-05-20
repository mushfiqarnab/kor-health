import type { ClinicalDocumentReference } from "../../domain/clinical-document/clinicalDocumentReference";

import type { LocalEncryptedDocumentPayload } from "../../domain/local-encrypted-payload/localEncryptedDocumentPayload";

export const LOCAL_DOCUMENT_SAVE_RESULT_STATUS = "completed" as const;

export interface LocalDocumentSaveResultInput {
  readonly savedClinicalDocumentReference: ClinicalDocumentReference;
  readonly savedLocalEncryptedDocumentPayload: LocalEncryptedDocumentPayload;
}

export interface LocalDocumentSaveResult {
  readonly status: typeof LOCAL_DOCUMENT_SAVE_RESULT_STATUS;
  readonly savedClinicalDocumentReference: ClinicalDocumentReference;
  readonly savedLocalEncryptedDocumentPayload: LocalEncryptedDocumentPayload;
}

export function createCompletedLocalDocumentSaveResult(
  input: LocalDocumentSaveResultInput,
): LocalDocumentSaveResult {
  return Object.freeze({
    status: LOCAL_DOCUMENT_SAVE_RESULT_STATUS,
    savedClinicalDocumentReference: input.savedClinicalDocumentReference,
    savedLocalEncryptedDocumentPayload:
      input.savedLocalEncryptedDocumentPayload,
  });
}
