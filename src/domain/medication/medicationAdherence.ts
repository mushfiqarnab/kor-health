export type ActorRole = "patient" | "caregiver" | "doctor";

export type MedicationPlanStatus =
  | "active"
  | "paused"
  | "stopped"
  | "completed"
  | "uncertain";

export type DoseEventStatus = "taken" | "missed" | "skipped" | "delayed";

export type DoseEventType =
  | "dose_taken"
  | "dose_missed"
  | "dose_skipped"
  | "dose_delayed";

export type MedicationSchedule =
  | {
      readonly type: "daily";
      readonly times: readonly string[];
    }
  | {
      readonly type: "interval";
      readonly everyHours: number;
    };

export interface ClockPort {
  now: () => string;
}

export interface IdGeneratorPort {
  generate: (prefix: string) => string;
}

export interface DomainPorts {
  clock: ClockPort;
  idGenerator: IdGeneratorPort;
}

export interface EncryptionPort {
  encrypt: (plaintext: string) => string;
}

export interface CreateMedicationPlanInput {
  patientId: string;
  sourceRecordId: string;
  brandName: string;
  genericName: string;
  doseInstruction: string;
  schedule: MedicationSchedule;
  startDate: string;
  endDate?: string | null;
  createdByActorId: string;
  createdByRole: ActorRole;
}

export interface MedicationPlan {
  readonly id: string;
  readonly patientId: string;
  readonly sourceRecordId: string;
  readonly brandName: string;
  readonly genericName: string;
  readonly doseInstruction: string;
  readonly schedule: MedicationSchedule;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly status: MedicationPlanStatus;
  readonly createdByActorId: string;
  readonly createdByRole: ActorRole;
  readonly schemaVersion: 1;
  readonly createdAt: string;
}

export interface RecordDoseEventInput {
  patientId: string;
  medicationPlanId: string;
  scheduledAt: string;
  actualAt: string | null;
  status: DoseEventStatus;
  actorId: string;
  actorRole: ActorRole;
}

export interface DoseEvent {
  readonly id: string;
  readonly patientId: string;
  readonly medicationPlanId: string;
  readonly type: DoseEventType;
  readonly scheduledAt: string;
  readonly actualAt: string | null;
  readonly status: DoseEventStatus;
  readonly actorId: string;
  readonly actorRole: ActorRole;
  readonly schemaVersion: 1;
  readonly createdAt: string;
}

export interface MedicationPlanCloudSyncPayload {
  readonly id: string;
  readonly patientId: string;
  readonly sourceRecordId: string;
  readonly ciphertext: string;
  readonly schemaVersion: 1;
}

export interface DoseEventCloudSyncPayload {
  readonly id: string;
  readonly patientId: string;
  readonly medicationPlanId: string;
  readonly eventCategory: "dose_event";
  readonly ciphertext: string;
  readonly schemaVersion: 1;
}

export interface ProjectDailyMedicationStateInput {
  patientId: string;
  medicationPlanId: string;
  date: string;
  events: readonly DoseEvent[];
}

export interface DailyMedicationProjection {
  readonly patientId: string;
  readonly medicationPlanId: string;
  readonly date: string;
  readonly totalScheduled: number;
  readonly taken: number;
  readonly missed: number;
  readonly skipped: number;
  readonly delayed: number;
  readonly requiresCaregiverAttention: boolean;
}

function requireNonEmpty(value: string, fieldName: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
}

