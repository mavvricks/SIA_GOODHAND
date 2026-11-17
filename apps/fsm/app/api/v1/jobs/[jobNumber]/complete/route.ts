import { databaseRoute } from "../../../../../../../../packages/database/postgres.mjs";
import { after, NextResponse, type NextRequest } from "next/server";
import { requireAssignedTechnician } from "@/lib/job-access";
import { flushFsmOutbox } from "@/lib/outbox";
import { createErrorResponse } from "@/lib/errors";
import { jobsStore } from "@/lib/services/jobs-store";
import { logger } from "@prototype/logger";

async function handlePOST(
  req: NextRequest,
  { params }: { params: Promise<{ jobNumber: string }> },
) {
  const correlationId =
    req.headers.get("x-correlation-id") || crypto.randomUUID();
  const { jobNumber } = await params;

  try {
    await requireAssignedTechnician(req, jobNumber);
    const body = await req.json();

    const { job, op07Message, op08Messages } = await jobsStore.completeJob(
      jobNumber,
      body,
      correlationId,
    );

    logger.info(
      {
        correlationId,
        jobNumber: job.jobNumber,
        status: job.status,
        op07Id: op07Message.id,
        op08Count: op08Messages.length,
      },
      "Job completed; OP-07 and OP-08 outbox rows written",
    );

    after(flushFsmOutbox);
    return NextResponse.json({
      success: true,
      jobNumber: job.jobNumber,
      status: job.status,
      op07MessageId: op07Message.id,
      op08MessageIds: op08Messages.map((m) => m.id),
    });
  } catch (err: any) {
    return createErrorResponse(
      err.category || "VALIDATION_FAILED",
      err.message || "Failed to complete job",
      correlationId,
    );
  }
}

export const POST = databaseRoute("fsm", handlePOST, { readOnly: false });
