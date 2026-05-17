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
  type KeyringPlaintextV1,
  type LocalKeyringEnvelope,
} from "../../infrastructure/keyring-storage/encryptedKeyringStore";

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

function assertValidKeyScopes(keyScopes: InitialVaultKeyScopeInput): void {
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

function buildOpaqueWrappedRootDescriptor(input: {
  readonly rootVersion: number;
  readonly keyScopeId: string;
}): string {
  return `sealed:root-version:${input.rootVersion}:scope:${input.keyScopeId}`;
}

function buildOpaqueScopeMetadataDescriptor(keyScopeId: string): string {
  return `sealed:opaque-scope-metadata:${keyScopeId}`;
}

function buildInitialKeyringPlaintext(input: {
  readonly patientId: string;
  readonly keyringId: string;
  readonly keyScopes: InitialVaultKeyScopeInput;
}): KeyringPlaintextV1 {
  const plaintext: KeyringPlaintextV1 = {
    keyringSchemaVersion: 1,
    patientId: input.patientId,
    keyringId: input.keyringId,
    records: [
      {
        keyScopeId: input.keyScopes.payloadEncryptionKeyScopeId,
        keyVersion: INITIAL_KEY_VERSION,
        purpose: "payload_encryption",
        status: "active",
        exportability: "non_exportable",
        createdFor: "patient_vault",
        wrappedKeyMaterial: buildOpaqueWrappedRootDescriptor({
          rootVersion: INITIAL_ROOT_VERSION,
          keyScopeId: input.keyScopes.payloadEncryptionKeyScopeId,
        }),
        encryptedScopeMetadata: buildOpaqueScopeMetadataDescriptor(
          input.keyScopes.payloadEncryptionKeyScopeId,
        ),
      },
      {
        keyScopeId: input.keyScopes.blindIndexKeyScopeId,
        keyVersion: INITIAL_KEY_VERSION,
        purpose: "blind_index",
        status: "active",
        exportability: "non_exportable",
        createdFor: "patient_vault",
        wrappedKeyMaterial: buildOpaqueWrappedRootDescriptor({
          rootVersion: INITIAL_ROOT_VERSION,
          keyScopeId: input.keyScopes.blindIndexKeyScopeId,
        }),
        encryptedScopeMetadata: buildOpaqueScopeMetadataDescriptor(
          input.keyScopes.blindIndexKeyScopeId,
        ),
      },
    ],
    rotationState: {
      activeRootVersion: INITIAL_ROOT_VERSION,
      latestKeyringMutation: 1,
    },
  };

  assertNoForbiddenKeyringPlaintext(plaintext);

  return plaintext;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value);
}

function assertOpenedKeyringsMatch(
  local: KeyringPlaintextV1,
  backup: KeyringPlaintextV1,
): void {
  if (stableStringify(local) !== stableStringify(backup)) {
    throw new Error("vault assembly verification failed");
  }
}

function assertInitialRecordsPresent(
  keyring: KeyringPlaintextV1,
  keyScopes: InitialVaultKeyScopeInput,
): FirstVaultVerification {
  const payloadRecord = keyring.records.find(
    (record) =>
      record.keyScopeId === keyScopes.payloadEncryptionKeyScopeId &&
      record.purpose === "payload_encryption",
  );

  const blindIndexRecord = keyring.records.find(
    (record) =>
      record.keyScopeId === keyScopes.blindIndexKeyScopeId &&
      record.purpose === "blind_index",
  );

  if (!payloadRecord || !blindIndexRecord) {
    throw new Error("initial keyring records missing");
  }

  return Object.freeze({
    localKeyringOpened: true,
    backupKeyringOpened: true,
    payloadKeyDerived: true,
    blindIndexKeyDerived: true,
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

  assertOpenedKeyringsMatch(openedLocal, openedBackup);

  if (openedLocal.patientId !== assembly.patientId) {
    throw new Error("vault assembly patientId mismatch");
  }

  if (openedLocal.keyringId !== assembly.keyringId) {
    throw new Error("vault assembly keyringId mismatch");
  }

  return assertInitialRecordsPresent(openedLocal, assembly.keyScopes);
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

  const payloadEncryptionKey = await deriveRootScopedKey({
    rootKey,
    patientSaltBytes,
    keyScopeId: keyScopes.payloadEncryptionKeyScopeId,
    keyVersion: INITIAL_KEY_VERSION,
    purpose: "payload_encryption",
  });

  const blindIndexKey = await deriveRootScopedKey({
    rootKey,
    patientSaltBytes,
    keyScopeId: keyScopes.blindIndexKeyScopeId,
    keyVersion: INITIAL_KEY_VERSION,
    purpose: "blind_index",
  });

  if (payloadEncryptionKey.rawKeyBytes.byteLength !== KEY_BYTES) {
    throw new Error("payload encryption key derivation failed");
  }

  if (blindIndexKey.rawKeyBytes.byteLength !== KEY_BYTES) {
    throw new Error("blind index key derivation failed");
  }

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

  const keyringPlaintext = buildInitialKeyringPlaintext({
    patientId: input.patientId,
    keyringId: input.keyringId,
    keyScopes,
  });

  const localKeyringEnvelope = await sealLocalKeyring({
    patientId: input.patientId,
    keyringId: input.keyringId,
    plaintext: keyringPlaintext,
    wrappingKey: localUnlockKey,
  });

  const backupKeyringEnvelope = await sealBackupKeyring({
    patientId: input.patientId,
    backupId: input.backupId,
    plaintext: keyringPlaintext,
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
