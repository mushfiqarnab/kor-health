export type RootScopedKeyPurpose = "payload_encryption" | "blind_index";

export type CapabilityDekPurpose =
  | "local_keyring"
  | "keyring_backup"
  | "caregiver_adherence"
  | "emergency_card";

export type KeyMaterialPurpose = RootScopedKeyPurpose | CapabilityDekPurpose;

export type KeyMaterialOrigin = "hkdf_root_scoped" | "random_capability_dek";

export interface RootKeyMaterial {
  readonly rootVersion: number;
  readonly rawRootKeyBytes: Uint8Array;
}

export interface DerivedKeyMaterial {
  readonly keyScopeId: string;
  readonly keyVersion: number;
  readonly purpose: KeyMaterialPurpose;
  readonly origin: KeyMaterialOrigin;
  readonly rawKeyBytes: Uint8Array;
}

interface DeriveRootScopedKeyInput {
  readonly rootKey: RootKeyMaterial;
  readonly patientSaltBytes: Uint8Array;
  readonly keyScopeId: string;
  readonly keyVersion: number;
  readonly purpose: RootScopedKeyPurpose;
}

interface GenerateCapabilityDekInput {
  readonly keyScopeId: string;
  readonly keyVersion: number;
  readonly purpose: CapabilityDekPurpose;
}

const KEY_BYTES = 32;
const HKDF_OUTPUT_BITS = KEY_BYTES * 8;

const ROOT_SCOPED_PURPOSES: readonly RootScopedKeyPurpose[] = [
  "payload_encryption",
  "blind_index",
];

const CAPABILITY_DEK_PURPOSES: readonly CapabilityDekPurpose[] = [
  "local_keyring",
  "keyring_backup",
  "caregiver_adherence",
  "emergency_card",
];

const ALL_KEY_MATERIAL_PURPOSES: readonly KeyMaterialPurpose[] = [
  ...ROOT_SCOPED_PURPOSES,
  ...CAPABILITY_DEK_PURPOSES,
];

const FORBIDDEN_DERIVATION_SCOPE_TOKENS = [
  "mental",
  "mental-health",
  "psychiatric",
  "psych",
  "reproductive",
  "reproductive-health",
  "oncology",
  "cancer",
  "hiv",
  "diabetes",
  "domain",
  "general",
  "medical",
  "clinical",
  "cardiac",
  "heart",
  "pregnancy",
  "nid",
  "e-tin",
  "etin",
  "phone",
  "email",
  "dob",
];

function requireNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
}

function assertPositiveInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
}

