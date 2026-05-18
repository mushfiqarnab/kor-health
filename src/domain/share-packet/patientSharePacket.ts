import {
  canUseConsentCapability,
  isConsentGrantActive,
  type ConsentCapability,
  type ConsentGrant,
  type ConsentRecipientActorType,
} from "../consent/consentGrant";

export type SharePacketType =
  | "doctor_visit_packet"
  | "recent_reports_packet"
  | "current_medications_packet"
  | "emergency_card_packet"
  | "caregiver_medication_packet"
  | "specific_document_packet"
  | "ai_summary_source_packet";

export type SharePacketResourceKind =
  | "emergency_card"
  | "current_medications"
  | "report"
  | "visit_packet"
  | "medication_adherence";

export interface SharePacketResourceRef {
  readonly resourceId: string;
  readonly resourceKind: SharePacketResourceKind;
}

export interface PatientSharePacket {
  readonly packetId: string;
  readonly consentGrantId: string;
  readonly grantorPatientId: string;
  readonly recipientActorId: string;
  readonly recipientActorType: ConsentRecipientActorType;
  readonly packetType: SharePacketType;
  readonly resourceRefs: readonly SharePacketResourceRef[];
  readonly createdAtEpochMs: number;
  readonly expiresAtEpochMs: number;
  readonly aiProcessingAllowed: boolean;
}

export interface CreatePatientSharePacketInput {
  readonly packetId: string;
  readonly consentGrant: ConsentGrant;
  readonly packetType: SharePacketType;
  readonly resourceRefs: readonly SharePacketResourceRef[];
  readonly createdAtEpochMs: number;
  readonly expiresAtEpochMs: number;
}

const SUPPORTED_PACKET_TYPES: readonly SharePacketType[] = [
  "doctor_visit_packet",
  "recent_reports_packet",
  "current_medications_packet",
  "emergency_card_packet",
  "caregiver_medication_packet",
  "specific_document_packet",
  "ai_summary_source_packet",
];

const SUPPORTED_RESOURCE_KINDS: readonly SharePacketResourceKind[] = [
  "emergency_card",
  "current_medications",
  "report",
  "visit_packet",
  "medication_adherence",
];

const FORBIDDEN_PATIENT_SHARE_PACKET_METADATA_TOKENS = [
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
  "rawkeybytes",
  "raw key",
  "k_root",
  "k_master",
  "k_local_unlock",
  "k_recovery_wrap",
  "local-unlock-v1",
  "sealed-key-envelope",
  "nid",
  "phone",
  "email",
];

function requireNonEmptyText(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
}

function requirePositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
}

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

function isSupportedPacketType(value: SharePacketType): boolean {
  return SUPPORTED_PACKET_TYPES.includes(value);
}

function isSupportedResourceKind(value: SharePacketResourceKind): boolean {
  return SUPPORTED_RESOURCE_KINDS.includes(value);
}

function requiredCapabilityForPacketType(
  packetType: SharePacketType,
): ConsentCapability {
  if (packetType === "doctor_visit_packet") {
    return "view_visit_packet";
  }

  if (packetType === "recent_reports_packet") {
    return "view_recent_reports";
  }

  if (packetType === "current_medications_packet") {
    return "view_current_medications";
  }

  if (packetType === "emergency_card_packet") {
    return "view_emergency_card";
  }

  if (packetType === "specific_document_packet") {
    return "view_recent_reports";
  }

  return "manage_medication_adherence";
}

