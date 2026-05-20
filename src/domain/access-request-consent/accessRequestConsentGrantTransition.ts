import {
  evaluateAccessRequestStatus,
  type AccessRequest,
} from "../access-request/accessRequest";

import {
  createConsentGrant,
  type ConsentGrant,
} from "../consent/consentGrant";

export interface CreateConsentGrantFromApprovedAccessRequestInput {
  readonly grantId: string;
  readonly grantorPatientId: string;
  readonly approvingPatientKorId: string;
  readonly accessRequest: AccessRequest;
  readonly approvedAtEpochMs: number;
  readonly grantExpiresAtEpochMs: number;
}

const FORBIDDEN_ACCESS_REQUEST_CONSENT_TRANSITION_METADATA_TOKENS = [
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

function assertNoTransitionMetadataLeak(value: unknown): void {
  const serializedStringValues = collectStringValues(value)
    .join("\n")
    .toLowerCase();

  const hasForbiddenToken =
    FORBIDDEN_ACCESS_REQUEST_CONSENT_TRANSITION_METADATA_TOKENS.some((token) =>
      serializedStringValues.includes(token),
    );

  if (hasForbiddenToken) {
    throw new Error("forbidden access request consent transition metadata");
  }
}

export function createConsentGrantFromApprovedAccessRequest(
  input: CreateConsentGrantFromApprovedAccessRequestInput,
): ConsentGrant {
  requireNonEmptyText(input.grantId, "grantId");
  requireNonEmptyText(input.grantorPatientId, "grantorPatientId");
  requireNonEmptyText(input.approvingPatientKorId, "approvingPatientKorId");

  requirePositiveInteger(input.approvedAtEpochMs, "approvedAtEpochMs");

  assertNoTransitionMetadataLeak({
    grantId: input.grantId,
    grantorPatientId: input.grantorPatientId,
    approvingPatientKorId: input.approvingPatientKorId,
  });

  if (input.approvingPatientKorId !== input.accessRequest.targetKorId) {
    throw new Error(
      "approvingPatientKorId must match access request targetKorId",
    );
  }

  if (input.approvedAtEpochMs < input.accessRequest.createdAtEpochMs) {
    throw new Error(
      "approvedAtEpochMs cannot be before access request createdAtEpochMs",
    );
  }

  if (
    evaluateAccessRequestStatus(input.accessRequest, input.approvedAtEpochMs) !==
    "pending"
  ) {
    throw new Error("access request is not pending");
  }

  return createConsentGrant({
    grantId: input.grantId,
    grantorPatientId: input.grantorPatientId,
    recipientActorId: input.accessRequest.requesterActorId,
    recipientActorType: input.accessRequest.requesterActorType,
    scope: input.accessRequest.requestedScope,
    capabilities: [...input.accessRequest.requestedCapabilities],
    purpose: input.accessRequest.requestedPurpose,
    issuedAtEpochMs: input.approvedAtEpochMs,
    expiresAtEpochMs: input.grantExpiresAtEpochMs,
  });
}
