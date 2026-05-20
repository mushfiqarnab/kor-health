export type AccessRequestRequesterActorType =
  | "verified_doctor"
  | "caregiver"
  | "emergency_viewer";

export type AccessRequestCapability =
  | "view_emergency_card"
  | "view_current_medications"
  | "view_recent_reports"
  | "view_visit_packet"
  | "upload_report"
  | "manage_medication_adherence"
  | "request_ai_summary";

export type AccessRequestScope =
  | "emergency_card"
  | "current_medications"
  | "recent_reports"
  | "visit_packet"
  | "medication_adherence";

export type AccessRequestPurpose =
  | "clinical_treatment"
  | "second_opinion"
  | "caregiver_support"
  | "emergency_care"
  | "patient_requested_ai_summary";

export type AccessRequestStatus = "pending" | "withdrawn" | "expired";

export interface AccessRequest {
  readonly accessRequestId: string;
  readonly requesterActorId: string;
  readonly requesterActorType: AccessRequestRequesterActorType;
  readonly targetKorId: string;
  readonly requestedScope: AccessRequestScope;
  readonly requestedCapabilities: readonly AccessRequestCapability[];
  readonly requestedPurpose: AccessRequestPurpose;
  readonly createdAtEpochMs: number;
  readonly expiresAtEpochMs: number;
  readonly withdrawnAtEpochMs?: number;
}

export interface CreateAccessRequestInput {
  readonly accessRequestId: string;
  readonly requesterActorId: string;
  readonly requesterActorType: AccessRequestRequesterActorType;
  readonly targetKorId: string;
  readonly requestedScope: AccessRequestScope;
  readonly requestedCapabilities: readonly AccessRequestCapability[];
  readonly requestedPurpose: AccessRequestPurpose;
  readonly createdAtEpochMs: number;
  readonly expiresAtEpochMs: number;
}

const SUPPORTED_REQUESTER_ACTOR_TYPES: readonly AccessRequestRequesterActorType[] =
  ["verified_doctor", "caregiver", "emergency_viewer"];

const SUPPORTED_CAPABILITIES: readonly AccessRequestCapability[] = [
  "view_emergency_card",
  "view_current_medications",
  "view_recent_reports",
  "view_visit_packet",
  "upload_report",
  "manage_medication_adherence",
  "request_ai_summary",
];

const SUPPORTED_SCOPES: readonly AccessRequestScope[] = [
  "emergency_card",
  "current_medications",
  "recent_reports",
  "visit_packet",
  "medication_adherence",
];

const SUPPORTED_PURPOSES: readonly AccessRequestPurpose[] = [
  "clinical_treatment",
  "second_opinion",
  "caregiver_support",
  "emergency_care",
  "patient_requested_ai_summary",
];

