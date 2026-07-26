export function hasAdminRole(
  userEmail: string,
  configuredAdminEmail: string | undefined,
): boolean {
  const normalizedAdminEmail = configuredAdminEmail?.trim().toLowerCase();
  return Boolean(
    normalizedAdminEmail &&
      !normalizedAdminEmail.startsWith("replace-with-") &&
      userEmail.toLowerCase() === normalizedAdminEmail,
  );
}
