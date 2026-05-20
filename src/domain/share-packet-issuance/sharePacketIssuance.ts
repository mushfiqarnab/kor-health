import {
  createPatientSharePacket,
  type PatientSharePacket,
  type SharePacketResourceRef,
  type SharePacketType,
} from "../share-packet/patientSharePacket";

import type { ConsentGrant } from "../consent/consentGrant";

export interface IssuePatientSharePacketFromConsentGrantInput {
  readonly packetId: string;
  readonly consentGrant: ConsentGrant;
  readonly packetType: SharePacketType;
  readonly resourceRefs: readonly SharePacketResourceRef[];
  readonly issuedAtEpochMs: number;
  readonly expiresAtEpochMs: number;
}

const FORBIDDEN_SHARE_PACKET_ISSUANCE_METADATA_TOKENS = [
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

function collectStringValues(
  value: unknown,
  collectedValues: string[] = [],
): readonly string[] {
  if (typeof value === "string") {
    collectedValues.push(value);
    return collectedValues;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringValues(item, collectedValues);
    }

    return collectedValues;
  }

  if (value !== null && typeof value === "object") {
    for (const nestedValue of Object.values(value as Record<string, unknown>)) {
      collectStringValues(nestedValue, collectedValues);
    }
  }

  return collectedValues;
}

function assertNoSharePacketIssuanceMetadataLeak(value: unknown): void {
  const serializedStringValues = collectStringValues(value)
    .join("\n")
    .toLowerCase();

  const hasForbiddenToken =
    FORBIDDEN_SHARE_PACKET_ISSUANCE_METADATA_TOKENS.some((token) =>
      serializedStringValues.includes(token),
    );

  if (hasForbiddenToken) {
    throw new Error("forbidden share packet issuance metadata");
  }
}

export function issuePatientSharePacketFromConsentGrant(
  input: IssuePatientSharePacketFromConsentGrantInput,
): PatientSharePacket {
  assertNoSharePacketIssuanceMetadataLeak({
    packetId: input.packetId,
  });

  return createPatientSharePacket({
    packetId: input.packetId,
    consentGrant: input.consentGrant,
    packetType: input.packetType,
    resourceRefs: input.resourceRefs,
    createdAtEpochMs: input.issuedAtEpochMs,
    expiresAtEpochMs: input.expiresAtEpochMs,
  });
}
