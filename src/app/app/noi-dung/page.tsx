import type { Metadata } from "next";
import { ContentManager } from "@/components/content-manager";
import { getCurrentTenantId } from "@/lib/repository/current-tenant";
import { getAdminContent } from "@/lib/repository/content";

export const metadata: Metadata = { title: "Bài viết, sự kiện và liên hệ" };

export default async function ContentPage() {
  const tenantId = await getCurrentTenantId();
  const content = await getAdminContent(tenantId);
  return <ContentManager tenantId={tenantId} posts={content.posts} events={content.events} contacts={content.contacts} />;
}
