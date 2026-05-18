import { describe, expect, it } from "vitest";

import {
  assertNoForbiddenSealedKeyMetadata,
  sealRawKeyMaterial,
  unsealRawKeyMaterial,
  type RawKeyMaterial,
  type SealedKeyEnvelopeV1,
  type SealingKeyMaterial,
} from "../sealedKeyEnvelope";

const rootKeyMaterial: RawKeyMaterial = {
  keyId: "root-key-001",
  keyType: "root_key",
  keyScopeId: "ks_root_01",
  keyVersion: 1,
  rawKeyBytes: new Uint8Array(32).fill(41),
};

const localSealingKey: SealingKeyMaterial = {
  keyScopeId: "ks_10",
  keyVersion: 1,
  rawKeyBytes: new Uint8Array(32).fill(11),
};

const recoverySealingKey: SealingKeyMaterial = {
  keyScopeId: "ks_20",
  keyVersion: 1,
  rawKeyBytes: new Uint8Array(32).fill(22),
};

const wrongSealingKey: SealingKeyMaterial = {
  keyScopeId: "ks_10",
  keyVersion: 1,
  rawKeyBytes: new Uint8Array(32).fill(99),
};

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function serialized(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

function expectNoSecretLeak(envelope: SealedKeyEnvelopeV1): void {
  const output = serialized(envelope);

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
  ];

  for (const token of forbiddenTokens) {
    expect(output).not.toContain(token);
  }
}

async function sealLocalRoot(): Promise<SealedKeyEnvelopeV1> {
  return sealRawKeyMaterial({
    patientId: "patient-001",
    keyringId: "keyring-001",
    rawKeyMaterial: rootKeyMaterial,
    sealingKey: localSealingKey,
    sealPurpose: "local_keyring_root",
  });
}

async function sealRecoveryRoot(): Promise<SealedKeyEnvelopeV1> {
  return sealRawKeyMaterial({
    patientId: "patient-001",
    keyringId: "keyring-001",
    rawKeyMaterial: rootKeyMaterial,
    sealingKey: recoverySealingKey,
    sealPurpose: "recovery_backup_root",
  });
}

