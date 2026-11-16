import type { NextRequest } from "next/server";
import { getSessionUser } from "./auth";
import { technicianForUser } from "./technicians";
import { jobsStore } from "./services/jobs-store";

export async function requireAssignedTechnician(
  req: NextRequest,
  jobNumber: string,
) {
  const user = await getSessionUser(req);
  if (!user)
    throw Object.assign(new Error("Sign in to manage your jobs."), {
      category: "AUTHENTICATION_REQUIRED",
    });
  const technician = technicianForUser(user);
  const job = jobsStore.getJob(jobNumber);
  if (!technician || !job || job.technicianId !== technician.id)
    throw Object.assign(new Error("Job not found"), { category: "NOT_FOUND" });
  return job;
}
