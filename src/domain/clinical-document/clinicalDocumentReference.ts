export type ClinicalDocumentResourceKind =
  | "encrypted_report"
  | "encrypted_visit_packet"
  | "encrypted_medication_snapshot"
  | "encrypted_emergency_card";

export interface ClinicalDocumentReference {
  readonly referenceId: string;
  readonly patientId: string;
  readonly resourceId: string;
  readonly resourceKind: ClinicalDocumentResourceKind;
  readonly encryptedPayloadRef: string;
  readonly documentSchemaVersion: number;
  readonly createdAtEpochMs: number;
  readonly updatedAtEpochMs?: number;
  readonly revokedAtEpochMs?: number;
}

export interface CreateClinicalDocumentReferenceInput {
  readonly referenceId: string;
  readonly patientId: string;
  readonly resourceId: string;
  readonly resourceKind: ClinicalDocumentResourceKind;
  readonly encryptedPayloadRef: string;
  readonly documentSchemaVersion: number;
  readonly createdAtEpochMs: number;
  readonly updatedAtEpochMs?: number;
  readonly revokedAtEpochMs?: number;
}

const SUPPORTED_RESOURCE_KINDS: readonly ClinicalDocumentResourceKind[] = [
  "encrypted_report",
  "encrypted_visit_packet",
  "encrypted_medication_snapshot",
  "encrypted_emergency_card",
];

const FORBIDDEN_CLINICAL_DOCUMENT_REFERENCE_METADATA_TOKENS = [
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

function isSupportedResourceKind(
  value: ClinicalDocumentResourceKind,
): boolean {
  return SUPPORTED_RESOURCE_KINDS.includes(value);
}

export function assertNoClinicalDocumentReferenceMetadataLeak(
  value: unknown,
): void {
  const serializedValue = JSON.stringify(value).toLowerCase();

  const hasForbiddenToken =
    FORBIDDEN_CLINICAL_DOCUMENT_REFERENCE_METADATA_TOKENS.some((token) =>
      serializedValue.includes(token),
    );

  if (hasForbiddenToken) {
    throw new Error("forbidden clinical document reference metadata");
  }
}

export function createClinicalDocumentReference(
  input: CreateClinicalDocumentReferenceInput,
): ClinicalDocumentReference {
  requireNonEmptyText(input.referenceId, "referenceId");
  requireNonEmptyText(input.patientId, "patientId");
  requireNonEmptyText(input.resourceId, "resourceId");
  requireNonEmptyText(input.encryptedPayloadRef, "encryptedPayloadRef");

  if (!isSupportedResourceKind(input.resourceKind)) {
    throw new Error("unsupported clinical document resource kind");
  }

  requirePositiveInteger(
    input.documentSchemaVersion,
    "documentSchemaVersion",
  );
  requirePositiveInteger(input.createdAtEpochMs, "createdAtEpochMs");

  if (input.updatedAtEpochMs !== undefined) {
    requirePositiveInteger(input.updatedAtEpochMs, "updatedAtEpochMs");

    if (input.updatedAtEpochMs < input.createdAtEpochMs) {
      throw new Error("updatedAtEpochMs cannot be before createdAtEpochMs");
    }
  }

  if (input.revokedAtEpochMs !== undefined) {
    requirePositiveInteger(input.revokedAtEpochMs, "revokedAtEpochMs");

    if (input.revokedAtEpochMs < input.createdAtEpochMs) {
      throw new Error("revokedAtEpochMs cannot be before createdAtEpochMs");
    }
  }

  assertNoClinicalDocumentReferenceMetadataLeak(input);

  const reference: ClinicalDocumentReference = {
    referenceId: input.referenceId,
    patientId: input.patientId,
    resourceId: input.resourceId,
    resourceKind: input.resourceKind,
    encryptedPayloadRef: input.encryptedPayloadRef,
    documentSchemaVersion: input.documentSchemaVersion,
    createdAtEpochMs: input.createdAtEpochMs,
    ...(input.updatedAtEpochMs === undefined
      ? {}
      : { updatedAtEpochMs: input.updatedAtEpochMs }),
    ...(input.revokedAtEpochMs === undefined
      ? {}
      : { revokedAtEpochMs: input.revokedAtEpochMs }),
  };

  return Object.freeze(reference);
}

export function isClinicalDocumentReferenceRevoked(
  reference: ClinicalDocumentReference,
): boolean {
  return reference.revokedAtEpochMs !== undefined;
}

export function isClinicalDocumentReferenceActive(
  reference: ClinicalDocumentReference,
): boolean {
  return !isClinicalDocumentReferenceRevoked(reference);
}

export function canReferenceBeShared(
  reference: ClinicalDocumentReference,
): boolean {
  return isClinicalDocumentReferenceActive(reference);
}

export function revokeClinicalDocumentReference(
  reference: ClinicalDocumentReference,
  revokedAtEpochMs: number,
): ClinicalDocumentReference {
  if (isClinicalDocumentReferenceRevoked(reference)) {
    return reference;
  }

  requirePositiveInteger(revokedAtEpochMs, "revokedAtEpochMs");

  if (revokedAtEpochMs < reference.createdAtEpochMs) {
    throw new Error("revokedAtEpochMs cannot be before createdAtEpochMs");
  }

  return Object.freeze({
    ...reference,
    revokedAtEpochMs,
  });
}