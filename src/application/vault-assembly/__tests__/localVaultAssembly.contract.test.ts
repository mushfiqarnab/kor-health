import { describe, expect, it } from "vitest";

import {
  deserializeSealedKeyEnvelope,
  unsealRawKeyMaterial,
} from "../../../infrastructure/key-sealing/sealedKeyEnvelope";

import {
  deriveRootScopedKey,
  type RootKeyMaterial,
} from "../../../infrastructure/key-material/keyMaterialFactory";

import {
  initializeFirstPatientVault,
  verifyFirstVaultAssembly,
  type FirstVaultAssemblyResult,
  type InitialVaultKeyScopeInput,
} from "../localVaultAssembly";

import {
  openBackupKeyring,
  openLocalKeyring,
  sealLocalKeyring,
  type BackupKeyringEnvelope,
  type LocalKeyringEnvelope,
} from "../../../infrastructure/keyring-storage/encryptedKeyringStore";

function serialized(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlToBytes(value: string): Uint8Array {
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

function decodeDerivationSalt(derivationSalt: string): Uint8Array {
  const prefix = "salt-v1:";

  if (!derivationSalt.startsWith(prefix)) {
    throw new Error("malformed derivation salt");
  }

  const saltBytes = base64UrlToBytes(derivationSalt.slice(prefix.length));

  if (saltBytes.byteLength !== 32) {
    throw new Error("malformed derivation salt");
  }

  return saltBytes;
}

function requireRecordByPurpose(
  records: readonly unknown[],
  purpose: string,
): Record<string, unknown> {
  const record = records.find(
    (candidate) =>
      typeof candidate === "object" &&
      candidate !== null &&
      (candidate as Record<string, unknown>).purpose === purpose,
  );

  if (!record || typeof record !== "object") {
    throw new Error(`missing ${purpose} record`);
  }

  return record as Record<string, unknown>;
}

function requireStringField(
  value: Record<string, unknown>,
  fieldName: string,
): string {
  const fieldValue = value[fieldName];

  if (typeof fieldValue !== "string" || fieldValue.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }

  return fieldValue;
}

function requireNumberField(
  value: Record<string, unknown>,
  fieldName: string,
): number {
  const fieldValue = value[fieldName];

  if (typeof fieldValue !== "number" || !Number.isInteger(fieldValue)) {
    throw new Error(`${fieldName} must be an integer`);
  }

  return fieldValue;
}
function sanitizeOpaqueCryptoFieldsForLeakScan(value: unknown): unknown {
  if (typeof value === "string") {
    if (
      value.startsWith("sealed-key-envelope-v1:") ||
      value.startsWith("salt-v1:")
    ) {
      return "<redacted-opaque-value>";
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeOpaqueCryptoFieldsForLeakScan(item));
  }

  if (value !== null && typeof value === "object") {
    const sanitizedObject: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      const normalizedKey = key.toLowerCase();

      if (
        normalizedKey === "ciphertext" ||
        normalizedKey === "tag" ||
        normalizedKey === "iv" ||
        normalizedKey === "rawkeybytesbase64url"
      ) {
        sanitizedObject[key] = "<redacted-opaque-crypto-bytes>";
        continue;
      }

      sanitizedObject[key] = sanitizeOpaqueCryptoFieldsForLeakScan(nestedValue);
    }

    return sanitizedObject;
  }

  return value;
}

function expectNoInitializationSecretLeak(value: unknown): void {
  const output = serialized(sanitizeOpaqueCryptoFieldsForLeakScan(value));

  const forbiddenTokens = [
    "raw k_root",
    "raw k_master",
    "raw k_local_unlock",
    "raw k_recovery_wrap",
    "k_root:",
    "k_master:",
    "k_local_unlock:",
    "k_recovery_wrap:",
    "domain/general",
    "domain/mental",
    "mental",
    "mental-health",
    "psychiatric",
    "reproductive",
    "oncology",
    "hiv",
    "diabetes",
    "nid",
    "e-tin",
    "phone",
    "email",
    "dob",
  ];

  for (const token of forbiddenTokens) {
    expect(output).not.toContain(token);
  }
}

const safeKeyScopes: InitialVaultKeyScopeInput = {
  payloadEncryptionKeyScopeId: "ks_01",
  blindIndexKeyScopeId: "ks_02",
  localUnlockKeyScopeId: "ks_10",
  recoveryWrapKeyScopeId: "ks_20",
};

async function createVault(): Promise<FirstVaultAssemblyResult> {
  return initializeFirstPatientVault({
    patientId: "patient-001",
    keyringId: "keyring-001",
    backupId: "backup-001",
    keyScopes: safeKeyScopes,
  });
}

describe("Local vault assembly workflow contract", () => {
  it("creates a first patient vault assembly package", async () => {
    const assembly = await createVault();

    expect(assembly.patientId).toBe("patient-001");
    expect(assembly.keyringId).toBe("keyring-001");
    expect(assembly.backupId).toBe("backup-001");

    expect(assembly.keyScopes.payloadEncryptionKeyScopeId).toBe("ks_01");
    expect(assembly.keyScopes.blindIndexKeyScopeId).toBe("ks_02");
    expect(assembly.keyScopes.localUnlockKeyScopeId).toBe("ks_10");
    expect(assembly.keyScopes.recoveryWrapKeyScopeId).toBe("ks_20");

    expect(assembly.localKeyringEnvelope.storageKind).toBe("local_keyring");
    expect(assembly.backupKeyringEnvelope.storageKind).toBe("keyring_backup");

    expect(assembly.verification.localKeyringOpened).toBe(true);
    expect(assembly.verification.backupKeyringOpened).toBe(true);
    expect(assembly.verification.payloadKeyDerived).toBe(true);
    expect(assembly.verification.blindIndexKeyDerived).toBe(true);
  });
  it("rejects a local keyring whose root envelope has backup seal purpose", async () => {
    const assembly = await createVault();

    const openedLocal = await openLocalKeyring({
      envelope: assembly.localKeyringEnvelope,
      wrappingKey: assembly.transientInitializationSecrets.localUnlockKey,
    });

    const openedBackup = await openBackupKeyring({
      envelope: assembly.backupKeyringEnvelope,
      recoveryWrappingKey:
        assembly.transientInitializationSecrets.recoveryWrapKey,
    });

    const backupRootRecord = requireRecordByPurpose(
      openedBackup.records,
      "root_key",
    );

    const backupRootWrappedMaterial = requireStringField(
      backupRootRecord,
      "wrappedKeyMaterial",
    );

    const tamperedLocalPlaintext = {
      ...openedLocal,
      records: openedLocal.records.map((record) => {
        if (record.purpose !== "root_key") {
          return record;
        }

        return {
          ...record,
          wrappedKeyMaterial: backupRootWrappedMaterial,
        };
      }),
    };

    const tamperedLocalEnvelope = await sealLocalKeyring({
      patientId: assembly.patientId,
      keyringId: assembly.keyringId,
      plaintext: tamperedLocalPlaintext,
      wrappingKey: assembly.transientInitializationSecrets.localUnlockKey,
    });

    await expect(
      verifyFirstVaultAssembly({
        ...assembly,
        localKeyringEnvelope: tamperedLocalEnvelope,
      }),
    ).rejects.toThrow("sealed root purpose mismatch");
  });
  it("generates random local unlock and recovery wrap keys with isolated blast radius", async () => {
    const assembly = await createVault();

    expect(
      assembly.transientInitializationSecrets.localUnlockKey.origin,
    ).toBe("random_capability_dek");
    expect(
      assembly.transientInitializationSecrets.recoveryWrapKey.origin,
    ).toBe("random_capability_dek");

    expect(assembly.transientInitializationSecrets.localUnlockKey.purpose).toBe(
      "local_keyring",
    );
    expect(assembly.transientInitializationSecrets.recoveryWrapKey.purpose).toBe(
      "keyring_backup",
    );

    expect(
      assembly.transientInitializationSecrets.localUnlockKey.rawKeyBytes
        .byteLength,
    ).toBe(32);
    expect(
      assembly.transientInitializationSecrets.recoveryWrapKey.rawKeyBytes
        .byteLength,
    ).toBe(32);
  });

  it("uses different random capability keys for different vault assemblies", async () => {
    const first = await createVault();
    const second = await createVault();

    expect(
      Array.from(
        first.transientInitializationSecrets.localUnlockKey.rawKeyBytes,
      ),
    ).not.toEqual(
      Array.from(
        second.transientInitializationSecrets.localUnlockKey.rawKeyBytes,
      ),
    );

    expect(
      Array.from(
        first.transientInitializationSecrets.recoveryWrapKey.rawKeyBytes,
      ),
    ).not.toEqual(
      Array.from(
        second.transientInitializationSecrets.recoveryWrapKey.rawKeyBytes,
      ),
    );
  });

  it("creates a local_keyring envelope with local_keyring AAD purpose", async () => {
    const assembly = await createVault();

    expect(assembly.localKeyringEnvelope.sealedEnvelope.aad.purpose).toBe(
      "local_keyring",
    );
    expect(assembly.localKeyringEnvelope.patientId).toBe("patient-001");
    expect(assembly.localKeyringEnvelope.keyringId).toBe("keyring-001");
  });

  it("creates a keyring_backup envelope with keyring_backup AAD purpose", async () => {
    const assembly = await createVault();

    expect(assembly.backupKeyringEnvelope.sealedEnvelope.aad.purpose).toBe(
      "keyring_backup",
    );
    expect(assembly.backupKeyringEnvelope.patientId).toBe("patient-001");
    expect(assembly.backupKeyringEnvelope.backupId).toBe("backup-001");
  });

    it("opens and verifies both envelopes immediately after assembly", async () => {
    const assembly = await createVault();

    const openedLocal = await openLocalKeyring({
      envelope: assembly.localKeyringEnvelope,
      wrappingKey: assembly.transientInitializationSecrets.localUnlockKey,
    });

    const openedBackup = await openBackupKeyring({
      envelope: assembly.backupKeyringEnvelope,
      recoveryWrappingKey:
        assembly.transientInitializationSecrets.recoveryWrapKey,
    });

    expect(openedLocal.patientId).toBe("patient-001");
    expect(openedBackup.patientId).toBe("patient-001");

    expect(openedLocal.keyringId).toBe("keyring-001");
    expect(openedBackup.keyringId).toBe("keyring-001");

    expect(openedLocal.keyringSchemaVersion).toBe(1);
    expect(openedBackup.keyringSchemaVersion).toBe(1);

    expect(openedLocal.rotationState).toEqual(openedBackup.rotationState);
    expect(openedLocal.derivationSalt).toBe(openedBackup.derivationSalt);

    expect(openedLocal.records).toHaveLength(3);
    expect(openedBackup.records).toHaveLength(3);

    const localRootRecord = requireRecordByPurpose(
      openedLocal.records,
      "root_key",
    );
    const backupRootRecord = requireRecordByPurpose(
      openedBackup.records,
      "root_key",
    );

    const localPayloadRecord = requireRecordByPurpose(
      openedLocal.records,
      "payload_encryption",
    );
    const backupPayloadRecord = requireRecordByPurpose(
      openedBackup.records,
      "payload_encryption",
    );

    const localBlindIndexRecord = requireRecordByPurpose(
      openedLocal.records,
      "blind_index",
    );
    const backupBlindIndexRecord = requireRecordByPurpose(
      openedBackup.records,
      "blind_index",
    );

    expect(localPayloadRecord).toEqual(backupPayloadRecord);
    expect(localBlindIndexRecord).toEqual(backupBlindIndexRecord);

    expect(localRootRecord.materialKind).toBe("sealed_root_key");
    expect(backupRootRecord.materialKind).toBe("sealed_root_key");

    expect(requireStringField(localRootRecord, "wrappedKeyMaterial")).toMatch(
      /^sealed-key-envelope-v1:/,
    );
    expect(requireStringField(backupRootRecord, "wrappedKeyMaterial")).toMatch(
      /^sealed-key-envelope-v1:/,
    );

    expect(localRootRecord.wrappedKeyMaterial).not.toBe(
      backupRootRecord.wrappedKeyMaterial,
    );

    const localRootEnvelope = deserializeSealedKeyEnvelope(
      requireStringField(localRootRecord, "wrappedKeyMaterial"),
    );
    const backupRootEnvelope = deserializeSealedKeyEnvelope(
      requireStringField(backupRootRecord, "wrappedKeyMaterial"),
    );

    expect(localRootEnvelope.sealPurpose).toBe("local_keyring_root");
    expect(backupRootEnvelope.sealPurpose).toBe("recovery_backup_root");

    expect(localRootEnvelope.sealingKeyScopeId).toBe("ks_10");
    expect(backupRootEnvelope.sealingKeyScopeId).toBe("ks_20");

    expect(assembly.verification).toEqual({
      localKeyringOpened: true,
      backupKeyringOpened: true,
      payloadKeyDerived: true,
      blindIndexKeyDerived: true,
    });
  });

  it("creates one sealed root record and two dependent derived scope records", async () => {
    const assembly = await createVault();

    const openedLocal = await openLocalKeyring({
      envelope: assembly.localKeyringEnvelope,
      wrappingKey: assembly.transientInitializationSecrets.localUnlockKey,
    });

    const purposes = openedLocal.records.map((record) => record.purpose);

    expect(openedLocal.records).toHaveLength(3);
    expect(purposes).toEqual(["root_key", "payload_encryption", "blind_index"]);

    const rootRecord = requireRecordByPurpose(openedLocal.records, "root_key");
    const payloadRecord = requireRecordByPurpose(
      openedLocal.records,
      "payload_encryption",
    );
    const blindIndexRecord = requireRecordByPurpose(
      openedLocal.records,
      "blind_index",
    );

    expect(rootRecord.materialKind).toBe("sealed_root_key");
    expect(payloadRecord.materialKind).toBe("root_derived_ref");
    expect(blindIndexRecord.materialKind).toBe("root_derived_ref");

    expect(payloadRecord.rootKeyRef).toBe("root-key-001");
    expect(blindIndexRecord.rootKeyRef).toBe("root-key-001");

    expect(payloadRecord.rootVersion).toBe(1);
    expect(blindIndexRecord.rootVersion).toBe(1);

    expect(requireStringField(rootRecord, "wrappedKeyMaterial")).toMatch(
      /^sealed-key-envelope-v1:/,
    );
    expect(payloadRecord.wrappedKeyMaterial).toBe("root-ref:root-key-001:v1");
    expect(blindIndexRecord.wrappedKeyMaterial).toBe(
      "root-ref:root-key-001:v1",
    );
  });

  it("uses sealed root envelopes instead of placeholder root descriptors", async () => {
    const assembly = await createVault();

    const openedLocal = await openLocalKeyring({
      envelope: assembly.localKeyringEnvelope,
      wrappingKey: assembly.transientInitializationSecrets.localUnlockKey,
    });

    const rootRecord = requireRecordByPurpose(openedLocal.records, "root_key");
    const serializedRootEnvelope = requireStringField(
      rootRecord,
      "wrappedKeyMaterial",
    );

    expect(serializedRootEnvelope).toMatch(/^sealed-key-envelope-v1:/);
    expect(serializedRootEnvelope).not.toContain("sealed:root-version");
    expect(serializedRootEnvelope).not.toContain("raw");
    expect(serializedRootEnvelope).not.toContain("K_root");
    expect(serializedRootEnvelope).not.toContain("K_master");
  });

  it("does not expose semantic clinical labels in encrypted scope metadata", async () => {
    const assembly = await createVault();

    const openedLocal = await openLocalKeyring({
      envelope: assembly.localKeyringEnvelope,
      wrappingKey: assembly.transientInitializationSecrets.localUnlockKey,
    });

    for (const record of openedLocal.records) {
      const metadata = record.encryptedScopeMetadata.toLowerCase();

      expect(metadata).toMatch(/^sealed:opaque-scope-metadata:/);
      expect(metadata).not.toContain("general care");
      expect(metadata).not.toContain("mental");
      expect(metadata).not.toContain("psychiatric");
      expect(metadata).not.toContain("reproductive");
      expect(metadata).not.toContain("oncology");
      expect(metadata).not.toContain("hiv");
      expect(metadata).not.toContain("diabetes");
      expect(metadata).not.toContain("domain/general");
    }
  });

  it("does not expose raw initialization secrets in serialized envelopes", async () => {
    const assembly = await createVault();

    expectNoInitializationSecretLeak(assembly.localKeyringEnvelope);
    expectNoInitializationSecretLeak(assembly.backupKeyringEnvelope);
  });

  it("does not expose caregiver or emergency capability records during first-vault creation", async () => {
    const assembly = await createVault();

    const localSerialized = serialized(assembly.localKeyringEnvelope);
    const backupSerialized = serialized(assembly.backupKeyringEnvelope);

    expect(localSerialized).not.toContain("caregiver_adherence");
    expect(localSerialized).not.toContain("emergency_card");
    expect(backupSerialized).not.toContain("caregiver_adherence");
    expect(backupSerialized).not.toContain("emergency_card");
  });

  it("rejects semantic keyScopeId values before vault assembly", async () => {
    await expect(
      initializeFirstPatientVault({
        patientId: "patient-001",
        keyringId: "keyring-001",
        backupId: "backup-001",
        keyScopes: {
          ...safeKeyScopes,
          payloadEncryptionKeyScopeId: "ks_mental_health",
        },
      }),
    ).rejects.toThrow("derivation scope must be non-semantic");
  });

  it("rejects empty identifiers", async () => {
    await expect(
      initializeFirstPatientVault({
        patientId: "",
        keyringId: "keyring-001",
        backupId: "backup-001",
        keyScopes: safeKeyScopes,
      }),
    ).rejects.toThrow("patientId must not be empty");

    await expect(
      initializeFirstPatientVault({
        patientId: "patient-001",
        keyringId: "",
        backupId: "backup-001",
        keyScopes: safeKeyScopes,
      }),
    ).rejects.toThrow("keyringId must not be empty");

    await expect(
      initializeFirstPatientVault({
        patientId: "patient-001",
        keyringId: "keyring-001",
        backupId: "",
        keyScopes: safeKeyScopes,
      }),
    ).rejects.toThrow("backupId must not be empty");
  });

  it("rejects a tampered local envelope during explicit verification", async () => {
    const assembly = await createVault();

    const tamperedLocalEnvelope: LocalKeyringEnvelope = {
      ...assembly.localKeyringEnvelope,
      patientId: "patient-999",
    };

    await expect(
      verifyFirstVaultAssembly({
        ...assembly,
        localKeyringEnvelope: tamperedLocalEnvelope,
      }),
    ).rejects.toThrow("local keyring metadata mismatch");
  });

  it("rejects a tampered backup envelope during explicit verification", async () => {
    const assembly = await createVault();

    const tamperedBackupEnvelope: BackupKeyringEnvelope = {
      ...assembly.backupKeyringEnvelope,
      backupId: "backup-999",
    };

    await expect(
      verifyFirstVaultAssembly({
        ...assembly,
        backupKeyringEnvelope: tamperedBackupEnvelope,
      }),
    ).rejects.toThrow("backup keyring metadata mismatch");
  });

  it("returns frozen assembly objects to prevent accidental mutation", async () => {
    const assembly = await createVault();

    expect(Object.isFrozen(assembly)).toBe(true);
    expect(Object.isFrozen(assembly.keyScopes)).toBe(true);
    expect(Object.isFrozen(assembly.verification)).toBe(true);
    expect(Object.isFrozen(assembly.transientInitializationSecrets)).toBe(true);
  });

  it("does not serialize transient initialization secrets when the whole assembly is stringified", async () => {
    const assembly = await createVault();

    const output = serialized(assembly);
    const serializedSecrets = serialized(
      assembly.transientInitializationSecrets,
    );

    expect(serializedSecrets).toBe("{}");

    expect(output).not.toContain("rawkeybytes");
    expect(output).not.toContain("random_capability_dek");
    expect(output).not.toContain('"localunlockkey":');
    expect(output).not.toContain('"recoverywrapkey":');
  });

  it("keeps transient initialization secrets directly accessible but non-enumerable", async () => {
    const assembly = await createVault();

    expect(
      assembly.transientInitializationSecrets.localUnlockKey.rawKeyBytes
        .byteLength,
    ).toBe(32);

    expect(
      assembly.transientInitializationSecrets.recoveryWrapKey.rawKeyBytes
        .byteLength,
    ).toBe(32);

    expect(Object.keys(assembly.transientInitializationSecrets)).toEqual([]);
  });

  it("stores derivation salt only inside opened keyring plaintext", async () => {
    const assembly = await createVault();

    const openedLocal = await openLocalKeyring({
      envelope: assembly.localKeyringEnvelope,
      wrappingKey: assembly.transientInitializationSecrets.localUnlockKey,
    });

    const openedBackup = await openBackupKeyring({
      envelope: assembly.backupKeyringEnvelope,
      recoveryWrappingKey:
        assembly.transientInitializationSecrets.recoveryWrapKey,
    });

    const localDerivationSalt = requireStringField(
      openedLocal as unknown as Record<string, unknown>,
      "derivationSalt",
    );
    const backupDerivationSalt = requireStringField(
      openedBackup as unknown as Record<string, unknown>,
      "derivationSalt",
    );

    expect(localDerivationSalt).toMatch(/^salt-v1:/);
    expect(backupDerivationSalt).toBe(localDerivationSalt);
    expect(decodeDerivationSalt(localDerivationSalt).byteLength).toBe(32);

    expect(serialized(assembly.localKeyringEnvelope)).not.toContain("salt-v1:");
    expect(serialized(assembly.backupKeyringEnvelope)).not.toContain("salt-v1:");
  });

  it("creates purpose-bound local and backup sealed root envelopes", async () => {
    const assembly = await createVault();

    const openedLocal = await openLocalKeyring({
      envelope: assembly.localKeyringEnvelope,
      wrappingKey: assembly.transientInitializationSecrets.localUnlockKey,
    });

    const openedBackup = await openBackupKeyring({
      envelope: assembly.backupKeyringEnvelope,
      recoveryWrappingKey:
        assembly.transientInitializationSecrets.recoveryWrapKey,
    });

    const localRootRecord = requireRecordByPurpose(
      openedLocal.records,
      "root_key",
    );
    const backupRootRecord = requireRecordByPurpose(
      openedBackup.records,
      "root_key",
    );

    const localRootEnvelope = deserializeSealedKeyEnvelope(
      requireStringField(localRootRecord, "wrappedKeyMaterial"),
    );
    const backupRootEnvelope = deserializeSealedKeyEnvelope(
      requireStringField(backupRootRecord, "wrappedKeyMaterial"),
    );

    expect(localRootEnvelope.sealPurpose).toBe("local_keyring_root");
    expect(backupRootEnvelope.sealPurpose).toBe("recovery_backup_root");

    expect(localRootEnvelope.sealedKeyId).toBe("root-key-001");
    expect(backupRootEnvelope.sealedKeyId).toBe("root-key-001");

    expect(localRootEnvelope.ciphertext).not.toBe(backupRootEnvelope.ciphertext);
    expect(localRootEnvelope.iv).not.toBe(backupRootEnvelope.iv);
  });

  it("unseals local and backup root keys and confirms they match", async () => {
    const assembly = await createVault();

    const openedLocal = await openLocalKeyring({
      envelope: assembly.localKeyringEnvelope,
      wrappingKey: assembly.transientInitializationSecrets.localUnlockKey,
    });

    const openedBackup = await openBackupKeyring({
      envelope: assembly.backupKeyringEnvelope,
      recoveryWrappingKey:
        assembly.transientInitializationSecrets.recoveryWrapKey,
    });

    const localRootRecord = requireRecordByPurpose(
      openedLocal.records,
      "root_key",
    );
    const backupRootRecord = requireRecordByPurpose(
      openedBackup.records,
      "root_key",
    );

    const localRootEnvelope = deserializeSealedKeyEnvelope(
      requireStringField(localRootRecord, "wrappedKeyMaterial"),
    );
    const backupRootEnvelope = deserializeSealedKeyEnvelope(
      requireStringField(backupRootRecord, "wrappedKeyMaterial"),
    );

    const localRoot = await unsealRawKeyMaterial({
      envelope: localRootEnvelope,
      sealingKey: assembly.transientInitializationSecrets.localUnlockKey,
    });

    const backupRoot = await unsealRawKeyMaterial({
      envelope: backupRootEnvelope,
      sealingKey: assembly.transientInitializationSecrets.recoveryWrapKey,
    });

    expect(localRoot.keyType).toBe("root_key");
    expect(backupRoot.keyType).toBe("root_key");
    expect(bytesToHex(localRoot.rawKeyBytes)).toBe(
      bytesToHex(backupRoot.rawKeyBytes),
    );
  });

  it("re-derives payload and blind-index keys from unsealed root and sealed-in derivation salt", async () => {
    const assembly = await createVault();

    const openedLocal = await openLocalKeyring({
      envelope: assembly.localKeyringEnvelope,
      wrappingKey: assembly.transientInitializationSecrets.localUnlockKey,
    });

    const rootRecord = requireRecordByPurpose(openedLocal.records, "root_key");
    const payloadRecord = requireRecordByPurpose(
      openedLocal.records,
      "payload_encryption",
    );
    const blindIndexRecord = requireRecordByPurpose(
      openedLocal.records,
      "blind_index",
    );

    const localRootEnvelope = deserializeSealedKeyEnvelope(
      requireStringField(rootRecord, "wrappedKeyMaterial"),
    );

    const localRoot = await unsealRawKeyMaterial({
      envelope: localRootEnvelope,
      sealingKey: assembly.transientInitializationSecrets.localUnlockKey,
    });

    const rootKey: RootKeyMaterial = {
      rootVersion: requireNumberField(payloadRecord, "rootVersion"),
      rawRootKeyBytes: localRoot.rawKeyBytes,
    };

    const patientSaltBytes = decodeDerivationSalt(
      requireStringField(
        openedLocal as unknown as Record<string, unknown>,
        "derivationSalt",
      ),
    );

    const payloadKey = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes,
      keyScopeId: requireStringField(payloadRecord, "keyScopeId"),
      keyVersion: requireNumberField(payloadRecord, "keyVersion"),
      purpose: "payload_encryption",
    });

    const blindIndexKey = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes,
      keyScopeId: requireStringField(blindIndexRecord, "keyScopeId"),
      keyVersion: requireNumberField(blindIndexRecord, "keyVersion"),
      purpose: "blind_index",
    });

    expect(payloadKey.rawKeyBytes.byteLength).toBe(32);
    expect(blindIndexKey.rawKeyBytes.byteLength).toBe(32);
    expect(bytesToHex(payloadKey.rawKeyBytes)).not.toBe(
      bytesToHex(blindIndexKey.rawKeyBytes),
    );
  });
});
