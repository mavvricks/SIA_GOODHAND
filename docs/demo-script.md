# 7-Minute Live Demonstration Script (Section 8.2)

**Presenters:** System A Presenter (Storefront) & System B Presenter (Field Service)  
**Total Target Time:** 7 minutes  
**Prerequisites:** Run `pnpm demo:reset` prior to start to ensure clean baseline database state.

---

### Step 1: Automatic Job Creation (OBJ-01) [Time: 0:00 - 1:15]
1. **Presenter A (Store):**
   - Open `http://localhost:3000`.
   - Browse catalog, select **Dahua DH-IPC-HDBW1431E-S4 4MP Fixed Dome Camera** (`GH-CCTV-001`).
   - Add 2 units to Cart and proceed to Checkout (`/checkout`).
   - Check **"Include Professional Installation"**, enter preferred window (2 days ahead) and address: `123 Ayala Ave, Makati`.
   - Choose a simulated payment method, click **Review order**, then confirm the details in the review step.
   - Show instant order confirmation with sequential number (e.g., `GH-20261110-000001`).
2. **Presenter B (FSM):**
   - Open `http://localhost:3100`.
   - Show the dispatcher jobs list: the installation job (`JOB-...`) is **instantly present** with status `Pending Scheduling` without any manual re-typing.
   - **Talking Point:** *"Demonstrates OBJ-01: 100% of installation orders automatically create a job in System B via transactional outbox."*

---

### Step 2: Technician Assignment & Double-Booking Refusal (OBJ-02) [Time: 1:15 - 2:30]
1. **Presenter B (FSM):**
   - Open the new job in FSM console.
   - Assign technician **Arnel Mendoza** for `09:00 - 11:00 AM`.
   - Status updates to `Scheduled` and outbox dispatches **OP-05** webhook.
2. **Presenter A (Store):**
   - Refresh or show the customer order page: Assigned technician name and scheduled window are immediately visible.
3. **Presenter B (FSM Conflict Test):**
   - Attempt to assign a second job to **Arnel Mendoza** on the exact same `09:00 - 11:00 AM` time slot.
   - Show the immediate refusal: **`409 SCHEDULE_CONFLICT`** backed by PostgreSQL GiST exclusion constraint (`EXCLUDE USING gist (technician_id WITH =, period WITH &&)`).
   - Show suggested free slots.
   - **Talking Point:** *"Demonstrates OBJ-02: Zero double-booking enforced at the database level."*

---

### Step 3: Simulated Outage, Resilient Buffering & Recovery [Time: 2:30 - 3:45]
1. **Presenter A (Store Demo Panel):**
   - Navigate to `http://localhost:3000/demo`.
   - Toggle **"Simulate System B Outage"** to **ACTIVE**.
   - Place a second order in the store (`GH-20261110-000002`).
   - Notice checkout succeeds cleanly: the customer is told *"Installation request queued"*.
   - In `/demo`, inspect the Outbox table: show the `OP-01` message sitting in status `pending` with retry attempts backoff.
2. **Presenter A & B (Recovery & Drain):**
   - Toggle **"Simulate System B Outage"** back to **OFF**.
   - Click **"Run Queue Now"** (executes `/api/internal/drain`).
   - Show message status changes to `delivered`.
   - Presenter B shows that exactly **one** job was created in System B (idempotency CL-06, CL-07).

---

### Step 4: Loading Gate Checklist & Job Execution (OBJ-03) [Time: 3:45 - 5:00]
1. **Presenter B (Technician Mobile View):**
   - Open mobile view at `http://localhost:3100/technician`.
   - Attempt to click **"Start Job"** without confirming hardware loading.
   - Show that action is disabled and server returns `409 BUSINESS_RULE_VIOLATED` if bypassed.
   - Check off each camera unit in the loading checklist.
   - Click **"Start Job"** $\to$ status transitions to `In Progress` (dispatches **OP-06**).
2. **Presenter B (Completion):**
   - Click **"Complete Job"**.
   - Enter serial numbers: `SN-CAM-001`, `SN-CAM-002`. Set 1 returned unused unit if testing return flow.
   - Submit completion $\to$ status transitions to `Completed`.
   - FSM outbox dispatches **OP-07** (completion report) and **OP-08** (ledger adjustment).

---

### Step 5: Stock Ledger Updates & Warranty Activation [Time: 5:00 - 5:45]
1. **Presenter A (Store):**
   - Open Order Detail page: status is now `Fulfilled`.
   - Point out **Active 12-Month Hardware Warranties** listing exact verified serial numbers.
   - Point out stock ledger numbers in System A: units physically decremented from `on_hand` and released from `reserved`.
2. **Presenter A (Replay Proof):**
   - Open `/demo` and click **"Replay Last Message"**.
   - Point out that neither warranties nor inventory change; System A returns idempotent 200 without duplicate side-effects.

---

### Step 6: Customer Feedback & Strict Privacy Boundary (OBJ-04, CL-15) [Time: 5:45 - 6:30]
1. **Presenter A (Store Feedback Form):**
   - On the completed order page, fill out the review:
     - **Technician:** 1 Star (Low), Tags: `late`, Comment: *"Technician arrived late."*
     - **Store Experience:** 5 Stars (High), Tags: `easy_checkout`, Comment: *"Website was super fast!"*
   - Click **"Submit Feedback"**.
2. **Presenter B (FSM Dispatcher & Tech View):**
   - In System B console: open the follow-up queue $\to$ an **OPEN follow-up alert** is active for dispatcher review due to the 1-star technician rating (TC-24).
   - In System B technician reviews (`/technician/feedback`): the technician sees the 1-star rating and comment, but **no customer email, no telephone, and no store score**.
   - **Talking Point:** *"Demonstrates OBJ-04 & CL-15: System A strictly withholds commercial and store ratings; only technician performance crosses the interface."*

---

### Step 7: Contract Register & Automated Tests [Time: 6:30 - 7:00]
1. **Presenter A & B:**
   - Open the **Contract Checks** tab in `/demo`: show all 16/16 contract clauses passing.
   - Show terminal running `pnpm test`: **55/55 passing unit, integration, and contract tests**.
   - Open the **Live Mail Log** in `/demo`: show generated customer emails, schedule notifications, and low-rating manager alerts.
   - Conclude presentation.
