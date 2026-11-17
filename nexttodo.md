# Goodhand next actions

The separate Neon databases have been migrated and imported from the local SQLite files. The original backups remain. System A and System B must be deployed as two Vercel projects using the instructions in `docs/deployment.md`.

1. Review the latest `pnpm test`, `pnpm contract:lint`, `node scripts/contract-check.mjs`, `pnpm build`, `pnpm e2e`, and `node scripts/verify-postgres.mjs` results. The E2E suite runs against isolated temporary SQLite data; the separate Neon verification script checks database concurrency constraints.
2. Push reviewed code to the Goodhand GitHub repository. Connect it to two Vercel projects and set each app's environment variables. Set the shared service credentials and both cron secrets in GitHub Actions. Deploy the Store and FSM apps, then run the drain workflow once manually.
3. Use test accounts to run a hardware-only order and an installation order. Verify customer tracking, reschedule/cancel, technician claim, staff assignment, completion, stock, and Operations queue recovery. Sign in again after the SQLite-to-Neon cutover because old sessions were not imported.
4. Complete the H7 rehearsal and record the backup walkthrough. Sign the human QA checklist only for checks performed. Do not run `demo:reset` against Neon.
5. Before real sales, replace simulated payment, rotate known demo accounts and production secrets, implement password recovery and email delivery, and review public access and load behavior. The PostgreSQL compatibility adapter serializes writes and hydrates domain rows on each request; narrow those queries and locks as traffic grows.

See `PROGRESS.md`, `docs/local-database.md`, `docs/api-register.md`, and `docs/runbook.md` for implemented behavior and recovery steps.
