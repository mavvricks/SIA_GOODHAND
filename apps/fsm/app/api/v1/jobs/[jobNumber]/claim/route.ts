import { after, NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createErrorResponse } from "@/lib/errors";
import { jobsStore } from "@/lib/services/jobs-store";
import { technicianForUser } from "@/lib/technicians";
import { flushFsmOutbox } from "@/lib/outbox";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobNumber: string }> },
) {
  const correlationId =
    req.headers.get("x-correlation-id") || crypto.randomUUID();
  const user = await getSessionUser(req);
  if (!user)
    return createErrorResponse(
      "AUTHENTICATION_REQUIRED",
      "Sign in to claim a job.",
      correlationId,
    );
  const technician = technicianForUser(user);
  if (!technician)
    return createErrorResponse(
      "FORBIDDEN_SCOPE",
      "Only a technician can claim jobs.",
      correlationId,
    );
  try {
    const { jobNumber } = await params;
    const { job } = await jobsStore.assignPendingJob(
      jobNumber,
      technician.id,
      correlationId,
    );
    after(flushFsmOutbox);
    return NextResponse.json({
      success: true,
      jobNumber: job.jobNumber,
      status: job.status,
    });
  } catch (err: any) {
    return createErrorResponse(
      err.category || "UNEXPECTED_ERROR",
      err.message,
      correlationId,
    );
  }
}
