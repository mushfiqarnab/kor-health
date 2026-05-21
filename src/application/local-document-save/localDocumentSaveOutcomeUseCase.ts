import {
  prepareLocalDocumentSave,
} from "./localDocumentSavePreflight";

import {
  createCompletedLocalDocumentSaveOutcome,
  createRejectedLocalDocumentSaveOutcome,
  type LocalDocumentSaveOutcome,
} from "./localDocumentSaveOutcome";

import {
  saveLocalDocumentReferences,
  type SaveLocalDocumentReferencesInput,
} from "./localDocumentSaveUseCase";

export async function saveLocalDocumentReferencesWithOutcome(
  input: SaveLocalDocumentReferencesInput,
): Promise<LocalDocumentSaveOutcome> {
  const decision = prepareLocalDocumentSave({
    clinicalDocumentReference: input.clinicalDocumentReference,
    localEncryptedDocumentPayload: input.localEncryptedDocumentPayload,
  });

  if (!decision.ready) {
    return createRejectedLocalDocumentSaveOutcome({
      rejectionReason: decision.reason,
    });
  }

  const result = await saveLocalDocumentReferences(input);

  return createCompletedLocalDocumentSaveOutcome({ result });
}
