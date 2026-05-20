import type { ClinicalDocumentReference } from "../../domain/clinical-document/clinicalDocumentReference";

import type { LocalEncryptedDocumentPayload } from "../../domain/local-encrypted-payload/localEncryptedDocumentPayload";

export const LOCAL_DOCUMENT_REPOSITORY_PORT_VERSION =
  "local_document_repository_port_v1" as const;

export interface LocalDocumentRepositoryPort {
  readonly saveClinicalDocumentReference: (
    reference: ClinicalDocumentReference,
  ) => Promise<ClinicalDocumentReference>;

  readonly saveLocalEncryptedDocumentPayload: (
    payload: LocalEncryptedDocumentPayload,
  ) => Promise<LocalEncryptedDocumentPayload>;

  readonly getClinicalDocumentReferenceByReferenceId: (
    referenceId: string,
  ) => Promise<ClinicalDocumentReference | undefined>;

  readonly getLocalEncryptedDocumentPayloadByPayloadId: (
    payloadId: string,
  ) => Promise<LocalEncryptedDocumentPayload | undefined>;

  readonly listClinicalDocumentReferencesForPatient: (
    patientId: string,
  ) => Promise<readonly ClinicalDocumentReference[]>;

  readonly listActiveClinicalDocumentReferencesForPatient: (
    patientId: string,
  ) => Promise<readonly ClinicalDocumentReference[]>;

  readonly listLocalEncryptedDocumentPayloadsForPatient: (
    patientId: string,
  ) => Promise<readonly LocalEncryptedDocumentPayload[]>;

  readonly listActiveLocalEncryptedDocumentPayloadsForPatient: (
    patientId: string,
  ) => Promise<readonly LocalEncryptedDocumentPayload[]>;
}
