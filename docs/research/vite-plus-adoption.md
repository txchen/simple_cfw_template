# Vite+ Adoption Assessment

**Conclusion:** this repository can use Vite+, including its Cloudflare Workers development server and Workers-pool integration tests. A throwaway migration to Vite+ 0.2.9 successfully ran `vp dev`, `vp test`, and `vp build`. However, `vp migrate` is not a zero-review conversion for this project: its default `vp check` type checker does not understand the Cloudflare Vitest pool's ambient test modules, and the generated npm runtime pin requires a corresponding CI change. Adopt it only if a unified team toolchain is valuable; do not migrate merely to simplify this small repository.

> **Implementation update, 2026-08-13:** the repository has now adopted Vite+ 0.2.9. It retains explicit `vue-tsc`/`tsc` checks, disables Vite+'s incompatible TypeScript-Go check, keeps the Cloudflare Vitest configuration separate, and uses the pinned `setup-vp` GitHub Action in CI.

## Current fit

The project already meets Vite+'s documented migration baseline:

- Vite is 8.1.5; Vite+ asks existing projects to upgrade to Vite 8+ first.
- Vitest is 4.1.10; Vite+ asks for Vitest 4.1+ and currently bundles 4.1.10.
- Node 20.19+ is already the repository requirement, matching the `vite-plus` package's supported Node ranges.
- The repository uses npm and Vite+ supports npm, pnpm, Yarn, and Bun.

