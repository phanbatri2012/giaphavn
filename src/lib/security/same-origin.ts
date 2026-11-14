/**
 * Route Handlers do not receive the automatic Origin/Host comparison that
 * Next.js applies to Server Actions. Browser mutations therefore use this
 * helper before parsing a body or touching storage/database state.
 */
export function hasTrustedOrigin(request: Request) {
  const originValue = request.headers.get("origin");
  if (!originValue) {
    const fetchSite = request.headers.get("sec-fetch-site");
    return !fetchSite || fetchSite === "same-origin" || fetchSite === "same-site" || fetchSite === "none";
  }

  try {
    const origin = new URL(originValue);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost ?? request.headers.get("host") ?? new URL(request.url).host;
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProto ?? new URL(request.url).protocol.replace(":", "");
    return origin.host.toLowerCase() === host.toLowerCase() && origin.protocol === `${protocol}:`;
  } catch {
    return false;
  }
}
