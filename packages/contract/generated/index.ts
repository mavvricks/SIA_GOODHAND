import { z } from 'zod';

export const JobStatusSchema = z.enum([
  'Pending Scheduling',
  'Scheduled',
  'In Progress',
  'Completed',
  'Cancelled',
  'Reschedule Required'
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const TechnicianTagSchema = z.enum([
  'on_time',
  'late',
  'professional',
  'unprofessional',
  'clean_work',
  'messy_work',
  'explained_clearly'
]);
export type TechnicianTag = z.infer<typeof TechnicianTagSchema>;

export const StoreTagSchema = z.enum([
  'product_quality',
  'product_issue',
  'easy_checkout',
  'checkout_problem',
  'good_communication',
  'poor_communication'
]);
export type StoreTag = z.infer<typeof StoreTagSchema>;

export const AddressSchema = z.object({
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  province: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(10)
}).strict();
export type Address = z.infer<typeof AddressSchema>;

export const OrderItemPayloadSchema = z.object({
  sku: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(99)
}).strict();
export type OrderItemPayload = z.infer<typeof OrderItemPayloadSchema>;

export const CreateInstallationRequestSchema = z.object({
  orderNumber: z.string().regex(/^GH-[0-9]{8}-[0-9]{6}$/, 'Invalid order number format (GH-YYYYMMDD-NNNNNN)'),
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().regex(/^\+63[0-9]{8,10}$/, 'Phone must be RFC +63 followed by 8 to 10 digits'),
  customerEmail: z.string().email().max(254),
  address: AddressSchema,
  items: z.array(OrderItemPayloadSchema).min(1),
  preferredStart: z.string().datetime({ offset: true }),
  preferredEnd: z.string().datetime({ offset: true }),
  specialInstructions: z.string().max(500).optional()
}).strict();
export type CreateInstallationRequest = z.infer<typeof CreateInstallationRequestSchema>;

export const InstallationJobResponseSchema = z.object({
  jobNumber: z.string().regex(/^JOB-[0-9]{8}-[0-9]{6}$/, 'Invalid job number format'),
  orderNumber: z.string(),
  status: JobStatusSchema,
  technicianName: z.string().optional(),
  scheduledStart: z.string().datetime({ offset: true }).optional(),
  scheduledEnd: z.string().datetime({ offset: true }).optional(),
  items: z.array(OrderItemPayloadSchema),
  createdAt: z.string().datetime({ offset: true })
}).strict();
export type InstallationJobResponse = z.infer<typeof InstallationJobResponseSchema>;

export const RescheduleRequestSchema = z.object({
  requestedStart: z.string().datetime({ offset: true }),
  requestedEnd: z.string().datetime({ offset: true }),
  reason: z.string().min(1).max(500)
}).strict();
export type RescheduleRequest = z.infer<typeof RescheduleRequestSchema>;

export const CancelInstallationRequestSchema = z.object({
  reason: z.string().min(1).max(500),
  cancelledBy: z.enum(['customer', 'store_admin', 'dispatcher', 'admin'])
}).strict();
export type CancelInstallationRequest = z.infer<typeof CancelInstallationRequestSchema>;

export const ScheduleConfirmationWebhookRequestSchema = z.object({
  jobNumber: z.string(),
  orderNumber: z.string(),
  technicianName: z.string().min(1).max(120),
  scheduledStart: z.string().datetime({ offset: true }),
  scheduledEnd: z.string().datetime({ offset: true }),
  status: JobStatusSchema
}).strict();
export type ScheduleConfirmationWebhookRequest = z.infer<typeof ScheduleConfirmationWebhookRequestSchema>;

export const StatusChangeWebhookRequestSchema = z.object({
  jobNumber: z.string(),
  orderNumber: z.string(),
  status: JobStatusSchema,
  timestamp: z.string().datetime({ offset: true }),
  reason: z.string().max(500).optional()
}).strict();
export type StatusChangeWebhookRequest = z.infer<typeof StatusChangeWebhookRequestSchema>;

export const InstalledUnitPayloadSchema = z.object({
  sku: z.string().min(1).max(64),
  serialNumber: z.string().min(1).max(64)
}).strict();
export type InstalledUnitPayload = z.infer<typeof InstalledUnitPayloadSchema>;

export const CompletionWebhookRequestSchema = z.object({
  orderNumber: z.string(),
  jobNumber: z.string(),
  completedAt: z.string().datetime({ offset: true }),
  result: z.enum(['success', 'partial', 'failed']),
  installedUnits: z.array(InstalledUnitPayloadSchema),
  notes: z.string().max(2000).optional()
}).strict();
export type CompletionWebhookRequest = z.infer<typeof CompletionWebhookRequestSchema>;

export const InventoryAdjustmentWebhookRequestSchema = z.object({
  transactionId: z.string().uuid(),
  orderNumber: z.string(),
  jobNumber: z.string(),
  sku: z.string().min(1).max(64),
  type: z.enum(['used', 'returned_unused', 'replacement_used']),
  quantity: z.number().int().min(1).max(99)
}).strict();
export type InventoryAdjustmentWebhookRequest = z.infer<typeof InventoryAdjustmentWebhookRequestSchema>;

export const CatalogProductSchema = z.object({
  sku: z.string(),
  name: z.string(),
  category: z.string(),
  brand: z.string().optional(),
  pricePhp: z.string().regex(/^[0-9]+\.[0-9]{2}$/),
  requiresInstallation: z.boolean(),
  warrantyMonths: z.number().int()
}).strict();
export type CatalogProduct = z.infer<typeof CatalogProductSchema>;

export const CatalogResponseSchema = z.object({
  products: z.array(CatalogProductSchema),
  syncedAt: z.string().datetime({ offset: true })
}).strict();
export type CatalogResponse = z.infer<typeof CatalogResponseSchema>;

export const TechnicianFeedbackRequestSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
  technicianTags: z.array(TechnicianTagSchema).optional(),
  customerFirstName: z.string().min(1).max(60),
  submittedAt: z.string().datetime({ offset: true })
}).strict();
export type TechnicianFeedbackRequest = z.infer<typeof TechnicianFeedbackRequestSchema>;

