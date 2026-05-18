import {
  assertNonSemanticDerivationScope,
  deriveRootScopedKey,
  generateCapabilityDek,
  type DerivedKeyMaterial,
  type RootKeyMaterial,
} from "../../infrastructure/key-material/keyMaterialFactory";

import {
  assertNoForbiddenKeyringPlaintext,
  openBackupKeyring,
  openLocalKeyring,
  sealBackupKeyring,
  sealLocalKeyring,
  type BackupKeyringEnvelope,
  type KeyringEntryV1,
  type KeyringPlaintextV1,
  type LocalKeyringEnvelope,
} from "../../infrastructure/keyring-storage/encryptedKeyringStore";

import {
  deserializeSealedKeyEnvelope,
  sealRawKeyMaterial,
  serializeSealedKeyEnvelope,
  unsealRawKeyMaterial,
  type RawKeyMaterial,
} from "../../infrastructure/key-sealing/sealedKeyEnvelope";

export interface InitialVaultKeyScopeInput {
  readonly payloadEncryptionKeyScopeId: string;
  readonly blindIndexKeyScopeId: string;
  readonly localUnlockKeyScopeId: string;
  readonly recoveryWrapKeyScopeId: string;
}

export interface InitializeFirstPatientVaultInput {
  readonly patientId: string;
  readonly keyringId: string;
  readonly backupId: string;
  readonly keyScopes: InitialVaultKeyScopeInput;
}

export interface FirstVaultVerification {
  readonly localKeyringOpened: boolean;
  readonly backupKeyringOpened: boolean;
  readonly payloadKeyDerived: boolean;
  readonly blindIndexKeyDerived: boolean;
}

export interface TransientInitializationSecrets {
  readonly localUnlockKey: DerivedKeyMaterial;
  readonly recoveryWrapKey: DerivedKeyMaterial;
}

export interface FirstVaultAssemblyResult {
  readonly patientId: string;
  readonly keyringId: string;
  readonly backupId: string;
  readonly keyScopes: InitialVaultKeyScopeInput;
  readonly localKeyringEnvelope: LocalKeyringEnvelope;
  readonly backupKeyringEnvelope: BackupKeyringEnvelope;
  readonly verification: FirstVaultVerification;
  readonly transientInitializationSecrets: TransientInitializationSecrets;
}

const INITIAL_KEY_VERSION = 1;
const INITIAL_ROOT_VERSION = 1;
const KEY_BYTES = 32;
const ROOT_KEY_ID = "root-key-001";
const ROOT_KEY_SCOPE_ID = "ks_03";
const DERIVATION_SALT_PREFIX = "salt-v1:";

function requireNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
}

function getCrypto(): Crypto {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.getRandomValues !== "function") {
    throw new Error("CSPRNG unavailable");
  }

  return cryptoApi;
}

function generateRandomBytes(fieldName: string): Uint8Array {
  const bytes = new Uint8Array(KEY_BYTES);
  getCrypto().getRandomValues(bytes);

  if (bytes.byteLength !== KEY_BYTES) {
    throw new Error(`${fieldName} generation failed`);
  }

  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(binary);
  }

  const maybeBuffer = (
    globalThis as unknown as {
      Buffer?: {
        from: (input: Uint8Array | string, encoding?: string) => {
          toString: (encoding: string) => string;
        };
      };
    }
  ).Buffer;

  if (maybeBuffer) {
    return maybeBuffer.from(bytes).toString("base64");
  }

  throw new Error("base64 encoding is unavailable");
}

function base64ToBytes(value: string): Uint8Array {
  requireNonEmpty(value, "base64 value");

  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(value);
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
    return new Uint8Array(maybeBuffer.from(value, "base64"));
  }

  throw new Error("base64 decoding is unavailable");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
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

  try {
    return base64ToBytes(padded);
  } catch {
    throw new Error("malformed derivation salt");
  }
}

