import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURE_POLICY_KIND,
  LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_RETHROW,
  LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_NOT_OUTCOMES,
  LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_MAY_CLASSIFY_IN_PROCESS,
  createLocalDocumentSaveOutcomeRepositoryFailurePolicy,
  type LocalDocumentSaveOutcomeRepositoryFailurePolicy,
} from "../localDocumentSaveOutcomeRepositoryFailurePolicy";

function expectOnlyApprovedPolicyKeys(
  policy: LocalDocumentSaveOutcomeRepositoryFailurePolicy,
): void {
  expect(Object.keys(policy).sort()).toEqual([
    "classifications",
    "kind",
    "repositoryFailures",
    "scope",
  ]);
}

function expectPolicyToExposeNoSensitiveDetails(
  policy: LocalDocumentSaveOutcomeRepositoryFailurePolicy,
): void {
  const serialized = JSON.stringify(policy).toLowerCase();

  const forbiddenFragments = [
    "patient_01",
    "payload_01",
    "cdr_01",
    "doc_01",
    "ciphertext_01",
    "envelope_01",
    "01jaaa",
    "referenceid",
    "patientid",
    "resourceid",
    "payloadid",
    "encryptedpayloadref",
    "ciphertextref",
    "encryptionenveloperef",
    "filename",
    "filepath",
    "storagepath",
    "storageurl",
    "fileuri",
    "contenturi",
    "mimetype",
    "diagnosis",
    "prescription",
    "hba1c",
    "supabase",
    "sqlite",
    "watermelondb",
    "openai",
    "ocr",
    "stack",
    "message",
    '"cause":',
    "debug",
  ];

  for (const fragment of forbiddenFragments) {
    expect(serialized).not.toContain(fragment);
  }
}

function expectPolicyDoesNotClaimReceiptSafety(
  policy: LocalDocumentSaveOutcomeRepositoryFailurePolicy,
): void {
  const serialized = JSON.stringify(policy).toLowerCase();

  const forbiddenClaims = [
    "logsafe",
    "log-safe",
    "auditsafe",
    "audit-safe",
    "syncsafe",
    "sync-safe",
    "cloudsafe",
    "cloud-safe",
    "displaysafe",
    "display-safe",
    "notificationsafe",
    "notification-safe",
    "receiptid",
    "auditreceipt",
    "transactionid",
    "rollbackid",
    "mutationid",
    "syncid",
    "storagepath",
    "storageurl",
    "displaylabel",
    "displaymessage",
    "notificationpayload",
    "analytics",
    "telemetry",
  ];

  for (const claim of forbiddenClaims) {
    expect(serialized).not.toContain(claim);
  }
}

