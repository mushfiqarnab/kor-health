import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { ExpoSecureStoreOptionsLike } from "../../../infrastructure/local-unlock/expoSecureLocalSecretDriver";

import {
  createMobileRuntime,
  type MobileRuntimeLocalAuthenticationModuleLike,
  type MobileRuntimeSecureStoreModuleLike,
} from "../createMobileRuntime";

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

class FakeSecureStoreModule implements MobileRuntimeSecureStoreModuleLike {
  readonly calls: SecureStoreCall[] = [];
  available = true;
  storedValue: string | null = "local-unlock-v1:stored-value";

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
  }

  async getItemAsync(
    key: string,
    options?: ExpoSecureStoreOptionsLike,
  ): Promise<string | null> {
    this.calls.push({ method: "getItemAsync", key, options });
    return this.storedValue;
  }

  async deleteItemAsync(
    key: string,
    options?: ExpoSecureStoreOptionsLike,
  ): Promise<void> {
    this.calls.push({ method: "deleteItemAsync", key, options });
  }
}

class FakeLocalAuthenticationModule
  implements MobileRuntimeLocalAuthenticationModuleLike
{
  readonly calls: string[] = [];
  hasHardware = true;
  enrolled = true;

  async hasHardwareAsync(): Promise<boolean> {
    this.calls.push("hasHardwareAsync");
    return this.hasHardware;
  }

  async isEnrolledAsync(): Promise<boolean> {
    this.calls.push("isEnrolledAsync");
    return this.enrolled;
  }
}

function createSecureStore(): FakeSecureStoreModule {
  return new FakeSecureStoreModule();
}

function createLocalAuthentication(): FakeLocalAuthenticationModule {
  return new FakeLocalAuthenticationModule();
}

function createRuntime(input?: {
  readonly secureStore?: FakeSecureStoreModule;
  readonly localAuthentication?: FakeLocalAuthenticationModule;
  readonly authenticationPrompt?: string;
  readonly keychainService?: string;
}) {
  return createMobileRuntime({
    secureStore: input?.secureStore ?? createSecureStore(),
    localAuthentication:
      input?.localAuthentication ?? createLocalAuthentication(),
    authenticationPrompt: input?.authenticationPrompt,
    keychainService: input?.keychainService,
  });
}

describe("Mobile runtime composition boundary contract", () => {
  it("creates a frozen runtime object with secureLocalSecretDriver and checkSecurityReadiness", () => {
    const runtime = createRuntime();

    expect(runtime.secureLocalSecretDriver).toBeDefined();
    expect(typeof runtime.secureLocalSecretDriver.setItem).toBe("function");
    expect(typeof runtime.secureLocalSecretDriver.getItem).toBe("function");
    expect(typeof runtime.secureLocalSecretDriver.deleteItem).toBe("function");
    expect(typeof runtime.checkSecurityReadiness).toBe("function");
    expect(Object.isFrozen(runtime)).toBe(true);
  });

  it("uses default authenticationPrompt and keychainService when config is omitted", async () => {
    const secureStore = createSecureStore();
    const runtime = createRuntime({ secureStore });

    await runtime.secureLocalSecretDriver.getItem("storage-key");

    const getCall = secureStore.calls.find(
      (call) => call.method === "getItemAsync",
    );

    expect(getCall?.options).toEqual({
      keychainService: "kor.v1.local-unlock",
      requireAuthentication: true,
      authenticationPrompt: "Unlock your health vault",
    });
  });

  it("allows explicit authenticationPrompt and keychainService override", async () => {
    const secureStore = createSecureStore();
    const runtime = createRuntime({
      secureStore,
      authenticationPrompt: "Open KOr Health vault",
      keychainService: "kor.test.local-unlock",
    });

    await runtime.secureLocalSecretDriver.getItem("storage-key");

    const getCall = secureStore.calls.find(
      (call) => call.method === "getItemAsync",
    );

    expect(getCall?.options).toEqual({
      keychainService: "kor.test.local-unlock",
      requireAuthentication: true,
      authenticationPrompt: "Open KOr Health vault",
    });
  });

  it("secureLocalSecretDriver stores through the injected SecureStore module", async () => {
    const secureStore = createSecureStore();
    const runtime = createRuntime({ secureStore });

    await runtime.secureLocalSecretDriver.setItem(
      "storage-key",
      "local-unlock-v1:value",
    );

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

  it("checkSecurityReadiness uses injected SecureStore and LocalAuthentication modules", async () => {
    const secureStore = createSecureStore();
    const localAuthentication = createLocalAuthentication();
    const runtime = createRuntime({ secureStore, localAuthentication });

    const readiness = await runtime.checkSecurityReadiness();

    expect(readiness).toEqual({ status: "ready" });
    expect(secureStore.calls.map((call) => call.method)).toEqual([
      "isAvailableAsync",
    ]);
    expect(localAuthentication.calls).toEqual([
      "hasHardwareAsync",
      "isEnrolledAsync",
    ]);
  });

  it("returns local authentication readiness failures from injected module", async () => {
    const secureStore = createSecureStore();
    const localAuthentication = createLocalAuthentication();
    localAuthentication.enrolled = false;
    const runtime = createRuntime({ secureStore, localAuthentication });

    const readiness = await runtime.checkSecurityReadiness();

    expect(readiness).toEqual({ status: "local_auth_not_enrolled" });
  });

  it("runtime object does not expose raw native modules or stored values", () => {
    const secureStore = createSecureStore();
    const localAuthentication = createLocalAuthentication();
    const runtime = createRuntime({ secureStore, localAuthentication });

    expect("secureStore" in runtime).toBe(false);
    expect("localAuthentication" in runtime).toBe(false);
    expect(JSON.stringify(runtime).toLowerCase()).not.toContain(
      "local-unlock-v1",
    );
    expect(JSON.stringify(runtime).toLowerCase()).not.toContain(
      "stored-value",
    );
  });

  it("rejects empty authenticationPrompt", () => {
    expect(() =>
      createRuntime({
        authenticationPrompt: "   ",
      }),
    ).toThrow("authenticationPrompt must not be empty");
  });

  it("rejects empty keychainService", () => {
    expect(() =>
      createRuntime({
        keychainService: "   ",
      }),
    ).toThrow("keychainService must not be empty");
  });

  it("does not import real Expo modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/mobile/bootstrap/createMobileRuntime.ts",
    );
    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    expect(source).not.toContain("expo-secure-store");
    expect(source).not.toContain("expo-local-authentication");
  });

  it("does not import persistence, portal, recovery, vault assembly, background job, or UI modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/mobile/bootstrap/createMobileRuntime.ts",
    );
    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    const forbiddenImports = [
      "sqlite",
      "watermelondb",
      "supabase",
      "shamir",
      "recovery",
      "vault-assembly",
      "localvaultassembly",
      "background-sync",
      "sync-engine",
      "from \"react\"",
      "from 'react'",
      "react-native",
      ".tsx",
    ];

    for (const token of forbiddenImports) {
      expect(source).not.toContain(token);
    }
  });
});