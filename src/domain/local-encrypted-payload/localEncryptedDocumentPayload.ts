export type LocalEncryptedDocumentPayloadEncryptionScheme = "aes_256_gcm_v1";

export interface LocalEncryptedDocumentPayload {
  readonly payloadId: string;
  readonly patientId: string;
  readonly ciphertextRef: string;
  readonly encryptionEnvelopeRef: string;
  readonly encryptionScheme: LocalEncryptedDocumentPayloadEncryptionScheme;
  readonly payloadSchemaVersion: number;
  readonly createdAtEpochMs: number;
  readonly updatedAtEpochMs?: number;
  readonly deletedAtEpochMs?: number;
}

export interface CreateLocalEncryptedDocumentPayloadInput {
  readonly payloadId: string;
  readonly patientId: string;
  readonly ciphertextRef: string;
  readonly encryptionEnvelopeRef: string;
  readonly encryptionScheme: LocalEncryptedDocumentPayloadEncryptionScheme;
  readonly payloadSchemaVersion: number;
  readonly createdAtEpochMs: number;
  readonly updatedAtEpochMs?: number;
  readonly deletedAtEpochMs?: number;
}

const SUPPORTED_ENCRYPTION_SCHEMES: readonly LocalEncryptedDocumentPayloadEncryptionScheme[] =
  ["aes_256_gcm_v1"];

const FORBIDDEN_LOCAL_ENCRYPTED_PAYLOAD_METADATA_TOKENS = [
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
  "filename",
  "file name",
  "filepath",
  "file path",
  "storagepath",
  "storage path",
  "storageurl",
  "storage url",
  "url",
  "uri",
  "fileuri",
  "file uri",
  "contenturi",
  "content uri",
  "mime",
  "mimetype",
  "title",
  "plaintext",
  "plaintextbytes",
  "ciphertextbytes",
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

function isSupportedEncryptionScheme(
  value: LocalEncryptedDocumentPayloadEncryptionScheme,
): boolean {
  return SUPPORTED_ENCRYPTION_SCHEMES.includes(value);
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

  return FORBIDDEN_LOCAL_ENCRYPTED_PAYLOAD_METADATA_TOKENS.some((token) => {
    const normalizedToken = normalizeMetadataToken(token);

    return normalizedKey === normalizedToken || keyWords.includes(normalizedToken);
  });
}

export function assertNoLocalEncryptedDocumentPayloadMetadataLeak(
  value: unknown,
): void {
  const serializedStringValues = collectStringValues(value)
    .join("\n")
    .toLowerCase();

  const hasForbiddenStringValue =
    FORBIDDEN_LOCAL_ENCRYPTED_PAYLOAD_METADATA_TOKENS.some((token) =>
      serializedStringValues.includes(token),
    );

  const hasForbiddenObjectKey = collectObjectKeys(value).some((key) =>
    keyContainsForbiddenMetadataToken(key),
  );

  if (hasForbiddenStringValue || hasForbiddenObjectKey) {
    throw new Error("forbidden local encrypted payload metadata");
  }
}

function freezePayload(
  payload: LocalEncryptedDocumentPayload,
): LocalEncryptedDocumentPayload {
  return Object.freeze(payload);
}

export function createLocalEncryptedDocumentPayload(
  input: CreateLocalEncryptedDocumentPayloadInput,
): LocalEncryptedDocumentPayload {
  requireNonEmptyText(input.payloadId, "payloadId");
  requireNonEmptyText(input.patientId, "patientId");
  requireNonEmptyText(input.ciphertextRef, "ciphertextRef");
  requireNonEmptyText(input.encryptionEnvelopeRef, "encryptionEnvelopeRef");

  if (!isSupportedEncryptionScheme(input.encryptionScheme)) {
    throw new Error("unsupported local encrypted payload encryption scheme");
  }

  requirePositiveInteger(input.payloadSchemaVersion, "payloadSchemaVersion");
  requirePositiveInteger(input.createdAtEpochMs, "createdAtEpochMs");

  if (input.updatedAtEpochMs !== undefined) {
    requirePositiveInteger(input.updatedAtEpochMs, "updatedAtEpochMs");

    if (input.updatedAtEpochMs < input.createdAtEpochMs) {
      throw new Error("updatedAtEpochMs cannot be before createdAtEpochMs");
    }
  }

  if (input.deletedAtEpochMs !== undefined) {
    requirePositiveInteger(input.deletedAtEpochMs, "deletedAtEpochMs");

    if (input.deletedAtEpochMs < input.createdAtEpochMs) {
      throw new Error("deletedAtEpochMs cannot be before createdAtEpochMs");
    }
  }

  assertNoLocalEncryptedDocumentPayloadMetadataLeak(input);

  const payload: LocalEncryptedDocumentPayload = {
    payloadId: input.payloadId,
    patientId: input.patientId,
    ciphertextRef: input.ciphertextRef,
    encryptionEnvelopeRef: input.encryptionEnvelopeRef,
    encryptionScheme: input.encryptionScheme,
    payloadSchemaVersion: input.payloadSchemaVersion,
    createdAtEpochMs: input.createdAtEpochMs,
    ...(input.updatedAtEpochMs === undefined
      ? {}
      : { updatedAtEpochMs: input.updatedAtEpochMs }),
    ...(input.deletedAtEpochMs === undefined
      ? {}
      : { deletedAtEpochMs: input.deletedAtEpochMs }),
  };

  return freezePayload(payload);
}

export function isLocalEncryptedDocumentPayloadDeleted(
  payload: LocalEncryptedDocumentPayload,
): boolean {
  return payload.deletedAtEpochMs !== undefined;
}

export function isLocalEncryptedDocumentPayloadActive(
  payload: LocalEncryptedDocumentPayload,
): boolean {
  return !isLocalEncryptedDocumentPayloadDeleted(payload);
}

export function markLocalEncryptedDocumentPayloadDeleted(
  payload: LocalEncryptedDocumentPayload,
  deletedAtEpochMs: number,
): LocalEncryptedDocumentPayload {
  if (isLocalEncryptedDocumentPayloadDeleted(payload)) {
    return payload;
  }

  requirePositiveInteger(deletedAtEpochMs, "deletedAtEpochMs");

  if (deletedAtEpochMs < payload.createdAtEpochMs) {
    throw new Error("deletedAtEpochMs cannot be before createdAtEpochMs");
  }

  return freezePayload({
    ...payload,
    deletedAtEpochMs,
  });
}

