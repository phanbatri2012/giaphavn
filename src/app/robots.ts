import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const origin = process.env.NEXT_PUBLIC_ROOT_URL ?? "http://localhost:3000";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/app/", "/api/", "/dang-nhap", "/dang-ky", "/quen-mat-khau", "/dat-lai-mat-khau", "/tao-dong-ho"] }],
    sitemap: `${origin}/sitemap.xml`
  };
}
