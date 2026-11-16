import "server-only";

import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isPersonalEdition } from "@/lib/personal/mode";
import { getPersonalSiteState } from "@/lib/personal/site-store";

export type TenantBranding = {
  id: string; name: string; shortName: string; slug: string; introduction: string; chronicle: string;
  address: string; contactEmail: string; contactPhone: string; mapUrl: string; published: boolean;
  primaryColor: string; accentColor: string; logoUrl: string; bannerUrl: string;
  seoTitle: string; seoDescription: string;
};

export async function getTenantBranding(tenantId: string): Promise<TenantBranding> {
  if (isPersonalEdition() || !hasSupabaseConfig()) {
    const state = await getPersonalSiteState();
    if (state.branding.id !== tenantId) throw new Error("PERSONAL_TENANT_NOT_FOUND");
    return state.branding;
  }
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