function encodeDerivationSalt(patientSaltBytes: Uint8Array): string {
  if (patientSaltBytes.byteLength !== KEY_BYTES) {
    throw new Error("patientSalt generation failed");
  }

  return `${DERIVATION_SALT_PREFIX}${bytesToBase64Url(patientSaltBytes)}`;
}

function decodeDerivationSalt(derivationSalt: string): Uint8Array {
  if (!derivationSalt.startsWith(DERIVATION_SALT_PREFIX)) {
    throw new Error("malformed derivation salt");
  }

  const saltBytes = base64UrlToBytes(
    derivationSalt.slice(DERIVATION_SALT_PREFIX.length),
  );

  if (saltBytes.byteLength !== KEY_BYTES) {
    throw new Error("malformed derivation salt");
  }

  return saltBytes;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index] ^ right[index];
  }

  return difference === 0;
}

function zeroBytes(bytes: Uint8Array | undefined): void {
  if (bytes) {
    bytes.fill(0);
  }
}

function assertValidKeyScopes(keyScopes: InitialVaultKeyScopeInput): void {
  assertNonSemanticDerivationScope(ROOT_KEY_SCOPE_ID);
  assertNonSemanticDerivationScope(keyScopes.payloadEncryptionKeyScopeId);
  assertNonSemanticDerivationScope(keyScopes.blindIndexKeyScopeId);
  assertNonSemanticDerivationScope(keyScopes.localUnlockKeyScopeId);
  assertNonSemanticDerivationScope(keyScopes.recoveryWrapKeyScopeId);
}

function freezeKeyScopes(
  keyScopes: InitialVaultKeyScopeInput,
): InitialVaultKeyScopeInput {
  return Object.freeze({
    payloadEncryptionKeyScopeId: keyScopes.payloadEncryptionKeyScopeId,
    blindIndexKeyScopeId: keyScopes.blindIndexKeyScopeId,
    localUnlockKeyScopeId: keyScopes.localUnlockKeyScopeId,
    recoveryWrapKeyScopeId: keyScopes.recoveryWrapKeyScopeId,
  });
}

function createTransientInitializationSecrets(input: {
  readonly localUnlockKey: DerivedKeyMaterial;
  readonly recoveryWrapKey: DerivedKeyMaterial;
}): TransientInitializationSecrets {
  const secrets = {} as TransientInitializationSecrets;

  Object.defineProperties(secrets, {
    localUnlockKey: {
      value: input.localUnlockKey,
      enumerable: false,
      writable: false,
      configurable: false,
    },
    recoveryWrapKey: {
      value: input.recoveryWrapKey,
      enumerable: false,
      writable: false,
      configurable: false,
    },
  });

  return Object.freeze(secrets);
}

function buildOpaqueScopeMetadataDescriptor(keyScopeId: string): string {
  return `sealed:opaque-scope-metadata:${keyScopeId}`;
}

function buildRootReference(rootKeyId: string, rootVersion: number): string {
  return `root-ref:${rootKeyId}:v${rootVersion}`;
}

function buildRootKeyMaterial(rootKey: RootKeyMaterial): RawKeyMaterial {
  return {
    keyId: ROOT_KEY_ID,
    keyType: "root_key",
    keyScopeId: ROOT_KEY_SCOPE_ID,
    keyVersion: rootKey.rootVersion,
    rawKeyBytes: rootKey.rawRootKeyBytes,
  };
}

async function buildSerializedLocalRootEnvelope(input: {
  readonly patientId: string;
  readonly keyringId: string;
  readonly rootKey: RootKeyMaterial;
  readonly localUnlockKey: DerivedKeyMaterial;
}): Promise<string> {
  const sealedRootEnvelope = await sealRawKeyMaterial({
    patientId: input.patientId,
    keyringId: input.keyringId,
    rawKeyMaterial: buildRootKeyMaterial(input.rootKey),
    sealingKey: input.localUnlockKey,
    sealPurpose: "local_keyring_root",
  });

  return serializeSealedKeyEnvelope(sealedRootEnvelope);
}