export const StockAvailabilityItemSchema = z.object({
  sku: z.string(),
  onHand: z.number().int().min(0),
  reserved: z.number().int().min(0),
  available: z.number().int(),
  asOf: z.string().datetime({ offset: true })
}).strict();
export type StockAvailabilityItem = z.infer<typeof StockAvailabilityItemSchema>;

export const StockAvailabilityResponseSchema = z.object({
  items: z.array(StockAvailabilityItemSchema)
}).strict();
export type StockAvailabilityResponse = z.infer<typeof StockAvailabilityResponseSchema>;

export const StandardSuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional()
}).strict();
export type StandardSuccessResponse = z.infer<typeof StandardSuccessResponseSchema>;

export const ErrorCategorySchema = z.enum([
  'VALIDATION_FAILED',
  'AUTHENTICATION_REQUIRED',
  'FORBIDDEN_SCOPE',
  'NOT_FOUND',
  'DUPLICATE_RECORD',
  'IDEMPOTENCY_KEY_CONFLICT',
  'SCHEDULE_CONFLICT',
  'INSUFFICIENT_STOCK',
  'BUSINESS_RULE_VIOLATED',
  'UNEXPECTED_ERROR',
  'SERVICE_UNAVAILABLE',
  'RATE_LIMITED'
]);
export type ErrorCategory = z.infer<typeof ErrorCategorySchema>;

export const ErrorDetailSchema = z.object({
  category: ErrorCategorySchema,
  message: z.string(),
  field: z.string().optional(),
  referenceId: z.string(),
  correlationId: z.string().uuid()
}).strict();
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

export const StandardErrorPayloadSchema = z.object({
  error: ErrorDetailSchema
}).strict();
export type StandardErrorPayload = z.infer<typeof StandardErrorPayloadSchema>;
