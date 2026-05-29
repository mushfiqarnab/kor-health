import {
  isLocalDocumentMutationIntent,
  type LocalDocumentMutationIntent,
} from "./localDocumentMutationIntent";

export const LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND =
  "local_document_mutation_intent_result" as const;

export const LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS = {
  ACCEPTED: "accepted",
  REJECTED: "rejected",
} as const;

export const LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON = {
  INVALID_INTENT: "invalid_intent",
  UNSAFE_OPAQUE_VALUE: "unsafe_opaque_value",
  UNSUPPORTED_OPERATION: "unsupported_operation",
  INVALID_TIMESTAMP: "invalid_timestamp",
} as const;

export type LocalDocumentMutationIntentResultStatus =
  (typeof LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS)[keyof typeof LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS];

export type LocalDocumentMutationIntentRejectionReason =
  (typeof LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON)[keyof typeof LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON];

export type AcceptedLocalDocumentMutationIntentResult = Readonly<{
  kind: typeof LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND;
  status: typeof LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.ACCEPTED;
  intent: LocalDocumentMutationIntent;
  acceptedAtEpochMs: number;
}>;

export type RejectedLocalDocumentMutationIntentResult = Readonly<{
  kind: typeof LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND;
  status: typeof LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.REJECTED;
  reason: LocalDocumentMutationIntentRejectionReason;
}>;

export type LocalDocumentMutationIntentResult =
  | AcceptedLocalDocumentMutationIntentResult
  | RejectedLocalDocumentMutationIntentResult;

function isValidAcceptedAtEpochMs(value: unknown): value is number {
  return Number.isInteger(value) && value >= 0;
}

function isApprovedRejectionReason(
  value: unknown,
): value is LocalDocumentMutationIntentRejectionReason {
  return (
    value === LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON.INVALID_INTENT ||
    value ===
      LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON.UNSAFE_OPAQUE_VALUE ||
    value ===
      LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON.UNSUPPORTED_OPERATION ||
    value === LOCAL_DOCUMENT_MUTATION_INTENT_REJECTION_REASON.INVALID_TIMESTAMP
  );
}

export function createAcceptedLocalDocumentMutationIntentResult(input: {
  readonly intent: LocalDocumentMutationIntent;
  readonly acceptedAtEpochMs: number;
}): AcceptedLocalDocumentMutationIntentResult {
  return Object.freeze({
    kind: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND,
    status: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.ACCEPTED,
    intent: input.intent,
    acceptedAtEpochMs: input.acceptedAtEpochMs,
  });
}

export function createRejectedLocalDocumentMutationIntentResult(input: {
  readonly reason: LocalDocumentMutationIntentRejectionReason;
}): RejectedLocalDocumentMutationIntentResult {
  return Object.freeze({
    kind: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND,
    status: LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.REJECTED,
    reason: input.reason,
  });
}

function isAcceptedLocalDocumentMutationIntentResult(
  value: unknown,
): value is AcceptedLocalDocumentMutationIntentResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<AcceptedLocalDocumentMutationIntentResult>;

  if (candidate.kind !== LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND) {
    return false;
  }

  if (candidate.status !== LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.ACCEPTED) {
    return false;
  }

  if (!isLocalDocumentMutationIntent(candidate.intent)) {
    return false;
  }

  if (!isValidAcceptedAtEpochMs(candidate.acceptedAtEpochMs)) {
    return false;
  }

  return true;
}

function isRejectedLocalDocumentMutationIntentResult(
  value: unknown,
): value is RejectedLocalDocumentMutationIntentResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<RejectedLocalDocumentMutationIntentResult>;

  if (candidate.kind !== LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_KIND) {
    return false;
  }

  if (candidate.status !== LOCAL_DOCUMENT_MUTATION_INTENT_RESULT_STATUS.REJECTED) {
    return false;
  }

  if (!isApprovedRejectionReason(candidate.reason)) {
    return false;
  }

  return true;
}

export function isLocalDocumentMutationIntentResult(
  value: unknown,
): value is LocalDocumentMutationIntentResult {
  return (
    isAcceptedLocalDocumentMutationIntentResult(value) ||
    isRejectedLocalDocumentMutationIntentResult(value)
  );
}
