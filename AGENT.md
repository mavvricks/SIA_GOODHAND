# AGENTS.md — SYSINT_GOODHAND Project Context & Handoff Summary

## 1. Project Overview
- **Project**: Systems Integration for **Goodhand Security Products** (`jdadonato/sysint_goodhand`)[cite: 6, 10]
- **Team**: Group X-MEN (Aquino, Buscano, Donato, Duran, Garcia) — Section TB42[cite: 7, 39]
- **Architecture**: `pnpm` workspace monorepo connecting two independent Next.js/TypeScript applications via versioned REST APIs (`/api/v1/...`), webhooks, and an asynchronous transactional outbox[cite: 6, 20, 32, 34]:
  - **System A (`apps/store`, Port `3000`)**: Customer-facing E-Commerce Storefront (catalog, cart, checkout, inventory stock ledger, warranty activation, transactional outbox dispatcher, inbound webhook receivers, and `/demo` simulation dashboard)[cite: 6, 11, 13].
  - **System B (`apps/fsm`, Port `3100`)**: Field Service Management App (OAuth 2.0 token server, job dispatch/scheduling with double-booking prevention, technician loading gate & completion UI, outbound signed webhooks, and `/demo` simulation dashboard)[cite: 6, 11, 13, 35].
  - **Shared Packages (`packages/`)**: `contract` (OpenAPI 3.x spec, Spectral linting, generated Zod schemas), `logger` (structured JSON logging with `correlation_id` and PII redaction), `ui`, and `ui-tokens`[cite: 6, 28, 33, 36].
- **Strict Stack Rule**: Everything is **TypeScript / Next.js App Router / Zod**. Ignore any illustrative PHP/Laravel snippets found in academic course PDFs[cite: 42, 44].

---

## 2. Enforced Architectural & Peer-Review Invariants (D-01 to D-13)
Do not break any of the following implemented rules:
1. **Explicit Path Versioning (`D-06`)**: All integration endpoints use `/api/v1/...`[cite: 32, 34].
2. **Strict Boundary Validation (`D-03`, `D-08`)**: OpenAPI 3.x + Zod `strict()` validation on both System A and System B boundaries[cite: 33, 35]. Reject unknown fields, enforce string/numeric bounds (e.g., notes `<= 2000` chars, PH phone numbers as strings), require RFC 3339 / ISO 8601 timestamps with timezone offsets, and enforce exact job statuses (`Pending Scheduling`, `Scheduled`, `In Progress`, `Completed`, `Cancelled`, `Reschedule Required`)[cite: 13, 28, 33, 35].
3. **Outbox, Circuit Breaker & Idempotency (`D-04`, `D-05`)**: Checkout never blocks on System B[cite: 20, 33]. `apps/store/lib/outbox/outbox-engine.ts` uses bounded retries with exponential backoff, a Circuit Breaker (5 failures -> `OPEN`, 30s cooldown -> `half_open`, trial success -> `closed`), dead-letter handling, and `reference_id` idempotency keys so replays never duplicate jobs or stock deductions[cite: 6, 15, 28, 34].
4. **Authentication (`D-07`)**: Store-to-FSM (`A -> B`) uses OAuth 2.0 client credentials (`Bearer` token via `/api/oauth/token`)[cite: 6, 35]. FSM-to-Store (`B -> A`) webhooks use HMAC signatures + timestamps (`X-Signature` + `X-Timestamp`).
5. **Observability (`D-09`)**: Every cross-system flow propagates a `correlation_id` through `packages/logger` with PII masked[cite: 6, 28, 36].

---

## 3. Current Progress & Verified Baseline (100% Automated Tasks Complete)
All 16 automated code, test, and documentation gaps from the Completion Gap Plan have been implemented and verified:

