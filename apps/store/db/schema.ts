import { pgTable, uuid, text, timestamp, integer, boolean, numeric, jsonb, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['customer', 'store_admin'] }).notNull().default('customer'),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  failedLoginCount: integer('failed_login_count').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
});

export const addresses = pgTable('addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  line1: text('line1').notNull(),
  line2: text('line2'),
  city: text('city').notNull(),
  province: text('province').notNull(),
  postalCode: text('postal_code').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  category: text('category', { enum: ['cctv', 'radios', 'locks', 'alarms', 'fence', 'network', 'storage'] }).notNull(),
  brand: text('brand').notNull().default('GoodHand'),
  pricePhp: numeric('price_php', { precision: 12, scale: 2 }).notNull(),
  requiresInstallation: boolean('requires_installation').notNull().default(false),
  warrantyMonths: integer('warranty_months').notNull().default(12),
  imagePath: text('image_path').notNull(),
  description: text('description').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true })
});

export const inventory = pgTable('inventory', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id).notNull().unique(),
  onHand: integer('on_hand').notNull().default(0),
  reserved: integer('reserved').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check('check_on_hand_non_negative', sql`${table.onHand} >= 0`),
  check('check_reserved_non_negative', sql`${table.reserved} >= 0`),
  check('check_reserved_lte_on_hand', sql`${table.reserved} <= ${table.onHand}`)
]);

export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  onHandDelta: integer('on_hand_delta').notNull(),
  reservedDelta: integer('reserved_delta').notNull(),
  reason: text('reason', {
    enum: [
      'reservation',
      'reservation_release',
      'install_use',
      'replacement_use',
      'direct_sale',
      'manual_adjustment'
    ]
  }).notNull(),
  orderId: uuid('order_id'),
  jobNumber: text('job_number'),
  transactionId: uuid('transaction_id').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderNumber: text('order_number').notNull().unique(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  status: text('status', { enum: ['pending_payment', 'paid', 'fulfilled', 'cancelled'] }).notNull().default('pending_payment'),
  totalPhp: numeric('total_php', { precision: 12, scale: 2 }).notNull(),
  includeInstallation: boolean('include_installation').notNull().default(false),
  installationAddressId: uuid('installation_address_id').references(() => addresses.id),
  contactName: text('contact_name').notNull(),
  contactPhone: text('contact_phone').notNull(),
  contactEmail: text('contact_email').notNull(),
  preferredStart: timestamp('preferred_start', { withTimezone: true }),
  preferredEnd: timestamp('preferred_end', { withTimezone: true }),
  specialInstructions: text('special_instructions'),
  cancelledBy: text('cancelled_by'),
  cancelReason: text('cancel_reason'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  quantity: integer('quantity').notNull(),
  unitPricePhp: numeric('unit_price_php', { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  amountPhp: numeric('amount_php', { precision: 12, scale: 2 }).notNull(),
  status: text('status', { enum: ['pending', 'paid', 'failed', 'refund_pending', 'refunded'] }).notNull(),
  method: text('method').notNull().default('simulated'),
  reference: text('reference').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const installationRequests = pgTable('installation_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id).notNull().unique(),
  jobNumber: text('job_number'),
  jobStatus: text('job_status', {
    enum: [
      'Pending Scheduling',
      'Scheduled',
      'In Progress',
      'Completed',
      'Cancelled',
      'Reschedule Required'
    ]
  }).notNull().default('Pending Scheduling'),
  technicianName: text('technician_name'),
  scheduledStart: timestamp('scheduled_start', { withTimezone: true }),
  scheduledEnd: timestamp('scheduled_end', { withTimezone: true }),
  rescheduleCount: integer('reschedule_count').notNull().default(0),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const installedUnits = pgTable('installed_units', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id).notNull(),
  jobNumber: text('job_number').notNull(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  serialNumber: text('serial_number').notNull(),
  installedAt: timestamp('installed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const warranties = pgTable('warranties', {
  id: uuid('id').defaultRandom().primaryKey(),
  installedUnitId: uuid('installed_unit_id').references(() => installedUnits.id).notNull().unique(),
  startsOn: timestamp('starts_on', { withTimezone: true }).notNull(),
  endsOn: timestamp('ends_on', { withTimezone: true }).notNull(),
  status: text('status', { enum: ['active', 'expired', 'void'] }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const feedback = pgTable('feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id').references(() => orders.id).notNull().unique(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  jobNumber: text('job_number'),
  technicianRating: integer('technician_rating'),
  technicianComment: text('technician_comment'),
  technicianTags: text('technician_tags').array(),
  storeRating: integer('store_rating'),
  storeComment: text('store_comment'),
  storeTags: text('store_tags').array(),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp('locked_at', { withTimezone: true }),
  hidden: boolean('hidden').notNull().default(false),
  hiddenReason: text('hidden_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [
  check('check_feedback_has_rating', sql`${table.technicianRating} IS NOT NULL OR ${table.storeRating} IS NOT NULL`)
]);

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