function assertValidIsoDate(value: string, fieldName: string): void {
  requireNonEmpty(value, fieldName);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format`);
  }
}

function assertValidIsoDateTime(value: string, fieldName: string): void {
  requireNonEmpty(value, fieldName);

  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    throw new Error(`${fieldName} must be an ISO-like datetime string`);
  }
}

function assertValidSchedule(schedule: MedicationSchedule): void {
  if (schedule.type === "daily") {
    if (schedule.times.length === 0) {
      throw new Error("daily schedule must contain at least one time");
    }

    for (const time of schedule.times) {
      if (!/^\d{2}:\d{2}$/.test(time)) {
        throw new Error(`invalid daily schedule time: ${time}`);
      }

      const [hourText, minuteText] = time.split(":");
      const hour = Number(hourText);
      const minute = Number(minuteText);

      if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        throw new Error(`daily schedule time is out of range: ${time}`);
      }
    }

    return;
  }

  if (!Number.isFinite(schedule.everyHours) || schedule.everyHours <= 0) {
    throw new Error("interval schedule must have a positive everyHours value");
  }
}

function cloneSchedule(schedule: MedicationSchedule): MedicationSchedule {
  if (schedule.type === "daily") {
    return {
      type: "daily",
      times: [...schedule.times],
    };
  }

  return {
    type: "interval",
    everyHours: schedule.everyHours,
  };
}

function doseStatusToEventType(status: DoseEventStatus): DoseEventType {
  switch (status) {
    case "taken":
      return "dose_taken";
    case "missed":
      return "dose_missed";
    case "skipped":
      return "dose_skipped";
    case "delayed":
      return "dose_delayed";
    default: {
      const exhaustiveCheck: never = status;
      throw new Error(`unsupported dose status: ${exhaustiveCheck}`);
    }
  }
}

function serializeForEncryption(payload: unknown): string {
  return JSON.stringify(payload);
}

export function createMedicationPlan(
  input: CreateMedicationPlanInput,
  ports: DomainPorts,
): MedicationPlan {
  requireNonEmpty(input.patientId, "patientId");
  requireNonEmpty(input.sourceRecordId, "sourceRecordId");
  requireNonEmpty(input.brandName, "brandName");
  requireNonEmpty(input.genericName, "genericName");
  requireNonEmpty(input.doseInstruction, "doseInstruction");
  assertValidIsoDate(input.startDate, "startDate");
  requireNonEmpty(input.createdByActorId, "createdByActorId");
  assertValidSchedule(input.schedule);

  if (input.endDate !== undefined && input.endDate !== null) {
    assertValidIsoDate(input.endDate, "endDate");
  }

  const plan: MedicationPlan = {
    id: ports.idGenerator.generate("medplan"),
    patientId: input.patientId,
    sourceRecordId: input.sourceRecordId,
    brandName: input.brandName,
    genericName: input.genericName,
    doseInstruction: input.doseInstruction,
    schedule: cloneSchedule(input.schedule),
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    status: "active",
    createdByActorId: input.createdByActorId,
    createdByRole: input.createdByRole,
    schemaVersion: 1,
    createdAt: ports.clock.now(),
  };

  return Object.freeze(plan);
}

export function prepareMedicationPlanForCloudSync(
  plan: MedicationPlan,
  encryption: EncryptionPort,
): MedicationPlanCloudSyncPayload {
  const encryptedClinicalPayload = {
    brandName: plan.brandName,
    genericName: plan.genericName,
    doseInstruction: plan.doseInstruction,
    schedule: plan.schedule,
    startDate: plan.startDate,
    endDate: plan.endDate,
    status: plan.status,
    createdByActorId: plan.createdByActorId,
    createdByRole: plan.createdByRole,
  };

  const syncPayload: MedicationPlanCloudSyncPayload = {
    id: plan.id,
    patientId: plan.patientId,
    sourceRecordId: plan.sourceRecordId,
    ciphertext: encryption.encrypt(
      serializeForEncryption(encryptedClinicalPayload),
    ),
    schemaVersion: plan.schemaVersion,
    
  };

  return Object.freeze(syncPayload);
}

export function recordDoseEvent(
  input: RecordDoseEventInput,
  ports: DomainPorts,
): DoseEvent {
  requireNonEmpty(input.patientId, "patientId");
  requireNonEmpty(input.medicationPlanId, "medicationPlanId");
  assertValidIsoDateTime(input.scheduledAt, "scheduledAt");
  requireNonEmpty(input.actorId, "actorId");

  if (input.actualAt !== null) {
    assertValidIsoDateTime(input.actualAt, "actualAt");
  }

  const event: DoseEvent = {
    id: ports.idGenerator.generate("doseevt"),
    patientId: input.patientId,
    medicationPlanId: input.medicationPlanId,
    type: doseStatusToEventType(input.status),
    scheduledAt: input.scheduledAt,
    actualAt: input.actualAt,
    status: input.status,
    actorId: input.actorId,
    actorRole: input.actorRole,
    schemaVersion: 1,
    createdAt: ports.clock.now(),
  };

  return Object.freeze(event);
}

export function prepareDoseEventForCloudSync(
  event: DoseEvent,
  encryption: EncryptionPort,
): DoseEventCloudSyncPayload {
  const encryptedClinicalPayload = {
    type: event.type,
    scheduledAt: event.scheduledAt,
    actualAt: event.actualAt,
    status: event.status,
    actorId: event.actorId,
    actorRole: event.actorRole,
  };

  const syncPayload: DoseEventCloudSyncPayload = {
    id: event.id,
    patientId: event.patientId,
    medicationPlanId: event.medicationPlanId,
    eventCategory: "dose_event",
    ciphertext: encryption.encrypt(
      serializeForEncryption(encryptedClinicalPayload),
    ),
    schemaVersion: event.schemaVersion,
    
  };

  return Object.freeze(syncPayload);
}

export function projectDailyMedicationState(
  input: ProjectDailyMedicationStateInput,
): DailyMedicationProjection {
  requireNonEmpty(input.patientId, "patientId");
  requireNonEmpty(input.medicationPlanId, "medicationPlanId");
  assertValidIsoDate(input.date, "date");

  const matchingEvents = input.events.filter((event) => {
    return (
      event.patientId === input.patientId &&
      event.medicationPlanId === input.medicationPlanId &&
      event.scheduledAt.slice(0, 10) === input.date
    );
  });

  let taken = 0;
  let missed = 0;
  let skipped = 0;
  let delayed = 0;

  for (const event of matchingEvents) {
    switch (event.status) {
      case "taken":
        taken += 1;
        break;
      case "missed":
        missed += 1;
        break;
      case "skipped":
        skipped += 1;
        break;
      case "delayed":
        delayed += 1;
        break;
      default: {
        const exhaustiveCheck: never = event.status;
        throw new Error(`unsupported dose event status: ${exhaustiveCheck}`);
      }
    }
  }

  const projection: DailyMedicationProjection = {
    patientId: input.patientId,
    medicationPlanId: input.medicationPlanId,
    date: input.date,
    totalScheduled: matchingEvents.length,
    taken,
    missed,
    skipped,
    delayed,
    requiresCaregiverAttention: missed > 0 || skipped > 0 || delayed > 0,
  };

  return Object.freeze(projection);
}