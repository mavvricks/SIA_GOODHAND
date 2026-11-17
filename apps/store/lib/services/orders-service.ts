import { attachPersistence } from "../../../../packages/local-db/index.mjs";
import crypto from "node:crypto";
import { stockLedger } from "../ledger/stock-ledger";
import { outboxEngine } from "../outbox/outbox-engine";
import { normalizePhilippinePhone } from "../phone";
import { logger } from "@prototype/logger";

export interface CheckoutPayload {
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
  items: Array<{
    sku: string;
    quantity: number;
    unitPricePhp: string;
  }>;
  includeInstallation?: boolean;
  include_installation?: boolean;
  preferredStart?: string;
  preferredEnd?: string;
  specialInstructions?: string;
  paymentMethod?: PaymentMethod;
}

export const paymentMethods = ["cash", "qrph", "gcash", "card"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  qrph: "QRPH",
  gcash: "GCash",
  card: "Card",
};

export const deliveryStatuses = [
  "Order received",
  "Packing order",
  "Ready for dispatch",
  "On the way",
  "Delivered",
] as const;
export interface DeliveryUpdate {
  status: (typeof deliveryStatuses)[number];
  estimatedArrival?: string;
  note: string;
  at: string;
  actor: string;
}
export interface StoredOrder {
  ownerId?: string;
  delivery?: DeliveryUpdate;
  deliveryHistory?: DeliveryUpdate[];
  deliveryVersion?: number;
  orderNumber: string;
  status: "pending_payment" | "paid" | "fulfilled" | "cancelled";
  totalPhp: string;
  paymentMethod?: PaymentMethod;
  includeInstallation: boolean;
  rescheduleCount?: number;
  customerRequestKeys?: string[];
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  address: CheckoutPayload["address"];
  items: CheckoutPayload["items"];
  preferredStart?: string;
  preferredEnd?: string;
  specialInstructions?: string;
  installationStatus?: string;
  technicianName?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  createdAt: string;
}

export class OrdersService {
  private orders: Map<string, StoredOrder> = new Map();
  private orderCounter = 1;
  private checkoutResults: Record<
    string,
    { hash: string; orderNumber: string; outboxId?: string }
  > = {};

