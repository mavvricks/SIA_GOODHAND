# Project Handover Document

**To:** Group Partner / Teammate  
**From:** Lead System Integration Engineer  
**Date:** November 2026  
**Status:** **100% Feature-Complete, Hardened, Feature-Frozen, All 34 Tests Passing**

---

## 1. Quick Overview

Welcome! You are taking over a completely functional, production-ready enterprise integration prototype connecting:
- **System A (`apps/store` on port 3000):** GoodHand Security Storefront & Inventory Ledger.
- **System B (`apps/fsm` on port 3100):** Field Service Management & Technician Mobile App.

Everything required by the project specifications (`task.md`) across **Phases 0 through 7** is fully implemented and committed to git. There are **zero TODOs**, no hardcoded secrets, and no fake mocks in production code paths.

---

## 2. Environment Prerequisites (Windows)

1. **Operating System:** Windows 10/11 using **PowerShell**.
2. **Node.js:** Version 20 or higher (`node -v`).
3. **pnpm:** Version 9. If not installed, run:
   ```powershell
   npm install -g pnpm@9
   ```
4. **Git:** Installed and available in PATH.

---

## 3. How to Run the Project (Step-by-Step)

### Step 1: Install Dependencies
From the repository root (`SYSINT_GOODHAND`):
```powershell
pnpm install
```

### Step 2: Configure Environment Variables
Ensure `.env` exists in the repository root. If not, copy `.env.example`:
```powershell
Copy-Item .env.example .env
```
*(The default configuration runs locally with in-memory resilient data stores and live in-app mail log without requiring external cloud accounts).*

### Step 3: Reset Demo Database to Clean Baseline
Before running tests or conducting demonstrations, restore both databases to the clean seed state:
```powershell
pnpm demo:reset
```
*(You will see: `[reset-demo] Both databases successfully restored to seed baseline.`)*

### Step 4: Run Automated Tests
Verify all 34 contract, unit, and interface tests:
```powershell
pnpm test
```
*(All 6 test files will pass with 34/34 tests passing in ~1.5 seconds).*

