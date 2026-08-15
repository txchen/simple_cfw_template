export function userInitials(displayName: string | null, email: string): string {
  return (displayName || email || "?")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function formatMemberDate(value: string, month: "long" | "short" = "long"): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month,
    day: "numeric",
  }).format(new Date(value));
}
