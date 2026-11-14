import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const INTERNAL_PREFIXES = ["/_next", "/api", "/site", "/favicon", "/robots", "/sitemap", "/monitoring"];
const APP_PASSTHROUGH_PREFIXES = ["/app", "/auth", "/dang-nhap", "/dang-ky", "/quen-mat-khau", "/dat-lai-mat-khau", "/xac-minh-email", "/tao-dong-ho", "/loi-moi"];

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
    `connect-src 'self' https://*.supabase.co https://api-merchant.payos.vn https://challenges.cloudflare.com${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
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

function hostnameWithoutPort(host: string) {
  return host.split(":")[0].toLowerCase();
}

function tenantSubdomain(host: string, rootDomain: string) {
  const hostname = hostnameWithoutPort(host);
  const root = hostnameWithoutPort(rootDomain);
  if (hostname.endsWith(".localhost")) return hostname.slice(0, -".localhost".length);
  if (hostname === root || !hostname.endsWith(`.${root}`)) return undefined;
  return hostname.slice(0, -(root.length + 1));
}

async function refreshAuth(request: NextRequest, response: NextResponse) {
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
  const host = request.headers.get("host") ?? "localhost:3000";
  const rootDomain = process.env.ROOT_DOMAIN ?? "localhost:3000";
  const subdomain = tenantSubdomain(host, rootDomain);
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response: NextResponse;
  if (subdomain && !INTERNAL_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (subdomain === "www") {
      response = NextResponse.next({ request: { headers: requestHeaders } });
    } else if (subdomain === "app") {
      if (APP_PASSTHROUGH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
        response = NextResponse.next({ request: { headers: requestHeaders } });
      } else {
        const destination = request.nextUrl.clone();
        destination.pathname = pathname === "/" ? "/app" : `/app${pathname}`;
        response = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
      }
    } else {
      const destination = request.nextUrl.clone();
      destination.pathname = `/site/${subdomain}${pathname === "/" ? "" : pathname}`;
      requestHeaders.set("x-tenant-slug", subdomain);
      response = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
    }
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set("Content-Security-Policy", csp);
  return refreshAuth(request, response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"]
};
