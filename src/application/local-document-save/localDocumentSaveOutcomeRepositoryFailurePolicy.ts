export const LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURE_POLICY_KIND =
  "local_document_save_outcome_repository_failure_policy" as const;

export const LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_RETHROW =
  "repository_failures_rethrow_original_cause" as const;

export const LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_NOT_OUTCOMES =
  "repository_failures_are_not_outcome_values" as const;

export const LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_MAY_CLASSIFY_IN_PROCESS =
  "repository_failures_may_classify_in_process_only" as const;

export type LocalDocumentSaveOutcomeRepositoryFailurePolicy = Readonly<{
  kind: typeof LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURE_POLICY_KIND;
  scope: "local_document_save_outcome_wrapper";
  repositoryFailures: typeof LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_RETHROW;
  classifications: typeof LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_MAY_CLASSIFY_IN_PROCESS;
}>;

export function createLocalDocumentSaveOutcomeRepositoryFailurePolicy(): LocalDocumentSaveOutcomeRepositoryFailurePolicy {
  return Object.freeze({
    kind: LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURE_POLICY_KIND,
    scope: "local_document_save_outcome_wrapper",
    repositoryFailures:
      LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_RETHROW,
    classifications:
      LOCAL_DOCUMENT_SAVE_OUTCOME_REPOSITORY_FAILURES_MAY_CLASSIFY_IN_PROCESS,
  });
}
