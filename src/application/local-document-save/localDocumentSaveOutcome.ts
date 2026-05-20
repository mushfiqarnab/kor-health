import type { LocalDocumentSavePreflightFailureReason } from "./localDocumentSavePreflight";

import type { LocalDocumentSaveResult } from "./localDocumentSaveResult";

export const LOCAL_DOCUMENT_SAVE_OUTCOME_COMPLETED_STATUS = "completed" as const;

export const LOCAL_DOCUMENT_SAVE_OUTCOME_REJECTED_STATUS = "rejected" as const;

export interface CreateCompletedLocalDocumentSaveOutcomeInput {
  readonly result: LocalDocumentSaveResult;
}

export interface CreateRejectedLocalDocumentSaveOutcomeInput {
  readonly rejectionReason: LocalDocumentSavePreflightFailureReason;
}

export type LocalDocumentSaveOutcome =
  | {
      readonly status: typeof LOCAL_DOCUMENT_SAVE_OUTCOME_COMPLETED_STATUS;
      readonly result: LocalDocumentSaveResult;
    }
  | {
      readonly status: typeof LOCAL_DOCUMENT_SAVE_OUTCOME_REJECTED_STATUS;
      readonly rejectionReason: LocalDocumentSavePreflightFailureReason;
    };

export function createCompletedLocalDocumentSaveOutcome(
  input: CreateCompletedLocalDocumentSaveOutcomeInput,
): LocalDocumentSaveOutcome {
  return Object.freeze({
    status: LOCAL_DOCUMENT_SAVE_OUTCOME_COMPLETED_STATUS,
    result: input.result,
  });
}

export function createRejectedLocalDocumentSaveOutcome(
  input: CreateRejectedLocalDocumentSaveOutcomeInput,
): LocalDocumentSaveOutcome {
  return Object.freeze({
    status: LOCAL_DOCUMENT_SAVE_OUTCOME_REJECTED_STATUS,
    rejectionReason: input.rejectionReason,
  });
}
