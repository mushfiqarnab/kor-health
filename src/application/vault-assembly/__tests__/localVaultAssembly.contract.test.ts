import { describe, expect, it } from "vitest";

import {
  initializeFirstPatientVault,
  verifyFirstVaultAssembly,
  type FirstVaultAssemblyResult,
  type InitialVaultKeyScopeInput,
} from "../localVaultAssembly";

import {
  openBackupKeyring,
  openLocalKeyring,
  type BackupKeyringEnvelope,
  type LocalKeyringEnvelope,
} from "../../../infrastructure/keyring-storage/encryptedKeyringStore";

function serialized(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

function expectNoInitializationSecretLeak(value: unknown): void {
  const output = serialized(value);

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
    "mental-health",
    "mental health",
    "psychiatric",
    "reproductive",
    "oncology",
    "hiv",
    "diabetes",
    "nid",
    "e-tin",
    "phone number",
    "caregiver_adherence",
    "emergency_card",
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

    expect(openedLocal).toEqual(openedBackup);
    expect(openedLocal.patientId).toBe("patient-001");
    expect(openedLocal.keyringId).toBe("keyring-001");
    expect(openedLocal.keyringSchemaVersion).toBe(1);
    expect(openedLocal.rotationState.activeRootVersion).toBe(1);
    expect(openedLocal.records).toHaveLength(2);
  });

  it("creates only initial payload and blind-index records", async () => {
    const assembly = await createVault();

    const openedLocal = await openLocalKeyring({
      envelope: assembly.localKeyringEnvelope,
      wrappingKey: assembly.transientInitializationSecrets.localUnlockKey,
    });

    const purposes = openedLocal.records.map((record) => record.purpose);

    expect(purposes).toEqual(["payload_encryption", "blind_index"]);
    expect(purposes).not.toContain("caregiver_adherence");
    expect(purposes).not.toContain("emergency_card");
  });

  it("uses opaque sealed material descriptors instead of raw root-key material", async () => {
    const assembly = await createVault();

    const openedLocal = await openLocalKeyring({
      envelope: assembly.localKeyringEnvelope,
      wrappingKey: assembly.transientInitializationSecrets.localUnlockKey,
    });

    for (const record of openedLocal.records) {
      expect(record.wrappedKeyMaterial).toMatch(/^sealed:root-version:1:scope:/);
      expect(record.wrappedKeyMaterial).not.toContain("raw");
      expect(record.wrappedKeyMaterial).not.toContain("K_root");
      expect(record.wrappedKeyMaterial).not.toContain("K_master");
    }
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
});
