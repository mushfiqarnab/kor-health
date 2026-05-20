import {
  isClinicalDocumentReferenceActive,
  type ClinicalDocumentReference,
} from "../../domain/clinical-document/clinicalDocumentReference";

import {
  isLocalEncryptedDocumentPayloadActive,
  type LocalEncryptedDocumentPayload,
} from "../../domain/local-encrypted-payload/localEncryptedDocumentPayload";

import type { LocalDocumentRepositoryPort } from "../../application/local-document-repository/localDocumentRepositoryPort";

export function createInMemoryLocalDocumentRepository(): LocalDocumentRepositoryPort {
  const clinicalDocumentReferencesById = new Map<
    string,
    ClinicalDocumentReference
  >();

  const localEncryptedDocumentPayloadsById = new Map<
    string,
    LocalEncryptedDocumentPayload
  >();

  function listReferenceValues(): readonly ClinicalDocumentReference[] {
    return Array.from(clinicalDocumentReferencesById.values());
  }

  function listPayloadValues(): readonly LocalEncryptedDocumentPayload[] {
    return Array.from(localEncryptedDocumentPayloadsById.values());
  }

  return {
    async saveClinicalDocumentReference(reference) {
      clinicalDocumentReferencesById.set(reference.referenceId, reference);
      return reference;
    },

    async saveLocalEncryptedDocumentPayload(payload) {
      localEncryptedDocumentPayloadsById.set(payload.payloadId, payload);
      return payload;
    },

    async getClinicalDocumentReferenceByReferenceId(referenceId) {
      return clinicalDocumentReferencesById.get(referenceId);
    },

    async getLocalEncryptedDocumentPayloadByPayloadId(payloadId) {
      return localEncryptedDocumentPayloadsById.get(payloadId);
    },

    async listClinicalDocumentReferencesForPatient(patientId) {
      return listReferenceValues().filter(
        (reference) => reference.patientId === patientId,
      );
    },

    async listActiveClinicalDocumentReferencesForPatient(patientId) {
      return listReferenceValues().filter(
        (reference) =>
          reference.patientId === patientId &&
          isClinicalDocumentReferenceActive(reference),
      );
    },

    async listLocalEncryptedDocumentPayloadsForPatient(patientId) {
      return listPayloadValues().filter(
        (payload) => payload.patientId === patientId,
      );
    },

    async listActiveLocalEncryptedDocumentPayloadsForPatient(patientId) {
      return listPayloadValues().filter(
        (payload) =>
          payload.patientId === patientId &&
          isLocalEncryptedDocumentPayloadActive(payload),
      );
    },
  };
}
