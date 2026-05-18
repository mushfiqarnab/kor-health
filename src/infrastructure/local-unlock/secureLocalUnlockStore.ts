import {
  createLocalUnlockMaterial,
  deserializeLocalUnlockMaterial,
  serializeLocalUnlockMaterial,
  type LocalUnlockMaterial,
} from "../../application/local-unlock/localUnlockMaterialPolicy";

export type SecureLocalSecretDriverErrorCode =
  | "unavailable"
  | "authentication_cancelled"
  | "authentication_changed"
  | "unknown";

export class SecureLocalSecretDriverError extends Error {
  readonly code: SecureLocalSecretDriverErrorCode;

  constructor(code: SecureLocalSecretDriverErrorCode) {
    super(`secure local secret driver failed: ${code}`);
    this.name = "SecureLocalSecretDriverError";
    this.code = code;
  }
}

export interface SecureLocalSecretDriver {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  deleteItem(key: string): Promise<void>;
}

export type LocalUnlockLoadResult =
  | {
      readonly status: "unlocked";
      readonly material: LocalUnlockMaterial;
    }
  | {
      readonly status:
        | "locked_missing"
        | "locked_cancelled"
        | "locked_unavailable"
        | "locked_malformed"
        | "locked_auth_changed";
    };

interface LocalUnlockStorageKeyInput {
  readonly patientId: string;
  readonly keyringId: string;
}

interface StoreLocalUnlockMaterialInput extends LocalUnlockStorageKeyInput {
  readonly driver: SecureLocalSecretDriver;
  readonly material: LocalUnlockMaterial;
}

interface LoadLocalUnlockMaterialInput extends LocalUnlockStorageKeyInput {
  readonly driver: SecureLocalSecretDriver;
}

interface DeleteLocalUnlockMaterialInput extends LocalUnlockStorageKeyInput {
  readonly driver: SecureLocalSecretDriver;
}

const LOCAL_UNLOCK_STORAGE_KEY_PREFIX = "kor:v1:local-unlock:";

function requireNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
}

function assertValidStorageIdentity(input: LocalUnlockStorageKeyInput): void {
  requireNonEmpty(input.patientId, "patientId");
  requireNonEmpty(input.keyringId, "keyringId");
}

function mapDriverErrorToLoadResult(
  error: unknown,
): Exclude<LocalUnlockLoadResult, { readonly status: "unlocked"; readonly material: LocalUnlockMaterial }> {
  if (error instanceof SecureLocalSecretDriverError) {
    if (error.code === "authentication_cancelled") {
      return Object.freeze({ status: "locked_cancelled" });
    }

    if (error.code === "authentication_changed") {
      return Object.freeze({ status: "locked_auth_changed" });
    }

    return Object.freeze({ status: "locked_unavailable" });
  }

  return Object.freeze({ status: "locked_unavailable" });
}

function assertValidStoreMaterial(material: LocalUnlockMaterial): LocalUnlockMaterial {
  return createLocalUnlockMaterial({
    keyScopeId: material.keyScopeId,
    keyVersion: material.keyVersion,
    purpose: material.purpose,
    rawKeyBytes: material.rawKeyBytes,
  });
}

export function buildLocalUnlockStorageKey(
  input: LocalUnlockStorageKeyInput,
): string {
  assertValidStorageIdentity(input);

  return `${LOCAL_UNLOCK_STORAGE_KEY_PREFIX}${input.patientId}:${input.keyringId}`;
}

export async function storeLocalUnlockMaterial(
  input: StoreLocalUnlockMaterialInput,
): Promise<void> {
  assertValidStorageIdentity(input);

  const normalizedMaterial = assertValidStoreMaterial(input.material);
  const storageKey = buildLocalUnlockStorageKey(input);
  const storedValue = serializeLocalUnlockMaterial(normalizedMaterial);

  await input.driver.setItem(storageKey, storedValue);
}

export async function loadLocalUnlockMaterial(
  input: LoadLocalUnlockMaterialInput,
): Promise<LocalUnlockLoadResult> {
  assertValidStorageIdentity(input);

  const storageKey = buildLocalUnlockStorageKey(input);

  let storedValue: string | null;

  try {
    storedValue = await input.driver.getItem(storageKey);
  } catch (error) {
    return mapDriverErrorToLoadResult(error);
  }

  if (storedValue === null) {
    return Object.freeze({ status: "locked_missing" });
  }

  try {
    const material = deserializeLocalUnlockMaterial(storedValue);

    return Object.freeze({
      status: "unlocked",
      material,
    });
  } catch {
    return Object.freeze({ status: "locked_malformed" });
  }
}

export async function deleteLocalUnlockMaterial(
  input: DeleteLocalUnlockMaterialInput,
): Promise<void> {
  assertValidStorageIdentity(input);

  const storageKey = buildLocalUnlockStorageKey(input);

  await input.driver.deleteItem(storageKey);
}