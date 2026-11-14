import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createPayOSClient } from "@/lib/payments/payos";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && secret.length >= 32 && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function collectObjectPaths(prefix: string, depth = 0): Promise<string[]> {
  const admin = createSupabaseAdminClient();
  if (!admin || depth > 5) return [];
  const paths: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await admin.storage.from("tenant-media").list(prefix, { limit: 100, offset });
    if (error || !data?.length) break;
    for (const item of data) {
      const path = `${prefix}/${item.name}`;
      if (item.id) paths.push(path);
      else paths.push(...await collectObjectPaths(path, depth + 1));
    }
    if (data.length < 100) break;
  }
  return paths;
}

async function removeTenantObjects(tenantId: string) {
  const admin = createSupabaseAdminClient();
  if (!admin) return 0;
  const paths = await collectObjectPaths(tenantId);
  let removed = 0;
  for (let index = 0; index < paths.length; index += 100) {
    const batch = paths.slice(index, index + 100);
    const result = await admin.storage.from("tenant-media").remove(batch);
    if (!result.error) removed += batch.length;
  }
  return removed;
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Không có quyền chạy bảo trì." }, { status: 401 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Supabase service role chưa được cấu hình." }, { status: 503 });

  const [{ data: expiredCount, error: expiryError }, { data: cleanup, error: cleanupError }, { data: tenants, error: tenantsError }] = await Promise.all([
    admin.rpc("mark_expired_subscriptions_read_only"),
    admin.rpc("cleanup_operational_data"),
    admin.from("tenants").select("id, slug").not("purge_after", "is", null).lte("purge_after", new Date().toISOString()).limit(25)
  ]);
  if (expiryError || cleanupError || tenantsError) return NextResponse.json({ error: "Bảo trì cơ sở dữ liệu thất bại." }, { status: 500 });

  let purgedTenants = 0;
  let removedObjects = 0;
  let reconciledPayments = 0;
  const payos = createPayOSClient();
  if (payos) {
    const { data: pendingOrders } = await admin.from("payment_orders").select("id, payos_order_code").eq("status", "pending").order("created_at").limit(25);
    for (const order of pendingOrders ?? []) {
      try {
        const provider = await payos.paymentRequests.get(Number(order.payos_order_code));
        const localStatus = provider.status === "CANCELLED" ? "cancelled" : provider.status === "EXPIRED" || provider.status === "FAILED" ? "failed" : undefined;
        await admin.from("payment_orders").update({ provider_status: provider.status, last_reconciled_at: new Date().toISOString(), ...(localStatus ? { status: localStatus } : {}) }).eq("id", order.id).eq("status", "pending");
        reconciledPayments += 1;
      } catch { /* retry on the next maintenance run */ }
    }
  }
  for (const tenant of tenants ?? []) {
    removedObjects += await removeTenantObjects(tenant.id);
    await admin.from("audit_logs").insert({ action: "tenant.purged", entity_type: "tenant", entity_id: tenant.id, metadata: { slug: tenant.slug } });
    const { error } = await admin.from("tenants").delete().eq("id", tenant.id).lte("purge_after", new Date().toISOString());
    if (!error) purgedTenants += 1;
  }

  return NextResponse.json({ expiredSubscriptions: expiredCount ?? 0, cleanup, reconciledPayments, purgedTenants, removedObjects });
}
