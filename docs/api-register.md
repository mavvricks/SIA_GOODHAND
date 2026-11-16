# API Register: Inter-System Operations (OP-01 to OP-12)

This register documents all 12 interface operations governed by OpenAPI 3.1 specification (`packages/contract/openapi.yaml`).

---

## 1. Operations Summary Matrix

| ID | Direction | Method & Path | Scope | Mode | Success Codes | Tier |
|---|---|---|---|---|:---:|:---:|
| **OP-01** | A $\to$ B | `POST /api/v1/installations` | `installations:create` | outbox | 201, 200 (replay) | MUST |
| **OP-02** | A $\to$ B | `GET /api/v1/installations/{jobNumber}` | `installations:read` | on-demand | 200 | SHOULD |
| **OP-03** | A $\to$ B | `POST /api/v1/installations/{jobNumber}/reschedule-requests` | `installations:update` | outbox | 202 | SHOULD |
| **OP-04** | A $\to$ B | `POST /api/v1/installations/{jobNumber}/cancellations` | `installations:update` | outbox | 200 | SHOULD |
| **OP-05** | B $\to$ A | `POST /api/v1/webhooks/schedule-confirmations` | `webhooks:schedule` | outbox | 200 | MUST |
| **OP-06** | B $\to$ A | `POST /api/v1/webhooks/status-changes` | `webhooks:status` | outbox | 200 | MUST |
| **OP-07** | B $\to$ A | `POST /api/v1/webhooks/completions` | `webhooks:completion` | outbox | 200 | MUST |
| **OP-08** | B $\to$ A | `POST /api/v1/webhooks/inventory-adjustments` | `webhooks:inventory` | outbox | 200 | MUST |
| **OP-09** | B $\to$ A | `GET /api/v1/catalog` | `catalog:read` | on-demand | 200 | MUST |
| **OP-10** | A $\to$ B | `POST /api/v1/installations/{jobNumber}/feedback` | `feedback:write` | outbox | 201, 200 (replay) | MUST |
| **OP-11** | A $\to$ B | `PATCH /api/v1/installations/{jobNumber}/feedback` | `feedback:write` | outbox | 200 | SHOULD |
| **OP-12** | B $\to$ A | `GET /api/v1/stock/availability` | `stock:read` | on-demand | 200 | SHOULD |

---

## 2. Mandatory Common Headers

### All Inter-System Calls
- `Authorization: Bearer <jwt>` — Signed HS256 JWT with matching scope.
- `Idempotency-Key: <uuid-v4>` — Mandatory on all `POST` and `PATCH` requests.
- `X-Correlation-Id: <uuid-v4>` — Carried across entire lifecycle for end-to-end tracing.

### Webhook Calls (OP-05, OP-06, OP-07, OP-08)
- `X-Signature: sha256=<hex>` — HMAC SHA-256 of payload signed with shared webhook secret.
- `X-Timestamp: <rfc3339>` — Timestamp with offset. Rejection occurs if clock skew exceeds 300 seconds (5 minutes).

---

## 3. Operation Specifications

### OP-01: Create Installation Job
- **Path:** `POST /api/v1/installations`
- **Scope:** `installations:create`
- **Request Payload:**
  ```json
  {
    "orderNumber": "GH-20261110-000001",
    "customerName": "Juan Dela Cruz",
    "customerPhone": "+639171234567",
    "customerEmail": "juan@example.com",
    "address": { "line1": "123 Ayala Ave", "city": "Makati", "province": "Metro Manila", "postalCode": "1226" },
    "items": [{ "sku": "GH-CCTV-001", "quantity": 2 }],
    "preferredStart": "2026-11-12T09:00:00+08:00",
    "preferredEnd": "2026-11-12T11:00:00+08:00",
    "specialInstructions": "Gate code 1234"
  }
  ```
- **Responses:**
  - `201 Created`: Returns `{ "jobNumber": "JOB-...", "status": "Pending Scheduling", ... }`
  - `200 OK`: Idempotent replay with identical `Idempotency-Key`.
  - `409 Conflict`: `IDEMPOTENCY_KEY_CONFLICT` (same key, different payload).
  - `422 Unprocessable Entity`: `VALIDATION_FAILED` (e.g. invalid phone format, negative quantity).

