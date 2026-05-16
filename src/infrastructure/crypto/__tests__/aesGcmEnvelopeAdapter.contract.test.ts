import { describe, expect, it } from "vitest";

import {
  decryptFromEnvelope,
  encryptToEnvelope,
  type AadV1,
  type EncryptionKey,
  type SealedEnvelopeV1,
} from "../aesGcmEnvelopeAdapter";

const key: EncryptionKey = {
  keyVersion: 1,
  keyScopeId: "ks_01",
  rawKeyBytes: new Uint8Array(32).fill(7),
};

const baseAad: AadV1 = {
  envelopeVersion: 1,
  cryptoSuite: "AES-256-GCM",
  patientId: "patient-001",
  recordId: "record-001",
  keyScopeId: "ks_01",
  keyVersion: 1,
  purpose: "cloud_sync",
};

const plaintext = JSON.stringify({
  payloadSchemaVersion: 1,
  recordKind: "dose_event",
  clinicalPayload: {
    status: "missed",
    scheduledAt: "2026-05-17T22:00:00+06:00",
    actualAt: null,
    actorId: "caregiver-001",
    actorRole: "caregiver",
    secretMarker: "__SECRET_MEDICATION_ATORVA__",
  },
});

describe("AES-GCM sealed envelope adapter contract", () => {
  it("encrypts plaintext into a sealed envelope", async () => {
    const envelope = await encryptToEnvelope({
      plaintext,
      key,
      aad: baseAad,
    });

    expect(envelope.envelopeVersion).toBe(1);
    expect(envelope.cryptoSuite).toBe("AES-256-GCM");
    expect(envelope.keyScopeId).toBe("ks_01");
    expect(envelope.keyVersion).toBe(1);

    expect(typeof envelope.iv).toBe("string");
    expect(typeof envelope.tag).toBe("string");
    expect(typeof envelope.ciphertext).toBe("string");

    expect(envelope.iv.length).toBeGreaterThan(0);
    expect(envelope.tag.length).toBeGreaterThan(0);
    expect(envelope.ciphertext.length).toBeGreaterThan(0);

    expect(envelope.aad).toEqual(baseAad);
  });

  it("decrypts a valid sealed envelope back to the original plaintext", async () => {
    const envelope = await encryptToEnvelope({
      plaintext,
      key,
      aad: baseAad,
    });

    const decrypted = await decryptFromEnvelope({
      envelope,
      key,
    });

    expect(decrypted).toBe(plaintext);
  });

  it("does not expose plaintext clinical content in the serialized envelope", async () => {
    const envelope = await encryptToEnvelope({
      plaintext,
      key,
      aad: baseAad,
    });

    const serialized = JSON.stringify(envelope);

    expect(serialized).not.toContain("__SECRET_MEDICATION_ATORVA__");
    expect(serialized).not.toContain("missed");
    expect(serialized).not.toContain("dose_event");
    expect(serialized).not.toContain("scheduledAt");
    expect(serialized).not.toContain("2026-05-17T22:00:00+06:00");
    expect(serialized).not.toContain("caregiver-001");
    expect(serialized).not.toContain("payloadSchemaVersion");
  });

  it("uses a fresh IV and different ciphertext for repeated encryption", async () => {
    const first = await encryptToEnvelope({
      plaintext,
      key,
      aad: baseAad,
    });

    const second = await encryptToEnvelope({
      plaintext,
      key,
      aad: baseAad,
    });

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it("rejects decryption when patientId in AAD is changed", async () => {
    const envelope = await encryptToEnvelope({
      plaintext,
      key,
      aad: baseAad,
    });

    const tamperedEnvelope: SealedEnvelopeV1 = {
      ...envelope,
      aad: {
        ...envelope.aad,
        patientId: "patient-999",
      },
    };

    await expect(
      decryptFromEnvelope({
        envelope: tamperedEnvelope,
        key,
      }),
    ).rejects.toThrow("envelope authentication failed");
  });

  it("rejects decryption when recordId in AAD is changed", async () => {
    const envelope = await encryptToEnvelope({
      plaintext,
      key,
      aad: baseAad,
    });

    const tamperedEnvelope: SealedEnvelopeV1 = {
      ...envelope,
      aad: {
        ...envelope.aad,
        recordId: "record-999",
      },
    };

    await expect(
      decryptFromEnvelope({
        envelope: tamperedEnvelope,
        key,
      }),
    ).rejects.toThrow("envelope authentication failed");
  });

  it("rejects structurally inconsistent envelopes when keyVersion in AAD is changed", async () => {
    const envelope = await encryptToEnvelope({
      plaintext,
      key,
      aad: baseAad,
    });

    const tamperedEnvelope: SealedEnvelopeV1 = {
      ...envelope,
      aad: {
        ...envelope.aad,
        keyVersion: 2,
      },
    };

    await expect(
      decryptFromEnvelope({
        envelope: tamperedEnvelope,
        key,
      }),
    ).rejects.toThrow("malformed sealed envelope");
  });

  it("rejects unsupported cryptoSuite", async () => {
    const envelope = await encryptToEnvelope({
      plaintext,
      key,
      aad: baseAad,
    });

    const tamperedEnvelope: SealedEnvelopeV1 = {
      ...envelope,
      cryptoSuite: "UNSUPPORTED" as SealedEnvelopeV1["cryptoSuite"],
      aad: {
        ...envelope.aad,
        cryptoSuite: "UNSUPPORTED" as AadV1["cryptoSuite"],
      },
    };

    await expect(
      decryptFromEnvelope({
        envelope: tamperedEnvelope,
        key,
      }),
    ).rejects.toThrow("unsupported crypto suite");
  });

  it("rejects malformed envelopes with missing ciphertext", async () => {
    const malformedEnvelope = {
      envelopeVersion: 1,
      cryptoSuite: "AES-256-GCM",
      keyScopeId: "ks_01",
      keyVersion: 1,
      iv: "abc",
      tag: "def",
      ciphertext: "",
      aad: baseAad,
    } satisfies SealedEnvelopeV1;

    await expect(
      decryptFromEnvelope({
        envelope: malformedEnvelope,
        key,
      }),
    ).rejects.toThrow("malformed sealed envelope");
  });
  it("rejects decryption with the wrong raw key bytes even when metadata matches", async () => {
    const envelope = await encryptToEnvelope({
      plaintext,
      key,
      aad: baseAad,
    });

    const wrongKey: EncryptionKey = {
      keyVersion: 1,
      keyScopeId: "ks_01",
      rawKeyBytes: new Uint8Array(32).fill(9),
    };

    await expect(
      decryptFromEnvelope({
        envelope,
        key: wrongKey,
      }),
    ).rejects.toThrow("envelope authentication failed");
  });

  it("freezes the returned envelope and nested AAD to prevent accidental mutation", async () => {
    const envelope = await encryptToEnvelope({
      plaintext,
      key,
      aad: baseAad,
    });

    expect(Object.isFrozen(envelope)).toBe(true);
    expect(Object.isFrozen(envelope.aad)).toBe(true);
  });

});