### Recently Completed Work
- **Root Scripts (`package.json`)**: Added `"test": "node_modules/.bin/vitest run"`, `"dev": "pnpm --parallel --filter=./apps/* dev"`, and `"demo:reset": "node scripts/reset-demo.mjs"`.
- **FSM Endpoints (`OP-03` & `OP-04`)**:
  - `apps/fsm/app/api/v1/installations/[jobNumber]/reschedule-requests/route.ts` (`installations:update` scope, HTTP `202`).
  - `apps/fsm/app/api/v1/installations/[jobNumber]/cancellations/route.ts` (`installations:update` scope, terminal/`In Progress` guard, HTTP `200`).
  - Added unit tests for `OP-03` and `OP-04` in `apps/fsm/test/system-b-core.test.ts`.
- **Contract & Resilience Tests**:
  - `TC-15` in `packages/contract/test/contract.test.ts` (rejects >2000-char notes, offset-less timestamps, invalid statuses; verifies inert XSS handling)[cite: 6].
  - `TC-17` in `apps/store/test/system-a-store.test.ts` (tests full Circuit Breaker state transitions)[cite: 6].
- **Documentation & CI**:
  - Updated `docs/assumptions.md` (HMAC vs. OAuth rationale, PH phone regex `{8,10}` digits after `+63`, Vitest equivalence) and `PROGRESS.md`[cite: 6].
  - Verified `.github/workflows/ci.yml` and `.github/workflows/drain.yml`[cite: 6].

### Passing Verification Gates
- **Vitest Suite (`pnpm test`)**: `38 / 38 PASS` (across all 6 test files)
- **Contract Check (`node scripts/contract-check.mjs`)**: `16 / 16 PASS` (`CL-01` to `CL-16`)[cite: 6]
- **Demo Reset (`pnpm demo:reset`)**: `PASS` (restores clean seed baseline for both databases)[cite: 6]
- **Next.js Production Builds**: Store (`22` routes) `PASS` (0 errors); FSM (`19` routes) `PASS` (0 errors)

---

## 4. What Remains (Human Gate H7 & Live Walkthrough Support)
Only manual execution remains (`GAP-11` / **Human Gate H7** in `docs/human-gates.md`)[cite: 6]:
1. Reset databases (`pnpm demo:reset`) and run both apps (`pnpm dev` or `next dev` on ports `3000` and `3100`)[cite: 6].
2. Execute the 7-minute walkthrough in `docs/demo-script.md` and record `GoodHand_Demo_Backup.mp4`[cite: 6]:
   - Auto-dispatch on checkout (`OBJ-01`)[cite: 32]
   - Technician assignment & `409 SCHEDULE_CONFLICT` double-booking guard (`OBJ-02`)[cite: 32]
   - Simulated System B outage in `/demo`, outbox queueing, and idempotent queue drain recovery
   - Technician loading checklist gate, job completion with serial numbers, and real-time stock/warranty sync (`OBJ-03`)
   - 1-star technician feedback privacy boundary (`/technician/feedback` hides customer email/phone and store ratings)
   - `/demo` contract checks (`16/16`) and mail log verification
3. Sign off `docs/qa-checklist.md` (`QA-01` to `QA-34`) and push to GitHub[cite: 6].

### Seed Credentials for Testing
- **Store Customer**: `customer1@example.com` / `CustomerPassword123!`
- **Store Admin**: `admin@goodhand88.com` / `AdminPassword123!`
- **FSM Dispatcher**: `dispatcher1@fsm.local` / `DispatcherPass123!`
- **FSM Technician**: `arnel.mendoza@fsm.local` / `TechPassword123!`

## 5. Instructions for Codex
- Do **not** rewrite completed modules or alter the Zod/OpenAPI contracts unless fixing an actual bug discovered during the live manual walkthrough[cite: 6].
- Always read `@PROGRESS.md`, `@docs/demo-script.md`, and `@docs/qa-checklist.md` before making changes, and re-run `pnpm test` and `node scripts/contract-check.mjs` after any edit[cite: 6].