# Local database and authentication

Requires Node.js 24 or later. No separate database server or npm database driver
is required: local mode uses Node's built-in SQLite driver.

## Files and commands

- `.data/store.sqlite`: Store accounts/sessions and saved Store domain state.
- `.data/fsm.sqlite`: FSM accounts/sessions and saved FSM domain state.
- `.data/backups/`: consistent SQLite backups produced with the backup API.
- `.data/` is ignored by Git. It contains private application data.

Run from the repository root:

```powershell
pnpm db:init
pnpm db:status
pnpm db:backup
pnpm dev
```

Initialization creates missing tables without deleting data. Existing seeded
accounts are inserted on the first authentication request without overwriting
their passwords. `db:status` reports counts, never passwords or session tokens.
`db:backup` safely copies the database even with SQLite WAL enabled.

An absolute `GOODHAND_DATA_DIR` environment variable can select another local
directory. Set it consistently for both apps and for database commands.
Never remove the directory as a routine restart step. The older `demo:reset`
seed-validation script does not erase these persisted SQLite databases.

## Login behavior

The FSM header reads the server session and displays the current account/role
and **Sign out**. It displays **Sign in** only for unsigned users. This shared
header appears throughout System B. Signing out revokes the database session;
a copied JWT cookie no longer works after revocation. Sessions last eight hours
and survive app restarts until expiry or revocation.

Seed credentials remain listed in the project handoff. Missing passwords,
unknown accounts, incorrect passwords, and the former `demo` password shortcut
are rejected. Fast Demo Login buttons use the real seeded account passwords.
New Store customers must use **Create an account**, which stores a bcrypt hash
and always grants only the customer role. Arbitrary email/password pairs no
longer create an authenticated account implicitly. Existing pre-database
sessions require a fresh sign-in; previously arbitrary customer emails must
register because no actual account/password had been saved for them.

## Persistence implementation and scope

`packages/local-db/index.mjs` initializes versioned SQLite tables. Users and
sessions are SQL records. Existing domain service collections, maps, counters,
outboxes, feedback and mail are persisted as versioned domain snapshots in
`service_state`, retaining the current service behavior and OP schemas. Changed
state is written on service calls and asynchronous completion. The local
workers resume queued delivery when the apps start. Existing in-process data
is saved when first attaching persistence; the service's prototype is updated
on hot reload while retaining its data.

This adapter targets one local Node process per app. It is not a normalized
Postgres implementation and does not provide distributed transaction/claim
locking across multiple server instances. Do not use it as the production
multi-instance database adapter.

## Vercel deployment

A deployed function's `localhost` refers to the cloud runtime, not the developer
laptop. SQLite files in a deployment are not durable shared application storage.
The local adapter intentionally rejects `VERCEL` environments so it cannot
silently pretend data is durable there.

Before deployment, implement the hosted Postgres adapter using the existing
Drizzle/Postgres schemas, then provision Neon, Supabase Postgres, or another
reachable Postgres service. Migrate domain data from snapshots to relational
tables and transactions, implement database-level allocation/ledger guards,
configure pooled credentials per app in Vercel, and run durable scheduled outbox
workers. Setting the existing DATABASE_URL placeholders alone does not switch
this SQLite implementation to Postgres. Default local secrets and demo account
exposure also need production configuration.

References: [Vercel SQLite guidance](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel),
[Postgres on Vercel](https://vercel.com/docs/postgres), and
[Node SQLite API](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html).

## Verified

- Both production builds and existing cross-system contract checks pass.
- Database/authentication unit tests cover persistence, session expiry/revocation,
  password checks and rejection of unknown accounts.
- Browser checks cover signed-in/out header, refresh, copied-cookie revocation,
  registration, incorrect passwords, and mobile layout.
- Both running app servers were stopped and restarted. The newly registered
  account, existing sessions, new Store order, FSM job and technician schedule
  were verified after restart.
