# Database modes and Neon cutover

Node.js 24 is required. Each app uses SQLite when its database URL is empty and PostgreSQL when its URL is configured. Store and FSM need separate databases. Vercel requires PostgreSQL because deployed local files are not durable shared storage.

## Local SQLite

The default files are `.data/store.sqlite` and `.data/fsm.sqlite`. `pnpm db:init`, `pnpm db:status`, and `pnpm db:backup` operate on them. `GOODHAND_DATA_DIR` can select an absolute directory. SQLite is suitable for one local process per app. It stores service snapshots and does not offer cross-process transaction safety. Never run `demo:reset` against live data.

## Neon PostgreSQL

Place the Store pooled URL in `apps/store/.env.local` as `STORE_DATABASE_URL` and the FSM pooled URL in `apps/fsm/.env.local` as `FSM_DATABASE_URL`. Keep both files private. `node scripts/check-database-env.mjs` checks the URLs without printing them. `node scripts/configure-local-secrets.mjs` fills missing local secrets and aligns shared integration credentials.

Run from the repository root:

```powershell
pnpm db:backup
pnpm db:migrate
pnpm db:import-local
pnpm db:cloud-status
node scripts/verify-postgres.mjs
```

The import copies users and domain records from SQLite into empty Neon databases. It refuses to overwrite a nonempty destination and records completion so retries skip safely. Original SQLite files and backups remain untouched. Sessions are not imported; users sign in again. Active SQL migrations are in `packages/database/migrations/`; the old Drizzle files in `apps/*/db/` are not the migration source.

PostgreSQL stores users and sessions as records and each order, job, stock row, outbox event, feedback, and related entity in its own row with JSONB details. A request loads current entities and commits all changed entities together. A database advisory lock serializes writers across instances, while shared read locks allow concurrent reads. The schema enforces nonnegative stock, unique transaction IDs, and a two-hour appointment gap. Outbox workers lease an event, call the partner outside the business transaction, and record the result. Receivers verify HMAC and timestamp and deduplicate successful webhook responses.

This compatibility adapter protects correctness for the prototype and modest traffic. It serializes each app's writes and hydrates all domain entities per request. Larger workloads need granular SQL repositories and narrower locks. Payment is still simulated, and known demo accounts require rotation before public use.

Keep SQLite backups and Neon restore points. A failed migration/import rolls back its transaction. After accepting new Neon orders, switching back to old SQLite files would omit those orders. Use staff Operations pages or authenticated `POST /api/internal/drain` to recover queued messages.
