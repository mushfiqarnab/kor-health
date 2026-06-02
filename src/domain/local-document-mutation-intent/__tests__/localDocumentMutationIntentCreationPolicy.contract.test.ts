import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createLocalDocumentMutationIntentFromInput,
  type LocalDocumentMutationIntentCreationPolicyInput,
} from "../localDocumentMutationIntentCreationPolicy";

import {
  LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION,
} from "../localDocumentMutationIntent";

import {
  LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON,
  LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND,
  LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS,
  isLocalDocumentMutationIntentResult,
} from "../localDocumentMutationIntentResult";

const createdAtEpochMs = 1_800_000_000_000;
const acceptedAtEpochMs = 1_800_000_000_111;

function createValidInput(
  overrides: Partial<LocalDocumentMutationIntentCreationPolicyInput> = {},
): LocalDocumentMutationIntentCreationPolicyInput {
  return {
    intentId: "ldmi_01JLOCALMUTATIONINTENT000000000001",
    targetRef: "resource_ref_01JLOCALDOCUMENT000000000001",
    operation:
      LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION.SAVE_LOCAL_DOCUMENT_REFERENCE,
    createdAtEpochMs,
    acceptedAtEpochMs,
    idempotencyKey: "idem_01JLOCALMUTATIONINTENT000000001",
    ...overrides,
  };
}

function expectNoSensitiveFragments(serialized: string): void {
  const lower = serialized.toLowerCase();

  const forbiddenFragments = [
    "patient",
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
    "database",
    "storage",
    "error:",
    "stack",
    "message",
    "exception",
    "cause",
  ];

  for (const fragment of forbiddenFragments) {
    expect(lower).not.toContain(fragment);
  }
}

describe("LocalDocumentMutationIntentCreationPolicy contract", () => {
  it("accepts valid raw input as a frozen accepted mutation intent result", () => {
    const result = createLocalDocumentMutationIntentFromInput(
      createValidInput(),
    );

    expect(result.kind).toBe(LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND);
    expect(result.status).toBe(
      LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.ACCEPTED,
    );

    if (result.status !== LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.ACCEPTED) {
      throw new Error("Expected accepted result.");
    }

    expect(result.acceptedAtEpochMs).toBe(acceptedAtEpochMs);
    expect(result.intent).toEqual({
      kind: "local_document_mutation_intent",
      schemaVersion: 1,
      targetKind: "local_document_reference",
      intentId: "ldmi_01JLOCALMUTATIONINTENT000000000001",
      targetRef: "resource_ref_01JLOCALDOCUMENT000000000001",
      operation:
        LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION.SAVE_LOCAL_DOCUMENT_REFERENCE,
      createdAtEpochMs,
      idempotencyKey: "idem_01JLOCALMUTATIONINTENT000000001",
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(isLocalDocumentMutationIntentResult(result)).toBe(true);
    expectNoSensitiveFragments(JSON.stringify(result));
  });

  it("rejects malformed input as invalid_intent without raw error details", () => {
    const invalidInputs = [
      null,
      undefined,
      {},
      "not_an_object",
      [],
      { intentId: "ldmi_01JLOCALMUTATIONINTENT000000000001" },
    ];

    for (const input of invalidInputs) {
      const result = createLocalDocumentMutationIntentFromInput(
        input as LocalDocumentMutationIntentCreationPolicyInput,
      );

      expect(result).toEqual({
        kind: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND,
        status: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.REJECTED,
        reason: LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON.INVALID_INTENT,
      });

      expect(Object.isFrozen(result)).toBe(true);
      expect(isLocalDocumentMutationIntentResult(result)).toBe(true);
      expectNoSensitiveFragments(JSON.stringify(result));
    }
  });

  it("rejects unsafe opaque values without exposing the unsafe value", () => {
    const unsafeInputs = [
      createValidInput({ intentId: "patient_01" }),
      createValidInput({ targetRef: "diagnosis_report_01" }),
      createValidInput({ idempotencyKey: "filename_report_pdf" }),
    ];

    for (const input of unsafeInputs) {
      const result = createLocalDocumentMutationIntentFromInput(input);

      expect(result).toEqual({
        kind: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND,
        status: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.REJECTED,
        reason:
          LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON.UNSAFE_OPAQUE_VALUE,
      });

      expect(Object.isFrozen(result)).toBe(true);
      expect(isLocalDocumentMutationIntentResult(result)).toBe(true);
      expectNoSensitiveFragments(JSON.stringify(result));
    }
  });

  it("rejects unsupported operation without creating sync, audit, storage, or clinical error reasons", () => {
    const result = createLocalDocumentMutationIntentFromInput(
      createValidInput({ operation: "delete_everything" as never }),
    );

    expect(result).toEqual({
      kind: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND,
      status: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.REJECTED,
      reason:
        LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON.UNSUPPORTED_OPERATION,
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(isLocalDocumentMutationIntentResult(result)).toBe(true);
    expectNoSensitiveFragments(JSON.stringify(result));
  });

  it("rejects invalid created or accepted timestamps without generating timestamps", () => {
    const invalidTimestampInputs = [
      createValidInput({ createdAtEpochMs: -1 }),
      createValidInput({ createdAtEpochMs: Number.NaN }),
      createValidInput({ createdAtEpochMs: Number.POSITIVE_INFINITY }),
      createValidInput({ acceptedAtEpochMs: -1 }),
      createValidInput({ acceptedAtEpochMs: Number.NaN }),
      createValidInput({ acceptedAtEpochMs: Number.POSITIVE_INFINITY }),
    ];

    for (const input of invalidTimestampInputs) {
      const result = createLocalDocumentMutationIntentFromInput(input);

      expect(result).toEqual({
        kind: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND,
        status: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.REJECTED,
        reason:
          LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON.INVALID_TIMESTAMP,
      });

      expect(Object.isFrozen(result)).toBe(true);
      expect(isLocalDocumentMutationIntentResult(result)).toBe(true);
      expectNoSensitiveFragments(JSON.stringify(result));
    }
  });

  it("keeps the creation policy source pure and free from persistence, sync, audit, logging, display, cloud, AI, OCR, telemetry, analytics, and clinical metadata", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/domain/local-document-mutation-intent/localDocumentMutationIntentCreationPolicy.ts",
    );

    const source = readFileSync(sourcePath, "utf8");
    const lower = source.toLowerCase();

    const requiredSourceTokens = [
      "createLocalDocumentMutationIntentFromInput",
      "createLocalDocumentMutationIntent",
      "isLocalDocumentMutationIntent",
      "createAcceptedLocalDocumentMutationIntentResult",
      "createRejectedLocalDocumentMutationIntentResult",
      "LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON",
      "LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION",
    ];

    for (const token of requiredSourceTokens) {
      expect(source).toContain(token);
    }

    const forbiddenSourceTokens = [
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
      "message:",
      "stack:",
      "cause:",
      "throw new Error",
    ];

    for (const token of forbiddenSourceTokens) {
      expect(source).not.toContain(token);
    }

    const forbiddenBehaviorClaims = [
      "log_",
      "_log",
      "audit_",
      "_audit",
      "sync_",
      "_sync",
      "replay_",
      "_replay",
      "telemetry_",
      "_telemetry",
      "analytics_",
      "_analytics",
      "notification_",
      "_notification",
      "display_",
      "_display",
      "cloud_",
      "_cloud",
      "database_",
      "_database",
      "storage_",
      "_storage",
    ];

    for (const claim of forbiddenBehaviorClaims) {
      expect(lower).not.toContain(claim);
    }
  });
});