Vite+ documents `vp migrate` as the route for an existing Vite project. It replaces the direct Vite command surface with `vp dev`, `vp build`, and `vp preview`; rewrites Vitest imports to `vite-plus/test`; and adds a `vite` alias to `@voidzero-dev/vite-plus-core` plus a Vitest version override. These aliases are important because Vite plugins continue to resolve a package named `vite`. [Vite+ migration guide](https://viteplus.dev/guide/migrate) | [Migration rules](https://viteplus.dev/guide/migrate-rules)

The Cloudflare packages' published peer ranges are compatible:

- `@cloudflare/vite-plugin@1.47.0` accepts Vite 6, 7, or 8.
- `@cloudflare/vitest-pool-workers@0.18.8` requires Vitest, runner, and snapshot packages in the `^4.1.0` line.
- `@vitejs/plugin-vue@6.0.8` accepts Vite through version 8.

Sources: [Cloudflare Vite plugin package](https://www.npmjs.com/package/@cloudflare/vite-plugin/v/1.47.0), [Cloudflare Vitest pool package](https://www.npmjs.com/package/@cloudflare/vitest-pool-workers/v/0.18.8), [Vue Vite plugin package](https://www.npmjs.com/package/@vitejs/plugin-vue/v/6.0.8).

## Throwaway migration result

On 2026-08-13, the repository's committed files were copied to `/tmp`, migrated non-interactively with Vite+ 0.2.9, and tested without changing the working repository. Vite+ 0.2.9 was the current npm release and GitHub release at the time. [npm package](https://www.npmjs.com/package/vite-plus/v/0.2.9) | [GitHub release](https://github.com/voidzero-dev/vite-plus/releases/tag/v0.2.9)

The automatic migration:

- added `vite-plus@0.2.9`;
- aliased `vite` to `@voidzero-dev/vite-plus-core@0.2.9`;
- retained and pinned direct `vitest@4.1.10`, which is necessary for the Cloudflare pool peer dependency;
- rewrote `vite`/`vitest` config imports and test imports;
- wrapped the Vue and Cloudflare Vite plugins with `lazyPlugins`;
- retained the separate `vitest.config.ts` rather than consolidating it into `vite.config.ts`;
- added Oxfmt/Oxlint configuration and formatted migrated files.

Observed validation:

| Check                                                    | Result                              |
| -------------------------------------------------------- | ----------------------------------- |
| `vp dev --host 127.0.0.1` + `GET /api/health`            | Passed; returned the health JSON    |
| `vp test`                                                | Passed: 1 file, 12 tests            |
| `vp build`                                               | Passed: Worker and Vue client built |
| Existing `vue-tsc` + `tsc` type-check chain              | Passed                              |
| Default migrated `vp check`                              | Failed with 9 test-only type errors |
| `vp check` after setting `lint.options.typeCheck: false` | Passed formatting and linting       |

The dependency graph remained coherent: the Cloudflare plugin, Vue plugin, Vitest, and Vite+ all resolved the same aliased Vite core, and the Cloudflare test pool resolved the same Vitest 4.1.10 instance. This is consistent with Vite+'s warning that a single Vitest copy is required. [Vite+ migration guide](https://viteplus.dev/guide/migrate#manual-installation-migration)

## Manual issues to resolve

### 1. Keep the existing TypeScript checks

`vp migrate` enables `lint.options.typeAware` and `typeCheck` by default. Vite+ implements this through Oxlint/tsgolint and the TypeScript Go toolchain. In this repository it also inspected `test/`, but did not receive the Cloudflare test pool's generated ambient declarations. It therefore reported missing `cloudflare:workers`, `cloudflare:test`, and `D1Migration` types, followed by incorrect `Response.json<T>()` diagnostics.

The existing type-check script deliberately checks three explicit projects and passes. The low-risk setup is therefore:

```ts
lint: {
  options: {
    typeAware: true,
    typeCheck: false,
  },
}
```

Then preserve `vue-tsc`/`tsc` as a separate CI step. This gives Vite+ formatting and linting without pretending that its current type-check path is equivalent to the project's Vue and Workers-aware checks. Vite+ documents that `vp check` combines formatting, linting, and optional type checking, and that `typeCheck` is configurable. [Vite+ check guide](https://viteplus.dev/guide/check) | [Lint configuration](https://viteplus.dev/config/lint)

### 2. Preserve the Cloudflare-specific Vitest config

Vite+ recommends putting Vitest options in `vite.config.ts`, but the automatic migration retained `vitest.config.ts`, and `vp test` successfully discovered it. Keeping it separate is sensible here because `cloudflareTest(...)` configures Miniflare, Wrangler, D1 migrations, and Workers-only test bindings; it should not be loaded for ordinary frontend development/build configuration. [Vite+ test guide](https://viteplus.dev/guide/test) | [Cloudflare Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/)

### 3. Update CI and package-manager policy together

Because the repository only had `package-lock.json`, migration detected npm and wrote a concrete `devEngines.packageManager` pin. In the experiment it selected npm 12.0.2. Running the machine's npm 11.6.2 afterward failed with `EBADDEVENGINES`; `vp install` worked because Vite+ supplied the pinned package manager.

Therefore either:

1. fully adopt Vite+ environment management in CI via `voidzero-dev/setup-vp`, then use `vp install`; or
2. explicitly retain the team's chosen Node/npm versions and review/remove the generated package-manager pin rather than committing an accidental local version.

The first option is the coherent full adoption. Vite+ documents that it detects and records the package manager, manages matching package-manager shims, and provides a first-party CI setup action. [Install guide](https://viteplus.dev/guide/install) | [Environment guide](https://viteplus.dev/guide/environment) | [CI guide](https://viteplus.dev/guide/ci)

The experiment also showed npm 12 warning that install scripts for `esbuild` and `workerd` were blocked pending approval. Development, tests, and build still passed in that environment, but CI must test a cold install and explicitly approve required scripts rather than relying on a warm machine. Vite+ documents the npm 12 dependency-build-script policy. [Creating a project: dependency build scripts](https://viteplus.dev/guide/create#dependency-build-scripts)

### 4. Expect a larger toolchain dependency

In this checkout, the lockfile grew from approximately 108 KB/204 package entries to 157 KB/290 entries, and `node_modules` grew from roughly 372 MB to 444 MB. Vite+ includes Vitest, Oxfmt, Oxlint, TypeScript-Go-backed linting, browser-test base packages, and platform binaries in one dependency. That cost may be reasonable for organization-wide consistency, but the current project has no ESLint, Prettier, monorepo, or task-cache complexity to eliminate.

## Recommendation

**Technically feasible, but use a controlled migration rather than accepting `vp migrate` blindly.**

Adopt Vite+ if the goal is to standardize this template so copied projects all use the same runtime/package-manager/dev/check/test/build interface. The strongest benefit is template-level consistency, not a dramatic simplification of this individual repository.

For this small standalone app, staying on direct Vite/Vitest is also reasonable: the existing toolchain is already current, its `npm run check` is explicit and reliable, and Vite+ 0.2.x adds a new release train plus package-manager policy. If adopted now, pin an exact Vite+ version and upgrade deliberately.

Recommended migration shape:

1. Create a migration branch and ensure a clean worktree.
2. Upgrade the global CLI and run `vp migrate --no-interactive` as documented.
3. Review every rewritten import, script, lockfile change, and formatting change.
4. Keep `vitest.config.ts` and direct Vitest 4.1.10 for the Cloudflare pool.
5. Disable Vite+'s `typeCheck` for now; retain the existing `vue-tsc`/`tsc` script.
6. Define validation as formatting/linting, explicit type checks, Workers tests, then build.
7. Replace GitHub Actions' plain `setup-node`/`npm ci` flow with a pinned `setup-vp` action and `vp install`, or deliberately preserve a fixed npm policy.
8. Validate a cold install plus local D1 migration, `vp dev`, `vp check`, the existing type checks, `vp test`, and `vp build`.
9. Keep `wrangler` and both D1 migration scripts as project commands; Vite+ does not replace Wrangler.

No source files were changed as part of the experiment; only this research note was added.
