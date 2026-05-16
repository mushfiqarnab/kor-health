

import { describe, expect, it } from "vitest";

import {
  createMedicationPlan,
  recordDoseEvent,
  projectDailyMedicationState,
  prepareMedicationPlanForCloudSync,
  prepareDoseEventForCloudSync,
} from "../medicationAdherence";

const deterministicPorts = {
  clock: {
    now: () => "2026-05-17T10:00:00.000+06:00",
  },
  idGenerator: {
    generate: (prefix: string) => `${prefix}_fixed_001`,
  },
};

const encryptionPort = {
  encrypt: (plaintext: string) =>
    `encrypted:${Buffer.from(plaintext, "utf8").toString("base64")}`,
};

describe("Medication adherence domain contract", () => {
  it("creates a medication plan without mutable adherence flags", () => {
    const plan = createMedicationPlan(
      {
        patientId: "patient-001",
        sourceRecordId: "record-001",
        brandName: "Insulatard",
        genericName: "Isophane insulin",
        doseInstruction: "10 units before breakfast",
        schedule: {
          type: "daily",
          times: ["08:00"],
        },
        startDate: "2026-05-17",
        createdByActorId: "caregiver-001",
        createdByRole: "caregiver",
      },
      deterministicPorts,
    );

    expect(plan.id).toBe("medplan_fixed_001");
    expect(plan.patientId).toBe("patient-001");
    expect(plan.status).toBe("active");
    expect(plan.createdAt).toBe("2026-05-17T10:00:00.000+06:00");

    expect(plan).not.toHaveProperty("takenToday");
    expect(plan).not.toHaveProperty("missedToday");
    expect(plan).not.toHaveProperty("lastTakenAt");
  });

  it("does not expose medication clinical fields or status in cloud-syncable payload", () => {
    const plan = createMedicationPlan(
      {
        patientId: "patient-001",
        sourceRecordId: "record-001",
        brandName: "Atorva",
        genericName: "Atorvastatin",
        doseInstruction: "20 mg at night",
        schedule: {
          type: "daily",
          times: ["22:00"],
        },
        startDate: "2026-05-17",
        createdByActorId: "patient-001",
        createdByRole: "patient",
      },
      deterministicPorts,
    );

    const syncPayload = prepareMedicationPlanForCloudSync(
      plan,
      encryptionPort,
    );

    const serialized = JSON.stringify(syncPayload);

    expect(serialized).not.toContain("Atorva");
    expect(serialized).not.toContain("Atorvastatin");
    expect(serialized).not.toContain("20 mg");
    expect(serialized).not.toContain("22:00");
    expect(serialized).not.toContain("active");

    expect(syncPayload).toHaveProperty("ciphertext");
    expect(syncPayload).toHaveProperty("schemaVersion", 1);
  });

  it("records dose events as immutable append-only events", () => {
    const doseEvent = recordDoseEvent(
      {
        patientId: "patient-001",
        medicationPlanId: "med-plan-001",
        scheduledAt: "2026-05-17T08:00:00+06:00",
        actualAt: "2026-05-17T08:05:00+06:00",
        status: "taken",
        actorId: "patient-001",
        actorRole: "patient",
      },
      deterministicPorts,
    );

    expect(doseEvent.id).toBe("doseevt_fixed_001");
    expect(doseEvent.type).toBe("dose_taken");
    expect(doseEvent.medicationPlanId).toBe("med-plan-001");

    expect(doseEvent).not.toHaveProperty("update");
    expect(doseEvent).not.toHaveProperty("delete");
  });

  it("encrypts dose status, exact timestamps, and actor data before cloud sync", () => {
    const doseEvent = recordDoseEvent(
      {
        patientId: "patient-001",
        medicationPlanId: "med-plan-001",
        scheduledAt: "2026-05-17T22:00:00+06:00",
        actualAt: null,
        status: "missed",
        actorId: "caregiver-001",
        actorRole: "caregiver",
      },
      deterministicPorts,
    );

    const syncPayload = prepareDoseEventForCloudSync(
      doseEvent,
      encryptionPort,
    );

    const serialized = JSON.stringify(syncPayload);

    expect(serialized).not.toContain("missed");
    expect(serialized).not.toContain("2026-05-17T22:00:00+06:00");
    expect(serialized).not.toContain("caregiver-001");
    expect(serialized).not.toContain("caregiver");

    expect(syncPayload).toHaveProperty("ciphertext");
    expect(syncPayload).toHaveProperty("schemaVersion", 1);
  });

  it("projects daily medication state from dose events instead of mutable plan flags", () => {
    const events = [
      recordDoseEvent(
        {
          patientId: "patient-001",
          medicationPlanId: "med-plan-001",
          scheduledAt: "2026-05-17T08:00:00+06:00",
          actualAt: "2026-05-17T08:03:00+06:00",
          status: "taken",
          actorId: "patient-001",
          actorRole: "patient",
        },
        {
          clock: {
            now: () => "2026-05-17T08:03:10.000+06:00",
          },
          idGenerator: {
            generate: (prefix: string) => `${prefix}_morning`,
          },
        },
      ),
      recordDoseEvent(
        {
          patientId: "patient-001",
          medicationPlanId: "med-plan-001",
          scheduledAt: "2026-05-17T22:00:00+06:00",
          actualAt: null,
          status: "missed",
          actorId: "caregiver-001",
          actorRole: "caregiver",
        },
        {
          clock: {
            now: () => "2026-05-17T23:00:00.000+06:00",
          },
          idGenerator: {
            generate: (prefix: string) => `${prefix}_night`,
          },
        },
      ),
    ];

    const projection = projectDailyMedicationState({
      patientId: "patient-001",
      medicationPlanId: "med-plan-001",
      date: "2026-05-17",
      events,
    });

    expect(projection.totalScheduled).toBe(2);
    expect(projection.taken).toBe(1);
    expect(projection.missed).toBe(1);
    expect(projection.skipped).toBe(0);
    expect(projection.delayed).toBe(0);
    expect(projection.requiresCaregiverAttention).toBe(true);
  });
});