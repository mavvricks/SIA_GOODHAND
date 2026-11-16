import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { jobsStore } from "@/lib/services/jobs-store";
import { createErrorResponse } from "@/lib/errors";
async function staff(req: NextRequest) {
  const user = await getSessionUser(req);
  return user && ["dispatcher", "admin"].includes(user.role);
}
export async function GET(req: NextRequest) {
  if (!(await staff(req)))
    return createErrorResponse("FORBIDDEN_SCOPE", "Staff access required.");
  return NextResponse.json(
    {
      technicians: jobsStore.listTechnicians().map((tech) => ({
        ...tech,
        jobs: jobsStore
          .listJobs()
          .filter(
            (job) =>
              job.technicianId === tech.id &&
              ["Scheduled", "In Progress"].includes(job.status),
          )
          .map((job) => ({
            jobNumber: job.jobNumber,
            start: job.scheduledStart,
            end: job.scheduledEnd,
            area: job.address.city,
          })),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function PATCH(req: NextRequest) {
  if (!(await staff(req)))
    return createErrorResponse("FORBIDDEN_SCOPE", "Staff access required.");
  try {
    const { id, ...details } = z
      .object({
        id: z.string(),
        phone: z
          .string()
          .trim()
          .max(30)
          .refine(
            (value) => !value || /^(\+63|0)[0-9]{10}$/.test(value),
            "Use a Philippine phone number, e.g. +639171234567",
          ),
        branch: z.string().trim().max(120),
      })
      .strict()
      .parse(await req.json());
    return NextResponse.json(jobsStore.updateTechnician(id, details));
  } catch (error: any) {
    return createErrorResponse(
      error.category || "VALIDATION_FAILED",
      error.message,
    );
  }
}
