import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  assertNoLocalEncryptedDocumentPayloadMetadataLeak,
  createLocalEncryptedDocumentPayload,
  isLocalEncryptedDocumentPayloadActive,
  isLocalEncryptedDocumentPayloadDeleted,
  markLocalEncryptedDocumentPayloadDeleted,
  type CreateLocalEncryptedDocumentPayloadInput,
  type LocalEncryptedDocumentPayload,
  type LocalEncryptedDocumentPayloadEncryptionScheme,
} from "../localEncryptedDocumentPayload";

const createdAtEpochMs = 1_800_000_000_000;
const updatedAtEpochMs = createdAtEpochMs + 60_000;
const deletedAtEpochMs = createdAtEpochMs + 120_000;

function baseInput(
  overrides: Partial<CreateLocalEncryptedDocumentPayloadInput> = {},
): CreateLocalEncryptedDocumentPayloadInput {
  return {
    payloadId: "payload_01JAAA00000000000000000001",
    patientId: "patient_01JAAA00000000000000000001",
    ciphertextRef: "ciphertext_01JAAA00000000000000000001",
    encryptionEnvelopeRef: "envelope_01JAAA00000000000000000001",
    encryptionScheme: "aes_256_gcm_v1",
    payloadSchemaVersion: 1,
    createdAtEpochMs,
    ...overrides,
  };
}

function createPayload(
  overrides: Partial<CreateLocalEncryptedDocumentPayloadInput> = {},
): LocalEncryptedDocumentPayload {
  return createLocalEncryptedDocumentPayload(baseInput(overrides));
}

function expectCreateToThrow(
  overrides: Partial<CreateLocalEncryptedDocumentPayloadInput>,
  message: string,
): void {
  expect(() => createLocalEncryptedDocumentPayload(baseInput(overrides))).toThrow(
    message,
  );
}

