# Deploy GoodHand Store and Field Service on Vercel

Deploy **Store (`apps/store`)** and **FSM (`apps/fsm`)** as separate Vercel projects linked to the same GitHub repository. Each uses its own existing Neon PostgreSQL project. The one-time SQLite import is already complete on this machine; **do not run `db:import-local` against populated Neon databases**. Local SQLite cannot persist on Vercel.

## 1. Verify the source and databases

1. Open PowerShell in the repository root. Confirm Node 24 and pnpm 9; run `pnpm install --frozen-lockfile`.
2. Run `pnpm db:cloud-status` and `node scripts/verify-postgres.mjs`. Both Neon databases should respond with imported records. Private URLs are in `apps/store/.env.local` and `apps/fsm/.env.local`; never commit them.
3. Run `pnpm contract:generate`, `git diff --exit-code packages/contract/generated`, `pnpm contract:lint`, `node scripts/contract-check.mjs`, `pnpm test`, `pnpm build`, and `pnpm e2e`. Builds now run sequentially. Confirm GitHub **Actions → CI** is green.
4. For future schema changes, take a Neon branch/snapshot, then run `pnpm db:migrate` before deploying code that needs the migration. Never rerun the import or demo reset on live databases.

## 2. Copy the two Neon URLs

In each existing Neon project (`goodhand-store` and `goodhand-fsm`), open **production → Connect → Postgres database**. Select database `neondb`, role `neondb_owner`, and **Connection pooling ON**. Copy the full URL privately. Use the Store URL only for `STORE_DATABASE_URL` and the FSM URL only for `FSM_DATABASE_URL`. Their hosts must differ. Keep the supplied TLS parameters.

## 3. Create two Vercel projects

1. Sign in to Vercel through GitHub. Select **Add New → Project → Import Git Repository → mavvricks/SIA_GOODHAND**. If absent, grant the Vercel GitHub app repository access.
2. Name the first project `goodhand-store`. Set **Framework Preset: Next.js**, **Root Directory: apps/store**, and enable **Include source files outside the Root Directory in the Build Step**. Leave output at the Next.js default. Select Node.js **24.x** in **Settings → Build and Deployment → Node.js Version** (both app manifests also pin 24.x). Use the package build command `pnpm build` or Vercel's detected Next.js command; do not use the monorepo root build for a single project. Leave **Install Command** on automatic detection.
3. Import the same repository again as `goodhand-fsm`, with Root Directory `apps/fsm` and the same framework/source/Node settings.
4. Add the environment variables below before deploying. Copy each stable `https://<project>.vercel.app` address from **Settings → Domains**. If you add custom domains later, update all cross-system URLs and redeploy both projects. Changes to env vars require a redeployment.

## 4. Add Vercel environment variables

In each project's **Settings → Environment Variables**, add these to **Production**. Use separate preview Neon branches and preview URLs if enabling Preview environments; do not connect untrusted previews to production data. Secret names must not start with `NEXT_PUBLIC_`.

| Store project                      | Value                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| `STORE_DATABASE_URL`               | Pooled URL from goodhand-store Neon                                                               |
| `STORE_SESSION_SECRET`             | Unique random secret, at least 64 characters                                                      |
| `FSM_SESSION_SECRET`               | **Exact same value as FSM project's `FSM_SESSION_SECRET`**; Store verifies service tokens with it |
| `STORE_SERVICE_CLIENT_ID`          | `store-service`                                                                                   |
| `STORE_SERVICE_CLIENT_SECRET`      | Strong random secret, identical in both projects                                                  |
| `STORE_WEBHOOK_SIGNING_SECRET`     | Different strong random secret, identical in both projects                                        |
| `STORE_FSM_BASE_URL`               | `https://<fsm-domain>/api/v1`                                                                     |
| `STORE_PUBLIC_URL`                 | `https://<store-domain>`                                                                          |
| `CRON_SECRET_STORE`                | Unique strong random secret                                                                       |
| `INSTALLATION_INTEGRATION_ENABLED` | `true`                                                                                            |
| `DEMO_MODE`                        | `false`                                                                                           |
| `ENABLE_EXPERIMENTAL_COREPACK`     | `1` to use the repository's pinned pnpm 9                                                         |

