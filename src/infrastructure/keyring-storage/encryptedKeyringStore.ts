import {
  decryptFromEnvelope,
  encryptToEnvelope,
  type AadV1,
  type EncryptionKey,
  type SealedEnvelopeV1,
} from "../crypto/aesGcmEnvelopeAdapter";

import {
  createKeyScopeRecord,
  type KeyCreatedFor,
  type KeyExportability,
  type KeyPurpose,
  type KeyVersionStatus,
} from "../../application/key-management/keyringPolicy";

export type KeyringWrappingKey = EncryptionKey;

export type KeyringRecordPurpose = KeyPurpose | "root_key";

export type KeyringMaterialKind = "sealed_root_key" | "root_derived_ref";

export interface KeyringEntryV1 {
  readonly keyScopeId: string;
  readonly keyVersion: number;
  readonly purpose: KeyringRecordPurpose;
  readonly status: KeyVersionStatus;
  readonly exportability: KeyExportability;
  readonly createdFor: KeyCreatedFor;
  readonly wrappedKeyMaterial: string;
  readonly encryptedScopeMetadata: string;
  readonly materialKind?: KeyringMaterialKind;
  readonly rootKeyRef?: string;
  readonly rootVersion?: number;
}

export interface KeyringPlaintextV1 {
  readonly keyringSchemaVersion: 1;
  readonly patientId: string;
  readonly keyringId: string;
  readonly derivationSalt?: string;
  readonly records: readonly KeyringEntryV1[];
  readonly rotationState: {
    readonly activeRootVersion: number;
    readonly latestKeyringMutation: number;
  };
}

export interface LocalKeyringEnvelope {
  readonly storageKind: "local_keyring";
  readonly keyringEnvelopeVersion: 1;
  readonly patientId: string;
  readonly keyringId: string;
  readonly sealedEnvelope: SealedEnvelopeV1;
}

export interface BackupKeyringEnvelope {
  readonly storageKind: "keyring_backup";
  readonly backupEnvelopeVersion: 1;
  readonly patientId: string;
  readonly backupId: string;
  readonly sealedEnvelope: SealedEnvelopeV1;
}

interface SealLocalKeyringInput {
  readonly patientId: string;
  readonly keyringId: string;
  readonly plaintext: KeyringPlaintextV1;
  readonly wrappingKey: KeyringWrappingKey;
}

interface OpenLocalKeyringInput {
  readonly envelope: LocalKeyringEnvelope;
  readonly wrappingKey: KeyringWrappingKey;
}

interface SealBackupKeyringInput {
  readonly patientId: string;
  readonly backupId: string;
  readonly plaintext: KeyringPlaintextV1;
  readonly recoveryWrappingKey: KeyringWrappingKey;
}

interface OpenBackupKeyringInput {
  readonly envelope: BackupKeyringEnvelope;
  readonly recoveryWrappingKey: KeyringWrappingKey;
}

const LOCAL_KEYRING_ENVELOPE_VERSION = 1 as const;
const BACKUP_KEYRING_ENVELOPE_VERSION = 1 as const;
const KEYRING_SCHEMA_VERSION = 1 as const;

const DERIVATION_SALT_PREFIX = "salt-v1:";
const DERIVATION_SALT_BYTES = 32;
const SEALED_KEY_ENVELOPE_PREFIX = "sealed-key-envelope-v1:";

const FORBIDDEN_KEYRING_PLAINTEXT_TOKENS = [
  "raw k_master",
  "raw k_root",
  "raw k_general",
  "raw k_index",
  "raw k_recovery_wrap",
  "k_master:",
  "k_root:",
  "k_general:",
  "k_index:",
  "k_recovery_wrap:",
  "domain/general",
  "domain/mental",
  "domain/reproductive",
  "mental",
  "mental-health",
  "mental health",
  "psychiatric",
  "reproductive",
  "oncology",
  "hiv",
  "diabetes",
  "nid",
  "e-tin",
  "etin",
  "phone number",
  "phone",
  "email",
  "dob",
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

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}
function sanitizeOpaqueKeyringValueForForbiddenScan(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.startsWith(SEALED_KEY_ENVELOPE_PREFIX)) {
      return `${SEALED_KEY_ENVELOPE_PREFIX}<redacted>`;
    }

    if (value.startsWith(DERIVATION_SALT_PREFIX)) {
      return `${DERIVATION_SALT_PREFIX}<redacted>`;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeOpaqueKeyringValueForForbiddenScan(item));
  }

  if (value !== null && typeof value === "object") {
    const sanitizedObject: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      sanitizedObject[key] =
        sanitizeOpaqueKeyringValueForForbiddenScan(nestedValue);
    }

    return sanitizedObject;
  }

  return value;
}
function base64UrlToBytes(value: string): Uint8Array {
  requireNonEmpty(value, "base64url value");

  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error("malformed derivation salt");
  }

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );

  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(padded);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  const maybeBuffer = (
    globalThis as unknown as {
      Buffer?: {
        from: (input: string, encoding: string) => Uint8Array;
      };
    }
  ).Buffer;

  if (maybeBuffer) {
    return new Uint8Array(maybeBuffer.from(padded, "base64"));
  }

  throw new Error("base64url decoding is unavailable");
}

