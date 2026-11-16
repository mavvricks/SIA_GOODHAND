import { describe, it, expect, beforeEach } from "vitest";
import { stockLedger } from "../lib/ledger/stock-ledger";
import { outboxEngine } from "../lib/outbox/outbox-engine";
import { ordersService } from "../lib/services/orders-service";
import { normalizePhilippinePhone } from "../lib/phone";
import { jobsStore } from "../../fsm/lib/services/jobs-store";

describe("Phase 3 Acceptance: System A Store, Stock Ledger & Outbox (TC-06, TC-09, TC-13, TC-30, TC-31)", () => {
  beforeEach(() => {
    stockLedger.seedInventory();
  });

  const optionalInstallationCheckout = {
    customerName: "Hardware Customer",
    customerPhone: "09171234567",
    customerEmail: "hardware@example.com",
    address: {
      line1: "123 Test Street",
      city: "Makati",
      province: "Metro Manila",
      postalCode: "1226",
    },
    items: [{ sku: "GH-CCTV-001", quantity: 2, unitPricePhp: "3850.00" }],
  };

  it("hardware-only checkout creates an order, deducts stock, and creates zero outbox messages or FSM jobs", async () => {
    stockLedger.setStock("GH-CCTV-001", 10, 0);
    const messagesBefore = outboxEngine.getOutboxRows().length;
    const jobsBefore = jobsStore.listJobs().length;
    const { order, outboxId } = await ordersService.processCheckout(
      { ...optionalInstallationCheckout, include_installation: false },
      "hardware-only-key",
      "hardware-correlation",
    );
    expect(order.status).toBe("paid");
    expect(order.includeInstallation).toBe(false);
    expect(order.installationStatus).toBeUndefined();
    expect(order.preferredStart).toBeUndefined();
    expect(outboxId).toBeUndefined();
    expect(stockLedger.getStock("GH-CCTV-001")).toEqual({
      onHand: 8,
      reserved: 0,
      available: 8,
    });
    expect(outboxEngine.getOutboxRows()).toHaveLength(messagesBefore);
    expect(
      outboxEngine
        .getOutboxRows()
        .filter((row) => row.payload.orderNumber === order.orderNumber),
    ).toHaveLength(0);
    expect(jobsStore.listJobs()).toHaveLength(jobsBefore);
    expect(
      jobsStore
        .listJobs()
        .filter((job) => job.orderNumber === order.orderNumber),
    ).toHaveLength(0);
  });

  it.each([{}, { include_installation: true }, { includeInstallation: true }])(
    "keeps installation dispatch for omitted or explicit true flags: %j",
    async (flags) => {
      const { order, outboxId } = await ordersService.processCheckout(
        {
          ...optionalInstallationCheckout,
          ...flags,
          preferredStart: "2030-06-10T09:00:00+08:00",
          preferredEnd: "2030-06-10T11:00:00+08:00",
        },
        crypto.randomUUID(),
        "optional-install-compatibility",
      );
      expect(order.includeInstallation).toBe(true);
      expect(order.installationStatus).toBe("Pending Scheduling");
      expect(
        outboxEngine.getOutboxRows().find((row) => row.id === outboxId)
          ?.operationId,
      ).toBe("OP-01");
    },
  );

  it("rejects malformed and conflicting installation flags before any stock or outbox changes", async () => {
    const count = outboxEngine.getOutboxRows().length;
    await expect(
      ordersService.processCheckout(
        {
          ...optionalInstallationCheckout,
          include_installation: "false" as any,
        },
        "invalid-install-flag",
        "flag-validation",
      ),
    ).rejects.toMatchObject({ category: "VALIDATION_FAILED" });
    await expect(
      ordersService.processCheckout(
        {
          ...optionalInstallationCheckout,
          include_installation: false,
          includeInstallation: true,
        },
        "conflicting-install-flag",
        "flag-validation",
      ),
    ).rejects.toMatchObject({ category: "VALIDATION_FAILED" });
    expect(outboxEngine.getOutboxRows()).toHaveLength(count);
    expect(stockLedger.getStock("GH-CCTV-001")).toEqual({
      onHand: 50,
      reserved: 0,
      available: 50,
    });
  });

  it("TC-30: Stock Ledger mathematical invariants (10/0 -> 10/2 -> 10/0 -> 8/0 -> 7/0)", () => {
    const testSku = "GH-CCTV-001";
    // Initialize stock to 10 onHand, 0 reserved
    stockLedger.setStock(testSku, 10, 0);
    expect(stockLedger.getStock(testSku)).toEqual({
      onHand: 10,
      reserved: 0,
      available: 10,
    });

    // 1. Order 2 with installation -> reservation (+2 reserved) -> 10 onHand, 2 reserved, 8 available
    const tx1 = "tx-order-2-install";
    stockLedger.applyMovement(tx1, testSku, "reservation", 2, "GH-TEST-01");
    expect(stockLedger.getStock(testSku)).toEqual({
      onHand: 10,
      reserved: 2,
      available: 8,
    });

    // 2. Cancel order -> reservation_release (-2 reserved) -> 10 onHand, 0 reserved, 10 available
    const tx2 = "tx-cancel-2-install";
    stockLedger.applyMovement(
      tx2,
      testSku,
      "reservation_release",
      2,
      "GH-TEST-01",
    );
    expect(stockLedger.getStock(testSku)).toEqual({
      onHand: 10,
      reserved: 0,
      available: 10,
    });

    // 3. New order 3 with installation -> reservation (+3 reserved) -> 10 onHand, 3 reserved, 7 available
    const tx3 = "tx-order-3-install";
    stockLedger.applyMovement(tx3, testSku, "reservation", 3, "GH-TEST-02");
    expect(stockLedger.getStock(testSku)).toEqual({
      onHand: 10,
      reserved: 3,
      available: 7,
    });

    // 4. Job completed: 2 used (install_use: -2 onHand, -2 reserved), 1 returned unused (reservation_release: -1 reserved)
    // 2 used:
    const tx4Used = "tx-comp-2-used";
    stockLedger.applyMovement(
      tx4Used,
      testSku,
      "install_use",
      2,
      "GH-TEST-02",
      "JOB-TEST-02",
    );
    // State is now: onHand = 8, reserved = 1, available = 7
    expect(stockLedger.getStock(testSku)).toEqual({
      onHand: 8,
      reserved: 1,
      available: 7,
    });

    // 1 returned unused:
    const tx4Returned = "tx-comp-1-returned";
    stockLedger.applyMovement(
      tx4Returned,
      testSku,
      "reservation_release",
      1,
      "GH-TEST-02",
      "JOB-TEST-02",
    );
    // State is now: onHand = 8, reserved = 0, available = 8
    expect(stockLedger.getStock(testSku)).toEqual({
      onHand: 8,
      reserved: 0,
      available: 8,
    });

    // 5. Extra replacement 1 used on site (replacement_use: -1 onHand, 0 reserved) -> 7 onHand, 0 reserved
    const tx5Replacement = "tx-comp-replacement-1";
    stockLedger.applyMovement(
      tx5Replacement,
      testSku,
      "replacement_use",
      1,
      "GH-TEST-02",
      "JOB-TEST-02",
    );
    expect(stockLedger.getStock(testSku)).toEqual({
      onHand: 7,
      reserved: 0,
      available: 7,
    });

    // Check Invariants:
    // Invariant 1: 0 <= reserved <= on_hand (0 <= 0 <= 7 holds)
    const finalStock = stockLedger.getStock(testSku);
    expect(finalStock.reserved).toBeGreaterThanOrEqual(0);
    expect(finalStock.reserved).toBeLessThanOrEqual(finalStock.onHand);
  });

  it("TC-09: Replaying OP-08 with identical transactionId is idempotent and preserves stock", () => {
    const testSku = "GH-LCK-001";
    stockLedger.setStock(testSku, 20, 5);

    const txId = "tx-unique-op08-replay";
    // First movement: install_use 2
    stockLedger.applyMovement(txId, testSku, "install_use", 2);
    expect(stockLedger.getStock(testSku)).toEqual({
      onHand: 18,
      reserved: 3,
      available: 15,
    });

    // Replay same transaction ID: returns existing movement without modifying stock
    stockLedger.applyMovement(txId, testSku, "install_use", 2);
    expect(stockLedger.getStock(testSku)).toEqual({
      onHand: 18,
      reserved: 3,
      available: 15,
    });
  });

  it("TC-31: Phone number normalization and validation logic", () => {
    // 09XXXXXXXXX -> +639XXXXXXXXX
    expect(normalizePhilippinePhone("09171234567")).toBe("+639171234567");
    // 02XXXXXXXX -> +632XXXXXXXX
    expect(normalizePhilippinePhone("0281234567")).toBe("+63281234567");
    // Spaced or hyphenated formats
    expect(normalizePhilippinePhone("0917-123-4567")).toBe("+639171234567");
    // Already +63 format
    expect(normalizePhilippinePhone("+639171234567")).toBe("+639171234567");
    expect(normalizePhilippinePhone("+6328123456")).toBe("+6328123456");
  });

  it("TC-06: System B down at checkout -> order succeeds, outbox pending, delivered once partner recovers", async () => {
    const checkoutData = {
      customerName: "Juan Dela Cruz",
      customerPhone: "09171234567",
      customerEmail: "juan@example.com",
      address: {
        line1: "123 Ayala Ave",
        city: "Makati",
        province: "Metro Manila",
        postalCode: "1226",
      },
      items: [{ sku: "GH-CCTV-001", quantity: 2, unitPricePhp: "3850.00" }],
      includeInstallation: true,
      preferredStart: "2026-11-14T09:00:00+08:00",
      preferredEnd: "2026-11-14T11:00:00+08:00",
      specialInstructions: "Ring gate bell",
    };

    const idempotencyKey = "checkout-tc06-key";
    const correlationId = "corr-tc06-1";

    // 1. Process checkout -> order succeeds as "paid", outbox enqueued
    const { order, outboxId } = await ordersService.processCheckout(
      checkoutData,
      idempotencyKey,
      correlationId,
    );

    expect(order.status).toBe("paid");
    expect(order.orderNumber).toMatch(/^GH-[0-9]{8}-[0-9]{6}$/);
    expect(outboxId).toBeDefined();

    const outboxRow = outboxEngine
      .getOutboxRows()
      .find((r) => r.id === outboxId)!;
    expect(outboxRow.status).toBe("pending");
    expect(outboxRow.attempts).toBe(0);

    // 2. Simulate System B being down (partner returns 503 / network failure)
    const mockPartnerDown = async () => ({ status: 503 });
    const failAttempt = await outboxEngine.deliverMessage(
      outboxRow,
      mockPartnerDown,
    );
    expect(failAttempt.delivered).toBe(false);
    expect(outboxRow.status).toBe("pending");
    expect(outboxRow.attempts).toBe(1);

    // 3. Partner recovers (returns 201 Created)
    const mockPartnerUp = async () => ({
      status: 201,
      body: { jobNumber: "JOB-20261110-888888" },
    });
    const successAttempt = await outboxEngine.deliverMessage(
      outboxRow,
      mockPartnerUp,
    );
    expect(successAttempt.delivered).toBe(true);
    expect(outboxRow.status).toBe("delivered");
  });

  it("TC-13: Replay from failed queue reuses the original Idempotency-Key (CL-06, CL-07)", async () => {
    const originalKey = "idemp-fail-tc13-original-uuid";
    const outboxRow = outboxEngine.enqueue(
      "OP-01",
      { orderNumber: "GH-20261110-000099" },
      originalKey,
      "corr-tc13-1",
    );

    // Force 5 consecutive failures to send to failed_messages
    const failingDispatcher = async () => ({ status: 500 });
    for (let i = 0; i < 5; i++) {
      await outboxEngine.deliverMessage(outboxRow, failingDispatcher);
    }

    expect(outboxRow.status).toBe("failed");
    const failedQueue = outboxEngine.getFailedRows();
    const failedMsg = failedQueue.find(
      (f) => f.outboxMessageId === outboxRow.id,
    )!;
    expect(failedMsg).toBeDefined();
    expect(failedMsg.idempotencyKey).toBe(originalKey);

    // Admin clicks "Replay" -> must reuse original Idempotency-Key
    const replayedRow = await outboxEngine.replayFailedMessage(failedMsg.id);
    expect(replayedRow.idempotencyKey).toBe(originalKey); // Crucial check!
    expect(replayedRow.status).toBe("pending");
    expect(replayedRow.attempts).toBe(0);
  });

  it("TC-17: 5 consecutive failures trip circuit breaker to OPEN; 30s later transitions to half-open; closes on success (CL-06, D-20)", () => {
    outboxEngine.resetCircuit();
    expect(outboxEngine.checkCircuit().allowed).toBe(true);

    // 4 failures -> breaker remains closed
    for (let i = 0; i < 4; i++) {
      outboxEngine.recordFailure();
      expect(outboxEngine.getCircuitState().state).toBe("closed");
      expect(outboxEngine.checkCircuit().allowed).toBe(true);
    }

    // 5th failure -> trips breaker to OPEN
    outboxEngine.recordFailure();
    expect(outboxEngine.getCircuitState().state).toBe("open");
    const trippedCheck = outboxEngine.checkCircuit();
    expect(trippedCheck.allowed).toBe(false);
    expect(trippedCheck.reason).toContain("Circuit breaker is OPEN");

    // Simulate 31 seconds elapsed
    const originalNow = Date.now;
    try {
      Date.now = () => originalNow() + 31_000;
      // Breaker transitions to half_open and allows one trial
      expect(outboxEngine.checkCircuit().allowed).toBe(true);
      expect(outboxEngine.getCircuitState().state).toBe("half_open");

      // On successful delivery trial, circuit closes and consecutive failures reset to 0
      outboxEngine.recordSuccess();
      expect(outboxEngine.getCircuitState().state).toBe("closed");
      expect(outboxEngine.getCircuitState().consecutiveFailures).toBe(0);
      expect(outboxEngine.checkCircuit().allowed).toBe(true);
    } finally {
      Date.now = originalNow;
      outboxEngine.resetCircuit();
    }
  });
});
