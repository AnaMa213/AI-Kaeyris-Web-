// Defense-in-depth open-redirect guard.
// `?from=` is user-controllable; only accept same-origin relative paths.
// Regex-only checks are insufficient (e.g. `/%5C%5Cevil.com` decodes to `/\\evil.com`
// which the browser normalises to a protocol-relative URL). Parse via URL and
// compare origins instead.
export function safeRedirectTarget(
  from: string | null,
  origin: string,
): string {
  if (!from || !from.startsWith("/") || from.includes("\\")) return "/";

  try {
    const target = new URL(from, origin);
    if (target.origin !== origin) return "/";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}
