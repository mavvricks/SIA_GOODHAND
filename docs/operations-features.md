# Customer tracking and field operations

## Added workflows

- Store checkout validates the form, then shows a review step with the delivery address, items, total, installation choice and preferred window before Pay & Confirm. Editing returns to review. Empty carts cannot submit; default times retain local 9–11 AM rather than shifting to 1–3 AM. Payment remains simulated.
- Checkout requires a signed-in account and binds ownership on the server. `/orders` lists that account's orders; order detail and API access enforce ownership. Legacy orders match the signed-in email; administrators can access all Store orders. Checkout retries with the same key do not repeat orders or stock deductions.
- Customer tracking polls every five seconds for packing, ready for dispatch, on the way, delivered, estimated arrival and a timestamped customer-visible history. Unknown arrival estimates explicitly show Not yet confirmed. Installation status remains separate.
- System B `/deliveries` is limited to dispatchers/admins. It handles hardware-only and installation orders using signed server-to-server requests to System A, which remains the source of truth. Hardware-only deliveries create no technician job. Updates advance one stage at a time; version checks prevent overwriting another staff member's update. Staff identity remains in the audit history but is omitted from customer responses. Refresh shows current staff updates; save failures explicitly ask the operator to refresh before retrying.
- System B `/technicians` is limited to dispatchers/admins. Search by name, qualification or working branch. It lists active assignments and supports saved branch/phone details. Existing email accounts are shown; unknown branches/phones are Not set, not invented. Assignment choices show the saved branch/contact.
- Scheduling uses a two-hour gap between appointments in both directions. A 9–11 AM job allows another job starting at 1 PM, or one ending by 7 AM. Claiming and forced assignment share the server check; another technician may work concurrently. Conflict reasons appear beside pending jobs; action feedback appears on the affected card.
- Technicians may unclaim only their own Scheduled jobs with a reason and confirmation. Loaded hardware must first be cleared from the checklist. In-progress/completed work cannot be released through this action. The appointment is released, the job returns to Pending Scheduling, an audit entry is retained, and the signed status update clears the customer's previous technician/window. Event delivery preserves each order's sequence during retries.

## Verification

Vitest covers the two-hour boundary, overlapping claims, ownership, unclaim/reclaim, loaded hardware restrictions, delivery transitions/version conflicts, checkout replay and customer data filtering. Live Edge browser verification covers review/confirm, local-time defaults, hardware-only tracking through all delivery stages, staff/customer permissions, signature rejection, technician claim/unclaim/reclaim, customer assignment reset, and conflicting technician/admin requests. See artifacts/features-tests.log and artifacts/features-build.log for final runs. Manual H7 sign-off remains for the user.

## Assessment: next useful work, in priority order

1. **Production persistence and deployment:** Replace local SQLite snapshot storage with transactional hosted PostgreSQL adapters for both apps before Vercel deployment. Use atomic writes, database schedule constraints that include the two-hour buffer, and durable scheduled outbox workers. The current local single-process guard is not a distributed database concurrency guarantee.
2. **Payment and pricing integrity:** Integrate a real payment provider with signed payment confirmation, calculate prices from the server catalog rather than client amounts, and make order/stock/outbox writes one transaction. Add refund handling and receipts. Current checkout is still a simulated-payment demonstration.
3. **Production security:** Audit every legacy/demo route, remove publicly reachable demo mutation endpoints, require production-only secrets, add rate limits and password recovery, and review all integration endpoints for strict authentication/replay handling. The newly added operational endpoints are role restricted and signed; this is not a complete security audit of all legacy endpoints.
4. **Dispatch exception handling:** Add a dispatcher-managed reschedule calendar with available-slot suggestions, branch/service-area eligibility, time off and travel distance. Today branch is informative, not a verified geographic restriction; emergency release after work begins needs a supervised handover workflow.
5. **Notifications and proof:** Send email/SMS updates and reminders, add courier/reference tracking, delivery proof/signature and customer acknowledgement, with customer consent and limited retention.
6. **Support and reporting:** Add customer cancellation/refund requests, delivery exceptions, returns/RMA, dispatcher overdue alerts, workload reports and an audit-log view. Do not mark installation complete merely because equipment was delivered.

## Local data

Business updates continue to persist in the existing separate local SQLite databases. Real technician contact details must be supplied by authorized staff. Browser checks created clearly named verification orders; no existing customer orders were reset or removed.
