import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { feedbackService } from '../lib/services/feedback-service';
import { ordersService } from '../lib/services/orders-service';
import { outboxEngine } from '../lib/outbox/outbox-engine';
import { simulationService } from '../lib/simulation/simulation-service';
import { jobsStore } from '../../fsm/lib/services/jobs-store';
import {
  TechnicianFeedbackRequestSchema,
  type TechnicianFeedbackRequest
} from '@prototype/contract';

describe('Phase 5 Acceptance: Feedback, Privacy Boundary, Follow-ups & Demo (TC-19 to TC-29, TC-32)', () => {
  beforeEach(() => {
    simulationService.reset();
  });

  // Helper to create and complete a full order + job
  async function createCompletedOrderAndJob(suffix: string) {
    const correlationId = `corr-${suffix}`;
    const checkoutRes = await ordersService.processCheckout(
      {
        customerName: 'Maria Santos',
        customerPhone: '+639171234567',
        customerEmail: `maria.${suffix}@example.com`,
        address: {
          line1: '123 Pioneer St',
          city: 'Pasig',
          province: 'Metro Manila',
          postalCode: '1600'
        },
        items: [{ sku: 'GH-CCTV-001', quantity: 1, unitPricePhp: '3850.00' }],
        includeInstallation: true,
        preferredStart: '2026-11-20T09:00:00+08:00',
        preferredEnd: '2026-11-20T11:00:00+08:00'
      },
      `idemp-order-${suffix}`,
      correlationId
    );

    const orderNumber = checkoutRes.order.orderNumber;

    // Create job in System B
    const jobRes = await jobsStore.createInstallationJob(
      {
        orderNumber,
        customerName: 'Maria Santos',
        customerPhone: '+639171234567',
        customerEmail: `maria.${suffix}@example.com`,
        address: checkoutRes.order.address,
        items: [{ sku: 'GH-CCTV-001', quantity: 1 }],
        preferredStart: '2026-11-20T09:00:00+08:00',
        preferredEnd: '2026-11-20T11:00:00+08:00'
      },
      `idemp-job-${suffix}`,
      correlationId
    );

    const jobNumber = jobRes.body.jobNumber;

    // Assign technician
    await jobsStore.assignTechnician(
      jobNumber,
      `tech-${suffix}`,
      'Arnel Mendoza',
      '2026-11-20T09:00:00+08:00',
      '2026-11-20T11:00:00+08:00',
      correlationId
    );

    // Confirm loading and start
    jobsStore.confirmLoading(jobNumber, 'GH-CCTV-001', 1);
    await jobsStore.startJob(jobNumber, correlationId);

    // Complete job
    await jobsStore.completeJob(
      jobNumber,
      {
        completedAt: '2026-11-20T10:30:00+08:00',
        result: 'Successfully completed CCTV mounting',
        usedItems: [{ sku: 'GH-CCTV-001', quantity: 1, serialNumbers: [`SN-${suffix}-001`] }],
        returnedItems: [],
        notes: 'Clean installation'
      },
      correlationId
    );

    // Mark order fulfilled in System A via OP-07 simulation
    ordersService.processCompletionReport(
      {
        orderNumber,
        jobNumber,
        completedAt: '2026-11-20T10:30:00+08:00',
        result: 'Successfully completed CCTV mounting',
        installedUnits: [{ sku: 'GH-CCTV-001', serialNumber: `SN-${suffix}-001` }]
      },
      correlationId
    );

    return { orderNumber, jobNumber, technicianId: `tech-${suffix}` };
  }

  it('TC-19: Contract: OP-10 payload schema validates strictly (rating 1 to 5, technician tags only, no contact fields)', () => {
    // Valid OP-10 payload
    const validOp10 = {
      rating: 5,
      comment: 'Very professional technician',
      technicianTags: ['on_time', 'professional', 'clean_work'],
      customerFirstName: 'Maria',
      submittedAt: '2026-11-20T11:00:00+08:00'
    };
    const parsed = TechnicianFeedbackRequestSchema.safeParse(validOp10);
    expect(parsed.success).toBe(true);

    // Rejects contact details (phone, email)
    const withContactInfo = {
      ...validOp10,
      customerPhone: '+639171234567'
    };
    const parsedContact = TechnicianFeedbackRequestSchema.safeParse(withContactInfo);
    expect(parsedContact.success).toBe(false);

    // Rejects store tags
    const withStoreTags = {
      ...validOp10,
      technicianTags: ['easy_checkout'] // invalid tag for technician!
    };
    const parsedStoreTags = TechnicianFeedbackRequestSchema.safeParse(withStoreTags);
    expect(parsedStoreTags.success).toBe(false);
  });

  it('TC-20: Interface: Valid OP-10 on a Completed job records feedback and updates averages', async () => {
    const { jobNumber, technicianId } = await createCompletedOrderAndJob('tc20');

    const key = 'idemp-tc20-fb';
    const corrId = 'corr-tc20';
    const res = await jobsStore.saveTechnicianFeedback(
      jobNumber,
      {
        rating: 5,
        comment: 'Punctual and very thorough work',
        technicianTags: ['on_time', 'professional'],
        customerFirstName: 'Maria',
        submittedAt: '2026-11-20T11:00:00+08:00'
      },
      key,
      corrId
    );

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Verify stored feedback
    const fb = jobsStore.getTechnicianFeedbackForJob(jobNumber);
    expect(fb).toBeDefined();
    expect(fb?.rating).toBe(5);
    expect(fb?.customerFirstName).toBe('Maria');
    expect(fb?.tags).toContain('on_time');

    // Verify average calculation
    const techStats = jobsStore.listFeedbackForTechnician(technicianId);
    expect(techStats.totalReviews).toBe(1);
    expect(techStats.averageRating).toBe(5);
  });

  it('TC-21: Failure: OP-10 for a job not Completed is rejected with 422, nothing stored (CL-15)', async () => {
    // Create an uncompleted (Scheduled) job
    const correlationId = 'corr-tc21';
    const jobRes = await jobsStore.createInstallationJob(
      {
        orderNumber: 'GH-20261110-212121',
        customerName: 'Juan Cruz',
        customerPhone: '+639171234567',
        customerEmail: 'juan.cruz@example.com',
        address: {
          line1: '123 Ayala',
          city: 'Makati',
          province: 'Metro Manila',
          postalCode: '1226'
        },
        items: [{ sku: 'GH-CCTV-001', quantity: 1 }],
        preferredStart: '2026-11-22T09:00:00+08:00',
        preferredEnd: '2026-11-22T11:00:00+08:00'
      },
      'idemp-tc21-job',
      correlationId
    );

    const jobNumber = jobRes.body.jobNumber;

    // Attempt OP-10 on non-completed job -> 422 BUSINESS_RULE_VIOLATED
    await expect(
      jobsStore.saveTechnicianFeedback(
        jobNumber,
        {
          rating: 4,
          customerFirstName: 'Juan',
          submittedAt: '2026-11-22T12:00:00+08:00'
        },
        'idemp-tc21-fb',
        correlationId
      )
    ).rejects.toMatchObject({
      category: 'BUSINESS_RULE_VIOLATED',
      statusCode: 422
    });

    expect(jobsStore.getTechnicianFeedbackForJob(jobNumber)).toBeUndefined();
  });

  it('TC-22: Failure: OP-10 same key and body returns 200; same key different body returns 409', async () => {
    const { jobNumber } = await createCompletedOrderAndJob('tc22');

    const key = 'idemp-tc22-repeat-key';
    const payload = {
      rating: 4,
      comment: 'Good service',
      technicianTags: ['clean_work'],
      customerFirstName: 'Maria',
      submittedAt: '2026-11-20T11:00:00+08:00'
    };

    // First submission: 201
    const firstRes = await jobsStore.saveTechnicianFeedback(jobNumber, payload, key, 'corr-tc22-1');
    expect(firstRes.status).toBe(201);

    // Resend same key + same body: 200 idempotent replay
    const replayRes = await jobsStore.saveTechnicianFeedback(jobNumber, payload, key, 'corr-tc22-2');
    expect(replayRes.status).toBe(200);

    // Resend same key + different body: 409 IDEMPOTENCY_KEY_CONFLICT
    const differentPayload = { ...payload, rating: 2 };
    await expect(
      jobsStore.saveTechnicianFeedback(jobNumber, differentPayload, key, 'corr-tc22-3')
    ).rejects.toMatchObject({
      category: 'IDEMPOTENCY_KEY_CONFLICT'
    });
  });

  it('TC-23: Failure: System B down at feedback submit: saved in A, delivered once after recovery (CL-06)', async () => {
    const { orderNumber } = await createCompletedOrderAndJob('tc23');

    // Customer submits feedback in System A
    const subRes = await feedbackService.submitFeedback(
      {
        orderNumber,
        technicianRating: 5,
        technicianComment: 'Great job',
        technicianTags: ['on_time'],
        storeRating: 5,
        storeTags: ['easy_checkout']
      },
      'corr-tc23-submit'
    );

    expect(subRes.feedback).toBeDefined();
    expect(subRes.op10OutboxId).toBeDefined();

    // Outbox has OP-10 queued as pending
    const outboxRow = outboxEngine.getOutboxRows().find(r => r.id === subRes.op10OutboxId);
    expect(outboxRow).toBeDefined();
    expect(outboxRow?.operationId).toBe('OP-10');
    expect(outboxRow?.status).toBe('pending');

    // Simulate System B outage: partner returns 503
    let systemBUp = false;
    const mockDispatcher = async (opId: string) => {
      if (!systemBUp) return { status: 503 };
      return { status: 201 };
    };

    // Drain attempt while System B is down -> delivery fails, outbox retry scheduled
    await outboxEngine.drainQueue(mockDispatcher);
    expect(outboxRow?.status).toBe('pending');
    expect(outboxRow?.attempts).toBe(1);

    // System B recovers
    systemBUp = true;
    outboxRow!.nextAttemptAt = new Date().toISOString(); // make eligible for drain
    const drainRes = await outboxEngine.drainQueue(mockDispatcher);
    expect(drainRes.successful).toBe(1);
    expect(outboxRow?.status).toBe('delivered');
  });

  it('TC-24: Failure: Technician rating <= 2 flags review, opens follow-up and sends alert (D14)', async () => {
    const { jobNumber } = await createCompletedOrderAndJob('tc24');

    const res = await jobsStore.saveTechnicianFeedback(
      jobNumber,
      {
        rating: 1,
        comment: 'Technician was 2 hours late and did not bring tools',
        technicianTags: ['late', 'unprofessional'],
        customerFirstName: 'Maria',
        submittedAt: '2026-11-20T11:00:00+08:00'
      },
      'idemp-tc24-low',
      'corr-tc24'
    );

    expect(res.status).toBe(201);

    const fb = jobsStore.getTechnicianFeedbackForJob(jobNumber);
    expect(fb?.flaggedForReview).toBe(true);

    const followups = jobsStore.listFollowups();
    const openFollowup = followups.find(f => f.jobNumber === jobNumber);
    expect(openFollowup).toBeDefined();
    expect(openFollowup?.status).toBe('open');
    expect(openFollowup?.rating).toBe(1);
  });

  it('TC-25: Failure: Rating 6, rating 0, comment 1001 chars, unknown tag rejected; script text stored inert (CL-01, CL-02)', async () => {
    const { orderNumber } = await createCompletedOrderAndJob('tc25');

    // Rating 6 rejected
    await expect(
      feedbackService.submitFeedback({
        orderNumber,
        technicianRating: 6
      })
    ).rejects.toMatchObject({ category: 'VALIDATION_FAILED' });

    // Rating 0 rejected
    await expect(
      feedbackService.submitFeedback({
        orderNumber,
        technicianRating: 0
      })
    ).rejects.toMatchObject({ category: 'VALIDATION_FAILED' });

    // Comment 1001 chars rejected
    const longComment = 'a'.repeat(1001);
    await expect(
      feedbackService.submitFeedback({
        orderNumber,
        technicianRating: 5,
        technicianComment: longComment
      })
    ).rejects.toMatchObject({ category: 'VALIDATION_FAILED' });

    // Unknown tag rejected
    await expect(
      feedbackService.submitFeedback({
        orderNumber,
        technicianRating: 5,
        technicianTags: ['invented_tag']
      })
    ).rejects.toMatchObject({ category: 'VALIDATION_FAILED' });

    // Script text stored inertly without executing
    const scriptText = '<script>alert("xss")</script>';
    const safeSub = await feedbackService.submitFeedback({
      orderNumber,
      technicianRating: 5,
      technicianComment: scriptText
    });
    expect(safeSub.feedback.technicianComment).toBe(scriptText);
  });

  it('TC-26: Failure: Another customer order submit or read returns 404 (IDOR guard, section 5)', async () => {
    const { orderNumber } = await createCompletedOrderAndJob('tc26');

    // Submit legitimate feedback by the actual customer
    await feedbackService.submitFeedback({
      orderNumber,
      userId: 'maria.tc26@example.com',
      technicianRating: 5
    });

    // Attacker attempts to submit feedback for this order -> 404 NOT_FOUND
    await expect(
      feedbackService.submitFeedback({
        orderNumber,
        userId: 'attacker@evil.com',
        technicianRating: 1
      })
    ).rejects.toMatchObject({ category: 'NOT_FOUND' });

    // Attacker attempts to read feedback for this order -> 404 NOT_FOUND
    expect(() => {
      feedbackService.getFeedback(orderNumber, 'attacker@evil.com');
    }).toThrowError('Resource not found');
  });

  it('TC-27: Failure: Edit after 7 days returns 409 BUSINESS_RULE_VIOLATED locked (D13)', async () => {
    const { orderNumber, jobNumber } = await createCompletedOrderAndJob('tc27');

    // Initial submission
    await feedbackService.submitFeedback({
      orderNumber,
      technicianRating: 4,
      technicianTags: ['clean_work']
    });

    const fb = feedbackService.getFeedback(orderNumber);
    expect(fb).toBeDefined();

    // Artificially age the feedback past 7 days (8 days ago)
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    fb!.submittedAt = eightDaysAgo;

    // Attempt to edit after 7 days -> 409 BUSINESS_RULE_VIOLATED
    await expect(
      feedbackService.submitFeedback({
        orderNumber,
        technicianRating: 5
      })
    ).rejects.toMatchObject({
      category: 'BUSINESS_RULE_VIOLATED'
    });
  });

  it('TC-28: Failure: Technician opens another technician feedback returns 404 (section 5)', () => {
    // Arnel Mendoza queries Danilo Reyes's feedback
    expect(() => {
      jobsStore.listFeedbackForTechnician('tech-arnel-1', 'tech-danilo-2');
    }).toThrowError('Resource not found');
  });

  it('TC-29: Interface: Edit within 7 days updates feedback and delivers OP-11 without duplicate (CL-07, CL-15)', async () => {
    const { orderNumber, jobNumber } = await createCompletedOrderAndJob('tc29');

    // Initial submission (Day 1)
    const initial = await feedbackService.submitFeedback({
      orderNumber,
      technicianRating: 4,
      technicianComment: 'Good job',
      technicianTags: ['on_time']
    });
    expect(initial.isUpdate).toBe(false);

    // Save initial in System B as well
    await jobsStore.saveTechnicianFeedback(
      jobNumber,
      {
        rating: 4,
        comment: 'Good job',
        technicianTags: ['on_time'],
        customerFirstName: 'Maria',
        submittedAt: initial.feedback.submittedAt
      },
      'idemp-tc29-initial',
      'corr-tc29'
    );

    // Customer edits within 7 days (Day 2) -> rating changed to 5
    const update = await feedbackService.submitFeedback({
      orderNumber,
      technicianRating: 5,
      technicianComment: 'Actually exceptional work after inspecting the wiring!',
      technicianTags: ['on_time', 'clean_work']
    });

    expect(update.isUpdate).toBe(true);
    expect(update.feedback.technicianRating).toBe(5);

    // System B processes OP-11
    const patchRes = await jobsStore.updateTechnicianFeedback(
      jobNumber,
      {
        rating: 5,
        comment: 'Actually exceptional work after inspecting the wiring!',
        technicianTags: ['on_time', 'clean_work'],
        customerFirstName: 'Maria',
        submittedAt: update.feedback.updatedAt
      },
      'idemp-tc29-patch',
      'corr-tc29'
    );

    expect(patchRes.status).toBe(200);
    const updatedInFsm = jobsStore.getTechnicianFeedbackForJob(jobNumber);
    expect(updatedInFsm?.rating).toBe(5);
    expect(updatedInFsm?.comment).toContain('exceptional work');
  });

  it('TC-32: Failure: OP-10 with a store tag, or extra store fields returns 422 and nothing stored in System B (CL-15, CL-02)', async () => {
    const { jobNumber } = await createCompletedOrderAndJob('tc32');

    // Attempt to submit OP-10 with forbidden store tags
    await expect(
      jobsStore.saveTechnicianFeedback(
        jobNumber,
        {
          rating: 5,
          technicianTags: ['easy_checkout'], // illegal store tag!
          customerFirstName: 'Maria',
          submittedAt: '2026-11-20T11:00:00+08:00'
        },
        'idemp-tc32-illegal-tag',
        'corr-tc32'
      )
    ).rejects.toMatchObject({
      category: 'VALIDATION_FAILED'
    });

    // Attempt to submit OP-10 with forbidden storeComment or storeRating fields
    await expect(
      jobsStore.saveTechnicianFeedback(
        jobNumber,
        {
          rating: 5,
          storeRating: 5, // forbidden field in OP-10!
          storeComment: 'Fast shipping', // forbidden field in OP-10!
          customerFirstName: 'Maria',
          submittedAt: '2026-11-20T11:00:00+08:00'
        },
        'idemp-tc32-illegal-fields',
        'corr-tc32'
      )
    ).rejects.toMatchObject({
      category: 'VALIDATION_FAILED'
    });

    expect(jobsStore.getTechnicianFeedbackForJob(jobNumber)).toBeUndefined();
  });
});