async function buildSerializedBackupRootEnvelope(input: {
  readonly patientId: string;
  readonly keyringId: string;
  readonly rootKey: RootKeyMaterial;
  readonly recoveryWrapKey: DerivedKeyMaterial;
}): Promise<string> {
  const sealedRootEnvelope = await sealRawKeyMaterial({
    patientId: input.patientId,
    keyringId: input.keyringId,
    rawKeyMaterial: buildRootKeyMaterial(input.rootKey),
    sealingKey: input.recoveryWrapKey,
    sealPurpose: "recovery_backup_root",
  });

  return serializeSealedKeyEnvelope(sealedRootEnvelope);
}

function buildRootRecord(serializedRootEnvelope: string): KeyringEntryV1 {
  return {
    materialKind: "sealed_root_key",
    keyScopeId: ROOT_KEY_SCOPE_ID,
    keyVersion: INITIAL_ROOT_VERSION,
    purpose: "root_key",
    status: "active",
    exportability: "wrapped_only",
    createdFor: "patient_vault",
    wrappedKeyMaterial: serializedRootEnvelope,
    encryptedScopeMetadata: buildOpaqueScopeMetadataDescriptor(
      ROOT_KEY_SCOPE_ID,
    ),
  };
}

function buildPayloadRecord(keyScopes: InitialVaultKeyScopeInput): KeyringEntryV1 {
  return {
    materialKind: "root_derived_ref",
    keyScopeId: keyScopes.payloadEncryptionKeyScopeId,
    keyVersion: INITIAL_KEY_VERSION,
    purpose: "payload_encryption",
    status: "active",
    exportability: "non_exportable",
    createdFor: "patient_vault",
    rootKeyRef: ROOT_KEY_ID,
    rootVersion: INITIAL_ROOT_VERSION,
    wrappedKeyMaterial: buildRootReference(ROOT_KEY_ID, INITIAL_ROOT_VERSION),
    encryptedScopeMetadata: buildOpaqueScopeMetadataDescriptor(
      keyScopes.payloadEncryptionKeyScopeId,
    ),
  };
}

function buildBlindIndexRecord(
  keyScopes: InitialVaultKeyScopeInput,
): KeyringEntryV1 {
  return {
    materialKind: "root_derived_ref",
    keyScopeId: keyScopes.blindIndexKeyScopeId,
    keyVersion: INITIAL_KEY_VERSION,
    purpose: "blind_index",
    status: "active",
    exportability: "non_exportable",
    createdFor: "patient_vault",
    rootKeyRef: ROOT_KEY_ID,
    rootVersion: INITIAL_ROOT_VERSION,
    wrappedKeyMaterial: buildRootReference(ROOT_KEY_ID, INITIAL_ROOT_VERSION),
    encryptedScopeMetadata: buildOpaqueScopeMetadataDescriptor(
      keyScopes.blindIndexKeyScopeId,
    ),
  };
}

function buildInitialKeyringPlaintext(input: {
  readonly patientId: string;
  readonly keyringId: string;
  readonly derivationSalt: string;
  readonly keyScopes: InitialVaultKeyScopeInput;
  readonly serializedRootEnvelope: string;
}): KeyringPlaintextV1 {
  const plaintext: KeyringPlaintextV1 = {
    keyringSchemaVersion: 1,
    patientId: input.patientId,
    keyringId: input.keyringId,
    derivationSalt: input.derivationSalt,
    records: [
      buildRootRecord(input.serializedRootEnvelope),
      buildPayloadRecord(input.keyScopes),
      buildBlindIndexRecord(input.keyScopes),
    ],
    rotationState: {
      activeRootVersion: INITIAL_ROOT_VERSION,
      latestKeyringMutation: 1,
    },
  };

  assertNoForbiddenKeyringPlaintext(plaintext);

  return plaintext;
}

function requireRecordByPurpose(
  keyring: KeyringPlaintextV1,
  purpose: KeyringEntryV1["purpose"],
): KeyringEntryV1 {
  const record = keyring.records.find((entry) => entry.purpose === purpose);

  if (!record) {
    throw new Error(`missing ${purpose} record`);
  }

  return record;
}

