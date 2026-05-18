export type ConsentRecipientActorType =
  | "verified_doctor"
  | "caregiver"
  | "emergency_viewer";

export type ConsentCapability =
  | "view_emergency_card"
  | "view_current_medications"
  | "view_recent_reports"
  | "view_visit_packet"
  | "upload_report"
  | "manage_medication_adherence"
  | "request_ai_summary";

export type ConsentScope =
  | "emergency_card"
  | "current_medications"
  | "recent_reports"
  | "visit_packet"
  | "medication_adherence"
  | "specific_document_set";

export type ConsentPurpose =
  | "clinical_treatment"
  | "second_opinion"
  | "caregiver_support"
  | "emergency_care"
  | "patient_requested_ai_summary";

export interface ConsentGrant {
  readonly grantId: string;
  readonly grantorPatientId: string;
  readonly recipientActorId: string;
  readonly recipientActorType: ConsentRecipientActorType;
  readonly scope: ConsentScope;
  readonly resourceIds?: readonly string[];
  readonly capabilities: readonly ConsentCapability[];
  readonly purpose: ConsentPurpose;
  readonly issuedAtEpochMs: number;
  readonly expiresAtEpochMs: number;
  readonly revokedAtEpochMs?: number;
}

export interface CreateConsentGrantInput {
  readonly grantId: string;
  readonly grantorPatientId: string;
  readonly recipientActorId: string;
  readonly recipientActorType: ConsentRecipientActorType;
  readonly scope: ConsentScope;
  readonly resourceIds?: readonly string[];
  readonly capabilities: readonly ConsentCapability[];
  readonly purpose: ConsentPurpose;
  readonly issuedAtEpochMs: number;
  readonly expiresAtEpochMs: number;
  readonly revokedAtEpochMs?: number;
}

export type ConsentCapabilityDenialReason =
  | "expired"
  | "revoked"
  | "capability_not_granted"
  | "scope_does_not_allow_capability"
  | "recipient_type_not_allowed";

export type ConsentCapabilityEvaluation =
  | {
      readonly allowed: true;
    }
  | {
      readonly allowed: false;
      readonly reason: ConsentCapabilityDenialReason;
    };

const SUPPORTED_RECIPIENT_ACTOR_TYPES: readonly ConsentRecipientActorType[] = [
  "verified_doctor",
  "caregiver",
  "emergency_viewer",
];

const SUPPORTED_CAPABILITIES: readonly ConsentCapability[] = [
  "view_emergency_card",
  "view_current_medications",
  "view_recent_reports",
  "view_visit_packet",
  "upload_report",
  "manage_medication_adherence",
  "request_ai_summary",
];

const SUPPORTED_SCOPES: readonly ConsentScope[] = [
  "emergency_card",
  "current_medications",
  "recent_reports",
  "visit_packet",
  "medication_adherence",
  "specific_document_set",
];

const SUPPORTED_PURPOSES: readonly ConsentPurpose[] = [
  "clinical_treatment",
  "second_opinion",
  "caregiver_support",
  "emergency_care",
  "patient_requested_ai_summary",
];