  public listOrders() {
    return Array.from(this.orders.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  }

  public updateDelivery(
    orderNumber: string,
    input: {
      status: (typeof deliveryStatuses)[number];
      estimatedArrival?: string;
      note: string;
      version: number;
    },
    actor: string,
  ) {
    const order = this.getOrder(orderNumber);
    if (!order)
      throw Object.assign(new Error("Order not found"), {
        category: "NOT_FOUND",
      });
    if (order.status === "pending_payment" || order.status === "cancelled")
      throw Object.assign(new Error("Only paid orders can be dispatched."), {
        category: "BUSINESS_RULE_VIOLATED",
      });
    if ((order.deliveryVersion || 0) !== input.version)
      throw Object.assign(
        new Error(
          "Another staff member updated this order. Refresh before saving.",
        ),
        { category: "CONFLICT" },
      );
    const previous = deliveryStatuses.indexOf(
      order.delivery?.status || "Order received",
    );
    const next = deliveryStatuses.indexOf(input.status);
    if (next < previous || next > previous + 1)
      throw Object.assign(
        new Error("Move delivery forward one stage at a time."),
        { category: "BUSINESS_RULE_VIOLATED" },
      );
    const update: DeliveryUpdate = {
      status: input.status,
      estimatedArrival: input.estimatedArrival,
      note: input.note,
      actor,
      at: new Date().toISOString(),
    };
    order.delivery = update;
    order.deliveryHistory = [...(order.deliveryHistory || []), update];
    order.deliveryVersion = input.version + 1;
    if (!order.includeInstallation && input.status === "Delivered")
      order.status = "fulfilled";
    return order;
  }

  public async processCheckout(
    payload: CheckoutPayload,
    idempotencyKey: string,
    correlationId: string,
    simulatePaymentFailure: boolean = false,
  ): Promise<{ order: StoredOrder; outboxId?: string }> {
    if (
      payload.paymentMethod !== undefined &&
      !paymentMethods.includes(payload.paymentMethod)
    )
      throw Object.assign(new Error("Choose a valid payment method"), {
        category: "VALIDATION_FAILED",
      });
    const paymentMethod = payload.paymentMethod ?? "card";
    for (const flag of [
      payload.include_installation,
      payload.includeInstallation,
    ]) {
      if (flag !== undefined && typeof flag !== "boolean")
        throw Object.assign(
          new Error("include_installation must be a boolean"),
          { category: "VALIDATION_FAILED" },
        );
    }
    if (
      payload.include_installation !== undefined &&
      payload.includeInstallation !== undefined &&
      payload.include_installation !== payload.includeInstallation
    )
      throw Object.assign(new Error("Installation flags must agree"), {
        category: "VALIDATION_FAILED",
      });
    const includeInstallation =
      payload.include_installation ?? payload.includeInstallation ?? true;
    this.checkoutResults ||= {};
    const hash = crypto
      .createHash("sha256")
      .update(JSON.stringify({ payload, simulatePaymentFailure }))
      .digest("hex");
    const previous = this.checkoutResults[idempotencyKey];
    if (previous) {
      if (previous.hash !== hash)
        throw Object.assign(
          new Error("Checkout key was already used for a different order."),
          { category: "IDEMPOTENCY_KEY_CONFLICT" },
        );
      return {
        order: this.orders.get(previous.orderNumber)!,
        outboxId: previous.outboxId,
      };
    }
    // 1. Phone number normalization (D16, TC-31)
    const normalizedPhone = normalizePhilippinePhone(payload.customerPhone);

    // 2. Window validation for installations (at least 24h ahead)
    if (includeInstallation) {
      if (!payload.preferredStart || !payload.preferredEnd) {
        const err: any = new Error("Preferred installation window is required");
        err.category = "VALIDATION_FAILED";
        throw err;
      }
      const start = new Date(payload.preferredStart).getTime();
      const end = new Date(payload.preferredEnd).getTime();
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        const err: any = new Error(
          "Preferred end time must be after start time",
        );
        err.category = "VALIDATION_FAILED";
        throw err;
      }
    }

    // 3. Stock availability verification (W-01 step 2)
    for (const item of payload.items) {
      const isAvailable = stockLedger.checkAvailability(
        item.sku,
        item.quantity,
      );
      if (!isAvailable) {
        const err: any = new Error(`Insufficient stock for item ${item.sku}`);
        err.category = "INSUFFICIENT_STOCK";
        throw err;
      }
    }

    // 4. Generate unique Order Number: GH-YYYYMMDD-NNNNNN
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const seqStr = String(this.orderCounter++).padStart(6, "0");
    const orderNumber = `GH-${todayStr}-${seqStr}`;

    // 5. Payment simulation (D5)
    if (simulatePaymentFailure) {
      const failedOrder: StoredOrder = {
        orderNumber,
        status: "pending_payment",
        totalPhp: this.calculateTotal(payload.items),
        paymentMethod,
        includeInstallation,
        customerName: payload.customerName,
        customerPhone: normalizedPhone,
        customerEmail: payload.customerEmail,
        address: payload.address,
        items: payload.items,
        preferredStart: includeInstallation
          ? payload.preferredStart
          : undefined,
        preferredEnd: includeInstallation ? payload.preferredEnd : undefined,
        specialInstructions: payload.specialInstructions,
        createdAt: new Date().toISOString(),
      };
      this.orders.set(orderNumber, failedOrder);
      this.checkoutResults[idempotencyKey] = { hash, orderNumber };
      return { order: failedOrder };
    }

    // 6. Apply stock mutations in ledger
    for (const item of payload.items) {
      const txId = crypto.randomUUID();
      const reason = includeInstallation ? "reservation" : "direct_sale";
      stockLedger.applyMovement(
        txId,
        item.sku,
        reason,
        item.quantity,
        orderNumber,
      );
    }

    // 7. Persist Order
    const newOrder: StoredOrder = {
      orderNumber,
      status: "paid",
      totalPhp: this.calculateTotal(payload.items),
      paymentMethod,
      includeInstallation,
      customerName: payload.customerName,
      customerPhone: normalizedPhone,
      customerEmail: payload.customerEmail,
      address: payload.address,
      items: payload.items,
      preferredStart: includeInstallation ? payload.preferredStart : undefined,
      preferredEnd: includeInstallation ? payload.preferredEnd : undefined,
      specialInstructions: payload.specialInstructions,
      installationStatus: includeInstallation
        ? "Pending Scheduling"
        : undefined,
      createdAt: new Date().toISOString(),
    };
    this.orders.set(orderNumber, newOrder);

    // 8. Enqueue OP-01 to outbox if installation is included (OBJ-01, W-01 step 5)
    let outboxId: string | undefined;
    if (includeInstallation) {
      const op01Payload = {
        orderNumber,
        customerName: payload.customerName,
        customerPhone: normalizedPhone,
        customerEmail: payload.customerEmail,
        address: payload.address,
        items: payload.items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
        preferredStart: payload.preferredStart,
        preferredEnd: payload.preferredEnd,
        specialInstructions: payload.specialInstructions,
      };

      const outboxRow = outboxEngine.enqueueInstallation(
        op01Payload,
        idempotencyKey,
        correlationId,
        includeInstallation,
      );
      outboxId = outboxRow?.id;

      logger.info(
        { correlationId, orderNumber, outboxId },
        "Order created with installation; OP-01 enqueued to outbox",
      );
    }

    this.checkoutResults[idempotencyKey] = { hash, orderNumber, outboxId };
    return { order: newOrder, outboxId };
  }

