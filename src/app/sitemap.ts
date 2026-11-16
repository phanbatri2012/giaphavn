import type { MetadataRoute } from "next";
import { getTenantSnapshot } from "@/lib/repository/tenants";
import { personalFamilySlug } from "@/lib/personal/mode";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slug = personalFamilySlug();
  const snapshot = await getTenantSnapshot(slug);
  if (!snapshot?.tenant.published) return [];
  const base = process.env.NEXT_PUBLIC_ROOT_URL ?? "http://localhost:3000";
  const paths = ["/", ...(snapshot.tree.visibility === "public" ? ["/pha-do"] : []), ...(snapshot.posts.length ? ["/tin-tuc", ...snapshot.posts.map((post) => `/tin-tuc/${post.slug}`)] : []), ...(snapshot.events.length ? ["/su-kien"] : []), ...(snapshot.albums.length ? ["/thu-vien", ...snapshot.albums.map((album) => `/thu-vien/${album.id}`)] : []), ...(snapshot.tenant.chronicle ? ["/pha-ky"] : []), "/lien-he"];
  return paths.map((path) => ({ url: `${base}${path === "/" ? "" : path}`, lastModified: new Date(), changeFrequency: path === "/" ? "weekly" : "monthly", priority: path === "/" ? 1 : 0.7 }));
}
