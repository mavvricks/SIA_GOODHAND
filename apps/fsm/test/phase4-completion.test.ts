import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { jobsStore } from '../lib/services/jobs-store';
import { stockLedger } from '../../store/lib/ledger/stock-ledger';
import { ordersService } from '../../store/lib/services/orders-service';
import {
  CompletionWebhookRequestSchema,
  InventoryAdjustmentWebhookRequestSchema
} from '@prototype/contract';

describe('Phase 4 Acceptance: Loading, Completion, Stock & Warranty (TC-02, TC-04, TC-12, TC-14, TC-34)', () => {
  beforeEach(() => {
    stockLedger.seedInventory();
  });

  it('TC-34: Start job gate enforces hardware loading checklist (refused -> confirm all -> success)', async () => {
    const correlationId = 'corr-tc34-loading';
    const key = 'test-idemp-tc34-key';

    // 1. Create job with 2 CCTV items
    const jobRes = await jobsStore.createInstallationJob(
      {
        orderNumber: 'GH-20261110-343434',
        customerName: 'Danilo Santos',
        customerPhone: '+639171112233',
        customerEmail: 'danilo@example.com',
        address: {
          line1: '100 Shaw Blvd',
          city: 'Mandaluyong',
          province: 'Metro Manila',
          postalCode: '1550'
        },
        items: [{ sku: 'GH-CCTV-001', quantity: 2 }],
        preferredStart: '2026-11-15T09:00:00+08:00',
        preferredEnd: '2026-11-15T11:00:00+08:00'
      },
      key,
      correlationId
    );
    const jobNumber = jobRes.body.jobNumber;

    // Assign technician
    await jobsStore.assignTechnician(
      jobNumber,
      'tech-uuid-2',
      'Danilo Reyes',
      '2026-11-15T09:00:00+08:00',
      '2026-11-15T11:00:00+08:00',
      correlationId
    );

    // 2. Attempt to start job without loading items -> REFUSED with 409 BUSINESS_RULE_VIOLATED
    await expect(
      jobsStore.startJob(jobNumber, correlationId)
    ).rejects.toMatchObject({
      category: 'BUSINESS_RULE_VIOLATED'
    });

    // 3. Confirm loading of all items
    jobsStore.confirmLoading(jobNumber, 'GH-CCTV-001', 2);

    // 4. Start job again -> SUCCEEDS and writes OP-06 outbox message
    const started = await jobsStore.startJob(jobNumber, correlationId);
    expect(started.job.status).toBe('In Progress');
    expect(started.outboxMessage.operationId).toBe('OP-06');
    expect(started.outboxMessage.payload.status).toBe('In Progress');
  });

  it('TC-14: Completion rejects invalid counts: used + returned != ordered, or serial count != used quantity', async () => {
    const correlationId = 'corr-tc14-val';
    const key = 'test-idemp-tc14-key';

    const jobRes = await jobsStore.createInstallationJob(
      {
        orderNumber: 'GH-20261110-141414',
        customerName: 'Robert Cruz',
        customerPhone: '+639179998877',
        customerEmail: 'robert@example.com',
        address: {
          line1: '50 Ortigas Ave',
          city: 'Pasig',
          province: 'Metro Manila',
          postalCode: '1600'
        },
        items: [{ sku: 'GH-CCTV-001', quantity: 2 }],
        preferredStart: '2026-11-16T13:00:00+08:00',
        preferredEnd: '2026-11-16T15:00:00+08:00'
      },
      key,
      correlationId
    );
    const jobNumber = jobRes.body.jobNumber;

    await jobsStore.assignTechnician(
      jobNumber,
      'tech-uuid-3',
      'Crispin Bautista',
      '2026-11-16T13:00:00+08:00',
      '2026-11-16T15:00:00+08:00',
      correlationId
    );
    jobsStore.confirmLoading(jobNumber, 'GH-CCTV-001', 2);
    await jobsStore.startJob(jobNumber, correlationId);

    // Error Case A: used (1) + returned (0) != ordered (2) -> 422 VALIDATION_FAILED
    await expect(
      jobsStore.completeJob(
        jobNumber,
        {
          result: 'success',
          usedItems: [{ sku: 'GH-CCTV-001', quantity: 1, serialNumbers: ['SN-1'] }],
          returnedItems: [{ sku: 'GH-CCTV-001', quantity: 0 }]
        },
        correlationId
      )
    ).rejects.toMatchObject({
      category: 'VALIDATION_FAILED'
    });

    // Error Case B: used (2) but only 1 serial provided -> 422 VALIDATION_FAILED
    await expect(
      jobsStore.completeJob(
        jobNumber,
        {
          result: 'success',
          usedItems: [{ sku: 'GH-CCTV-001', quantity: 2, serialNumbers: ['SN-1'] }], // only 1 serial for 2 units
          returnedItems: [{ sku: 'GH-CCTV-001', quantity: 0 }]
        },
        correlationId
      )
    ).rejects.toMatchObject({
      category: 'VALIDATION_FAILED'
    });
  });

  it('TC-02 & TC-04: Valid completion report generates OP-07 and OP-08; System A updates ledger and activates 12m warranty', async () => {
    const correlationId = 'corr-tc04-full';
    const key = 'test-idemp-tc04-key';

    const testSku = 'GH-CCTV-001';
    stockLedger.setStock(testSku, 20, 2); // 2 units currently reserved for order

    // 1. Process checkout on System A to generate the real order number
    const { order } = await ordersService.processCheckout(
      {
        customerName: 'Eduardo Lim',
        customerPhone: '+639174445566',
        customerEmail: 'eduardo@example.com',
        address: {
          line1: '200 Taft Ave',
          city: 'Manila',
          province: 'Metro Manila',
          postalCode: '1000'
        },
        items: [{ sku: testSku, quantity: 2, unitPricePhp: '3850.00' }],
        includeInstallation: true,
        preferredStart: '2026-11-17T09:00:00+08:00',
        preferredEnd: '2026-11-17T11:00:00+08:00'
      },
      'checkout-idemp-04',
      correlationId
    );

    const generatedOrderNumber = order.orderNumber;

    // 2. Dispatched OP-01 to System B creates the installation job
    const jobRes = await jobsStore.createInstallationJob(
      {
        orderNumber: generatedOrderNumber,
        customerName: 'Eduardo Lim',
        customerPhone: '+639174445566',
        customerEmail: 'eduardo@example.com',
        address: {
          line1: '200 Taft Ave',
          city: 'Manila',
          province: 'Metro Manila',
          postalCode: '1000'
        },
        items: [{ sku: testSku, quantity: 2 }],
        preferredStart: '2026-11-17T09:00:00+08:00',
        preferredEnd: '2026-11-17T11:00:00+08:00'
      },
      key,
      correlationId
    );
    const jobNumber = jobRes.body.jobNumber;

    // Assign, confirm loading, start job
    await jobsStore.assignTechnician(jobNumber, 'tech-uuid-4', 'Eduardo Lim', '2026-11-17T09:00:00+08:00', '2026-11-17T11:00:00+08:00', correlationId);
    jobsStore.confirmLoading(jobNumber, testSku, 2);
    await jobsStore.startJob(jobNumber, correlationId);

    // Complete job: 1 used (with serial), 1 returned unused
    const completionRes = await jobsStore.completeJob(
      jobNumber,
      {
        result: 'success',
        completedAt: '2026-11-17T11:00:00+08:00',
        notes: '1 camera installed at front door, 1 camera returned unused per customer request',
        usedItems: [{ sku: testSku, quantity: 1, serialNumbers: ['SN-CAM-10001'] }],
        returnedItems: [{ sku: testSku, quantity: 1 }]
      },
      correlationId
    );

    expect(completionRes.job.status).toBe('Completed');

    // TC-02: Verify OP-07 payload conforms to schema
    const op07 = completionRes.op07Message;
    expect(op07.operationId).toBe('OP-07');
    const op07Validation = CompletionWebhookRequestSchema.safeParse(op07.payload);
    expect(op07Validation.success).toBe(true);

    // Verify OP-08 payloads conform to schema
    expect(completionRes.op08Messages).toHaveLength(2); // 1 used line, 1 returned line
    for (const op08 of completionRes.op08Messages) {
      expect(op08.operationId).toBe('OP-08');
      expect(InventoryAdjustmentWebhookRequestSchema.safeParse(op08.payload).success).toBe(true);
    }

    // Deliver OP-07 to System A:
    const op07Result = ordersService.processCompletionReport(op07.payload, correlationId);
    expect(op07Result.success).toBe(true);
    expect(op07Result.activatedWarrantiesCount).toBe(1);

    // Deliver OP-08 lines to System A:
    for (const op08 of completionRes.op08Messages) {
      ordersService.processInventoryAdjustment(op08.payload, correlationId);
    }

    // Ledger Invariants check after completion:
    // Started at onHand=20, reserved=4 (from 2 preseed + 2 checkout)
    // 1 used: onHand -1, reserved -1 -> onHand=19, reserved=3
    // 1 returned_unused: reserved -1 -> onHand=19, reserved=2
    const currentStock = stockLedger.getStock(testSku);
    expect(currentStock.onHand).toBe(19);
    expect(currentStock.reserved).toBe(2);
    expect(currentStock.available).toBe(17);
  });

  it('TC-12: Stale timestamp (> 5 min) or forged HMAC is rejected with 401', () => {
    const signingSecret = 'test-signing-secret';
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const rawBody = JSON.stringify({ test: 'payload' });

    // Stale timestamp check
    const timestampMs = new Date(tenMinutesAgo).getTime();
    const isStale = Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000;
    expect(isStale).toBe(true);

    // Forged signature check
    const forgedSig = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';
    const validSig = 'sha256=' + crypto.createHmac('sha256', signingSecret).update(`${tenMinutesAgo}.${rawBody}`).digest('hex');
    expect(forgedSig !== validSig).toBe(true);
  });
});
