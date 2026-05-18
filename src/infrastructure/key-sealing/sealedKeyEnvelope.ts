export type SealedKeyCryptoSuite = "AES-256-GCM";
export type SealedKeyType = "root_key";
export type SealPurpose = "local_keyring_root" | "recovery_backup_root";

export interface RawKeyMaterial {
  readonly keyId: string;
  readonly keyType: SealedKeyType;
  readonly keyScopeId: string;
  readonly keyVersion: number;
  readonly rawKeyBytes: Uint8Array;
}

export interface SealingKeyMaterial {
  readonly keyScopeId: string;
  readonly keyVersion: number;
  readonly rawKeyBytes: Uint8Array;
}

export interface SealedKeyAadV1 {
  readonly sealedKeyEnvelopeVersion: 1;
  readonly cryptoSuite: SealedKeyCryptoSuite;
  readonly patientId: string;
  readonly keyringId: string;
  readonly sealedKeyId: string;
  readonly sealedKeyType: SealedKeyType;
  readonly sealedKeyScopeId: string;
  readonly sealedKeyVersion: number;
  readonly sealingKeyScopeId: string;
  readonly sealingKeyVersion: number;
  readonly sealPurpose: SealPurpose;
}

export interface SealedKeyEnvelopeV1 {
  readonly sealedKeyEnvelopeVersion: 1;
  readonly cryptoSuite: SealedKeyCryptoSuite;
  readonly patientId: string;
  readonly keyringId: string;
  readonly sealedKeyId: string;
  readonly sealedKeyType: SealedKeyType;
  readonly sealedKeyScopeId: string;
  readonly sealedKeyVersion: number;
  readonly sealingKeyScopeId: string;
  readonly sealingKeyVersion: number;
  readonly sealPurpose: SealPurpose;
  readonly iv: string;
  readonly tag: string;
  readonly ciphertext: string;
  readonly aad: SealedKeyAadV1;
}

interface SealRawKeyMaterialInput {
  readonly patientId: string;
  readonly keyringId: string;
  readonly rawKeyMaterial: RawKeyMaterial;
  readonly sealingKey: SealingKeyMaterial;
  readonly sealPurpose: SealPurpose;
}

interface UnsealRawKeyMaterialInput {
  readonly envelope: SealedKeyEnvelopeV1;
  readonly sealingKey: SealingKeyMaterial;
}

const SEALED_KEY_ENVELOPE_VERSION = 1 as const;
const CRYPTO_SUITE: SealedKeyCryptoSuite = "AES-256-GCM";
const SEALED_KEY_ENVELOPE_SERIALIZATION_PREFIX = "sealed-key-envelope-v1:";
const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;
const AES_256_KEY_BYTES = 32;

const SUPPORTED_SEAL_PURPOSES: readonly SealPurpose[] = [
  "local_keyring_root",
  "recovery_backup_root",
];

const FORBIDDEN_SEALED_KEY_METADATA_TOKENS = [
  "raw k_root",
  "raw k_master",
  "raw payload",
  "raw blind",
  "raw k_local_unlock",
  "raw k_recovery_wrap",
  "k_root:",
  "k_master:",
  "k_local_unlock:",
  "k_recovery_wrap:",
  "nid",
  "e-tin",
  "etin",
  "phone",
  "phone number",
  "email",
  "dob",
  "date of birth",
  "mental",
  "mental-health",
  "mental health",
  "psychiatric",
  "reproductive",
  "oncology",
  "hiv",
  "diabetes",
  "domain/general",
  "domain/mental",
  "general care",
  "care category",
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

function assertAes256KeyBytes(value: Uint8Array, fieldName: string): void {
  assertUint8Array(value, fieldName);

  if (value.byteLength !== AES_256_KEY_BYTES) {
    throw new Error("malformed sealed key envelope");
  }
}

function assertSupportedSealedKeyType(keyType: SealedKeyType): void {
  if (keyType !== "root_key") {
    throw new Error("unsupported sealed key type");
  }
}

function assertSupportedSealPurpose(sealPurpose: SealPurpose): void {
  if (!SUPPORTED_SEAL_PURPOSES.includes(sealPurpose)) {
    throw new Error("malformed sealed key envelope");
  }
}

function textToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(binary);
  }

  const maybeBuffer = (
    globalThis as unknown as {
      Buffer?: {
        from: (input: Uint8Array | string, encoding?: string) => {
          toString: (encoding: string) => string;
        };
      };
    }
  ).Buffer;

  if (maybeBuffer) {
    return maybeBuffer.from(bytes).toString("base64");
  }

  throw new Error("base64 encoding is unavailable");
}

