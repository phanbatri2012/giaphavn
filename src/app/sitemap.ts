import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getTenantSnapshot } from "@/lib/repository/tenants";

function subdomainFor(host: string, rootValue: string) {
  const hostname = host.split(":")[0].toLowerCase();
  const root = rootValue.split(":")[0].toLowerCase();
  if (hostname.endsWith(".localhost")) return hostname.slice(0, -".localhost".length);
  return hostname.endsWith(`.${root}`) ? hostname.slice(0, -(root.length + 1)) : undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const root = process.env.ROOT_DOMAIN ?? "localhost:3000";
  const subdomain = subdomainFor(host, root);
  if (subdomain && !["app", "www"].includes(subdomain)) {
    const snapshot = await getTenantSnapshot(subdomain);
    if (!snapshot) return [];
    const origin = `${host.includes("localhost") ? "http" : "https"}://${host}`;
    const paths = ["/", ...(snapshot.tree.visibility === "public" ? ["/pha-do"] : []), ...(snapshot.posts.length ? ["/tin-tuc", ...snapshot.posts.map((post) => `/tin-tuc/${post.slug}`)] : []), ...(snapshot.events.length ? ["/su-kien"] : []), ...(snapshot.albums.length ? ["/thu-vien", ...snapshot.albums.map((album) => `/thu-vien/${album.id}`)] : []), ...(snapshot.tenant.chronicle ? ["/pha-ky"] : []), "/lien-he"];
    return paths.map((path) => ({ url: `${origin}${path === "/" ? "" : path}`, lastModified: new Date(), changeFrequency: path === "/" ? "weekly" : "monthly", priority: path === "/" ? 1 : 0.7 }));
  }
  const base = process.env.NEXT_PUBLIC_ROOT_URL ?? "http://localhost:3000";
  return ["", "/bang-gia", "/chinh-sach-bao-mat", "/dieu-khoan"].map((path) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: path === "" ? "weekly" : "monthly", priority: path === "" ? 1 : 0.7 }));
}
