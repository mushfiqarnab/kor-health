import {
  isClinicalDocumentReferenceActive,
  type ClinicalDocumentReference,
  type ClinicalDocumentResourceKind,
} from "../clinical-document/clinicalDocumentReference";

import type {
  PatientSharePacket,
  SharePacketResourceKind,
  SharePacketResourceRef,
} from "../share-packet/patientSharePacket";

export type PacketDocumentReferenceCompatibilityDenialReason =
  | "resource_ref_not_in_packet"
  | "resource_id_mismatch"
  | "reference_revoked"
  | "resource_kind_mismatch"
  | "unsupported_packet_resource_kind"
  | "forbidden_metadata";

export type PacketDocumentReferenceCompatibilityResult =
  | {
      readonly compatible: true;
    }
  | {
      readonly compatible: false;
      readonly reason: PacketDocumentReferenceCompatibilityDenialReason;
    };

export interface EvaluatePacketDocumentReferenceCompatibilityInput {
  readonly packet: PatientSharePacket;
  readonly packetResourceRef: SharePacketResourceRef;
  readonly documentReference: ClinicalDocumentReference;
}

const FORBIDDEN_PACKET_DOCUMENT_COMPATIBILITY_METADATA_TOKENS = [
  "mental",
  "mental-health",
  "psychiatric",
  "reproductive",
  "hiv",
  "sti",
  "domestic violence",
  "fertility",
  "diagnosis",
  "prescription",
  "lab value",
  "hba1c",
  "diabetes",
  "pregnancy",
  "oncology",
  "cancer",
  "doctor note",
  "doctor_name",
  "clinic",
  "nid",
  "phone",
  "email",
  "rawkeybytes",
  "raw key",
  "k_root",
  "k_master",
  "k_local_unlock",
  "k_recovery_wrap",
  "local-unlock-v1",
  "sealed-key-envelope",
];

function packetContainsResourceRef(
  packet: PatientSharePacket,
  packetResourceRef: SharePacketResourceRef,
): boolean {
  return packet.resourceRefs.some(
    (resourceRef) =>
      resourceRef.resourceId === packetResourceRef.resourceId &&
      resourceRef.resourceKind === packetResourceRef.resourceKind,
  );
}

function expectedClinicalResourceKindForPacketKind(
  packetResourceKind: SharePacketResourceKind,
): ClinicalDocumentResourceKind | undefined {
  if (packetResourceKind === "report") {
    return "encrypted_report";
  }

  if (packetResourceKind === "visit_packet") {
    return "encrypted_visit_packet";
  }

  if (packetResourceKind === "current_medications") {
    return "encrypted_medication_snapshot";
  }

  if (packetResourceKind === "emergency_card") {
    return "encrypted_emergency_card";
  }

  return undefined;
}

function hasPacketDocumentCompatibilityMetadataLeak(value: unknown): boolean {
  const serializedValue = JSON.stringify(value).toLowerCase();

  return FORBIDDEN_PACKET_DOCUMENT_COMPATIBILITY_METADATA_TOKENS.some((token) =>
    serializedValue.includes(token),
  );
}

export function assertNoPacketDocumentCompatibilityMetadataLeak(
  value: unknown,
): void {
  if (hasPacketDocumentCompatibilityMetadataLeak(value)) {
    throw new Error("forbidden packet document compatibility metadata");
  }
}

export function evaluatePacketDocumentReferenceCompatibility(
  input: EvaluatePacketDocumentReferenceCompatibilityInput,
): PacketDocumentReferenceCompatibilityResult {
  if (hasPacketDocumentCompatibilityMetadataLeak(input)) {
    return {
      compatible: false,
      reason: "forbidden_metadata",
    };
  }

  if (!packetContainsResourceRef(input.packet, input.packetResourceRef)) {
    return {
      compatible: false,
      reason: "resource_ref_not_in_packet",
    };
  }

  if (input.packetResourceRef.resourceId !== input.documentReference.resourceId) {
    return {
      compatible: false,
      reason: "resource_id_mismatch",
    };
  }

  if (!isClinicalDocumentReferenceActive(input.documentReference)) {
    return {
      compatible: false,
      reason: "reference_revoked",
    };
  }

  const expectedClinicalResourceKind =
    expectedClinicalResourceKindForPacketKind(
      input.packetResourceRef.resourceKind,
    );

  if (expectedClinicalResourceKind === undefined) {
    return {
      compatible: false,
      reason: "unsupported_packet_resource_kind",
    };
  }

  if (input.documentReference.resourceKind !== expectedClinicalResourceKind) {
    return {
      compatible: false,
      reason: "resource_kind_mismatch",
    };
  }

  return {
    compatible: true,
  };
}

export function canAttachDocumentReferenceToPacket(
  input: EvaluatePacketDocumentReferenceCompatibilityInput,
): boolean {
  return evaluatePacketDocumentReferenceCompatibility(input).compatible;
}