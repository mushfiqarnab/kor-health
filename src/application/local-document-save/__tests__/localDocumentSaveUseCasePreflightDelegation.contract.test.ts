import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Local document save use case preflight delegation contract", () => {
  it("delegates validation to the local document save preflight decision instead of duplicating validation law", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/application/local-document-save/localDocumentSaveUseCase.ts",
    );

    const source = readFileSync(sourcePath, "utf8");
    const lowerSource = source.toLowerCase();

    expect(source).toContain("prepareLocalDocumentSave");
    expect(source).toContain("LocalDocumentSavePreflightFailureReason");
    expect(source).toContain("localDocumentSavePreflight");

    expect(source).not.toContain("isClinicalDocumentReferenceActive");
    expect(source).not.toContain("isLocalEncryptedDocumentPayloadActive");

    expect(source).not.toContain("assertPatientIdsMatch");
    expect(source).not.toContain("assertPayloadReferenceMatches");
    expect(source).not.toContain("assertReferencesAreActive");

    expect(lowerSource).not.toContain("patientid !==");
    expect(lowerSource).not.toContain("encryptedpayloadref !==");
    expect(lowerSource).not.toContain("localencrypteddocumentpayload.payloadid");
    expect(lowerSource).not.toContain("revokedatepochms");
    expect(lowerSource).not.toContain("deletedatepochms");
  });

  it("keeps the production use case free from infrastructure, storage, cloud, sync, crypto adapter, AI, OCR, UI, and domain factory concerns", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/application/local-document-save/localDocumentSaveUseCase.ts",
    );

    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    const forbiddenSourceTokens = [
      "inmemorylocaldocumentrepository",
      "createinmemorylocaldocumentrepository",
      "createclinicaldocumentreference",
      "createlocalencrypteddocumentpayload",
      "patientsharepacket",
      "sharepacket",
      "supabase",
      "sqlite",
      "watermelondb",
      "filesystem",
      "expo-file-system",
      "securestore",
      "expo-secure-store",
      "expo-local-authentication",
      "localstorage",
      "sessionstorage",
      "asyncstorage",
      "indexeddb",
      "mmkv",
      "vault-assembly",
      "localvaultassembly",
      "vault-open",
      "open-vault",
      "aesgcmenvelopeadapter",
      "cryptosubtle",
      "encrypt(",
      "decrypt(",
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
      "schema",
      "sql",
      "migration",
      "table",
      "index",
      "filename",
      "filepath",
      "storagepath",
      "storageurl",
      "fileuri",
      "contenturi",
      "mimetype",
      "plaintextbytes",
      "ciphertextbytes",
      "diagnosis",
      "prescription",
      "hba1c",
      "date.now",
      "new date",
    ];

    for (const token of forbiddenSourceTokens) {
      expect(source).not.toContain(token);
    }
  });
});

