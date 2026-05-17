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

export interface KeyringEntryV1 {
  readonly keyScopeId: string;
  readonly keyVersion: number;
  readonly purpose: KeyPurpose;
  readonly status: KeyVersionStatus;
  readonly exportability: KeyExportability;
  readonly createdFor: KeyCreatedFor;
  readonly wrappedKeyMaterial: string;
  readonly encryptedScopeMetadata: string;
}

export interface KeyringPlaintextV1 {
  readonly keyringSchemaVersion: 1;
  readonly patientId: string;
  readonly keyringId: string;
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

function assertValidKeyringEntry(entry: KeyringEntryV1): void {
  requireNonEmpty(entry.keyScopeId, "entry.keyScopeId");
  assertPositiveInteger(entry.keyVersion, "entry.keyVersion");
  requireNonEmpty(entry.wrappedKeyMaterial, "entry.wrappedKeyMaterial");
  requireNonEmpty(
    entry.encryptedScopeMetadata,
    "entry.encryptedScopeMetadata",
  );

  createKeyScopeRecord({
    keyScopeId: entry.keyScopeId,
    purpose: entry.purpose,
    version: entry.keyVersion,
    status: entry.status,
    exportability: entry.exportability,
    createdFor: entry.createdFor,
  });
}

function assertValidKeyringPlaintext(plaintext: KeyringPlaintextV1): void {
  if (plaintext.keyringSchemaVersion !== KEYRING_SCHEMA_VERSION) {
    throw new Error("unsupported keyring schema version");
  }

  requireNonEmpty(plaintext.patientId, "patientId");
  requireNonEmpty(plaintext.keyringId, "keyringId");

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
  const serialized = stableStringify(plaintext).toLowerCase();

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