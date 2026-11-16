import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { technicianForUser } from "@/lib/technicians";
import { jobsStore } from "@/lib/services/jobs-store";
import { createErrorResponse } from "@/lib/errors";
import { flushFsmOutbox } from "@/lib/outbox";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobNumber: string }> },
) {
  const user = await getSessionUser(req);
  if (!user)
    return createErrorResponse(
      "AUTHENTICATION_REQUIRED",
      "Sign in to unclaim jobs.",
    );
  const technician = technicianForUser(user);
  if (!technician)
    return createErrorResponse(
      "FORBIDDEN_SCOPE",
      "Only the assigned technician may unclaim a job.",
    );
  try {
    const { reason } = z
      .object({ reason: z.string().trim().min(3).max(500) })
      .strict()
      .parse(await req.json());
    const job = jobsStore.unclaimJob(
      (await params).jobNumber,
      technician.id,
      reason,
      crypto.randomUUID(),
    );
    after(flushFsmOutbox);
    return NextResponse.json({ success: true, status: job.status });
  } catch (error: any) {
    return createErrorResponse(
      error.category || "VALIDATION_FAILED",
      error.message,
    );
  }
}