describe("Local document save outcome repository failure policy contract", () => {
  it("creates a frozen policy that keeps repository failures outside LocalDocumentSaveOutcome values", () => {
    const policy = createLocalDocumentSaveOutcomeRepositoryFailurePolicy();

    expect(policy).toEqual({
      kind: LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURE_POLICY_KIND,
      scope: "local_document_save_outcome_wrapper",
      repositoryFailures: LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_RETHROW,
      classifications:
        LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_MAY_CLASSIFY_IN_PROCESS,
    });

    expect(Object.isFrozen(policy)).toBe(true);
    expectOnlyApprovedPolicyKeys(policy);
    expectPolicyToExposeNoSensitiveDetails(policy);
    expectPolicyDoesNotClaimReceiptSafety(policy);
  });

  it("uses explicit constants for the outcome-wrapper repository failure decision", () => {
    expect(LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURE_POLICY_KIND).toBe(
      "local_document_save_outcome_repository_failure_policy",
    );

    expect(LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_RETHROW).toBe(
      "repository_failures_rethrow_original_cause",
    );

    expect(
      LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_NOT_OUTCOMES,
    ).toBe("repository_failures_are_not_outcome_values");

    expect(
      LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_MAY_CLASSIFY_IN_PROCESS,
    ).toBe("repository_failures_may_classify_in_process_only");
  });

  it("does not define repository failure statuses for LocalDocumentSaveOutcome", () => {
    const policy = createLocalDocumentSaveOutcomeRepositoryFailurePolicy();
    const serialized = JSON.stringify(policy).toLowerCase();

    const forbiddenOutcomeStatuses = [
      "repository_failed",
      "repository_failure_outcome",
      "repository_failure_status",
      "repository_failure_value",
      "repository_failure_result",
      "failed_outcome",
      "error_outcome",
      "exception_outcome",
      "payload_save_failed",
      "reference_save_failed",
      "local_encrypted_document_payload_save",
      "clinical_document_reference_save",
      "unknown_repository_failure",
      "completed",
      "rejected",
      "rejectionreason",
    ];

    for (const status of forbiddenOutcomeStatuses) {
      expect(serialized).not.toContain(status);
    }

    expect(LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_NOT_OUTCOMES).toBe(
      "repository_failures_are_not_outcome_values",
    );
  });

  it("keeps the existing outcome boundary preflight-only and free from repository failure variants", () => {
    const outcomeSource = readFileSync(
      resolve(
        process.cwd(),
        "src/application/local-document-save/localDocumentSaveOutcome.ts",
      ),
      "utf8",
    ).toLowerCase();

    expect(outcomeSource).toContain("completed");
    expect(outcomeSource).toContain("rejected");
    expect(outcomeSource).toContain("localdocumentsavepreflightfailurereason");

    const forbiddenOutcomeSourceTokens = [
      "repository_failed",
      "repository_failure_outcome",
      "repository_failure_status",
      "repository_failure_value",
      "repository_failure_result",
      "local_document_repository_failure",
      "local_encrypted_document_payload_save",
      "clinical_document_reference_save",
      "unknown_repository_failure",
      "localdocumentrepositoryfailureclassification",
      "onrepositoryfailureclassification",
      "throw",
      "catch",
    ];

    for (const token of forbiddenOutcomeSourceTokens) {
      expect(outcomeSource).not.toContain(token);
    }
  });

  it("keeps the outcome wrapper from catching repository failures or converting them into outcomes", () => {
    const wrapperSource = readFileSync(
      resolve(
        process.cwd(),
        "src/application/local-document-save/localDocumentSaveOutcomeUseCase.ts",
      ),
      "utf8",
    );

    const lowerWrapperSource = wrapperSource.toLowerCase();

    expect(wrapperSource).toContain("prepareLocalDocumentSave");
    expect(wrapperSource).toContain("saveLocalDocumentReferences");
    expect(wrapperSource).toContain("createRejectedLocalDocumentSaveOutcome");
    expect(wrapperSource).toContain("createCompletedLocalDocumentSaveOutcome");

    const forbiddenWrapperTokens = [
      ".catch(",
      "try {",
      "catch {",
      "catch (",
      "repository_failed",
      "repository_failure_outcome",
      "repository_failure_status",
      "repository_failure_value",
      "repository_failure_result",
      "local_document_repository_failure",
      "LocalDocumentRepositoryFailureClassification",
      "classifyAndRethrowLocalDocumentRepositoryFailure",
      "LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE",
      "LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE",
      "createRejectedLocalDocumentSaveOutcome({ rejectionReason: \"repository",
      "unknown_repository_failure",
      "payload_save_failed",
      "reference_save_failed",
    ];

    for (const token of forbiddenWrapperTokens) {
      expect(lowerWrapperSource).not.toContain(token.toLowerCase());
    }
  });

  it("keeps the policy module free from imports, repository ports, save use cases, infrastructure, storage, cloud, sync, audit, crypto adapter, AI, OCR, UI, telemetry, and readable metadata concerns", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/application/local-document-save/localDocumentSaveOutcomeRepositoryFailurePolicy.ts",
    );

    const source = readFileSync(sourcePath, "utf8");
    const lowerSource = source.toLowerCase();

    expect(source).toContain(
      "LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURE_POLICY_KIND",
    );
    expect(source).toContain(
      "LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_RETHROW",
    );
    expect(source).toContain(
      "LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_NOT_OUTCOMES",
    );
    expect(source).toContain(
      "LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_MAY_CLASSIFY_IN_PROCESS",
    );
    expect(source).toContain(
      "createLocalDocumentSaveOutcomeRepositoryFailurePolicy",
    );
    expect(source).toContain("Object.freeze");

    const forbiddenSourceTokens = [
      "from \"",
      "from '",
      "LocalDocumentRepositoryPort",
      "saveLocalDocumentReferences",
      "saveLocalDocumentReferencesWithOutcome",
      "prepareLocalDocumentSave",
      "from \"./localDocumentSaveOutcome\"",
      "from './localDocumentSaveOutcome'",
      "LocalDocumentRepositoryFailureClassification",
      "classifyAndRethrowLocalDocumentRepositoryFailure",
      "classifyLocalDocumentRepositoryFailure",
      "createCompletedLocalDocumentSaveOutcome",
      "createRejectedLocalDocumentSaveOutcome",
      "createCompletedLocalDocumentSaveResult",
      "createClinicalDocumentReference",
      "createLocalEncryptedDocumentPayload",
      "saveLocalEncryptedDocumentPayload",
      "saveClinicalDocumentReference",
      "isClinicalDocumentReferenceActive",
      "isLocalEncryptedDocumentPayloadActive",
      "patient_id_mismatch",
      "encrypted_payload_ref_mismatch",
      "clinical_document_reference_inactive",
      "local_encrypted_document_payload_inactive",
      "patientId",
      "referenceId",
      "resourceId",
      "payloadId",
      "encryptedPayloadRef",
      "ciphertextRef",
      "encryptionEnvelopeRef",
      "instanceof",
      ".message",
      ".stack",
      "String(",
      "JSON.stringify",
      "Object.keys",
      "Object.values",
      "Object.entries",
      "console.",
      "logger",
      "log(",
      "warn(",
      "console.error(",
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
      "localVaultAssembly",
      "vault-open",
      "open-vault",
      "aesGcmEnvelopeAdapter",
      "cryptoSubtle",
      "encrypt(",
      "decrypt(",
      "document-decryption",
      "transaction",
      "rollback",
      "idempotency",
      "mutation",
      "syncsafe",
      "sync-engine",
      "background-sync",
      "syncid",
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
      "audit",
      "receipt",
      "logsafe",
      "auditsafe",
      "displaysafe",
      "notificationsafe",
      "cloudsafe",
      "displaylabel",
      "displaymessage",
      "notificationpayload",
      "analytics",
      "telemetry",
      "date.now",
      "new date",
    ];

    for (const token of forbiddenSourceTokens) {
      expect(lowerSource).not.toContain(token.toLowerCase());
    }
  });
});







