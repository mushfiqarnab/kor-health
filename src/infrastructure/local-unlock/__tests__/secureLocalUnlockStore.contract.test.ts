import { describe, expect, it } from "vitest";

import {
  createLocalUnlockMaterial,
  type LocalUnlockMaterial,
} from "../../../application/local-unlock/localUnlockMaterialPolicy";

import {
  buildLocalUnlockStorageKey,
  deleteLocalUnlockMaterial,
  loadLocalUnlockMaterial,
  SecureLocalSecretDriverError,
  storeLocalUnlockMaterial,
  type SecureLocalSecretDriver,
} from "../secureLocalUnlockStore";

class MemorySecureLocalSecretDriver implements SecureLocalSecretDriver {
  readonly values = new Map<string, string>();
  getErrorCode:
    | "unavailable"
    | "authentication_cancelled"
    | "authentication_changed"
    | "unknown"
    | undefined;

  setErrorCode:
    | "unavailable"
    | "authentication_cancelled"
    | "authentication_changed"
    | "unknown"
    | undefined;

  deleteErrorCode:
    | "unavailable"
    | "authentication_cancelled"
    | "authentication_changed"
    | "unknown"
    | undefined;

  async setItem(key: string, value: string): Promise<void> {
    if (this.setErrorCode) {
      throw new SecureLocalSecretDriverError(this.setErrorCode);
    }

    this.values.set(key, value);
  }

  async getItem(key: string): Promise<string | null> {
    if (this.getErrorCode) {
      throw new SecureLocalSecretDriverError(this.getErrorCode);
    }

    return this.values.get(key) ?? null;
  }

  async deleteItem(key: string): Promise<void> {
    if (this.deleteErrorCode) {
      throw new SecureLocalSecretDriverError(this.deleteErrorCode);
    }

    this.values.delete(key);
  }
}

function createMaterial(): LocalUnlockMaterial {
  return createLocalUnlockMaterial({
    keyScopeId: "ks_10",
    keyVersion: 1,
    purpose: "local_keyring",
    rawKeyBytes: new Uint8Array(32).fill(44),
  });
}

function createDriver(): MemorySecureLocalSecretDriver {
  return new MemorySecureLocalSecretDriver();
}

const patientId = "patient-001";
const keyringId = "keyring-001";

describe("Secure local unlock store boundary contract", () => {
  it("builds a stable local unlock storage key scoped by patient and keyring", () => {
    expect(buildLocalUnlockStorageKey({ patientId, keyringId })).toBe(
      "kor:v1:local-unlock:patient-001:keyring-001",
    );
  });

  it("stores local unlock material through injected secure driver", async () => {
    const driver = createDriver();

    await storeLocalUnlockMaterial({
      driver,
      patientId,
      keyringId,
      material: createMaterial(),
    });

    const storedValue = driver.values.get(
      buildLocalUnlockStorageKey({ patientId, keyringId }),
    );

    expect(storedValue).toMatch(/^local-unlock-v1:/);
    expect(storedValue).not.toContain("rawKeyBytes");
  });

  it("loads local unlock material from injected secure driver", async () => {
    const driver = createDriver();
    const material = createMaterial();

    await storeLocalUnlockMaterial({
      driver,
      patientId,
      keyringId,
      material,
    });

    const result = await loadLocalUnlockMaterial({
      driver,
      patientId,
      keyringId,
    });

    expect(result.status).toBe("unlocked");

    if (result.status !== "unlocked") {
      throw new Error("expected unlocked result");
    }

    expect(result.material.keyScopeId).toBe("ks_10");
    expect(result.material.purpose).toBe("local_keyring");
    expect(result.material.rawKeyBytes.byteLength).toBe(32);
  });

  it("deletes local unlock material", async () => {
    const driver = createDriver();

    await storeLocalUnlockMaterial({
      driver,
      patientId,
      keyringId,
      material: createMaterial(),
    });

    await deleteLocalUnlockMaterial({
      driver,
      patientId,
      keyringId,
    });

    const result = await loadLocalUnlockMaterial({
      driver,
      patientId,
      keyringId,
    });

    expect(result).toEqual({ status: "locked_missing" });
  });

  it("returns locked_missing when secure driver returns null", async () => {
    const result = await loadLocalUnlockMaterial({
      driver: createDriver(),
      patientId,
      keyringId,
    });

    expect(result).toEqual({ status: "locked_missing" });
  });

  it("returns locked_unavailable when secure driver is unavailable", async () => {
    const driver = createDriver();
    driver.getErrorCode = "unavailable";

    const result = await loadLocalUnlockMaterial({
      driver,
      patientId,
      keyringId,
    });

    expect(result).toEqual({ status: "locked_unavailable" });
  });

  it("returns locked_cancelled when authentication is cancelled", async () => {
    const driver = createDriver();
    driver.getErrorCode = "authentication_cancelled";

    const result = await loadLocalUnlockMaterial({
      driver,
      patientId,
      keyringId,
    });

    expect(result).toEqual({ status: "locked_cancelled" });
  });

  it("returns locked_auth_changed when biometric state invalidates stored material", async () => {
    const driver = createDriver();
    driver.getErrorCode = "authentication_changed";

    const result = await loadLocalUnlockMaterial({
      driver,
      patientId,
      keyringId,
    });

    expect(result).toEqual({ status: "locked_auth_changed" });
  });

  it("returns locked_unavailable for unknown secure driver failures", async () => {
    const driver = createDriver();
    driver.getErrorCode = "unknown";

    const result = await loadLocalUnlockMaterial({
      driver,
      patientId,
      keyringId,
    });

    expect(result).toEqual({ status: "locked_unavailable" });
  });

  it("returns locked_malformed when stored value fails policy parsing", async () => {
    const driver = createDriver();

    driver.values.set(
      buildLocalUnlockStorageKey({ patientId, keyringId }),
      "local-unlock-v1:not-valid-base64url",
    );

    const result = await loadLocalUnlockMaterial({
      driver,
      patientId,
      keyringId,
    });

    expect(result).toEqual({ status: "locked_malformed" });
  });

  it("does not return raw key material on failure states", async () => {
    const driver = createDriver();
    driver.getErrorCode = "authentication_cancelled";

    const result = await loadLocalUnlockMaterial({
      driver,
      patientId,
      keyringId,
    });

    const output = JSON.stringify(result).toLowerCase();

    expect(output).not.toContain("rawkeybytes");
    expect(output).not.toContain("local-unlock-v1");
    expect(output).not.toContain("k_root");
    expect(output).not.toContain("k_master");
  });

  it("rejects wrong-purpose material before storing", async () => {
    const driver = createDriver();

    await expect(
      storeLocalUnlockMaterial({
        driver,
        patientId,
        keyringId,
        material: {
          keyScopeId: "ks_20",
          keyVersion: 1,
          purpose: "keyring_backup",
          rawKeyBytes: new Uint8Array(32).fill(22),
        } as unknown as LocalUnlockMaterial,
      }),
    ).rejects.toThrow("local unlock material purpose must be local_keyring");

    expect(driver.values.size).toBe(0);
  });
});