| FSM project                    | Value                                      |
| ------------------------------ | ------------------------------------------ |
| `FSM_DATABASE_URL`             | Pooled URL from goodhand-fsm Neon          |
| `FSM_SESSION_SECRET`           | Unique random secret, also copied to Store |
| `STORE_SERVICE_CLIENT_ID`      | `store-service`                            |
| `STORE_SERVICE_CLIENT_SECRET`  | Exact same value as Store                  |
| `STORE_WEBHOOK_SIGNING_SECRET` | Exact same value as Store                  |
| `FSM_STORE_BASE_URL`           | `https://<store-domain>/api/v1`            |
| `FSM_PUBLIC_URL`               | `https://<fsm-domain>`                     |
| `CRON_SECRET_FSM`              | Different strong random secret             |
| `DEMO_MODE`                    | `false`                                    |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` to use the repository's pinned pnpm 9 |

Generate each new secret separately in a private terminal, for example `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. Existing ignored `.env.local` files also contain generated values. Copy shared values exactly where indicated. Do not set `GOODHAND_E2E_SQLITE` or test database URLs in Vercel. The code rejects a Vercel production runtime with no own database URL or SQLite mode.

Optional email: set `RESEND_API_KEY` and a verified `MAIL_FROM` domain in the sending project. Without them, messages only appear in the in-app mail log. Payment choices are **simulations**; real collection needs a payment provider and separate review.

## 5. Configure queue delivery on GitHub

In GitHub, open **Repository → Settings → Secrets and variables → Actions → New repository secret** and create:

| Secret              | Value                    |
| ------------------- | ------------------------ |
| `STORE_PUBLIC_URL`  | `https://<store-domain>` |
| `FSM_PUBLIC_URL`    | `https://<fsm-domain>`   |
| `CRON_SECRET_STORE` | Exact Store Vercel value |
| `CRON_SECRET_FSM`   | Exact FSM Vercel value   |

The transactional outboxes need the GitHub Actions scheduler because Vercel functions are not durable background workers. After both sites are live, run **Actions → Outbox Drain Scheduler → Run workflow**. Both steps must succeed. Missing secrets now fail visibly. The schedule is every five minutes, but GitHub scheduled jobs can run late; updates are eventually consistent. For stricter timing, use a managed queue/worker later.

## 6. Rotate published demo passwords

Historical public docs and source include known seed passwords. Rotate them **before opening the hosted apps to users**. On this trusted machine with private Neon URLs configured, run:

```powershell
node scripts/rotate-seed-passwords.mjs store --apply
node scripts/rotate-seed-passwords.mjs fsm --apply
```

This updates only known seeded accounts, revokes their sessions, and writes `.data/rotated-store-credentials.json` and `.data/rotated-fsm-credentials.json`. These Git-ignored files contain new passwords; move them to a password manager. Never paste them into chat, GitHub, or Vercel. Existing registered customers are unaffected. Do not run `demo:reset` or reseed after rotation.

## 7. Verify production

1. Open Store `/products` and FSM `/login`. Check Vercel **Build Logs** for build failures and **Runtime Logs** for request errors. Confirm each project's Neon URL if a route fails.
2. Sign in with a rotated Store customer account. Place a hardware-only order with a **simulated** payment. It should appear in **My orders** and create no FSM job.
3. Place an installation order. Run the GitHub drain workflow. FSM should receive one pending job. Sign in with rotated FSM staff credentials, claim or assign it, then verify the customer timeline updates after status changes and the FSM drain.
4. Check stock deduction, delivery status, customer order ownership, and both scheduler steps. Monitor Vercel function logs and Neon usage after launch.

For rollback, redeploy compatible Store and FSM builds together. Restore a compatible Neon branch/snapshot only if migration changes require it; check cross-system order/job references before restoring one database alone.

References: [Vercel monorepo setup](https://vercel.com/docs/monorepos/monorepo-faq), [Vercel environment variables](https://vercel.com/docs/environment-variables/managing-environment-variables), [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions), [Neon connection pooling](https://neon.com/docs/connect/connection-pooling).