function base64ToBytes(value: string): Uint8Array {
  requireNonEmpty(value, "base64 value");

  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  const maybeBuffer = (
    globalThis as unknown as {
      Buffer?: {
        from: (input: string, encoding: string) => Uint8Array;
      };
    }
  ).Buffer;

  if (maybeBuffer) {
    return new Uint8Array(maybeBuffer.from(value, "base64"));
  }

  throw new Error("base64 decoding is unavailable");
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array {
  requireNonEmpty(value, "base64url value");

  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error("malformed sealed key envelope");
  }

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );

  try {
    return base64ToBytes(padded);
  } catch {
    throw new Error("malformed sealed key envelope");
  }
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const output = new Uint8Array(left.byteLength + right.byteLength);
  output.set(left, 0);
  output.set(right, left.byteLength);
  return output;
}

function splitCiphertextAndTag(encryptedBytes: Uint8Array): {
  ciphertextBytes: Uint8Array;
  tagBytes: Uint8Array;
} {
  if (encryptedBytes.byteLength <= AES_GCM_TAG_BYTES) {
    throw new Error("malformed sealed key envelope");
  }

  return {
    ciphertextBytes: encryptedBytes.slice(
      0,
      encryptedBytes.byteLength - AES_GCM_TAG_BYTES,
    ),
    tagBytes: encryptedBytes.slice(
      encryptedBytes.byteLength - AES_GCM_TAG_BYTES,
    ),
  };
}

function getCrypto(): Crypto {
  const cryptoApi = globalThis.crypto;

  if (!cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== "function") {
    throw new Error("Web Crypto API is unavailable");
  }

  return cryptoApi;
}