function assertUint8Array(value: Uint8Array, fieldName: string): void {
  if (!(value instanceof Uint8Array)) {
    throw new Error(`${fieldName} must be a Uint8Array`);
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function textToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function getCrypto(): Crypto {
  const cryptoApi = globalThis.crypto;

  if (!cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== "function") {
    throw new Error("Web Crypto API is unavailable");
  }

  return cryptoApi;
}

function assertSupportedRootScopedPurpose(
  purpose: RootScopedKeyPurpose,
): void {
  if (!ROOT_SCOPED_PURPOSES.includes(purpose)) {
    throw new Error("unsupported root-scoped key purpose");
  }
}

function assertSupportedCapabilityDekPurpose(
  purpose: CapabilityDekPurpose,
): void {
  if (!CAPABILITY_DEK_PURPOSES.includes(purpose)) {
    throw new Error("unsupported capability DEK purpose");
  }
}

function assertSupportedKeyMaterialPurpose(
  purpose: KeyMaterialPurpose,
): void {
  if (!ALL_KEY_MATERIAL_PURPOSES.includes(purpose)) {
    throw new Error("unsupported key material purpose");
  }
}

function assertRootKeyMaterial(rootKey: RootKeyMaterial): void {
  assertPositiveInteger(rootKey.rootVersion, "rootVersion");
  assertUint8Array(rootKey.rawRootKeyBytes, "rawRootKeyBytes");

  if (rootKey.rawRootKeyBytes.byteLength !== KEY_BYTES) {
    throw new Error("K_root must be 32 bytes");
  }
}

function assertPatientSalt(patientSaltBytes: Uint8Array): void {
  assertUint8Array(patientSaltBytes, "patientSaltBytes");

  if (patientSaltBytes.byteLength !== KEY_BYTES) {
    throw new Error("patient salt must be 32 bytes");
  }
}

export function assertNonSemanticDerivationScope(keyScopeId: string): void {
  requireNonEmpty(keyScopeId, "keyScopeId");

  const normalized = keyScopeId.toLowerCase();

  const hasOpaqueShape = /^(ks|scope)_[a-z0-9]+$/.test(normalized);
  const hasForbiddenToken = FORBIDDEN_DERIVATION_SCOPE_TOKENS.some((token) =>
    normalized.includes(token),
  );

  if (!hasOpaqueShape || hasForbiddenToken) {
    throw new Error("derivation scope must be non-semantic");
  }
}

function buildHkdfInfo(input: DeriveRootScopedKeyInput): Uint8Array {
  const info = [
    "kor",
    "v1",
    "root-scoped",
    input.purpose,
    input.keyScopeId,
    `key-version-${input.keyVersion}`,
    `root-version-${input.rootKey.rootVersion}`,
  ].join("/");

  assertNonSemanticDerivationScope(input.keyScopeId);

  return textToBytes(info);
}

async function importRootKey(rootKey: RootKeyMaterial): Promise<CryptoKey> {
  assertRootKeyMaterial(rootKey);

  return getCrypto().subtle.importKey(
    "raw",
    toArrayBuffer(rootKey.rawRootKeyBytes),
    "HKDF",
    false,
    ["deriveBits"],
  );
}

export async function deriveRootScopedKey(
  input: DeriveRootScopedKeyInput,
): Promise<DerivedKeyMaterial> {
  assertRootKeyMaterial(input.rootKey);
  assertPatientSalt(input.patientSaltBytes);
  assertPositiveInteger(input.keyVersion, "keyVersion");
  assertNonSemanticDerivationScope(input.keyScopeId);
  assertSupportedRootScopedPurpose(input.purpose);

  const cryptoApi = getCrypto();
  const rootCryptoKey = await importRootKey(input.rootKey);

  const derivedBits = await cryptoApi.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(input.patientSaltBytes),
      info: toArrayBuffer(buildHkdfInfo(input)),
    },
    rootCryptoKey,
    HKDF_OUTPUT_BITS,
  );

  const keyMaterial: DerivedKeyMaterial = {
    keyScopeId: input.keyScopeId,
    keyVersion: input.keyVersion,
    purpose: input.purpose,
    origin: "hkdf_root_scoped",
    rawKeyBytes: new Uint8Array(derivedBits),
  };

  return Object.freeze(keyMaterial);
}

export function generateCapabilityDek(
  input: GenerateCapabilityDekInput,
): DerivedKeyMaterial {
  assertPositiveInteger(input.keyVersion, "keyVersion");
  assertNonSemanticDerivationScope(input.keyScopeId);
  assertSupportedCapabilityDekPurpose(input.purpose);

  const rawKeyBytes = new Uint8Array(KEY_BYTES);
  getCrypto().getRandomValues(rawKeyBytes);

  const keyMaterial: DerivedKeyMaterial = {
    keyScopeId: input.keyScopeId,
    keyVersion: input.keyVersion,
    purpose: input.purpose,
    origin: "random_capability_dek",
    rawKeyBytes,
  };

  return Object.freeze(keyMaterial);
}

export function assertKeyMaterialPurposeAllowed(
  keyMaterial: DerivedKeyMaterial,
  requiredPurpose: KeyMaterialPurpose,
): void {
  assertSupportedKeyMaterialPurpose(keyMaterial.purpose);
  assertSupportedKeyMaterialPurpose(requiredPurpose);

  if (keyMaterial.purpose !== requiredPurpose) {
    throw new Error("key material purpose mismatch");
  }
}
