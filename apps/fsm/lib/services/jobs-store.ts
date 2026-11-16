import { attachPersistence } from "../../../../packages/local-db/index.mjs";
import crypto from "node:crypto";
import {
  CreateInstallationRequestSchema,
  type CreateInstallationRequest,
  type InstallationJobResponse,
  type JobStatus,
  TechnicianFeedbackRequestSchema,
  type TechnicianFeedbackRequest,
} from "@prototype/contract";
import { mailService } from "../email/mail-service";
import { technicians, isQualified } from "../technicians";

export interface StoredTechnicianFeedback {
  id: string;
  jobId: string;
  jobNumber: string;
  technicianId: string;
  rating: number;
  comment?: string;
  tags: string[];
  customerFirstName: string;
  receivedAt: string;
  lockedAt?: string;
  flaggedForReview: boolean;
  sourceIdempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackFollowup {
  id: string;
  feedbackId: string;
  jobNumber: string;
  rating: number;
  status: "open" | "in_progress" | "resolved";
  reason: string;
  resolutionNote?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredJob {
  id: string;
  jobNumber: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    province: string;
    postalCode: string;
  };
  serviceArea: string;
  status: JobStatus;
  technicianId?: string;
  technicianName?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  preferredStart: string;
  preferredEnd: string;
  specialInstructions?: string;
  items: Array<{
    sku: string;
    quantity: number;
    loadedQuantity: number;
  }>;
  releaseHistory?: Array<{ technicianId: string; reason: string; at: string }>;
  version: number;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  jobId: string;
  technicianId: string;
  periodStart: string;
  periodEnd: string;
  status: "active" | "released";
  createdAt: string;
}

export interface ProcessedMessage {
  idempotencyKey: string;
  operationId: string;
  requestHash: string;
  responseStatus: number;
  responseBody: any;
  createdAt: string;
}

export interface OutboxMessage {
  id: string;
  operationId: string;
  payload: any;
  idempotencyKey: string;
  correlationId: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  nextAttemptAt: string;
  createdAt: string;
}

// In-Memory resilient store with singleton state
export class JobsStore {
  private jobs: Map<string, StoredJob> = new Map();
  private appointments: Appointment[] = [];
  private processedMessages: Map<string, ProcessedMessage> = new Map();
  private outboxMessages: OutboxMessage[] = [];
  private technicianFeedbacks: Map<string, StoredTechnicianFeedback> =
    new Map();
  private followups: FeedbackFollowup[] = [];
  private jobCounter = 1;
  private technicianDetails: Record<string, { phone: string; branch: string }> =
    {};

  public listTechnicians() {
    return technicians.map((tech) => ({
      ...tech,
      phone: this.technicianDetails?.[tech.id]?.phone || "",
      branch: this.technicianDetails?.[tech.id]?.branch || "",
    }));
  }

  public updateTechnician(
    id: string,
    details: { phone: string; branch: string },
  ) {
    if (!technicians.some((tech) => tech.id === id))
      throw Object.assign(new Error("Technician not found"), {
        category: "NOT_FOUND",
      });
    this.technicianDetails ||= {};
    this.technicianDetails[id] = details;
    return this.listTechnicians().find((tech) => tech.id === id)!;
  }

