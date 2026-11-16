import type { Metadata } from "next";
import { AccountSettings } from "@/components/account-settings";
import { getAccountSettings } from "@/lib/repository/account";
import { getCurrentTenantId } from "@/lib/repository/current-tenant";
import { isLocalDemoPersistenceEnabled } from "@/lib/demo/store";

export const metadata: Metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  const tenantId = await getCurrentTenantId();
  return <AccountSettings settings={await getAccountSettings(tenantId)} localDemo={isLocalDemoPersistenceEnabled()} />;
}
