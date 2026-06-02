import {
  LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION,
  createLocalDocumentMutationIntent,
  isLocalDocumentMutationIntent,
  type LocalDocumentMutationIntentOperation,
} from "./localDocumentMutationIntent";

import {
  LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON,
  createAcceptedLocalDocumentMutationIntentResult,
  createRejectedLocalDocumentMutationIntentResult,
  type LocalDocumentMutationIntentResult,
} from "./localDocumentMutationIntentResult";

export type LocalDocumentMutationIntentCreationPolicyInput = Readonly<{
  intentId: string;
  targetRef: string;
  operation: LocalDocumentMutationIntentOperation;
  createdAtEpochMs: number;
  acceptedAtEpochMs: number;
  idempotencyKey?: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidEpochMs(value: unknown): value is number {
  return Number.isInteger(value) && value >= 0;
}

function isSupportedOperation(
  value: unknown,
): value is LocalDocumentMutationIntentOperation {
  return (
    value ===
    LOCAL_DOCUMENT_MUTATION_INTENT_OPERATION.SAVE_LOCAL_DOCUMENT_REFERENCE
  );
}

function hasRequiredInputShape(
  value: Record<string, unknown>,
): value is LocalDocumentMutationIntentCreationPolicyInput {
  return (
    typeof value.intentId === "string" &&
    typeof value.targetRef === "string" &&
    typeof value.createdAtEpochMs === "number" &&
    typeof value.acceptedAtEpochMs === "number" &&
    (value.idempotencyKey === undefined ||
      typeof value.idempotencyKey === "string")
  );
}

export function createLocalDocumentMutationIntentFromInput(
  input: unknown,
): LocalDocumentMutationIntentResult {
  if (!isRecord(input) || !hasRequiredInputShape(input)) {
    return createRejectedLocalDocumentMutationIntentResult({
      reason: LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON.INVALID_INTENT,
    });
  }

  if (!isSupportedOperation(input.operation)) {
    return createRejectedLocalDocumentMutationIntentResult({
      reason:
        LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON.UNSUPPORTED_OPERATION,
    });
  }

  if (
    !isValidEpochMs(input.createdAtEpochMs) ||
    !isValidEpochMs(input.acceptedAtEpochMs)
  ) {
    return createRejectedLocalDocumentMutationIntentResult({
      reason: LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON.INVALID_TIMESTAMP,
    });
  }

  const intent = createLocalDocumentMutationIntent({
    intentId: input.intentId,
    targetRef: input.targetRef,
    operation: input.operation,
    createdAtEpochMs: input.createdAtEpochMs,
    idempotencyKey: input.idempotencyKey,
  });

  if (!isLocalDocumentMutationIntent(intent)) {
    return createRejectedLocalDocumentMutationIntentResult({
      reason:
        LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON.UNSAFE_OPAQUE_VALUE,
    });
  }

  return createAcceptedLocalDocumentMutationIntentResult({
    intent,
    acceptedAtEpochMs: input.acceptedAtEpochMs,
  });
}
