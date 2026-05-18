import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createExpoSecureLocalSecretDriver,
  type ExpoSecureStoreModuleLike,
  type ExpoSecureStoreOptionsLike,
} from "../expoSecureLocalSecretDriver";

import { SecureLocalSecretDriverError } from "../secureLocalUnlockStore";

type SecureStoreMethodName =
  | "isAvailableAsync"
  | "setItemAsync"
  | "getItemAsync"
  | "deleteItemAsync";

interface SecureStoreCall {
  readonly method: SecureStoreMethodName;
  readonly key?: string;
  readonly value?: string;
  readonly options?: ExpoSecureStoreOptionsLike;
}

class FakeExpoSecureStoreModule implements ExpoSecureStoreModuleLike {
  readonly calls: SecureStoreCall[] = [];
  available = true;
  storedValue: string | null = "local-unlock-v1:stored-value";
  setError: unknown;
  getError: unknown;
  deleteError: unknown;

  async isAvailableAsync(): Promise<boolean> {
    this.calls.push({ method: "isAvailableAsync" });
    return this.available;
  }

  async setItemAsync(
    key: string,
    value: string,
    options?: ExpoSecureStoreOptionsLike,
  ): Promise<void> {
    this.calls.push({ method: "setItemAsync", key, value, options });

    if (this.setError) {
      throw this.setError;
    }
  }

  async getItemAsync(
    key: string,
    options?: ExpoSecureStoreOptionsLike,
  ): Promise<string | null> {
    this.calls.push({ method: "getItemAsync", key, options });

    if (this.getError) {
      throw this.getError;
    }

    return this.storedValue;
  }

  async deleteItemAsync(
    key: string,
    options?: ExpoSecureStoreOptionsLike,
  ): Promise<void> {
    this.calls.push({ method: "deleteItemAsync", key, options });

    if (this.deleteError) {
      throw this.deleteError;
    }
  }
}

function createFakeSecureStore(): FakeExpoSecureStoreModule {
  return new FakeExpoSecureStoreModule();
}

function createDriver(input?: {
  readonly secureStore?: FakeExpoSecureStoreModule;
  readonly authenticationPrompt?: string;
  readonly keychainService?: string;
}) {
  return createExpoSecureLocalSecretDriver({
    secureStore: input?.secureStore ?? createFakeSecureStore(),
    authenticationPrompt:
      input?.authenticationPrompt ?? "Unlock your health vault",
    keychainService: input?.keychainService ?? "kor.v1.local-unlock",
  });
}

function expectSecureDriverError(
  error: unknown,
  code:
    | "unavailable"
    | "authentication_cancelled"
    | "authentication_changed"
    | "unknown",
): void {
  expect(error).toBeInstanceOf(SecureLocalSecretDriverError);

  if (!(error instanceof SecureLocalSecretDriverError)) {
    throw new Error("expected SecureLocalSecretDriverError");
  }

  expect(error.code).toBe(code);
}

async function captureRejection(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action();
  } catch (error) {
    return error;
  }

  throw new Error("expected action to reject");
}