function assertValidDerivationSalt(derivationSalt: string): void {
  if (!derivationSalt.startsWith(DERIVATION_SALT_PREFIX)) {
    throw new Error("malformed derivation salt");
  }

  const encodedSalt = derivationSalt.slice(DERIVATION_SALT_PREFIX.length);
  const saltBytes = base64UrlToBytes(encodedSalt);

  if (saltBytes.byteLength !== DERIVATION_SALT_BYTES) {
    throw new Error("malformed derivation salt");
  }
}

function parseKeyringPlaintext(value: string): KeyringPlaintextV1 {
  try {
    const parsed = JSON.parse(value) as KeyringPlaintextV1;
    assertValidKeyringPlaintext(parsed);
    return parsed;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("invalid keyring plaintext");
  }
}

function assertInputMatchesPlaintext(
  patientId: string,
  keyringId: string,
  plaintext: KeyringPlaintextV1,
): void {
  if (plaintext.patientId !== patientId) {
    throw new Error("keyring patientId mismatch");
  }

  if (plaintext.keyringId !== keyringId) {
    throw new Error("keyringId mismatch");
  }
}

function assertValidRootKeyEntry(entry: KeyringEntryV1): void {
  if (entry.materialKind !== "sealed_root_key") {
    throw new Error("root key record must contain sealed root material");
  }

  if (entry.exportability !== "wrapped_only") {
    throw new Error("root key record must be wrapped only");
  }

  if (entry.createdFor !== "patient_vault") {
    throw new Error("root key record must belong to patient vault");
  }

  if (!entry.wrappedKeyMaterial.startsWith(SEALED_KEY_ENVELOPE_PREFIX)) {
    throw new Error("root key record must contain sealed root envelope");
  }

  if (entry.rootKeyRef !== undefined || entry.rootVersion !== undefined) {
    throw new Error("root key record must not reference another root key");
  }
}

function assertValidDerivedRootReference(entry: KeyringEntryV1): void {
  if (entry.materialKind !== "root_derived_ref") {
    return;
  }

  const rootKeyRef = entry.rootKeyRef;
  const rootVersion = entry.rootVersion;

  if (typeof rootKeyRef !== "string" || rootKeyRef.trim().length === 0) {
    throw new Error("derived key record must reference root key");
  }

  if (typeof rootVersion !== "number" || !Number.isInteger(rootVersion) || rootVersion <= 0) {
    throw new Error("derived key record must reference root version");
  }

  const expectedReference = `root-ref:${rootKeyRef}:v${rootVersion}`;

  if (entry.wrappedKeyMaterial !== expectedReference) {
    throw new Error("derived key record root reference mismatch");
  }
}

function assertValidKeyringEntry(entry: KeyringEntryV1): void {
  requireNonEmpty(entry.keyScopeId, "entry.keyScopeId");
  assertPositiveInteger(entry.keyVersion, "entry.keyVersion");
  requireNonEmpty(entry.wrappedKeyMaterial, "entry.wrappedKeyMaterial");
  requireNonEmpty(
    entry.encryptedScopeMetadata,
    "entry.encryptedScopeMetadata",
  );

  if (entry.purpose === "root_key") {
    assertValidRootKeyEntry(entry);
    return;
  }

  if (entry.materialKind === "sealed_root_key") {
    throw new Error("sealed root material is only valid for root key records");
  }

  createKeyScopeRecord({
    keyScopeId: entry.keyScopeId,
    purpose: entry.purpose,
    version: entry.keyVersion,
    status: entry.status,
    exportability: entry.exportability,
    createdFor: entry.createdFor,
  });

  assertValidDerivedRootReference(entry);
}

function assertValidKeyringPlaintext(plaintext: KeyringPlaintextV1): void {
  if (plaintext.keyringSchemaVersion !== KEYRING_SCHEMA_VERSION) {
    throw new Error("unsupported keyring schema version");
  }

  requireNonEmpty(plaintext.patientId, "patientId");
  requireNonEmpty(plaintext.keyringId, "keyringId");

  if (plaintext.derivationSalt !== undefined) {
    assertValidDerivationSalt(plaintext.derivationSalt);
  }

  if (!Array.isArray(plaintext.records) || plaintext.records.length === 0) {
    throw new Error("keyring must contain at least one record");
  }

  assertPositiveInteger(
    plaintext.rotationState.activeRootVersion,
    "activeRootVersion",
  );
  assertPositiveInteger(
    plaintext.rotationState.latestKeyringMutation,
    "latestKeyringMutation",
  );

  for (const entry of plaintext.records) {
    assertValidKeyringEntry(entry);
  }

  assertNoForbiddenKeyringPlaintext(plaintext);
}

function buildLocalAad(input: SealLocalKeyringInput): AadV1 {
  return {
    envelopeVersion: 1,
    cryptoSuite: "AES-256-GCM",
    patientId: input.patientId,
    recordId: input.keyringId,
    keyScopeId: input.wrappingKey.keyScopeId,
    keyVersion: input.wrappingKey.keyVersion,
    purpose: "local_keyring",
  };
}