async function importAesGcmKey(key: SealingKeyMaterial): Promise<CryptoKey> {
  assertValidSealingKey(key);

  return getCrypto().subtle.importKey(
    "raw",
    toArrayBuffer(key.rawKeyBytes),
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

function canonicalizeAad(aad: SealedKeyAadV1): string {
  assertValidAad(aad);

  const canonicalAad = {
    cryptoSuite: aad.cryptoSuite,
    keyringId: aad.keyringId,
    patientId: aad.patientId,
    sealedKeyEnvelopeVersion: aad.sealedKeyEnvelopeVersion,
    sealedKeyId: aad.sealedKeyId,
    sealedKeyScopeId: aad.sealedKeyScopeId,
    sealedKeyType: aad.sealedKeyType,
    sealedKeyVersion: aad.sealedKeyVersion,
    sealPurpose: aad.sealPurpose,
    sealingKeyScopeId: aad.sealingKeyScopeId,
    sealingKeyVersion: aad.sealingKeyVersion,
  };

  return JSON.stringify(canonicalAad);
}

function buildCanonicalSealedKeyEnvelope(
  envelope: SealedKeyEnvelopeV1,
): SealedKeyEnvelopeV1 {
  return {
    sealedKeyEnvelopeVersion: envelope.sealedKeyEnvelopeVersion,
    cryptoSuite: envelope.cryptoSuite,
    patientId: envelope.patientId,
    keyringId: envelope.keyringId,
    sealedKeyId: envelope.sealedKeyId,
    sealedKeyType: envelope.sealedKeyType,
    sealedKeyScopeId: envelope.sealedKeyScopeId,
    sealedKeyVersion: envelope.sealedKeyVersion,
    sealingKeyScopeId: envelope.sealingKeyScopeId,
    sealingKeyVersion: envelope.sealingKeyVersion,
    sealPurpose: envelope.sealPurpose,
    iv: envelope.iv,
    tag: envelope.tag,
    ciphertext: envelope.ciphertext,
    aad: {
      sealedKeyEnvelopeVersion: envelope.aad.sealedKeyEnvelopeVersion,
      cryptoSuite: envelope.aad.cryptoSuite,
      patientId: envelope.aad.patientId,
      keyringId: envelope.aad.keyringId,
      sealedKeyId: envelope.aad.sealedKeyId,
      sealedKeyType: envelope.aad.sealedKeyType,
      sealedKeyScopeId: envelope.aad.sealedKeyScopeId,
      sealedKeyVersion: envelope.aad.sealedKeyVersion,
      sealingKeyScopeId: envelope.aad.sealingKeyScopeId,
      sealingKeyVersion: envelope.aad.sealingKeyVersion,
      sealPurpose: envelope.aad.sealPurpose,
    },
  };
}

function assertValidRawKeyMaterial(rawKeyMaterial: RawKeyMaterial): void {
  requireNonEmpty(rawKeyMaterial.keyId, "keyId");
  requireNonEmpty(rawKeyMaterial.keyScopeId, "keyScopeId");
  assertSupportedSealedKeyType(rawKeyMaterial.keyType);
  assertPositiveInteger(rawKeyMaterial.keyVersion, "keyVersion");
  assertAes256KeyBytes(rawKeyMaterial.rawKeyBytes, "rawKeyBytes");
}

function assertValidSealingKey(sealingKey: SealingKeyMaterial): void {
  requireNonEmpty(sealingKey.keyScopeId, "sealingKey.keyScopeId");
  assertPositiveInteger(sealingKey.keyVersion, "sealingKey.keyVersion");
  assertAes256KeyBytes(sealingKey.rawKeyBytes, "sealingKey.rawKeyBytes");
}

function assertValidAad(aad: SealedKeyAadV1): void {
  if (aad.sealedKeyEnvelopeVersion !== SEALED_KEY_ENVELOPE_VERSION) {
    throw new Error("malformed sealed key envelope");
  }

  if (aad.cryptoSuite !== CRYPTO_SUITE) {
    throw new Error("malformed sealed key envelope");
  }

  requireNonEmpty(aad.patientId, "aad.patientId");
  requireNonEmpty(aad.keyringId, "aad.keyringId");
  requireNonEmpty(aad.sealedKeyId, "aad.sealedKeyId");
  requireNonEmpty(aad.sealedKeyScopeId, "aad.sealedKeyScopeId");
  requireNonEmpty(aad.sealingKeyScopeId, "aad.sealingKeyScopeId");

  assertSupportedSealedKeyType(aad.sealedKeyType);
  assertPositiveInteger(aad.sealedKeyVersion, "aad.sealedKeyVersion");
  assertPositiveInteger(aad.sealingKeyVersion, "aad.sealingKeyVersion");
  assertSupportedSealPurpose(aad.sealPurpose);
}

function buildAad(input: SealRawKeyMaterialInput): SealedKeyAadV1 {
  return {
    sealedKeyEnvelopeVersion: SEALED_KEY_ENVELOPE_VERSION,
    cryptoSuite: CRYPTO_SUITE,
    patientId: input.patientId,
    keyringId: input.keyringId,
    sealedKeyId: input.rawKeyMaterial.keyId,
    sealedKeyType: input.rawKeyMaterial.keyType,
    sealedKeyScopeId: input.rawKeyMaterial.keyScopeId,
    sealedKeyVersion: input.rawKeyMaterial.keyVersion,
    sealingKeyScopeId: input.sealingKey.keyScopeId,
    sealingKeyVersion: input.sealingKey.keyVersion,
    sealPurpose: input.sealPurpose,
  };
}

function assertEnvelopeMatchesAad(envelope: SealedKeyEnvelopeV1): void {
  const aad = envelope.aad;

  if (
    envelope.sealedKeyEnvelopeVersion !== aad.sealedKeyEnvelopeVersion ||
    envelope.cryptoSuite !== aad.cryptoSuite ||
    envelope.patientId !== aad.patientId ||
    envelope.keyringId !== aad.keyringId ||
    envelope.sealedKeyId !== aad.sealedKeyId ||
    envelope.sealedKeyType !== aad.sealedKeyType ||
    envelope.sealedKeyScopeId !== aad.sealedKeyScopeId ||
    envelope.sealedKeyVersion !== aad.sealedKeyVersion ||
    envelope.sealingKeyScopeId !== aad.sealingKeyScopeId ||
    envelope.sealingKeyVersion !== aad.sealingKeyVersion ||
    envelope.sealPurpose !== aad.sealPurpose
  ) {
    throw new Error("sealed key authentication failed");
  }
}

function assertWellFormedEnvelope(envelope: SealedKeyEnvelopeV1): void {
  if (envelope.sealedKeyEnvelopeVersion !== SEALED_KEY_ENVELOPE_VERSION) {
    throw new Error("malformed sealed key envelope");
  }

  if (envelope.cryptoSuite !== CRYPTO_SUITE) {
    throw new Error("malformed sealed key envelope");
  }

  requireNonEmpty(envelope.patientId, "envelope.patientId");
  requireNonEmpty(envelope.keyringId, "envelope.keyringId");
  requireNonEmpty(envelope.sealedKeyId, "envelope.sealedKeyId");
  requireNonEmpty(envelope.sealedKeyScopeId, "envelope.sealedKeyScopeId");
  requireNonEmpty(envelope.sealingKeyScopeId, "envelope.sealingKeyScopeId");

  if (
    envelope.iv.trim().length === 0 ||
    envelope.tag.trim().length === 0 ||
    envelope.ciphertext.trim().length === 0
  ) {
    throw new Error("malformed sealed key envelope");
  }

  assertSupportedSealedKeyType(envelope.sealedKeyType);
  assertPositiveInteger(envelope.sealedKeyVersion, "envelope.sealedKeyVersion");
  assertPositiveInteger(
    envelope.sealingKeyVersion,
    "envelope.sealingKeyVersion",
  );
  assertSupportedSealPurpose(envelope.sealPurpose);
  assertValidAad(envelope.aad);
  assertEnvelopeMatchesAad(envelope);
  assertNoForbiddenSealedKeyMetadata(envelope);
}

function assertSealingKeyMatchesEnvelope(
  envelope: SealedKeyEnvelopeV1,
  sealingKey: SealingKeyMaterial,
): void {
  if (
    envelope.sealingKeyScopeId !== sealingKey.keyScopeId ||
    envelope.sealingKeyVersion !== sealingKey.keyVersion
  ) {
    throw new Error("sealed key authentication failed");
  }
}

function freezeRawKeyMaterial(rawKeyMaterial: RawKeyMaterial): RawKeyMaterial {
  return Object.freeze({
    keyId: rawKeyMaterial.keyId,
    keyType: rawKeyMaterial.keyType,
    keyScopeId: rawKeyMaterial.keyScopeId,
    keyVersion: rawKeyMaterial.keyVersion,
    rawKeyBytes: rawKeyMaterial.rawKeyBytes,
  });
}

export function assertNoForbiddenSealedKeyMetadata(
  envelope: SealedKeyEnvelopeV1,
): void {
  const metadataOnly = {
    sealedKeyEnvelopeVersion: envelope.sealedKeyEnvelopeVersion,
    cryptoSuite: envelope.cryptoSuite,
    patientId: envelope.patientId,
    keyringId: envelope.keyringId,
    sealedKeyId: envelope.sealedKeyId,
    sealedKeyType: envelope.sealedKeyType,
    sealedKeyScopeId: envelope.sealedKeyScopeId,
    sealedKeyVersion: envelope.sealedKeyVersion,
    sealingKeyScopeId: envelope.sealingKeyScopeId,
    sealingKeyVersion: envelope.sealingKeyVersion,
    sealPurpose: envelope.sealPurpose,
    aad: envelope.aad,
  };

  const serialized = JSON.stringify(metadataOnly).toLowerCase();

  const hasForbiddenToken = FORBIDDEN_SEALED_KEY_METADATA_TOKENS.some((token) =>
    serialized.includes(token),
  );

  if (hasForbiddenToken) {
    throw new Error("forbidden sealed key metadata");
  }
}

export async function sealRawKeyMaterial(
  input: SealRawKeyMaterialInput,
): Promise<SealedKeyEnvelopeV1> {
  requireNonEmpty(input.patientId, "patientId");
  requireNonEmpty(input.keyringId, "keyringId");
  assertValidRawKeyMaterial(input.rawKeyMaterial);
  assertValidSealingKey(input.sealingKey);
  assertSupportedSealPurpose(input.sealPurpose);

  const aad = Object.freeze(buildAad(input));
  const aadBytes = textToBytes(canonicalizeAad(aad));

  const cryptoApi = getCrypto();
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  cryptoApi.getRandomValues(iv);

  const cryptoKey = await importAesGcmKey(input.sealingKey);

  const rawKeyCopy = new Uint8Array(input.rawKeyMaterial.rawKeyBytes);

  let encryptedBuffer: ArrayBuffer;

  try {
    encryptedBuffer = await cryptoApi.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(aadBytes),
        tagLength: AES_GCM_TAG_BYTES * 8,
      },
      cryptoKey,
      toArrayBuffer(rawKeyCopy),
    );
  } finally {
    rawKeyCopy.fill(0);
  }

  const encryptedBytes = new Uint8Array(encryptedBuffer);
  const { ciphertextBytes, tagBytes } = splitCiphertextAndTag(encryptedBytes);

  const envelope: SealedKeyEnvelopeV1 = {
    sealedKeyEnvelopeVersion: SEALED_KEY_ENVELOPE_VERSION,
    cryptoSuite: CRYPTO_SUITE,
    patientId: input.patientId,
    keyringId: input.keyringId,
    sealedKeyId: input.rawKeyMaterial.keyId,
    sealedKeyType: input.rawKeyMaterial.keyType,
    sealedKeyScopeId: input.rawKeyMaterial.keyScopeId,
    sealedKeyVersion: input.rawKeyMaterial.keyVersion,
    sealingKeyScopeId: input.sealingKey.keyScopeId,
    sealingKeyVersion: input.sealingKey.keyVersion,
    sealPurpose: input.sealPurpose,
    iv: bytesToBase64(iv),
    tag: bytesToBase64(tagBytes),
    ciphertext: bytesToBase64(ciphertextBytes),
    aad,
  };

  assertNoForbiddenSealedKeyMetadata(envelope);

  return Object.freeze(envelope);
}

