export type CryptoSuite = "AES-256-GCM";
export type EnvelopePurpose = "cloud_sync";

export interface AadV1 {
  readonly envelopeVersion: 1;
  readonly cryptoSuite: CryptoSuite;
  readonly patientId: string;
  readonly recordId: string;
  readonly keyScopeId: string;
  readonly keyVersion: number;
  readonly purpose: EnvelopePurpose;
}

export interface EncryptionKey {
  readonly keyVersion: number;
  readonly keyScopeId: string;
  readonly rawKeyBytes: Uint8Array;
}

export interface SealedEnvelopeV1 {
  readonly envelopeVersion: 1;
  readonly cryptoSuite: CryptoSuite;
  readonly keyScopeId: string;
  readonly keyVersion: number;
  readonly iv: string;
  readonly tag: string;
  readonly ciphertext: string;
  readonly aad: AadV1;
}

interface EncryptToEnvelopeInput {
  readonly plaintext: string;
  readonly key: EncryptionKey;
  readonly aad: AadV1;
}

interface DecryptFromEnvelopeInput {
  readonly envelope: SealedEnvelopeV1;
  readonly key: EncryptionKey;
}

const ENVELOPE_VERSION = 1 as const;
const CRYPTO_SUITE: CryptoSuite = "AES-256-GCM";
const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;
const AES_256_KEY_BYTES = 32;

function requireNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
}

function assertValidKey(key: EncryptionKey): void {
  requireNonEmpty(key.keyScopeId, "keyScopeId");

  if (!Number.isInteger(key.keyVersion) || key.keyVersion <= 0) {
    throw new Error("keyVersion must be a positive integer");
  }

  if (!(key.rawKeyBytes instanceof Uint8Array)) {
    throw new Error("rawKeyBytes must be a Uint8Array");
  }

  if (key.rawKeyBytes.byteLength !== AES_256_KEY_BYTES) {
    throw new Error("AES-256-GCM requires a 32-byte key");
  }
}

function assertValidAad(aad: AadV1): void {
  if (aad.envelopeVersion !== ENVELOPE_VERSION) {
    throw new Error("unsupported envelope version");
  }

  if (aad.cryptoSuite !== CRYPTO_SUITE) {
    throw new Error("unsupported crypto suite");
  }

  requireNonEmpty(aad.patientId, "aad.patientId");
  requireNonEmpty(aad.recordId, "aad.recordId");
  requireNonEmpty(aad.keyScopeId, "aad.keyScopeId");

  if (!Number.isInteger(aad.keyVersion) || aad.keyVersion <= 0) {
    throw new Error("aad.keyVersion must be a positive integer");
  }

  if (aad.purpose !== "cloud_sync") {
    throw new Error("unsupported envelope purpose");
  }
}

function assertKeyMatchesAad(key: EncryptionKey, aad: AadV1): void {
  if (key.keyScopeId !== aad.keyScopeId) {
    throw new Error("keyScopeId mismatch");
  }

  if (key.keyVersion !== aad.keyVersion) {
    throw new Error("keyVersion mismatch");
  }
}

function assertWellFormedEnvelope(envelope: SealedEnvelopeV1): void {
  if (envelope.envelopeVersion !== ENVELOPE_VERSION) {
    throw new Error("unsupported envelope version");
  }

  if (envelope.cryptoSuite !== CRYPTO_SUITE) {
    throw new Error("unsupported crypto suite");
  }

  requireNonEmpty(envelope.keyScopeId, "envelope.keyScopeId");

  if (!Number.isInteger(envelope.keyVersion) || envelope.keyVersion <= 0) {
    throw new Error("envelope.keyVersion must be a positive integer");
  }

  if (
    envelope.iv.trim().length === 0 ||
    envelope.tag.trim().length === 0 ||
    envelope.ciphertext.trim().length === 0
  ) {
  throw new Error("malformed sealed envelope");
}
  assertValidAad(envelope.aad);

  if (envelope.keyScopeId !== envelope.aad.keyScopeId) {
    throw new Error("malformed sealed envelope");
  }

  if (envelope.keyVersion !== envelope.aad.keyVersion) {
    throw new Error("malformed sealed envelope");
  }

  if (envelope.cryptoSuite !== envelope.aad.cryptoSuite) {
    throw new Error("unsupported crypto suite");
  }

  if (envelope.envelopeVersion !== envelope.aad.envelopeVersion) {
    throw new Error("malformed sealed envelope");
  }
}

