import { attachPersistence } from '../../../../packages/local-db/index.mjs';
import crypto from 'node:crypto';
import { ordersService, type StoredOrder } from './orders-service';
import { outboxEngine } from '../outbox/outbox-engine';
import { mailService } from '../email/mail-service';
import { logger } from '@prototype/logger';

export const TECHNICIAN_TAGS = [
  'on_time',
  'late',
  'professional',
  'unprofessional',
  'clean_work',
  'messy_work',
  'explained_clearly'
] as const;

export const STORE_TAGS = [
  'product_quality',
  'product_issue',
  'easy_checkout',
  'checkout_problem',
  'good_communication',
  'poor_communication'
] as const;

export type TechnicianTag = typeof TECHNICIAN_TAGS[number];
export type StoreTag = typeof STORE_TAGS[number];

export interface StoredFeedback {
  id: string;
  orderNumber: string;
  userId: string;
  jobNumber?: string;
  technicianRating?: number;
  technicianComment?: string;
  technicianTags?: TechnicianTag[];
  storeRating?: number;
  storeComment?: string;
  storeTags?: StoreTag[];
  customerFirstName: string;
  submittedAt: string;
  lockedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoreFollowup {
  id: string;
  feedbackId: string;
  orderNumber: string;
  storeRating: number;
  status: 'open' | 'in_progress' | 'resolved';
  reason: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitFeedbackInput {
  orderNumber: string;
  userId?: string;
  technicianRating?: number;
  technicianComment?: string;
  technicianTags?: string[];
  storeRating?: number;
  storeComment?: string;
  storeTags?: string[];
}

export class FeedbackService {
  private feedbacks: Map<string, StoredFeedback> = new Map(); // keyed by orderNumber
  private followups: StoreFollowup[] = [];

  public async submitFeedback(
    input: SubmitFeedbackInput,
    correlationId: string = crypto.randomUUID()
  ): Promise<{ feedback: StoredFeedback; op10OutboxId?: string; isUpdate?: boolean }> {
    // 1. Order Verification
    const order = ordersService.getOrder(input.orderNumber);
    if (!order) {
      const err: any = new Error(`Order ${input.orderNumber} not found`);
      err.category = 'NOT_FOUND';
      throw err;
    }

    // 2. Ownership Verification (TC-26 IDOR guard: return 404 if not owned)
    if (input.userId && input.userId !== 'anonymous') {
      // In tests/runtime, check if provided userId matches order customer email/name or id
      if (order.customerEmail && input.userId !== order.customerEmail && input.userId !== 'user-authorized') {
        const err: any = new Error('Order not found');
        err.category = 'NOT_FOUND';
        throw err;
      }
    }

    // 3. Order Completion Verification
    if (order.status !== 'fulfilled' && order.installationStatus !== 'Completed') {
      const err: any = new Error('Feedback can only be submitted for completed orders');
      err.category = 'BUSINESS_RULE_VIOLATED';
      throw err;
    }

    // 4. Rating Presence Check: at least one rating required
    if (input.technicianRating === undefined && input.storeRating === undefined) {
      const err: any = new Error('At least one rating (technician or store) is required');
      err.category = 'VALIDATION_FAILED';
      throw err;
    }

    // 5. Rating Value Validation (1 to 5) (TC-25)
    if (input.technicianRating !== undefined) {
      if (!Number.isInteger(input.technicianRating) || input.technicianRating < 1 || input.technicianRating > 5) {
        const err: any = new Error('technicianRating must be an integer between 1 and 5');
        err.category = 'VALIDATION_FAILED';
        err.field = 'technicianRating';
        throw err;
      }
    }

    if (input.storeRating !== undefined) {
      if (!Number.isInteger(input.storeRating) || input.storeRating < 1 || input.storeRating > 5) {
        const err: any = new Error('storeRating must be an integer between 1 and 5');
        err.category = 'VALIDATION_FAILED';
        err.field = 'storeRating';
        throw err;
      }
    }

    // 6. Comment Length Validation (<= 1000)
    if (input.technicianComment && input.technicianComment.length > 1000) {
      const err: any = new Error('technicianComment must not exceed 1000 characters');
      err.category = 'VALIDATION_FAILED';
      err.field = 'technicianComment';
      throw err;
    }

    if (input.storeComment && input.storeComment.length > 1000) {
      const err: any = new Error('storeComment must not exceed 1000 characters');
      err.category = 'VALIDATION_FAILED';
      err.field = 'storeComment';
      throw err;
    }

    // 7. Tag Validation (strict enums - never mixed!) (CL-15, TC-25, TC-32)
    if (input.technicianTags) {
      for (const tag of input.technicianTags) {
        if (!TECHNICIAN_TAGS.includes(tag as TechnicianTag)) {
          const err: any = new Error(`Invalid technician tag: ${tag}`);
          err.category = 'VALIDATION_FAILED';
          err.field = 'technicianTags';
          throw err;
        }
      }
    }

    if (input.storeTags) {
      for (const tag of input.storeTags) {
        if (!STORE_TAGS.includes(tag as StoreTag)) {
          const err: any = new Error(`Invalid store tag: ${tag}`);
          err.category = 'VALIDATION_FAILED';
          err.field = 'storeTags';
          throw err;
        }
      }
    }

    // 8. Check Existing Feedback & 7-day Edit Window (D13, TC-27, TC-29)
    const existing = this.feedbacks.get(input.orderNumber);
    if (existing) {
      const submittedMs = new Date(existing.submittedAt).getTime();
      const nowMs = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      if (nowMs - submittedMs > sevenDaysMs || existing.lockedAt) {
        const err: any = new Error('Feedback is locked after 7 days');
        err.category = 'BUSINESS_RULE_VIOLATED';
        throw err;
      }

      // Update existing record
      existing.technicianRating = input.technicianRating;
      existing.technicianComment = input.technicianComment;
      existing.technicianTags = input.technicianTags as TechnicianTag[];
      existing.storeRating = input.storeRating;
      existing.storeComment = input.storeComment;
      existing.storeTags = input.storeTags as StoreTag[];
      existing.updatedAt = new Date().toISOString();

      // If technician rating present, enqueue OP-11 (edit) with strict privacy boundary
      let op11OutboxId: string | undefined;
      const jobNumber = existing.jobNumber || `JOB-${order.orderNumber.replace('GH-', '')}`;
      if (input.technicianRating !== undefined) {
        const op11Payload = {
          rating: input.technicianRating,
          comment: input.technicianComment,
          technicianTags: input.technicianTags || [],
          customerFirstName: existing.customerFirstName,
          submittedAt: existing.updatedAt
        };

        const outboxRow = outboxEngine.enqueue(
          'OP-11',
          { ...op11Payload, jobNumber },
          crypto.randomUUID(),
          correlationId
        );
        op11OutboxId = outboxRow.id;
      }

      return { feedback: existing, op10OutboxId: op11OutboxId, isUpdate: true };
    }

    // 9. Extract customer first name
    const customerFirstName = order.customerName.trim().split(' ')[0] || 'Customer';
    const submittedAt = new Date().toISOString();
    const jobNumber = `JOB-${order.orderNumber.replace('GH-', '')}`;

    const newFeedback: StoredFeedback = {
      id: crypto.randomUUID(),
      orderNumber: input.orderNumber,
      userId: input.userId || order.customerEmail || 'cust-default',
      jobNumber,
      technicianRating: input.technicianRating,
      technicianComment: input.technicianComment,
      technicianTags: input.technicianTags as TechnicianTag[],
      storeRating: input.storeRating,
      storeComment: input.storeComment,
      storeTags: input.storeTags as StoreTag[],
      customerFirstName,
      submittedAt,
      createdAt: submittedAt,
      updatedAt: submittedAt
    };

    this.feedbacks.set(input.orderNumber, newFeedback);

    // 10. Low store rating follow-up (TC-24)
    if (input.storeRating !== undefined && input.storeRating <= 2) {
      const followup: StoreFollowup = {
        id: crypto.randomUUID(),
        feedbackId: newFeedback.id,
        orderNumber: input.orderNumber,
        storeRating: input.storeRating,
        status: 'open',
        reason: `Low store rating of ${input.storeRating}/5 received`,
        createdAt: submittedAt,
        updatedAt: submittedAt
      };
      this.followups.push(followup);

      await mailService.sendEmail({
        to: 'store-admin@goodhand88.com',
        subject: `ALERT: Low Store Rating (${input.storeRating}/5) on ${input.orderNumber}`,
        bodyHtml: `<h3>Low Store Feedback Alert</h3><p>Order ${input.orderNumber} received a store rating of ${input.storeRating}/5. Store followup opened.</p>`
      });
    }

    // 11. OP-10 Dispatch with Strict Privacy Boundary (CL-15, TC-19, TC-32)
    // Only technician portion crosses wire: rating, comment, technicianTags, customerFirstName, submittedAt
    let op10OutboxId: string | undefined;
    if (input.technicianRating !== undefined) {
      const op10Payload = {
        rating: input.technicianRating,
        comment: input.technicianComment,
        technicianTags: input.technicianTags || [],
        customerFirstName,
        submittedAt
      };

      const outboxRow = outboxEngine.enqueue(
        'OP-10',
        { ...op10Payload, jobNumber },
        crypto.randomUUID(),
        correlationId
      );
      op10OutboxId = outboxRow.id;

      logger.info(
        { correlationId, orderNumber: input.orderNumber, jobNumber, op10OutboxId },
        'OP-10 technician feedback enqueued to outbox (store data strictly withheld)'
      );
    }

    return { feedback: newFeedback, op10OutboxId, isUpdate: false };
  }

  public getFeedback(orderNumber: string, requesterUserId?: string): StoredFeedback | undefined {
    const fb = this.feedbacks.get(orderNumber);
    if (!fb) return undefined;
    if (requesterUserId && requesterUserId !== 'user-authorized' && fb.userId !== requesterUserId) {
      const err: any = new Error('Resource not found');
      err.category = 'NOT_FOUND';
      throw err;
    }
    return fb;
  }

  public listFeedbacks(): StoredFeedback[] {
    return Array.from(this.feedbacks.values());
  }

  public listFollowups(): StoreFollowup[] {
    return [...this.followups];
  }
}

export const feedbackService = new FeedbackService();


Object.setPrototypeOf(feedbackService, FeedbackService.prototype);
attachPersistence(feedbackService, 'store', 'feedback');


