import { attachPersistence, persistService } from '../../../../packages/local-db/index.mjs';
import crypto from 'node:crypto';
import { logger } from '@prototype/logger';

export interface OutboxRow {
  id: string;
  operationId: string;
  payload: any;
  idempotencyKey: string;
  correlationId: string;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  nextAttemptAt: string;
  lastErrorCategory?: string;
  lastErrorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FailedMessageRow {
  id: string;
  outboxMessageId: string;
  operationId: string;
  payload: any;
  idempotencyKey: string;
  correlationId: string;
  finalError: string;
  failedAt: string;
  replayedAt?: string;
  discardedReason?: string;
}

export interface CircuitState {
  target: string;
  state: 'closed' | 'open' | 'half_open';
  consecutiveFailures: number;
  openedAt?: number;
}

const DEMO_MODE = process.env.DEMO_MODE === 'true' || process.env.NODE_ENV === 'development';

// Spacing in milliseconds (in DEMO_MODE: 10s, 20s, 30s, 40s)
const RETRY_INTERVALS_MS = DEMO_MODE
  ? [10_000, 20_000, 30_000, 40_000]
  : [60_000, 300_000, 900_000, 3_600_000];

export class OutboxEngine {
  private outbox: Map<string, OutboxRow> = new Map();
  private failedQueue: Map<string, FailedMessageRow> = new Map();
  private circuit: CircuitState = {
    target: 'SystemB',
    state: 'closed',
    consecutiveFailures: 0
  };