function buildBackupAad(input: SealBackupKeyringInput): AadV1 {
  return {
    envelopeVersion: 1,
    cryptoSuite: "AES-256-GCM",
    patientId: input.patientId,
    recordId: input.backupId,
    keyScopeId: input.recoveryWrappingKey.keyScopeId,
    keyVersion: input.recoveryWrappingKey.keyVersion,
    purpose: "keyring_backup",
  };
}

function assertLocalEnvelope(envelope: LocalKeyringEnvelope): void {
  if (envelope.storageKind !== "local_keyring") {
    throw new Error("local keyring envelope required");
  }

  if (envelope.sealedEnvelope.aad.purpose !== "local_keyring") {
    throw new Error("local keyring envelope required");
  }

  if (envelope.keyringEnvelopeVersion !== LOCAL_KEYRING_ENVELOPE_VERSION) {
    throw new Error("unsupported local keyring envelope version");
  }

  if (
    envelope.patientId !== envelope.sealedEnvelope.aad.patientId ||
    envelope.keyringId !== envelope.sealedEnvelope.aad.recordId
  ) {
    throw new Error("local keyring metadata mismatch");
  }
}

function assertBackupEnvelope(envelope: BackupKeyringEnvelope): void {
  if (envelope.storageKind !== "keyring_backup") {
    throw new Error("backup keyring envelope required");
  }

  if (envelope.sealedEnvelope.aad.purpose !== "keyring_backup") {
    throw new Error("backup keyring envelope required");
  }

  if (envelope.backupEnvelopeVersion !== BACKUP_KEYRING_ENVELOPE_VERSION) {
    throw new Error("unsupported backup keyring envelope version");
  }

  if (
    envelope.patientId !== envelope.sealedEnvelope.aad.patientId ||
    envelope.backupId !== envelope.sealedEnvelope.aad.recordId
  ) {
    throw new Error("backup keyring metadata mismatch");
  }
}

export function assertNoForbiddenKeyringPlaintext(
  plaintext: KeyringPlaintextV1,
): void {
  const sanitizedPlaintext =
    sanitizeOpaqueKeyringValueForForbiddenScan(plaintext);

  const serialized = stableStringify(sanitizedPlaintext).toLowerCase();

  const hasForbiddenToken = FORBIDDEN_KEYRING_PLAINTEXT_TOKENS.some((token) =>
    serialized.includes(token),
  );

  if (hasForbiddenToken) {
    throw new Error("forbidden keyring plaintext");
  }
}

export async function sealLocalKeyring(
  input: SealLocalKeyringInput,
): Promise<LocalKeyringEnvelope> {
  requireNonEmpty(input.patientId, "patientId");
  requireNonEmpty(input.keyringId, "keyringId");
  assertInputMatchesPlaintext(input.patientId, input.keyringId, input.plaintext);
  assertValidKeyringPlaintext(input.plaintext);

  const sealedEnvelope = await encryptToEnvelope({
    plaintext: stableStringify(input.plaintext),
    key: input.wrappingKey,
    aad: buildLocalAad(input),
  });

  const envelope: LocalKeyringEnvelope = {
    storageKind: "local_keyring",
    keyringEnvelopeVersion: LOCAL_KEYRING_ENVELOPE_VERSION,
    patientId: input.patientId,
    keyringId: input.keyringId,
    sealedEnvelope,
  };

  return Object.freeze(envelope);
}

export async function openLocalKeyring(
  input: OpenLocalKeyringInput,
): Promise<KeyringPlaintextV1> {
  assertLocalEnvelope(input.envelope);

  const plaintext = await decryptFromEnvelope({
    envelope: input.envelope.sealedEnvelope,
    key: input.wrappingKey,
  });

  return parseKeyringPlaintext(plaintext);
}

export async function sealBackupKeyring(
  input: SealBackupKeyringInput,
): Promise<BackupKeyringEnvelope> {
  requireNonEmpty(input.patientId, "patientId");
  requireNonEmpty(input.backupId, "backupId");
  assertInputMatchesPlaintext(
    input.patientId,
    input.plaintext.keyringId,
    input.plaintext,
  );
  assertValidKeyringPlaintext(input.plaintext);

  const sealedEnvelope = await encryptToEnvelope({
    plaintext: stableStringify(input.plaintext),
    key: input.recoveryWrappingKey,
    aad: buildBackupAad(input),
  });

  const envelope: BackupKeyringEnvelope = {
    storageKind: "keyring_backup",
    backupEnvelopeVersion: BACKUP_KEYRING_ENVELOPE_VERSION,
    patientId: input.patientId,
    backupId: input.backupId,
    sealedEnvelope,
  };

  return Object.freeze(envelope);
}

export async function openBackupKeyring(
  input: OpenBackupKeyringInput,
): Promise<KeyringPlaintextV1> {
  assertBackupEnvelope(input.envelope);

  const plaintext = await decryptFromEnvelope({
    envelope: input.envelope.sealedEnvelope,
    key: input.recoveryWrappingKey,
  });

  return parseKeyringPlaintext(plaintext);
}