  public unclaimJob(
    jobNumber: string,
    technicianId: string,
    reason: string,
    correlationId: string,
  ) {
    const job = this.getJob(jobNumber);
    if (!job || job.technicianId !== technicianId)
      throw Object.assign(new Error("Job not found"), {
        category: "NOT_FOUND",
      });
    if (job.status !== "Scheduled")
      throw Object.assign(
        new Error(
          "Only scheduled jobs can be unclaimed. Contact dispatch for work already in progress.",
        ),
        { category: "BUSINESS_RULE_VIOLATED" },
      );
    if (reason.trim().length < 3 || reason.length > 500)
      throw Object.assign(new Error("Provide a reason (3–500 characters)."), {
        category: "VALIDATION_FAILED",
      });
    if (job.items.some((item) => item.loadedQuantity > 0))
      throw Object.assign(
        new Error(
          "Confirm hardware has been returned by clearing the loading checklist before unclaiming.",
        ),
        { category: "BUSINESS_RULE_VIOLATED" },
      );
    for (const appointment of this.appointments)
      if (appointment.jobId === job.id) appointment.status = "released";
    job.releaseHistory = [
      ...(job.releaseHistory || []),
      { technicianId, reason: reason.trim(), at: new Date().toISOString() },
    ];
    job.technicianId = undefined;
    job.technicianName = undefined;
    job.scheduledStart = undefined;
    job.scheduledEnd = undefined;
    job.status = "Pending Scheduling";
    job.updatedAt = new Date().toISOString();
    job.version++;
    this.outboxMessages.push({
      id: crypto.randomUUID(),
      operationId: "OP-06",
      payload: {
        jobNumber,
        orderNumber: job.orderNumber,
        status: "Pending Scheduling",
        timestamp: job.updatedAt,
      },
      idempotencyKey: crypto.randomUUID(),
      correlationId,
      status: "pending",
      attempts: 0,
      nextAttemptAt: job.updatedAt,
      createdAt: job.updatedAt,
    });
    return job;
  }

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // Initial active seed job
    const initialJob: StoredJob = {
      id: "job-uuid-1",
      jobNumber: "JOB-20261110-000001",
      orderNumber: "GH-20261110-000001",
      customerName: "Juan Dela Cruz",
      customerPhone: "+639171234567",
      customerEmail: "juan@example.com",
      address: {
        line1: "123 Ayala Ave",
        city: "Makati",
        province: "Metro Manila",
        postalCode: "1226",
      },
      serviceArea: "Metro Manila",
      status: "Scheduled",
      technicianId: "tech-uuid-1",
      technicianName: "Arnel Mendoza",
      scheduledStart: "2026-11-12T09:00:00+08:00",
      scheduledEnd: "2026-11-12T11:00:00+08:00",
      preferredStart: "2026-11-12T09:00:00+08:00",
      preferredEnd: "2026-11-12T11:00:00+08:00",
      specialInstructions: "Gate code 4321",
      items: [{ sku: "GH-CCTV-001", quantity: 2, loadedQuantity: 0 }],
      version: 1,
      idempotencyKey: "idemp-seed-1",
      createdAt: "2026-11-10T08:00:00+08:00",
      updatedAt: "2026-11-10T08:00:00+08:00",
    };

    this.jobs.set(initialJob.jobNumber, initialJob);

    // Initial appointment
    this.appointments.push({
      id: "appt-1",
      jobId: initialJob.id,
      technicianId: "tech-uuid-1",
      periodStart: "2026-11-12T09:00:00+08:00",
      periodEnd: "2026-11-12T11:00:00+08:00",
      status: "active",
      createdAt: "2026-11-10T08:00:00+08:00",
    });
  }

  public hashPayload(payload: any): string {
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
  }

