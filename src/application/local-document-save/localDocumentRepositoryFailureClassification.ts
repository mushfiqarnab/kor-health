export const LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND =
  "local_document_repository_failure" as const;

export const LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE =
  "local_encrypted_document_payload_save" as const;

export const LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE =
  "clinical_document_reference_save" as const;

export const LOCAL_DOCUMENT_REPOSITORY_FAILURE_UNKNOWN_PHASE =
  "unknown_repository_failure" as const;

export type LocalDocumentRepositoryFailurePhase =
  | typeof LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE
  | typeof LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE
  | typeof LOCAL_DOCUMENT_REPOSITORY_FAILURE_UNKNOWN_PHASE;

export type LocalDocumentRepositoryFailureClassification = Readonly<{
  kind: typeof LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND;
  phase: LocalDocumentRepositoryFailurePhase;
}>;

export type ClassifyLocalDocumentRepositoryFailureInput = Readonly<{
  phase: unknown;
  cause: unknown;
}>;

function selectApprovedRepositoryFailurePhase(
  phase: unknown,
): LocalDocumentRepositoryFailurePhase {
  if (phase === LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE) {
    return LOCAL_DOCUMENT_REPOSITORY_FAILURE_PAYLOAD_SAVE_PHASE;
  }

  if (phase === LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE) {
    return LOCAL_DOCUMENT_REPOSITORY_FAILURE_REFERENCE_SAVE_PHASE;
  }

  return LOCAL_DOCUMENT_REPOSITORY_FAILURE_UNKNOWN_PHASE;
}

export function classifyLocalDocumentRepositoryFailure(
  input: ClassifyLocalDocumentRepositoryFailureInput,
): LocalDocumentRepositoryFailureClassification {
  void input.cause;

  return Object.freeze({
    kind: LOCAL_DOCUMENT_REPOSITORY_FAILURE_KIND,
    phase: selectApprovedRepositoryFailurePhase(input.phase),
  });
}
