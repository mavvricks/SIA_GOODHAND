# Live checkout, claiming, and assignment

Paid System A orders with installation now reach System B through the real
OAuth client-credentials endpoint and OP-01. Hardware-only purchases do not
create an installation job. Checkout responds before partner delivery runs;
an unavailable partner leaves the message queued for retry.

Installation is optional for all checkout products at the user's request. The
checkout checkbox submits `include_installation`; the legacy camel-case flag is
also supported. Missing flags default to true, and conflicting/non-boolean flags
are rejected. Unchecked orders require no schedule, deduct stock as direct
sales, and create no outbox event. Their customer order page displays
Self-Installation / Hardware Only. The dispatcher-console link is restricted to
authenticated Store admins and is omitted entirely for hardware-only orders.

## Rehearsal

1. Keep both apps running. Checkout with installation at `localhost:3000`.
2. Sign into System B at `localhost:3100/login`. The queue refreshes every three
   seconds and shows actual stored jobs, rather than a fixed sample table.
3. As a technician, open `/technician`. Use **Claim job** under pending jobs.
   The authenticated account determines the technician identity. A successful
   claim schedules the job in its requested window.
4. As dispatcher or operations admin, open a pending job's **View details**,
   choose a qualified technician and window, then use **Force assign**.
5. Both paths reserve the appointment, reject overlaps, and send signed OP-05
   back to System A. Refresh the customer order page to see the assignment.
6. The assigned technician can confirm each item's loading, start the job, and
   submit completion with one serial per installed unit and returned quantities.
   These actions call the backend and dispatch OP-06, OP-07, and OP-08.

Claiming or force assigning a job already claimed by someone else returns 409.
Force assignment does not override another claim, qualifications, or overlapping
appointments. A technician cannot operate on another technician's job. Unknown
email addresses no longer create dispatcher sessions.

## Local accounts

Existing dispatcher, operations admin, Arnel, and Danilo seed credentials remain
available. Technician profiles include Arnel (CCTV, alarms, locks), Danilo (fence,
networking), Crispin (CCTV, networking), Eduardo (CCTV, locks, alarms), Fernando
(fence, alarms), and Gabriel (CCTV, networking, radio). Storage accessories need
no separate technician qualification. The complete directory is in
`apps/fsm/lib/technicians.ts`. All technician accounts use the existing local
technician demo password.

## Runtime and limitations

The local Node development runtime runs a bounded-retry outbox worker for each
system. Ending the store's simulated outage immediately makes pending messages
eligible for delivery. The protected System A drain endpoint uses the same
OAuth transport as checkout and remains available for deployed cron calls.
System B sends signed webhook requests with bounded retries and timeouts.

Domain state is now persisted to local SQLite across server restarts, and kept
shared across route bundles and hot reloads within each process. The local
adapter uses domain snapshots. A normalized hosted Postgres implementation and
distributed allocation transactions remain necessary for Vercel deployment.
See [local database scope](local-database.md). The single-process pending-job
guard prevents simultaneous claims in the local rehearsal runtime.

## Verification

- 49 tests across eight files pass, including optional installation, real-token transport construction,
  feedback privacy, concurrent claim exclusion, qualifications, and overlaps.
- All 16 existing cross-system contract checks pass; published OP schemas remain
  unchanged. Both apps pass application TypeScript checking. The pre-existing
  test-fixture `result` enum mismatch remains outside that application check.
- Actual HTTP/browser walkthrough verified checkout to live queue, technician
  claim, dispatcher force assignment, OP-05 reflected in System A, simultaneous
  claims (200/409), role and ownership checks, loading/start/completion delivery,
  outage buffering and recovery, and a 360px dispatcher layout.

Local UI APIs: authenticated `GET /api/v1/jobs`, technician
`POST /api/v1/jobs/{jobNumber}/claim`, and dispatcher/admin
`POST /api/v1/jobs/{jobNumber}/assign`. Assignment accepts technicianId,
scheduledStart, and scheduledEnd. Claim identity and preferred window are
resolved on the server, so the browser cannot select a different claimant.
