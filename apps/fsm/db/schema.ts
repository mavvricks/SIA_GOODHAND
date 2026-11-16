import { pgTable, uuid, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['dispatcher', 'technician', 'admin'] }).notNull(),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  active: boolean('active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const technicians = pgTable('technicians', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  employeeCode: text('employee_code').notNull().unique(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const serviceAreas = pgTable('service_areas', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull().unique(),
  cities: text('cities').array().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const technicianServiceAreas = pgTable('technician_service_areas', {
  id: uuid('id').defaultRandom().primaryKey(),
  technicianId: uuid('technician_id').references(() => technicians.id).notNull(),
  serviceAreaId: uuid('service_area_id').references(() => serviceAreas.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const qualifications = pgTable('qualifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code', {
    enum: ['CCTV', 'SMART_LOCK', 'ACCESS_CONTROL', 'ALARM', 'ELECTRIC_FENCE', 'RADIO']
  }).notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const technicianQualifications = pgTable('technician_qualifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  technicianId: uuid('technician_id').references(() => technicians.id).notNull(),
  qualificationId: uuid('qualification_id').references(() => qualifications.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const catalogProducts = pgTable('catalog_products', {
  id: uuid('id').defaultRandom().primaryKey(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  requiredQualificationId: uuid('required_qualification_id').references(() => qualifications.id),
  syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow()
});

export const jobs = pgTable('jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobNumber: text('job_number').notNull().unique(),
  orderNumber: text('order_number').notNull().unique(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerEmail: text('customer_email').notNull(),
  address: jsonb('address').notNull(),
  serviceAreaId: uuid('service_area_id').references(() => serviceAreas.id),
  status: text('status', {
    enum: [
      'Pending Scheduling',
      'Scheduled',
      'In Progress',
      'Completed',
      'Cancelled',
      'Reschedule Required'
    ]
  }).notNull().default('Pending Scheduling'),
  preferredStart: timestamp('preferred_start', { withTimezone: true }).notNull(),
  preferredEnd: timestamp('preferred_end', { withTimezone: true }).notNull(),
  specialInstructions: text('special_instructions'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const jobItems = pgTable('job_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').references(() => jobs.id).notNull(),
  sku: text('sku').notNull(),
  quantity: integer('quantity').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const jobItemLoading = pgTable('job_item_loading', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobItemId: uuid('job_item_id').references(() => jobItems.id).notNull().unique(),
  loadedQuantity: integer('loaded_quantity').notNull().default(0),
  confirmedBy: uuid('confirmed_by').references(() => technicians.id),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const appointments = pgTable('appointments', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').references(() => jobs.id).notNull(),
  technicianId: uuid('technician_id').references(() => technicians.id).notNull(),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  status: text('status', { enum: ['active', 'released'] }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const completionReports = pgTable('completion_reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').references(() => jobs.id).notNull().unique(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  result: text('result', { enum: ['success', 'partial', 'failed'] }).notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const installedUnits = pgTable('installed_units', {
  id: uuid('id').defaultRandom().primaryKey(),
  completionReportId: uuid('completion_report_id').references(() => completionReports.id).notNull(),
  sku: text('sku').notNull(),
  serialNumber: text('serial_number').notNull(),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const partsAdjustments = pgTable('parts_adjustments', {
  id: uuid('id').defaultRandom().primaryKey(),
  completionReportId: uuid('completion_report_id').references(() => completionReports.id).notNull(),
  sku: text('sku').notNull(),
  quantity: integer('quantity').notNull(),
  type: text('type', { enum: ['used', 'returned_unused', 'replacement_used'] }).notNull(),
  transactionId: uuid('transaction_id').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const technicianFeedback = pgTable('technician_feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').references(() => jobs.id).notNull().unique(),
  technicianId: uuid('technician_id').references(() => technicians.id).notNull(),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  tags: text('tags').array(),
  customerFirstName: text('customer_first_name').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  flaggedForReview: boolean('flagged_for_review').notNull().default(false),
  sourceIdempotencyKey: text('source_idempotency_key').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const serviceClients = pgTable('service_clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  clientId: text('client_id').notNull().unique(),
  secretHash: text('secret_hash').notNull(),
  scopes: text('scopes').array().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const outboxMessages = pgTable('outbox_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  operationId: text('operation_id').notNull(),
  payload: jsonb('payload').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  correlationId: text('correlation_id').notNull(),
  status: text('status', { enum: ['pending', 'delivered', 'failed'] }).notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
  lastErrorCategory: text('last_error_category'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const processedMessages = pgTable('processed_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  operationId: text('operation_id').notNull(),
  requestHash: text('request_hash').notNull(),
  responseStatus: integer('response_status').notNull(),
  responseBody: jsonb('response_body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const failedMessages = pgTable('failed_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  outboxMessageId: uuid('outbox_message_id').references(() => outboxMessages.id).notNull(),
  finalError: text('final_error').notNull(),
  failedAt: timestamp('failed_at', { withTimezone: true }).notNull().defaultNow(),
  replayedAt: timestamp('replayed_at', { withTimezone: true }),
  discardedReason: text('discarded_reason'),
  purgeAfter: timestamp('purge_after', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorId: text('actor_id').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  correlationId: text('correlation_id').notNull(),
  outcome: text('outcome', { enum: ['success', 'failure'] }).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const circuitState = pgTable('circuit_state', {
  id: uuid('id').defaultRandom().primaryKey(),
  target: text('target').notNull().unique(),
  state: text('state', { enum: ['closed', 'open', 'half_open'] }).notNull().default('closed'),
  failures: integer('failures').notNull().default(0),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const simulationFlags = pgTable('simulation_flags', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const mailLog = pgTable('mail_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  to: text('to').notNull(),
  subject: text('subject').notNull(),
  bodyHtml: text('body_html').notNull(),
  sentVia: text('sent_via').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
