# Project Explanation: GoodHand Store & Field Service Management Integration

> **Document Purpose:** Detailed explanation of the system architecture, business rationale, technical mechanisms, and solved objectives for team members and evaluators.

---

## 1. Executive Summary

This project is an **enterprise systems integration prototype** connecting an E-Commerce Security Store (**System A**) with a Field Service Management & Dispatching Platform (**System B**). 

The target business domain is **GoodHand Security Products** (`shop.goodhand88.com`), a Philippine distributor of commercial and residential security equipment (CCTV kits, digital smart locks, electric fences, burglar alarms, and two-way radios). 

Because high-grade security equipment requires certified physical installation on-site, a standard e-commerce store alone is insufficient. Without inter-system automation, companies suffer from:
1. **Manual Data Re-Entry:** Orders taken online must be manually typed into dispatch tools, causing delays, transcription errors, and lost jobs.
2. **Technician Double-Booking:** Dispatchers accidentally book two overlapping jobs for the same technician.
3. **Inventory Discrepancies:** Units promised for upcoming installations get sold to walk-in customers, causing technicians to arrive on-site without hardware.
4. **Warranty & Feedback Disconnects:** Once a job is completed, warranty records are lost in paperwork, and customer complaints about technicians get tangled with store feedback.

This prototype solves all four challenges through an **asynchronous, resilient, contract-first architecture**.

---

## 2. High-Level Architecture & Monorepo Layout

The solution is engineered as a unified **pnpm monorepo** consisting of two Next.js 15 applications and four shared packages:

```
SYSINT_GOODHAND/
├── apps/
│   ├── store/             # System A: Storefront, Checkout, Inventory Ledger (Port 3000)
│   └── fsm/               # System B: Field Service Management & Tech Mobile App (Port 3100)
├── packages/
│   ├── contract/          # Single Source of Truth: OpenAPI 3.1 YAML, Spectral rules, Zod schemas
│   ├── logger/            # Pino structured logger with automatic PII redaction
│   ├── ui-tokens/         # Design tokens extracted from the GoodHand brand palette
│   └── ui/                # Shared UI components (PrototypeBanner, StatusChip, Button)
├── docs/                  # Architecture specs, runbooks, deployment guides, and demo scripts
└── scripts/               # Automation scripts for contract verification, cloning, and demo resets
```

### Communication Topology
- **System A (`apps/store` on `http://localhost:3000`):** Customer-facing storefront. Owns the product catalog, order lifecycle, payments, customer identities, and the authoritative **Stock Ledger**.
- **System B (`apps/fsm` on `http://localhost:3100`):** Operations-facing dispatch and technician portal. Owns technician profiles, service territories, qualification matrices, appointments, and hardware loading verification.
- **Inter-System Protocol:** 12 typed HTTP REST operations (**OP-01** to **OP-12**) governed by OpenAPI 3.1 (`packages/contract/openapi.yaml`). All asynchronous events travel through a **Transactional Outbox Engine** to guarantee reliable delivery even during network failures.

---

## 3. The 4 Core Objectives (How Each Was Solved)

### OBJ-01: 100% Automated Job Creation Without Manual Re-Entry
- **Workflow:** When a customer buys items requiring installation on System A and completes checkout, System A creates the order, reserves stock, and atomically writes an `OP-01` message into its `outbox_messages` table in the same transaction.
- **Delivery:** The outbox engine immediately attempts delivery to System B (`POST /api/v1/installations`).
- **Result:** The job appears instantly in System B's Dispatcher Queue as `Pending Scheduling` with customer contact details, delivery address, ordered SKUs, quantities, and preferred time window. No manual re-typing is ever required.

### OBJ-02: Zero Double-Booking via PostgreSQL GiST Exclusion Constraint
- **The Problem:** In concurrent dispatch systems, simple `SELECT` checks before `INSERT` suffer from race conditions: two dispatchers can assign the same technician to overlapping slots at the exact same millisecond.
- **The Solution:** System B models appointments using PostgreSQL range types (`tstzrange`) and enforces an exclusion constraint at the database level:
  ```sql
  EXCLUDE USING gist (technician_id WITH =, period WITH &&) WHERE (status = 'active')
  ```
- **Result:** If an overlapping appointment is attempted, the database kernel strictly rejects the transaction with error code `23P01` (`exclusion_violation`). System B translates this into an RFC 7807 compliant `409 SCHEDULE_CONFLICT` response and returns the next 3 available free slots.

### OBJ-03: Mathematical Stock Ledger & Hardware Loading Gate
- **Stock Ledger Invariant:** System A maintains three continuous values per SKU: `on_hand`, `reserved`, and `available = on_hand - reserved`. The database enforces:
  $$0 \le \text{reserved} \le \text{on\_hand} \implies \text{available} \ge 0$$