export async function unsealRawKeyMaterial(
  input: UnsealRawKeyMaterialInput,
): Promise<RawKeyMaterial> {
  assertValidSealingKey(input.sealingKey);
  assertWellFormedEnvelope(input.envelope);
  assertSealingKeyMatchesEnvelope(input.envelope, input.sealingKey);

  const cryptoApi = getCrypto();
  const cryptoKey = await importAesGcmKey(input.sealingKey);
  const aadBytes = textToBytes(canonicalizeAad(input.envelope.aad));

  const ivBytes = base64ToBytes(input.envelope.iv);
  const ciphertextBytes = base64ToBytes(input.envelope.ciphertext);
  const tagBytes = base64ToBytes(input.envelope.tag);

  if (ivBytes.byteLength !== AES_GCM_IV_BYTES) {
    throw new Error("malformed sealed key envelope");
  }

  if (tagBytes.byteLength !== AES_GCM_TAG_BYTES) {
    throw new Error("malformed sealed key envelope");
  }

  const encryptedBytes = concatBytes(ciphertextBytes, tagBytes);

  try {
    const decryptedBuffer = await cryptoApi.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(ivBytes),
        additionalData: toArrayBuffer(aadBytes),
        tagLength: AES_GCM_TAG_BYTES * 8,
      },
      cryptoKey,
      toArrayBuffer(encryptedBytes),
    );

    const rawKeyBytes = new Uint8Array(decryptedBuffer);

    if (rawKeyBytes.byteLength !== AES_256_KEY_BYTES) {
      rawKeyBytes.fill(0);
      throw new Error("sealed key authentication failed");
    }

    return freezeRawKeyMaterial({
      keyId: input.envelope.sealedKeyId,
      keyType: input.envelope.sealedKeyType,
      keyScopeId: input.envelope.sealedKeyScopeId,
      keyVersion: input.envelope.sealedKeyVersion,
      rawKeyBytes,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "sealed key authentication failed"
    ) {
      throw error;
    }

    throw new Error("sealed key authentication failed");
  }
}