const FORBIDDEN_CONSENT_METADATA_TOKENS = [
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

function isSupportedRecipientActorType(
  value: ConsentRecipientActorType,
): boolean {
  return SUPPORTED_RECIPIENT_ACTOR_TYPES.includes(value);
}

function isSupportedCapability(value: ConsentCapability): boolean {
  return SUPPORTED_CAPABILITIES.includes(value);
}

function isSupportedScope(value: ConsentScope): boolean {
  return SUPPORTED_SCOPES.includes(value);
}

function isSupportedPurpose(value: ConsentPurpose): boolean {
  return SUPPORTED_PURPOSES.includes(value);
}

function actorCanUseCapability(
  actorType: ConsentRecipientActorType,
  capability: ConsentCapability,
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
  scope: ConsentScope,
  capability: ConsentCapability,
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

  if (scope === "specific_document_set") {
    return (
      capability === "view_recent_reports" ||
      capability === "view_visit_packet" ||
      capability === "request_ai_summary"
    );
  }

  return false;
}

function validateCapabilities(
  capabilities: readonly ConsentCapability[],
): void {
  if (capabilities.length === 0) {
    throw new Error("capabilities must not be empty");
  }

  for (const capability of capabilities) {
    if (!isSupportedCapability(capability)) {
      throw new Error("unsupported consent capability");
    }
  }

  if (hasDuplicates(capabilities)) {
    throw new Error("capabilities must be unique");
  }
}

function validateResourceIds(
  scope: ConsentScope,
  resourceIds: readonly string[] | undefined,
): void {
  if (scope === "specific_document_set") {
    if (resourceIds === undefined || resourceIds.length === 0) {
      throw new Error("specific_document_set requires resourceIds");
    }
  }

  if (scope !== "specific_document_set" && resourceIds !== undefined) {
    throw new Error("resourceIds are allowed only for specific_document_set");
  }

  if (resourceIds === undefined) {
    return;
  }

  for (const resourceId of resourceIds) {
    if (resourceId.trim().length === 0) {
      throw new Error("resourceIds must not contain empty values");
    }
  }

  if (hasDuplicates(resourceIds)) {
    throw new Error("resourceIds must be unique");
  }
}

function validateEmergencyRules(input: CreateConsentGrantInput): void {
  if (input.recipientActorType === "emergency_viewer") {
    if (input.scope !== "emergency_card") {
      throw new Error("emergency_viewer may only use emergency_card scope");
    }
  }

  if (input.scope === "emergency_card") {
    const onlyEmergencyCard =
      input.capabilities.length === 1 &&
      input.capabilities[0] === "view_emergency_card";

    if (!onlyEmergencyCard) {
      throw new Error("emergency_card scope only allows view_emergency_card");
    }
  }
}

function validateActorCapabilityCompatibility(
  actorType: ConsentRecipientActorType,
  capabilities: readonly ConsentCapability[],
): void {
  for (const capability of capabilities) {
    if (!actorCanUseCapability(actorType, capability)) {
      throw new Error("recipient actor type cannot use capability");
    }
  }
}

function validateScopeCapabilityCompatibility(
  scope: ConsentScope,
  capabilities: readonly ConsentCapability[],
): void {
  for (const capability of capabilities) {
    if (!scopeAllowsCapability(scope, capability)) {
      throw new Error("scope does not allow capability");
    }
  }
}

function freezeGrant(grant: ConsentGrant): ConsentGrant {
  if (grant.resourceIds !== undefined) {
    Object.freeze(grant.resourceIds);
  }

  Object.freeze(grant.capabilities);

  return Object.freeze(grant);
}

export function assertNoConsentGrantMetadataLeak(value: unknown): void {
  const serializedValue = JSON.stringify(value).toLowerCase();

  const hasForbiddenToken = FORBIDDEN_CONSENT_METADATA_TOKENS.some((token) =>
    serializedValue.includes(token),
  );

  if (hasForbiddenToken) {
    throw new Error("forbidden consent grant metadata");
  }
}

export function createConsentGrant(
  input: CreateConsentGrantInput,
): ConsentGrant {
  requireNonEmptyText(input.grantId, "grantId");
  requireNonEmptyText(input.grantorPatientId, "grantorPatientId");
  requireNonEmptyText(input.recipientActorId, "recipientActorId");

  requirePositiveInteger(input.issuedAtEpochMs, "issuedAtEpochMs");
  requirePositiveInteger(input.expiresAtEpochMs, "expiresAtEpochMs");

  if (input.expiresAtEpochMs <= input.issuedAtEpochMs) {
    throw new Error("expiresAtEpochMs must be after issuedAtEpochMs");
  }

  validateCapabilities(input.capabilities);

  if (!isSupportedRecipientActorType(input.recipientActorType)) {
    throw new Error("unsupported recipient actor type");
  }

  if (!isSupportedScope(input.scope)) {
    throw new Error("unsupported consent scope");
  }

  if (!isSupportedPurpose(input.purpose)) {
    throw new Error("unsupported consent purpose");
  }

  validateResourceIds(input.scope, input.resourceIds);
  validateEmergencyRules(input);
  validateActorCapabilityCompatibility(
    input.recipientActorType,
    input.capabilities,
  );
  validateScopeCapabilityCompatibility(input.scope, input.capabilities);

  assertNoConsentGrantMetadataLeak(input);

  const grant: ConsentGrant =
    input.resourceIds === undefined
      ? {
          grantId: input.grantId,
          grantorPatientId: input.grantorPatientId,
          recipientActorId: input.recipientActorId,
          recipientActorType: input.recipientActorType,
          scope: input.scope,
          capabilities: [...input.capabilities],
          purpose: input.purpose,
          issuedAtEpochMs: input.issuedAtEpochMs,
          expiresAtEpochMs: input.expiresAtEpochMs,
          ...(input.revokedAtEpochMs === undefined
            ? {}
            : { revokedAtEpochMs: input.revokedAtEpochMs }),
        }
      : {
          grantId: input.grantId,
          grantorPatientId: input.grantorPatientId,
          recipientActorId: input.recipientActorId,
          recipientActorType: input.recipientActorType,
          scope: input.scope,
          resourceIds: [...input.resourceIds],
          capabilities: [...input.capabilities],
          purpose: input.purpose,
          issuedAtEpochMs: input.issuedAtEpochMs,
          expiresAtEpochMs: input.expiresAtEpochMs,
          ...(input.revokedAtEpochMs === undefined
            ? {}
            : { revokedAtEpochMs: input.revokedAtEpochMs }),
        };

  return freezeGrant(grant);
}

export function revokeConsentGrant(
  grant: ConsentGrant,
  revokedAtEpochMs: number,
): ConsentGrant {
  if (isConsentGrantRevoked(grant)) {
    return grant;
  }

  requirePositiveInteger(revokedAtEpochMs, "revokedAtEpochMs");

  if (revokedAtEpochMs < grant.issuedAtEpochMs) {
    throw new Error("revokedAtEpochMs cannot be before issuedAtEpochMs");
  }

  const revokedGrant: ConsentGrant =
    grant.resourceIds === undefined
      ? {
          ...grant,
          capabilities: [...grant.capabilities],
          revokedAtEpochMs,
        }
      : {
          ...grant,
          resourceIds: [...grant.resourceIds],
          capabilities: [...grant.capabilities],
          revokedAtEpochMs,
        };

  return freezeGrant(revokedGrant);
}

export function isConsentGrantExpired(
  grant: ConsentGrant,
  nowEpochMs: number,
): boolean {
  return nowEpochMs >= grant.expiresAtEpochMs;
}

export function isConsentGrantRevoked(grant: ConsentGrant): boolean {
  return grant.revokedAtEpochMs !== undefined;
}

export function isConsentGrantActive(
  grant: ConsentGrant,
  nowEpochMs: number,
): boolean {
  return (
    !isConsentGrantRevoked(grant) &&
    !isConsentGrantExpired(grant, nowEpochMs)
  );
}

export function evaluateConsentCapability(
  grant: ConsentGrant,
  capability: ConsentCapability,
  nowEpochMs: number,
): ConsentCapabilityEvaluation {
  if (isConsentGrantRevoked(grant)) {
    return {
      allowed: false,
      reason: "revoked",
    };
  }

  if (isConsentGrantExpired(grant, nowEpochMs)) {
    return {
      allowed: false,
      reason: "expired",
    };
  }

  if (!grant.capabilities.includes(capability)) {
    return {
      allowed: false,
      reason: "capability_not_granted",
    };
  }

  if (!scopeAllowsCapability(grant.scope, capability)) {
    return {
      allowed: false,
      reason: "scope_does_not_allow_capability",
    };
  }

  if (!actorCanUseCapability(grant.recipientActorType, capability)) {
    return {
      allowed: false,
      reason: "recipient_type_not_allowed",
    };
  }

  return {
    allowed: true,
  };
}

export function canUseConsentCapability(
  grant: ConsentGrant,
  capability: ConsentCapability,
  nowEpochMs: number,
): boolean {
  return evaluateConsentCapability(grant, capability, nowEpochMs).allowed;
}

export function canRequestAiSummary(
  grant: ConsentGrant,
  nowEpochMs: number,
): boolean {
  return canUseConsentCapability(grant, "request_ai_summary", nowEpochMs);
}