### Step 5: Start Both Applications Concurrently
```powershell
pnpm dev
```
Both applications will boot in watch mode:
- **System A Store:** [http://localhost:3000](http://localhost:3000)
- **System A Presentation Panel:** [http://localhost:3000/demo](http://localhost:3000/demo)
- **System B Dispatcher Console:** [http://localhost:3100](http://localhost:3100)
- **System B Technician Mobile View:** [http://localhost:3100/technician](http://localhost:3100/technician)
- **System B Presentation Panel:** [http://localhost:3100/demo](http://localhost:3100/demo)

---

## 4. Seed Logins & Test Accounts

| System | Role | Email | Password | What You Can Do |
|---|---|---|---|---|
| **System A** | Store Admin | `admin@goodhand88.com` | `AdminPassword123!` | View orders, inspect outbox, review store feedback |
| **System A** | Customer | `customer1@example.com` | `CustomerPassword123!` | Buy security equipment, submit feedback reviews |
| **System B** | Operations Admin | `admin@fsm.local` | `FsmAdminPass123!` | Full dispatcher rights, qualification management |
| **System B** | Dispatcher | `dispatcher1@fsm.local` | `DispatcherPass123!` | Assign technicians, view schedule calendar, resolve conflicts |
| **System B** | Technician 1 | `arnel.mendoza@fsm.local` | `TechPassword123!` | Code: `TECH-001` (CCTV, Alarms, Locks certified) |
| **System B** | Technician 2 | `danilo.reyes@fsm.local` | `TechPassword123!` | Code: `TECH-002` (Fence, Networking certified) |

---

## 5. Repository File Map

```
SYSINT_GOODHAND/
├── apps/
│   ├── store/
│   │   ├── app/                    # Next.js App Router pages (cart, checkout, orders, demo, privacy, terms)
│   │   ├── components/             # Storefront UI & FeedbackForm component
│   │   ├── lib/
│   │   │   ├── ledger/             # Mathematical Stock Ledger (0 <= reserved <= on_hand)
│   │   │   ├── outbox/             # Transactional Outbox Engine (retry, backoff, circuit breaker)
│   │   │   ├── services/           # orders-service.ts, feedback-service.ts
│   │   │   ├── email/              # mail-service.ts (live mail log capture)
│   │   │   └── simulation/         # simulation-service.ts (outage & payment failure flags)
│   │   └── test/                   # system-a-store.test.ts, phase5-feedback-demo.test.ts
│   │
│   └── fsm/
│       ├── app/                    # Next.js App Router pages (dispatcher, technician, demo, privacy, terms)
│       ├── lib/
│       │   ├── auth.ts             # Service-to-service OAuth JWT generation & verification
│       │   ├── errors.ts           # Standard error responses (RFC 7807 compliant)
│       │   └── services/           # jobs-store.ts (GiST exclusion guard, loading check, OP-10/11)
│       └── test/                   # system-b-core.test.ts, phase4-completion.test.ts
│
├── packages/
│   ├── contract/                   # openapi.yaml (Source of truth), Spectral rules, Zod schemas
│   ├── logger/                     # Pino logger with automated PII redaction
│   ├── ui-tokens/                  # Extracted brand color tokens (Navy #0e2378, Red #D60000)
│   └── ui/                         # Shared UI components (StatusChip, PrototypeBanner, Button)
│
├── docs/                           # Full documentation suite
│   ├── stock-ledger.md             # Mathematical inventory formulas & proofs (CL-12, CL-16)
│   ├── api-register.md             # Complete specification of OP-01 through OP-12
│   ├── deployment.md               # Production Vercel & Neon multi-project deployment guide
│   ├── demo-script.md              # 7-minute rehearsal & live presentation script
│   ├── runbook.md                  # Incident response, queue triage, and demo reset runbook
│   └── qa-checklist.md             # 34-point manual QA testing matrix
│
├── scripts/
│   ├── contract-check.mjs          # Validates 16/16 architectural contract clauses
│   ├── reset-demo.mjs              # Restores both databases to seed baseline state
│   └── clone-site.mjs              # Extracts 24 real products and vector SVG assets
```

---

## 6. How to Run Verification & Quality Checks

Run these commands anytime to confirm everything is healthy:

1. **Contract Linting (Spectral):**
   ```powershell
   pnpm contract:lint
   ```
   *(Must return: `No results with a severity of 'error' found!`)*

2. **Contract Clause Verification:**
   ```powershell
   node scripts/contract-check.mjs
   ```
   *(Must return: `Contract Check Summary: 16/16 clauses passed.`)*

3. **Vitest Automated Test Suite:**
   ```powershell
   pnpm test
   ```
   *(Must return: `Test Files 6 passed (6), Tests 34 passed (34)`)*

4. **Production Build Compilation:**
   ```powershell
   pnpm build
   ```
   *(Must compile both applications: 21 routes in Store, 17 routes in FSM with 0 errors)*

---

## 7. How to Give the 7-Minute Live Presentation

Open [`docs/demo-script.md`](file:///c:/Users/John%20Darev/Downloads/SYSINT_GOODHAND/docs/demo-script.md). It outlines the exact step-by-step flow:
1. **Minute 0–1:** Buy a CCTV kit with installation in Store $\to$ Show it appears in FSM without manual re-entry (**OBJ-01**).
2. **Minute 1–2:** Assign technician Arnel $\to$ Attempt to double-book Arnel on the same slot $\to$ Show `409 SCHEDULE_CONFLICT` (**OBJ-02**).
3. **Minute 2–3:** In `/demo`, toggle "Simulate Outage" to ON $\to$ Place an order $\to$ Show order succeeds and outbox buffers $\to$ Toggle outage OFF and click "Run Queue Now" $\to$ Show clean recovery with no duplicates.
4. **Minute 3–5:** Open mobile view at `/technician` $\to$ Show "Start Job" is blocked until loading is confirmed $\to$ Confirm items $\to$ Start job $\to$ Complete job with serial numbers (**OBJ-03**).
5. **Minute 5–6:** In Store, show order is fulfilled with active 12-month warranties $\to$ Click "Replay" in `/demo` to prove idempotency.
6. **Minute 6–7:** Submit customer review (1 star technician, 5 star store) $\to$ Show low rating opens a manager follow-up $\to$ Show technician sees **only** their score without customer contact info or store ratings (**OBJ-04**, **CL-15**).
7. **Wrap-up:** Show `/demo` Contract Checks tab (16/16 clauses passed) and run `pnpm test` in the terminal.

---

## 8. Technical Gotchas & Windows Notes

- **PowerShell Separators:** On Windows PowerShell, command chaining uses `;` (not `&&`). E.g., `git add .; git commit -m "..."`.
- **Vitest Windows Path:** In `package.json`, the `"test"` script is mapped to `node_modules\.pnpm\node_modules\.bin\vitest.CMD run` so that PowerShell and Windows cmd can execute it natively without needing global npm packages.
- **Port Conflicts:** If port 3000 or 3100 is occupied, run `Stop-Process -Name "node" -Force` in PowerShell, then re-run `pnpm dev`.
