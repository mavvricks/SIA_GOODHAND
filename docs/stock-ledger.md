# Stock Ledger Specification & Invariant Proofs (CL-12, CL-16)

## 1. Overview
The GoodHand Store (System A) serves as the definitive **single source of truth** for all hardware inventory.
To prevent over-selling, phantom reservations, or inventory drift across asynchronous field service installations, System A enforces a mathematically verifiable stock ledger model.

---

## 2. Mathematical Definition & Core Invariants

For each SKU in the catalog, inventory is defined by three continuous values:
- $\text{on\_hand} \ge 0$: Physical units owned by the warehouse / store.
- $\text{reserved} \ge 0$: Units committed to pending customer installation orders.
- $\text{available} = \text{on\_hand} - \text{reserved}$: Units eligible for new checkout purchases.

### Invariant 1: Non-Negative & Bounded Reservation
$$\forall \, \text{SKU}, \quad 0 \le \text{reserved} \le \text{on\_hand} \implies \text{available} \ge 0$$
*Database Enforcement:* `CHECK (reserved <= on_hand AND reserved >= 0 AND on_hand >= 0)`.

### Invariant 2: Hardware Reconciliation per Order
For every installation order fulfilled by System B:
$$\sum_{\text{line} \in \text{SKU}} \left( \text{quantity\_used} + \text{quantity\_returned\_unused} \right) = \text{ordered\_quantity}$$

### Invariant 3: Idempotency by Transaction ID
Every movement line applied to the ledger carries a globally unique `transaction_id` (UUID v4).
Replays or network duplicates of the same `transaction_id` result in a strictly no-op idempotent response:
$$\text{applyMovement}(T, \dots) \circ \text{applyMovement}(T, \dots) = \text{applyMovement}(T, \dots)$$

### Invariant 4: Mass Conservation Equations
From initial baseline state $t_0$ to final completion state $t_f$:
$$\text{on\_hand}_f = \text{on\_hand}_0 - \sum \text{direct\_sale} - \sum \text{install\_use} - \sum \text{replacement\_use} \pm \sum \text{manual\_adjustment}$$
$$\text{reserved}_f = \text{reserved}_0 + \sum \text{reservation} - \sum \text{reservation\_release} - \sum \text{install\_use}$$

### Invariant 5: Accurate Read-Only Availability (OP-12)
Queries to `GET /api/v1/stock/availability` return real-time snapshots:
$$\text{available}_{\text{query}} = \text{on\_hand} - \text{reserved}$$
If $\text{available} \le 0$ (or $< \text{requested\_quantity}$), an active stock shortage banner is triggered.

---

## 3. Transition Matrix & Reason Codes

| Trigger Event | Reason Code | `on_hand` Delta | `reserved` Delta | Available Delta |
|---|---|:---:|:---:|:---:|
| **Order Paid (with Installation)** | `reservation` | $0$ | $+q$ | $-q$ |
| **Order Paid (Direct Pickup / No Install)** | `direct_sale` | $-q$ | $0$ | $-q$ |
| **Order Cancelled before Execution** | `reservation_release` | $0$ | $-q$ | $+q$ |
| **OP-08 Webhook: Unit Used on Site** | `install_use` | $-q$ | $-q$ | $0$ |
| **OP-08 Webhook: Unit Returned Unused** | `reservation_release` | $0$ | $-q$ | $+q$ |
| **OP-08 Webhook: Extra Replacement Part** | `replacement_use` | $-q$ | $0$ | $-q$ |
| **Audited Warehouse Manual Count** | `manual_adjustment` | $\pm q$ | $0$ | $\pm q$ |

---

## 4. Integration Lifecycle Example (TC-30 Proof)

| Step | Operation / Action | on_hand | reserved | available | Invariants Satisfied? |
|:---:|---|:---:|:---:|:---:|:---:|
| **0** | Initial Baseline Seed | 10 | 0 | 10 | Invariant 1 holds ($0 \le 0 \le 10$) |
| **1** | Customer places Order A (Qty: 2 with Installation) | 10 | 2 | 8 | Invariant 1 holds ($0 \le 2 \le 10$) |
| **2** | Customer cancels Order A (Release reservation) | 10 | 0 | 10 | Invariant 1 holds ($0 \le 0 \le 10$) |
| **3** | Customer places Order B (Qty: 3 with Installation) | 10 | 3 | 7 | Invariant 1 holds ($0 \le 3 \le 10$) |
| **4** | Technician completes Order B: 2 Used, 1 Returned Unused | 8 | 0 | 8 | Invariant 2 ($2+1=3$), Invariant 4 hold |
| **5** | Technician installs 1 extra replacement part (`replacement_used`) | 7 | 0 | 7 | All Invariants 1–5 hold |

---

## 5. Security & Concurrency Guard
- All ledger mutations occur within serializable database transactions.
- Each mutation creates an immutable audit row in `stock_movements`.
- Any operation violating $0 \le \text{reserved} \le \text{on\_hand}$ is rejected with `409 INSUFFICIENT_STOCK`.
