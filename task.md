# task.md v3.1: GoodHand Store + Field Service Integration (7-day Vercel prototype)

## 0. AGENT PROTOCOL (READ FIRST)

### 0.1 Rules
- Work in the phases in section 10. Do not start a phase until its acceptance checks pass.
- After each phase: build, run, run the phase's tests, fix every error. Commit as `phase-N: <what changed and why>`.
- No TODO comments, placeholder text, hard-coded secrets, or fake data in production code. Fixtures are allowed only in tests; demo data only through the seed scripts.
- `packages/contract/openapi.yaml` is the authority for every message between the two systems. If code and spec disagree, fix the code.
- Do not skip any MUST item. If one cannot be completed, stop and report.
- Follow the separate ANTI-SLOP RULES file if it is provided.

### 0.2 Time and scope (7 days)
- Items are tagged **[MUST]**, **[SHOULD]**, **[COULD]**. Finish every MUST first. Build SHOULD only after all MUST in that phase pass. Build COULD only if a later phase is ahead of schedule.
- Feature freeze at the end of Day 6. Day 7 is bug fixes and rehearsal only.
- If a MUST is at risk of missing its day, cut SHOULD and COULD work first and report it in `PROGRESS.md`.

### 0.3 Progress file
- Create `PROGRESS.md` in Phase 0. Update it at the end of every phase and whenever you stop. One row per phase (`not started`, `in progress`, `done`, `blocked`), the last completed item, decisions made, assumptions added, open blockers, and the last command that ran successfully.
- At the start of each session read `PROGRESS.md`, sections 0 to 3, and only the phase you are about to run.

### 0.4 Decide, ask, or stop
- **Decide and record** anything not listed below in `docs/assumptions.md`.
- **Stop and report** when: a credential, account, domain, or paid service is needed and not provided; two sections contradict each other and the spec cannot settle it; an acceptance check still fails after three fix attempts; an action would touch the live GoodHand website or real customer data; a change would break a published contract version.
- Report format: what you were doing, what failed, what you tried, the smallest question that unblocks you.

### 0.5 Human gates
Items tagged `[HUMAN]` need the person. Write instructions for each in `docs/human-gates.md`, mark `pending human` in `PROGRESS.md`, and continue with any work that does not depend on them. Never tick a `[HUMAN]` box.
- H1: Vercel account, GitHub repository, Vercel linked to the repository.
- H2: Two Neon Postgres databases (`store_db`, `fsm_db`) provisioned through the Vercel Marketplace, plus one test branch each.
- H3: Cheap domain purchased in Vercel (name must not contain "goodhand").
- H4: Resend installed from the Vercel Marketplace against that domain; DNS auto-configured.
- H5: GitHub repository secrets `CRON_SECRET` and the two app base URLs for the queue-drain workflow.
- H6: Message to GoodHand informing them of the class prototype (recommended, not blocking).
- H7: Rehearsal with the group, and a backup screen recording of the full demo.

*Non-blocking rule for early phases:* Work in Phase 0 (scaffolding, crawler/fallback extraction, token generation) and Phase 1 contract definition does not require H2/H3 to be active. H2 is only mandatory prior to executing database migrations and database-backed test suites.

### 0.6 Windows rules
- Node 20 LTS, pnpm 9, Git. No Docker, no WSL, no bash scripts. Every script is a Node (`.mjs`) script run through `pnpm` scripts, and works in PowerShell.
- Build paths with `path.join`. Add `.gitattributes` with `* text=auto eol=lf`. Keep dev memory use low: run one dev server per app, not both unless integration-testing.
- All tests that need a database use the Neon test branch from H2 (`TEST_DATABASE_URL`), or a local PostgreSQL instance / `@electric-sql/pglite` harness for fast offline testing where extensions allow. The Neon test branch remains the final acceptance check for `btree_gist` exclusion constraints.

---

## 1. PROJECT OVERVIEW

### 1.1 Purpose
GoodHand Security Products Corp sells security hardware through `shop.goodhand88.com`. Installation needs a technician. Today staff re-type orders for technicians, dispatchers double-book, stock differs between sales and field teams, technicians can arrive without the ordered hardware, and customers have no structured way to give feedback.

This project builds a working **prototype**: a copy of the store (**System A**), a new Field Service Management app (**System B**), a versioned API contract between them, a stock ledger both agree on, and a customer feedback feature covering the technician and the store. It is a class project and is not connected to GoodHand's real systems.

### 1.2 Prototype safety rules (mandatory)
- A permanent banner on every page of both apps: "Student prototype. Not the real GoodHand store. Do not enter real personal or payment details."
- `X-Robots-Tag: noindex, nofollow` and `robots.txt` disallow-all on both apps.
- Only fake seed data and fake sample customers. No real payment processing. No real customer data is ever collected.
- Do not hotlink or send traffic to the live site except for the one-time copy in Phase 0. Store copied images locally.
- The domain, app names, and page titles say "Prototype" and do not contain "goodhand".

### 1.3 Roles
| System | Role | Description |
|---|---|---|
| A | `customer` | Browses, buys, requests installation, tracks the job, cancels or reschedules within rules, views warranty, gives feedback |
| A | `store_admin` | Manages products and stock, orders, refunds, store feedback, failed messages, audit log |
| B | `dispatcher` | Reviews jobs, assigns technicians, reschedules, cancels, handles technician-feedback follow-ups |
| B | `technician` | Sees assigned jobs, confirms hardware loaded, starts and completes jobs, views own feedback |
| B | `admin` | Manages users, technicians, settings, failed messages, audit log, all feedback |
| Both | `service_client` | Non-human identity for service-to-service calls |

### 1.4 Objectives (each traceable to an operation and a test)
| ID | Objective | Target | Served by | Proven by |
|---|---|---|---|---|
| OBJ-01 | No manual re-entry of order data to technicians | 100% of installation orders create a job in System B automatically | OP-01 | TC-01, TC-03, E2E-01 |
| OBJ-02 | No technician double-booking | 0 overlapping active appointments | OP-01, OP-05 | TC-11, E2E-02 |
| OBJ-03 | Consistent stock, and no technician arriving without the ordered hardware | Ledger invariants in section 6.9 hold; 0 duplicate movements; a job cannot start until every ordered item is confirmed loaded | OP-07, OP-08, OP-12 | TC-04, TC-09, TC-30, TC-34, E2E-03 |
| OBJ-04 | Customer feedback on technician and store, with technician feedback routed to the field team | Invitation within 1 hour of completion (1 minute in demo mode); technician feedback reaches System B once; ratings of 1 or 2 open a follow-up | OP-10, OP-11 | TC-19 to TC-29, E2E-06 |

### 1.5 Out of scope
Real payments and refunds, multi-currency, native apps, SMS, supplier purchasing, branch-level or van-level stock, returns after completion, public reviews, live cutover to GoodHand's real site.

---

## 2. DECISIONS (recorded business rules and assumptions)

