import { describe, expect, it } from "vitest";

import {
  assertKeyMaterialPurposeAllowed,
  assertNonSemanticDerivationScope,
  deriveRootScopedKey,
  generateCapabilityDek,
  type CapabilityDekPurpose,
  type KeyMaterialPurpose,
  type RootKeyMaterial,
  type RootScopedKeyPurpose,
} from "../keyMaterialFactory";

const rootKey: RootKeyMaterial = {
  rootVersion: 1,
  rawRootKeyBytes: new Uint8Array(32).fill(31),
};

const patientSaltBytes = new Uint8Array(32).fill(17);

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

describe("Key Material Factory contract", () => {
  it("derives deterministic root-scoped payload encryption keys", async () => {
    const first = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes,
      keyScopeId: "ks_01",
      keyVersion: 1,
      purpose: "payload_encryption",
    });

    const second = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes,
      keyScopeId: "ks_01",
      keyVersion: 1,
      purpose: "payload_encryption",
    });

    expect(first.origin).toBe("hkdf_root_scoped");
    expect(first.purpose).toBe("payload_encryption");
    expect(first.keyScopeId).toBe("ks_01");
    expect(first.keyVersion).toBe(1);
    expect(first.rawKeyBytes.byteLength).toBe(32);
    expect(bytesToHex(first.rawKeyBytes)).toBe(bytesToHex(second.rawKeyBytes));
  });

  it("derives deterministic blind-index keys separate from payload keys", async () => {
    const payloadKey = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes,
      keyScopeId: "ks_01",
      keyVersion: 1,
      purpose: "payload_encryption",
    });

    const blindIndexKey = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes,
      keyScopeId: "ks_01",
      keyVersion: 1,
      purpose: "blind_index",
    });

    expect(blindIndexKey.origin).toBe("hkdf_root_scoped");
    expect(blindIndexKey.purpose).toBe("blind_index");
    expect(blindIndexKey.rawKeyBytes.byteLength).toBe(32);
    expect(bytesToHex(blindIndexKey.rawKeyBytes)).not.toBe(
      bytesToHex(payloadKey.rawKeyBytes),
    );
  });

  it("derives different keys for different opaque keyScopeId values", async () => {
    const first = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes,
      keyScopeId: "ks_01",
      keyVersion: 1,
      purpose: "payload_encryption",
    });

    const second = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes,
      keyScopeId: "ks_02",
      keyVersion: 1,
      purpose: "payload_encryption",
    });

    expect(bytesToHex(first.rawKeyBytes)).not.toBe(
      bytesToHex(second.rawKeyBytes),
    );
  });

  it("derives different keys for different key versions", async () => {
    const versionOne = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes,
      keyScopeId: "ks_01",
      keyVersion: 1,
      purpose: "payload_encryption",
    });

    const versionTwo = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes,
      keyScopeId: "ks_01",
      keyVersion: 2,
      purpose: "payload_encryption",
    });

    expect(bytesToHex(versionOne.rawKeyBytes)).not.toBe(
      bytesToHex(versionTwo.rawKeyBytes),
    );
  });

  it("rejects semantic clinical labels in derivation scope identifiers", () => {
    const unsafeScopeIds = [
      "ks_mental_health",
      "ks_reproductive",
      "ks_psychiatric",
      "ks_oncology",
      "ks_hiv",
      "ks_diabetes",
      "domain/general/v1",
      "domain/mental-health/v1",
      "reproductive-health-scope",
    ];

    for (const scopeId of unsafeScopeIds) {
      expect(() => assertNonSemanticDerivationScope(scopeId)).toThrow(
        "derivation scope must be non-semantic",
      );
    }
  });

  it("accepts opaque non-semantic derivation scope identifiers", () => {
    const safeScopeIds = ["ks_01", "ks_7f4a9c", "scope_a1b2c3"];

    for (const scopeId of safeScopeIds) {
      expect(() => assertNonSemanticDerivationScope(scopeId)).not.toThrow();
    }
  });

  it("rejects root-scoped derivation for random capability purposes", async () => {
    await expect(
      deriveRootScopedKey({
        rootKey,
        patientSaltBytes,
        keyScopeId: "ks_10",
        keyVersion: 1,
        purpose: "local_keyring" as RootScopedKeyPurpose,
      }),
    ).rejects.toThrow("unsupported root-scoped key purpose");
  });

  it("rejects invalid root key material length", async () => {
    await expect(
      deriveRootScopedKey({
        rootKey: {
          rootVersion: 1,
          rawRootKeyBytes: new Uint8Array(16).fill(1),
        },
        patientSaltBytes,
        keyScopeId: "ks_01",
        keyVersion: 1,
        purpose: "payload_encryption",
      }),
    ).rejects.toThrow("K_root must be 32 bytes");
  });

  it("rejects invalid patient salt length", async () => {
    await expect(
      deriveRootScopedKey({
        rootKey,
        patientSaltBytes: new Uint8Array(8).fill(1),
        keyScopeId: "ks_01",
        keyVersion: 1,
        purpose: "payload_encryption",
      }),
    ).rejects.toThrow("patient salt must be 32 bytes");
  });

  it("generates random local keyring capability DEKs", () => {
    const first = generateCapabilityDek({
      keyScopeId: "ks_10",
      keyVersion: 1,
      purpose: "local_keyring",
    });

    const second = generateCapabilityDek({
      keyScopeId: "ks_10",
      keyVersion: 1,
      purpose: "local_keyring",
    });

    expect(first.origin).toBe("random_capability_dek");
    expect(first.purpose).toBe("local_keyring");
    expect(first.rawKeyBytes.byteLength).toBe(32);
    expect(bytesToHex(first.rawKeyBytes)).not.toBe(
      bytesToHex(second.rawKeyBytes),
    );
  });

  it("generates random keyring backup capability DEKs", () => {
    const key = generateCapabilityDek({
      keyScopeId: "ks_20",
      keyVersion: 1,
      purpose: "keyring_backup",
    });

    expect(key.origin).toBe("random_capability_dek");
    expect(key.purpose).toBe("keyring_backup");
    expect(key.rawKeyBytes.byteLength).toBe(32);
  });

  it("generates random caregiver adherence capability DEKs", () => {
    const key = generateCapabilityDek({
      keyScopeId: "ks_30",
      keyVersion: 1,
      purpose: "caregiver_adherence",
    });

    expect(key.origin).toBe("random_capability_dek");
    expect(key.purpose).toBe("caregiver_adherence");
    expect(key.rawKeyBytes.byteLength).toBe(32);
  });

  it("generates random emergency card capability DEKs", () => {
    const key = generateCapabilityDek({
      keyScopeId: "ks_40",
      keyVersion: 1,
      purpose: "emergency_card",
    });

    expect(key.origin).toBe("random_capability_dek");
    expect(key.purpose).toBe("emergency_card");
    expect(key.rawKeyBytes.byteLength).toBe(32);
  });

  it("rejects capability DEK generation for root-scoped purposes", () => {
    expect(() =>
      generateCapabilityDek({
        keyScopeId: "ks_01",
        keyVersion: 1,
        purpose: "payload_encryption" as CapabilityDekPurpose,
      }),
    ).toThrow("unsupported capability DEK purpose");
  });

  it("prevents blind-index key material from being approved for AES-GCM payload encryption", async () => {
    const blindIndexKey = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes,
      keyScopeId: "ks_02",
      keyVersion: 1,
      purpose: "blind_index",
    });

    expect(() =>
      assertKeyMaterialPurposeAllowed(blindIndexKey, "payload_encryption"),
    ).toThrow("key material purpose mismatch");
  });

  it("prevents payload encryption key material from being approved for blind indexing", async () => {
    const payloadKey = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes,
      keyScopeId: "ks_01",
      keyVersion: 1,
      purpose: "payload_encryption",
    });

    expect(() =>
      assertKeyMaterialPurposeAllowed(payloadKey, "blind_index"),
    ).toThrow("key material purpose mismatch");
  });

  it("allows matching key material purpose checks", async () => {
    const payloadKey = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes,
      keyScopeId: "ks_01",
      keyVersion: 1,
      purpose: "payload_encryption",
    });

    expect(() =>
      assertKeyMaterialPurposeAllowed(payloadKey, "payload_encryption"),
    ).not.toThrow();
  });

  it("rejects unknown key material purposes", () => {
    const key = generateCapabilityDek({
      keyScopeId: "ks_10",
      keyVersion: 1,
      purpose: "local_keyring",
    });

    expect(() =>
      assertKeyMaterialPurposeAllowed(
        key,
        "unknown_purpose" as KeyMaterialPurpose,
      ),
    ).toThrow("unsupported key material purpose");
  });

  it("returns frozen key material objects", async () => {
    const derived = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes,
      keyScopeId: "ks_01",
      keyVersion: 1,
      purpose: "payload_encryption",
    });

    const generated = generateCapabilityDek({
      keyScopeId: "ks_10",
      keyVersion: 1,
      purpose: "local_keyring",
    });

    expect(Object.isFrozen(derived)).toBe(true);
    expect(Object.isFrozen(generated)).toBe(true);
    
  });
    it("derives different keys for different patient salts", async () => {
    const first = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes: new Uint8Array(32).fill(17),
      keyScopeId: "ks_01",
      keyVersion: 1,
      purpose: "payload_encryption",
    });

    const second = await deriveRootScopedKey({
      rootKey,
      patientSaltBytes: new Uint8Array(32).fill(18),
      keyScopeId: "ks_01",
      keyVersion: 1,
      purpose: "payload_encryption",
    });

    expect(bytesToHex(first.rawKeyBytes)).not.toBe(
      bytesToHex(second.rawKeyBytes),
    );
  });

  it("derives different keys for different root versions even when raw root bytes are unchanged", async () => {
    const versionOneRoot: RootKeyMaterial = {
      rootVersion: 1,
      rawRootKeyBytes: new Uint8Array(32).fill(31),
    };

    const versionTwoRoot: RootKeyMaterial = {
      rootVersion: 2,
      rawRootKeyBytes: new Uint8Array(32).fill(31),
    };

    const first = await deriveRootScopedKey({
      rootKey: versionOneRoot,
      patientSaltBytes,
      keyScopeId: "ks_01",
      keyVersion: 1,
      purpose: "payload_encryption",
    });

    const second = await deriveRootScopedKey({
      rootKey: versionTwoRoot,
      patientSaltBytes,
      keyScopeId: "ks_01",
      keyVersion: 1,
      purpose: "payload_encryption",
    });

    expect(bytesToHex(first.rawKeyBytes)).not.toBe(
      bytesToHex(second.rawKeyBytes),
    );
  });
});