const FORBIDDEN_ACCESS_REQUEST_METADATA_TOKENS = [
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
  "resourceids",
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

function isSupportedRequesterActorType(
  value: AccessRequestRequesterActorType,
): boolean {
  return SUPPORTED_REQUESTER_ACTOR_TYPES.includes(value);
}

function isSupportedCapability(value: AccessRequestCapability): boolean {
  return SUPPORTED_CAPABILITIES.includes(value);
}

function isSupportedScope(value: AccessRequestScope): boolean {
  return SUPPORTED_SCOPES.includes(value);
}

function isSupportedPurpose(value: AccessRequestPurpose): boolean {
  return SUPPORTED_PURPOSES.includes(value);
}

function actorCanRequestCapability(
  actorType: AccessRequestRequesterActorType,
  capability: AccessRequestCapability,
): boolean {
  if (actorType === "verified_doctor") {
    return (
      capability === "view_current_medications" ||
      capability === "view_recent_reports" ||
      capability === "view_visit_packet" ||
      capability === "request_ai_summary"
    );
  }

  if (actorType === "caregiver") {
    return (
      capability === "view_current_medications" ||
      capability === "upload_report" ||
      capability === "manage_medication_adherence"
    );
  }

  if (actorType === "emergency_viewer") {
    return capability === "view_emergency_card";
  }

  return false;
}

function scopeAllowsCapability(
  scope: AccessRequestScope,
  capability: AccessRequestCapability,
): boolean {
  if (scope === "emergency_card") {
    return capability === "view_emergency_card";
  }

  if (scope === "current_medications") {
    return (
      capability === "view_current_medications" ||
      capability === "request_ai_summary"
    );
  }

  if (scope === "recent_reports") {
    return (
      capability === "view_recent_reports" ||
      capability === "request_ai_summary"
    );
  }

  if (scope === "visit_packet") {
    return (
      capability === "view_visit_packet" ||
      capability === "view_current_medications" ||
      capability === "view_recent_reports" ||
      capability === "request_ai_summary"
    );
  }

  if (scope === "medication_adherence") {
    return (
      capability === "view_current_medications" ||
      capability === "upload_report" ||
      capability === "manage_medication_adherence"
    );
  }

  return false;
}

function validateRequestedCapabilities(
  capabilities: readonly AccessRequestCapability[],
): void {
  if (capabilities.length === 0) {
    throw new Error("requestedCapabilities must not be empty");
  }

  for (const capability of capabilities) {
    if (!isSupportedCapability(capability)) {
      throw new Error("unsupported access request capability");
    }
  }

  if (hasDuplicates(capabilities)) {
    throw new Error("requestedCapabilities must be unique");
  }
}

function validateActorCapabilityCompatibility(
  actorType: AccessRequestRequesterActorType,
  capabilities: readonly AccessRequestCapability[],
): void {
  for (const capability of capabilities) {
    if (!actorCanRequestCapability(actorType, capability)) {
      throw new Error("requester actor type cannot request capability");
    }
  }
}

function validateScopeCapabilityCompatibility(
  scope: AccessRequestScope,
  capabilities: readonly AccessRequestCapability[],
): void {
  for (const capability of capabilities) {
    if (!scopeAllowsCapability(scope, capability)) {
      throw new Error("requested scope does not allow capability");
    }
  }
}

function hasSourceViewCapabilityForAiRequest(
  capabilities: readonly AccessRequestCapability[],
): boolean {
  return (
    capabilities.includes("view_current_medications") ||
    capabilities.includes("view_recent_reports") ||
    capabilities.includes("view_visit_packet")
  );
}

function validateEmergencyRequestRules(input: CreateAccessRequestInput): void {
  if (input.requesterActorType === "emergency_viewer") {
    if (input.requestedScope !== "emergency_card") {
      throw new Error("emergency_viewer may only request emergency_card scope");
    }
  }

  if (input.requestedScope === "emergency_card") {
    const onlyEmergencyCard =
      input.requestedCapabilities.length === 1 &&
      input.requestedCapabilities[0] === "view_emergency_card";

    if (!onlyEmergencyCard) {
      throw new Error("emergency_card requests only allow view_emergency_card");
    }
  }
}

function validateAiRequestRules(input: CreateAccessRequestInput): void {
  if (!input.requestedCapabilities.includes("request_ai_summary")) {
    return;
  }

  if (!hasSourceViewCapabilityForAiRequest(input.requestedCapabilities)) {
    throw new Error("AI summary requests require source-view capability");
  }
}

function freezeRequest(request: AccessRequest): AccessRequest {
  Object.freeze(request.requestedCapabilities);
  return Object.freeze(request);
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

function collectObjectKeys(
  value: unknown,
  collectedKeys: string[] = [],
): readonly string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectObjectKeys(item, collectedKeys);
    }

    return collectedKeys;
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of Object.keys(record)) {
      collectedKeys.push(key);
      collectObjectKeys(record[key], collectedKeys);
    }
  }

  return collectedKeys;
}

function normalizeMetadataToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function splitMetadataKeyIntoWords(key: string): readonly string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}

function keyContainsForbiddenMetadataToken(key: string): boolean {
  const normalizedKey = normalizeMetadataToken(key);
  const keyWords = splitMetadataKeyIntoWords(key);

  return FORBIDDEN_ACCESS_REQUEST_METADATA_TOKENS.some((token) => {
    const normalizedToken = normalizeMetadataToken(token);

    return normalizedKey === normalizedToken || keyWords.includes(normalizedToken);
  });
}

