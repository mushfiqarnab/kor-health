export interface MobileSecureStoreAvailabilityModuleLike {
  isAvailableAsync(): Promise<boolean>;
}

export interface MobileLocalAuthenticationModuleLike {
  hasHardwareAsync(): Promise<boolean>;
  isEnrolledAsync(): Promise<boolean>;
}

export type MobileSecurityReadinessResult =
  | {
      readonly status: "ready";
    }
  | {
      readonly status:
        | "secure_store_unavailable"
        | "local_auth_hardware_unavailable"
        | "local_auth_not_enrolled"
        | "runtime_unavailable";
    };

export interface CheckMobileSecurityReadinessInput {
  readonly secureStore: MobileSecureStoreAvailabilityModuleLike;
  readonly localAuthentication: MobileLocalAuthenticationModuleLike;
}

function freezeReadinessResult(
  result: MobileSecurityReadinessResult,
): MobileSecurityReadinessResult {
  return Object.freeze(result);
}

export async function checkMobileSecurityReadiness(
  input: CheckMobileSecurityReadinessInput,
): Promise<MobileSecurityReadinessResult> {
  let secureStoreAvailable: boolean;

  try {
    secureStoreAvailable = await input.secureStore.isAvailableAsync();
  } catch {
    return freezeReadinessResult({ status: "runtime_unavailable" });
  }

  if (!secureStoreAvailable) {
    return freezeReadinessResult({ status: "secure_store_unavailable" });
  }

  let localAuthenticationHardwareAvailable: boolean;

  try {
    localAuthenticationHardwareAvailable =
      await input.localAuthentication.hasHardwareAsync();
  } catch {
    return freezeReadinessResult({ status: "runtime_unavailable" });
  }

  if (!localAuthenticationHardwareAvailable) {
    return freezeReadinessResult({
      status: "local_auth_hardware_unavailable",
    });
  }

  let localAuthenticationEnrolled: boolean;

  try {
    localAuthenticationEnrolled =
      await input.localAuthentication.isEnrolledAsync();
  } catch {
    return freezeReadinessResult({ status: "runtime_unavailable" });
  }

  if (!localAuthenticationEnrolled) {
    return freezeReadinessResult({ status: "local_auth_not_enrolled" });
  }

  return freezeReadinessResult({ status: "ready" });
}