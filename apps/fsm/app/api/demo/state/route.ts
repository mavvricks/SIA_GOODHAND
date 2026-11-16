import { NextResponse } from 'next/server';
import { jobsStore } from '@/lib/services/jobs-store';
import { simulationService } from '@/lib/simulation/simulation-service';
import { mailService } from '@/lib/email/mail-service';

export async function GET() {
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
    emails
  });
}
