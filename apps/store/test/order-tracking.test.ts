import { describe, it, expect, beforeEach } from "vitest";
import { OrdersService } from "../lib/services/orders-service";
import { stockLedger } from "../lib/ledger/stock-ledger";
import { outboxEngine } from "../lib/outbox/outbox-engine";
import { canViewOrder, customerOrder } from "../lib/order-access";
const input = {
  customerName: "Tracking Test",
  customerEmail: "tracking@example.com",
  customerPhone: "09171234567",
  address: {
    line1: "Test street",
    city: "Makati",
    province: "Metro Manila",
    postalCode: "1226",
  },
  items: [{ sku: "GH-CCTV-001", quantity: 1, unitPricePhp: "3850.00" }],
  include_installation: false,
};
beforeEach(() => stockLedger.seedInventory());
describe("Delivery tracking and order ownership", () => {
  it("tracks hardware delivery through all stages without installation dispatch", async () => {
    const service = new OrdersService();
    const before = outboxEngine.getOutboxRows().length;
    const { order } = await service.processCheckout(input, "tracking", "test");
    ["Packing order", "Ready for dispatch", "On the way", "Delivered"].forEach(
      (status, version) =>
        service.updateDelivery(
          order.orderNumber,
          {
            status: status as any,
            version,
            note: "Customer update",
            estimatedArrival: "2030-01-01T09:00:00+08:00",
          },
          "dispatcher",
        ),
    );
    expect(order.status).toBe("fulfilled");
    expect(order.deliveryHistory).toHaveLength(4);
    expect(outboxEngine.getOutboxRows()).toHaveLength(before);
    expect(order.installationStatus).toBeUndefined();
  });
  it("rejects stale updates, backward stages, skipping stages, and unpaid orders", async () => {
    const service = new OrdersService();
    const { order } = await service.processCheckout(input, "tracking2", "test");
    expect(() =>
      service.updateDelivery(
        order.orderNumber,
        { status: "Delivered", version: 0, note: "" },
        "staff",
      ),
    ).toThrow("one stage");
    service.updateDelivery(
      order.orderNumber,
      { status: "Packing order", version: 0, note: "" },
      "staff",
    );
    expect(() =>
      service.updateDelivery(
        order.orderNumber,
        { status: "Packing order", version: 0, note: "" },
        "staff",
      ),
    ).toThrow("Another staff");
    expect(() =>
      service.updateDelivery(
        order.orderNumber,
        { status: "Order received", version: 1, note: "" },
        "staff",
      ),
    ).toThrow("one stage");
    order.status = "pending_payment";
    expect(() =>
      service.updateDelivery(
        order.orderNumber,
        { status: "Ready for dispatch", version: 1, note: "" },
        "staff",
      ),
    ).toThrow("Only paid");
  });
  it("restricts orders by account and strips internal staff identities from tracking", async () => {
    const service = new OrdersService();
    const { order } = await service.processCheckout(input, "tracking3", "test");
    const user = {
      userId: "owner",
      email: input.customerEmail,
      role: "customer" as const,
      fullName: "Owner",
    };
    expect(canViewOrder(null, order)).toBe(false);
    expect(canViewOrder(user, order)).toBe(true);
    expect(canViewOrder({ ...user, email: "other@example.com" }, order)).toBe(
      false,
    );
    order.ownerId = "owner";
    expect(canViewOrder({ ...user, userId: "other" }, order)).toBe(false);
    service.updateDelivery(
      order.orderNumber,
      { status: "Packing order", version: 0, note: "" },
      "internal-staff",
    );
    expect(JSON.stringify(customerOrder(order))).not.toContain(
      "internal-staff",
    );
  });
  it("replays checkout without duplicate stock deduction or orders", async () => {
    const service = new OrdersService();
    const first = await service.processCheckout(input, "retry", "test");
    const stock = stockLedger.getStock("GH-CCTV-001");
    const second = await service.processCheckout(input, "retry", "test");
    expect(first.order.orderNumber).toBe(second.order.orderNumber);
    expect(service.listOrders()).toHaveLength(1);
    expect(stockLedger.getStock("GH-CCTV-001")).toEqual(stock);
    await expect(
      service.processCheckout(
        { ...input, customerName: "Changed" },
        "retry",
        "test",
      ),
    ).rejects.toThrow("different order");
  });
  it("clears stale technician and schedule information after unclaim", async () => {
    const service = new OrdersService();
    const { order } = await service.processCheckout(input, "tracking4", "test");
    service.updateInstallationSchedule(
      order.orderNumber,
      "Arnel",
      "2030-01-01T09:00:00Z",
      "2030-01-01T11:00:00Z",
      "Scheduled",
    );
    service.updateStatusChange(
      order.orderNumber,
      "Pending Scheduling",
      new Date().toISOString(),
    );
    expect(order.technicianName).toBeUndefined();
    expect(order.scheduledStart).toBeUndefined();
  });
});
