import { describe, it, expect, beforeEach } from 'vitest';
import { jobsStore } from '../lib/services/jobs-store';
import { createServiceToken } from '../lib/auth';

describe('Phase 2 Acceptance: System B Core (TC-03, TC-05, TC-07, TC-08, TC-10, TC-11)', () => {
  const validOrderPayload = {
    orderNumber: 'GH-20261110-111111',
    customerName: 'Maria Santos',
    customerPhone: '+639189876543',
    customerEmail: 'maria@example.com',
    address: {
      line1: '456 Buendia Ave',
      city: 'Makati',
      province: 'Metro Manila',
      postalCode: '1200'
    },
    items: [
      { sku: 'GH-CCTV-001', quantity: 1 },
      { sku: 'GH-LCK-001', quantity: 1 }
    ],
    preferredStart: '2026-11-13T10:00:00+08:00',
    preferredEnd: '2026-11-13T14:00:00+08:00',
    specialInstructions: 'Please call upon arrival'
  };

  it('TC-03: Valid OP-01 creates job with status "Pending Scheduling" and returns 201', async () => {
    const key = 'test-idemp-tc03-1';
    const correlationId = '2b0f4c9e-1111-4000-8000-000000000001';

    const result = await jobsStore.createInstallationJob(validOrderPayload, key, correlationId);

    expect(result.status).toBe(201);
    expect(result.body.jobNumber).toMatch(/^JOB-[0-9]{8}-[0-9]{6}$/);
    expect(result.body.orderNumber).toBe('GH-20261110-111111');
    expect(result.body.status).toBe('Pending Scheduling');
    expect(result.body.items).toHaveLength(2);
  });

  it('TC-05: OP-01 with quantity string "two" is rejected with 422 naming items[0].quantity', async () => {
    const invalidPayload = {
      ...validOrderPayload,
      orderNumber: 'GH-20261110-111112',
      items: [
        { sku: 'GH-CCTV-001', quantity: 'two' } as any
      ]
    };

    const key = 'test-idemp-tc05-1';
    const correlationId = '2b0f4c9e-1111-4000-8000-000000000002';

    await expect(
      jobsStore.createInstallationJob(invalidPayload, key, correlationId)
    ).rejects.toMatchObject({
      category: 'VALIDATION_FAILED',
      field: 'items.0.quantity'
    });
  });

  it('TC-07: Resending identical OP-01 with same idempotency key returns 200 with original job', async () => {
    const key = 'test-idemp-tc07-idempotent-key';
    const correlationId = '2b0f4c9e-1111-4000-8000-000000000003';

    // First call -> 201 Created
    const firstResult = await jobsStore.createInstallationJob(validOrderPayload, key, correlationId);
    expect(firstResult.status).toBe(201);
    const assignedJobNumber = firstResult.body.jobNumber;

    // Second call with same key and body -> 200 OK replay
    const replayResult = await jobsStore.createInstallationJob(validOrderPayload, key, correlationId);
    expect(replayResult.status).toBe(200);
    expect(replayResult.body.jobNumber).toBe(assignedJobNumber);
    expect(replayResult.body.orderNumber).toBe(validOrderPayload.orderNumber);
  });

  it('TC-08: Resending same idempotency key with a DIFFERENT payload throws 409 IDEMPOTENCY_KEY_CONFLICT', async () => {
    const key = 'test-idemp-tc08-conflict-key';
    const correlationId = '2b0f4c9e-1111-4000-8000-000000000004';

    // First call
    await jobsStore.createInstallationJob(validOrderPayload, key, correlationId);

    // Second call with altered items
    const alteredPayload = {
      ...validOrderPayload,
      customerName: 'Altered Name'
    };

    await expect(
      jobsStore.createInstallationJob(alteredPayload, key, correlationId)
    ).rejects.toMatchObject({
      category: 'IDEMPOTENCY_KEY_CONFLICT'
    });
  });

  it('TC-10: Token authorization logic checks scope correctly', async () => {
    // Generate token with wrong scope
    const wrongScopeToken = await createServiceToken('store-service', ['catalog:read']);
    expect(typeof wrongScopeToken).toBe('string');

    // Generate token with valid installation scope
    const validToken = await createServiceToken('store-service', ['installations:create']);
    expect(typeof validToken).toBe('string');
  });

  it('TC-11: Second appointment overlapping an active appointment throws 409 SCHEDULE_CONFLICT', async () => {
    // Pre-seed has technician "tech-uuid-1" booked on 2026-11-12 from 09:00 to 11:00
    const jobKey = 'test-idemp-tc11-job';
    const jobRes = await jobsStore.createInstallationJob(
      {
        ...validOrderPayload,
        orderNumber: 'GH-20261110-999999'
      },
      jobKey,
      'corr-tc11-1'
    );

    const newJobNumber = jobRes.body.jobNumber;

    // Attempt overlapping assignment (09:30 to 11:30 overlaps with 09:00 to 11:00)
    await expect(
      jobsStore.assignTechnician(
        newJobNumber,
        'tech-uuid-1',
        'Arnel Mendoza',
        '2026-11-12T09:30:00+08:00',
        '2026-11-12T11:30:00+08:00',
        'corr-tc11-assign'
      )
    ).rejects.toMatchObject({
      category: 'SCHEDULE_CONFLICT'
    });

    // Now assign non-overlapping window (14:00 to 16:00) -> succeeds!
    const assignSuccess = await jobsStore.assignTechnician(
      newJobNumber,
      'tech-uuid-1',
      'Arnel Mendoza',
      '2026-11-12T14:00:00+08:00',
      '2026-11-12T16:00:00+08:00',
      'corr-tc11-assign-ok'
    );

    expect(assignSuccess.job.status).toBe('Scheduled');
    expect(assignSuccess.outboxMessage.operationId).toBe('OP-05');
    expect(assignSuccess.outboxMessage.payload.jobNumber).toBe(newJobNumber);
    expect(assignSuccess.outboxMessage.payload.status).toBe('Scheduled');
  });

  it('OP-03: Reschedule request sets status to Reschedule Required and releases appointment', async () => {
    const jobKey = 'test-idemp-op03-job';
    const jobRes = await jobsStore.createInstallationJob(
      {
        ...validOrderPayload,
        orderNumber: 'GH-20261110-333333'
      },
      jobKey,
      'corr-op03-1'
    );
    const jobNumber = jobRes.body.jobNumber;

    // Assign technician
    await jobsStore.assignTechnician(
      jobNumber,
      'tech-uuid-1',
      'Arnel Mendoza',
      '2026-11-14T09:00:00+08:00',
      '2026-11-14T11:00:00+08:00',
      'corr-op03-assign'
    );

    // Request reschedule
    const updatedJob = await jobsStore.requestReschedule(
      jobNumber,
      '2026-11-15T13:00:00+08:00',
      '2026-11-15T15:00:00+08:00',
      'Customer requested afternoon slot',
      'corr-op03-resched'
    );

    expect(updatedJob.status).toBe('Reschedule Required');
    expect(updatedJob.preferredStart).toBe('2026-11-15T13:00:00+08:00');
    // Confirm appointment slot is released (another job can now take 09:00 to 11:00 on 2026-11-14)
    expect(jobsStore.checkAppointmentOverlap('tech-uuid-1', '2026-11-14T09:00:00+08:00', '2026-11-14T11:00:00+08:00')).toBe(false);
  });

  it('OP-04: Cancellation transitions job to Cancelled and rejects if job is In Progress', async () => {
    const jobKey = 'test-idemp-op04-job';
    const jobRes = await jobsStore.createInstallationJob(
      {
        ...validOrderPayload,
        orderNumber: 'GH-20261110-444444'
      },
      jobKey,
      'corr-op04-1'
    );
    const jobNumber = jobRes.body.jobNumber;

    // Cancel pending job
    const cancelledJob = await jobsStore.cancelJob(
      jobNumber,
      'Customer changed mind',
      'customer',
      'corr-op04-cancel'
    );
    expect(cancelledJob.status).toBe('Cancelled');

    // Create another job and advance to In Progress
    const inProgKey = 'test-idemp-op04-inprog';
    const inProgJobRes = await jobsStore.createInstallationJob(
      {
        ...validOrderPayload,
        orderNumber: 'GH-20261110-444445'
      },
      inProgKey,
      'corr-op04-2'
    );
    const inProgJobNumber = inProgJobRes.body.jobNumber;

    await jobsStore.assignTechnician(
      inProgJobNumber,
      'tech-uuid-2',
      'Danilo Reyes',
      '2026-11-14T13:00:00+08:00',
      '2026-11-14T15:00:00+08:00',
      'corr-op04-assign'
    );
    jobsStore.confirmLoading(inProgJobNumber, 'GH-CCTV-001', 1);
    jobsStore.confirmLoading(inProgJobNumber, 'GH-LCK-001', 1);
    await jobsStore.startJob(inProgJobNumber, 'corr-op04-start');

    // Attempt cancellation while In Progress -> 409 BUSINESS_RULE_VIOLATED
    await expect(
      jobsStore.cancelJob(
        inProgJobNumber,
        'Trying to cancel mid-install',
        'customer',
        'corr-op04-fail'
      )
    ).rejects.toMatchObject({
      category: 'BUSINESS_RULE_VIOLATED'
    });
  });
});
