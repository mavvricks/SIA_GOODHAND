import { describe, it, expect } from "vitest";
import { JobsStore } from "../lib/services/jobs-store";

async function pending(store: JobsStore, suffix: string) {
  return (
    await store.createInstallationJob(
      {
        orderNumber: `GH-20300101-${suffix}`,
        customerName: "Claim Test",
        customerPhone: "+639171234567",
        customerEmail: "claim@example.com",
        address: {
          line1: "123 Test Street",
          city: "Makati",
          province: "Metro Manila",
          postalCode: "1226",
        },
        items: [{ sku: "GH-CCTV-001", quantity: 1 }],
        preferredStart: "2030-01-10T09:00:00+08:00",
        preferredEnd: "2030-01-10T11:00:00+08:00",
      },
      `claim-${suffix}`,
      "claim-test",
    )
  ).body.jobNumber;
}

describe("Pending job claiming and dispatcher assignment", () => {
  it("allows only one winner when technicians claim the same job concurrently", async () => {
    const store = new JobsStore();
    const number = await pending(store, "000001");
    const results = await Promise.allSettled([
      store.assignPendingJob(number, "tech-uuid-1", "claim-a"),
      store.assignPendingJob(number, "tech-uuid-3", "claim-b"),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    expect(store.getJob(number)?.technicianId).toBe("tech-uuid-1");
    expect(
      store
        .getOutboxMessages()
        .filter((message) => message.operationId === "OP-05"),
    ).toHaveLength(1);
  });
  it("refuses a forced assignment after another technician has claimed the job", async () => {
    const store = new JobsStore();
    const number = await pending(store, "000002");
    await store.assignPendingJob(number, "tech-uuid-1", "claim");
    await expect(
      store.assignPendingJob(number, "tech-uuid-3", "dispatcher"),
    ).rejects.toMatchObject({ category: "BUSINESS_RULE_VIOLATED" });
    expect(store.getJob(number)?.technicianId).toBe("tech-uuid-1");
  });
  it("enforces qualifications and overlapping appointments for both claim and assignment", async () => {
    const store = new JobsStore();
    const first = await pending(store, "000003");
    const second = await pending(store, "000004");
    await expect(
      store.assignPendingJob(first, "tech-uuid-2", "unqualified"),
    ).rejects.toMatchObject({ category: "BUSINESS_RULE_VIOLATED" });
    expect(store.getJob(first)?.status).toBe("Pending Scheduling");
    await store.assignPendingJob(first, "tech-uuid-1", "claim");
    await expect(
      store.assignPendingJob(second, "tech-uuid-1", "overlap"),
    ).rejects.toMatchObject({ category: "SCHEDULE_CONFLICT" });
    expect(store.getJob(second)?.technicianId).toBeUndefined();
    await store.assignPendingJob(second, "tech-uuid-1", "dispatcher", {
      scheduledStart: "2030-01-10T13:00:00+08:00",
      scheduledEnd: "2030-01-10T15:00:00+08:00",
    });
    expect(store.getJob(second)?.status).toBe("Scheduled");
  });
});

describe("Scheduling buffer and emergency release", () => {
  it("protects two hours on either side, including exact boundaries and timezone offsets", async () => {
    const store = new JobsStore();
    const job = await pending(store, "000090");
    await store.assignPendingJob(job, "tech-uuid-1", "test");
    expect(
      store.checkAppointmentOverlap(
        "tech-uuid-1",
        "2030-01-10T12:59:00+08:00",
        "2030-01-10T14:00:00+08:00",
      ),
    ).toBe(true);
    expect(
      store.checkAppointmentOverlap(
        "tech-uuid-1",
        "2030-01-10T13:00:00+08:00",
        "2030-01-10T15:00:00+08:00",
      ),
    ).toBe(false);
    expect(
      store.checkAppointmentOverlap(
        "tech-uuid-1",
        "2030-01-10T05:00:00+08:00",
        "2030-01-10T07:01:00+08:00",
      ),
    ).toBe(true);
    expect(
      store.checkAppointmentOverlap(
        "tech-uuid-1",
        "2030-01-09T21:00:00Z",
        "2030-01-09T23:00:00Z",
      ),
    ).toBe(false);
  });
  it("only lets the owner unclaim, releases the reservation, records the reason, and permits a new claim", async () => {
    const store = new JobsStore();
    const job = await pending(store, "000091");
    await store.assignPendingJob(job, "tech-uuid-1", "test");
    expect(() =>
      store.unclaimJob(job, "tech-uuid-3", "Emergency", "test"),
    ).toThrow("not found");
    store.unclaimJob(job, "tech-uuid-1", "Family emergency", "test");
    expect(store.getJob(job)?.technicianId).toBeUndefined();
    expect(store.getJob(job)?.releaseHistory?.[0].reason).toBe(
      "Family emergency",
    );
    expect(
      store.checkAppointmentOverlap(
        "tech-uuid-1",
        "2030-01-10T09:00:00+08:00",
        "2030-01-10T11:00:00+08:00",
      ),
    ).toBe(false);
    expect(store.getOutboxMessages().at(-1)?.payload.status).toBe(
      "Pending Scheduling",
    );
    await store.assignPendingJob(job, "tech-uuid-3", "reclaim");
    expect(store.getJob(job)?.technicianId).toBe("tech-uuid-3");
  });
  it("refuses to release loaded hardware or work already started", async () => {
    const store = new JobsStore();
    const job = await pending(store, "000092");
    await store.assignPendingJob(job, "tech-uuid-1", "test");
    store.getJob(job)!.items[0].loadedQuantity = 1;
    expect(() =>
      store.unclaimJob(job, "tech-uuid-1", "Emergency", "test"),
    ).toThrow("hardware");
    store.getJob(job)!.status = "In Progress";
    expect(() =>
      store.unclaimJob(job, "tech-uuid-1", "Emergency", "test"),
    ).toThrow("Only scheduled");
  });
  it('releases the previous appointment and permits a new claim after a customer reschedule', async () => {
    const store = new JobsStore();
    const jobNumber = await pending(store, '000093');
    await store.assignPendingJob(jobNumber, 'tech-uuid-1', 'initial');
    const first = store.getJob(jobNumber)!;
    const oldStart = first.scheduledStart!;
    const oldEnd = first.scheduledEnd!;
    await store.requestReschedule(jobNumber, '2030-01-12T09:00:00+08:00', '2030-01-12T11:00:00+08:00', 'Customer unavailable', 'test', 'reschedule-key');
    expect(store.getJob(jobNumber)).toMatchObject({ status: 'Reschedule Required', technicianId: undefined });
    expect(store.checkAppointmentOverlap('tech-uuid-1', oldStart, oldEnd)).toBe(false);
    await store.assignPendingJob(jobNumber, 'tech-uuid-1', 'new-time');
    expect(store.getJob(jobNumber)?.status).toBe('Scheduled');
  });
});
