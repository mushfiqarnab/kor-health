import { assertNonSemanticDerivationScope } from "../../infrastructure/key-material/keyMaterialFactory";

export interface CreateLocalUnlockMaterialInput {
  readonly keyScopeId: string;
  readonly keyVersion: number;
  readonly purpose: string;
  readonly rawKeyBytes: Uint8Array;
}

export interface LocalUnlockMaterial {
  readonly keyScopeId: string;
  readonly keyVersion: number;
  readonly purpose: "local_keyring";
  readonly rawKeyBytes: Uint8Array;
}

interface StoredLocalUnlockMaterialV1 {
  readonly schemaVersion: 1;
  readonly materialType: "local_unlock_material";
  readonly keyScopeId: string;
  readonly keyVersion: number;
  readonly purpose: string;
  readonly rawKeyBytesBase64Url: string;
}

const LOCAL_UNLOCK_STORAGE_PREFIX = "local-unlock-v1:";
const LOCAL_UNLOCK_KEY_BYTES = 32;

const FORBIDDEN_LOCAL_UNLOCK_METADATA_TOKENS = [
  "raw k_root",
  "raw k_master",
  "raw k_local_unlock",
  "raw k_recovery_wrap",
  "k_root:",
  "k_master:",
  "k_local_unlock:",
  "k_recovery_wrap:",
  "domain/general",
  "domain/mental",
  "domain/reproductive",
  "mental",
  "mental-health",
  "mental health",
  "psychiatric",
  "reproductive",
  "oncology",
  "hiv",
  "diabetes",
  "nid",
  "e-tin",
  "etin",
  "phone number",
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
    throw new Error("malformed local unlock material");
  }

  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "=",
  );

  try {
    return base64ToBytes(padded);
  } catch {
    throw new Error("malformed local unlock material");
  }
}

function sanitizeOpaqueLocalUnlockValueForForbiddenScan(
  value: unknown,
): unknown {
  if (typeof value === "string") {
    if (value.startsWith(LOCAL_UNLOCK_STORAGE_PREFIX)) {
      return `${LOCAL_UNLOCK_STORAGE_PREFIX}<redacted>`;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitizeOpaqueLocalUnlockValueForForbiddenScan(item),
    );
  }

  if (value !== null && typeof value === "object") {
    const sanitizedObject: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (key === "rawKeyBytesBase64Url") {
        sanitizedObject[key] = "<redacted>";
        continue;
      }

      sanitizedObject[key] =
        sanitizeOpaqueLocalUnlockValueForForbiddenScan(nestedValue);
    }

    return sanitizedObject;
  }

  return value;
}

function assertValidLocalUnlockMaterialShape(
  input: CreateLocalUnlockMaterialInput,
): void {
  requireNonEmpty(input.keyScopeId, "keyScopeId");
  assertNonSemanticDerivationScope(input.keyScopeId);
  assertPositiveInteger(input.keyVersion, "keyVersion");

  if (input.purpose !== "local_keyring") {
    throw new Error("local unlock material purpose must be local_keyring");
  }

  if (!(input.rawKeyBytes instanceof Uint8Array)) {
    throw new Error("local unlock material must use Uint8Array key bytes");
  }

  if (input.rawKeyBytes.byteLength !== LOCAL_UNLOCK_KEY_BYTES) {
    throw new Error("local unlock material must be 32 bytes");
  }
}

function buildStoredPayload(
  material: LocalUnlockMaterial,
): StoredLocalUnlockMaterialV1 {
  return {
    schemaVersion: 1,
    materialType: "local_unlock_material",
    keyScopeId: material.keyScopeId,
    keyVersion: material.keyVersion,
    purpose: material.purpose,
    rawKeyBytesBase64Url: bytesToBase64Url(material.rawKeyBytes),
  };
}

function parseStoredPayload(value: string): StoredLocalUnlockMaterialV1 {
  if (!value.startsWith(LOCAL_UNLOCK_STORAGE_PREFIX)) {
    throw new Error("malformed local unlock material");
  }

  const encodedPayload = value.slice(LOCAL_UNLOCK_STORAGE_PREFIX.length);

  if (encodedPayload.trim().length === 0) {
    throw new Error("malformed local unlock material");
  }

  let parsedPayload: unknown;

  try {
    const payloadBytes = base64UrlToBytes(encodedPayload);
    const payloadText = new TextDecoder().decode(payloadBytes);
    parsedPayload = JSON.parse(payloadText);
  } catch {
    throw new Error("malformed local unlock material");
  }

  if (parsedPayload === null || typeof parsedPayload !== "object") {
    throw new Error("malformed local unlock material");
  }

  return parsedPayload as StoredLocalUnlockMaterialV1;
}

export function assertNoForbiddenLocalUnlockMetadata(value: unknown): void {
  const sanitizedValue = sanitizeOpaqueLocalUnlockValueForForbiddenScan(value);
  const serializedValue = JSON.stringify(sanitizedValue).toLowerCase();

  const hasForbiddenToken = FORBIDDEN_LOCAL_UNLOCK_METADATA_TOKENS.some(
    (token) => serializedValue.includes(token),
  );

  if (hasForbiddenToken) {
    throw new Error("forbidden local unlock metadata");
  }
}

export function createLocalUnlockMaterial(
  input: CreateLocalUnlockMaterialInput,
): LocalUnlockMaterial {
  assertValidLocalUnlockMaterialShape(input);

  const material = {} as LocalUnlockMaterial;

  Object.defineProperties(material, {
    keyScopeId: {
      value: input.keyScopeId,
      enumerable: true,
      writable: false,
      configurable: false,
    },
    keyVersion: {
      value: input.keyVersion,
      enumerable: true,
      writable: false,
      configurable: false,
    },
    purpose: {
      value: "local_keyring",
      enumerable: true,
      writable: false,
      configurable: false,
    },
    rawKeyBytes: {
      value: input.rawKeyBytes,
      enumerable: false,
      writable: false,
      configurable: false,
    },
  });

  return Object.freeze(material);
}

export function serializeLocalUnlockMaterial(
  material: LocalUnlockMaterial,
): string {
  const normalizedMaterial = createLocalUnlockMaterial({
    keyScopeId: material.keyScopeId,
    keyVersion: material.keyVersion,
    purpose: material.purpose,
    rawKeyBytes: material.rawKeyBytes,
  });

  const storedPayload = buildStoredPayload(normalizedMaterial);
  assertNoForbiddenLocalUnlockMetadata(storedPayload);

  const payloadBytes = new TextEncoder().encode(JSON.stringify(storedPayload));

  return `${LOCAL_UNLOCK_STORAGE_PREFIX}${bytesToBase64Url(payloadBytes)}`;
}

export function deserializeLocalUnlockMaterial(
  value: string,
): LocalUnlockMaterial {
  const storedPayload = parseStoredPayload(value);

  if (
    storedPayload.schemaVersion !== 1 ||
    storedPayload.materialType !== "local_unlock_material"
  ) {
    throw new Error("malformed local unlock material");
  }

  assertNoForbiddenLocalUnlockMetadata(storedPayload);

  const rawKeyBytes = base64UrlToBytes(storedPayload.rawKeyBytesBase64Url);

  return createLocalUnlockMaterial({
    keyScopeId: storedPayload.keyScopeId,
    keyVersion: storedPayload.keyVersion,
    purpose: storedPayload.purpose,
    rawKeyBytes,
  });
}

export function zeroLocalUnlockMaterial(material: LocalUnlockMaterial): void {
  material.rawKeyBytes.fill(0);
}