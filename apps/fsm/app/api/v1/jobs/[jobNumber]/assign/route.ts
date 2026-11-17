import { databaseRoute } from "../../../../../../../../packages/database/postgres.mjs";
import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { createErrorResponse } from "@/lib/errors";
import { jobsStore } from "@/lib/services/jobs-store";
import { flushFsmOutbox } from "@/lib/outbox";
const schema = z
  .object({
    technicianId: z.string().min(1),
    technicianName: z.string().optional(),
    scheduledStart: z.string().datetime({ offset: true }),
    scheduledEnd: z.string().datetime({ offset: true }),
  })
  .strict();
async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ jobNumber: string }> },
) {
  const correlationId =
    req.headers.get("x-correlation-id") || crypto.randomUUID();
  const user = await getSessionUser(req);
  if (!user)
    return createErrorResponse(
      "AUTHENTICATION_REQUIRED",
      "Sign in to assign jobs.",
      correlationId,
    );
  if (user.role !== "dispatcher" && user.role !== "admin")
    return createErrorResponse(
      "FORBIDDEN_SCOPE",
      "Only dispatchers and administrators can assign jobs.",
      correlationId,
    );
  try {
    const { jobNumber } = await params;
    const input = schema.parse(await req.json());
    const { job, outboxMessage } = await jobsStore.assignPendingJob(
      jobNumber,
      input.technicianId,
      correlationId,
      input,
    );
    after(flushFsmOutbox);
    return NextResponse.json({
      success: true,
      job: {
        jobNumber: job.jobNumber,
        status: job.status,
        technicianName: job.technicianName,
        scheduledStart: job.scheduledStart,
        scheduledEnd: job.scheduledEnd,
      },
      outboxMessageId: outboxMessage.id,
    });
  } catch (err: any) {
    return createErrorResponse(
      err.category || "VALIDATION_FAILED",
      err.message || "Assignment failed",
      correlationId,
    );
  }
}

export const POST = databaseRoute("fsm", handlePOST, { readOnly: false });
