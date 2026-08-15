# Development and Deployment Runbook

This is the canonical operational checklist for `cfwt.txchen.win`.

## Toolchain

Install Vite+ on macOS or Linux, then open a new terminal:

```bash
curl -fsSL https://vite.plus | bash
vp --version
```

Vite+ owns the project command surface:

- `vp dev`, `vp check`, `vp test`, and `vp build` run built-in tools.
- `vp run <name>` runs a project script.
- `vp exec <tool>` runs a project dependency such as Wrangler.

## First local setup

```bash
vp install
cp .dev.vars.example .dev.vars
vp run db:migrate:local
vp dev
```

The local authentication configuration is:

```dotenv
AUTH_MODE=local
LOCAL_DEV_USER_EMAIL=developer@example.com
ADMIN_EMAILS=developer@example.com
# Optional, trusted development addresses only:
# LOCAL_DEV_ALLOWED_HOSTS=100.100.104.42,vibe97
```

Open the URL printed by Vite+, normally `http://localhost:5173`. Loopback hostnames are accepted automatically. Every hostname or IP in `LOCAL_DEV_ALLOWED_HOSTS` receives the configured identity without Access authentication, so never list public or broadly shared addresses.

## Local and test databases

Local development uses Miniflare's SQLite-backed D1 implementation and persists it under:

```text
.wrangler/state/v3/d1/
```

Inspect it through Wrangler rather than editing SQLite directly:

```bash
vp exec wrangler d1 execute DB --local \
  --command "SELECT * FROM users"
```

Tests run against an isolated D1 database and apply every migration from `test/setup.ts`. They do not modify the database used by `vp dev`.

When a branch adds a migration, apply it locally before manual testing:

```bash
vp run db:migrate:local
```

## Development checks

Run focused commands while working:

```bash
vp check          # Oxfmt and type-aware Oxlint rules
vp run typecheck  # vue-tsc plus Worker/config tsc projects
vp test           # Workers and D1 integration tests
vp build          # production Worker and Vue assets
```

Run the complete required gate before every deployment:

```bash
vp run check
```

Vite+'s full TypeScript-Go check remains disabled because it does not load the Cloudflare Vitest pool's ambient types. The explicit `vue-tsc` and `tsc` projects are authoritative.

## Wrangler authentication

This project is bound to the named Wrangler profile `txchendev`. Verify the active identity from the repository root:

```bash
vp exec wrangler auth list
vp exec wrangler whoami
```

To create or refresh a profile on a remote SSH host, forward Wrangler's callback port from the computer that has the browser:

```bash
ssh -L 8976:127.0.0.1:8976 vibe97
```

Then, in that remote shell:

```bash
vp exec wrangler auth create txchendev \
  --browser=false \
  --callback-host 127.0.0.1
vp exec wrangler auth activate txchendev
```

Exit the SSH session to close the tunnel. Do not store `CLOUDFLARE_API_TOKEN` in `.dev.vars` or the repository.

## Production configuration

`wrangler.jsonc` is the source of truth for:

- Worker `cfwtemplate`
- Cloudflare account and D1 database binding
- `AUTH_MODE=access`
- application `ADMIN_EMAILS`
- custom domain `cfwt.txchen.win`
- disabled `workers.dev` and preview URLs

Cloudflare Zero Trust must protect the complete `cfwt.txchen.win` hostname. Its Allow policy controls entry to the site. `ADMIN_EMAILS` controls application administration only and does not grant Access entry.

The Worker trusts `Cf-Access-Authenticated-User-Email` and does not independently verify a JWT. Do not add an unprotected route, `workers.dev` endpoint, or preview URL.

## Migration ordering

The deploy script deliberately does not apply remote D1 migrations automatically. Review pending migrations first:

```bash
vp exec wrangler d1 migrations list DB --remote
```

For an additive migration that remains compatible with the currently deployed Worker:

```bash
vp run check
vp run db:migrate:remote
vp run deploy
```

For a destructive migration, use a staged rollout:

1. Deploy code that works with both the old and new schema.
2. Apply the remote migration.
3. Remove temporary compatibility code in a later deployment.

Always confirm Wrangler reports the expected account and database before approving a remote migration.

## Deployment

For a release without pending migrations:

```bash
vp run deploy
```

`vp run deploy` repeats the complete validation gate, builds the Worker and static assets, then deploys the custom-domain trigger.

## Post-deployment verification

After every deployment, verify:

1. A signed-out request to `https://cfwt.txchen.win` redirects to Cloudflare Access.
2. An allowed user can sign in and load the profile.
3. `/api/health` succeeds after authentication.
4. Profile changes survive a reload.
5. An application administrator can open `/admin`.
6. A non-administrator receives `403` from administrator routes.
7. A disallowed identity cannot pass the Access policy.

A quick unauthenticated edge check is:

```bash
curl -sSI https://cfwt.txchen.win | head
```

The expected result is a redirect to the Cloudflare Access login endpoint.
