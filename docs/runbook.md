# Operations Runbook: System Administration & Incident Response

## Current operations (17 November 2026)

Store administrators use `/operations` in System A for OP-01 and customer feedback outbox events. Dispatchers/admins use `/operations` in System B for signed OP-05/06/07/08 webhook deliveries and unassigned jobs. Both pages show pending/failed counts and event history without exposing customer contact details. **Replay safely** retains the original idempotency key. Assign an unclaimed or rescheduled job from System B's Jobs Queue.

The hosted scheduler calls `POST /api/internal/drain` on **both** apps using `CRON_SECRET_STORE` and `CRON_SECRET_FSM` respectively. The GitHub Actions workflow runs every five minutes. If a delivery is stuck, verify partner availability, inspect the failed event in the appropriate Operations page, replay it, and confirm its status becomes delivered. For local development, both apps also retry in the background. `pnpm e2e` launches an isolated two-app HTTP lifecycle with temporary SQLite data and removes it afterwards.

Customer installation changes start on the owned order detail page. Reschedule sends OP-03 and releases the old appointment; System B marks the job **Reschedule Required** so dispatch or a technician can claim the new window. Cancellation sends OP-04, marks only the installation **Cancelled**, and leaves hardware delivery active. Both actions queue OP-06 back to Store. Customers cannot act on completed/in-progress/cancelled work; cancellation must be at least 24 hours before a confirmed appointment, and two reschedule requests are permitted per order.

For Neon cutover or recovery, see `docs/local-database.md` and `docs/deployment.md`. Migrations are additive and checked by checksum. The one-time SQLite import refuses a populated target. Never reset or reimport a live database; take a Neon branch snapshot before a structural migration. Local SQLite backups stay in `.data/backups/` and are ignored by Git.

An installation cancellation does not cancel hardware delivery. Store converts the reservation to a hardware sale once when the cancellation status arrives or the customer request succeeds.

## 1. Outbox Queue Triage & Replaying Failed Messages (W-04)

### 1.1 Symptoms
- A customer places an order with installation, but the job does not appear in System B after several minutes.
- The administrator demo panel (`/demo`) shows entries under **Failed Messages**.

### 1.2 Inspection Procedure
1. Sign in as Store admin at System A `/operations`, or dispatcher/admin at System B `/operations`.
2. Review the failed event list and event delivery log.
3. Review the `lastErrorCategory` and `finalError` message.
   - If `SERVICE_UNAVAILABLE` (503): System B was undergoing maintenance or experiencing downtime.
   - If `CIRCUIT_OPEN`: The circuit breaker tripped after 5 consecutive failures.
   - If `VALIDATION_FAILED` (422): Payload data mismatch (inspect logs for reference ID).

### 1.3 Resolution: Safe Replay
1. Ensure partner connectivity is restored.
2. Click **Replay safely** on the failed event. Demo routes are unavailable in production.
3. **Safety Guarantee (CL-06, CL-07):** Replays strictly preserve and reuse the original `Idempotency-Key` and `transactionId`. If System B had already received or partially processed the request, it will respond with an idempotent `200 OK` without duplicating records or double-decrementing inventory.

---

## 2. Circuit Breaker Triage & Reset (D20)

### 2.1 State Mechanics
- **Closed:** Normal operations. Requests pass directly to partner service.
- **Open:** Triggered after 5 consecutive request failures (`CIRCUIT_FAILURE_THRESHOLD = 5`). Outgoing calls are immediately rejected locally without hitting the network to preserve resources.
- **Half-Open:** Triggered automatically after 30 seconds (`CIRCUIT_OPEN_SECONDS = 30`). Allows one trial request through. If successful, state resets to Closed. If failed, trips back to Open for another 30 seconds.

### 2.2 Manual Reset
If partner service is verified healthy:
1. Invoke the authenticated `POST /api/internal/drain` for the affected app or trigger the GitHub Actions drain workflow.
2. The trial request will succeed, and the circuit state will immediately restore to `closed`.

---

## 3. Demo Database Reset Procedure

When preparing an isolated local SQLite evaluation:

### Development Environment:
```powershell
pnpm demo:reset
```

### Production and Neon
Never run a demo reset or import over existing Neon data. The HTTP E2E suite uses its own temporary SQLite files and does not modify the configured Neon databases.
This restores:
- System A: 1 store admin, 3 customers, 24 security products, initial inventory ledger, 12 sample orders, baseline feedback.
- System B: 1 admin, 2 dispatchers, 6 technicians across 4 service areas, qualifications matrix, clean appointment calendar.

---

## 4. Secret Rotation Procedure

### 4.1 Webhook Signing Secrets (`STORE_WEBHOOK_SIGNING_SECRET`, `FSM_WEBHOOK_SIGNING_SECRET`)
1. Generate a new high-entropy 64-character secret.
2. Update the environment variables in both Vercel projects simultaneously.
3. Trigger a redeployment. The 5-minute timestamp tolerance window allows smooth transition between versions.

### 4.2 OAuth Service Credentials
1. Update `STORE_SERVICE_CLIENT_SECRET` and `FSM_SERVICE_CLIENT_SECRET`.
2. Existing active service JWT tokens have a maximum lifetime of **15 minutes** and will automatically rotate on subsequent token acquisition cycles.
