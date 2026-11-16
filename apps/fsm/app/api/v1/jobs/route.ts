import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createErrorResponse } from "@/lib/errors";
import { jobsStore } from "@/lib/services/jobs-store";
import { technicians, technicianForUser, isQualified } from "@/lib/technicians";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user)
    return createErrorResponse(
      "AUTHENTICATION_REQUIRED",
      "Sign in to view live jobs.",
    );
  const technician = technicianForUser(user);
  if (user.role === "technician" && !technician)
    return createErrorResponse(
      "FORBIDDEN_SCOPE",
      "No technician profile is linked to this account.",
    );
  const jobs = jobsStore
    .listJobs()
    .filter(
      (job) =>
        user.role !== "technician" ||
        job.technicianId === technician?.id ||
        (!job.technicianId && job.status === "Pending Scheduling"),
    )
    .map(({ customerEmail, customerPhone, idempotencyKey, ...job }) => ({
      ...job,
      claimBlockedReason:
        technician && !isQualified(technician, job.items)
          ? "Requires qualifications outside your profile."
          : technician &&
              jobsStore.checkAppointmentOverlap(
                technician.id,
                job.preferredStart,
                job.preferredEnd,
              )
            ? "Schedule conflict: a two-hour gap between jobs is required. Contact dispatch for another window."
            : undefined,
      canClaim: Boolean(
        technician &&
        !job.technicianId &&
        job.status === "Pending Scheduling" &&
        isQualified(technician, job.items) &&
        !jobsStore.checkAppointmentOverlap(
          technician.id,
          job.preferredStart,
          job.preferredEnd,
        ),
      ),
    }));
  return NextResponse.json(
    {
      jobs,
      user,
      technician,
      technicians:
        user.role === "technician" ? [] : jobsStore.listTechnicians(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
