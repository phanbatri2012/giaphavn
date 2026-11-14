import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const root = (process.env.ROOT_DOMAIN ?? "localhost:3000").split(":")[0];
  const hostname = host.split(":")[0];
  const isApp = hostname === `app.${root}` || hostname === "app.localhost";
  const origin = `${host.includes("localhost") ? "http" : "https"}://${host}`;
  return isApp
    ? { rules: [{ userAgent: "*", disallow: "/" }] }
    : { rules: [{ userAgent: "*", allow: "/", disallow: ["/app/", "/api/", "/dang-nhap", "/dang-ky", "/quen-mat-khau", "/dat-lai-mat-khau", "/tao-dong-ho"] }], sitemap: `${origin}/sitemap.xml` };
}
