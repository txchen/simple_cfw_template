import { Hono, type MiddlewareHandler } from "hono";
import type { AppUser } from "../shared/contracts";
import {
  createCurrentUserModule,
  type CurrentUserModule,
} from "./current-user";
import type { Bindings } from "./env";
import { HttpError } from "./errors";
import { parseProfileUpdate } from "./profile";

type HonoEnv = {
  Bindings: Bindings;
  Variables: {
    currentUser: AppUser;
  };
};

export function createApp(
  currentUsers: CurrentUserModule = createCurrentUserModule(),
) {
  const app = new Hono<HonoEnv>();

  app.get("/api/health", (c) =>
    c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
  );

  const requireCurrentUser: MiddlewareHandler<HonoEnv> = async (c, next) => {
    const user = await currentUsers.resolve(c.req.raw, c.env);
    c.set("currentUser", user);
    await next();
  };

  app.use("/api/me", requireCurrentUser);
  app.use("/api/me/*", requireCurrentUser);

  app.get("/api/me", (c) => c.json({ user: c.get("currentUser") }));

  app.patch("/api/me/profile", async (c) => {
    const currentUser = c.get("currentUser");
    const profile = await parseProfileUpdate(c.req.raw);
    const user = await currentUsers.updateProfile(
      currentUser.id,
      profile,
      currentUser.authProvider,
      c.env,
    );
    return c.json({ user });
  });

  app.notFound((c) =>
    c.json(
      {
        error: {
          code: "not_found",
          message: "The requested endpoint does not exist.",
        },
      },
      404,
    ),
  );

  app.onError((error, c) => {
    if (error instanceof HttpError) {
      return c.json(
        {
          error: {
            code: error.code,
            message: error.message,
            ...(error.fields ? { fields: error.fields } : {}),
          },
        },
        error.status,
      );
    }

    console.error("Unhandled API error", error);
    return c.json(
      {
        error: {
          code: "internal_error",
          message: "Something went wrong. Please try again.",
        },
      },
      500,
    );
  });

  return app;
}
