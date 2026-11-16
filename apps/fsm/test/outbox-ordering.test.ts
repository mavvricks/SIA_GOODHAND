import { afterEach, describe, it, expect, vi } from "vitest";
import { jobsStore, type OutboxMessage } from "../lib/services/jobs-store";
import { flushFsmOutbox } from "../lib/outbox";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("Assignment event ordering", () => {
  it("holds unclaim behind a retrying schedule while still delivering other orders", async () => {
    const make = (id: string, orderNumber: string): OutboxMessage => ({
      id,
      operationId: "OP-06",
      payload: { orderNumber, status: "Pending Scheduling" },
      idempotencyKey: id,
      correlationId: "test",
      status: "pending",
      attempts: 0,
      nextAttemptAt: new Date(0).toISOString(),
      createdAt: new Date().toISOString(),
    });
    const first = make("schedule", "one"),
      second = make("unclaim", "one"),
      other = make("other", "two");
    vi.spyOn(jobsStore, "getOutboxMessages").mockReturnValue([
      first,
      second,
      other,
    ]);
    const send = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", send);
    await flushFsmOutbox();
    expect(send).toHaveBeenCalledTimes(2);
    expect(second.attempts).toBe(0);
    expect(other.status).toBe("delivered");
    await flushFsmOutbox();
    expect(send).toHaveBeenCalledTimes(2);
    first.nextAttemptAt = new Date(0).toISOString();
    await flushFsmOutbox();
    expect(first.status).toBe("delivered");
    expect(second.status).toBe("delivered");
    expect(send).toHaveBeenCalledTimes(4);
  });
});