describe("Local encrypted document payload boundary contract", () => {
  it("creates a frozen metadata-only local encrypted payload reference", () => {
    const payload = createPayload();

    expect(payload).toEqual({
      payloadId: "payload_01JAAA00000000000000000001",
      patientId: "patient_01JAAA00000000000000000001",
      ciphertextRef: "ciphertext_01JAAA00000000000000000001",
      encryptionEnvelopeRef: "envelope_01JAAA00000000000000000001",
      encryptionScheme: "aes_256_gcm_v1",
      payloadSchemaVersion: 1,
      createdAtEpochMs,
    });

    expect(Object.isFrozen(payload)).toBe(true);
    expect(isLocalEncryptedDocumentPayloadActive(payload)).toBe(true);
    expect(isLocalEncryptedDocumentPayloadDeleted(payload)).toBe(false);

    expect("ciphertextBytes" in payload).toBe(false);
    expect("plaintextBytes" in payload).toBe(false);
    expect("documentText" in payload).toBe(false);
    expect("fileName" in payload).toBe(false);
    expect("filePath" in payload).toBe(false);
    expect("storagePath" in payload).toBe(false);
    expect("mimeType" in payload).toBe(false);
    expect("title" in payload).toBe(false);
  });

  it("creates a payload reference with updatedAtEpochMs", () => {
    const payload = createPayload({ updatedAtEpochMs });

    expect(payload.updatedAtEpochMs).toBe(updatedAtEpochMs);
  });

  it("rejects empty opaque references", () => {
    expectCreateToThrow(
      { payloadId: "   " },
      "payloadId must not be empty",
    );

    expectCreateToThrow(
      { patientId: "   " },
      "patientId must not be empty",
    );

    expectCreateToThrow(
      { ciphertextRef: "   " },
      "ciphertextRef must not be empty",
    );

    expectCreateToThrow(
      { encryptionEnvelopeRef: "   " },
      "encryptionEnvelopeRef must not be empty",
    );
  });

  it("rejects unsupported encryption schemes", () => {
    expectCreateToThrow(
      {
        encryptionScheme:
          "plain_text_v1" as LocalEncryptedDocumentPayloadEncryptionScheme,
      },
      "unsupported local encrypted payload encryption scheme",
    );

    expectCreateToThrow(
      {
        encryptionScheme:
          "aes_256_cbc_v1" as LocalEncryptedDocumentPayloadEncryptionScheme,
      },
      "unsupported local encrypted payload encryption scheme",
    );
  });

  it("rejects zero, negative, and non-integer schema versions and timestamps", () => {
    expectCreateToThrow(
      { payloadSchemaVersion: 0 },
      "payloadSchemaVersion must be a positive integer",
    );

    expectCreateToThrow(
      { payloadSchemaVersion: -1 },
      "payloadSchemaVersion must be a positive integer",
    );

    expectCreateToThrow(
      { payloadSchemaVersion: 1.5 },
      "payloadSchemaVersion must be a positive integer",
    );

    expectCreateToThrow(
      { createdAtEpochMs: 0 },
      "createdAtEpochMs must be a positive integer",
    );

    expectCreateToThrow(
      { createdAtEpochMs: 1.5 },
      "createdAtEpochMs must be a positive integer",
    );
  });

  it("rejects updatedAtEpochMs or deletedAtEpochMs before createdAtEpochMs", () => {
    expectCreateToThrow(
      { updatedAtEpochMs: createdAtEpochMs - 1 },
      "updatedAtEpochMs cannot be before createdAtEpochMs",
    );

    expectCreateToThrow(
      { deletedAtEpochMs: createdAtEpochMs - 1 },
      "deletedAtEpochMs cannot be before createdAtEpochMs",
    );
  });

  it("rejects non-integer updatedAtEpochMs and deletedAtEpochMs", () => {
    expectCreateToThrow(
      { updatedAtEpochMs: 1.5 },
      "updatedAtEpochMs must be a positive integer",
    );

    expectCreateToThrow(
      { deletedAtEpochMs: 1.5 },
      "deletedAtEpochMs must be a positive integer",
    );
  });

  it("marks a payload deleted without mutating the original payload", () => {
    const payload = createPayload();
    const deleted = markLocalEncryptedDocumentPayloadDeleted(
      payload,
      deletedAtEpochMs,
    );

    expect(payload.deletedAtEpochMs).toBeUndefined();
    expect(deleted.deletedAtEpochMs).toBe(deletedAtEpochMs);
    expect(Object.isFrozen(deleted)).toBe(true);
    expect(isLocalEncryptedDocumentPayloadDeleted(deleted)).toBe(true);
    expect(isLocalEncryptedDocumentPayloadActive(deleted)).toBe(false);
  });

  it("deletion is idempotent", () => {
    const payload = createPayload();
    const deleted = markLocalEncryptedDocumentPayloadDeleted(
      payload,
      deletedAtEpochMs,
    );

    const secondDelete = markLocalEncryptedDocumentPayloadDeleted(
      deleted,
      deletedAtEpochMs + 60_000,
    );

    expect(secondDelete).toBe(deleted);
    expect(secondDelete.deletedAtEpochMs).toBe(deletedAtEpochMs);
  });

  it("rejects deletion before payload creation", () => {
    const payload = createPayload();

    expect(() =>
      markLocalEncryptedDocumentPayloadDeleted(
        payload,
        createdAtEpochMs - 1,
      ),
    ).toThrow("deletedAtEpochMs cannot be before createdAtEpochMs");
  });

  it("rejects sensitive labels and patient identifiers in opaque refs", () => {
    expectCreateToThrow(
      { payloadId: "payload_hiv_report" },
      "forbidden local encrypted payload metadata",
    );

    expectCreateToThrow(
      { patientId: "patient_phone_01700000000" },
      "forbidden local encrypted payload metadata",
    );

    expectCreateToThrow(
      { ciphertextRef: "ciphertext_hba1c_result" },
      "forbidden local encrypted payload metadata",
    );

    expectCreateToThrow(
      { encryptionEnvelopeRef: "envelope_nid_123456" },
      "forbidden local encrypted payload metadata",
    );
  });

  it("rejects path-like and filename-like ciphertext refs that may leak clinical meaning", () => {
    expectCreateToThrow(
      { ciphertextRef: "reports/hiv/patient-rahim.pdf.enc" },
      "forbidden local encrypted payload metadata",
    );

    expectCreateToThrow(
      { ciphertextRef: "file://local/reports/diabetes-hba1c.pdf.enc" },
      "forbidden local encrypted payload metadata",
    );

    expectCreateToThrow(
      { ciphertextRef: "content://kor/pregnancy-ultrasound.enc" },
      "forbidden local encrypted payload metadata",
    );
  });

  it("does not serialize clinical content, filenames, key material, or payload bytes", () => {
    const payload = createPayload();

    const serialized = JSON.stringify(payload).toLowerCase();

    expect(serialized).not.toContain("diagnosis");
    expect(serialized).not.toContain("prescription");
    expect(serialized).not.toContain("lab value");
    expect(serialized).not.toContain("hba1c");
    expect(serialized).not.toContain("filename");
    expect(serialized).not.toContain("filepath");
    expect(serialized).not.toContain("storagepath");
    expect(serialized).not.toContain("rawkeybytes");
    expect(serialized).not.toContain("plaintext");
    expect(serialized).not.toContain("ciphertextbytes");
    expect(serialized).not.toContain("sealed-key-envelope");

    expect(() =>
      assertNoLocalEncryptedDocumentPayloadMetadataLeak(payload),
    ).not.toThrow();
  });

  it("rejects unsafe payload objects during explicit metadata leak assertion", () => {
    const unsafePayload = {
      payloadId: "payload_unsafe",
      fileName: "hiv-result.pdf",
      diagnosis: "private diagnosis text",
      rawKeyBytes: new Uint8Array(32).fill(1),
      plaintextBytes: new Uint8Array(32).fill(2),
      ciphertextBytes: new Uint8Array(32).fill(3),
    };

    expect(() =>
      assertNoLocalEncryptedDocumentPayloadMetadataLeak(unsafePayload),
    ).toThrow("forbidden local encrypted payload metadata");
  });

  it("rejects unsafe URL and URI key shapes during explicit metadata leak assertion", () => {
    const unsafeStorageUrlMetadata = {
      payloadId: "payload_unsafe",
      storageUrl: "opaque",
    };

    const unsafeContentUriMetadata = {
      payloadId: "payload_unsafe",
      contentUri: "opaque",
    };

    const unsafeFileUriMetadata = {
      payloadId: "payload_unsafe",
      fileUri: "opaque",
    };

    expect(() =>
      assertNoLocalEncryptedDocumentPayloadMetadataLeak(
        unsafeStorageUrlMetadata,
      ),
    ).toThrow("forbidden local encrypted payload metadata");
    expect(() =>
      assertNoLocalEncryptedDocumentPayloadMetadataLeak(unsafeContentUriMetadata),
    ).toThrow("forbidden local encrypted payload metadata");
    expect(() =>
      assertNoLocalEncryptedDocumentPayloadMetadataLeak(unsafeFileUriMetadata),
    ).toThrow("forbidden local encrypted payload metadata");
  });

  it("does not import clinical document references, share packets, consent, Supabase, persistence, filesystem, SecureStore, Expo, vault opening, crypto adapters, document decryption, OCR, AI, portal, BMDC, upload, sync, or React modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/domain/local-encrypted-payload/localEncryptedDocumentPayload.ts",
    );
    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    const forbiddenImports = [
      "../clinical-document",
      "clinicaldocumentreference",
      "../share-packet",
      "patientsharepacket",
      "../consent",
      "consentgrant",
      "supabase",
      "sqlite",
      "watermelondb",
      "filesystem",
      "expo-file-system",
      "securestore",
      "expo-secure-store",
      "expo-local-authentication",
      "vault-assembly",
      "localvaultassembly",
      "vault-open",
      "open-vault",
      "cryptosubtle",
      "aesgcmenvelopeadapter",
      "decrypt",
      "document-decryption",
      "ocr",
      "ai-summary",
      "openai",
      "anthropic",
      "llm",
      "doctor-portal",
      "patient-portal",
      "bmdc",
      "file-upload",
      "upload-service",
      "background-sync",
      "sync-engine",
      "from \"react\"",
      "from 'react'",
      "react-native",
      ".tsx",
    ];

    for (const token of forbiddenImports) {
      expect(source).not.toContain(token);
    }
  });
});


