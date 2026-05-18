import {
  SecureLocalSecretDriverError,
  type SecureLocalSecretDriver,
  type SecureLocalSecretDriverErrorCode,
} from "./secureLocalUnlockStore";

export interface ExpoSecureStoreOptionsLike {
  readonly keychainService: string;
  readonly requireAuthentication: boolean;
  readonly authenticationPrompt?: string;
}

export interface ExpoSecureStoreModuleLike {
  isAvailableAsync(): Promise<boolean>;

  setItemAsync(
    key: string,
    value: string,
    options?: ExpoSecureStoreOptionsLike,
  ): Promise<void>;

  getItemAsync(
    key: string,
    options?: ExpoSecureStoreOptionsLike,
  ): Promise<string | null>;

  deleteItemAsync(
    key: string,
    options?: ExpoSecureStoreOptionsLike,
  ): Promise<void>;
}

export interface ExpoSecureLocalSecretDriverConfig {
  readonly secureStore: ExpoSecureStoreModuleLike;
  readonly authenticationPrompt: string;
  readonly keychainService: string;
}

function requireNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
}

function buildAuthenticatedOptions(
  config: ExpoSecureLocalSecretDriverConfig,
): ExpoSecureStoreOptionsLike {
  return {
    keychainService: config.keychainService,
    requireAuthentication: true,
    authenticationPrompt: config.authenticationPrompt,
  };
}

function buildDeleteOptions(
  config: ExpoSecureLocalSecretDriverConfig,
): ExpoSecureStoreOptionsLike {
  return {
    keychainService: config.keychainService,
    requireAuthentication: false,
  };
}

function buildReadOptions(
  config: ExpoSecureLocalSecretDriverConfig,
): ExpoSecureStoreOptionsLike {
  return {
    keychainService: config.keychainService,
    requireAuthentication: true,
    authenticationPrompt: config.authenticationPrompt,
  };
}

function errorText(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name} ${error.message}`.toLowerCase();
  }

  return String(error).toLowerCase();
}

function classifyNativeFailure(
  error: unknown,
): SecureLocalSecretDriverErrorCode {
  const text = errorText(error);

  if (
    text.includes("cancel") ||
    text.includes("canceled") ||
    text.includes("cancelled") ||
    text.includes("user canceled") ||
    text.includes("user cancelled")
  ) {
    return "authentication_cancelled";
  }

  if (
    text.includes("invalidated") ||
    text.includes("keypermanentlyinvalidated") ||
    text.includes("biometric set changed") ||
    text.includes("biometric changed") ||
    text.includes("authentication changed")
  ) {
    return "authentication_changed";
  }

  return "unknown";
}

async function assertSecureStoreAvailable(
  secureStore: ExpoSecureStoreModuleLike,
): Promise<void> {
  let available = false;

  try {
    available = await secureStore.isAvailableAsync();
  } catch {
    throw new SecureLocalSecretDriverError("unavailable");
  }

  if (!available) {
    throw new SecureLocalSecretDriverError("unavailable");
  }
}

function sanitizeNativeFailure(error: unknown): SecureLocalSecretDriverError {
  if (error instanceof SecureLocalSecretDriverError) {
    return error;
  }

  return new SecureLocalSecretDriverError(classifyNativeFailure(error));
}

export function createExpoSecureLocalSecretDriver(
  config: ExpoSecureLocalSecretDriverConfig,
): SecureLocalSecretDriver {
  requireNonEmpty(config.authenticationPrompt, "authenticationPrompt");
  requireNonEmpty(config.keychainService, "keychainService");

  return Object.freeze({
    async setItem(key: string, value: string): Promise<void> {
      await assertSecureStoreAvailable(config.secureStore);

      try {
        await config.secureStore.setItemAsync(
          key,
          value,
          buildAuthenticatedOptions(config),
        );
      } catch (error) {
        throw sanitizeNativeFailure(error);
      }
    },

    async getItem(key: string): Promise<string | null> {
      await assertSecureStoreAvailable(config.secureStore);

      try {
        return await config.secureStore.getItemAsync(
          key,
          buildAuthenticatedOptions(config),
        );
      } catch (error) {
        throw sanitizeNativeFailure(error);
      }
    },

    async deleteItem(key: string): Promise<void> {
      await assertSecureStoreAvailable(config.secureStore);

      try {
        await config.secureStore.deleteItemAsync(
          key,
          buildDeleteOptions(config),
        );
      } catch (error) {
        throw sanitizeNativeFailure(error);
      }
    },
  });
}