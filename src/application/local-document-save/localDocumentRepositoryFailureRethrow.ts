import {
  classifyLocalDocumentRepositoryFailure,
  type ClassifyLocalDocumentRepositoryFailureInput,
  type LocalDocumentRepositoryFailureClassification,
} from "./localDocumentRepositoryFailureClassification";

export type ClassifyAndRethrowLocalDocumentRepositoryFailureInput = Readonly<
  ClassifyLocalDocumentRepositoryFailureInput & {
    onClassification?: (
      classification: LocalDocumentRepositoryFailureClassification,
    ) => void;
  }
>;

export function classifyAndRethrowLocalDocumentRepositoryFailure(
  input: ClassifyAndRethrowLocalDocumentRepositoryFailureInput,
): never {
  const classification = classifyLocalDocumentRepositoryFailure({
    phase: input.phase,
    cause: input.cause,
  });

  try {
    input.onClassification?.(classification);
  } catch {
    // Intentionally preserve the original repository failure.
  }

  throw input.cause;
}