| # | Area | Decision |
|---|---|---|
| D1 | Site copy & fallback | In Phase 0 crawl public pages with `scripts/clone-site.mjs`, save HTML, CSS, fonts, and images locally, and rebuild as Next.js pages. Copy only public content. **Fallback:** If `shop.goodhand88.com` is inaccessible, rate-limited, bot-blocked, or fails, the script must automatically fall back to an included curated seed catalog of 24 realistic products across the 7 categories and generated design tokens, ensuring work is never blocked. |
| D2 | Installation required | Mandatory for CCTV, alarms, smart locks, access control, electric fences. Optional for radios, networking, storage (the customer can opt in at checkout). |
| D3 | Installation price | Standard installation is free, shown as "Installation: Included". A setting `installation_fee_php` (default 0) exists but is not shown unless above 0. |
| D4 | Non-installed items | No shipping. The order shows "Ready for pickup"; `store_admin` marks it picked up. |
| D5 | Payment | Simulated. Checkout shows "Pay now (simulated)" with a test card helper. A demo toggle forces a payment failure. |
| D6 | Warranty | 12 months for all products. `warranty_months` per product is editable in the seed. |
| D7 | Cancellation | Rules in section 6.7. |
| D8 | Refunds | Status only. `store_admin` marks `refunded`. |
| D9 | Service areas | Metro Manila, Cavite, Laguna, Bulacan. One stock pool per SKU. |
| D10 | Job duration | 2 hours per job, 4 hours if electric fence or access control items are present. Editable by `admin`. |
| D11 | Quote flow | Lead capture form is MUST. Full quote and acceptance flow is COULD. |
| D12 | Scale | Seed 24 products, 6 technicians, 3 customers, 12 historical orders. |
| D13 | Feedback timing | Allowed within 30 days of completion; editable for 7 days; invitation 1 hour after completion (`DEMO_MODE`: 1 minute); one reminder after 5 days. |
| D14 | Technician ratings | Technicians see their own ratings with the customer's first name only. A rating of 1 or 2 opens a follow-up, with no automatic penalty. A technician can press "Request review" on a rating; `admin` sees flagged items **[COULD]**. |
| D15 | Retention and privacy | Audit logs 12 months. The privacy page states that the prototype holds fake data only and names the team's contact email. |
| D16 | Locale | English, PHP (₱), display time zone `Asia/Manila`. API timestamps are RFC 3339 with offset (`Z` allowed). Phone numbers are stored as `+63` plus 9 or 10 digits (mobile and landline); the UI accepts `09XXXXXXXXX`, `02XXXXXXXX`, and `+63...` and normalizes. |
| D17 | Auth & Sessions | Browser sessions use independent signed httpOnly, Secure, SameSite=Lax cookies per application (`store_session` on System A, `fsm_session` on System B; host-only, not shared across subdomains). Service calls: client-credentials tokens (HS256, 15 minutes), one scope per operation. Webhook calls (B-to-A) carry **both** the scoped Bearer token and `X-Signature` (`sha256=` HMAC of `timestamp + "." + body`) with `X-Timestamp`, rejected if more than 5 minutes off. |
| D18 | Email verification | Implemented, but `REQUIRE_EMAIL_VERIFICATION=false` by default until Resend is verified (H4). |
| D19 | Retry policy | 5 attempts in total. No retry on 400, 401, 403, 404, 409, 422. Retry on network errors, 408, 429, 5xx. After the fifth failure, move to the failed queue and alert the admin. Failed messages are kept 30 days. Replay reuses the original `Idempotency-Key`. |
| D20 | Timeouts and circuit breaker | Connect 2 s, read 5 s. Breaker opens after 5 consecutive failures, stays open 30 s, then allows one trial. Breaker state is stored in the database (`circuit_state`) because serverless functions share no memory. |
| D21 | Versioning | `v1` in the URL path. Additive optional fields are non-breaking. Breaking changes need `v2`, with `v1` kept 90 days after announcement. |
| D22 | Customer account on quote link | Customers set a password on the quote accept page **[COULD]**. |
| D23 | Contract strictness | Unknown request fields are rejected with `VALIDATION_FAILED`. |
| D24 | Coverage | At least 70% unit coverage on service-layer code in both apps (reduced from 80% for the 7-day schedule). |

---

## 3. STACK & ARCHITECTURE

### 3.1 Stack
| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) | One language, shared types |
| Apps | Next.js 15 (App Router) for `store` and `fsm`; each app serves its UI and its `/api` routes | Simplest deployment on Vercel |
| Styling | Tailwind CSS, Radix UI primitives (shadcn/ui components), Lucide icons | Fast, accessible |
| Database | Neon Postgres via Vercel Marketplace, one database per system | Free tier, supports `btree_gist` for the exclusion constraint |
| DB access | Drizzle ORM and drizzle-kit migrations; `@neondatabase/serverless` Pool (WebSocket) for any code that needs transactions | Typed SQL, real transactions |
| Contract | OpenAPI 3.1 and JSON Schema in `packages/contract`; Spectral (lint); Ajv (validation in tests); Prism (mock servers) | Node-only tooling |
| Validation | Zod schemas generated from the JSON Schema by `contract:generate` (never hand-edited); CI fails on a diff | One schema source |
| Auth | `jose` for tokens, `@node-rs/argon2` for passwords (fall back to `bcryptjs` if the native build fails; record in assumptions) | Standard libraries |
| Email | Resend via Vercel Marketplace; React Email templates; a mail-log table as the fallback transport | Works before the domain is verified |
| Tests | Vitest, Supertest-style route tests, Playwright with axe | Reproducible |
| Quality | ESLint, Prettier, `tsc --noEmit`, Spectral | Enforced in CI |
| Logging | Pino through a shared `packages/logger` with redaction | Structured logs |
| Hosting | Vercel (Hobby plan, non-commercial class use) | As requested |
| Scheduler | GitHub Actions workflow every 5 minutes plus one daily Vercel Cron | Hobby cron is once per day |

### 3.2 Topology
- Two Vercel projects from one monorepo: `store` at `shop.<domain>` and `fsm` at `field.<domain>`. Local dev uses `localhost:3000` (store) and `localhost:3100` (fsm).
- The two apps call each other only through the contract (HTTP). Neither reads the other's database.
- Sessions are isolated: `store_session` on System A, `fsm_session` on System B.
- Source of truth: System A owns customers, orders, payments, catalog, stock, warranties, feedback. System B owns schedules, job progress, hardware loaded and installed, and technician-side feedback copies.

### 3.3 Reliable delivery on Vercel
1. A state-changing message (OP-01, OP-03 to OP-08, OP-10, OP-11) is written to the sender's `outbox_messages` in the same transaction as the business change.
2. **Immediate attempt:** after the response is sent (`after()`), the sender tries delivery once, then up to two quick retries (1 s, 2 s) inside the function. Anything still failing keeps `status = pending` with `next_attempt_at`.
3. **Drain endpoint** `POST /api/internal/drain` (bearer `CRON_SECRET`): picks due rows with `FOR UPDATE SKIP LOCKED`, batch of 20, delivers each under the retry policy. 
   - **Execution budget safety:** Before picking or processing each message, the worker checks `Date.now() - startTime < 6000ms`. If over 6 seconds, the loop stops cleanly, preventing Vercel 10s serverless function timeouts mid-transaction.
   - Retry spacing: 1 minute, 5 minutes, 15 minutes, 1 hour (attempts 2 to 5). In `DEMO_MODE` spacing is 10, 20, 30, 40 seconds.