describe("AES-GCM sealed key envelope contract", () => {
  it("seals K_root_v1 under local_keyring_root purpose", async () => {
    const envelope = await sealLocalRoot();

    expect(envelope.sealedKeyEnvelopeVersion).toBe(1);
    expect(envelope.cryptoSuite).toBe("AES-256-GCM");
    expect(envelope.patientId).toBe("patient-001");
    expect(envelope.keyringId).toBe("keyring-001");
    expect(envelope.sealedKeyId).toBe("root-key-001");
    expect(envelope.sealedKeyType).toBe("root_key");
    expect(envelope.sealedKeyScopeId).toBe("ks_root_01");
    expect(envelope.sealedKeyVersion).toBe(1);
    expect(envelope.sealingKeyScopeId).toBe("ks_10");
    expect(envelope.sealingKeyVersion).toBe(1);
    expect(envelope.sealPurpose).toBe("local_keyring_root");

    expect(envelope.iv.trim().length).toBeGreaterThan(0);
    expect(envelope.tag.length).toBeGreaterThan(0);
    expect(envelope.ciphertext.length).toBeGreaterThan(0);

    expect(envelope.aad.sealPurpose).toBe("local_keyring_root");
    expect(envelope.aad.patientId).toBe("patient-001");
    expect(envelope.aad.keyringId).toBe("keyring-001");
  });

  it("seals K_root_v1 under recovery_backup_root purpose", async () => {
    const envelope = await sealRecoveryRoot();

    expect(envelope.sealPurpose).toBe("recovery_backup_root");
    expect(envelope.aad.sealPurpose).toBe("recovery_backup_root");
    expect(envelope.sealingKeyScopeId).toBe("ks_20");
    expect(envelope.sealingKeyVersion).toBe(1);
  });

  it("unseals valid local root key material", async () => {
    const envelope = await sealLocalRoot();

    const unsealed = await unsealRawKeyMaterial({
      envelope,
      sealingKey: localSealingKey,
    });

    expect(unsealed.keyId).toBe("root-key-001");
    expect(unsealed.keyType).toBe("root_key");
    expect(unsealed.keyScopeId).toBe("ks_root_01");
    expect(unsealed.keyVersion).toBe(1);
    expect(unsealed.rawKeyBytes).toBeInstanceOf(Uint8Array);
    expect(unsealed.rawKeyBytes.byteLength).toBe(32);
    expect(bytesToHex(unsealed.rawKeyBytes)).toBe(
      bytesToHex(rootKeyMaterial.rawKeyBytes),
    );
  });

  it("unseals valid recovery root key material", async () => {
    const envelope = await sealRecoveryRoot();

    const unsealed = await unsealRawKeyMaterial({
      envelope,
      sealingKey: recoverySealingKey,
    });

    expect(unsealed.keyType).toBe("root_key");
    expect(bytesToHex(unsealed.rawKeyBytes)).toBe(
      bytesToHex(rootKeyMaterial.rawKeyBytes),
    );
  });

  it("uses a fresh IV and different ciphertext for repeated sealing", async () => {
    const first = await sealLocalRoot();
    const second = await sealLocalRoot();

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(first.tag).not.toBe(second.tag);
  });

  it("rejects unsealing with the wrong sealing key bytes", async () => {
    const envelope = await sealLocalRoot();

    await expect(
      unsealRawKeyMaterial({
        envelope,
        sealingKey: wrongSealingKey,
      }),
    ).rejects.toThrow("sealed key authentication failed");
  });

  it("rejects tampered patientId AAD with generic authentication failure", async () => {
    const envelope = await sealLocalRoot();

    const tamperedEnvelope: SealedKeyEnvelopeV1 = {
      ...envelope,
      patientId: "patient-999",
      aad: {
        ...envelope.aad,
        patientId: "patient-999",
      },
    };

    await expect(
      unsealRawKeyMaterial({
        envelope: tamperedEnvelope,
        sealingKey: localSealingKey,
      }),
    ).rejects.toThrow("sealed key authentication failed");
  });

  it("rejects tampered keyringId AAD with generic authentication failure", async () => {
    const envelope = await sealLocalRoot();

    const tamperedEnvelope: SealedKeyEnvelopeV1 = {
      ...envelope,
      keyringId: "keyring-999",
      aad: {
        ...envelope.aad,
        keyringId: "keyring-999",
      },
    };

    await expect(
      unsealRawKeyMaterial({
        envelope: tamperedEnvelope,
        sealingKey: localSealingKey,
      }),
    ).rejects.toThrow("sealed key authentication failed");
  });

  it("rejects tampered sealedKeyVersion AAD with generic authentication failure", async () => {
    const envelope = await sealLocalRoot();

    const tamperedEnvelope: SealedKeyEnvelopeV1 = {
      ...envelope,
      sealedKeyVersion: 2,
      aad: {
        ...envelope.aad,
        sealedKeyVersion: 2,
      },
    };

    await expect(
      unsealRawKeyMaterial({
        envelope: tamperedEnvelope,
        sealingKey: localSealingKey,
      }),
    ).rejects.toThrow("sealed key authentication failed");
  });

  it("rejects local sealed root relabeled as recovery sealed root", async () => {
    const envelope = await sealLocalRoot();

    const tamperedEnvelope: SealedKeyEnvelopeV1 = {
      ...envelope,
      sealPurpose: "recovery_backup_root",
      sealingKeyScopeId: recoverySealingKey.keyScopeId,
      sealingKeyVersion: recoverySealingKey.keyVersion,
      aad: {
        ...envelope.aad,
        sealPurpose: "recovery_backup_root",
        sealingKeyScopeId: recoverySealingKey.keyScopeId,
        sealingKeyVersion: recoverySealingKey.keyVersion,
      },
    };

    await expect(
      unsealRawKeyMaterial({
        envelope: tamperedEnvelope,
        sealingKey: recoverySealingKey,
      }),
    ).rejects.toThrow("sealed key authentication failed");
  });

  it("rejects malformed sealed key envelopes with missing ciphertext", async () => {
    const envelope = await sealLocalRoot();

    const malformedEnvelope: SealedKeyEnvelopeV1 = {
      ...envelope,
      ciphertext: "",
    };

    await expect(
      unsealRawKeyMaterial({
        envelope: malformedEnvelope,
        sealingKey: localSealingKey,
      }),
    ).rejects.toThrow("malformed sealed key envelope");
  });

  it("rejects unsupported sealed key type", async () => {
    const unsafeMaterial: RawKeyMaterial = {
      ...rootKeyMaterial,
      keyType: "capability_dek" as RawKeyMaterial["keyType"],
    };

    await expect(
      sealRawKeyMaterial({
        patientId: "patient-001",
        keyringId: "keyring-001",
        rawKeyMaterial: unsafeMaterial,
        sealingKey: localSealingKey,
        sealPurpose: "local_keyring_root",
      }),
    ).rejects.toThrow("unsupported sealed key type");
  });

  it("does not expose raw K_root or sealing keys in serialized envelope", async () => {
    const envelope = await sealLocalRoot();

    expectNoSecretLeak(envelope);
    expect(serialized(envelope)).not.toContain("rawkeybytes");
    expect(serialized(envelope)).not.toContain("414141");
    expect(serialized(envelope)).not.toContain("111111");
  });

  it("rejects forbidden clinical labels in sealed key metadata", () => {
    const unsafeEnvelope: SealedKeyEnvelopeV1 = {
      sealedKeyEnvelopeVersion: 1,
      cryptoSuite: "AES-256-GCM",
      patientId: "patient-001",
      keyringId: "keyring-001",
      sealedKeyId: "mental-health-root",
      sealedKeyType: "root_key",
      sealedKeyScopeId: "ks_mental",
      sealedKeyVersion: 1,
      sealingKeyScopeId: "ks_10",
      sealingKeyVersion: 1,
      sealPurpose: "local_keyring_root",
      iv: "iv",
      tag: "tag",
      ciphertext: "ciphertext",
      aad: {
        sealedKeyEnvelopeVersion: 1,
        cryptoSuite: "AES-256-GCM",
        patientId: "patient-001",
        keyringId: "keyring-001",
        sealedKeyId: "mental-health-root",
        sealedKeyType: "root_key",
        sealedKeyScopeId: "ks_mental",
        sealedKeyVersion: 1,
        sealingKeyScopeId: "ks_10",
        sealingKeyVersion: 1,
        sealPurpose: "local_keyring_root",
      },
    };

    expect(() => assertNoForbiddenSealedKeyMetadata(unsafeEnvelope)).toThrow(
      "forbidden sealed key metadata",
    );
  });

  it("returns frozen sealed envelopes and frozen AAD", async () => {
    const envelope = await sealLocalRoot();

    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.aad)).toBe(true);
  });

  it("does not return partial key material after authentication failure", async () => {
    const envelope = await sealLocalRoot();

    await expect(
      unsealRawKeyMaterial({
        envelope,
        sealingKey: wrongSealingKey,
      }),
    ).rejects.toThrow("sealed key authentication failed");
  });
    it("rejects semantic sealed key scope identifiers even without other clinical labels", () => {
    const unsafeEnvelope: SealedKeyEnvelopeV1 = {
      sealedKeyEnvelopeVersion: 1,
      cryptoSuite: "AES-256-GCM",
      patientId: "patient-001",
      keyringId: "keyring-001",
      sealedKeyId: "root-key-001",
      sealedKeyType: "root_key",
      sealedKeyScopeId: "ks_mental",
      sealedKeyVersion: 1,
      sealingKeyScopeId: "ks_10",
      sealingKeyVersion: 1,
      sealPurpose: "local_keyring_root",
      iv: "iv",
      tag: "tag",
      ciphertext: "ciphertext",
      aad: {
        sealedKeyEnvelopeVersion: 1,
        cryptoSuite: "AES-256-GCM",
        patientId: "patient-001",
        keyringId: "keyring-001",
        sealedKeyId: "root-key-001",
        sealedKeyType: "root_key",
        sealedKeyScopeId: "ks_mental",
        sealedKeyVersion: 1,
        sealingKeyScopeId: "ks_10",
        sealingKeyVersion: 1,
        sealPurpose: "local_keyring_root",
      },
    };

    expect(() => assertNoForbiddenSealedKeyMetadata(unsafeEnvelope)).toThrow(
      "forbidden sealed key metadata",
    );
  });
});