function assertFirstVaultRecordSet(keyring: KeyringPlaintextV1): void {
  if (keyring.records.length !== 3) {
    throw new Error("first vault keyring must contain exactly three records");
  }

  const purposes = keyring.records.map((record) => record.purpose);

  if (
    purposes[0] !== "root_key" ||
    purposes[1] !== "payload_encryption" ||
    purposes[2] !== "blind_index"
  ) {
    throw new Error("first vault keyring record order mismatch");
  }
}

function assertDependentRecordReferencesRoot(record: KeyringEntryV1): void {
  if (record.materialKind !== "root_derived_ref") {
    throw new Error("derived key record must reference root key");
  }

  if (record.rootKeyRef !== ROOT_KEY_ID) {
    throw new Error("derived key record must reference root key");
  }

  if (record.rootVersion !== INITIAL_ROOT_VERSION) {
    throw new Error("derived key record must reference root version");
  }

  if (
    record.wrappedKeyMaterial !==
    buildRootReference(ROOT_KEY_ID, INITIAL_ROOT_VERSION)
  ) {
    throw new Error("derived key record root reference mismatch");
  }
}

function assertMatchingDependentRecordPair(input: {
  readonly local: KeyringEntryV1;
  readonly backup: KeyringEntryV1;
  readonly purpose: "payload_encryption" | "blind_index";
}): void {
  const comparedFields: readonly (keyof KeyringEntryV1)[] = [
    "materialKind",
    "keyScopeId",
    "keyVersion",
    "purpose",
    "status",
    "exportability",
    "createdFor",
    "rootKeyRef",
    "rootVersion",
    "wrappedKeyMaterial",
    "encryptedScopeMetadata",
  ];

  for (const field of comparedFields) {
    if (input.local[field] !== input.backup[field]) {
      throw new Error(`${input.purpose} record mismatch`);
    }
  }
}

async function unsealRootFromKeyring(input: {
  readonly keyring: KeyringPlaintextV1;
  readonly sealingKey: DerivedKeyMaterial;
  readonly expectedSealPurpose: "local_keyring_root" | "recovery_backup_root";
}): Promise<RawKeyMaterial> {
  const rootRecord = requireRecordByPurpose(input.keyring, "root_key");

  if (rootRecord.materialKind !== "sealed_root_key") {
    throw new Error("root key record must contain sealed root material");
  }

  const sealedRootEnvelope = deserializeSealedKeyEnvelope(
    rootRecord.wrappedKeyMaterial,
  );

  if (sealedRootEnvelope.sealPurpose !== input.expectedSealPurpose) {
    throw new Error("sealed root purpose mismatch");
  }

  return unsealRawKeyMaterial({
    envelope: sealedRootEnvelope,
    sealingKey: input.sealingKey,
  });
}

async function verifyDerivedKeysFromRoot(input: {
  readonly keyring: KeyringPlaintextV1;
  readonly root: RawKeyMaterial;
}): Promise<FirstVaultVerification> {
  const payloadRecord = requireRecordByPurpose(input.keyring, "payload_encryption");
  const blindIndexRecord = requireRecordByPurpose(input.keyring, "blind_index");

  assertDependentRecordReferencesRoot(payloadRecord);
  assertDependentRecordReferencesRoot(blindIndexRecord);

  if (input.root.keyType !== "root_key") {
    throw new Error("sealed root key required");
  }

  const patientSaltBytes = decodeDerivationSalt(input.keyring.derivationSalt ?? "");

  let payloadEncryptionKey: DerivedKeyMaterial | undefined;
  let blindIndexKey: DerivedKeyMaterial | undefined;

  try {
    const rootKey: RootKeyMaterial = {
      rootVersion: input.root.keyVersion,
      rawRootKeyBytes: input.root.rawKeyBytes,
    };

    payloadEncryptionKey = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes,
      keyScopeId: payloadRecord.keyScopeId,
      keyVersion: payloadRecord.keyVersion,
      purpose: "payload_encryption",
    });

    blindIndexKey = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes,
      keyScopeId: blindIndexRecord.keyScopeId,
      keyVersion: blindIndexRecord.keyVersion,
      purpose: "blind_index",
    });

    if (payloadEncryptionKey.rawKeyBytes.byteLength !== KEY_BYTES) {
      throw new Error("payload encryption key derivation failed");
    }

    if (blindIndexKey.rawKeyBytes.byteLength !== KEY_BYTES) {
      throw new Error("blind index key derivation failed");
    }

    return Object.freeze({
      localKeyringOpened: true,
      backupKeyringOpened: true,
      payloadKeyDerived: true,
      blindIndexKeyDerived: true,
    });
  } finally {
    zeroBytes(patientSaltBytes);
    zeroBytes(payloadEncryptionKey?.rawKeyBytes);
    zeroBytes(blindIndexKey?.rawKeyBytes);
  }
}

