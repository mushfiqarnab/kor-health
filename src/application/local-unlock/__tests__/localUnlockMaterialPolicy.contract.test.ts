import { describe, expect, it } from "vitest";

import {
  assertNoForbiddenLocalUnlockMetadata,
  createLocalUnlockMaterial,
  deserializeLocalUnlockMaterial,
  serializeLocalUnlockMaterial,
  zeroLocalUnlockMaterial,
  type LocalUnlockMaterial,
} from "../localUnlockMaterialPolicy";

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

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function encodeStoredPayload(payload: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));

  return `local-unlock-v1:${bytesToBase64Url(bytes)}`;
}

function createValidMaterial(): LocalUnlockMaterial {
  return createLocalUnlockMaterial({
    keyScopeId: "ks_10",
    keyVersion: 1,
    purpose: "local_keyring",
    rawKeyBytes: new Uint8Array(32).fill(17),
  });
}

function serialized(value: unknown): string {
  return JSON.stringify(value).toLowerCase();
}

describe("Local unlock material policy contract", () => {
  it("creates frozen local unlock material from valid 32-byte local_keyring key material", () => {
    const material = createValidMaterial();

    expect(material.keyScopeId).toBe("ks_10");
    expect(material.keyVersion).toBe(1);
    expect(material.purpose).toBe("local_keyring");
    expect(material.rawKeyBytes).toBeInstanceOf(Uint8Array);
    expect(material.rawKeyBytes.byteLength).toBe(32);
    expect(Object.isFrozen(material)).toBe(true);
  });

  it("rejects non-Uint8Array raw key material", () => {
    expect(() =>
      createLocalUnlockMaterial({
        keyScopeId: "ks_10",
        keyVersion: 1,
        purpose: "local_keyring",
        rawKeyBytes: "not-bytes" as unknown as Uint8Array,
      }),
    ).toThrow("local unlock material must use Uint8Array key bytes");
  });

  it("rejects non-32-byte local unlock material", () => {
    expect(() =>
      createLocalUnlockMaterial({
        keyScopeId: "ks_10",
        keyVersion: 1,
        purpose: "local_keyring",
        rawKeyBytes: new Uint8Array(31).fill(17),
      }),
    ).toThrow("local unlock material must be 32 bytes");
  });

  it("rejects keyring_backup material as local unlock material", () => {
    expect(() =>
      createLocalUnlockMaterial({
        keyScopeId: "ks_20",
        keyVersion: 1,
        purpose: "keyring_backup" as LocalUnlockMaterial["purpose"],
        rawKeyBytes: new Uint8Array(32).fill(22),
      }),
    ).toThrow("local unlock material purpose must be local_keyring");
  });

  it("rejects payload_encryption material as local unlock material", () => {
    expect(() =>
      createLocalUnlockMaterial({
        keyScopeId: "ks_01",
        keyVersion: 1,
        purpose: "payload_encryption" as LocalUnlockMaterial["purpose"],
        rawKeyBytes: new Uint8Array(32).fill(33),
      }),
    ).toThrow("local unlock material purpose must be local_keyring");
  });

  it("rejects semantic keyScopeId values", () => {
    expect(() =>
      createLocalUnlockMaterial({
        keyScopeId: "mental-health-local-unlock",
        keyVersion: 1,
        purpose: "local_keyring",
        rawKeyBytes: new Uint8Array(32).fill(17),
      }),
    ).toThrow("derivation scope must be non-semantic");
  });

  it("serializes local unlock material using local-unlock-v1 prefix", () => {
    const material = createValidMaterial();

    const storedValue = serializeLocalUnlockMaterial(material);

    expect(storedValue).toMatch(/^local-unlock-v1:/);
    expect(storedValue).not.toContain("rawKeyBytes");
    expect(storedValue).not.toContain("K_root");
    expect(storedValue).not.toContain("K_master");
  });

  it("deserializes valid stored local unlock material", () => {
    const material = createValidMaterial();
    const storedValue = serializeLocalUnlockMaterial(material);

    const restored = deserializeLocalUnlockMaterial(storedValue);

    expect(restored.keyScopeId).toBe(material.keyScopeId);
    expect(restored.keyVersion).toBe(material.keyVersion);
    expect(restored.purpose).toBe("local_keyring");
    expect(restored.rawKeyBytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(restored.rawKeyBytes)).toEqual(
      Array.from(material.rawKeyBytes),
    );
    expect(Object.isFrozen(restored)).toBe(true);
  });

  it("rejects malformed stored local unlock values", () => {
    const malformedValues = [
      "",
      "local-unlock-v1:",
      "local-unlock-v2:abc",
      "local-unlock-v1:not-valid-base64url",
      "sealed-key-envelope-v1:abc",
      "plain-json-object",
    ];

    for (const value of malformedValues) {
      expect(() => deserializeLocalUnlockMaterial(value)).toThrow(
        "malformed local unlock material",
      );
    }
  });

  it("rejects stored values with wrong purpose", () => {
    const storedValue = encodeStoredPayload({
      schemaVersion: 1,
      materialType: "local_unlock_material",
      keyScopeId: "ks_20",
      keyVersion: 1,
      purpose: "keyring_backup",
      rawKeyBytesBase64Url: bytesToBase64Url(new Uint8Array(32).fill(22)),
    });

    expect(() => deserializeLocalUnlockMaterial(storedValue)).toThrow(
      "local unlock material purpose must be local_keyring",
    );
  });

  it("rejects stored values with wrong key length", () => {
    const storedValue = encodeStoredPayload({
      schemaVersion: 1,
      materialType: "local_unlock_material",
      keyScopeId: "ks_10",
      keyVersion: 1,
      purpose: "local_keyring",
      rawKeyBytesBase64Url: bytesToBase64Url(new Uint8Array(16).fill(17)),
    });

    expect(() => deserializeLocalUnlockMaterial(storedValue)).toThrow(
      "local unlock material must be 32 bytes",
    );
  });

  it("rejects forbidden clinical or identity metadata", () => {
    const unsafeValue = {
      schemaVersion: 1,
      materialType: "local_unlock_material",
      keyScopeId: "ks_mental",
      keyVersion: 1,
      purpose: "local_keyring",
      note: "mental-health NID phone domain/general",
      rawKeyBytesBase64Url: bytesToBase64Url(new Uint8Array(32).fill(17)),
    };

    expect(() => assertNoForbiddenLocalUnlockMetadata(unsafeValue)).toThrow(
      "forbidden local unlock metadata",
    );
  });

  it("does not expose clinical labels or identity labels in stored representation", () => {
    const storedValue = serializeLocalUnlockMaterial(createValidMaterial());
    const output = storedValue.toLowerCase();

    expect(output).not.toContain("mental");
    expect(output).not.toContain("psychiatric");
    expect(output).not.toContain("reproductive");
    expect(output).not.toContain("oncology");
    expect(output).not.toContain("hiv");
    expect(output).not.toContain("diabetes");
    expect(output).not.toContain("nid");
    expect(output).not.toContain("e-tin");
    expect(output).not.toContain("phone");
    expect(output).not.toContain("email");
    expect(output).not.toContain("domain/general");
    expect(output).not.toContain("domain/mental");
  });

  it("does not expose raw key bytes when ordinary material object is stringified", () => {
    const material = createValidMaterial();
    const output = serialized(material);

    expect(output).not.toContain("rawkeybytes");
    expect(output).not.toContain("k_root");
    expect(output).not.toContain("k_master");
    expect(output).not.toContain("local_unlock");
  });

  it("zeroes local unlock material bytes on explicit cleanup", () => {
    const material = createValidMaterial();

    zeroLocalUnlockMaterial(material);

    expect(Array.from(material.rawKeyBytes)).toEqual(new Array(32).fill(0));
  });
});