function canonicalizeAad(aad: AadV1): string {
  assertValidAad(aad);

  const canonicalAad = {
    cryptoSuite: aad.cryptoSuite,
    envelopeVersion: aad.envelopeVersion,
    keyScopeId: aad.keyScopeId,
    keyVersion: aad.keyVersion,
    patientId: aad.patientId,
    purpose: aad.purpose,
    recordId: aad.recordId,
  };

  return JSON.stringify(canonicalAad);
}

function textToBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
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
    throw new Error("malformed sealed envelope");
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

async function importAesGcmKey(key: EncryptionKey): Promise<CryptoKey> {
  assertValidKey(key);

  return getCrypto().subtle.importKey(
    "raw",
    key.rawKeyBytes,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptToEnvelope(
  input: EncryptToEnvelopeInput,
): Promise<SealedEnvelopeV1> {
  requireNonEmpty(input.plaintext, "plaintext");
  assertValidKey(input.key);
  assertValidAad(input.aad);
  assertKeyMatchesAad(input.key, input.aad);

  const cryptoApi = getCrypto();
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  cryptoApi.getRandomValues(iv);

  const cryptoKey = await importAesGcmKey(input.key);
  const aadBytes = textToBytes(canonicalizeAad(input.aad));

  const encryptedBuffer = await cryptoApi.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: aadBytes,
      tagLength: AES_GCM_TAG_BYTES * 8,
    },
    cryptoKey,
    textToBytes(input.plaintext),
  );

  const encryptedBytes = new Uint8Array(encryptedBuffer);
  const { ciphertextBytes, tagBytes } = splitCiphertextAndTag(encryptedBytes);

const frozenAad = Object.freeze({
  ...input.aad,
});

const envelope: SealedEnvelopeV1 = {
  envelopeVersion: ENVELOPE_VERSION,
  cryptoSuite: CRYPTO_SUITE,
  keyScopeId: input.key.keyScopeId,
  keyVersion: input.key.keyVersion,
  iv: bytesToBase64(iv),
  tag: bytesToBase64(tagBytes),
  ciphertext: bytesToBase64(ciphertextBytes),
  aad: frozenAad,
};

return Object.freeze(envelope);
}

export async function decryptFromEnvelope(
  input: DecryptFromEnvelopeInput,
): Promise<string> {
  assertValidKey(input.key);
  assertWellFormedEnvelope(input.envelope);
  assertKeyMatchesAad(input.key, input.envelope.aad);

  const cryptoApi = getCrypto();
  const cryptoKey = await importAesGcmKey(input.key);
  const aadBytes = textToBytes(canonicalizeAad(input.envelope.aad));

  const ivBytes = base64ToBytes(input.envelope.iv);
  const ciphertextBytes = base64ToBytes(input.envelope.ciphertext);
  const tagBytes = base64ToBytes(input.envelope.tag);

  if (ivBytes.byteLength !== AES_GCM_IV_BYTES) {
    throw new Error("malformed sealed envelope");
  }

  if (tagBytes.byteLength !== AES_GCM_TAG_BYTES) {
    throw new Error("malformed sealed envelope");
  }

  const encryptedBytes = concatBytes(ciphertextBytes, tagBytes);

  try {
    const decryptedBuffer = await cryptoApi.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: ivBytes,
        additionalData: aadBytes,
        tagLength: AES_GCM_TAG_BYTES * 8,
      },
      cryptoKey,
      encryptedBytes,
    );

    return bytesToText(new Uint8Array(decryptedBuffer));
  } catch {
    throw new Error("envelope authentication failed");
  }
}