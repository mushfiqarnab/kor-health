import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND,
  LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS,
  LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON,
  createAcceptedLocalDocumentMutationIntentResult,
  createRejectedLocalDocumentMutationIntentResult,
  isLocalDocumentMutationIntentResult,
  type LocalDocumentMutationIntentResult,
} from "../localDocumentMutationIntentResult";

import {
  LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION,
  createLocalDocumentMutationIntent,
} from "../localDocumentMutationIntent";

const acceptedAtEpochMs = 1_800_000_000_000;

function createIntent() {
  return createLocalDocumentMutationIntent({
    intentId: "ldmi_01JLOCALMUTATIONINTENT000000000001",
    targetRef: "resource_ref_01JLOCALDOCUMENT000000000001",
    operation: LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION.SAVE_LOCAL_DOCUMENT_REFERENCE,
    createdAtEpochMs: acceptedAtEpochMs,
    idempotencyKey: "idem_01JLOCALMUTATIONINTENT000000001",
  });
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
  ];

  for (const fragment of forbiddenFragments) {
    expect(lower).not.toContain(fragment);
  }
}

describe("LocalDocumentMutationIntentResult contract", () => {
  it("creates a frozen accepted result for a validated mutation intent", () => {
    const intent = createIntent();

    const result = createAcceptedLocalDocumentMutationIntentResult({
      intent,
      acceptedAtEpochMs,
    });

    expect(result).toEqual({
      kind: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND,
      status: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.ACCEPTED,
      intent,
      acceptedAtEpochMs,
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(isLocalDocumentMutationIntentResult(result)).toBe(true);
    expectNoSensitiveFragments(JSON.stringify(result));
  });

  it("creates a frozen rejected result with only approved rejection reasons", () => {
    const result = createRejectedLocalDocumentMutationIntentResult({
      reason:
        LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON.UNSAFE_OPAQUE_VALUE,
    });

    expect(result).toEqual({
      kind: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND,
      status: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.REJECTED,
      reason:
        LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON.UNSAFE_OPAQUE_VALUE,
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(isLocalDocumentMutationIntentResult(result)).toBe(true);
    expectNoSensitiveFragments(JSON.stringify(result));
  });

  it("rejects malformed accepted and rejected result shapes", () => {
    const intent = createIntent();

    const invalidValues = [
      {},
      null,
      undefined,
      {
        kind: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND,
        status: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.ACCEPTED,
        acceptedAtEpochMs,
      },
      {
        kind: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND,
        status: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.ACCEPTED,
        intent,
        acceptedAtEpochMs: -1,
      },
      {
        kind: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND,
        status: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.REJECTED,
        reason: "database_error",
      },
      {
        kind: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND,
        status: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.REJECTED,
        reason: "sync_error",
      },
      {
        kind: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND,
        status: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.REJECTED,
        reason: "patient_error",
      },
      {
        kind: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND,
        status: "logged",
        intent,
        acceptedAtEpochMs,
      },
    ];

    for (const value of invalidValues) {
      expect(isLocalDocumentMutationIntentResult(value)).toBe(false);
    }
  });

  it("uses only approved status and rejection reason constants", () => {
    expect(LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND).toBe(
      "local_document_mutation_intent_result",
    );

    expect(LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS).toEqual({
      ACCEPTED: "accepted",
      REJECTED: "rejected",
    });

    expect(LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON).toEqual({
      INVALID_INTENT: "invalid_intent",
      UNSAFE_OPAQUE_VALUE: "unsafe_opaque_value",
      UNSUPPORTED_OPERATION: "unsupported_operation",
      INVALID_TIMESTAMP: "invalid_timestamp",
    });
  });

  it("keeps the result source pure and free from persistence, sync, audit, logging, display, cloud, AI, OCR, telemetry, analytics, and clinical metadata", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/domain/local-document-mutation-intent/localDocumentMutationIntentResult.ts",
    );

    const source = readFileSync(sourcePath, "utf8");
    const lower = source.toLowerCase();

    const requiredSourceTokens = [
      "LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND",
      "LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS",
      "LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON",
      "createAcceptedLocalDocumentMutationIntentResult",
      "createRejectedLocalDocumentMutationIntentResult",
      "isLocalDocumentMutationIntentResult",
      "Object.freeze",
      "isLocalDocumentMutationIntent",
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
    ];

    for (const token of forbiddenSourceTokens) {
      expect(source).not.toContain(token);
    }

    const forbiddenBehaviorClaims = [
      "log",
      "audit",
      "sync",
      "replay",
      "telemetry",
      "analytics",
      "notification",
      "display",
      "cloud",
      "database",
      "storage",
    ];

    for (const claim of forbiddenBehaviorClaims) {
      expect(lower).not.toContain(`${claim}_`);
      expect(lower).not.toContain(`_${claim}`);
    }
  });
});