### OP-05: Schedule Confirmation Webhook
- **Path:** `POST /api/v1/webhooks/schedule-confirmations`
- **Scope:** `webhooks:schedule`
- **Request Payload:**
  ```json
  {
    "jobNumber": "JOB-20261110-000001",
    "orderNumber": "GH-20261110-000001",
    "technicianName": "Arnel Mendoza",
    "scheduledStart": "2026-11-12T09:00:00+08:00",
    "scheduledEnd": "2026-11-12T11:00:00+08:00",
    "status": "Scheduled"
  }
  ```

### OP-06: Status Change Webhook
- **Path:** `POST /api/v1/webhooks/status-changes`
- **Scope:** `webhooks:status`
- **Request Payload:**
  ```json
  {
    "jobNumber": "JOB-20261110-000001",
    "orderNumber": "GH-20261110-000001",
    "status": "In Progress",
    "timestamp": "2026-11-12T09:15:00+08:00"
  }
  ```

### OP-07: Installation Completion Webhook
- **Path:** `POST /api/v1/webhooks/completions`
- **Scope:** `webhooks:completion`
- **Request Payload:**
  ```json
  {
    "orderNumber": "GH-20261110-000001",
    "jobNumber": "JOB-20261110-000001",
    "completedAt": "2026-11-12T10:45:00+08:00",
    "result": "Completed successfully",
    "installedUnits": [
      { "sku": "GH-CCTV-001", "serialNumber": "SN-CAM-001" },
      { "sku": "GH-CCTV-001", "serialNumber": "SN-CAM-002" }
    ],
    "notes": "Mounted dome cameras under weatherproof eaves."
  }
  ```
- **System A Action:** Sets order `fulfilled`, activates 12-month warranties per serial number, and schedules feedback invitation (CL-13).

### OP-08: Inventory Adjustment Webhook
- **Path:** `POST /api/v1/webhooks/inventory-adjustments`
- **Scope:** `webhooks:inventory`
- **Request Payload:**
  ```json
  {
    "transactionId": "9d28b3b1-2ff4-4119-8918-b357d2f762e4",
    "orderNumber": "GH-20261110-000001",
    "jobNumber": "JOB-20261110-000001",
    "sku": "GH-CCTV-001",
    "type": "used",
    "quantity": 2
  }
  ```
- **Allowed Types:** `used` ($\Delta \text{on\_hand} = -q, \Delta \text{reserved} = -q$), `returned_unused` ($\Delta \text{reserved} = -q$), `replacement_used` ($\Delta \text{on\_hand} = -q$).

### OP-09: Product Catalog Synchronization
- **Path:** `GET /api/v1/catalog`
- **Scope:** `catalog:read`
- **Response:** Array of active catalog products with required qualifications.

### OP-10: Technician Feedback Submission
- **Path:** `POST /api/v1/installations/{jobNumber}/feedback`
- **Scope:** `feedback:write`
- **Request Payload (Strict Privacy Boundary CL-15):**
  ```json
  {
    "rating": 5,
    "comment": "Very polite and clean installation work.",
    "technicianTags": ["on_time", "professional", "clean_work"],
    "customerFirstName": "Juan",
    "submittedAt": "2026-11-12T12:00:00+08:00"
  }
  ```
- **Rules:** Job must be `Completed` (`422 BUSINESS_RULE_VIOLATED` if not). Ratings $\le 2$ trigger automatic open follow-up and alert. Any store tags or customer contact details trigger `422 VALIDATION_FAILED`.

### OP-11: Edit Technician Feedback
- **Path:** `PATCH /api/v1/installations/{jobNumber}/feedback`
- **Scope:** `feedback:write`
- **Rules:** Allowed strictly within 7 days of initial submission; returns `409 BUSINESS_RULE_VIOLATED` if locked.

### OP-12: Stock Availability Inspection
- **Path:** `GET /api/v1/stock/availability?sku=GH-CCTV-001`
- **Scope:** `stock:read`
- **Response:**
  ```json
  {
    "items": [
      {
        "sku": "GH-CCTV-001",
        "onHand": 25,
        "reserved": 3,
        "available": 22,
        "asOf": "2026-11-10T20:00:00+08:00"
      }
    ]
  }
  ```

---

## 4. Standard Error Body Format (CL-05)

```json
{
  "error": {
    "category": "VALIDATION_FAILED",
    "message": "Field items[0].quantity must be a positive integer between 1 and 99",
    "field": "items[0].quantity",
    "referenceId": "ERR-20261110-A9F43B",
    "correlationId": "8f219c6e-b302-4c60-8000-000000000000"
  }
}
```
