import { describe, expect, it } from "vitest";

import {
  assertNoForbiddenKeyringPlaintext,
  openBackupKeyring,
  openLocalKeyring,
  sealBackupKeyring,
  sealLocalKeyring,
  type BackupKeyringEnvelope,
  type KeyringPlaintextV1,
  type KeyringWrappingKey,
  type LocalKeyringEnvelope,
} from "../encryptedKeyringStore";

const localUnlockKey: KeyringWrappingKey = {
  keyVersion: 1,
  keyScopeId: "ks_10",
  rawKeyBytes: new Uint8Array(32).fill(11),
};

const recoveryWrapKey: KeyringWrappingKey = {
  keyVersion: 1,
  keyScopeId: "ks_20",
  rawKeyBytes: new Uint8Array(32).fill(22),
};

const wrongWrapKey: KeyringWrappingKey = {
  keyVersion: 1,
  keyScopeId: "ks_10",
  rawKeyBytes: new Uint8Array(32).fill(99),
};

const safeKeyring: KeyringPlaintextV1 = {
  keyringSchemaVersion: 1,
  patientId: "patient-001",
  keyringId: "keyring-001",
  records: [
    {
      keyScopeId: "ks_01",
      keyVersion: 1,
      purpose: "payload_encryption",
      status: "active",
      exportability: "non_exportable",
      createdFor: "patient_vault",
      wrappedKeyMaterial: "wrapped:payload-key-v1",
      encryptedScopeMetadata: "sealed:opaque-scope-metadata",
    },
    {
      keyScopeId: "ks_02",
      keyVersion: 1,
      purpose: "caregiver_adherence",
      status: "active",
      exportability: "wrapped_only",
      createdFor: "caregiver_projection",
      wrappedKeyMaterial: "wrapped:caregiver-adherence-key-v1",
      encryptedScopeMetadata: "sealed:caregiver-scope-metadata",
    },
  ],
  rotationState: {
    activeRootVersion: 1,
    latestKeyringMutation: 1,
  },
};

