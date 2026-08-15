# Architecture and Decisions

## Request flow

Cloudflare Access protects the complete `cfwt.txchen.win` hostname. After an Access policy allows a request, Cloudflare injects `Cf-Access-Authenticated-User-Email`. The Worker normalizes that email, resolves an application-owned D1 user, and then runs the requested Hono route. Vue and the API share the same origin.

The Worker deliberately trusts the Access-protected edge instead of verifying an Access JWT itself. Consequently, `workers.dev`, preview URLs, and any alternate unprotected route must remain disabled.

## Modules and seams

- `server/users.ts` is the user seam. It resolves Access or local identities, provisions users, updates the current profile, and lists users for administrators.
- `server/app.ts` owns HTTP routing, middleware ordering, and stable error responses.
- `shared/profile.ts` is the runtime and TypeScript source of truth for profile updates.
- `src/api.ts` is the browser-to-server seam and normalizes structured, malformed, and non-JSON responses.
- `src/ProfilePage.vue` and `src/AdminPage.vue` own page-specific state; `src/App.vue` owns only application loading and page selection.

## Validation

Profile validation uses Valibot through Hono Standard Schema. Valibot keeps the Worker dependency small and provides a single runtime/static contract. `server/profile.ts` translates library issues into the application's stable error shape so routes and clients do not depend on Valibot's native issue format.

Malformed JSON remains a `400 invalid_json`; valid JSON with an invalid profile is a `422 invalid_profile`.

## Toolchain

Vite+ is pinned as the project toolchain and provides dependency management, formatting, linting, tests, and builds. The Cloudflare Vite plugin and Vitest pool continue to use their normal Vite/Vitest peer interfaces through Vite+'s aliases.

`vp check` runs Oxfmt and type-aware Oxlint rules. Full Vite+ TypeScript-Go checking is disabled because it does not load the Cloudflare Vitest pool's ambient types. Explicit checks remain authoritative:

- `vue-tsc` checks Vue SFCs and frontend TypeScript.
- `tsc` checks the Worker and build/test configuration.

Use `vp run check` for the complete formatting, linting, type-checking, integration-test, and production-build gate.
