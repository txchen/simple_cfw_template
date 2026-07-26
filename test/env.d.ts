import type { Bindings } from "../server/env";

declare module "cloudflare:workers" {
  interface ProvidedEnv extends Bindings {
    TEST_MIGRATIONS: D1Migration[];
  }
}
