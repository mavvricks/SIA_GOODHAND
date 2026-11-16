import { NextResponse } from 'next/server';
import { outboxEngine } from '@/lib/outbox/outbox-engine';
import { simulationService } from '@/lib/simulation/simulation-service';
import { mailService } from '@/lib/email/mail-service';
import { feedbackService } from '@/lib/services/feedback-service';

export async function GET() {
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
    followups
  });
}
