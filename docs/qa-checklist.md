# Manual QA Verification Checklist (Section 9.4)

**Prototype:** GoodHand Security Store (System A) + Field Service Management (System B)  
**Execution Gate:** Day 7 Final Rehearsal  
**Tester Name:** ________________________  
**Date of Testing:** ________________________  

---

## 1. Storefront & Customer Workflows (System A)

| ID | Test Item / Workflow | Expected Result | Pass/Fail | Tester Initials |
|---|---|---|:---:|:---:|
| **QA-01** | Catalog browsing & filters | 24 real security products across 7 categories displayed with correct PHP pricing | | |
| **QA-02** | Add to cart & quantity limits | Quantities bounded between 1 and 99; cannot exceed available ledger stock | | |
| **QA-03** | Optional professional installation | Checkbox opts into installation; selected orders require schedule; hardware-only orders need no schedule; address & contact phone (+63) validated | | |
| **QA-04** | Preferred installation window | Window must start $\ge 24\text{ hours}$ in advance; end must be after start | | |
| **QA-05** | Order confirmation | Order number generated (`GH-YYYYMMDD-NNNNNN`), status chip displayed, OP-01 enqueued | | |
| **QA-06** | Order detail timeline | Real-time tracking of technician assignment, scheduled window, and warranties | | |
| **QA-07** | Customer feedback submission | Two separate sections: technician (sent to FSM) and store experience (withheld in A) | | |
| **QA-08** | Customer feedback 7-day edit | Edits permitted within 7 days; locked thereafter with clear explanation | | |
| **QA-09** | Lead capture form | Free text trimmed, script tags stored inertly without XSS execution | | |

---

## 2. Field Service Dispatcher Workflows (System B)

| ID | Test Item / Workflow | Expected Result | Pass/Fail | Tester Initials |
|---|---|---|:---:|:---:|
| **QA-10** | Jobs queue synchronization | Installation jobs from System A appear automatically as `Pending Scheduling` | | |
| **QA-11** | Technician assignment | Dispatcher assigns technician matching required item qualifications | | |
| **QA-12** | Double-booking prevention | Assigning overlapping time slot to same technician is refused with free slots | | |
| **QA-13** | OP-05 Webhook dispatch | Outbox transmits schedule confirmation to System A with HMAC signature | | |
| **QA-14** | Stock shortage warning banner | Shows active alert if requested item has `available <= 0` from OP-12 | | |
| **QA-15** | Low rating follow-up queue | Technician ratings $\le 2$ appear in the follow-up queue with status `open` | | |

---

## 3. Technician Mobile Application Workflows (System B)

| ID | Test Item / Workflow | Expected Result | Pass/Fail | Tester Initials |
|---|---|---|:---:|:---:|
| **QA-16** | "My Jobs" mobile dashboard | Mobile layout (360px viewport) renders with zero horizontal scroll | | |
| **QA-17** | Hardware loading gate | "Start job" is disabled until 100% of ordered units are confirmed loaded | | |
| **QA-18** | Job start execution | Status transitions to `In Progress`; OP-06 status change webhook dispatched | | |
| **QA-19** | Completion form validation | Serial numbers required for each used unit; unused returned units accounted for | | |
| **QA-20** | Completion submission | OP-07 (completion) and OP-08 (inventory adjustments) dispatched to System A | | |
| **QA-21** | "My Feedback" reviews | Technician sees only own reviews and customer first name; store ratings hidden | | |
| **QA-22** | Technician IDOR isolation | Attempting to access another technician's reviews returns 404 Not Found | | |

---

## 4. Resilience, Outages & Outbox Drain Workflows

| ID | Test Item / Workflow | Expected Result | Pass/Fail | Tester Initials |
|---|---|---|:---:|:---:|
| **QA-23** | System B simulated outage | Checkout succeeds in System A; OP-01 sits buffered in outbox table | | |
| **QA-24** | Queue drain after recovery | Outbox flushes buffered messages; exactly 1 job created in System B (no dupes) | | |
| **QA-25** | Failed queue replay | Replaying failed message reuses original `Idempotency-Key` cleanly | | |
| **QA-26** | 6-second drain budget guard | Drain worker halts at 6,000 ms to avoid Vercel 10s ceiling | | |
| **QA-27** | Circuit breaker trip | 5 consecutive 503s trip circuit to `open`; half-open trial after 30s | | |

---

## 5. Security, Headers & System Error Pages

| ID | Test Item / Workflow | Expected Result | Pass/Fail | Tester Initials |
|---|---|---|:---:|:---:|
| **QA-28** | Prototype safety banner | High-visibility prototype warning banner visible on all pages in both apps | | |
| **QA-29** | Search engine `noindex` | `<meta name="robots" content="noindex, nofollow" />` verified on all routes | | |
| **QA-30** | Error categorization | All error responses follow standard body `{ "error": { "category", "referenceId" } }` | | |
| **QA-31** | Custom 404 page | Informative 404 page renders when visiting non-existent routes | | |
| **QA-32** | PII redaction in logs | No passwords, tokens, full emails, or customer phone numbers logged | | |
| **QA-33** | Mobile responsiveness | Verified clean render at 360px, 768px, and 1280px without layout breakage | | |
| **QA-34** | Live mail log viewer | Emails visible in `/demo` mail log viewer with accurate HTML rendering | | |

## 6. Live Job Allocation Regression Checks

| ID | Test Item / Workflow | Expected Result | Pass/Fail | Tester Initials |
|---|---|---|:---:|:---:|
| **QA-35** | Real checkout to live queue | Paid installation order appears in authenticated System B queue automatically | | |
| **QA-36** | Technician claims pending job | Eligible technician claims an unassigned job; job becomes Scheduled; Store receives OP-05 | | |
| **QA-37** | Dispatcher/admin force assignment | A pending unclaimed job can be assigned using a qualified technician and non-overlapping window | | |
| **QA-38** | Competing claims or assignment | One winner only; losing request returns 409 and does not overwrite the assignment | | |
| **QA-39** | Role and ownership boundaries | Technician assignment request returns 403; another technician's job action returns 404; unsigned job access returns 401 | | |
| **QA-40** | Hardware-only checkout | Paid Store order deducts stock, creates no OP-01 or FSM job, and displays Self-Installation / Hardware Only without technician details | | |
| **QA-41** | Customer dispatcher-link visibility | Customer and unsigned sessions cannot see the dispatcher-console link; authenticated Store admins can see it for installation orders | | |
