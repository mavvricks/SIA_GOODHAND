# Operations Runbook: System Administration & Incident Response

## 1. Outbox Queue Triage & Replaying Failed Messages (W-04)

### 1.1 Symptoms
- A customer places an order with installation, but the job does not appear in System B after several minutes.
- The administrator demo panel (`/demo`) shows entries under **Failed Messages**.

### 1.2 Inspection Procedure
1. Log into System A Admin Demo Console (`http://localhost:3000/demo` or production domain).
2. Open the **Transactional Outbox** tab and review the `failed_messages` list.
3. Review the `lastErrorCategory` and `finalError` message.
   - If `SERVICE_UNAVAILABLE` (503): System B was undergoing maintenance or experiencing downtime.
   - If `CIRCUIT_OPEN`: The circuit breaker tripped after 5 consecutive failures.
   - If `VALIDATION_FAILED` (422): Payload data mismatch (inspect logs for reference ID).

### 1.3 Resolution: Safe Replay
1. Ensure partner connectivity is restored.
2. In the demo panel, click **Replay Last Message** (or trigger `POST /api/demo/replay`).
3. **Safety Guarantee (CL-06, CL-07):** Replays strictly preserve and reuse the original `Idempotency-Key` and `transactionId`. If System B had already received or partially processed the request, it will respond with an idempotent `200 OK` without duplicating records or double-decrementing inventory.

---

## 2. Circuit Breaker Triage & Reset (D20)

### 2.1 State Mechanics
- **Closed:** Normal operations. Requests pass directly to partner service.
- **Open:** Triggered after 5 consecutive request failures (`CIRCUIT_FAILURE_THRESHOLD = 5`). Outgoing calls are immediately rejected locally without hitting the network to preserve resources.
- **Half-Open:** Triggered automatically after 30 seconds (`CIRCUIT_OPEN_SECONDS = 30`). Allows one trial request through. If successful, state resets to Closed. If failed, trips back to Open for another 30 seconds.

### 2.2 Manual Reset
If partner service is verified healthy:
1. In the demo console, click **"Drain Outbox Queue"** (or execute `/api/internal/drain`).
2. The trial request will succeed, and the circuit state will immediately restore to `closed`.

---

## 3. Demo Database Reset Procedure

When preparing for an evaluation, presentation, or automated test run:

### Development Environment:
```powershell
pnpm demo:reset
```

### Production Environment (`DEMO_MODE=true`):
Seeds refuse to run in production by default. To force a demo reset in production:
```powershell
node scripts/reset-demo.mjs --force-demo
```
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
