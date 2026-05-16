export type KeyPurpose =
  | "payload_encryption"
  | "blind_index"
  | "emergency_card"
  | "caregiver_adherence"
  | "recovery_wrap";

export type KeyVersionStatus = "active" | "retired" | "revoked";

export type KeyExportability = "non_exportable" | "wrapped_only";

export type KeyCreatedFor =
  | "patient_vault"
  | "caregiver_projection"
  | "keyring_recovery";

export interface KeyScopeRecord {
  readonly keyScopeId: string;
  readonly purpose: KeyPurpose;
  readonly version: number;
  readonly status: KeyVersionStatus;
  readonly exportability: KeyExportability;
  readonly createdFor: KeyCreatedFor;
}

export interface CreateKeyScopeRecordInput {
  readonly keyScopeId: string;
  readonly purpose: KeyPurpose;
  readonly version: number;
  readonly status: KeyVersionStatus;
  readonly exportability: KeyExportability;
  readonly createdFor: KeyCreatedFor;
}

export interface KeyringManifest {
  readonly records: readonly KeyScopeRecord[];
}

export interface ResolveKeyForEnvelopeInput {
  readonly keyScopeId: string;
  readonly keyVersion: number;
  readonly requiredPurpose: KeyPurpose;
}

export interface RawMasterKeyExportPolicyInput {
  readonly keyMaterialKind: "K_master" | "K_recovery_wrap" | "domain_key";
  readonly exportMode: "raw" | "wrapped";
}

export interface RecoveryTargetPolicyInput {
  readonly recoveryTarget: "K_master" | "K_recovery_wrap";
}

const SUPPORTED_KEY_PURPOSES: readonly KeyPurpose[] = [
  "payload_encryption",
  "blind_index",
  "emergency_card",
  "caregiver_adherence",
  "recovery_wrap",
];

const SUPPORTED_KEY_STATUSES: readonly KeyVersionStatus[] = [
  "active",
  "retired",
  "revoked",
];

const SUPPORTED_EXPORTABILITY: readonly KeyExportability[] = [
  "non_exportable",
  "wrapped_only",
];

const SUPPORTED_CREATED_FOR: readonly KeyCreatedFor[] = [
  "patient_vault",
  "caregiver_projection",
  "keyring_recovery",
];

const FORBIDDEN_SCOPE_TOKENS = [
  "mental",
  "psychiatric",
  "psych",
  "reproductive",
  "hiv",
  "oncology",
  "cancer",
  "general",
  "medical",
  "clinical",
  "diabetes",
  "cardiac",
  "heart",
  "pregnancy",
  "drug",
  "medicine",
];

function requireNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
}

function assertPositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
}

function assertSupportedKeyPurpose(value: KeyPurpose): void {
  if (!SUPPORTED_KEY_PURPOSES.includes(value)) {
    throw new Error("unsupported key purpose");
  }
}

function assertSupportedStatus(value: KeyVersionStatus): void {
  if (!SUPPORTED_KEY_STATUSES.includes(value)) {
    throw new Error("unsupported key status");
  }
}

function assertSupportedExportability(value: KeyExportability): void {
  if (!SUPPORTED_EXPORTABILITY.includes(value)) {
    throw new Error("unsupported key exportability");
  }
}

function assertSupportedCreatedFor(value: KeyCreatedFor): void {
  if (!SUPPORTED_CREATED_FOR.includes(value)) {
    throw new Error("unsupported key creation target");
  }
}

export function assertOpaqueKeyScopeId(keyScopeId: string): void {
  requireNonEmpty(keyScopeId, "keyScopeId");

  const normalized = keyScopeId.toLowerCase();

  const hasUnsafeSemanticToken = FORBIDDEN_SCOPE_TOKENS.some((token) =>
    normalized.includes(token),
  );

  const hasOpaqueShape = /^(ks|scope)_[a-z0-9]+$/.test(normalized);

  if (!hasOpaqueShape || hasUnsafeSemanticToken) {
    throw new Error("keyScopeId must be opaque");
  }
}

export function createKeyScopeRecord(
  input: CreateKeyScopeRecordInput,
): KeyScopeRecord {
  assertOpaqueKeyScopeId(input.keyScopeId);
  assertSupportedKeyPurpose(input.purpose);
  assertPositiveInteger(input.version, "version");
  assertSupportedStatus(input.status);
  assertSupportedExportability(input.exportability);
  assertSupportedCreatedFor(input.createdFor);

  const record: KeyScopeRecord = {
    keyScopeId: input.keyScopeId,
    purpose: input.purpose,
    version: input.version,
    status: input.status,
    exportability: input.exportability,
    createdFor: input.createdFor,
  };

  return Object.freeze(record);
}

export function assertKeyPurposeAllowed(
  record: KeyScopeRecord,
  requiredPurpose: KeyPurpose,
): void {
  assertSupportedKeyPurpose(record.purpose);
  assertSupportedKeyPurpose(requiredPurpose);

  if (record.purpose !== requiredPurpose) {
    throw new Error("key purpose mismatch");
  }
}

export function assertCaregiverScopeIsLimited(record: KeyScopeRecord): void {
  if (
    record.purpose !== "caregiver_adherence" ||
    record.createdFor !== "caregiver_projection"
  ) {
    throw new Error("caregiver access must use a scoped adherence key");
  }

  if (record.exportability !== "wrapped_only") {
    throw new Error("caregiver access must use a wrapped scoped key");
  }

  if (record.status !== "active") {
    throw new Error("caregiver scoped key must be active");
  }
}

export function selectActiveKeyVersion(
  manifest: KeyringManifest,
  keyScopeId: string,
): KeyScopeRecord {
  assertOpaqueKeyScopeId(keyScopeId);

  const activeRecords = manifest.records.filter((record) => {
    return record.keyScopeId === keyScopeId && record.status === "active";
  });

  if (activeRecords.length === 0) {
    throw new Error("active key version not found");
  }

  if (activeRecords.length > 1) {
    throw new Error("multiple active key versions found");
  }

  return activeRecords[0];
}

export function resolveKeyForEnvelope(
  manifest: KeyringManifest,
  input: ResolveKeyForEnvelopeInput,
): KeyScopeRecord {
  assertOpaqueKeyScopeId(input.keyScopeId);
  assertPositiveInteger(input.keyVersion, "keyVersion");
  assertSupportedKeyPurpose(input.requiredPurpose);

  const matchingRecord = manifest.records.find((record) => {
    return (
      record.keyScopeId === input.keyScopeId &&
      record.version === input.keyVersion
    );
  });

  if (!matchingRecord) {
    throw new Error("key version not found");
  }

  if (matchingRecord.status === "revoked") {
    throw new Error("key version is revoked");
  }

  assertKeyPurposeAllowed(matchingRecord, input.requiredPurpose);

  return matchingRecord;
}

export function assertNoRawMasterKeyExport(
  input: RawMasterKeyExportPolicyInput,
): void {
  if (input.keyMaterialKind === "K_master" && input.exportMode === "raw") {
    throw new Error("raw K_master export is forbidden");
  }
}

export function assertRecoveryTargetsWrapKey(
  input: RecoveryTargetPolicyInput,
): void {
  if (input.recoveryTarget !== "K_recovery_wrap") {
    throw new Error("recovery must target K_recovery_wrap");
  }
}
