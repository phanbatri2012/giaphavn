import type { Metadata } from "next";
import { AlbumManager } from "@/components/album-manager";
import { getCurrentTenantId } from "@/lib/repository/current-tenant";
import { getAdminContent } from "@/lib/repository/content";

export const metadata: Metadata = { title: "Thư viện" };

export default async function MediaPage() {
  const tenantId = await getCurrentTenantId();
  const content = await getAdminContent(tenantId);
  return <AlbumManager tenantId={tenantId} albums={content.albums} />;
}
