import { databaseRoute } from "../../../../../packages/database/postgres.mjs";
import { after, NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { jobsStore } from "@/lib/services/jobs-store";
import { flushFsmOutbox } from "@/lib/outbox";

async function staff(req: NextRequest) {
  return ["admin", "dispatcher"].includes(
    (await getSessionUser(req))?.role || "",
  );
}
async function handleGET(req: NextRequest) {
  if (!(await staff(req)))
    return NextResponse.json(
      { error: { message: "Dispatcher access required." } },
      { status: 403 },
    );
  return NextResponse.json(
    {
      messages: jobsStore
        .getOutboxMessages()
        .map((row) => ({
          id: row.id,
          operationId: row.operationId,
          orderNumber: row.payload.orderNumber,
          jobNumber: row.payload.jobNumber,
          status: row.status,
          attempts: row.attempts,
          nextAttemptAt: row.nextAttemptAt,
          createdAt: row.createdAt,
        })),
      unassigned: jobsStore
        .listJobs()
        .filter(
          (job) =>
            ["Pending Scheduling", "Reschedule Required"].includes(
              job.status,
            ) && !job.technicianId,
        )
        .map((job) => ({
          jobNumber: job.jobNumber,
          orderNumber: job.orderNumber,
          area: job.serviceArea,
          preferredStart: job.preferredStart,
        })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
async function handlePOST(req: NextRequest) {
  if (!(await staff(req)))
    return NextResponse.json(
      { error: { message: "Dispatcher access required." } },
      { status: 403 },
    );
  const input = await req.json().catch(() => ({}));
  const row = jobsStore
    .getOutboxMessages()
    .find((message) => message.id === input.id && message.status === "failed");
  if (!row)
    return NextResponse.json(
      { error: { message: "Failed message not found." } },
      { status: 404 },
    );
  row.status = "pending";
  row.attempts = 0;
  row.nextAttemptAt = new Date().toISOString();
  after(flushFsmOutbox);
  return NextResponse.json({
    success: true,
    replayed: { id: row.id, status: row.status },
  });
}
export const GET = databaseRoute("fsm", handleGET, { readOnly: true });
export const POST = databaseRoute("fsm", handlePOST, { readOnly: false });