describe("Encrypted local keyring storage boundary contract", () => {
  it("seals a local keyring envelope without exposing plaintext key material", async () => {
    const envelope = await sealLocalKeyring({
      patientId: "patient-001",
      keyringId: "keyring-001",
      plaintext: safeKeyring,
      wrappingKey: localUnlockKey,
    });

    expect(envelope.storageKind).toBe("local_keyring");
    expect(envelope.keyringId).toBe("keyring-001");
    expect(envelope.patientId).toBe("patient-001");
    expect(envelope.sealedEnvelope.aad.purpose).toBe("local_keyring");

    const serialized = JSON.stringify(envelope);

    expect(serialized).not.toContain("wrapped:payload-key-v1");
    expect(serialized).not.toContain("wrapped:caregiver-adherence-key-v1");
    expect(serialized).not.toContain("payload_encryption");
    expect(serialized).not.toContain("caregiver_adherence");
    expect(serialized).not.toContain("patient_vault");
    expect(serialized).not.toContain("caregiver_projection");
  });

  it("opens a valid local keyring envelope with the correct local unlock key", async () => {
    const envelope = await sealLocalKeyring({
      patientId: "patient-001",
      keyringId: "keyring-001",
      plaintext: safeKeyring,
      wrappingKey: localUnlockKey,
    });

    const opened = await openLocalKeyring({
      envelope,
      wrappingKey: localUnlockKey,
    });

    expect(opened).toEqual(safeKeyring);
  });

  it("rejects opening a local keyring envelope with the wrong key bytes", async () => {
    const envelope = await sealLocalKeyring({
      patientId: "patient-001",
      keyringId: "keyring-001",
      plaintext: safeKeyring,
      wrappingKey: localUnlockKey,
    });

    await expect(
      openLocalKeyring({
        envelope,
        wrappingKey: wrongWrapKey,
      }),
    ).rejects.toThrow("envelope authentication failed");
  });

  it("seals a backup keyring envelope under recovery-wrap purpose", async () => {
    const backupEnvelope = await sealBackupKeyring({
      patientId: "patient-001",
      backupId: "backup-001",
      plaintext: safeKeyring,
      recoveryWrappingKey: recoveryWrapKey,
    });

    expect(backupEnvelope.storageKind).toBe("keyring_backup");
    expect(backupEnvelope.backupId).toBe("backup-001");
    expect(backupEnvelope.patientId).toBe("patient-001");
    expect(backupEnvelope.sealedEnvelope.aad.purpose).toBe("keyring_backup");

    const serialized = JSON.stringify(backupEnvelope);

    expect(serialized).not.toContain("wrapped:payload-key-v1");
    expect(serialized).not.toContain("wrapped:caregiver-adherence-key-v1");
    expect(serialized).not.toContain("payload_encryption");
    expect(serialized).not.toContain("caregiver_adherence");
  });

  it("opens a valid backup keyring envelope with the correct recovery wrapping key", async () => {
    const backupEnvelope = await sealBackupKeyring({
      patientId: "patient-001",
      backupId: "backup-001",
      plaintext: safeKeyring,
      recoveryWrappingKey: recoveryWrapKey,
    });

    const opened = await openBackupKeyring({
      envelope: backupEnvelope,
      recoveryWrappingKey: recoveryWrapKey,
    });

    expect(opened).toEqual(safeKeyring);
  });

  it("rejects using a backup envelope as a local keyring envelope", async () => {
    const backupEnvelope = await sealBackupKeyring({
      patientId: "patient-001",
      backupId: "backup-001",
      plaintext: safeKeyring,
      recoveryWrappingKey: recoveryWrapKey,
    });

    await expect(
      openLocalKeyring({
        envelope: backupEnvelope as unknown as LocalKeyringEnvelope,
        wrappingKey: localUnlockKey,
      }),
    ).rejects.toThrow("local keyring envelope required");
  });

  it("rejects using a local envelope as a backup keyring envelope", async () => {
    const localEnvelope = await sealLocalKeyring({
      patientId: "patient-001",
      keyringId: "keyring-001",
      plaintext: safeKeyring,
      wrappingKey: localUnlockKey,
    });

    await expect(
      openBackupKeyring({
        envelope: localEnvelope as unknown as BackupKeyringEnvelope,
        recoveryWrappingKey: recoveryWrapKey,
      }),
    ).rejects.toThrow("backup keyring envelope required");
  });

    it("rejects tampered patientId AAD for local keyring envelopes", async () => {
    const envelope = await sealLocalKeyring({
      patientId: "patient-001",
      keyringId: "keyring-001",
      plaintext: safeKeyring,
      wrappingKey: localUnlockKey,
    });

    const tamperedEnvelope: LocalKeyringEnvelope = {
      ...envelope,
      patientId: "patient-999",
      sealedEnvelope: {
        ...envelope.sealedEnvelope,
        aad: {
          ...envelope.sealedEnvelope.aad,
          patientId: "patient-999",
        },
      },
    };

    await expect(
      openLocalKeyring({
        envelope: tamperedEnvelope,
        wrappingKey: localUnlockKey,
      }),
    ).rejects.toThrow("envelope authentication failed");
  });

  it("rejects plaintext keyring data containing raw master key markers", () => {
    const unsafeKeyring: KeyringPlaintextV1 = {
      ...safeKeyring,
      records: [
        {
          ...safeKeyring.records[0],
          wrappedKeyMaterial: "raw K_master: do-not-store",
        },
      ],
    };

    expect(() => assertNoForbiddenKeyringPlaintext(unsafeKeyring)).toThrow(
      "forbidden keyring plaintext",
    );
  });

  it("rejects plaintext keyring data containing clinical domain labels", () => {
    const unsafeKeyring: KeyringPlaintextV1 = {
      ...safeKeyring,
      records: [
        {
          ...safeKeyring.records[0],
          encryptedScopeMetadata: "mental-health scope metadata",
        },
      ],
    };

    expect(() => assertNoForbiddenKeyringPlaintext(unsafeKeyring)).toThrow(
      "forbidden keyring plaintext",
    );
  });

  it("rejects plaintext keyring data containing HKDF info strings", () => {
    const unsafeKeyring: KeyringPlaintextV1 = {
      ...safeKeyring,
      records: [
        {
          ...safeKeyring.records[0],
          encryptedScopeMetadata: "domain/general/v1",
        },
      ],
    };

    expect(() => assertNoForbiddenKeyringPlaintext(unsafeKeyring)).toThrow(
      "forbidden keyring plaintext",
    );
  });

  it("freezes local and backup envelopes to prevent accidental mutation", async () => {
    const localEnvelope = await sealLocalKeyring({
      patientId: "patient-001",
      keyringId: "keyring-001",
      plaintext: safeKeyring,
      wrappingKey: localUnlockKey,
    });

    const backupEnvelope = await sealBackupKeyring({
      patientId: "patient-001",
      backupId: "backup-001",
      plaintext: safeKeyring,
      recoveryWrappingKey: recoveryWrapKey,
    });

    expect(Object.isFrozen(localEnvelope)).toBe(true);
    expect(Object.isFrozen(backupEnvelope)).toBe(true);
    expect(Object.isFrozen(localEnvelope.sealedEnvelope)).toBe(true);
    expect(Object.isFrozen(backupEnvelope.sealedEnvelope)).toBe(true);
  });
  it("rejects local envelopes when outer patientId does not match sealed AAD", async () => {
    const envelope = await sealLocalKeyring({
      patientId: "patient-001",
      keyringId: "keyring-001",
      plaintext: safeKeyring,
      wrappingKey: localUnlockKey,
    });

    const tamperedEnvelope: LocalKeyringEnvelope = {
      ...envelope,
      patientId: "patient-999",
    };

    await expect(
      openLocalKeyring({
        envelope: tamperedEnvelope,
        wrappingKey: localUnlockKey,
      }),
    ).rejects.toThrow("local keyring metadata mismatch");
  });

  it("rejects local envelopes when outer keyringId does not match sealed AAD recordId", async () => {
    const envelope = await sealLocalKeyring({
      patientId: "patient-001",
      keyringId: "keyring-001",
      plaintext: safeKeyring,
      wrappingKey: localUnlockKey,
    });

    const tamperedEnvelope: LocalKeyringEnvelope = {
      ...envelope,
      keyringId: "keyring-999",
    };

    await expect(
      openLocalKeyring({
        envelope: tamperedEnvelope,
        wrappingKey: localUnlockKey,
      }),
    ).rejects.toThrow("local keyring metadata mismatch");
  });

  it("rejects backup envelopes when outer backupId does not match sealed AAD recordId", async () => {
    const backupEnvelope = await sealBackupKeyring({
      patientId: "patient-001",
      backupId: "backup-001",
      plaintext: safeKeyring,
      recoveryWrappingKey: recoveryWrapKey,
    });

    const tamperedEnvelope: BackupKeyringEnvelope = {
      ...backupEnvelope,
      backupId: "backup-999",
    };

    await expect(
      openBackupKeyring({
        envelope: tamperedEnvelope,
        recoveryWrappingKey: recoveryWrapKey,
      }),
    ).rejects.toThrow("backup keyring metadata mismatch");
  });
});