export function assertNoAccessRequestMetadataLeak(value: unknown): void {
  const serializedStringValues = collectStringValues(value)
    .join("\n")
    .toLowerCase();

  const hasForbiddenStringValue =
    FORBIDDEN_ACCESS_REQUEST_METADATA_TOKENS.some((token) =>
      serializedStringValues.includes(token),
    );

  const hasForbiddenObjectKey = collectObjectKeys(value).some((key) =>
    keyContainsForbiddenMetadataToken(key),
  );

  if (hasForbiddenStringValue || hasForbiddenObjectKey) {
    throw new Error("forbidden access request metadata");
  }
}

export function createAccessRequest(
  input: CreateAccessRequestInput,
): AccessRequest {
  requireNonEmptyText(input.accessRequestId, "accessRequestId");
  requireNonEmptyText(input.requesterActorId, "requesterActorId");
  requireNonEmptyText(input.targetKorId, "targetKorId");

  requirePositiveInteger(input.createdAtEpochMs, "createdAtEpochMs");
  requirePositiveInteger(input.expiresAtEpochMs, "expiresAtEpochMs");

  if (input.expiresAtEpochMs <= input.createdAtEpochMs) {
    throw new Error("expiresAtEpochMs must be after createdAtEpochMs");
  }

  validateRequestedCapabilities(input.requestedCapabilities);

  if (!isSupportedRequesterActorType(input.requesterActorType)) {
    throw new Error("unsupported access request actor type");
  }

  if (!isSupportedScope(input.requestedScope)) {
    throw new Error("unsupported access request scope");
  }

  if (!isSupportedPurpose(input.requestedPurpose)) {
    throw new Error("unsupported access request purpose");
  }

  validateEmergencyRequestRules(input);
  validateActorCapabilityCompatibility(
    input.requesterActorType,
    input.requestedCapabilities,
  );
  validateScopeCapabilityCompatibility(
    input.requestedScope,
    input.requestedCapabilities,
  );
  validateAiRequestRules(input);

  assertNoAccessRequestMetadataLeak(input);

  const request: AccessRequest = {
    accessRequestId: input.accessRequestId,
    requesterActorId: input.requesterActorId,
    requesterActorType: input.requesterActorType,
    targetKorId: input.targetKorId,
    requestedScope: input.requestedScope,
    requestedCapabilities: [...input.requestedCapabilities],
    requestedPurpose: input.requestedPurpose,
    createdAtEpochMs: input.createdAtEpochMs,
    expiresAtEpochMs: input.expiresAtEpochMs,
  };

  return freezeRequest(request);
}

export function isAccessRequestExpired(
  request: AccessRequest,
  nowEpochMs: number,
): boolean {
  return nowEpochMs >= request.expiresAtEpochMs;
}

export function isAccessRequestWithdrawn(request: AccessRequest): boolean {
  return request.withdrawnAtEpochMs !== undefined;
}

export function evaluateAccessRequestStatus(
  request: AccessRequest,
  nowEpochMs: number,
): AccessRequestStatus {
  if (isAccessRequestWithdrawn(request)) {
    return "withdrawn";
  }

  if (isAccessRequestExpired(request, nowEpochMs)) {
    return "expired";
  }

  return "pending";
}

export function isAccessRequestPending(
  request: AccessRequest,
  nowEpochMs: number,
): boolean {
  return evaluateAccessRequestStatus(request, nowEpochMs) === "pending";
}

export function withdrawAccessRequest(
  request: AccessRequest,
  withdrawnAtEpochMs: number,
): AccessRequest {
  if (isAccessRequestWithdrawn(request)) {
    return request;
  }

  requirePositiveInteger(withdrawnAtEpochMs, "withdrawnAtEpochMs");

  if (withdrawnAtEpochMs < request.createdAtEpochMs) {
    throw new Error("withdrawnAtEpochMs cannot be before createdAtEpochMs");
  }

  const withdrawnRequest: AccessRequest = {
    ...request,
    requestedCapabilities: [...request.requestedCapabilities],
    withdrawnAtEpochMs,
  };

  return freezeRequest(withdrawnRequest);
}