4. The drain runs from: the GitHub Actions workflow every 5 minutes (H5); a daily Vercel Cron as a safety net; any admin "Run queue now" button; and opportunistically at the end of any API request in the app that has pending rows older than 2 minutes (bounded to 1 row per request).
5. Duplicate protection: `processed_messages` keyed by `Idempotency-Key` with a request hash. A replay returns the stored response. A reused key with a different body returns 409 `IDEMPOTENCY_KEY_CONFLICT`.
6. Every outbound HTTP call goes through the circuit breaker (D20).
7. `scheduler` jobs (run by the same drain trigger): invitation and reminder emails, feedback lock after 7 days, outbox age alert (older than 15 minutes), failed-message purge, stale job alert (`Pending Scheduling` over 4 hours), catalog sync for System B (OP-09, on demand and daily).
8. Keep every function under 10 seconds.

### 3.4 Repo layout
```
prototype/
├─ PROGRESS.md  .gitattributes  .env.example  README.md
├─ apps/
│  ├─ store/   (app/, components/, lib/{db,auth,ledger,outbox,contract-client,email}, db/{schema,migrations,seed}, emails/, public/_clone/)
│  └─ fsm/     (same structure)
├─ packages/
│  ├─ contract/   (openapi.yaml, schemas/, examples/, generated/)
│  ├─ logger/
│  ├─ ui-tokens/
│  └─ ui/         (shared components)
├─ scripts/       (clone-site.mjs, reset-demo.mjs, contract-check.mjs)
├─ docs/          (assumptions, constraints, human-gates, stock-ledger, runbook, api-register, deployment, qa-checklist, demo-script)
└─ .github/workflows/{ci.yml, drain.yml}
```

### 3.5 Environment variables (`.env.example`, no real secrets)
```
# shared
NODE_ENV=development
LOG_LEVEL=debug
DEMO_MODE=true

# store
STORE_DATABASE_URL=postgres://...store_db
STORE_TEST_DATABASE_URL=postgres://...store_test
STORE_PUBLIC_URL=http://localhost:3000
STORE_SESSION_SECRET=CHANGE_ME_64_RANDOM_CHARS
STORE_FSM_BASE_URL=http://localhost:3100/api/v1
STORE_SERVICE_CLIENT_ID=store-service
STORE_SERVICE_CLIENT_SECRET=CHANGE_ME
STORE_WEBHOOK_SIGNING_SECRET=CHANGE_ME
CRON_SECRET_STORE=CHANGE_ME
INSTALLATION_INTEGRATION_ENABLED=true
REQUIRE_EMAIL_VERIFICATION=false

# fsm
FSM_DATABASE_URL=postgres://...fsm_db
FSM_TEST_DATABASE_URL=postgres://...fsm_test
FSM_PUBLIC_URL=http://localhost:3100
FSM_SESSION_SECRET=CHANGE_ME_64_RANDOM_CHARS
FSM_STORE_BASE_URL=http://localhost:3000/api/v1
FSM_SERVICE_CLIENT_ID=fsm-service
FSM_SERVICE_CLIENT_SECRET=CHANGE_ME
FSM_WEBHOOK_SIGNING_SECRET=CHANGE_ME
CRON_SECRET_FSM=CHANGE_ME

# email (Resend; leave empty to use the in-app mail log)
RESEND_API_KEY=
MAIL_FROM=no-reply@CHANGE_ME_DOMAIN

# policy
HTTP_CONNECT_TIMEOUT_MS=2000
HTTP_READ_TIMEOUT_MS=5000
RETRY_MAX_ATTEMPTS=5
CIRCUIT_FAILURE_THRESHOLD=5
CIRCUIT_OPEN_SECONDS=30
FEEDBACK_WINDOW_DAYS=30
FEEDBACK_EDIT_DAYS=7
CUSTOMER_CANCEL_MIN_HOURS_BEFORE=24
CUSTOMER_MAX_RESCHEDULES=2
```

---

## 4. DATA MODEL

All tables have `id` (UUID), `created_at`, `updated_at`, and `created_by` where a user acts. Soft delete (`deleted_at`) on users, products, and feedback only. Enable `btree_gist` in the System B migration.

### 4.1 System A (`store_db`)
- `users`: email (unique, citext), password_hash, role (`customer`, `store_admin`), full_name, phone, email_verified_at, failed_login_count, locked_until.
- `addresses`: user_id, line1, line2, city, province, postal_code.
- `products`: sku (unique), name, category (cctv, radios, locks, alarms, fence, network, storage), brand, price_php, requires_installation, warranty_months, image_path, description, active.
- `inventory`: product_id (unique), on_hand (≥ 0), reserved (≥ 0), CHECK (reserved ≤ on_hand). `available` = on_hand − reserved.
- `stock_movements`: product_id, on_hand_delta, reserved_delta, reason (`reservation`, `reservation_release`, `install_use`, `replacement_use`, `direct_sale`, `manual_adjustment`), order_id, job_number, transaction_id (unique).
- `carts`, `cart_items`: user_id; cart_id, product_id, quantity (1 to 99).
- `orders`: order_number (unique `GH-YYYYMMDD-NNNNNN`), user_id, status (`pending_payment`, `paid`, `fulfilled`, `cancelled`), total_php, include_installation, installation_address_id, contact_name, contact_phone, contact_email, preferred_start, preferred_end, special_instructions (≤ 500), cancelled_by, cancel_reason, cancelled_at, idempotency_key (unique).
- `order_items`: order_id, product_id, quantity (1 to 99), unit_price_php.
- `payments`: order_id, amount_php, status (`pending`, `paid`, `failed`, `refund_pending`, `refunded`), method (`simulated`), reference.
- `leads`: name, mobile, city, service_needed, message (≤ 500), status.
- `installation_requests`: order_id (unique), job_number, job_status (six statuses), technician_name, scheduled_start, scheduled_end, reschedule_count, last_synced_at.
- `installed_units`: order_id, job_number, product_id, serial_number (unique per product), installed_at.
- `warranties`: installed_unit_id (unique), starts_on, ends_on, status.
- `feedback`: order_id (unique), user_id, job_number, technician_rating (1 to 5, nullable), technician_comment (≤ 1000), technician_tags (text[]), store_rating (1 to 5, nullable), store_comment (≤ 1000), store_tags (text[]), submitted_at, locked_at, hidden, hidden_reason; CHECK (technician_rating IS NOT NULL OR store_rating IS NOT NULL).
- `feedback_responses`, `feedback_followups` (feedback_id, part, status `open`/`in_progress`/`resolved`, assigned_to, resolution_note), `feedback_invitations` (order_id, invite_due_at, invite_sent_at, reminder_due_at, reminder_sent_at).
- `notifications`, `mail_log` (to, subject, body_html, sent_via, status), `sessions`, `email_tokens`, `rate_limits` (key, window_start, count), `circuit_state` (target, state, failures, opened_at), `simulation_flags` (key, value).
- `outbox_messages` (operation_id, payload jsonb, idempotency_key unique, correlation_id, status, attempts, next_attempt_at, last_error_category), `processed_messages` (idempotency_key unique, operation_id, request_hash, response_status, response_body), `failed_messages` (outbox_message_id, final_error, failed_at, replayed_at, discarded_reason, purge_after), `audit_logs` (actor_id, actor_role, action, entity, entity_id, correlation_id, outcome, metadata without personal data).

Tag enums (never mixed):
- Technician tags (`technician_tags`, sent in OP-10/OP-11): `on_time`, `late`, `professional`, `unprofessional`, `clean_work`, `messy_work`, `explained_clearly`.
- Store tags (`store_tags`, never leave System A): `product_quality`, `product_issue`, `easy_checkout`, `checkout_problem`, `good_communication`, `poor_communication`.

