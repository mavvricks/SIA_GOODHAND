# Deployment Guide: GoodHand Monorepo

**Current runtime: local SQLite.** A hosted Postgres adapter must be implemented
before this deployment plan is executable. Environment URLs alone do not migrate
the runtime. See [local database and migration scope](local-database.md).

## 1. Overview
The GoodHand integration prototype consists of two independent Next.js 15 App Router applications inside a pnpm monorepo:
- **System A (`apps/store`):** E-Commerce Storefront, Inventory Ledger, and Transactional Outbox.
- **System B (`apps/fsm`):** Field Service Management, GiST Exclusion Scheduling, and Technician App.

---

## 2. Infrastructure Architecture

```
                    ┌───────────────────────────┐
                    │     Vercel Deployment     │
                    │                           │
                    │  apps/store   apps/fsm    │
                    │  (Port 3000) (Port 3100)  │
                    └─────┬───────────────┬─────┘
                          │               │
        OAuth 2.0 / HMAC  │               │  OAuth 2.0 / HMAC
        Service Webhooks  ▼               ▼  Service Webhooks
                    ┌───────────┐   ┌───────────┐
                    │ Neon PG   │   │ Neon PG   │
                    │ store_db  │   │  fsm_db   │
                    │           │   │(btree_gist│
                    └───────────┘   └───────────┘
```

---

## 3. Database Setup (Neon PostgreSQL)

### 3.1 Provisioning
Create two independent databases in Neon (or two branches in a single Neon project):
1. `store_db` for System A
2. `fsm_db` for System B

### 3.2 Enable Required PostgreSQL Extensions
System B requires `btree_gist` for GiST exclusion constraint scheduling on technician appointments:
```sql
-- Connect to fsm_db
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

### 3.3 Migration Order
Always execute database migrations **before** deploying new application versions:
```powershell
# In local development / CI deploy script:
pnpm db:migrate
```

---

## 4. Vercel Project Setup

Create **two separate Vercel projects** pointing to the same GitHub repository:

### Project 1: `goodhand-store`
- **Root Directory:** `apps/store`
- **Framework Preset:** `Next.js`
- **Build Command:** `pnpm --filter=@prototype/store build`
- **Output Directory:** `.next`
- **Install Command:** `pnpm install`

### Project 2: `goodhand-fsm`
- **Root Directory:** `apps/fsm`
- **Framework Preset:** `Next.js`
- **Build Command:** `pnpm --filter=@prototype/fsm build`
- **Output Directory:** `.next`
- **Install Command:** `pnpm install`

---

## 5. Environment Variables Configuration

| Variable | Scope | Description | Sample Production Value |
|---|---|---|---|
| `NODE_ENV` | Both | Node execution environment | `production` |
| `DEMO_MODE` | Both | Enables `/demo` panel | `true` |
| `LOG_LEVEL` | Both | Structured logging verbosity | `info` |
| `STORE_DATABASE_URL` | Store | Neon connection string for store | `postgres://user:pass@ep-store.neon.tech/store_db?sslmode=require` |
| `STORE_PUBLIC_URL` | Store | Public domain of System A | `https://store.goodhand-demo.com` |
| `STORE_SESSION_SECRET` | Store | 64+ char random cookie signing key | *(Secret)* |
| `STORE_FSM_BASE_URL` | Store | Target System B API URL | `https://fsm.goodhand-demo.com/api/v1` |
| `STORE_SERVICE_CLIENT_ID` | Store | OAuth Client ID | `store-service` |
| `STORE_SERVICE_CLIENT_SECRET` | Store | OAuth Secret for System B auth | *(Secret)* |
| `CRON_SECRET_STORE` | Store | Bearer token for drain worker | *(Secret 32+ chars)* |
| `INSTALLATION_INTEGRATION_ENABLED` | Store | Integration feature flag | `true` |
| `FSM_DATABASE_URL` | FSM | Neon connection string for FSM | `postgres://user:pass@ep-fsm.neon.tech/fsm_db?sslmode=require` |
| `FSM_PUBLIC_URL` | FSM | Public domain of System B | `https://fsm.goodhand-demo.com` |
| `FSM_SESSION_SECRET` | FSM | 64+ char random cookie signing key | *(Secret)* |
| `FSM_STORE_BASE_URL` | FSM | Target System A API URL | `https://store.goodhand-demo.com/api/v1` |
| `FSM_SERVICE_CLIENT_ID` | FSM | OAuth Client ID | `fsm-service` |
| `FSM_SERVICE_CLIENT_SECRET` | FSM | OAuth Secret for System A auth | *(Secret)* |
| `CRON_SECRET_FSM` | FSM | Bearer token for FSM jobs | *(Secret 32+ chars)* |
| `RESEND_API_KEY` | Both | Optional Resend API key | Leave empty for live in-app `mail_log` |

---

## 6. Background Outbox Worker & Scheduled Triggers

### 6.1 GitHub Actions Drain Workflow (`.github/workflows/drain.yml`)
- Runs every 5 minutes (`*/5 * * * *`) via GitHub Actions.
- Issues authenticated POST requests to:
  ```bash
  curl -X POST https://store.goodhand-demo.com/api/internal/drain \
    -H "Authorization: Bearer $CRON_SECRET_STORE"
  ```

### 6.2 Execution Budget Guard
- Vercel Hobby serverless functions have a 10-second hard ceiling.
- The `drainQueue()` worker enforces an internal **6,000 ms** cutoff timer. Any remaining pending messages are safely deferred to the next cron interval without transaction interruption.

---

## 7. Rollback Procedure
If a production defect is discovered:
1. Open the Vercel Dashboard for the affected project (`goodhand-store` or `goodhand-fsm`).
2. Navigate to **Deployments**.
3. Locate the previous stable deployment and select **Instant Rollback**.
4. The transactional outbox guarantees that any messages queued during rollback will be cleanly retried once the stable deployment resumes.

