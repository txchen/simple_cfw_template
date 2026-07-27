# Hono + Valibot vs Zod for This Project

The short answer: **Hono does not recommend Valibot over Zod.** Hono recommends third-party validators, documents Zod first, and presents Zod, Valibot, and ArkType side by side through Standard Schema. It describes Valibot as a lightweight, modular alternative to Zod and maintains middleware for Valibot, Zod, and Standard Schema. All are officially supported; Valibot does not have an exclusive endorsement. [Hono validation guide](https://hono.dev/docs/guides/validation) | [Hono third-party middleware](https://hono.dev/docs/middleware/third-party)

## Cloudflare Workers comparison

| Area | Valibot | Zod | Relevance to this project |
| --- | --- | --- | --- |
| Worker bundle and startup | Small functions with tree shaking. Valibot reports a minimum below 700 B, a 1.31 kB example schema, and reductions of up to 95% versus Zod for specific cases. These are Valibot's figures, not a guarantee for every schema. [Valibot introduction](https://valibot.dev/guides/introduction/) | Zod 4 significantly reduced the size gap and provides the functional, tree-shakable Zod Mini. Zod recommends regular Zod for most applications and Mini where bundle constraints are strict. [Zod 4 release notes](https://zod.dev/v4#introducing-zod-mini) | Edge deployments generally favor Valibot. Cloudflare notes that large bundles affect startup and limits Worker startup to one second. [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/#worker-startup-time) A local minified and gzipped sample on 2026-07-26 used equivalent profile schemas: Valibot 1.4.2 was about **1.6 kB gzip**, while the regular Zod 4.4.3 entry was about **18.2 kB gzip**. This was not a complete Worker, excluded the Hono adapter, and is not a general benchmark. |
| Runtime | Supports synchronous and asynchronous parsing. It collects all issues by default and supports `abortEarly` and `abortPipeEarly`. [Valibot parse data](https://valibot.dev/guides/parse-data/) | Supports synchronous and asynchronous `parse` and `safeParse`. [Zod README](https://github.com/colinhacks/zod/blob/main/packages/zod/README.md#basic-usage) | Valibot's own comparison places its runtime performance in the middle and close to Zod 4 and Mini, not universally faster. [Valibot comparison](https://valibot.dev/guides/comparison/#performance) Runtime is unlikely to matter for a three-field schema. |
| API | Functional pipelines such as `v.pipe(v.string(), v.trim(), v.maxLength(80))`. The modular composition is explicit but can be more verbose. [Valibot migration guide](https://valibot.dev/guides/migrate-from-zod/) | Fluent chains such as `z.string().trim().max(80)`. The syntax is compact and familiar to many TypeScript developers. [Zod README](https://github.com/colinhacks/zod/blob/main/packages/zod/README.md) | Both express the current trim, nullable, URL, and custom timezone rules. Team familiarity may matter more than a few kilobytes. |
| Type inference | Provides `InferInput`, `InferOutput`, and `InferIssue`. [Valibot inferred types](https://valibot.dev/guides/infer-types/) | Provides `z.input`, `z.output`, and `z.infer`. [Zod README](https://github.com/colinhacks/zod/blob/main/packages/zod/README.md#inferring-types) | Either schema can become the source of `ProfileUpdate`, preventing runtime validation and TypeScript contracts from drifting apart. Valibot offers more precise issue types, though this project maps them into its own API error format. |
| Errors | `safeParse` returns `{ success, output, issues }`. Issues include kind, type, path, and message, and can be flattened. [Valibot issues](https://valibot.dev/guides/issues/) | `safeParse` returns a discriminated union whose failure branch contains a `ZodError` with issues. [Zod README](https://github.com/colinhacks/zod/blob/main/packages/zod/README.md#handling-errors) | Neither native format matches `{ error: { code, message, fields } }`. Both need an adapter, and raw library errors should not be exposed to clients. |
| Hono integration | Hono maintains `@hono/valibot-validator`; Valibot also works through `@hono/standard-validator`. [Valibot middleware](https://github.com/honojs/middleware/tree/main/packages/valibot-validator) | Hono maintains `@hono/zod-validator`; Zod also works through `@hono/standard-validator`. [Zod middleware](https://github.com/honojs/middleware/tree/main/packages/zod-validator) | Integration capability is effectively equal. Standard Schema is a shared interface created by the maintainers of Zod, Valibot, and ArkType, reducing route-layer coupling to a particular library. [Standard validator](https://github.com/honojs/middleware/tree/main/packages/standard-validator) |
| Ecosystem and OpenAPI | The ecosystem is growing and covers basic Hono validation well. [Valibot ecosystem](https://valibot.dev/guides/ecosystem/) | Zod emphasizes its extensive ecosystem and includes JSON Schema conversion. Hono lists several Zod and OpenAPI integrations. [Zod ecosystem](https://zod.dev/ecosystem), [Hono middleware list](https://hono.dev/docs/middleware/third-party) | Zod usually requires less integration work for mature OpenAPI, code generation, or tools that specifically require Zod. Valibot is sufficient for Worker request validation. |

## Project-specific context

> Implementation update, 2026-07-26: the starter now uses Valibot 1.4.2 with `@hono/standard-validator` 0.3.0. The discussion below preserves the decision context from before adoption. Zod in the lockfile is a development-only transitive dependency of the test tooling, not an application API. [package.json](../../package.json), [package-lock.json](../../package-lock.json)

The project has one primary request-body boundary: `PATCH /api/me/profile`. Its validation contract includes more than type checks:

- Malformed JSON returns 400, while valid JSON with an invalid profile returns 422.
- `null`, `undefined`, and empty strings normalize to `null`; strings are trimmed.
- Errors for all three fields are collected with stable English messages.
- Avatar URLs accept only `http:` and `https:`; timezones use the runtime's `Intl.DateTimeFormat` validation.
- The client displays errors by field, and tests assert field ordering.

A schema library primarily provides declarative rules, one source for runtime validation and static types, and reuse across future endpoints. Adoption must preserve the behavior above rather than accepting middleware defaults or exposing native issues.

## Recommendation

1. Do not migrate solely because Valibot is supposedly the preferred Hono pairing. This starter adopted it to demonstrate edge-friendly schema validation, inferred types, and Standard Schema integration.
2. For additional write APIs, prefer **Valibot + `@hono/standard-validator`**. Smaller bundles matter on Workers, this project has no Zod ecosystem dependency, and Standard Schema keeps route code independent from Valibot-specific middleware.
3. Keep a project adapter that converts issues into `HttpError(422, "invalid_profile", ..., fields)`. Test malformed JSON separately, retain the IANA timezone check, and make empty-string normalization explicit.
4. Prefer **Zod 4**, with an evaluation of Zod Mini, when near-term goals include OpenAPI, code generation, or a team already standardized on Zod. Ecosystem maturity may outweigh the bundle difference.

In summary: **Valibot has a slight advantage for this Worker, based on edge bundle size and modularity rather than an official Hono claim that it is universally better than Zod.**

---

Sources accessed on **2026-07-26, America/Los_Angeles**. Versions came from npm registry metadata on that date: [`valibot` 1.4.2](https://registry.npmjs.org/valibot/latest), [`zod` 4.4.3](https://registry.npmjs.org/zod/latest), [`@hono/valibot-validator` 0.6.1](https://registry.npmjs.org/@hono/valibot-validator/latest), [`@hono/zod-validator` 0.9.0](https://registry.npmjs.org/@hono/zod-validator/latest), and [`@hono/standard-validator` 0.3.0](https://registry.npmjs.org/@hono/standard-validator/latest). Vendor-reported bundle figures use different entries and schemas, so they are directional rather than directly comparable.
