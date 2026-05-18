import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { LocalUnlockLoadResult } from "../../../infrastructure/local-unlock/secureLocalUnlockStore";
import type { MobileSecurityReadinessResult } from "../../../mobile/bootstrap/mobileSecurityReadiness";

import {
  assertNoUnlockSessionSecretLeak,
  canAttemptUnlock,
  canReadVault,
  canRunBackgroundSync,
  createInitialUnlockSessionState,
  reduceUnlockSessionState,
  requiresRecovery,
  type UnlockSessionState,
} from "../unlockSessionStateMachine";

function resolveRuntimeReadiness(
  readiness: MobileSecurityReadinessResult,
): UnlockSessionState {
  return reduceUnlockSessionState(createInitialUnlockSessionState(), {
    type: "runtime_readiness_resolved",
    readiness,
  }).state;
}

function lockedReadyState(): UnlockSessionState {
  return resolveRuntimeReadiness({ status: "ready" });
}

function unlockingState(): UnlockSessionState {
  return reduceUnlockSessionState(lockedReadyState(), {
    type: "unlock_requested",
  }).state;
}

function unlockedResult(): LocalUnlockLoadResult {
  return {
    status: "unlocked",
    material: {
      keyScopeId: "ks_10",
      keyVersion: 1,
      purpose: "local_keyring",
      rawKeyBytes: new Uint8Array(32).fill(77),
    },
  };
}

function transitionToStatus(
  state: UnlockSessionState,
  event: Parameters<typeof reduceUnlockSessionState>[1],
): UnlockSessionState {
  return reduceUnlockSessionState(state, event).state;
}

