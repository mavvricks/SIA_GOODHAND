import { databaseRoute } from "../../../../../../packages/database/postgres.mjs";
import { NextResponse } from "next/server";
import { outboxEngine } from "@/lib/outbox/outbox-engine";
import { simulationService } from "@/lib/simulation/simulation-service";
import { mailService } from "@/lib/email/mail-service";
import { feedbackService } from "@/lib/services/feedback-service";

async function handleGET() {
  if (process.env.NODE_ENV === "production")
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const flags = simulationService.getAllFlags();
  const outbox = outboxEngine.getOutboxRows();
  const failed = outboxEngine.getFailedRows();
  const emails = mailService.getLogs();
  const feedbacks = feedbackService.listFeedbacks();
  const followups = feedbackService.listFollowups();

  return NextResponse.json({
    flags,
    outbox,
    failed,
    emails,
    feedbacks,
    followups,
  });
}

export const GET = databaseRoute("store", handleGET, { readOnly: true });