### 4.2 System B (`fsm_db`)
- `users` (email, password_hash, role `dispatcher`/`technician`/`admin`, full_name, phone, active, must_change_password), `technicians` (user_id, employee_code, active), `service_areas` (name, cities text[]), `technician_service_areas`, `qualifications` (codes `CCTV`, `SMART_LOCK`, `ACCESS_CONTROL`, `ALARM`, `ELECTRIC_FENCE`, `RADIO`), `technician_qualifications`, `catalog_products` (sku, name, required_qualification_id, synced_at).
- `jobs`: job_number (unique `JOB-YYYYMMDD-NNNNNN`), order_number (unique), customer_name, customer_phone, customer_email, address jsonb, service_area_id, status (six statuses), preferred_start, preferred_end, special_instructions, idempotency_key (unique), version (optimistic lock).
- `job_items` (job_id, sku, quantity), `job_item_loading` (job_item_id unique, loaded_quantity, confirmed_by, confirmed_at).
- `appointments`: job_id, technician_id, period (tstzrange), status (`active`, `released`); **`EXCLUDE USING gist (technician_id WITH =, period WITH &&) WHERE (status = 'active')`**.
- `job_status_history`, `completion_reports` (job_id unique, completed_at, result, notes ≤ 2000), `installed_units` (completion_report_id, sku, serial_number, quantity), `parts_adjustments` (completion_report_id, sku, quantity ≥ 1, type `used`/`returned_unused`/`replacement_used`, transaction_id unique).
- `technician_feedback`: job_id (unique), technician_id, rating, comment, tags (technician enum only), customer_first_name, received_at, locked_at, flagged_for_review, source_idempotency_key (unique). `technician_feedback_followups`.
- `settings` (job durations, `installation_fee_php`), `notifications`, `mail_log`, `sessions`, `rate_limits`, `circuit_state`, `simulation_flags`, `outbox_messages`, `processed_messages`, `failed_messages`, `audit_logs`, `service_clients` (client_id, secret_hash, scopes).

System B never stores a customer's email, phone, or address in feedback tables; `customer_first_name` is the only customer detail there.

### 4.3 Rules the database enforces
- Six job statuses (Postgres enum in both): `Pending Scheduling`, `Scheduled`, `In Progress`, `Completed`, `Cancelled`, `Reschedule Required`.
- Transitions: Pending Scheduling → Scheduled or Cancelled. Scheduled → In Progress, Reschedule Required, or Cancelled. Reschedule Required → Scheduled or Cancelled. In Progress → Completed or Reschedule Required. Completed and Cancelled are terminal. **Scheduled → In Progress requires every `job_items` row to have `loaded_quantity` equal to its quantity.**
- `0 <= reserved <= on_hand` per SKU, updated in a single SQL statement per SKU.

### 4.4 Migrations and seeds
- [ ] **[MUST]** Reversible migrations; `pnpm db:migrate` and `pnpm db:seed` per app; seeds refuse to run when `NODE_ENV=production` unless `DEMO_MODE=true` and `--force-demo` is passed.
- [ ] **[MUST]** Seed A: 1 `store_admin`, 3 customers, 24 products from the copied or fallback catalog (real product names, descriptions, prices, images), inventory, 12 orders across statuses, 3 feedback records (ratings 5, 3, 1).
- [ ] **[MUST]** Seed B: 1 `admin`, 2 `dispatcher`, 6 `technician` accounts, 4 service areas, qualifications spread across technicians, catalog synced from System A.
- [ ] **[MUST]** `pnpm demo:reset` restores both databases to the seed state (demo mode only, admin-only).

**Acceptance:** migrations up, down, up cleanly; seeds run twice without error; exclusion-constraint, stock-CHECK, and feedback-CHECK tests reject bad rows.

---

## 5. AUTHENTICATION & SECURITY

### 5.1 Auth
- [ ] **[MUST]** Customer sign up, login, logout. Password minimum 12 characters. Generic login error ("Email or password is incorrect"). Lock for 15 minutes after 5 failures. Signed httpOnly, Secure, SameSite=Lax session cookie, 8-hour expiry, server-side session row so logout revokes it. System A uses `store_session`; System B uses `fsm_session`.
- [ ] **[MUST]** System B accounts created by `admin` only; first login forces a password change.
- [ ] **[MUST]** Role checks in server code on every route and every service function; the UI hides actions but is never the only guard. Return 404 (not 403) for records the caller must not know exist (IDOR).
- [ ] **[SHOULD]** Email verification (D18), password reset with a single-use 1-hour token, session-expiry redirect with return to the original page.
- [ ] **[MUST]** Service auth: `POST /api/oauth/token` on both apps (`client_credentials`), HS256, 15 minutes, scope per operation: `installations:create`, `installations:read`, `installations:update`, `feedback:write`, `stock:read`, `webhooks:schedule`, `webhooks:status`, `webhooks:completion`, `webhooks:inventory`, `catalog:read`. Missing token: 401 `AUTHENTICATION_REQUIRED`; wrong scope: 403 `FORBIDDEN_SCOPE`.

