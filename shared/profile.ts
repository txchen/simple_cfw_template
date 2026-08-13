import * as v from "valibot";

const optionalProfileString = () =>
  v.pipe(
    v.optional(v.nullable(v.string("Must be a string or null.")), null),
    v.transform((value) => value?.trim() || null),
  );

export const profileUpdateSchema = v.pipe(
  v.custom<Record<string, unknown>>(
    (value) => typeof value === "object" && value !== null && !Array.isArray(value),
    "The profile must be a JSON object.",
  ),
  v.object({
    displayName: v.pipe(
      optionalProfileString(),
      v.check(
        (value) => value === null || value.length <= 80,
        "Display name must be 80 characters or fewer.",
      ),
    ),
    avatarUrl: v.pipe(
      optionalProfileString(),
      v.check(
        (value) => value === null || value.length <= 500,
        "Avatar URL must be 500 characters or fewer.",
      ),
      v.check(
        (value) => value === null || isHttpUrl(value),
        "Avatar URL must use http:// or https://.",
      ),
    ),
    timezone: v.pipe(
      optionalProfileString(),
      v.check(
        (value) => value === null || (value.length <= 100 && isTimezone(value)),
        "Use a valid IANA timezone such as America/Los_Angeles.",
      ),
    ),
  }),
);

export type ProfileUpdate = v.InferOutput<typeof profileUpdateSchema>;

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