function assertCompatibleKeyringPlaintexts(input: {
  readonly local: KeyringPlaintextV1;
  readonly backup: KeyringPlaintextV1;
}): void {
  if (input.local.patientId !== input.backup.patientId) {
    throw new Error("vault assembly patientId mismatch");
  }

  if (input.local.keyringId !== input.backup.keyringId) {
    throw new Error("vault assembly keyringId mismatch");
  }

  if (input.local.derivationSalt !== input.backup.derivationSalt) {
    throw new Error("vault assembly derivation salt mismatch");
  }

  assertFirstVaultRecordSet(input.local);
  assertFirstVaultRecordSet(input.backup);

  const localPayloadRecord = requireRecordByPurpose(
    input.local,
    "payload_encryption",
  );
  const backupPayloadRecord = requireRecordByPurpose(
    input.backup,
    "payload_encryption",
  );
  const localBlindIndexRecord = requireRecordByPurpose(input.local, "blind_index");
  const backupBlindIndexRecord = requireRecordByPurpose(input.backup, "blind_index");

  assertMatchingDependentRecordPair({
    local: localPayloadRecord,
    backup: backupPayloadRecord,
    purpose: "payload_encryption",
  });

  assertMatchingDependentRecordPair({
    local: localBlindIndexRecord,
    backup: backupBlindIndexRecord,
    purpose: "blind_index",
  });
}

export async function verifyFirstVaultAssembly(
  assembly: FirstVaultAssemblyResult,
): Promise<FirstVaultVerification> {
  const openedLocal = await openLocalKeyring({
    envelope: assembly.localKeyringEnvelope,
    wrappingKey: assembly.transientInitializationSecrets.localUnlockKey,
  });

  const openedBackup = await openBackupKeyring({
    envelope: assembly.backupKeyringEnvelope,
    recoveryWrappingKey:
      assembly.transientInitializationSecrets.recoveryWrapKey,
  });

  if (openedLocal.patientId !== assembly.patientId) {
    throw new Error("vault assembly patientId mismatch");
  }

  if (openedLocal.keyringId !== assembly.keyringId) {
    throw new Error("vault assembly keyringId mismatch");
  }

  assertCompatibleKeyringPlaintexts({
    local: openedLocal,
    backup: openedBackup,
  });

  let localRoot: RawKeyMaterial | undefined;
  let backupRoot: RawKeyMaterial | undefined;

  try {
    localRoot = await unsealRootFromKeyring({
      keyring: openedLocal,
      sealingKey: assembly.transientInitializationSecrets.localUnlockKey,
      expectedSealPurpose: "local_keyring_root",
   });

    backupRoot = await unsealRootFromKeyring({
      keyring: openedBackup,
      sealingKey: assembly.transientInitializationSecrets.recoveryWrapKey,
      expectedSealPurpose: "recovery_backup_root",
   });

    if (!bytesEqual(localRoot.rawKeyBytes, backupRoot.rawKeyBytes)) {
      throw new Error("vault assembly root key mismatch");
    }

    return await verifyDerivedKeysFromRoot({
      keyring: openedLocal,
      root: localRoot,
    });
  } finally {
    zeroBytes(localRoot?.rawKeyBytes);
    zeroBytes(backupRoot?.rawKeyBytes);
  }
}

