import type {
  ApiErrorBody,
  AppUser,
  ProfileUpdate,
} from "../shared/contracts";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly fields: ApiErrorBody["error"]["fields"] = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function getCurrentUser(): Promise<AppUser> {
  const response = await fetch("/api/me", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  return readUserResponse(response);
}

export async function updateProfile(
  profile: ProfileUpdate,
): Promise<AppUser> {
  const response = await fetch("/api/me/profile", {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(profile),
  });
  return readUserResponse(response);
}

async function readUserResponse(response: Response): Promise<AppUser> {
  const body = (await response.json()) as
    | { user: AppUser }
    | ApiErrorBody;

  if (!response.ok || !("user" in body)) {
    const error =
      "error" in body
        ? body.error
        : { code: "unexpected_response", message: "Unexpected API response." };
    throw new ApiError(error.message, error.code, error.fields);
  }

  return body.user;
}