function packetTypeAllowsResourceKind(
  packetType: SharePacketType,
  resourceKind: SharePacketResourceKind,
): boolean {
  if (packetType === "emergency_card_packet") {
    return resourceKind === "emergency_card";
  }

  if (packetType === "current_medications_packet") {
    return resourceKind === "current_medications";
  }

  if (packetType === "recent_reports_packet") {
    return resourceKind === "report";
  }

  if (packetType === "doctor_visit_packet") {
    return resourceKind === "visit_packet";
  }

  if (packetType === "caregiver_medication_packet") {
    return (
      resourceKind === "current_medications" ||
      resourceKind === "medication_adherence"
    );
  }

  if (packetType === "specific_document_packet") {
    return resourceKind === "report" || resourceKind === "visit_packet";
  }

  if (packetType === "ai_summary_source_packet") {
    return (
      resourceKind === "current_medications" ||
      resourceKind === "report" ||
      resourceKind === "visit_packet"
    );
  }

  return false;
}

function hasSourceViewCapabilityForAiPacket(
  consentGrant: ConsentGrant,
  nowEpochMs: number,
): boolean {
  return (
    canUseConsentCapability(
      consentGrant,
      "view_current_medications",
      nowEpochMs,
    ) ||
    canUseConsentCapability(consentGrant, "view_recent_reports", nowEpochMs) ||
    canUseConsentCapability(consentGrant, "view_visit_packet", nowEpochMs)
  );
}

function grantAllowsSpecificDocumentPacket(
  consentGrant: ConsentGrant,
  nowEpochMs: number,
): boolean {
  return (
    canUseConsentCapability(consentGrant, "view_recent_reports", nowEpochMs) ||
    canUseConsentCapability(consentGrant, "view_visit_packet", nowEpochMs)
  );
}

function grantAllowsCaregiverMedicationPacket(
  consentGrant: ConsentGrant,
  nowEpochMs: number,
): boolean {
  return (
    canUseConsentCapability(
      consentGrant,
      "manage_medication_adherence",
      nowEpochMs,
    ) ||
    canUseConsentCapability(
      consentGrant,
      "view_current_medications",
      nowEpochMs,
    )
  );
}

function validatePacketCapability(
  consentGrant: ConsentGrant,
  packetType: SharePacketType,
  nowEpochMs: number,
): void {
  if (packetType === "ai_summary_source_packet") {
    if (
      !canUseConsentCapability(consentGrant, "request_ai_summary", nowEpochMs)
    ) {
      throw new Error("consent grant does not allow AI summary packet");
    }

    if (!hasSourceViewCapabilityForAiPacket(consentGrant, nowEpochMs)) {
      throw new Error("AI summary packet requires source-view capability");
    }

    return;
  }

  if (packetType === "caregiver_medication_packet") {
    if (!grantAllowsCaregiverMedicationPacket(consentGrant, nowEpochMs)) {
      throw new Error("consent grant does not allow packet capability");
    }

    return;
  }

  if (packetType === "specific_document_packet") {
    if (consentGrant.scope !== "specific_document_set") {
      throw new Error(
        "specific_document_packet requires specific_document_set scope",
      );
    }

    if (!grantAllowsSpecificDocumentPacket(consentGrant, nowEpochMs)) {
      throw new Error("consent grant does not allow packet capability");
    }

    return;
  }

  const requiredCapability = requiredCapabilityForPacketType(packetType);

  if (!canUseConsentCapability(consentGrant, requiredCapability, nowEpochMs)) {
    throw new Error("consent grant does not allow packet capability");
  }
}

function validateResourceRefs(
  packetType: SharePacketType,
  resourceRefs: readonly SharePacketResourceRef[],
): void {
  if (resourceRefs.length === 0) {
    throw new Error("resourceRefs must not be empty");
  }

  const resourceIds = resourceRefs.map((ref) => ref.resourceId);

  for (const ref of resourceRefs) {
    requireNonEmptyText(ref.resourceId, "resourceId");

    if (!isSupportedResourceKind(ref.resourceKind)) {
      throw new Error("unsupported share packet resource kind");
    }

    if (!packetTypeAllowsResourceKind(packetType, ref.resourceKind)) {
      throw new Error("packet type does not allow resource kind");
    }
  }

  if (hasDuplicates(resourceIds)) {
    throw new Error("resourceIds must be unique");
  }
}