  // Enqueue a message atomically
  public enqueue(
    operationId: string,
    payload: any,
    idempotencyKey: string,
    correlationId: string
  ): OutboxRow {
    const row: OutboxRow = {
      id: crypto.randomUUID(),
      operationId,
      payload,
      idempotencyKey,
      correlationId,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.outbox.set(row.id, row);
    return row;
  }

  // Hardware-only checkouts must never create an installation dispatch event.
  public enqueueInstallation(payload: any, idempotencyKey: string, correlationId: string, includeInstallation = true): OutboxRow | undefined {
    if (!includeInstallation) return undefined;
    return this.enqueue('OP-01', payload, idempotencyKey, correlationId);
  }

  // Circuit breaker state check (D20)
  public checkCircuit(): { allowed: boolean; reason?: string } {
    const now = Date.now();
    const openDurationMs = 30_000; // 30 seconds

    if (this.circuit.state === 'open') {
      if (this.circuit.openedAt && now - this.circuit.openedAt > openDurationMs) {
        // Transition to half-open: allow one trial request
        this.circuit.state = 'half_open';
        return { allowed: true };
      }
      return { allowed: false, reason: 'Circuit breaker is OPEN for partner service' };
    }

    return { allowed: true };
  }

  public recordSuccess() {
    this.circuit.consecutiveFailures = 0;
    this.circuit.state = 'closed';
  }

  public recordFailure() {
    this.circuit.consecutiveFailures += 1;
    if (this.circuit.consecutiveFailures >= 5) {
      this.circuit.state = 'open';
      this.circuit.openedAt = Date.now();
      logger.warn({ failures: this.circuit.consecutiveFailures }, 'Circuit breaker TRIPPED to OPEN state');
    }
  }

  // Attempts delivery of a single message to System B
  public async deliverMessage(
    row: OutboxRow,
    dispatcherFn: (operationId: string, payload: any, idempotencyKey: string, correlationId: string) => Promise<{ status: number; body?: any }>
  ): Promise<{ delivered: boolean; error?: any }> {
    const circuitCheck = this.checkCircuit();
    if (!circuitCheck.allowed) {
      row.lastErrorCategory = 'CIRCUIT_OPEN';
      row.lastErrorMessage = circuitCheck.reason;
      return { delivered: false, error: new Error(circuitCheck.reason) };
    }

    row.attempts += 1;
    row.updatedAt = new Date().toISOString();

    try {
      const response = await dispatcherFn(
        row.operationId,
        row.payload,
        row.idempotencyKey,
        row.correlationId
      );

      if (response.status >= 200 && response.status < 300) {
        row.status = 'delivered';
        this.recordSuccess();
        return { delivered: true };
      }

      // Non-2xx response from partner
      const isPermanent = [400, 401, 403, 404, 409, 422].includes(response.status);

      if (isPermanent || row.attempts >= 5) {
        row.status = 'failed';
        this.recordFailure();
        this.moveToFailedQueue(row, `HTTP ${response.status} Permanent Error or Max Retries Exceeded`);
        return { delivered: false, error: new Error(`Permanent error HTTP ${response.status}`) };
      }

      // Temporary error (5xx, 408, 429) -> retry
      this.recordFailure();
      this.scheduleRetry(row);
      return { delivered: false, error: new Error(`Temporary error HTTP ${response.status}`) };
    } catch (networkErr: any) {
      this.recordFailure();

      if (row.attempts >= 5) {
        row.status = 'failed';
        this.moveToFailedQueue(row, networkErr.message || 'Network delivery failure');
        return { delivered: false, error: networkErr };
      }

      this.scheduleRetry(row);
      return { delivered: false, error: networkErr };
    }
  }

  private scheduleRetry(row: OutboxRow) {
    const intervalIndex = Math.min(row.attempts - 1, RETRY_INTERVALS_MS.length - 1);
    const delayMs = RETRY_INTERVALS_MS[intervalIndex] || 10_000;
    row.nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
    logger.info({ outboxId: row.id, attempt: row.attempts, nextAttemptAt: row.nextAttemptAt }, 'Scheduled outbox retry');
  }

  private moveToFailedQueue(row: OutboxRow, finalError: string) {
    const failedRow: FailedMessageRow = {
      id: crypto.randomUUID(),
      outboxMessageId: row.id,
      operationId: row.operationId,
      payload: row.payload,
      idempotencyKey: row.idempotencyKey,
      correlationId: row.correlationId,
      finalError,
      failedAt: new Date().toISOString()
    };

    this.failedQueue.set(failedRow.id, failedRow);
    logger.error({ outboxId: row.id, idempotencyKey: row.idempotencyKey, finalError }, 'Message moved to failed queue (W-04)');
  }

  // Drain Loop with Section 3.3 execution budget cutoff guard (< 6000ms)
  public async drainQueue(
    dispatcherFn: (operationId: string, payload: any, idempotencyKey: string, correlationId: string) => Promise<{ status: number; body?: any }>
  ): Promise<{ processed: number; successful: number; timedOut: boolean }> {
    const startTime = Date.now();
    const nowIso = new Date().toISOString();

    const pending = Array.from(this.outbox.values()).filter(
      r => r.status === 'pending' && r.nextAttemptAt <= nowIso
    );

    let processed = 0;
    let successful = 0;
    let timedOut = false;

    for (const msg of pending) {
      // 6-second budget guard to avoid Vercel 10s ceiling
      if (Date.now() - startTime >= 6000) {
        timedOut = true;
        break;
      }

      const result = await this.deliverMessage(msg, dispatcherFn);
      processed += 1;
      if (result.delivered) {
        successful += 1;
      }
    }

    return { processed, successful, timedOut };
  }

  // Replay from failed queue reusing the ORIGINAL Idempotency-Key (CL-06, CL-07, TC-13)
  public async replayFailedMessage(failedMessageId: string): Promise<OutboxRow> {
    const failed = this.failedQueue.get(failedMessageId);
    if (!failed) {
      throw new Error(`Failed message ${failedMessageId} not found`);
    }

    // Replay reuses original idempotency key
    const newOutboxRow: OutboxRow = {
      id: crypto.randomUUID(),
      operationId: failed.operationId,
      payload: failed.payload,
      idempotencyKey: failed.idempotencyKey, // MUST be original key!
      correlationId: failed.correlationId,
      status: 'pending',
      attempts: 0,
      nextAttemptAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.outbox.set(newOutboxRow.id, newOutboxRow);
    failed.replayedAt = new Date().toISOString();

    return newOutboxRow;
  }

  public getOutboxRows(): OutboxRow[] {
    return Array.from(this.outbox.values());
  }

  public getFailedRows(): FailedMessageRow[] {
    return Array.from(this.failedQueue.values());
  }

  public getCircuitState(): CircuitState {
    return { ...this.circuit };
  }

  public resetCircuit(): void {
    this.circuit = {
      target: 'SystemB',
      state: 'closed',
      consecutiveFailures: 0
    };
  }
}

export const outboxEngine = attachPersistence(new OutboxEngine(), "store", "outbox") as OutboxEngine;
export function persistOutboxState() { persistService(outboxEngine); }
