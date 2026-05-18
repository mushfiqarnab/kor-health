import type { LocalUnlockLoadResult } from "../../infrastructure/local-unlock/secureLocalUnlockStore";
import type { MobileSecurityReadinessResult } from "../../mobile/bootstrap/mobileSecurityReadiness";

export type UnlockSessionStatus =
  | "booting"
  | "runtime_unavailable"
  | "locked_ready"
  | "unlocking"
  | "unlocked"
  | "locked_missing"
  | "locked_cancelled"
  | "locked_unavailable"
  | "locked_malformed"
  | "locked_auth_changed"
  | "relocking"
  | "relocked"
  | "recovery_required";

export interface UnlockSessionState {
  readonly status: UnlockSessionStatus;
  readonly revision: number;
  readonly lastTransitionReason?: string;
}

export type UnlockSessionEvent =
  | {
      readonly type: "runtime_readiness_resolved";
      readonly readiness: MobileSecurityReadinessResult;
    }
  | {
      readonly type: "unlock_requested";
    }
  | {
      readonly type: "local_unlock_resolved";
      readonly result: LocalUnlockLoadResult;
    }
  | {
      readonly type: "relock_requested";
    }
  | {
      readonly type: "relock_completed";
    }
  | {
      readonly type: "reset_to_locked_ready";
    };

export interface UnlockSessionTransitionResult {
  readonly state: UnlockSessionState;
  readonly changed: boolean;
}

const FORBIDDEN_UNLOCK_SESSION_STATE_TOKENS = [
  "rawkeybytes",
  "raw key",
  "local-unlock-v1",
  "sealed-key-envelope",
  "k_root",
  "k_master",
  "k_local_unlock",
  "k_recovery_wrap",
  "diagnosis",
  "prescription",
  "medical",
  "clinical",
  "patientname",
  "nid",
  "phone",
  "email",
];

function createState(
  status: UnlockSessionStatus,
  revision: number,
  lastTransitionReason?: string,
): UnlockSessionState {
  const state =
    lastTransitionReason === undefined
      ? {
          status,
          revision,
        }
      : {
          status,
          revision,
          lastTransitionReason,
        };

  return Object.freeze(state);
}

function unchanged(state: UnlockSessionState): UnlockSessionTransitionResult {
  return Object.freeze({
    state,
    changed: false,
  });
}

function changed(
  state: UnlockSessionState,
  status: UnlockSessionStatus,
  lastTransitionReason: string,
): UnlockSessionTransitionResult {
  return Object.freeze({
    state: createState(status, state.revision + 1, lastTransitionReason),
    changed: true,
  });
}

function mapReadinessToState(
  state: UnlockSessionState,
  readiness: MobileSecurityReadinessResult,
): UnlockSessionTransitionResult {
  if (state.status !== "booting") {
    return unchanged(state);
  }

  if (readiness.status === "ready") {
    return changed(state, "locked_ready", "runtime_ready");
  }

  return changed(state, "runtime_unavailable", readiness.status);
}

function mapLocalUnlockResultToState(
  state: UnlockSessionState,
  result: LocalUnlockLoadResult,
): UnlockSessionTransitionResult {
  if (state.status !== "unlocking") {
    return unchanged(state);
  }

  if (result.status === "unlocked") {
    return changed(state, "unlocked", "local_unlock_succeeded");
  }

  if (result.status === "locked_cancelled") {
    return changed(state, "locked_cancelled", "locked_cancelled");
  }

  if (result.status === "locked_unavailable") {
    return changed(state, "locked_unavailable", "locked_unavailable");
  }

  if (result.status === "locked_missing") {
    return changed(state, "recovery_required", "locked_missing");
  }

  if (result.status === "locked_malformed") {
    return changed(state, "recovery_required", "locked_malformed");
  }

  if (result.status === "locked_auth_changed") {
    return changed(state, "recovery_required", "locked_auth_changed");
  }

  return unchanged(state);
}

function resetToLockedReady(
  state: UnlockSessionState,
): UnlockSessionTransitionResult {
  if (
    state.status === "locked_cancelled" ||
    state.status === "locked_unavailable" ||
    state.status === "relocked"
  ) {
    return changed(state, "locked_ready", "reset_to_locked_ready");
  }

  return unchanged(state);
}

export function createInitialUnlockSessionState(): UnlockSessionState {
  return createState("booting", 0);
}

export function reduceUnlockSessionState(
  state: UnlockSessionState,
  event: UnlockSessionEvent,
): UnlockSessionTransitionResult {
  if (event.type === "runtime_readiness_resolved") {
    return mapReadinessToState(state, event.readiness);
  }

  if (event.type === "unlock_requested") {
    if (state.status === "locked_ready") {
      return changed(state, "unlocking", "unlock_requested");
    }

    return unchanged(state);
  }

  if (event.type === "local_unlock_resolved") {
    return mapLocalUnlockResultToState(state, event.result);
  }

  if (event.type === "relock_requested") {
    if (state.status === "unlocked") {
      return changed(state, "relocking", "relock_requested");
    }

    return unchanged(state);
  }

  if (event.type === "relock_completed") {
    if (state.status === "relocking") {
      return changed(state, "relocked", "relock_completed");
    }

    return unchanged(state);
  }

  if (event.type === "reset_to_locked_ready") {
    return resetToLockedReady(state);
  }

  return unchanged(state);
}

export function canAttemptUnlock(state: UnlockSessionState): boolean {
  return (
    state.status === "locked_ready" ||
    state.status === "locked_cancelled" ||
    state.status === "locked_unavailable" ||
    state.status === "relocked"
  );
}

export function canReadVault(state: UnlockSessionState): boolean {
  return state.status === "unlocked";
}

export function canRunBackgroundSync(state: UnlockSessionState): boolean {
  return state.status === "unlocked";
}

export function requiresRecovery(state: UnlockSessionState): boolean {
  return state.status === "recovery_required";
}

export function assertNoUnlockSessionSecretLeak(value: unknown): void {
  const serializedValue = JSON.stringify(value).toLowerCase();

  const hasForbiddenToken = FORBIDDEN_UNLOCK_SESSION_STATE_TOKENS.some(
    (token) => serializedValue.includes(token),
  );

  if (hasForbiddenToken) {
    throw new Error("forbidden unlock session state metadata");
  }
}