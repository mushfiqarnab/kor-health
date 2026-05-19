import type { ClinicalDocumentReference } from "../clinical-document/clinicalDocumentReference";
import type { PatientSharePacket } from "../share-packet/patientSharePacket";

import { selectClinicalDocumentReferencesForSharePacket } from "./sharePacketClinicalReferenceSelection";

export interface SelectClinicalDocumentReferencesForSharePacketResultInput {
  readonly packet: PatientSharePacket;
  readonly candidateReferences: readonly ClinicalDocumentReference[];
}

export interface SharePacketClinicalReferenceSelectionResult {
  readonly selectedReferences: readonly ClinicalDocumentReference[];
  readonly selectedReferenceCount: number;
  readonly packetResourceRefCount: number;
  readonly candidateReferenceCount: number;
  readonly unmatchedPacketResourceRefCount: number;
}

export function selectClinicalDocumentReferencesForSharePacketResult(
  input: SelectClinicalDocumentReferencesForSharePacketResultInput,
): SharePacketClinicalReferenceSelectionResult {
  const selectedReferences = selectClinicalDocumentReferencesForSharePacket({
    packet: input.packet,
    candidateReferences: input.candidateReferences,
  });

  return {
    selectedReferences,
    selectedReferenceCount: selectedReferences.length,
    packetResourceRefCount: input.packet.resourceRefs.length,
    candidateReferenceCount: input.candidateReferences.length,
    unmatchedPacketResourceRefCount:
      input.packet.resourceRefs.length - selectedReferences.length,
  };
}
