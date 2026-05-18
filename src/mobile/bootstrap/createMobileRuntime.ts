import {
  createExpoSecureLocalSecretDriver,
  type ExpoSecureStoreModuleLike,
} from "../../infrastructure/local-unlock/expoSecureLocalSecretDriver";

import type { SecureLocalSecretDriver } from "../../infrastructure/local-unlock/secureLocalUnlockStore";

import {
  checkMobileSecurityReadiness,
  type MobileLocalAuthenticationModuleLike,
  type MobileSecurityReadinessResult,
  type MobileSecureStoreAvailabilityModuleLike,
} from "./mobileSecurityReadiness";

export type MobileRuntimeSecureStoreModuleLike =
  ExpoSecureStoreModuleLike & MobileSecureStoreAvailabilityModuleLike;

export type MobileRuntimeLocalAuthenticationModuleLike =
  MobileLocalAuthenticationModuleLike;

export interface CreateMobileRuntimeInput {
  readonly secureStore: MobileRuntimeSecureStoreModuleLike;
  readonly localAuthentication: MobileRuntimeLocalAuthenticationModuleLike;
  readonly authenticationPrompt?: string;
  readonly keychainService?: string;
}

export interface MobileRuntime {
  readonly secureLocalSecretDriver: SecureLocalSecretDriver;
  readonly checkSecurityReadiness: () => Promise<MobileSecurityReadinessResult>;
}

const DEFAULT_AUTHENTICATION_PROMPT = "Unlock your health vault";
const DEFAULT_KEYCHAIN_SERVICE = "kor.v1.local-unlock";

function resolveOptionalText(
  value: string | undefined,
  defaultValue: string,
): string {
  return value ?? defaultValue;
}

export function createMobileRuntime(
  input: CreateMobileRuntimeInput,
): MobileRuntime {
  const authenticationPrompt = resolveOptionalText(
    input.authenticationPrompt,
    DEFAULT_AUTHENTICATION_PROMPT,
  );

  const keychainService = resolveOptionalText(
    input.keychainService,
    DEFAULT_KEYCHAIN_SERVICE,
  );

  const secureLocalSecretDriver = createExpoSecureLocalSecretDriver({
    secureStore: input.secureStore,
    authenticationPrompt,
    keychainService,
  });

  const runtime: MobileRuntime = {
    secureLocalSecretDriver,
    checkSecurityReadiness: async () =>
      checkMobileSecurityReadiness({
        secureStore: input.secureStore,
        localAuthentication: input.localAuthentication,
      }),
  };

  return Object.freeze(runtime);
}