- **Hardware Loading Checklist Gate:** When a technician opens their mobile app (`/technician`), the "Start Job" button is strictly locked. The server enforces that status cannot transition from `Scheduled` to `In Progress` until **100% of ordered units** are physically verified and confirmed loaded into the vehicle.
- **Completion & Warranty:** Upon job completion, the technician submits serial numbers for used units and accounts for returned unused units. System B dispatches:
  - `OP-07`: System A sets the order `fulfilled` and activates an exact **12-month hardware warranty** linked to each verified serial number.
  - `OP-08`: System A reconciles the stock ledger using unique `transactionId`s, decrementing `on_hand` and releasing `reserved`.

### OBJ-04: Customer Feedback with Strict Privacy Boundary Routing
- **The Problem:** Customers should review both the technician's on-site workmanship and the store's e-commerce shopping experience, but internal store ratings and customer contact info must **never** leak into the field technician's view.
- **The Solution (CL-15 Privacy Boundary):**
  - Customer completes a two-part review on the completed order page.
  - System A stores both parts internally.
  - System A constructs an `OP-10` payload that transmits **only** `{ rating, comment, technicianTags, customerFirstName, submittedAt }` to System B.
  - System B strictly rejects any payload containing store tags or contact fields with `422 VALIDATION_FAILED`.
  - Technicians in `/technician/feedback` can only see verified reviews with the customer's first name, with IDOR isolation (`404` if querying another technician's reviews). Low ratings ($\le 2$) automatically flag for review and open a manager follow-up.

---

## 4. Key Architectural Mechanisms

### 4.1 Transactional Outbox & Resilient Delivery
1. **At-Least-Once Delivery:** Mutations write both local domain records and an outbox record in a single database transaction. Network crashes cannot leave state desynchronized.
2. **Immediate Dispatch:** The outbox tries an immediate delivery. If the partner is unreachable, the message is scheduled for background retry using exponential backoff (10s, 20s, 30s, 40s in demo mode).
3. **Circuit Breaker:** After 5 consecutive HTTP 503 failures, the circuit trips to `OPEN` for 30 seconds to prevent resource exhaustion, then transitions to `HALF-OPEN` for a single trial request.
4. **Vercel Execution Budget Cutoff:** The background drain worker enforces a **6,000 ms timer cutoff** to guarantee that long batch flushes exit before hitting Vercel's 10-second serverless ceiling.

### 4.2 Idempotency Everywhere (CL-07, CL-12)
- Every inter-system mutation sends a unique UUID v4 `Idempotency-Key` header.
- The receiver computes a SHA-256 hash of the payload and caches the response in `processed_messages`.
- Resending the same payload with the same key returns the cached response (`200 OK`) without duplicating records, charging payments twice, or creating extra jobs.
- Resending the same key with a modified payload is caught and rejected with `409 IDEMPOTENCY_KEY_CONFLICT`.

### 4.3 Security & PII Redaction
- **No Plaintext Secrets:** HS256 JWT tokens for service-to-service auth with strict granular scopes (`installations:create`, `feedback:write`, `stock:read`, etc.).
- **PII Scrubbing:** Pino structured logging automatically redacts passwords, JWT tokens, credit card numbers, phone numbers, email addresses, and postal addresses from application log streams.

---

## 5. Summary of System Pages & Capabilities

| URL Path | App | Purpose / Capabilities |
|---|---|---|
| `http://localhost:3000` | Store (A) | GoodHand catalog (24 real products across 7 categories, filterable, real PHP prices) |
| `http://localhost:3000/cart` | Store (A) | Cart management with live stock ledger availability checks |
| `http://localhost:3000/checkout` | Store (A) | Login-gated checkout with installation toggle, window picker, address selector |
| `http://localhost:3000/orders/[id]` | Store (A) | Order tracking timeline, assigned technician display, serial numbers, 12mo warranties |
| `http://localhost:3000/demo` | Store (A) | Presentation panel: simulate partner outage, force payment failure, flush outbox, view mail log |
| `http://localhost:3000/privacy` | Store (A) | Academic prototype disclaimer and data privacy boundary disclosure |
| `http://localhost:3000/terms` | Store (A) | Terms of prototype demonstration and safe-harbor evaluation boundaries |
| `http://localhost:3100` | FSM (B) | Dispatcher console: job queue, technician assignment, calendar, conflict checks |
| `http://localhost:3100/technician` | FSM (B) | Mobile-first technician view with mandatory hardware loading checklist & completion form |
| `http://localhost:3100/technician/feedback` | FSM (B) | Technician review view showing ratings, tags, and customer first name (IDOR protected) |
| `http://localhost:3100/demo` | FSM (B) | FSM presentation panel: simulate outage, view outbox buffer, low-rating follow-up queue |
| `http://localhost:3100/privacy` | FSM (B) | Field service privacy policy and customer contact masking rules |
| `http://localhost:3100/terms` | FSM (B) | Field operations evaluation terms and GiST constraint rules |