export async function initializeFirstPatientVault(
  input: InitializeFirstPatientVaultInput,
): Promise<FirstVaultAssemblyResult> {
  requireNonEmpty(input.patientId, "patientId");
  requireNonEmpty(input.keyringId, "keyringId");
  requireNonEmpty(input.backupId, "backupId");
  assertValidKeyScopes(input.keyScopes);

  const keyScopes = freezeKeyScopes(input.keyScopes);

  const rootKey: RootKeyMaterial = {
    rootVersion: INITIAL_ROOT_VERSION,
    rawRootKeyBytes: generateRandomBytes("K_root"),
  };

  const patientSaltBytes = generateRandomBytes("patientSalt");

  const localUnlockKey = generateCapabilityDek({
    keyScopeId: keyScopes.localUnlockKeyScopeId,
    keyVersion: INITIAL_KEY_VERSION,
    purpose: "local_keyring",
  });

  const recoveryWrapKey = generateCapabilityDek({
    keyScopeId: keyScopes.recoveryWrapKeyScopeId,
    keyVersion: INITIAL_KEY_VERSION,
    purpose: "keyring_backup",
  });

  let derivationSalt = "";
  let localSerializedRootEnvelope = "";
  let backupSerializedRootEnvelope = "";

  try {
    derivationSalt = encodeDerivationSalt(patientSaltBytes);

    localSerializedRootEnvelope = await buildSerializedLocalRootEnvelope({
      patientId: input.patientId,
      keyringId: input.keyringId,
      rootKey,
      localUnlockKey,
    });

    backupSerializedRootEnvelope = await buildSerializedBackupRootEnvelope({
      patientId: input.patientId,
      keyringId: input.keyringId,
      rootKey,
      recoveryWrapKey,
    });
  } finally {
    zeroBytes(rootKey.rawRootKeyBytes);
    zeroBytes(patientSaltBytes);
  }

  if (
    derivationSalt.length === 0 ||
    localSerializedRootEnvelope.length === 0 ||
    backupSerializedRootEnvelope.length === 0
  ) {
    throw new Error("vault assembly root sealing failed");
  }

  const localKeyringPlaintext = buildInitialKeyringPlaintext({
    patientId: input.patientId,
    keyringId: input.keyringId,
    derivationSalt,
    keyScopes,
    serializedRootEnvelope: localSerializedRootEnvelope,
  });

  const backupKeyringPlaintext = buildInitialKeyringPlaintext({
    patientId: input.patientId,
    keyringId: input.keyringId,
    derivationSalt,
    keyScopes,
    serializedRootEnvelope: backupSerializedRootEnvelope,
  });

  const localKeyringEnvelope = await sealLocalKeyring({
    patientId: input.patientId,
    keyringId: input.keyringId,
    plaintext: localKeyringPlaintext,
    wrappingKey: localUnlockKey,
  });

  const backupKeyringEnvelope = await sealBackupKeyring({
    patientId: input.patientId,
    backupId: input.backupId,
    plaintext: backupKeyringPlaintext,
    recoveryWrappingKey: recoveryWrapKey,
  });

  const transientInitializationSecrets = createTransientInitializationSecrets({
    localUnlockKey,
    recoveryWrapKey,
  });

  const unverifiedAssembly: FirstVaultAssemblyResult = Object.freeze({
    patientId: input.patientId,
    keyringId: input.keyringId,
    backupId: input.backupId,
    keyScopes,
    localKeyringEnvelope,
    backupKeyringEnvelope,
    verification: Object.freeze({
      localKeyringOpened: false,
      backupKeyringOpened: false,
      payloadKeyDerived: false,
      blindIndexKeyDerived: false,
    }),
    transientInitializationSecrets,
  });

  const verification = await verifyFirstVaultAssembly(unverifiedAssembly);

  return Object.freeze({
    ...unverifiedAssembly,
    verification,
  });
}