### 5.2 Security
- [ ] **[MUST]** Server-side validation on every input from the generated Zod schemas; unknown fields rejected (D23).
- [ ] **[MUST]** Free text (special instructions, notes, comments, lead messages, cancel reasons): trimmed, length-limited, control characters stripped, HTML-escaped on output, never injected with `innerHTML`.
- [ ] **[MUST]** CSRF: double-submit `X-CSRF-Token` on browser POST, PATCH, and DELETE. Service calls use bearer tokens.
- [ ] **[MUST]** Security headers (CSP with self plus the copied site's required hosts only, `nosniff`, `Referrer-Policy`, HSTS in production). Parameterized queries only.
- [ ] **[MUST]** Webhook verification: HMAC (`X-Signature`), 5-minute timestamp tolerance (`X-Timestamp`), OAuth Bearer token scope, and idempotency key.
- [ ] **[SHOULD]** Database-backed rate limits (`rate_limits`) on login, signup, reset, lead form, feedback submit. Return 429 with `Retry-After`.
- [ ] **[MUST]** No passwords, tokens, secrets, emails, phone numbers, addresses, notes, or comments in logs. Redaction tested.
- [ ] **[MUST]** Secrets only in environment variables; `.env*` in `.gitignore`; no secrets in the repository.

**Acceptance:** tests for login lockout, role denial on every protected route, IDOR 404, forged signature rejected, stale timestamp rejected, XSS text stored inert and displayed escaped, CSRF rejection, redaction.

---

## 6. CONTRACT AND WORKFLOWS

### 6.1 Contract rules (`packages/contract/openapi.yaml`)
- JSON, UTF-8. Phone: `^\+63[0-9]{9,10}$`. Quantities integers 1 to 99. Money decimal string with two places. Ratings integers 1 to 5. Timestamps RFC 3339 with offset (`Z` allowed).
- Max lengths: names 120, first name 60, email 254, address lines 200, city 100, postal code 10, special instructions 500, notes 2000, comment 1000, cancel reason 500, serial 64, SKU 64.
- Headers on every call: `Authorization: Bearer`, `Idempotency-Key` (UUID v4, on POST and PATCH), `X-Correlation-Id` (UUID v4).
- Webhook endpoints also mandate: `X-Signature: sha256=<hex>` and `X-Timestamp: <RFC3339>`.
- Clause IDs (tests cite them):

| Clause | Subject |
|---|---|
| CL-01 | Documented data formats |
| CL-02 | Required and optional fields; unknown field rejection |
| CL-03 | Timestamp format |
| CL-04 | Shared job statuses and allowed transitions |
| CL-05 | Standard error body and categories |
| CL-06 | Retry and failed-message policy |
| CL-07 | Idempotency |
| CL-08 | Explicit versioning in path |
| CL-09 | Authentication and scopes |
| CL-10 | Webhook signing and timestamp tolerance |
| CL-11 | Source-of-truth ownership |
| CL-12 | Stock ledger and unique transaction IDs |
| CL-13 | Warranty activation exactly once |
| CL-14 | Correlation ID and logging |
| CL-15 | Feedback routing: only the technician portion (rating, comment, technician tags, first name) crosses the interface; System A owns the record; one per order; no contact details and no store tags |
| CL-16 | Read-only stock availability |

### 6.2 Operations
| ID | Direction | Method and path | Scope | Mode | Success | Tier |
|---|---|---|---|---|---|---|
| OP-01 | A to B | `POST /api/v1/installations` | `installations:create` | outbox | 201, 200 on replay | MUST |
| OP-02 | A to B | `GET /api/v1/installations/{jobNumber}` | `installations:read` | on-demand | 200 | SHOULD |
| OP-03 | A to B | `POST /api/v1/installations/{jobNumber}/reschedule-requests` | `installations:update` | outbox | 202 | SHOULD |
| OP-04 | A to B | `POST /api/v1/installations/{jobNumber}/cancellations` | `installations:update` | outbox | 200 | SHOULD |
| OP-05 | B to A | `POST /api/v1/webhooks/schedule-confirmations` | `webhooks:schedule` | outbox | 200 | MUST |
| OP-06 | B to A | `POST /api/v1/webhooks/status-changes` | `webhooks:status` | outbox | 200 | MUST |
| OP-07 | B to A | `POST /api/v1/webhooks/completions` | `webhooks:completion` | outbox | 200 | MUST |
| OP-08 | B to A | `POST /api/v1/webhooks/inventory-adjustments` | `webhooks:inventory` | outbox | 200 | MUST |
| OP-09 | B to A | `GET /api/v1/catalog` | `catalog:read` | on-demand and daily | 200 | MUST |
| OP-10 | A to B | `POST /api/v1/installations/{jobNumber}/feedback` | `feedback:write` | outbox | 201, 200 on replay | MUST |
| OP-11 | A to B | `PATCH /api/v1/installations/{jobNumber}/feedback` | `feedback:write` | outbox | 200 | SHOULD |
| OP-12 | B to A | `GET /api/v1/stock/availability?sku=...` (up to 50) | `stock:read` | on-demand | 200 | SHOULD |

Payload notes:
- **OP-01:** order number, customer name, phone, email, address, items (sku, quantity), preferred window, special instructions.
- **OP-05:** job number, technician name, start, end, status.
- **OP-07:** order number, job number, completion time, result, installed units (sku, serials), notes.
- **OP-08:** `{ transactionId (UUID), orderNumber, jobNumber, sku, type: "used" | "returned_unused" | "replacement_used", quantity }`.
- **OP-10 and OP-11 (strict):** `{ rating 1 to 5, comment up to 1000, technicianTags [technician enum], customerFirstName up to 60, submittedAt }`. The job must be `Completed`. A different key and body for the same job returns 409 `DUPLICATE_RECORD`. OP-11 after `locked_at` returns 409 `BUSINESS_RULE_VIOLATED`. A store tag or any contact field returns 422 `VALIDATION_FAILED` and nothing is stored.
- **OP-12 response:** `{ items: [ { sku, onHand, reserved, available, asOf } ] }`. A stock shortage exists when `available < requested_quantity` (or `available <= 0`).

### 6.3 Error body (all non-2xx, both systems)
```json
{ "error": { "category": "VALIDATION_FAILED", "message": "quantity must be a positive whole number", "field": "items[0].quantity", "referenceId": "ERR-20261110-8F3K2A", "correlationId": "2b0f4c9e-0000-4000-8000-000000000000" } }
```
Categories: `VALIDATION_FAILED`, `AUTHENTICATION_REQUIRED`, `FORBIDDEN_SCOPE`, `NOT_FOUND`, `DUPLICATE_RECORD`, `IDEMPOTENCY_KEY_CONFLICT`, `SCHEDULE_CONFLICT`, `INSUFFICIENT_STOCK`, `BUSINESS_RULE_VIOLATED`, `UNEXPECTED_ERROR`, `SERVICE_UNAVAILABLE`, `RATE_LIMITED`. Each maps to one HTTP status and a permanent or temporary retry class.

### 6.4 W-01 Purchase with installation (OBJ-01) [MUST]
1. Customer browses the catalog, adds to cart, opens the cart.
2. Cart: quantity 1 to 99, remove with undo, stock check against `available`.
3. Checkout requires login. Installation is on by default for mandatory categories and optional for the others (D2). The customer picks or adds an address, a contact phone, a preferred window, and special instructions. Installation shows "Included".
4. Validation inline and on the server. The window starts at least 24 hours ahead and ends after it starts. Phone normalized (D16).
5. Submit, in one transaction: create the order, create the simulated payment as `paid`, apply stock (section 6.9), create the `installation_requests` row (`Pending Scheduling`), and write one outbox row for OP-01 (if the integration flag is true). Respond with the order number immediately. The checkout request has an idempotency key, so a double click cannot create two orders.
6. Confirmation page: order number, "Installation request received", status chip.
7. Failure states: insufficient stock keeps the cart and names the item; simulated payment failure leaves `pending_payment` with a retry button.
8. Delivery per section 3.3. System B validates and returns the job number; System A stores it.
9. Edge cases: System B down (order succeeds, page shows "Scheduling in progress"); duplicate delivery (200 with the original job); unknown SKU (422, failed queue, `store_admin` alerted).
10. Orders without installation show "Ready for pickup"; `store_admin` marks "Picked up" **[SHOULD]**.

### 6.5 W-02 Scheduling and double-booking (OBJ-02) [MUST]
1. The job appears in the dispatcher queue as `Pending Scheduling`.
2. The dispatcher sees suggested technicians: qualified for every item, serving the area, no overlapping active appointment, using D10 durations. **[SHOULD]** A stock shortage banner from OP-12.
3. Assign: the server inserts the appointment; the exclusion constraint is the final guard. On conflict return 409 `SCHEDULE_CONFLICT` and show the next three free slots.
4. Status becomes `Scheduled` and an outbox row for OP-05 is written. System A updates the order page and notifies the customer.
5. **[SHOULD]** Reschedule and cancel under section 6.7.
6. Edge cases: two dispatchers assign at once (the second gets the conflict, no partial state); job `version` mismatch returns 409 and asks for a refresh.

### 6.6 W-03 Loading check, execution, completion (OBJ-03) [MUST]
1. **Loading check:** the technician confirms each ordered item is loaded. "Start job" stays disabled until all are confirmed, and the server enforces it. "Report missing item" sets `Reschedule Required` with a reason and notifies the dispatcher.
2. **Start:** status `In Progress`, OP-06 sent.
3. **Completion form:** per ordered SKU: units used (one serial per unit) and units returned unused; extra parts as `replacement_used` with a reason; notes (≤ 2000); result.
4. **Validation:** per ordered SKU, used plus returned equals the ordered quantity; serial count equals used quantity; serials are new; extra parts exist in the catalog.
5. **Submit, in one transaction:** save the report, set `Completed`, write outbox rows for OP-07 and one OP-08 per adjustment line, each with a unique `transactionId`.
6. **System A on OP-07:** verify signature and scope; validate; in one transaction record installed units, set the job status, set the order `fulfilled`, activate warranty per unit (start = completion date, length = product `warranty_months`), create the feedback invitation (due in 1 hour, or 1 minute in demo mode), write an audit entry. A replay returns the stored response and changes nothing.
7. **System A on OP-08:** apply the ledger rule (section 6.9) keyed by `transactionId`; reject unknown SKUs or lines that would break the stock invariant with `INSUFFICIENT_STOCK`.
8. Customer order page shows technician, completion date, installed equipment with serials, and warranty end dates.
9. Edge cases: completion arrives before the schedule confirmation (accepted; order and job numbers reconcile it); quantity mismatch (422 `BUSINESS_RULE_VIOLATED`, visible in the failed queue).

### 6.7 Cancellation, reschedule, refund (D7) [SHOULD]
| Situation | Who | Result |
|---|---|---|
| `Pending Scheduling`, or `Scheduled` with start more than 24 hours away | Customer self-service, dispatcher, `admin` | Cancelled; reserved stock released; payment `refund_pending` |
| `Scheduled` with start within 24 hours, or `Reschedule Required` | Customer requests; dispatcher or `admin` decides | Approved: cancelled as above. Refused: the order stays and the customer sees the reason |
| `In Progress` or `Completed` | Not cancellable in the system | Explanation shown with the support contact |
| Customer reschedule | Self-service while `Scheduled` and more than 24 hours away, at most 2 times | Further requests go to the dispatcher |
- Cancellation records `cancelled_by`, `cancel_reason`, `cancelled_at` and an audit entry. `store_admin` marks `refunded` (status only).
- Cancelling sends OP-04. If System B answers 409 (job already `In Progress`), System A reverts the cancellation and notifies the customer and `store_admin`.

### 6.8 W-04 Failed messages [MUST]
1. A message that fails 5 attempts or hits a permanent error moves to `failed_messages` and alerts the admin.
2. The admin list shows operation, error category, attempts, and a payload view with personal data masked.
3. Actions: Replay (reuses the original `Idempotency-Key`), Discard with a mandatory reason (audited), and "Run queue now". Payloads cannot be edited.
4. Failed messages are purged after 30 days.

### 6.8a W-05 Feedback (OBJ-04)
1. **[MUST]** When OP-07 is processed, a `feedback_invitations` row is created. The scheduler sends the invitation when due and one reminder after 5 days if no feedback exists. The order page shows "Rate your installation".
2. **[MUST]** The form has two separate sections: "Your installation and technician" (technician tags) and "Your shopping experience" (store tags). Each has stars, tag chips from its own enum, and an optional comment with a counter. At least one section must be rated. The form shows the technician's first name and completion date.
3. **[MUST]** Server checks: order completed, within 30 days, owned by the user (else 404). A second submission returns the existing record. A tag from the wrong enum is rejected.
4. **[MUST]** Submit in one transaction: save feedback; if a technician rating exists, write one OP-10 row with only the technician portion; if any rating is 1 or 2, create the matching follow-up and an alert.
5. **[MUST]** System B on OP-10: verify, validate, confirm the job is `Completed`, store `technician_feedback`, update rolling averages (30 and 90 days), open a follow-up if the rating is 1 or 2. Replays return the original result.
6. **[SHOULD]** Follow-ups: dispatcher (technician part) or `store_admin` (store part) sets `in_progress`, adds a note, resolves. `store_admin` can send a private response the customer sees.
7. **[SHOULD]** The customer can edit for 7 days (technician part sent as OP-11); after that the record is locked.
8. **[MUST]** The technician sees only their own ratings, technician tags, and comments with the customer's first name, and cannot reply or hide anything.
9. **[COULD]** Moderation (hide with reason, exclude from average) and technician "Request review".
10. Edge cases: System B down (saved in A, OP-10 queued); store-only feedback sends nothing to System B; script text in a comment is stored inert and displayed escaped.

### 6.9 Stock ledger (CL-12, CL-16; also write `docs/stock-ledger.md`)
Per SKU: `on_hand` (physical units), `reserved` (promised to open installation orders), `available = on_hand - reserved`.

| Event | on_hand | reserved | Reason |
|---|---|---|---|
| Add to cart, or checkout check | none | none | quantity must be at most `available` |
| Paid, with installation | none | + qty | `reservation` |
| Paid, without installation | − qty | none | `direct_sale` |
| Cancelled before completion | none | − qty | `reservation_release` |
| OP-08 `used` | − qty | − qty | `install_use` |
| OP-08 `returned_unused` | none | − qty | `reservation_release` |
| OP-08 `replacement_used` | − qty | none | `replacement_use` |
| Manual adjustment (reason required, audited) | ± qty | none | `manual_adjustment` |

Invariants (each tested):
1. `0 <= reserved <= on_hand` after every transaction.
2. For each installation order, `used + returned_unused` per SKU equals the ordered quantity.
3. Every movement has a unique `transaction_id`; replays change nothing.
4. `on_hand_final = start - direct_sale - install_use - replacement_use + manual_adjustments`; `reserved_final = start + reservation - reservation_release - install_use`.
5. OP-12 returns exactly current `on_hand`, `reserved`, and `available`.

---

## 7. UI

- **Design matches the store.** In Phase 0 extract colors, fonts, spacing, button and card styles, header and footer, and image treatments into `packages/ui-tokens` (crawled or loaded from fallback). System A matches the brand. System B reuses the same tokens in a denser layout for work tools.
- Shared components in `packages/ui`: Button, Input, Select, Textarea, Checkbox, Radio, Star rating input, Tag chips, Toast, Modal, Confirm dialog, Table, Card, Status chip (six statuses, each with text and icon), Pagination, Skeleton, Empty state, Banner (prototype banner).
- Every view has loading, empty, error, and no-permission states with specific wording.
- **[MUST] System A screens:** home, products (filter by category), product, cart, checkout, confirmation, order detail (timeline, loading and completion info, warranties, feedback card), feedback form, login and sign up, lead form, `/demo`.
  **[SHOULD]:** account settings, cancel and reschedule actions, admin (orders, stock and adjustments, refunds, store feedback, failed messages, audit).
- **[MUST] System B screens:** login, dispatcher dashboard (counts by status, today's jobs, alerts), jobs list, job detail (items, stock check, history, assign), schedule view (per technician day list), technician "My jobs", job detail with loading checklist, completion form, "My feedback", failed messages, audit log, `/demo`.
  **[SHOULD]:** feedback follow-up queue, technicians list and detail, settings, users.
- **Accessibility [MUST]:** semantic landmarks, keyboard operation, visible focus, labelled inputs, contrast 4.5:1, text on every status chip, axe check with zero serious violations on built pages.
- **Responsive [MUST]:** works at 360, 768, and 1280 px with no horizontal page overflow. Technician screens are mobile first.
- **Feedback and errors [MUST]:** toasts for create, update, error, cancel, assign, complete, feedback submitted; global error handler mapping error categories to specific messages with no internals; custom 404, 403, 500 pages; error boundary.
- **[COULD]:** dark mode, motion polish (150 to 300 ms, respecting `prefers-reduced-motion`), SEO tags, data export, CSV export.

---

## 8. DEMO MODE AND PRESENTATION SUPPORT [MUST]

### 8.1 Demo panel (`/demo` in each app; only when `DEMO_MODE=true`; admin login required)
- "Simulate partner outage" toggle: reads and sets a row in `simulation_flags` table (key: `partner_outage_simulated`). When active, an API middleware returns 503 `SERVICE_UNAVAILABLE` to partner calls immediately.
- "Run queue now", "Show outbox" (pending, sent, failed with attempt counts), "Replay last message", "Send invitation now".
- "Force payment failure" toggle (store, via `simulation_flags`).
- "Reset demo data" (confirmation dialog).
- "Contract check": runs `scripts/contract-check.mjs` against the deployed spec and shows pass or fail per clause.
- Mail log viewer showing every email the app sent or would have sent.

### 8.2 Demo script (`docs/demo-script.md`, about 7 minutes)
1. Customer buys a CCTV kit with installation. The job appears in System B with no re-typing (OBJ-01).
2. Dispatcher assigns a technician. A second booking on the same slot is refused with free slots shown (OBJ-02).
3. Turn on the outage toggle. Place another order: checkout still succeeds, the outbox shows it pending. Turn the outage off, run the queue: exactly one job exists (idempotency, CL-06, CL-07).
4. Technician tries to start without loading: refused. Confirms loading, starts, completes with serials and one returned unit.
5. Stock and warranty update in System A; the ledger numbers match `docs/stock-ledger.md` (OBJ-03). Replay the completion message: nothing changes.
6. Customer rates the technician 1 star and the store 5 stars. A follow-up opens for the dispatcher; the store score stays in System A only (OBJ-04, CL-15).
7. Show the contract check page and one failure-path test result (wrong data type rejected with a specific error).

---

## 9. TESTING

### 9.1 Tools and gates
- [ ] **[MUST]** ESLint, Prettier, `tsc --noEmit`, Spectral. CI fails if `contract:generate` output differs from the committed files.
- [ ] **[MUST]** Unit tests for status transitions, ledger math, backoff, HMAC signer, validators, warranty dates, feedback window rules, cancellation rules (coverage target in D24).
- [ ] **[MUST]** Contract tests: System A's generated requests validate against the spec (Ajv); System B's responses validate; both run on every change. Interface tests call each endpoint over HTTP with the partner mocked by Prism.

### 9.2 Required test cases (record precondition, input, expected result, clause, and a results table)
| ID | Type | Scenario and expected result | Clause | Tier |
|---|---|---|---|---|
| TC-01 | Contract | Generated OP-01 payload validates (phone string, integer quantities, timestamps with offset) | CL-01, CL-03 | MUST |
| TC-02 | Contract | Generated OP-07 payload validates; path is under `/api/v1`; statuses among the six | CL-04, CL-08 | MUST |
| TC-03 | Interface | Valid OP-01: 201, job number, `Pending Scheduling` | CL-07, CL-09 | MUST |
| TC-04 | Interface | Signed OP-07 then OP-08 lines: ledger per section 6.9, warranty activated once | CL-12, CL-13 | MUST |
| TC-05 | Failure | OP-01 with `quantity: "two"`: 422 naming `items[0].quantity`, nothing stored, not retried | CL-05, CL-01 | MUST |
| TC-06 | Failure | System B down at checkout: order succeeds, outbox pending, delivered once after recovery | CL-06 | MUST |
| TC-07 | Failure | Same OP-01 resent with the same key: 200, original job, no second job | CL-07 | MUST |
| TC-08 | Failure | Same key, different body: 409 `IDEMPOTENCY_KEY_CONFLICT` | CL-07 | MUST |
| TC-09 | Failure | OP-08 resent with the same `transactionId`: original response, stock unchanged | CL-12 | MUST |
| TC-10 | Failure | No token: 401; wrong scope: 403 | CL-09 | MUST |
| TC-11 | Failure | Second job overlapping an active appointment: 409 `SCHEDULE_CONFLICT`, one active appointment | CL-04 | MUST |
| TC-12 | Failure | Bad signature and 10-minute-old timestamp: 401, no data changed | CL-10 | MUST |
| TC-13 | Failure | Replay from the failed queue reuses the original key; one effect | CL-06, CL-07 | MUST |
| TC-14 | Failure | Completion where used + returned does not match ordered, or serials do not match used: 422 | CL-12 | MUST |
| TC-15 | Failure | Script text in notes stored inert and escaped; 2001 characters, bad status, timestamp without offset rejected | CL-01 to CL-03 | MUST |
| TC-16 | Contract | `v1` and `v2` both served during transition | CL-08 | COULD |
| TC-17 | Failure | 5 consecutive 503 open the breaker; 30 s later one trial; closes on success | CL-06 | SHOULD |
| TC-18 | Failure | Logs from a full flow contain no secrets or personal data; correlation ID on every line | CL-14 | MUST |
| TC-19 | Contract | OP-10 payload validates: rating 1 to 5, technician tags only, no contact fields | CL-01, CL-15 | MUST |
| TC-20 | Interface | Valid OP-10 on a Completed job: 201, stored, averages updated | CL-07, CL-09, CL-15 | MUST |
| TC-21 | Failure | OP-10 for a job not Completed: 422, nothing stored | CL-15 | MUST |
| TC-22 | Failure | OP-10 same key and body: 200 original; same key, different body: 409 | CL-07 | MUST |
| TC-23 | Failure | System B down at feedback submit: saved in A, delivered once after recovery | CL-06 | MUST |
| TC-24 | Failure | Technician rating of 1 opens a follow-up and an alert | D14 | MUST |
| TC-25 | Failure | Rating 6, rating 0, comment of 1001 characters, unknown tag rejected; script text stored inert | CL-01, CL-02 | MUST |
| TC-26 | Failure | Another customer's order: submit or read returns 404 | section 5 | MUST |
| TC-27 | Failure | Edit after 7 days: 409 locked | D13 | SHOULD |
| TC-28 | Failure | Technician opens another technician's feedback: 404 | section 5 | MUST |
| TC-29 | Interface | Edit within 7 days: OP-11 delivered, no duplicate | CL-07, CL-15 | SHOULD |
| TC-30 | Integration | Stock 10/0 for one SKU: order 2 → 10/2; cancel → 10/0; order 3, complete with 2 used, 1 returned → 8/0; extra replacement 1 → 7/0; invariants 1 to 5 hold | CL-12 | MUST |
| TC-31 | Contract | Phones `+639171234567` and `+6328123456` accepted; `09171234567` normalized by the UI; `+449171234567` and `+63123` rejected; timestamp ending in `Z` accepted | CL-01, CL-03 | MUST |
| TC-32 | Failure | OP-10 with a store tag, or an extra `storeComment` field: 422, nothing stored in System B | CL-15, CL-02 | MUST |
| TC-33 | Failure | Cancel and reschedule rules in section 6.7 (12 hours out, third reschedule) behave as specified | D7 | SHOULD |
| TC-34 | Interface | Start with one item unconfirmed: 409; confirm all: success; OP-12 returns `onHand`, `reserved`, and `available` | CL-16, CL-04 | MUST |
| TC-35 | Integration | Scheduler: invitation and reminder sent once each; none when feedback exists; record locks after 7 days | D13 | SHOULD |

### 9.3 End-to-end (Playwright)
- **[MUST]** E2E-01 purchase creates a job. E2E-02 double-booking refused. E2E-03 loading check, completion, stock, warranty, replay. E2E-04 System B down at checkout, then recovery. E2E-06 feedback with a low technician score.
- **[SHOULD]** E2E-05 role boundaries. E2E-08 cancel, release stock, refund status.
- **[COULD]** E2E-07 quote flow.

### 9.4 Manual QA `[HUMAN]`
Create `docs/qa-checklist.md` with every workflow, every role, error pages, mobile widths, and each email, with pass or fail and tester initials. A group member completes it on Day 7.

---

## 10. DAY PLAN AND ACCEPTANCE

### Phase 0 (Day 1, morning): Preflight and clone
- [ ] **[MUST]** Create `PROGRESS.md`, `docs/assumptions.md`, `docs/human-gates.md`. Document the status of H1 to H5. If H1-H3 are pending human action, proceed with workspace scaffolding, crawler/fallback seed extraction, and token generation.
- [ ] **[MUST]** `scripts/clone-site.mjs`: crawl public pages or load the fallback seed catalog (D1), save HTML, CSS, fonts, and images to `apps/store/public/_clone`, record findings in `docs/constraints.md`.
- [ ] **[MUST]** Extract tokens into `packages/ui-tokens`.
  **Acceptance:** at least 24 products captured with name, price, image, description; token file exists.

### Phase 1 (Day 1): Foundation and contract
- [ ] **[MUST]** Monorepo, TypeScript, lint, CI, both Next.js apps booting, `packages/ui`, logger with redaction tests, prototype banner and `noindex` on both apps.
- [ ] **[MUST]** Write `openapi.yaml`, schemas, and examples for OP-01 to OP-12, the error body, CL-01 to CL-16; `contract:generate`; Prism mocks.
- [ ] **[MUST]** Migrations and seeds for both databases (section 4.4) against H2 `TEST_DATABASE_URL` (or local PostgreSQL fallback).
  **Acceptance:** both apps run locally; Spectral clean; generated schemas reproducible with no diff; migrations up, down, up; seeds idempotent; constraint tests pass.

### Phase 2 (Day 2): System B core
- [ ] **[MUST]** Auth and roles, OP-01 provider (idempotency), jobs list and detail, suggestions, assign with the exclusion constraint, `Scheduled` status, OP-05 outbox write, technician "My jobs".
  **Acceptance:** TC-03, TC-05, TC-07, TC-08, TC-11 pass; the dispatcher flow works in the browser against Prism.

### Phase 3 (Day 3): System A store and outbox
- [ ] **[MUST]** Copied pages, catalog, cart, checkout with installation, simulated payment, ledger reservation and direct sale, order detail, login and sign up, lead form.
- [ ] **[MUST]** Outbox, immediate delivery, drain endpoint with `SKIP LOCKED` and 6-second execution budget guard, retry spacing, failed queue and admin replay (W-04), service auth, OP-05 consumer.
  **Acceptance:** W-01 works against the real System B locally; TC-06, TC-09, TC-10, TC-13, TC-30 (first steps), TC-31 pass.

### Phase 4 (Day 4): Completion, stock, warranty
- [ ] **[MUST]** Loading checklist, start, completion form, OP-06, OP-07, OP-08, ledger and warranty in System A, order page updates, OP-09 catalog sync.
- [ ] **[SHOULD]** OP-12 and the shortage banner.
  **Acceptance:** TC-02, TC-04, TC-12, TC-14, TC-30, TC-34 pass; E2E-03 passes.

### Phase 5 (Day 5): Feedback, demo panel, email
- [ ] **[MUST]** W-05 MUST items, OP-10, technician "My feedback", low-rating follow-up basics, demo panels (section 8), mail log, `pnpm demo:reset`.
- [ ] **[SHOULD]** Cancellation and refund (6.7), OP-03, OP-04, OP-11, follow-up queue, notifications, Resend sending, circuit breaker.
  **Acceptance:** TC-19 to TC-26, TC-28, TC-32 pass; E2E-01, E2E-02, E2E-04, E2E-06 pass; the demo script runs from start to end locally.

### Phase 6 (Day 6): Deploy, harden, freeze
- [ ] **[MUST]** Deploy both apps to Vercel (H1 to H5), run migrations and seeds on the deployed databases, set environment variables, enable the GitHub Actions drain workflow and the daily Vercel Cron, verify the demo script on the deployed apps.
- [ ] **[MUST]** Complete remaining MUST tests, axe and overflow checks on built pages, security tests, `docs/` set, README.
- [ ] **Feature freeze at the end of this day.**
  **Acceptance:** the full demo script passes on the deployed URLs; all MUST tests pass in CI; the drain workflow runs on schedule.

### Phase 7 (Day 7): Rehearsal
- [ ] Bug fixes only. `[HUMAN]` H7: group rehearsal and a backup screen recording of the full demo.
- [ ] Reset demo data before presenting; confirm both apps and the mail log load.
  **Acceptance:** the rehearsal runs without errors twice in a row.

---

## 11. DEPLOYMENT AND DOCUMENTATION

- [ ] **[MUST]** `README.md`: architecture diagram (Mermaid), Windows setup, commands, ports, seed accounts (development only), test commands.
- [ ] **[MUST]** `docs/deployment.md`: Vercel projects, domains, Neon databases, environment variables per environment, migration order (both databases before deploying), the drain workflow, rollback by redeploying the previous deployment.
- [ ] **[MUST]** `docs/api-register.md` generated from the spec; `docs/stock-ledger.md`; `docs/demo-script.md`; `docs/constraints.md` (Hobby cron limit, function time limits, Resend domain requirement).
- [ ] **[SHOULD]** `docs/runbook.md`: replaying failed messages, rotating secrets, resetting the demo.
- [ ] **[MUST]** Privacy and Terms pages state that this is a student prototype with fake data only.

---

## 12. DEFINITION OF DONE

### 12.1 Agent-verified
- [ ] Every MUST item is done and every phase acceptance check passes.
- [ ] The OpenAPI spec is the authority; both apps pass contract tests in CI; generated schemas have no diff.
- [ ] OBJ-01 to OBJ-04 are each demonstrated by their listed tests with recorded results.
- [ ] W-01 to W-05 (MUST parts) and sections 6.7 and 6.9 work end to end with no dead ends.
- [ ] A technician cannot start a job until every ordered item is confirmed loaded.
- [ ] Stock invariants 1 to 5 hold in every test and in the demo.
- [ ] Only technician-tagged feedback reaches System B; no customer contact data or store tags exist there.
- [ ] No TODOs, placeholder text, hard-coded secrets, or fake data in production code; logs contain correlation IDs and no sensitive data.
- [ ] Both apps show the prototype banner and are `noindex`.
- [ ] The full demo script passes on the deployed Vercel URLs.
- [ ] Any SHOULD or COULD item not built is listed in `PROGRESS.md` under "Not built".

### 12.2 Human-signed (never ticked by the agent)
- [ ] H1 to H5 completed.
- [ ] H6 GoodHand informed (recommended).
- [ ] H7 rehearsal done twice and a backup screen recording saved.
- [ ] Manual QA checklist completed and signed.