function validateSpecificDocumentSubset(
  consentGrant: ConsentGrant,
  packetType: SharePacketType,
  resourceRefs: readonly SharePacketResourceRef[],
): void {
  if (packetType !== "specific_document_packet") {
    return;
  }

  const grantResourceIds = consentGrant.resourceIds ?? [];

  const allPacketRefsAreGranted = resourceRefs.every((ref) =>
    grantResourceIds.includes(ref.resourceId),
  );

  if (!allPacketRefsAreGranted) {
    throw new Error(
      "packet resourceIds must be included in consent grant resourceIds",
    );
  }
}

function freezeResourceRefs(
  resourceRefs: readonly SharePacketResourceRef[],
): readonly SharePacketResourceRef[] {
  return Object.freeze(
    resourceRefs.map((ref) =>
      Object.freeze({
        resourceId: ref.resourceId,
        resourceKind: ref.resourceKind,
      }),
    ),
  );
}

function freezePacket(packet: PatientSharePacket): PatientSharePacket {
  Object.freeze(packet.resourceRefs);
  return Object.freeze(packet);
}

export function assertNoPatientSharePacketMetadataLeak(value: unknown): void {
  const serializedValue = JSON.stringify(value).toLowerCase();

  const hasForbiddenToken =
    FORBIDDEN_PATIENT_SHARE_PACKET_METADATA_TOKENS.some((token) =>
      serializedValue.includes(token),
    );

  if (hasForbiddenToken) {
    throw new Error("forbidden patient share packet metadata");
  }
}

export function createPatientSharePacket(
  input: CreatePatientSharePacketInput,
): PatientSharePacket {
  requireNonEmptyText(input.packetId, "packetId");
  requirePositiveInteger(input.createdAtEpochMs, "createdAtEpochMs");
  requirePositiveInteger(input.expiresAtEpochMs, "expiresAtEpochMs");

  if (input.expiresAtEpochMs <= input.createdAtEpochMs) {
    throw new Error("expiresAtEpochMs must be after createdAtEpochMs");
  }

  if (!isConsentGrantActive(input.consentGrant, input.createdAtEpochMs)) {
    throw new Error("consent grant is not active");
  }

  if (input.expiresAtEpochMs > input.consentGrant.expiresAtEpochMs) {
    throw new Error("packet expiry cannot exceed consent grant expiry");
  }

  if (!isSupportedPacketType(input.packetType)) {
    throw new Error("unsupported share packet type");
  }

  validateResourceRefs(input.packetType, input.resourceRefs);
  validatePacketCapability(
    input.consentGrant,
    input.packetType,
    input.createdAtEpochMs,
  );
  validateSpecificDocumentSubset(
    input.consentGrant,
    input.packetType,
    input.resourceRefs,
  );

  assertNoPatientSharePacketMetadataLeak(input);

  const packet: PatientSharePacket = {
    packetId: input.packetId,
    consentGrantId: input.consentGrant.grantId,
    grantorPatientId: input.consentGrant.grantorPatientId,
    recipientActorId: input.consentGrant.recipientActorId,
    recipientActorType: input.consentGrant.recipientActorType,
    packetType: input.packetType,
    resourceRefs: freezeResourceRefs(input.resourceRefs),
    createdAtEpochMs: input.createdAtEpochMs,
    expiresAtEpochMs: input.expiresAtEpochMs,
    aiProcessingAllowed: input.packetType === "ai_summary_source_packet",
  };

  return freezePacket(packet);
}

export function isPatientSharePacketExpired(
  packet: PatientSharePacket,
  nowEpochMs: number,
): boolean {
  return nowEpochMs >= packet.expiresAtEpochMs;
}

export function isPatientSharePacketActive(
  packet: PatientSharePacket,
  nowEpochMs: number,
): boolean {
  return !isPatientSharePacketExpired(packet, nowEpochMs);
}