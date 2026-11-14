import type { Metadata } from "next";
import { BrandingSettings } from "@/components/branding-settings";
import { getCurrentTenantId } from "@/lib/repository/current-tenant";
import { getTenantBranding } from "@/lib/repository/settings";

export const metadata: Metadata = { title: "Giao diện website" };

export default async function AppearancePage() {
  const tenantId = await getCurrentTenantId();
  const branding = await getTenantBranding(tenantId);
  return <BrandingSettings initial={branding} />;
}