  public getOrder(orderNumber: string): StoredOrder | undefined {
    return this.orders.get(orderNumber);
  }

  // Updates installation details upon OP-05 webhook receipt
  public updateInstallationSchedule(
    orderNumber: string,
    technicianName: string,
    scheduledStart: string,
    scheduledEnd: string,
    status: string,
  ) {
    const order = this.orders.get(orderNumber);
    if (order) {
      order.technicianName = technicianName;
      order.scheduledStart = scheduledStart;
      order.scheduledEnd = scheduledEnd;
      order.installationStatus = status;
    }
  }

  // W-03: Process OP-06 Status Change Webhook
  public updateStatusChange(
    orderNumber: string,
    status: string,
    timestamp: string,
  ) {
    const order = this.orders.get(orderNumber);
    if (order) {
      if (
        status === "Cancelled" &&
        order.includeInstallation &&
        order.installationStatus !== "Cancelled"
      ) {
        for (const item of order.items)
          stockLedger.applyMovement(
            `installation-cancelled:${orderNumber}:${item.sku}`,
            item.sku,
            "installation_cancelled_sale",
            item.quantity,
            orderNumber,
          );
      }
      order.installationStatus = status;
      if (
        ["Pending Scheduling", "Reschedule Required", "Cancelled"].includes(
          status,
        )
      ) {
        order.technicianName = undefined;
        order.scheduledStart = undefined;
        order.scheduledEnd = undefined;
      }
    }
  }

  // W-03 & CL-13: Process OP-07 Completion Webhook (Order Fulfilled & Warranty Activation)
  public processCompletionReport(
    payload: {
      orderNumber: string;
      jobNumber: string;
      completedAt: string;
      result: string;
      installedUnits: Array<{ sku: string; serialNumber: string }>;
      notes?: string;
    },
    correlationId: string,
  ): {
    success: boolean;
    activatedWarrantiesCount: number;
    feedbackInvitationDueAt: string;
  } {
    const order = this.orders.get(payload.orderNumber);
    if (!order) {
      const err: any = new Error(`Order ${payload.orderNumber} not found`);
      err.category = "NOT_FOUND";
      throw err;
    }

    // Set order fulfilled and job completed
    order.status = "fulfilled";
    order.installationStatus = "Completed";

    // Calculate warranty duration (default 12 months)
    const startDate = new Date(payload.completedAt);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 12);

    // Schedule feedback invitation (1 hour normal, 1 minute in demo mode - D13)
    const isDemo = process.env.DEMO_MODE === "true";
    const inviteDueMs = isDemo ? 60 * 1000 : 3600 * 1000;
    const inviteDueAt = new Date(Date.now() + inviteDueMs).toISOString();

    logger.info(
      {
        correlationId,
        orderNumber: payload.orderNumber,
        unitsCount: payload.installedUnits.length,
        inviteDueAt,
      },
      "OP-07 processed: order fulfilled, warranty activated, feedback invitation scheduled",
    );

    return {
      success: true,
      activatedWarrantiesCount: payload.installedUnits.length,
      feedbackInvitationDueAt: inviteDueAt,
    };
  }

  // W-03 & CL-12: Process OP-08 Inventory Adjustment Webhook
  public processInventoryAdjustment(
    payload: {
      transactionId: string;
      orderNumber: string;
      jobNumber: string;
      sku: string;
      type: "used" | "returned_unused" | "replacement_used";
      quantity: number;
    },
    correlationId: string,
  ) {
    const reasonMap: Record<
      string,
      "install_use" | "reservation_release" | "replacement_use"
    > = {
      used: "install_use",
      returned_unused: "reservation_release",
      replacement_used: "replacement_use",
    };

    const reason = reasonMap[payload.type];
    if (!reason) {
      const err: any = new Error(`Invalid adjustment type ${payload.type}`);
      err.category = "VALIDATION_FAILED";
      throw err;
    }

    // Applies ledger transition with mathematical invariant enforcement (TC-04, TC-09, TC-30)
    const movement = stockLedger.applyMovement(
      payload.transactionId,
      payload.sku,
      reason,
      payload.quantity,
      payload.orderNumber,
      payload.jobNumber,
    );

    logger.info(
      {
        correlationId,
        transactionId: payload.transactionId,
        sku: payload.sku,
        reason,
        quantity: payload.quantity,
      },
      "OP-08 ledger movement applied",
    );

    return movement;
  }

  private calculateTotal(items: CheckoutPayload["items"]): string {
    const total = items.reduce((sum, item) => {
      return sum + parseFloat(item.unitPricePhp) * item.quantity;
    }, 0);
    return total.toFixed(2);
  }
}

export const ordersService = attachPersistence(
  new OrdersService(),
  "store",
  "orders",
) as OrdersService;
