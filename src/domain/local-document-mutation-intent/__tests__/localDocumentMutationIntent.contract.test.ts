import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  LOCAL_DOCUMENT_MUTATION_INTENT_SCHEMA_VERSION,
  LOCAL_DOCUMENT_MUTATION_INTENT_KIND,
  LOCAL_DOCUMENT_MUTATION_INTENT_TARGET_KIND,
  LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION,
  createLocalDocumentMutationIntent,
  isLocalDocumentMutationIntent,
  type LocalDocumentMutationIntent,
} from "../localDocumentMutationIntent";

const createdAtEpochMs = 1_800_000_000_000;

function createValidIntent(
  overrides: Partial<Parameters<typeof createLocalDocumentMutationIntent>[0]> = {},
): LocalDocumentMutationIntent {
  return createLocalDocumentMutationIntent({
    intentId: "ldmi_01JLOCALMUTATIONINTENT000000000001",
    targetRef: "resource_ref_01JLOCALDOCUMENT000000000001",
    operation: LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION.SAVE_LOCAL_DOCUMENT_REFERENCE,
    createdAtEpochMs,
    idempotencyKey: "idem_01JLOCALMUTATIONINTENT000000001",
    ...overrides,
  });
}

function expectNoSensitiveFragments(serialized: string): void {
  const lower = serialized.toLowerCase();

  const forbiddenFragments = [
    "patient_01",
    "patientid",
    "patient_id",
    "doctor",
    "bmdc",
    "diagnosis",
    "prescription",
    "hba1c",
    "ocr",
    "ai",
    "summary",
    "filename",
    "filepath",
    "fileuri",
    "contenturi",
    "storagepath",
    "storageurl",
    "supabase",
    "sqlite",
    "watermelondb",
    "sync",
    "replay",
    "audit",
    "telemetry",
    "analytics",
    "notification",
    "display",
    "cloud",
    "ciphertext",
    "plaintext",
    "mimetype",
  ];

  for (const fragment of forbiddenFragments) {
    expect(lower).not.toContain(fragment);
  }
}