describe("Expo SecureStore local secret driver contract", () => {
  it("checks SecureStore availability before storing", async () => {
    const secureStore = createFakeSecureStore();
    const driver = createDriver({ secureStore });

    await driver.setItem("storage-key", "local-unlock-v1:value");

    expect(secureStore.calls.map((call) => call.method)).toEqual([
      "isAvailableAsync",
      "setItemAsync",
    ]);
  });

  it("checks SecureStore availability before loading", async () => {
    const secureStore = createFakeSecureStore();
    const driver = createDriver({ secureStore });

    await driver.getItem("storage-key");

    expect(secureStore.calls.map((call) => call.method)).toEqual([
      "isAvailableAsync",
      "getItemAsync",
    ]);
  });

  it("checks SecureStore availability before deleting", async () => {
    const secureStore = createFakeSecureStore();
    const driver = createDriver({ secureStore });

    await driver.deleteItem("storage-key");

    expect(secureStore.calls.map((call) => call.method)).toEqual([
      "isAvailableAsync",
      "deleteItemAsync",
    ]);
  });

  it("stores with authentication-gated SecureStore options", async () => {
    const secureStore = createFakeSecureStore();
    const driver = createDriver({ secureStore });

    await driver.setItem("storage-key", "local-unlock-v1:value");

    const setCall = secureStore.calls.find(
      (call) => call.method === "setItemAsync",
    );

    expect(setCall).toEqual({
      method: "setItemAsync",
      key: "storage-key",
      value: "local-unlock-v1:value",
      options: {
        keychainService: "kor.v1.local-unlock",
        requireAuthentication: true,
        authenticationPrompt: "Unlock your health vault",
      },
    });
  });

  it("loads with authentication-gated SecureStore options", async () => {
    const secureStore = createFakeSecureStore();
    const driver = createDriver({ secureStore });

    await driver.getItem("storage-key");

    const getCall = secureStore.calls.find(
      (call) => call.method === "getItemAsync",
    );

    expect(getCall).toEqual({
      method: "getItemAsync",
      key: "storage-key",
      options: {
        keychainService: "kor.v1.local-unlock",
        requireAuthentication: true,
        authenticationPrompt: "Unlock your health vault",
      },
    });
  });

  it("deletes with stable keychainService and no authentication prompt", async () => {
    const secureStore = createFakeSecureStore();
    const driver = createDriver({ secureStore });

    await driver.deleteItem("storage-key");

    const deleteCall = secureStore.calls.find(
      (call) => call.method === "deleteItemAsync",
    );

    expect(deleteCall).toEqual({
      method: "deleteItemAsync",
      key: "storage-key",
      options: {
        keychainService: "kor.v1.local-unlock",
        requireAuthentication: false,
      },
    });
  });

  it("returns null unchanged when SecureStore returns null", async () => {
    const secureStore = createFakeSecureStore();
    secureStore.storedValue = null;
    const driver = createDriver({ secureStore });

    await expect(driver.getItem("storage-key")).resolves.toBeNull();
  });

  it("maps unavailable SecureStore to typed unavailable error", async () => {
    const secureStore = createFakeSecureStore();
    secureStore.available = false;
    const driver = createDriver({ secureStore });

    const error = await captureRejection(() =>
      driver.getItem("storage-key"),
    );

    expectSecureDriverError(error, "unavailable");
    expect(secureStore.calls.map((call) => call.method)).toEqual([
      "isAvailableAsync",
    ]);
  });

  it("maps cancellation-like native errors to authentication_cancelled", async () => {
    const secureStore = createFakeSecureStore();
    secureStore.getError = new Error("User canceled biometric authentication");
    const driver = createDriver({ secureStore });

    const error = await captureRejection(() =>
      driver.getItem("storage-key"),
    );

    expectSecureDriverError(error, "authentication_cancelled");
  });

  it("maps biometric or key invalidation native errors to authentication_changed", async () => {
    const secureStore = createFakeSecureStore();
    secureStore.getError = new Error(
      "KeyPermanentlyInvalidatedException: biometric set changed",
    );
    const driver = createDriver({ secureStore });

    const error = await captureRejection(() =>
      driver.getItem("storage-key"),
    );

    expectSecureDriverError(error, "authentication_changed");
  });

  it("maps unknown native errors to typed unknown error", async () => {
    const secureStore = createFakeSecureStore();
    secureStore.getError = new Error("native stack trace with secret details");
    const driver = createDriver({ secureStore });

    const error = await captureRejection(() =>
      driver.getItem("storage-key"),
    );

    expectSecureDriverError(error, "unknown");
  });

  it("does not expose raw native error messages in thrown error message", async () => {
    const secureStore = createFakeSecureStore();
    secureStore.getError = new Error(
      "native stack trace leaked local-unlock-v1:secret-value",
    );
    const driver = createDriver({ secureStore });

    const error = await captureRejection(() =>
      driver.getItem("storage-key"),
    );

    expect(error).toBeInstanceOf(SecureLocalSecretDriverError);

    if (!(error instanceof Error)) {
      throw new Error("expected Error instance");
    }

    expect(error.message).not.toContain("local-unlock-v1");
    expect(error.message).not.toContain("secret-value");
    expect(error.message).not.toContain("native stack trace");
  });

  it("rejects empty authentication prompts", () => {
    expect(() =>
      createExpoSecureLocalSecretDriver({
        secureStore: createFakeSecureStore(),
        authenticationPrompt: "   ",
        keychainService: "kor.v1.local-unlock",
      }),
    ).toThrow("authenticationPrompt must not be empty");
  });

  it("rejects empty keychain service", () => {
    expect(() =>
      createExpoSecureLocalSecretDriver({
        secureStore: createFakeSecureStore(),
        authenticationPrompt: "Unlock your health vault",
        keychainService: "   ",
      }),
    ).toThrow("keychainService must not be empty");
  });

  it("does not import Expo, SQLite, Supabase, Shamir, recovery, or vault assembly modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/infrastructure/local-unlock/expoSecureLocalSecretDriver.ts",
    );
    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    expect(source).not.toContain("expo-secure-store");
    expect(source).not.toContain("sqlite");
    expect(source).not.toContain("watermelondb");
    expect(source).not.toContain("supabase");
    expect(source).not.toContain("shamir");
    expect(source).not.toContain("recovery");
    expect(source).not.toContain("vault-assembly");
    expect(source).not.toContain("localvaultassembly");
  });
});