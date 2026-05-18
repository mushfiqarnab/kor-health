import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  checkMobileSecurityReadiness,
  type MobileLocalAuthenticationModuleLike,
  type MobileSecureStoreAvailabilityModuleLike,
} from "../mobileSecurityReadiness";

class FakeSecureStoreAvailabilityModule
  implements MobileSecureStoreAvailabilityModuleLike
{
  readonly calls: string[] = [];
  available = true;
  error: unknown;

  async isAvailableAsync(): Promise<boolean> {
    this.calls.push("isAvailableAsync");

    if (this.error) {
      throw this.error;
    }

    return this.available;
  }
}

class FakeLocalAuthenticationModule
  implements MobileLocalAuthenticationModuleLike
{
  readonly calls: string[] = [];
  hasHardware = true;
  enrolled = true;
  hardwareError: unknown;
  enrollmentError: unknown;

  async hasHardwareAsync(): Promise<boolean> {
    this.calls.push("hasHardwareAsync");

    if (this.hardwareError) {
      throw this.hardwareError;
    }

    return this.hasHardware;
  }

  async isEnrolledAsync(): Promise<boolean> {
    this.calls.push("isEnrolledAsync");

    if (this.enrollmentError) {
      throw this.enrollmentError;
    }

    return this.enrolled;
  }
}

function createSecureStore(): FakeSecureStoreAvailabilityModule {
  return new FakeSecureStoreAvailabilityModule();
}

function createLocalAuthentication(): FakeLocalAuthenticationModule {
  return new FakeLocalAuthenticationModule();
}

describe("Mobile security readiness contract", () => {
  it("returns ready when SecureStore is available, hardware exists, and authentication is enrolled", async () => {
    const secureStore = createSecureStore();
    const localAuthentication = createLocalAuthentication();

    const result = await checkMobileSecurityReadiness({
      secureStore,
      localAuthentication,
    });

    expect(result).toEqual({ status: "ready" });
    expect(secureStore.calls).toEqual(["isAvailableAsync"]);
    expect(localAuthentication.calls).toEqual([
      "hasHardwareAsync",
      "isEnrolledAsync",
    ]);
  });

  it("returns secure_store_unavailable when SecureStore is unavailable", async () => {
    const secureStore = createSecureStore();
    secureStore.available = false;
    const localAuthentication = createLocalAuthentication();

    const result = await checkMobileSecurityReadiness({
      secureStore,
      localAuthentication,
    });

    expect(result).toEqual({ status: "secure_store_unavailable" });
    expect(secureStore.calls).toEqual(["isAvailableAsync"]);
    expect(localAuthentication.calls).toEqual([]);
  });

  it("returns local_auth_hardware_unavailable when authentication hardware is missing", async () => {
    const secureStore = createSecureStore();
    const localAuthentication = createLocalAuthentication();
    localAuthentication.hasHardware = false;

    const result = await checkMobileSecurityReadiness({
      secureStore,
      localAuthentication,
    });

    expect(result).toEqual({ status: "local_auth_hardware_unavailable" });
    expect(secureStore.calls).toEqual(["isAvailableAsync"]);
    expect(localAuthentication.calls).toEqual(["hasHardwareAsync"]);
  });

  it("returns local_auth_not_enrolled when no authentication method is enrolled", async () => {
    const secureStore = createSecureStore();
    const localAuthentication = createLocalAuthentication();
    localAuthentication.enrolled = false;

    const result = await checkMobileSecurityReadiness({
      secureStore,
      localAuthentication,
    });

    expect(result).toEqual({ status: "local_auth_not_enrolled" });
    expect(secureStore.calls).toEqual(["isAvailableAsync"]);
    expect(localAuthentication.calls).toEqual([
      "hasHardwareAsync",
      "isEnrolledAsync",
    ]);
  });

  it("returns runtime_unavailable when SecureStore availability check throws", async () => {
    const secureStore = createSecureStore();
    secureStore.error = new Error("native SecureStore unavailable");
    const localAuthentication = createLocalAuthentication();

    const result = await checkMobileSecurityReadiness({
      secureStore,
      localAuthentication,
    });

    expect(result).toEqual({ status: "runtime_unavailable" });
    expect(secureStore.calls).toEqual(["isAvailableAsync"]);
    expect(localAuthentication.calls).toEqual([]);
  });

  it("returns runtime_unavailable when LocalAuthentication hardware check throws", async () => {
    const secureStore = createSecureStore();
    const localAuthentication = createLocalAuthentication();
    localAuthentication.hardwareError = new Error("native auth failure");

    const result = await checkMobileSecurityReadiness({
      secureStore,
      localAuthentication,
    });

    expect(result).toEqual({ status: "runtime_unavailable" });
    expect(secureStore.calls).toEqual(["isAvailableAsync"]);
    expect(localAuthentication.calls).toEqual(["hasHardwareAsync"]);
  });

  it("returns runtime_unavailable when LocalAuthentication enrollment check throws", async () => {
    const secureStore = createSecureStore();
    const localAuthentication = createLocalAuthentication();
    localAuthentication.enrollmentError = new Error("native enrollment failure");

    const result = await checkMobileSecurityReadiness({
      secureStore,
      localAuthentication,
    });

    expect(result).toEqual({ status: "runtime_unavailable" });
    expect(secureStore.calls).toEqual(["isAvailableAsync"]);
    expect(localAuthentication.calls).toEqual([
      "hasHardwareAsync",
      "isEnrolledAsync",
    ]);
  });

  it("does not call enrollment check when hardware check fails", async () => {
    const secureStore = createSecureStore();
    const localAuthentication = createLocalAuthentication();
    localAuthentication.hasHardware = false;

    await checkMobileSecurityReadiness({
      secureStore,
      localAuthentication,
    });

    expect(localAuthentication.calls).toEqual(["hasHardwareAsync"]);
  });

  it("does not expose native module instances in readiness results", async () => {
    const secureStore = createSecureStore();
    const localAuthentication = createLocalAuthentication();

    const result = await checkMobileSecurityReadiness({
      secureStore,
      localAuthentication,
    });

    const serializedResult = JSON.stringify(result).toLowerCase();

    expect(serializedResult).not.toContain("isavailableasync");
    expect(serializedResult).not.toContain("hashardwareasync");
    expect(serializedResult).not.toContain("isenrolledasync");
    expect(serializedResult).not.toContain("local-unlock-v1");
  });

  it("does not import forbidden runtime, persistence, portal, or recovery modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/mobile/bootstrap/mobileSecurityReadiness.ts",
    );
    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    const forbiddenImports = [
      "expo-secure-store",
      "expo-local-authentication",
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