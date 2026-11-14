import "server-only";

import { demoTenant } from "@/lib/demo/data";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TenantBranding = {
  id: string; name: string; shortName: string; slug: string; introduction: string; chronicle: string;
  address: string; contactEmail: string; contactPhone: string; mapUrl: string; published: boolean;
  primaryColor: string; accentColor: string; logoUrl: string; bannerUrl: string;
  seoTitle: string; seoDescription: string;
};

export async function getTenantBranding(tenantId: string): Promise<TenantBranding> {
  if (!hasSupabaseConfig()) return { id: demoTenant.id, name: demoTenant.name, shortName: demoTenant.shortName, slug: demoTenant.slug, introduction: demoTenant.introduction, chronicle: demoTenant.chronicle, address: demoTenant.address, contactEmail: demoTenant.contactEmail, contactPhone: demoTenant.contactPhone, mapUrl: "", published: demoTenant.published, primaryColor: demoTenant.theme.primaryColor, accentColor: demoTenant.theme.accentColor, logoUrl: demoTenant.theme.logoUrl ?? "", bannerUrl: demoTenant.theme.bannerUrl ?? "", seoTitle: demoTenant.name, seoDescription: demoTenant.introduction };
  const supabase = await createSupabaseServerClient();
  const [{ data: tenant, error }, { data: settings }] = await Promise.all([
    supabase.from("tenants").select("id, name, short_name, slug, introduction, chronicle, address, contact_email, contact_phone, map_url, published, theme").eq("id", tenantId).single(),
    supabase.from("tenant_settings").select("seo").eq("tenant_id", tenantId).maybeSingle()
  ]);
  if (error || !tenant) throw error ?? new Error("TENANT_NOT_FOUND");
  const theme = (tenant.theme ?? {}) as Record<string, string>;
  const seo = (settings?.seo ?? {}) as Record<string, string>;
  return { id: tenant.id, name: tenant.name, shortName: tenant.short_name, slug: tenant.slug, introduction: tenant.introduction ?? "", chronicle: tenant.chronicle ?? "", address: tenant.address ?? "", contactEmail: tenant.contact_email ?? "", contactPhone: tenant.contact_phone ?? "", mapUrl: tenant.map_url ?? "", published: tenant.published, primaryColor: theme.primaryColor ?? "#a83f24", accentColor: theme.accentColor ?? "#d59b2d", logoUrl: theme.logoUrl ?? "", bannerUrl: theme.bannerUrl ?? "", seoTitle: seo.title ?? tenant.name, seoDescription: seo.description ?? tenant.introduction ?? "" };
}