describe("LocalDocumentMutationIntent contract", () => {
  it("creates a frozen opaque local document mutation intent", () => {
    const intent = createValidIntent();

    expect(intent).toEqual({
      kind: LOCAL_DOCUMENT_MUTATION_INTENT_KIND,
      schemaVersion: LOCAL_DOCUMENT_MUTATION_INTENT_SCHEMA_VERSION,
      targetKind: LOCAL_DOCUMENT_MUTATION_INTENT_TARGET_KIND.LOCAL_DOCUMENT_REFERENCE,
      intentId: "ldmi_01JLOCALMUTATIONINTENT000000000001",
      targetRef: "resource_ref_01JLOCALDOCUMENT000000000001",
      operation: LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION.SAVE_LOCAL_DOCUMENT_REFERENCE,
      createdAtEpochMs,
      idempotencyKey: "idem_01JLOCALMUTATIONINTENT000000001",
    });

    expect(Object.isFrozen(intent)).toBe(true);
    expect(isLocalDocumentMutationIntent(intent)).toBe(true);
    expectNoSensitiveFragments(JSON.stringify(intent));
  });

  it("supports omission of idempotency key without adding persistence or sync claims", () => {
    const intent = createValidIntent({ idempotencyKey: undefined });

    expect(intent).toEqual({
      kind: LOCAL_DOCUMENT_MUTATION_INTENT_KIND,
      schemaVersion: LOCAL_DOCUMENT_MUTATION_INTENT_SCHEMA_VERSION,
      targetKind: LOCAL_DOCUMENT_MUTATION_INTENT_TARGET_KIND.LOCAL_DOCUMENT_REFERENCE,
      intentId: "ldmi_01JLOCALMUTATIONINTENT000000000001",
      targetRef: "resource_ref_01JLOCALDOCUMENT000000000001",
      operation: LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION.SAVE_LOCAL_DOCUMENT_REFERENCE,
      createdAtEpochMs,
    });

    expect(Object.keys(intent).sort()).toEqual([
      "createdAtEpochMs",
      "intentId",
      "kind",
      "operation",
      "schemaVersion",
      "targetKind",
      "targetRef",
    ]);

    expectNoSensitiveFragments(JSON.stringify(intent));
  });

  it("rejects invalid or non-opaque inputs without throwing sensitive details", () => {
    const invalidInputs = [
      {},
      null,
      undefined,
      createValidIntent({ intentId: "" }),
      createValidIntent({ intentId: "patient_01" }),
      createValidIntent({ targetRef: "" }),
      createValidIntent({ targetRef: "diagnosis_report_01" }),
      createValidIntent({ createdAtEpochMs: -1 }),
      createValidIntent({ createdAtEpochMs: Number.NaN }),
      createValidIntent({ createdAtEpochMs: Number.POSITIVE_INFINITY }),
      createValidIntent({ operation: "delete_everything" as never }),
      createValidIntent({ idempotencyKey: "" }),
      createValidIntent({ idempotencyKey: "filename_report.pdf" }),
    ];

    for (const value of invalidInputs) {
      expect(isLocalDocumentMutationIntent(value)).toBe(false);
    }
  });

  it("uses only approved constants for schema, kind, target kind, and operation", () => {
    expect(LOCAL_DOCUMENT_MUTATION_INTENT_SCHEMA_VERSION).toBe(1);
    expect(LOCAL_DOCUMENT_MUTATION_INTENT_KIND).toBe(
      "local_document_mutation_intent",
    );

    expect(LOCAL_DOCUMENT_MUTATION_INTENT_TARGET_KIND).toEqual({
      LOCAL_DOCUMENT_REFERENCE: "local_document_reference",
    });

    expect(LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION).toEqual({
      SAVE_LOCAL_DOCUMENT_REFERENCE: "save_local_document_reference",
    });
  });

  it("keeps the domain source pure and free from imports, side effects, infrastructure calls, and clinical metadata fields", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/domain/local-document-mutation-intent/localDocumentMutationIntent.ts",
    );

    const source = readFileSync(sourcePath, "utf8");
    const lower = source.toLowerCase();

    const requiredSourceTokens = [
      "LOCAL_DOCUMENT_MUTATION_INTENT_SCHEMA_VERSION",
      "LOCAL_DOCUMENT_MUTATION_INTENT_KIND",
      "LOCAL_DOCUMENT_MUTATION_INTENT_TARGET_KIND",
      "LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION",
      "createLocalDocumentMutationIntent",
      "isLocalDocumentMutationIntent",
      "Object.freeze",
      "forbiddenFragments",
    ];

    for (const token of requiredSourceTokens) {
      expect(source).toContain(token);
    }

    const forbiddenSourceTokens = [
      "from \"",
      "from '",
      "import ",
      "export *",
      "logger",
      "console",
      "fetch(",
      "XMLHttpRequest",
      "WebSocket",
      "setTimeout(",
      "setInterval(",
      "Date.now",
      "new Date",
      "Math.random",
      "crypto",
      "localStorage",
      "sessionStorage",
      "indexedDB",
      "AsyncStorage",
      "SecureStore",
      "FileSystem",
      "expo-",
      "react-native",
      ".tsx",
      ".jsx",
      "createClient",
      "supabase.",
      "sqlite.",
      "watermelon.",
      "database.",
      "db.",
      "sql`",
      "INSERT ",
      "UPDATE ",
      "DELETE ",
      "SELECT ",
      "upload(",
      "download(",
      "openai.",
      "anthropic.",
      "patientId",
      "patient_id:",
      "doctorId",
      "doctor_id:",
      "bmdcNumber",
      "diagnosis:",
      "prescription:",
      "filename:",
      "filePath",
      "fileUri",
      "contentUri",
      "storagePath",
      "storageUrl",
      "mimeType",
      "plaintextBytes",
      "ciphertextBytes",
    ];

    for (const token of forbiddenSourceTokens) {
      expect(source).not.toContain(token);
    }

    const allowedDefensiveFragments = [
      "patient",
      "doctor",
      "bmdc",
      "diagnosis",
      "prescription",
      "hba1c",
      "ocr",
      "summary",
      "filename",
      "filepath",
      "fileuri",
      "contenturi",
      "storagepath",
      "storageurl",
      "supabase",
      "sqlite",
      "watermelondb",
      "sync",
      "replay",
      "audit",
      "telemetry",
      "analytics",
      "notification",
      "display",
      "cloud",
      "ciphertext",
      "plaintext",
      "mimetype",
    ];

    for (const fragment of allowedDefensiveFragments) {
      expect(lower).toContain(`"${fragment}"`);
    }
  });
});
