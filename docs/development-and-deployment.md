# Local Development and Deployment Runbook

This runbook is the canonical checklist for testing the application locally and deploying it to Cloudflare.

## Command model

The project uses [Vite+](https://viteplus.dev/) as its toolchain entry point:

- `vp dev`, `vp test`, `vp build`, and `vp check` run Vite+ built-ins.
- `vp run <name>` runs a project script from `package.json`.
- `vp exec <tool>` runs a binary installed in this project, such as Wrangler.

Install the `vp` CLI on macOS or Linux, then open a new terminal:

```bash
curl -fsSL https://vite.plus | bash
vp --version
```

## First local setup

Install dependencies:

```bash
vp install
```

Create the untracked local configuration if it does not already exist:

```bash
cp .dev.vars.example .dev.vars
```

The local authentication settings should include:

```dotenv
AUTH_MODE=local
LOCAL_DEV_USER_EMAIL=developer@example.com
ADMIN_EMAILS=developer@example.com
# Optional: explicitly trust additional development hostnames or IP addresses.
# LOCAL_DEV_ALLOWED_HOSTS=100.100.104.42,vibe97
```

Apply all migrations to the local D1 database:

```bash
vp run db:migrate:local
```

Start the application:

```bash
vp dev
```

Open the URL printed by Vite+, normally `http://localhost:5173`. Local identity is accepted on `localhost`, `127.0.0.1`, or `::1`. To connect from a trusted development device, add its exact hostname or IP address to the comma-separated `LOCAL_DEV_ALLOWED_HOSTS` variable in `.dev.vars`. Do not allow broad networks or public hostnames: every listed host receives the configured local identity without Cloudflare Access authentication.

## Local database behavior

Local development uses Cloudflare's Miniflare runtime and a locally persisted D1 database backed by SQLite. Its state is stored below:

```text
.wrangler/state/v3/d1/
```

Use the D1 interface or Wrangler rather than editing the SQLite file directly. For example:

```bash
vp exec wrangler d1 execute DB --local \
  --command "SELECT * FROM users"
```

The Workers integration tests use an isolated test D1 and apply migrations from `test/setup.ts`. Test runs do not modify the persistent database used by `vp dev`.

## Development loop

For normal development:

```bash
vp dev
```

When a branch adds a migration, update the local database before testing the affected code:

```bash
vp run db:migrate:local
```

Run focused checks as needed:

```bash
vp check          # Oxfmt formatting and Oxlint rules
vp run typecheck  # Vue, Worker, and config TypeScript checks
vp test           # Workers and isolated D1 integration tests
vp build          # Production Worker and client build
```

`vp check` uses type-aware Oxlint rules, but its full TypeScript-Go check is disabled because it does not currently load the Cloudflare Vitest pool's ambient test types. Keep the explicit `vue-tsc` and `tsc` checks in `vp run typecheck`.

## Required pre-deployment check

Before every deployment, run the complete project validation:

```bash
vp run check
```

This runs formatting, linting, explicit TypeScript checks, integration tests, and a production build. Do not deploy if any stage fails.

## One-time Cloudflare setup

### Authenticate Wrangler

```bash
vp exec wrangler login
```

### Create the production D1 database

```bash
vp exec wrangler d1 create your-app-db
```

Update `wrangler.jsonc` with the returned database name and ID, and replace the starter Worker name:

```jsonc
{
  "name": "your-app",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "your-app-db",
      "database_id": "your-real-database-id",
      "migrations_dir": "migrations",
    },
  ],
}
```

Never run local reset procedures against this remote database.

### Configure Cloudflare Access

Create a Zero Trust **Self-hosted application** for the production hostname and an Allow policy containing only approved users. Record its AUD tag and the Cloudflare Access team domain.

Set the production variables in `wrangler.jsonc`:

```jsonc
{
  "vars": {
    "AUTH_MODE": "access",
    "ADMIN_EMAILS": "admin@example.com",
    "CF_ACCESS_TEAM_DOMAIN": "https://your-team.cloudflareaccess.com",
    "CF_ACCESS_AUD": "your-real-access-application-aud",
  },
}
```

Production must use `AUTH_MODE=access`. Do not add `LOCAL_DEV_USER_EMAIL` to production configuration. The team domain and AUD identify the Access application; authentication still depends on verifying Cloudflare's signed JWT.

### Configure the production hostname

The project disables `workers.dev` and preview URLs so an alternate public URL cannot bypass Access. Configure a Custom Domain in `wrangler.jsonc`:

```jsonc
{
  "routes": [
    {
      "pattern": "family.example.com",
      "custom_domain": true,
    },
  ],
}
```

The hostname must exactly match the Cloudflare Access application. Protect the whole site, not only `/api/*`.

### Initialize production D1

```bash
vp run db:migrate:remote
```

Review the target shown by Wrangler before confirming. The deploy script does **not** run remote migrations automatically.

## Deployment

Once production configuration is complete:

```bash
vp run check
vp run deploy
```

`vp run deploy` repeats the complete validation and then invokes `wrangler deploy`.

When a release contains a new backwards-compatible database migration, use:

```bash
vp run check
vp run db:migrate:remote
vp run deploy
```

Database and application changes should be designed so the migration order is safe. Prefer additive migrations that remain compatible with the currently deployed Worker until the new Worker is live.

## Post-deployment verification

Verify the production custom domain after every deployment:

1. A signed-out browser is redirected to Cloudflare Access.
2. An allowed user can sign in and load the application.
3. `/api/health` returns a successful response after authentication.
4. Profile changes persist after a reload.
5. An administrator can open `/admin` and list users.
6. A non-administrator receives `403` from administrator APIs.
7. A disallowed identity cannot pass the Access policy.

## Routine release checklist

Use this shortened checklist after the one-time Cloudflare setup is complete:

```bash
vp install
vp run db:migrate:local  # when the branch contains new migrations
vp run check
vp run db:migrate:remote # only when production has unapplied migrations
vp run deploy
```

Do not use `--remote` during ordinary local development. Do not deploy `.dev.vars`; it is only for local authentication and local overrides.
