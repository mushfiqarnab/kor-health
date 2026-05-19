import type { ClinicalDocumentReference } from "../clinical-document/clinicalDocumentReference";
import type { PatientSharePacket } from "../share-packet/patientSharePacket";

import { canAttachDocumentReferenceToPacket } from "./sharePacketDocumentReferenceCompatibility";

export interface SelectClinicalDocumentReferencesForSharePacketInput {
  readonly packet: PatientSharePacket;
  readonly candidateReferences: readonly ClinicalDocumentReference[];
}

export function selectClinicalDocumentReferencesForSharePacket(
  input: SelectClinicalDocumentReferencesForSharePacketInput,
): ClinicalDocumentReference[] {
  const selectedReferences: ClinicalDocumentReference[] = [];

  for (const packetResourceRef of input.packet.resourceRefs) {
    const compatibleReference = input.candidateReferences.find(
      (documentReference) =>
        canAttachDocumentReferenceToPacket({
          packet: input.packet,
          packetResourceRef,
          documentReference,
        }),
    );

    if (compatibleReference !== undefined) {
      selectedReferences.push(compatibleReference);
    }
  }

  return selectedReferences;
}
