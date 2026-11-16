import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { personalFamilySlug } from "@/lib/personal/mode";

const INTERNAL_PREFIXES = ["/_next", "/api", "/favicon", "/robots", "/sitemap", "/monitoring"];
const FAMILY_SECTIONS = ["/pha-do", "/tin-tuc", "/su-kien", "/thu-vien", "/pha-ky", "/lien-he"];
const LEGACY_ACCOUNT_PATHS = ["/bang-gia", "/dang-ky", "/dang-nhap", "/quen-mat-khau", "/dat-lai-mat-khau", "/xac-minh-email", "/tao-dong-ho", "/loi-moi"];
const REMOVED_ADMIN_PATHS = ["/admin/goi-dich-vu", "/admin/ops"];
const REMOVED_API_PATHS = ["/api/payments", "/api/webhooks/payos", "/api/ops", "/api/cron/maintenance", "/api/invitations"];

function contentSecurityPolicy(nonce: string) {
  const supabaseOrigin = (() => {
    try { return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : ""; }
    catch { return ""; }
  })();
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co",
    "font-src 'self' data:",
    `connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    "frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com https://www.google.com",
    "worker-src 'self' blob:",
    "media-src 'self' blob:",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : [])
  ].join("; ");
}

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isFamilyPath(pathname: string) {
  return pathname === "/" || FAMILY_SECTIONS.some((prefix) => matchesPrefix(pathname, prefix));
}

function redirectPath(request: NextRequest, pathname: string) {
  const destination = request.nextUrl.clone();
  destination.pathname = pathname;
  return destination;
}

async function refreshAuth(request: NextRequest, response: NextResponse) {
  if (process.env.APP_MODE !== "saas") return response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return response;

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });
  await supabase.auth.getClaims();
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const familySlug = personalFamilySlug();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response: NextResponse;
  if (
    REMOVED_API_PATHS.some((path) => matchesPrefix(pathname, path)) ||
    pathname === "/api/tenants" ||
    /\/api\/tenants\/[^/]+\/(?:invitations|admins)(?:\/|$)/.test(pathname)
  ) {
    response = NextResponse.json({ error: "Chức năng này không có trong GiaPhaVN Personal Edition." }, { status: 410 });
  } else if (pathname === `/site/${familySlug}` || pathname.startsWith(`/site/${familySlug}/`)) {
    const cleanPath = pathname.slice(`/site/${familySlug}`.length) || "/";
    response = NextResponse.redirect(redirectPath(request, cleanPath));
  } else if (pathname.startsWith("/site/")) {
    response = NextResponse.redirect(redirectPath(request, "/"));
  } else if (matchesPrefix(pathname, "/app")) {
    const adminPath = `/admin${pathname.slice("/app".length)}`;
    response = NextResponse.redirect(redirectPath(request, REMOVED_ADMIN_PATHS.some((path) => matchesPrefix(adminPath, path)) ? "/admin" : adminPath));
  } else if (REMOVED_ADMIN_PATHS.some((path) => matchesPrefix(pathname, path))) {
    response = NextResponse.redirect(redirectPath(request, "/admin"));
  } else if (matchesPrefix(pathname, "/admin")) {
    const destination = request.nextUrl.clone();
    destination.pathname = `/app${pathname.slice("/admin".length)}`;
    response = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
  } else if (LEGACY_ACCOUNT_PATHS.some((path) => matchesPrefix(pathname, path))) {
    response = NextResponse.redirect(redirectPath(request, "/admin"));
  } else if (!INTERNAL_PREFIXES.some((prefix) => pathname.startsWith(prefix)) && isFamilyPath(pathname)) {
    const destination = request.nextUrl.clone();
    destination.pathname = `/site/${familySlug}${pathname === "/" ? "" : pathname}`;
    requestHeaders.set("x-tenant-slug", familySlug);
    requestHeaders.set("x-personal-site", "true");
    response = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set("Content-Security-Policy", csp);
  return refreshAuth(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"]
};
