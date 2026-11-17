import { databaseRoute } from "../../../../../../packages/database/postgres.mjs";
import { NextResponse } from "next/server";
import { jobsStore } from "@/lib/services/jobs-store";
import { simulationService } from "@/lib/simulation/simulation-service";
import { mailService } from "@/lib/email/mail-service";

async function handleGET() {
  if (process.env.NODE_ENV === "production")
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const flags = simulationService.getAllFlags();
  const jobs = jobsStore.listJobs();
  const outbox = jobsStore.getOutboxMessages();
  const feedbacks = jobsStore.listAllFeedback();
  const followups = jobsStore.listFollowups();
  const emails = mailService.getLogs();

  return NextResponse.json({
    flags,
    jobs,
    outbox,
    feedbacks,
    followups,
    emails,
  });
}

export const GET = databaseRoute("fsm", handleGET, { readOnly: true });
