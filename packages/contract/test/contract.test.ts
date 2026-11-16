import { describe, it, expect } from 'vitest';
import {
  CreateInstallationRequestSchema,
  CompletionWebhookRequestSchema,
  TechnicianFeedbackRequestSchema,
  ErrorDetailSchema,
  JobStatusSchema
} from '../index.js';

describe('Contract Schema Validation (CL-01 to CL-16)', () => {
  it('TC-01: OP-01 payload validates correct format (phone, integer quantities, timestamps with offset)', () => {
    const validPayload = {
      orderNumber: 'GH-20261110-000001',
      customerName: 'Juan Dela Cruz',
      customerPhone: '+639171234567',
      customerEmail: 'juan@example.com',
      address: {
        line1: '123 Ayala Ave',
        city: 'Makati',
        province: 'Metro Manila',
        postalCode: '1226'
      },
      items: [
        { sku: 'GH-CCTV-001', quantity: 2 }
      ],
      preferredStart: '2026-11-12T09:00:00+08:00',
      preferredEnd: '2026-11-12T11:00:00+08:00',
      specialInstructions: 'Gate code 4321'
    };

    const parsed = CreateInstallationRequestSchema.safeParse(validPayload);
    expect(parsed.success).toBe(true);
  });

  it('TC-05: OP-01 with string quantity is rejected with validation error', () => {
    const invalidPayload = {
      orderNumber: 'GH-20261110-000001',
      customerName: 'Juan Dela Cruz',
      customerPhone: '+639171234567',
      customerEmail: 'juan@example.com',
      address: {
        line1: '123 Ayala Ave',
        city: 'Makati',
        province: 'Metro Manila',
        postalCode: '1226'
      },
      items: [
        { sku: 'GH-CCTV-001', quantity: 'two' } // invalid quantity type
      ],
      preferredStart: '2026-11-12T09:00:00+08:00',
      preferredEnd: '2026-11-12T11:00:00+08:00'
    };

    const parsed = CreateInstallationRequestSchema.safeParse(invalidPayload);
    expect(parsed.success).toBe(false);
  });

  it('TC-19 & TC-32: OP-10 payload accepts technician tags and rejects store tags or extra fields', () => {
    const validFeedback = {
      rating: 5,
      comment: 'Arrived promptly and did very clean cabling work',
      technicianTags: ['on_time', 'clean_work', 'professional'],
      customerFirstName: 'Juan',
      submittedAt: '2026-11-12T14:30:00+08:00'
    };

    const parsed = TechnicianFeedbackRequestSchema.safeParse(validFeedback);
    expect(parsed.success).toBe(true);

    // Reject store tag in technician tags
    const invalidTagFeedback = {
      ...validFeedback,
      technicianTags: ['product_quality'] // store tag!
    };
    const parsedInvalidTag = TechnicianFeedbackRequestSchema.safeParse(invalidTagFeedback);
    expect(parsedInvalidTag.success).toBe(false);

    // Reject extra fields (unknown fields rejected under strict validation)
    const extraFieldFeedback = {
      ...validFeedback,
      storeComment: 'Store was great' // forbidden extra field
    };
    const parsedExtra = TechnicianFeedbackRequestSchema.safeParse(extraFieldFeedback);
    expect(parsedExtra.success).toBe(false);
  });

  it('TC-25: Rating bounds (1 to 5) strictly enforced', () => {
    const feedbackZero = {
      rating: 0,
      customerFirstName: 'Maria',
      submittedAt: '2026-11-12T14:30:00+08:00'
    };
    expect(TechnicianFeedbackRequestSchema.safeParse(feedbackZero).success).toBe(false);

    const feedbackSix = {
      rating: 6,
      customerFirstName: 'Maria',
      submittedAt: '2026-11-12T14:30:00+08:00'
    };
    expect(TechnicianFeedbackRequestSchema.safeParse(feedbackSix).success).toBe(false);
  });

  it('TC-31: Phone number format validation (+63 accepted, invalid country or lengths rejected)', () => {
    const validMobile = '+639171234567';
    const validLandline = '+6328123456';
    const invalidUK = '+449171234567';
    const tooShort = '+63123';

    const testPayload = (phone: string) => ({
      orderNumber: 'GH-20261110-000001',
      customerName: 'Juan Dela Cruz',
      customerPhone: phone,
      customerEmail: 'juan@example.com',
      address: {
        line1: '123 Ayala Ave',
        city: 'Makati',
        province: 'Metro Manila',
        postalCode: '1226'
      },
      items: [{ sku: 'GH-CCTV-001', quantity: 1 }],
      preferredStart: '2026-11-12T09:00:00+08:00',
      preferredEnd: '2026-11-12T11:00:00+08:00'
    });

    expect(CreateInstallationRequestSchema.safeParse(testPayload(validMobile)).success).toBe(true);
    expect(CreateInstallationRequestSchema.safeParse(testPayload(validLandline)).success).toBe(true);
    expect(CreateInstallationRequestSchema.safeParse(testPayload(invalidUK)).success).toBe(false);
    expect(CreateInstallationRequestSchema.safeParse(testPayload(tooShort)).success).toBe(false);
  });

  it('TC-02: Completion payload format and job statuses', () => {
    const validCompletion = {
      orderNumber: 'GH-20261110-000001',
      jobNumber: 'JOB-20261110-000001',
      completedAt: '2026-11-12T12:00:00+08:00',
      result: 'success',
      installedUnits: [
        { sku: 'GH-CCTV-001', serialNumber: 'SN-CAM-99881' }
      ],
      notes: 'Job completed smoothly.'
    };

    expect(CompletionWebhookRequestSchema.safeParse(validCompletion).success).toBe(true);
    expect(JobStatusSchema.safeParse('Completed').success).toBe(true);
    expect(JobStatusSchema.safeParse('Pending Scheduling').success).toBe(true);
    expect(JobStatusSchema.safeParse('InvalidStatus').success).toBe(false);
  });

  it('TC-15: Notes >2000 chars, timestamp without offset, and unknown job status are rejected (CL-01, CL-02, CL-03)', () => {
    // Notes field capped at 2000 characters in CompletionWebhookRequestSchema
    const tooLongNotes = 'a'.repeat(2001);
    const longNotesPayload = {
      orderNumber: 'GH-20261110-000001',
      jobNumber: 'JOB-20261110-000001',
      completedAt: '2026-11-12T12:00:00+08:00',
      result: 'success',
      installedUnits: [],
      notes: tooLongNotes
    };
    expect(CompletionWebhookRequestSchema.safeParse(longNotesPayload).success).toBe(false);

    // Timestamp without UTC offset (plain ISO 8601 without +HH:MM or Z) is rejected (CL-03)
    const noOffsetPayload = {
      orderNumber: 'GH-20261110-000001',
      jobNumber: 'JOB-20261110-000001',
      completedAt: '2026-11-12T12:00:00', // missing offset!
      result: 'success',
      installedUnits: []
    };
    expect(CompletionWebhookRequestSchema.safeParse(noOffsetPayload).success).toBe(false);

    // Unknown/bad job status is rejected (CL-04)
    expect(JobStatusSchema.safeParse('InProgress').success).toBe(false);
    expect(JobStatusSchema.safeParse('pending').success).toBe(false);
    expect(JobStatusSchema.safeParse('').success).toBe(false);

    // Script text in notes is stored inert (schema accepts it; application escapes on output)
    const scriptPayload = {
      orderNumber: 'GH-20261110-000001',
      jobNumber: 'JOB-20261110-000001',
      completedAt: '2026-11-12T12:00:00+08:00',
      result: 'success',
      installedUnits: [],
      notes: '<script>alert("xss")</script>'
    };
    // Schema accepts it (no HTML filtering at contract layer — that's the application layer's job)
    expect(CompletionWebhookRequestSchema.safeParse(scriptPayload).success).toBe(true);
  });
});