export function serializeSealedKeyEnvelope(
  envelope: SealedKeyEnvelopeV1,
): string {
  assertWellFormedEnvelope(envelope);

  const canonicalEnvelope = buildCanonicalSealedKeyEnvelope(envelope);
  const serializedEnvelopeBytes = textToBytes(JSON.stringify(canonicalEnvelope));

  return `${SEALED_KEY_ENVELOPE_SERIALIZATION_PREFIX}${bytesToBase64Url(
    serializedEnvelopeBytes,
  )}`;
}

export function deserializeSealedKeyEnvelope(
  value: string,
): SealedKeyEnvelopeV1 {
  if (!value.startsWith(SEALED_KEY_ENVELOPE_SERIALIZATION_PREFIX)) {
    throw new Error("malformed sealed key envelope");
  }

  const encodedEnvelope = value.slice(
    SEALED_KEY_ENVELOPE_SERIALIZATION_PREFIX.length,
  );

  if (encodedEnvelope.trim().length === 0) {
    throw new Error("malformed sealed key envelope");
  }

  let parsedEnvelope: unknown;

  try {
    const envelopeBytes = base64UrlToBytes(encodedEnvelope);
    const envelopeJson = bytesToText(envelopeBytes);
    parsedEnvelope = JSON.parse(envelopeJson);
  } catch {
    throw new Error("malformed sealed key envelope");
  }

  try {
    const candidateEnvelope = parsedEnvelope as SealedKeyEnvelopeV1;

    assertWellFormedEnvelope(candidateEnvelope);

    return Object.freeze({
      ...candidateEnvelope,
      aad: Object.freeze({
        ...candidateEnvelope.aad,
      }),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "forbidden sealed key metadata"
    ) {
      throw error;
    }

    throw new Error("malformed sealed key envelope");
  }
}