describe("Unlock session state machine contract", () => {
  it("creates a frozen booting initial state", () => {
    const state = createInitialUnlockSessionState();

    expect(state).toEqual({
      status: "booting",
      revision: 0,
    });
    expect(Object.isFrozen(state)).toBe(true);
  });

  it("transitions from booting to locked_ready when runtime readiness is ready", () => {
    const next = resolveRuntimeReadiness({ status: "ready" });

    expect(next.status).toBe("locked_ready");
    expect(next.revision).toBe(1);
    expect(next.lastTransitionReason).toBe("runtime_ready");
    expect(Object.isFrozen(next)).toBe(true);
  });

  it("maps secure_store_unavailable readiness to runtime_unavailable", () => {
    const next = resolveRuntimeReadiness({
      status: "secure_store_unavailable",
    });

    expect(next.status).toBe("runtime_unavailable");
    expect(next.lastTransitionReason).toBe("secure_store_unavailable");
  });

  it("maps local_auth_hardware_unavailable readiness to runtime_unavailable", () => {
    const next = resolveRuntimeReadiness({
      status: "local_auth_hardware_unavailable",
    });

    expect(next.status).toBe("runtime_unavailable");
    expect(next.lastTransitionReason).toBe(
      "local_auth_hardware_unavailable",
    );
  });

  it("maps local_auth_not_enrolled readiness to runtime_unavailable", () => {
    const next = resolveRuntimeReadiness({
      status: "local_auth_not_enrolled",
    });

    expect(next.status).toBe("runtime_unavailable");
    expect(next.lastTransitionReason).toBe("local_auth_not_enrolled");
  });

  it("maps runtime_unavailable readiness to runtime_unavailable", () => {
    const next = resolveRuntimeReadiness({
      status: "runtime_unavailable",
    });

    expect(next.status).toBe("runtime_unavailable");
    expect(next.lastTransitionReason).toBe("runtime_unavailable");
  });

  it("transitions from locked_ready to unlocking on unlock_requested", () => {
    const next = transitionToStatus(lockedReadyState(), {
      type: "unlock_requested",
    });

    expect(next.status).toBe("unlocking");
    expect(next.revision).toBe(2);
    expect(next.lastTransitionReason).toBe("unlock_requested");
  });

  it("ignores unlock_requested when state is not allowed to unlock", () => {
    const unlocked = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: unlockedResult(),
    });

    const next = transitionToStatus(unlocked, {
      type: "unlock_requested",
    });

    expect(next).toBe(unlocked);
    expect(next.status).toBe("unlocked");
  });

  it("transitions from unlocking to unlocked when local unlock succeeds", () => {
    const next = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: unlockedResult(),
    });

    expect(next.status).toBe("unlocked");
    expect(next.lastTransitionReason).toBe("local_unlock_succeeded");
    expect(next.revision).toBe(3);
  });

  it("maps locked_cancelled to locked_cancelled and keeps it retryable", () => {
    const next = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: { status: "locked_cancelled" },
    });

    expect(next.status).toBe("locked_cancelled");
    expect(next.lastTransitionReason).toBe("locked_cancelled");
    expect(canAttemptUnlock(next)).toBe(true);
    expect(requiresRecovery(next)).toBe(false);
  });

  it("maps locked_unavailable to locked_unavailable and keeps it retryable", () => {
    const next = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: { status: "locked_unavailable" },
    });

    expect(next.status).toBe("locked_unavailable");
    expect(next.lastTransitionReason).toBe("locked_unavailable");
    expect(canAttemptUnlock(next)).toBe(true);
    expect(requiresRecovery(next)).toBe(false);
  });

  it("maps locked_missing to recovery_required", () => {
    const next = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: { status: "locked_missing" },
    });

    expect(next.status).toBe("recovery_required");
    expect(next.lastTransitionReason).toBe("locked_missing");
    expect(requiresRecovery(next)).toBe(true);
  });

  it("maps locked_malformed to recovery_required", () => {
    const next = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: { status: "locked_malformed" },
    });

    expect(next.status).toBe("recovery_required");
    expect(next.lastTransitionReason).toBe("locked_malformed");
    expect(requiresRecovery(next)).toBe(true);
  });

  it("maps locked_auth_changed to recovery_required", () => {
    const next = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: { status: "locked_auth_changed" },
    });

    expect(next.status).toBe("recovery_required");
    expect(next.lastTransitionReason).toBe("locked_auth_changed");
    expect(requiresRecovery(next)).toBe(true);
  });

  it("does not allow recovery_required to reset to locked_ready", () => {
    const recoveryRequired = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: { status: "locked_auth_changed" },
    });

    const next = transitionToStatus(recoveryRequired, {
      type: "reset_to_locked_ready",
    });

    expect(next).toBe(recoveryRequired);
    expect(next.status).toBe("recovery_required");
  });

  it("allows locked_cancelled to reset to locked_ready", () => {
    const cancelled = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: { status: "locked_cancelled" },
    });

    const next = transitionToStatus(cancelled, {
      type: "reset_to_locked_ready",
    });

    expect(next.status).toBe("locked_ready");
    expect(next.lastTransitionReason).toBe("reset_to_locked_ready");
  });

  it("allows locked_unavailable to reset to locked_ready", () => {
    const unavailable = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: { status: "locked_unavailable" },
    });

    const next = transitionToStatus(unavailable, {
      type: "reset_to_locked_ready",
    });

    expect(next.status).toBe("locked_ready");
    expect(next.lastTransitionReason).toBe("reset_to_locked_ready");
  });

  it("transitions unlocked to relocking on relock_requested", () => {
    const unlocked = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: unlockedResult(),
    });

    const next = transitionToStatus(unlocked, {
      type: "relock_requested",
    });

    expect(next.status).toBe("relocking");
    expect(next.lastTransitionReason).toBe("relock_requested");
  });

  it("transitions relocking to relocked on relock_completed", () => {
    const unlocked = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: unlockedResult(),
    });

    const relocking = transitionToStatus(unlocked, {
      type: "relock_requested",
    });

    const next = transitionToStatus(relocking, {
      type: "relock_completed",
    });

    expect(next.status).toBe("relocked");
    expect(next.lastTransitionReason).toBe("relock_completed");
  });

  it("allows relocked to reset to locked_ready", () => {
    const unlocked = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: unlockedResult(),
    });

    const relocking = transitionToStatus(unlocked, {
      type: "relock_requested",
    });

    const relocked = transitionToStatus(relocking, {
      type: "relock_completed",
    });

    const next = transitionToStatus(relocked, {
      type: "reset_to_locked_ready",
    });

    expect(next.status).toBe("locked_ready");
    expect(next.lastTransitionReason).toBe("reset_to_locked_ready");
  });

  it("canReadVault returns true only when unlocked", () => {
    const unlocked = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: unlockedResult(),
    });

    expect(canReadVault(unlocked)).toBe(true);
    expect(canReadVault(lockedReadyState())).toBe(false);
    expect(canReadVault(unlockingState())).toBe(false);
  });

  it("canRunBackgroundSync returns true only when unlocked", () => {
    const unlocked = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: unlockedResult(),
    });

    expect(canRunBackgroundSync(unlocked)).toBe(true);
    expect(canRunBackgroundSync(lockedReadyState())).toBe(false);
    expect(canRunBackgroundSync(unlockingState())).toBe(false);
    expect(
      canRunBackgroundSync(
        transitionToStatus(unlockingState(), {
          type: "local_unlock_resolved",
          result: { status: "locked_cancelled" },
        }),
      ),
    ).toBe(false);
  });

  it("canAttemptUnlock returns true only for retryable locked states", () => {
    const initial = createInitialUnlockSessionState();
    const lockedReady = lockedReadyState();
    const unlocking = unlockingState();
    const cancelled = transitionToStatus(unlocking, {
      type: "local_unlock_resolved",
      result: { status: "locked_cancelled" },
    });
    const unavailable = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: { status: "locked_unavailable" },
    });
    const unlocked = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: unlockedResult(),
    });
    const relocking = transitionToStatus(unlocked, {
      type: "relock_requested",
    });
    const relocked = transitionToStatus(relocking, {
      type: "relock_completed",
    });
    const recoveryRequired = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: { status: "locked_malformed" },
    });

    expect(canAttemptUnlock(initial)).toBe(false);
    expect(canAttemptUnlock(lockedReady)).toBe(true);
    expect(canAttemptUnlock(unlocking)).toBe(false);
    expect(canAttemptUnlock(cancelled)).toBe(true);
    expect(canAttemptUnlock(unavailable)).toBe(true);
    expect(canAttemptUnlock(unlocked)).toBe(false);
    expect(canAttemptUnlock(relocking)).toBe(false);
    expect(canAttemptUnlock(relocked)).toBe(true);
    expect(canAttemptUnlock(recoveryRequired)).toBe(false);
  });

  it("requiresRecovery returns true only for recovery_required", () => {
    const recoveryRequired = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: { status: "locked_missing" },
    });

    expect(requiresRecovery(recoveryRequired)).toBe(true);
    expect(requiresRecovery(lockedReadyState())).toBe(false);
    expect(requiresRecovery(unlockingState())).toBe(false);
  });

  it("state objects do not serialize raw key material, local-unlock values, sealed envelopes, or medical data", () => {
    const unlocked = transitionToStatus(unlockingState(), {
      type: "local_unlock_resolved",
      result: unlockedResult(),
    });

    const output = JSON.stringify(unlocked).toLowerCase();

    expect(output).not.toContain("rawkeybytes");
    expect(output).not.toContain("local-unlock-v1");
    expect(output).not.toContain("sealed-key-envelope");
    expect(output).not.toContain("k_root");
    expect(output).not.toContain("k_local_unlock");
    expect(output).not.toContain("medical");
    expect(output).not.toContain("diagnosis");
    expect(output).not.toContain("prescription");

    expect(() => assertNoUnlockSessionSecretLeak(unlocked)).not.toThrow();
  });

  it("rejects unsafe unlock session state objects during explicit leak assertion", () => {
    const unsafeState = {
      status: "unlocked",
      revision: 1,
      rawKeyBytes: new Uint8Array(32).fill(1),
      serializedValue: "local-unlock-v1:secret",
      diagnosis: "private medical data",
    };

    expect(() => assertNoUnlockSessionSecretLeak(unsafeState)).toThrow(
      "forbidden unlock session state metadata",
    );
  });

  it("does not import Expo, SecureStore, persistence, portal, AI, recovery implementation, vault opening, or background modules", () => {
    const sourcePath = resolve(
      process.cwd(),
      "src/application/unlock-session/unlockSessionStateMachine.ts",
    );
    const source = readFileSync(sourcePath, "utf8").toLowerCase();

    const forbiddenImports = [
      "expo-secure-store",
      "expo-local-authentication",
      "securestore",
      "sqlite",
      "watermelondb",
      "supabase",
      "shamir",
      "recovery-workflow",
      "recovery-service",
      "recoveryimplementation",
      "shamir-recovery",
      "from \"../recovery",
      "from '../../recovery",
      "from \"../../recovery",
      "from '../../../recovery",
      "vault-assembly",
      "localvaultassembly",
      "vault-open",
      "open-vault",
      "doctor-portal",
      "patient-portal",
      "ai-summary",
      "llm",
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