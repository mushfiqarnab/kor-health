import { describe, expect, it } from "vitest";

import {
  assertCaregiverScopeIsLimited,
  assertKeyPurposeAllowed,
  assertNoRawMasterKeyExport,
  assertOpaqueKeyScopeId,
  assertRecoveryTargetsWrapKey,
  createKeyScopeRecord,
  resolveKeyForEnvelope,
  selectActiveKeyVersion,
  type KeyPurpose,
  type KeyringManifest,
  type KeyScopeRecord,
} from "../keyringPolicy";

describe("Keyring policy contract", () => {
  it("creates a non-exportable opaque payload encryption key scope record", () => {
    const record = createKeyScopeRecord({
      keyScopeId: "ks_7f4a9c",
      purpose: "payload_encryption",
      version: 1,
      status: "active",
      exportability: "non_exportable",
      createdFor: "patient_vault",
    });

    expect(record.keyScopeId).toBe("ks_7f4a9c");
    expect(record.purpose).toBe("payload_encryption");
    expect(record.version).toBe(1);
    expect(record.status).toBe("active");
    expect(record.exportability).toBe("non_exportable");
    expect(record.createdFor).toBe("patient_vault");
  });

  it("accepts opaque non-semantic keyScopeId values", () => {
    const validIds = ["ks_01", "ks_7f4a9c", "scope_a1b2c3"];

    for (const keyScopeId of validIds) {
      expect(() => assertOpaqueKeyScopeId(keyScopeId)).not.toThrow();
    }
  });

  it("rejects human-readable clinical labels in keyScopeId", () => {
    const unsafeIds = [
      "ks_mental_health",
      "ks_reproductive",
      "ks_psychiatric",
      "ks_oncology",
      "ks_hiv",
      "general_medical_key",
      "mental-health-domain",
      "reproductive_health_scope",
    ];

    for (const keyScopeId of unsafeIds) {
      expect(() => assertOpaqueKeyScopeId(keyScopeId)).toThrow(
        "keyScopeId must be opaque",
      );
    }
  });

  it("prevents blind-index keys from being used for payload encryption", () => {
    const blindIndexRecord = createKeyScopeRecord({
      keyScopeId: "ks_02",
      purpose: "blind_index",
      version: 1,
      status: "active",
      exportability: "non_exportable",
      createdFor: "patient_vault",
    });

    expect(() =>
      assertKeyPurposeAllowed(blindIndexRecord, "payload_encryption"),
    ).toThrow("key purpose mismatch");

    expect(() =>
      assertKeyPurposeAllowed(blindIndexRecord, "blind_index"),
    ).not.toThrow();
  });

  it("prevents payload encryption keys from being used for blind indexes", () => {
    const payloadRecord = createKeyScopeRecord({
      keyScopeId: "ks_03",
      purpose: "payload_encryption",
      version: 1,
      status: "active",
      exportability: "non_exportable",
      createdFor: "patient_vault",
    });

    expect(() => assertKeyPurposeAllowed(payloadRecord, "blind_index")).toThrow(
      "key purpose mismatch",
    );
  });

  it("treats caregiver adherence keys as scoped capability keys, not full general-vault keys", () => {
    const caregiverRecord = createKeyScopeRecord({
      keyScopeId: "ks_04",
      purpose: "caregiver_adherence",
      version: 1,
      status: "active",
      exportability: "wrapped_only",
      createdFor: "caregiver_projection",
    });

    expect(() => assertCaregiverScopeIsLimited(caregiverRecord)).not.toThrow();

    expect(() =>
      assertKeyPurposeAllowed(caregiverRecord, "payload_encryption"),
    ).toThrow("key purpose mismatch");
  });

  it("rejects caregiver scope records that are secretly full payload-encryption scopes", () => {
    const unsafeCaregiverRecord = createKeyScopeRecord({
      keyScopeId: "ks_05",
      purpose: "payload_encryption",
      version: 1,
      status: "active",
      exportability: "wrapped_only",
      createdFor: "caregiver_projection",
    });

    expect(() => assertCaregiverScopeIsLimited(unsafeCaregiverRecord)).toThrow(
      "caregiver access must use a scoped adherence key",
    );
  });

  it("rejects revoked caregiver adherence scopes even when they are otherwise limited", () => {
    const revokedCaregiverRecord = createKeyScopeRecord({
      keyScopeId: "ks_08",
      purpose: "caregiver_adherence",
      version: 1,
      status: "revoked",
      exportability: "wrapped_only",
      createdFor: "caregiver_projection",
    });

    expect(() => assertCaregiverScopeIsLimited(revokedCaregiverRecord)).toThrow(
      "caregiver scoped key must be active",
    );
  });

  it("selects the latest active key version for new encryption", () => {
    const manifest: KeyringManifest = {
      records: [
        createKeyScopeRecord({
          keyScopeId: "ks_01",
          purpose: "payload_encryption",
          version: 1,
          status: "retired",
          exportability: "non_exportable",
          createdFor: "patient_vault",
        }),
        createKeyScopeRecord({
          keyScopeId: "ks_01",
          purpose: "payload_encryption",
          version: 2,
          status: "active",
          exportability: "non_exportable",
          createdFor: "patient_vault",
        }),
      ],
    };

    const active = selectActiveKeyVersion(manifest, "ks_01");

    expect(active.version).toBe(2);
    expect(active.status).toBe("active");
  });

  it("keeps retired historical key versions resolvable for decryption", () => {
    const manifest: KeyringManifest = {
      records: [
        createKeyScopeRecord({
          keyScopeId: "ks_01",
          purpose: "payload_encryption",
          version: 1,
          status: "retired",
          exportability: "non_exportable",
          createdFor: "patient_vault",
        }),
        createKeyScopeRecord({
          keyScopeId: "ks_01",
          purpose: "payload_encryption",
          version: 2,
          status: "active",
          exportability: "non_exportable",
          createdFor: "patient_vault",
        }),
      ],
    };

    const historical = resolveKeyForEnvelope(manifest, {
      keyScopeId: "ks_01",
      keyVersion: 1,
      requiredPurpose: "payload_encryption",
    });

    expect(historical.version).toBe(1);
    expect(historical.status).toBe("retired");
  });

  it("rejects missing historical key versions instead of silently using the active key", () => {
    const manifest: KeyringManifest = {
      records: [
        createKeyScopeRecord({
          keyScopeId: "ks_01",
          purpose: "payload_encryption",
          version: 2,
          status: "active",
          exportability: "non_exportable",
          createdFor: "patient_vault",
        }),
      ],
    };

    expect(() =>
      resolveKeyForEnvelope(manifest, {
        keyScopeId: "ks_01",
        keyVersion: 1,
        requiredPurpose: "payload_encryption",
      }),
    ).toThrow("key version not found");
  });

  it("rejects revoked key versions for decryption", () => {
    const manifest: KeyringManifest = {
      records: [
        createKeyScopeRecord({
          keyScopeId: "ks_01",
          purpose: "payload_encryption",
          version: 1,
          status: "revoked",
          exportability: "non_exportable",
          createdFor: "patient_vault",
        }),
      ],
    };

    expect(() =>
      resolveKeyForEnvelope(manifest, {
        keyScopeId: "ks_01",
        keyVersion: 1,
        requiredPurpose: "payload_encryption",
      }),
    ).toThrow("key version is revoked");
  });

  it("blocks raw K_master export policy", () => {
    expect(() =>
      assertNoRawMasterKeyExport({
        keyMaterialKind: "K_master",
        exportMode: "raw",
      }),
    ).toThrow("raw K_master export is forbidden");

    expect(() =>
      assertNoRawMasterKeyExport({
        keyMaterialKind: "K_master",
        exportMode: "wrapped",
      }),
    ).not.toThrow();
  });

  it("requires recovery to target K_recovery_wrap, not raw K_master", () => {
    expect(() =>
      assertRecoveryTargetsWrapKey({
        recoveryTarget: "K_master",
      }),
    ).toThrow("recovery must target K_recovery_wrap");

    expect(() =>
      assertRecoveryTargetsWrapKey({
        recoveryTarget: "K_recovery_wrap",
      }),
    ).not.toThrow();
  });

  it("does not allow unknown key purposes to pass policy checks", () => {
    const record = createKeyScopeRecord({
      keyScopeId: "ks_06",
      purpose: "payload_encryption",
      version: 1,
      status: "active",
      exportability: "non_exportable",
      createdFor: "patient_vault",
    });

    expect(() =>
      assertKeyPurposeAllowed(record, "unknown_purpose" as KeyPurpose),
    ).toThrow("unsupported key purpose");
  });

  it("rejects duplicate active versions for the same keyScopeId", () => {
    const manifest: KeyringManifest = {
      records: [
        createKeyScopeRecord({
          keyScopeId: "ks_01",
          purpose: "payload_encryption",
          version: 1,
          status: "active",
          exportability: "non_exportable",
          createdFor: "patient_vault",
        }),
        createKeyScopeRecord({
          keyScopeId: "ks_01",
          purpose: "payload_encryption",
          version: 2,
          status: "active",
          exportability: "non_exportable",
          createdFor: "patient_vault",
        }),
      ],
    };

    expect(() => selectActiveKeyVersion(manifest, "ks_01")).toThrow(
      "multiple active key versions found",
    );
  });

  it("returns frozen key scope records to prevent accidental policy mutation", () => {
    const record: KeyScopeRecord = createKeyScopeRecord({
      keyScopeId: "ks_07",
      purpose: "recovery_wrap",
      version: 1,
      status: "active",
      exportability: "wrapped_only",
      createdFor: "keyring_recovery",
    });

    expect(Object.isFrozen(record)).toBe(true);
  });
});