  public async createInstallationJob(
    payload: any,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{ status: 200 | 201; body: InstallationJobResponse }> {
    const requestHash = this.hashPayload(payload);

    // 1. Idempotency Check (CL-07)
    const existingMessage = this.processedMessages.get(idempotencyKey);
    if (existingMessage) {
      if (existingMessage.requestHash !== requestHash) {
        const error: any = new Error(
          "Reusing idempotency key with different payload",
        );
        error.category = "IDEMPOTENCY_KEY_CONFLICT";
        throw error;
      }
      return { status: 200, body: existingMessage.responseBody };
    }

    // 2. Schema Validation (CL-01, CL-02, CL-03)
    const parsed = CreateInstallationRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const error: any = new Error(firstIssue?.message || "Validation failed");
      error.category = "VALIDATION_FAILED";
      error.field = firstIssue?.path.join(".");
      throw error;
    }

    const validData: CreateInstallationRequest = parsed.data;

    // 3. Generate sequential Job Number: JOB-YYYYMMDD-NNNNNN
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const seqStr = String(this.jobCounter++).padStart(6, "0");
    const jobNumber = `JOB-${todayStr}-${seqStr}`;

    const newJob: StoredJob = {
      id: crypto.randomUUID(),
      jobNumber,
      orderNumber: validData.orderNumber,
      customerName: validData.customerName,
      customerPhone: validData.customerPhone,
      customerEmail: validData.customerEmail,
      address: validData.address,
      serviceArea: validData.address.province || validData.address.city,
      status: "Pending Scheduling",
      preferredStart: validData.preferredStart,
      preferredEnd: validData.preferredEnd,
      specialInstructions: validData.specialInstructions,
      items: validData.items.map((item) => ({
        sku: item.sku,
        quantity: item.quantity,
        loadedQuantity: 0,
      })),
      version: 1,
      idempotencyKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.jobs.set(jobNumber, newJob);

    const responseBody: InstallationJobResponse = {
      jobNumber: newJob.jobNumber,
      orderNumber: newJob.orderNumber,
      status: newJob.status,
      items: newJob.items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
      createdAt: newJob.createdAt,
    };

    // Store in processed_messages
    this.processedMessages.set(idempotencyKey, {
      idempotencyKey,
      operationId: "OP-01",
      requestHash,
      responseStatus: 201,
      responseBody,
      createdAt: new Date().toISOString(),
    });

    return { status: 201, body: responseBody };
  }

  public getJob(jobNumber: string): StoredJob | undefined {
    return this.jobs.get(jobNumber);
  }

  public listJobs(): StoredJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  // Double-booking check: EXCLUDE USING gist (technician_id WITH =, period WITH &&) WHERE status = 'active'
  public checkAppointmentOverlap(
    technicianId: string,
    startIso: string,
    endIso: string,
  ): boolean {
    const reqStart = new Date(startIso).getTime();
    const reqEnd = new Date(endIso).getTime();

    return this.appointments.some((appt) => {
      if (appt.technicianId !== technicianId || appt.status !== "active")
        return false;
      const apptStart = new Date(appt.periodStart).getTime();
      const apptEnd = new Date(appt.periodEnd).getTime();
      // Overlap condition: reqStart < apptEnd && reqEnd > apptStart
      const buffer = 2 * 60 * 60 * 1000;
      return reqStart < apptEnd + buffer && reqEnd > apptStart - buffer;
    });
  }

  public async assignTechnician(
    jobNumber: string,
    technicianId: string,
    technicianName: string,
    scheduledStart: string,
    scheduledEnd: string,
    correlationId: string,
  ): Promise<{ job: StoredJob; outboxMessage: OutboxMessage }> {
    const job = this.jobs.get(jobNumber);
    if (!job) {
      const error: any = new Error(`Job ${jobNumber} not found`);
      error.category = "NOT_FOUND";
      throw error;
    }

    if (
      job.status !== "Pending Scheduling" &&
      job.status !== "Reschedule Required"
    ) {
      throw Object.assign(
        new Error(
          "This job has already been claimed or assigned. Refresh the queue.",
        ),
        { category: "BUSINESS_RULE_VIOLATED" },
      );
    }
    if (
      !Number.isFinite(Date.parse(scheduledStart)) ||
      !Number.isFinite(Date.parse(scheduledEnd)) ||
      Date.parse(scheduledEnd) <= Date.parse(scheduledStart)
    ) {
      throw Object.assign(
        new Error("The schedule must have a valid start and a later end."),
        { category: "VALIDATION_FAILED" },
      );
    }

    // Check exclusion constraint guard (TC-11, OBJ-02)
    const hasConflict = this.checkAppointmentOverlap(
      technicianId,
      scheduledStart,
      scheduledEnd,
    );
    if (hasConflict) {
      const error: any = new Error(
        `Technician ${technicianName} has a conflicting appointment. Leave at least two hours between jobs; ask dispatch to choose another window.`,
      );
      error.category = "SCHEDULE_CONFLICT";
      throw error;
    }

    // Insert active appointment
    const appointment: Appointment = {
      id: crypto.randomUUID(),
      jobId: job.id,
      technicianId,
      periodStart: scheduledStart,
      periodEnd: scheduledEnd,
      status: "active",
      createdAt: new Date().toISOString(),
    };
    this.appointments.push(appointment);

    // Update job status to 'Scheduled'
    job.technicianId = technicianId;
    job.technicianName = technicianName;
    job.scheduledStart = scheduledStart;
    job.scheduledEnd = scheduledEnd;
    job.status = "Scheduled";
    job.updatedAt = new Date().toISOString();
    job.version += 1;

    // Write OP-05 outbox message (Section 3.3 & W-02)
    const outboxMessage: OutboxMessage = {
      id: crypto.randomUUID(),
      operationId: "OP-05",
      payload: {
        jobNumber: job.jobNumber,
        orderNumber: job.orderNumber,
        technicianName,
        scheduledStart,
        scheduledEnd,
        status: job.status,
      },
      idempotencyKey: crypto.randomUUID(),
      correlationId: correlationId || crypto.randomUUID(),
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    this.outboxMessages.push(outboxMessage);

    return { job, outboxMessage };
  }

  public async assignPendingJob(
    jobNumber: string,
    technicianId: string,
    correlationId: string,
    window?: { scheduledStart: string; scheduledEnd: string },
  ) {
    const job = this.getJob(jobNumber);
    if (!job)
      throw Object.assign(new Error("Job not found"), {
        category: "NOT_FOUND",
      });
    if (job.technicianId || job.status !== "Pending Scheduling")
      throw Object.assign(
        new Error(
          "This job has already been claimed or assigned. Refresh the queue.",
        ),
        { category: "BUSINESS_RULE_VIOLATED" },
      );
    const technician = technicians.find((tech) => tech.id === technicianId);
    if (!technician || !isQualified(technician, job.items))
      throw Object.assign(
        new Error(
          "The technician does not have all required qualifications for this job.",
        ),
        { category: "BUSINESS_RULE_VIOLATED" },
      );
    return this.assignTechnician(
      jobNumber,
      technician.id,
      technician.name,
      window?.scheduledStart || job.preferredStart,
      window?.scheduledEnd || job.preferredEnd,
      correlationId,
    );
  }

  // OP-03: Reschedule Request
  public async requestReschedule(
    jobNumber: string,
    requestedStart: string,
    requestedEnd: string,
    reason: string,
    correlationId: string,
  ): Promise<StoredJob> {
    const job = this.jobs.get(jobNumber);
    if (!job) {
      const err: any = new Error(`Job ${jobNumber} not found`);
      err.category = "NOT_FOUND";
      throw err;
    }

    if (job.status === "Completed" || job.status === "Cancelled") {
      const err: any = new Error(
        `Cannot reschedule job ${jobNumber} in ${job.status} state`,
      );
      err.category = "BUSINESS_RULE_VIOLATED";
      throw err;
    }

    // Release any active appointment
    for (const appt of this.appointments) {
      if (appt.jobId === job.id && appt.status === "active") {
        appt.status = "released";
      }
    }

    job.status = "Reschedule Required";
    job.preferredStart = requestedStart;
    job.preferredEnd = requestedEnd;
    job.specialInstructions = job.specialInstructions
      ? `${job.specialInstructions} | Reschedule reason: ${reason}`
      : `Reschedule reason: ${reason}`;
    job.updatedAt = new Date().toISOString();
    job.version += 1;

    return job;
  }

  // OP-04: Cancellation
  public async cancelJob(
    jobNumber: string,
    reason: string,
    cancelledBy: string,
    correlationId: string,
  ): Promise<StoredJob> {
    const job = this.jobs.get(jobNumber);
    if (!job) {
      const err: any = new Error(`Job ${jobNumber} not found`);
      err.category = "NOT_FOUND";
      throw err;
    }

    if (job.status === "In Progress" || job.status === "Completed") {
      const err: any = new Error(
        `Cannot cancel job ${jobNumber} in ${job.status} state`,
      );
      err.category = "BUSINESS_RULE_VIOLATED";
      throw err;
    }

    // Release any active appointment
    for (const appt of this.appointments) {
      if (appt.jobId === job.id && appt.status === "active") {
        appt.status = "released";
      }
    }

    job.status = "Cancelled";
    job.specialInstructions = job.specialInstructions
      ? `${job.specialInstructions} | Cancelled by ${cancelledBy}: ${reason}`
      : `Cancelled by ${cancelledBy}: ${reason}`;
    job.updatedAt = new Date().toISOString();
    job.version += 1;

    return job;
  }

  public listTechnicianJobs(technicianId: string): StoredJob[] {
    return Array.from(this.jobs.values()).filter(
      (j) => j.technicianId === technicianId,
    );
  }

  // W-03 & TC-34: Hardware Loading Confirmation
  public confirmLoading(
    jobNumber: string,
    sku: string,
    loadedQuantity: number,
  ): StoredJob {
    const job = this.jobs.get(jobNumber);
    if (!job) {
      const err: any = new Error(`Job ${jobNumber} not found`);
      err.category = "NOT_FOUND";
      throw err;
    }

    const item = job.items.find((i) => i.sku === sku);
    if (!item) {
      const err: any = new Error(`SKU ${sku} not found on job ${jobNumber}`);
      err.category = "NOT_FOUND";
      throw err;
    }

    item.loadedQuantity = loadedQuantity;
    job.updatedAt = new Date().toISOString();
    return job;
  }

  // W-03 & TC-34: Start Job (Enforces all ordered hardware is confirmed loaded)
  public async startJob(
    jobNumber: string,
    correlationId: string,
  ): Promise<{ job: StoredJob; outboxMessage: OutboxMessage }> {
    const job = this.jobs.get(jobNumber);
    if (!job) {
      const err: any = new Error(`Job ${jobNumber} not found`);
      err.category = "NOT_FOUND";
      throw err;
    }

    if (job.status !== "Scheduled") {
      const err: any = new Error(
        `Job ${jobNumber} is not in Scheduled state (current: ${job.status})`,
      );
      err.category = "BUSINESS_RULE_VIOLATED";
      throw err;
    }

    // Guard: Every ordered SKU must have loadedQuantity == quantity
    const unconfirmedItem = job.items.find(
      (i) => i.loadedQuantity < i.quantity,
    );
    if (unconfirmedItem) {
      const err: any = new Error(
        `Cannot start job: SKU ${unconfirmedItem.sku} is not fully loaded (${unconfirmedItem.loadedQuantity}/${unconfirmedItem.quantity})`,
      );
      err.category = "BUSINESS_RULE_VIOLATED";
      throw err;
    }

    // Transition status to In Progress
    job.status = "In Progress";
    job.updatedAt = new Date().toISOString();
    job.version += 1;

    // Write OP-06 outbox message
    const outboxMessage: OutboxMessage = {
      id: crypto.randomUUID(),
      operationId: "OP-06",
      payload: {
        jobNumber: job.jobNumber,
        orderNumber: job.orderNumber,
        status: "In Progress",
        timestamp: new Date().toISOString(),
      },
      idempotencyKey: crypto.randomUUID(),
      correlationId: correlationId || crypto.randomUUID(),
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.outboxMessages.push(outboxMessage);

    return { job, outboxMessage };
  }

  // W-03 & TC-14: Complete Job with Serials & Parts Adjustments (OP-07 & OP-08)
  public async completeJob(
    jobNumber: string,
    completionData: {
      result: "success" | "partial" | "failed";
      completedAt?: string;
      notes?: string;
      usedItems: Array<{
        sku: string;
        quantity: number;
        serialNumbers: string[];
      }>;
      returnedItems: Array<{ sku: string; quantity: number }>;
      replacementItems?: Array<{
        sku: string;
        quantity: number;
        reason?: string;
      }>;
    },
    correlationId: string,
  ): Promise<{
    job: StoredJob;
    op07Message: OutboxMessage;
    op08Messages: OutboxMessage[];
  }> {
    const job = this.jobs.get(jobNumber);
    if (!job) {
      const err: any = new Error(`Job ${jobNumber} not found`);
      err.category = "NOT_FOUND";
      throw err;
    }

    if (job.status !== "In Progress") {
      const err: any = new Error(
        `Job ${jobNumber} must be In Progress to complete (current: ${job.status})`,
      );
      err.category = "BUSINESS_RULE_VIOLATED";
      throw err;
    }

    // TC-14 Validation 1: Per ordered SKU, used + returned must equal ordered quantity
    for (const orderedItem of job.items) {
      const used =
        completionData.usedItems.find((u) => u.sku === orderedItem.sku)
          ?.quantity || 0;
      const returned =
        completionData.returnedItems.find((r) => r.sku === orderedItem.sku)
          ?.quantity || 0;

      if (used + returned !== orderedItem.quantity) {
        const err: any = new Error(
          `Quantity mismatch for ${orderedItem.sku}: used (${used}) + returned (${returned}) must equal ordered (${orderedItem.quantity})`,
        );
        err.category = "VALIDATION_FAILED";
        throw err;
      }
    }

    // TC-14 Validation 2: Serial count must equal used quantity for each used SKU
    const allInstalledUnits: Array<{ sku: string; serialNumber: string }> = [];
    for (const used of completionData.usedItems) {
      if (used.serialNumbers.length !== used.quantity) {
        const err: any = new Error(
          `Serial count (${used.serialNumbers.length}) does not match used quantity (${used.quantity}) for ${used.sku}`,
        );
        err.category = "VALIDATION_FAILED";
        throw err;
      }
      for (const sn of used.serialNumbers) {
        if (!sn || sn.trim().length === 0) {
          const err: any = new Error(
            `Invalid empty serial number for ${used.sku}`,
          );
          err.category = "VALIDATION_FAILED";
          throw err;
        }
        allInstalledUnits.push({ sku: used.sku, serialNumber: sn.trim() });
      }
    }

    // Transition status to Completed
    job.status = "Completed";
    job.updatedAt = new Date().toISOString();
    job.version += 1;

    const completedAt = completionData.completedAt || new Date().toISOString();

    // 1. Write OP-07 (Completion Webhook) outbox message
    const op07Message: OutboxMessage = {
      id: crypto.randomUUID(),
      operationId: "OP-07",
      payload: {
        orderNumber: job.orderNumber,
        jobNumber: job.jobNumber,
        completedAt,
        result: completionData.result,
        installedUnits: allInstalledUnits,
        notes: completionData.notes || "Installation completed",
      },
      idempotencyKey: crypto.randomUUID(),
      correlationId: correlationId || crypto.randomUUID(),
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.outboxMessages.push(op07Message);

    // 2. Write OP-08 (Inventory Adjustment Webhooks) with unique transactionId per adjustment line
    const op08Messages: OutboxMessage[] = [];

    // Used adjustments
    for (const used of completionData.usedItems) {
      if (used.quantity > 0) {
        const op08Row: OutboxMessage = {
          id: crypto.randomUUID(),
          operationId: "OP-08",
          payload: {
            transactionId: crypto.randomUUID(),
            orderNumber: job.orderNumber,
            jobNumber: job.jobNumber,
            sku: used.sku,
            type: "used",
            quantity: used.quantity,
          },
          idempotencyKey: crypto.randomUUID(),
          correlationId: correlationId || crypto.randomUUID(),
          status: "pending",
          attempts: 0,
          nextAttemptAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        op08Messages.push(op08Row);
        this.outboxMessages.push(op08Row);
      }
    }

    // Returned unused adjustments
    for (const returned of completionData.returnedItems) {
      if (returned.quantity > 0) {
        const op08Row: OutboxMessage = {
          id: crypto.randomUUID(),
          operationId: "OP-08",
          payload: {
            transactionId: crypto.randomUUID(),
            orderNumber: job.orderNumber,
            jobNumber: job.jobNumber,
            sku: returned.sku,
            type: "returned_unused",
            quantity: returned.quantity,
          },
          idempotencyKey: crypto.randomUUID(),
          correlationId: correlationId || crypto.randomUUID(),
          status: "pending",
          attempts: 0,
          nextAttemptAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        op08Messages.push(op08Row);
        this.outboxMessages.push(op08Row);
      }
    }

    // Replacement extra items adjustments
    if (completionData.replacementItems) {
      for (const rep of completionData.replacementItems) {
        if (rep.quantity > 0) {
          const op08Row: OutboxMessage = {
            id: crypto.randomUUID(),
            operationId: "OP-08",
            payload: {
              transactionId: crypto.randomUUID(),
              orderNumber: job.orderNumber,
              jobNumber: job.jobNumber,
              sku: rep.sku,
              type: "replacement_used",
              quantity: rep.quantity,
            },
            idempotencyKey: crypto.randomUUID(),
            correlationId: correlationId || crypto.randomUUID(),
            status: "pending",
            attempts: 0,
            nextAttemptAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };
          op08Messages.push(op08Row);
          this.outboxMessages.push(op08Row);
        }
      }
    }

    return { job, op07Message, op08Messages };
  }

  public getOutboxMessages(): OutboxMessage[] {
    return this.outboxMessages;
  }

  // W-05 & OP-10: Technician Feedback Submission
  public async saveTechnicianFeedback(
    jobNumber: string,
    payload: any,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{
    status: 200 | 201;
    body: { success: boolean; message: string };
  }> {
    const requestHash = this.hashPayload(payload);

    // 1. Idempotency Check (CL-07, TC-22)
    const existingProcessed = this.processedMessages.get(idempotencyKey);
    if (existingProcessed) {
      if (existingProcessed.requestHash !== requestHash) {
        const error: any = new Error(
          "Reusing idempotency key with different payload",
        );
        error.category = "IDEMPOTENCY_KEY_CONFLICT";
        throw error;
      }
      return { status: 200, body: existingProcessed.responseBody };
    }

    // 2. Job Existence Check
    const job = this.jobs.get(jobNumber);
    if (!job) {
      const error: any = new Error(`Job ${jobNumber} not found`);
      error.category = "NOT_FOUND";
      throw error;
    }

    // 3. Duplicate check for same job under different idempotency key
    if (this.technicianFeedbacks.has(jobNumber)) {
      const error: any = new Error(
        `Feedback already recorded for job ${jobNumber}`,
      );
      error.category = "DUPLICATE_RECORD";
      throw error;
    }

    // 4. Job must be Completed (CL-15, TC-21)
    if (job.status !== "Completed") {
      const error: any = new Error(
        `Job ${jobNumber} is not Completed (current status: ${job.status})`,
      );
      error.category = "BUSINESS_RULE_VIOLATED";
      error.statusCode = 422; // per TC-21: OP-10 for a job not Completed: 422
      throw error;
    }

    // 5. Schema Validation (CL-01, CL-02, CL-15, TC-19, TC-25, TC-32)
    const parsed = TechnicianFeedbackRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const error: any = new Error(firstIssue?.message || "Validation failed");
      error.category = "VALIDATION_FAILED";
      error.field = firstIssue?.path.join(".");
      throw error;
    }

    const validData: TechnicianFeedbackRequest = parsed.data;

    // 6. Persist Feedback
    const feedback: StoredTechnicianFeedback = {
      id: crypto.randomUUID(),
      jobId: job.id,
      jobNumber: job.jobNumber,
      technicianId: job.technicianId || "tech-default",
      rating: validData.rating,
      comment: validData.comment,
      tags: (validData.technicianTags as string[]) || [],
      customerFirstName: validData.customerFirstName,
      receivedAt: validData.submittedAt || new Date().toISOString(),
      flaggedForReview: validData.rating <= 2,
      sourceIdempotencyKey: idempotencyKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.technicianFeedbacks.set(jobNumber, feedback);

    // 7. Follow-up and Alert for low rating (TC-24, D14)
    if (validData.rating <= 2) {
      const followup: FeedbackFollowup = {
        id: crypto.randomUUID(),
        feedbackId: feedback.id,
        jobNumber: job.jobNumber,
        rating: validData.rating,
        status: "open",
        reason: `Low technician rating of ${validData.rating}/5 received`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.followups.push(followup);

      // Alert email to dispatcher
      await mailService.sendEmail({
        to: "dispatch@goodhand88.com",
        subject: `ALERT: Low Technician Rating (${validData.rating}/5) on ${jobNumber}`,
        bodyHtml: `<h3>Low Feedback Alert</h3><p>Technician rating of ${validData.rating}/5 was received for job ${jobNumber}. Followup status is OPEN.</p>`,
      });
    }

    const responseBody = {
      success: true,
      message: "Technician feedback recorded",
    };

    this.processedMessages.set(idempotencyKey, {
      idempotencyKey,
      operationId: "OP-10",
      requestHash,
      responseStatus: 201,
      responseBody,
      createdAt: new Date().toISOString(),
    });

    return { status: 201, body: responseBody };
  }

  // W-05 & OP-11: Edit Technician Feedback (7-day window)
  public async updateTechnicianFeedback(
    jobNumber: string,
    payload: any,
    idempotencyKey: string,
    correlationId: string,
  ): Promise<{ status: 200; body: { success: boolean; message: string } }> {
    const requestHash = this.hashPayload(payload);

    // 1. Idempotency Check
    const existingProcessed = this.processedMessages.get(idempotencyKey);
    if (existingProcessed) {
      if (existingProcessed.requestHash !== requestHash) {
        const error: any = new Error(
          "Reusing idempotency key with different payload",
        );
        error.category = "IDEMPOTENCY_KEY_CONFLICT";
        throw error;
      }
      return { status: 200, body: existingProcessed.responseBody };
    }

    // 2. Feedback existence check
    const feedback = this.technicianFeedbacks.get(jobNumber);
    if (!feedback) {
      const error: any = new Error(`Feedback for job ${jobNumber} not found`);
      error.category = "NOT_FOUND";
      throw error;
    }

    // 3. 7-day editing window check (CL-15, D13, TC-27)
    const receivedMs = new Date(feedback.receivedAt).getTime();
    const nowMs = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    if (nowMs - receivedMs > sevenDaysMs || feedback.lockedAt) {
      const error: any = new Error("Feedback is locked after 7 days");
      error.category = "BUSINESS_RULE_VIOLATED";
      throw error;
    }

    // 4. Schema Validation
    const parsed = TechnicianFeedbackRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      const error: any = new Error(firstIssue?.message || "Validation failed");
      error.category = "VALIDATION_FAILED";
      error.field = firstIssue?.path.join(".");
      throw error;
    }

    const validData: TechnicianFeedbackRequest = parsed.data;

    // 5. Update feedback
    feedback.rating = validData.rating;
    feedback.comment = validData.comment;
    feedback.tags = (validData.technicianTags as string[]) || [];
    feedback.customerFirstName = validData.customerFirstName;
    feedback.updatedAt = new Date().toISOString();
    feedback.flaggedForReview = validData.rating <= 2;

    const responseBody = {
      success: true,
      message: "Technician feedback updated",
    };

    this.processedMessages.set(idempotencyKey, {
      idempotencyKey,
      operationId: "OP-11",
      requestHash,
      responseStatus: 200,
      responseBody,
      createdAt: new Date().toISOString(),
    });

    return { status: 200, body: responseBody };
  }

  public getTechnicianFeedbackForJob(
    jobNumber: string,
  ): StoredTechnicianFeedback | undefined {
    return this.technicianFeedbacks.get(jobNumber);
  }

  // TC-28: Technician opens another technician's feedback: 404 (IDOR guard)
  public listFeedbackForTechnician(
    technicianId: string,
    requesterTechnicianId?: string,
  ): {
    feedbacks: StoredTechnicianFeedback[];
    averageRating: number;
    totalReviews: number;
  } {
    if (requesterTechnicianId && requesterTechnicianId !== technicianId) {
      const error: any = new Error("Resource not found");
      error.category = "NOT_FOUND";
      throw error;
    }

    const list = Array.from(this.technicianFeedbacks.values()).filter(
      (fb) => fb.technicianId === technicianId,
    );

    const totalReviews = list.length;
    const avg =
      totalReviews > 0
        ? Number(
            (
              list.reduce((sum, fb) => sum + fb.rating, 0) / totalReviews
            ).toFixed(1),
          )
        : 0;

    return { feedbacks: list, averageRating: avg, totalReviews };
  }

  public listAllFeedback(): StoredTechnicianFeedback[] {
    return Array.from(this.technicianFeedbacks.values());
  }

  public listFollowups(): FeedbackFollowup[] {
    return [...this.followups];
  }
}

const runtime = globalThis as typeof globalThis & { goodhandJobs?: JobsStore };
export const jobsStore = (runtime.goodhandJobs ??= new JobsStore());

Object.setPrototypeOf(jobsStore, JobsStore.prototype);
attachPersistence(jobsStore, "fsm", "jobs");
