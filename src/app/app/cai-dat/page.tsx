import type { Metadata } from "next";
import { AccountSettings } from "@/components/account-settings";
import { getAccountSettings } from "@/lib/repository/account";
import { getCurrentTenantId } from "@/lib/repository/current-tenant";

export const metadata: Metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  const tenantId = await getCurrentTenantId();
  return <AccountSettings tenantId={tenantId} settings={await getAccountSettings(tenantId)} />;
}
