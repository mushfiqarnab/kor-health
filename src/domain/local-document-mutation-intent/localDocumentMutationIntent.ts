export const LOCAL_DOCUMENT_MUTATION_INTENT_SCHEMA_VERSION = 1 as const;

export const LOCAL_DOCUMENT_MUTATION_INTENT_KIND =
  "local_document_mutation_intent" as const;

export const LOCAL_DOCUMENT_MUTATION_INTENT_TARGET_KIND = {
  LOCAL_DOCUMENT_REFERENCE: "local_document_reference",
} as const;

export const LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION = {
  SAVE_LOCAL_DOCUMENT_REFERENCE: "save_local_document_reference",
} as const;

export type LocalDocumentMutationIntentTargetKind =
  (typeof LOCAL_DOCUMENT_MUTATION_INTENT_TARGET_KIND)[keyof typeof LOCAL_DOCUMENT_MUTATION_INTENT_TARGET_KIND];

export type LocalDocumentMutationIntentOperation =
  (typeof LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION)[keyof typeof LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION];

export type LocalDocumentMutationIntentInput = Readonly<{
  intentId: string;
  targetRef: string;
  operation: LocalDocumentMutationIntentOperation;
  createdAtEpochMs: number;
  idempotencyKey?: string;
}>;

export type LocalDocumentMutationIntent = Readonly<{
  kind: typeof LOCAL_DOCUMENT_MUTATION_INTENT_KIND;
  schemaVersion: typeof LOCAL_DOCUMENT_MUTATION_INTENT_SCHEMA_VERSION;
  targetKind: typeof LOCAL_DOCUMENT_MUTATION_INTENT_TARGET_KIND.LOCAL_DOCUMENT_REFERENCE;
  intentId: string;
  targetRef: string;
  operation: LocalDocumentMutationIntentOperation;
  createdAtEpochMs: number;
  idempotencyKey?: string;
}>;

function isSafeOpaqueValue(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  if (value.length < 8 || value.length > 96) {
    return false;
  }

  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    return false;
  }

  const lowerValue = value.toLowerCase();

  const forbiddenFragments = [
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

  for (const fragment of forbiddenFragments) {
    if (lowerValue.includes(fragment)) {
      return false;
    }
  }

  return true;
}

function isValidCreatedAtEpochMs(value: unknown): value is number {
  return Number.isInteger(value) && value >= 0;
}

function isApprovedOperation(
  value: unknown,
): value is LocalDocumentMutationIntentOperation {
  return (
    value ===
    LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION.SAVE_LOCAL_DOCUMENT_REFERENCE
  );
}

export function createLocalDocumentMutationIntent(
  input: LocalDocumentMutationIntentInput,
): LocalDocumentMutationIntent {
  const baseIntent = {
    kind: LOCAL_DOCUMENT_MUTATION_INTENT_KIND,
    schemaVersion: LOCAL_DOCUMENT_MUTATION_INTENT_SCHEMA_VERSION,
    targetKind:
      LOCAL_DOCUMENT_MUTATION_INTENT_TARGET_KIND.LOCAL_DOCUMENT_REFERENCE,
    intentId: input.intentId,
    targetRef: input.targetRef,
    operation: input.operation,
    createdAtEpochMs: input.createdAtEpochMs,
  };

  if (input.idempotencyKey === undefined) {
    return Object.freeze(baseIntent);
  }

  return Object.freeze({
    ...baseIntent,
    idempotencyKey: input.idempotencyKey,
  });
}

export function isLocalDocumentMutationIntent(
  value: unknown,
): value is LocalDocumentMutationIntent {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<LocalDocumentMutationIntent>;

  if (candidate.kind !== LOCAL_DOCUMENT_MUTATION_INTENT_KIND) {
    return false;
  }

  if (
    candidate.schemaVersion !== LOCAL_DOCUMENT_MUTATION_INTENT_SCHEMA_VERSION
  ) {
    return false;
  }

  if (
    candidate.targetKind !==
    LOCAL_DOCUMENT_MUTATION_INTENT_TARGET_KIND.LOCAL_DOCUMENT_REFERENCE
  ) {
    return false;
  }

  if (!isSafeOpaqueValue(candidate.intentId)) {
    return false;
  }

  if (!isSafeOpaqueValue(candidate.targetRef)) {
    return false;
  }

  if (!isApprovedOperation(candidate.operation)) {
    return false;
  }

  if (!isValidCreatedAtEpochMs(candidate.createdAtEpochMs)) {
    return false;
  }

  if (
    candidate.idempotencyKey !== undefined &&
    !isSafeOpaqueValue(candidate.idempotencyKey)
  ) {
    return false;
  }

  return true;
}
