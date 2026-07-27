import { sValidator } from "@hono/standard-validator";
import { Hono, type MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppUser } from "../shared/contracts";
import { profileUpdateSchema } from "../shared/profile";
import {
  createAdminUsersModule,
  type AdminUsersModule,
} from "./admin-users";
import {
  createCurrentUserModule,
  type CurrentUserModule,
} from "./current-user";
import type { Bindings } from "./env";
import { HttpError } from "./errors";
import { profileValidationError } from "./profile";

type HonoEnv = {
  Bindings: Bindings;
  Variables: {
    currentUser: AppUser;
  };
};

export function createApp(
  currentUsers: CurrentUserModule = createCurrentUserModule(),
  adminUsers: AdminUsersModule = createAdminUsersModule(),
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

  const requireAdmin: MiddlewareHandler<HonoEnv> = async (c, next) => {
    if (!c.get("currentUser").isAdmin) {
      throw new HttpError(
        403,
        "admin_required",
        "Administrator access is required.",
      );
    }
    await next();
  };

  app.use("/api/me", requireCurrentUser);
  app.use("/api/me/*", requireCurrentUser);
  app.use("/api/admin/*", requireCurrentUser);
  app.use("/api/admin/*", requireAdmin);

  app.get("/api/me", (c) => c.json({ user: c.get("currentUser") }));

  app.patch(
    "/api/me/profile",
    sValidator("json", profileUpdateSchema, (result) => {
      if (!result.success) {
        throw profileValidationError(result.error);
      }
    }),
    async (c) => {
      const currentUser = c.get("currentUser");
      const profile = c.req.valid("json");
      const user = await currentUsers.updateProfile(
        currentUser.id,
        profile,
        currentUser.authProvider,
        c.env,
      );
      return c.json({ user });
    },
  );

  app.get("/api/admin/users", async (c) => {
    const users = await adminUsers.list(c.env);
    return c.json({ users });
  });

  app.get("/admin", requireCurrentUser, requireAdmin, (c) =>
    c.env.ASSETS.fetch(c.req.raw),
  );
  app.get("/admin/*", requireCurrentUser, requireAdmin, (c) =>
    c.env.ASSETS.fetch(c.req.raw),
  );

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

    if (
      error instanceof HTTPException &&
      error.status === 400 &&
      error.message === "Malformed JSON in request body"
    ) {
      return c.json(
        {
          error: {
            code: "invalid_json",
            message: "The request body must be valid JSON.",
          },
        },
        400,
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
